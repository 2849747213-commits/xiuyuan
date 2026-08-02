/**
 * EdgeOne Makers Cloud Function · /api/* 全部路由
 *
 * ★ 不重写任何业务逻辑
 *   - 直接 require('../../server.js')（已经导出 Node IncomingMessage-style handler）
 *   - 把 Web Request 适配为 Node IncomingMessage
 *   - 把 Node 风格 res.end() 适配回 Web Response
 *
 * 同一个 server.js 文件同时被：
 *   - Vercel serverless  : api/index.js 包装
 *   - EdgeOne Makers     : 本文件包装
 *   - 本地 node server.js 启动 : require.main === module 分支
 *
 * 任何业务改动只改 server.js / providers/* / js/* 一份代码
 */

import { createRequire } from 'module';
import { Readable } from 'stream';
import { Buffer } from 'buffer';

const _require = createRequire(import.meta.url);
// 复用 Vercel 那条线已经验过的入口
const nodeHandler = _require('../../server.js');

/**
 * 把 Web Request 转成 Node IncomingMessage-like
 * - url: 仅 path + query string（不带 host）· server.js 内部用 req.url 路由
 *   例如: '/api/classify/ancient' 或 '/api/classify/ancient?foo=bar'
 * - method / headers / body
 */
function webRequestToNodeReq(webReq, pathOnly) {
  let bodyBuf;
  try {
    bodyBuf = Buffer.from(webReq.body || new Uint8Array());
  } catch (e) {
    bodyBuf = Buffer.alloc(0);
  }
  const headers = {};
  try {
    if (webReq.headers && typeof webReq.headers.forEach === 'function') {
      webReq.headers.forEach(function (v, k) { headers[k.toLowerCase()] = v; });
    } else if (webReq.headers && typeof webReq.headers === 'object') {
      for (const k in webReq.headers) headers[k.toLowerCase()] = String(webReq.headers[k]);
    }
  } catch (e) {}
  const stream = new Readable({ read() {} });
  stream.push(bodyBuf);
  stream.push(null);
  const nodeReq = Object.assign(stream, {
    url: pathOnly,
    method: webReq.method || 'GET',
    headers: headers,
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    socket: { remoteAddress: '0.0.0.0', remotePort: 0 },
    connection: { remoteAddress: '0.0.0.0' },
    rawBody: bodyBuf
  });
  return nodeReq;
}

/**
 * 包装 Node res.end()  →  Promise<Web Response>
 */
function makeNodeResPromise() {
  let resolveOuter;
  const promise = new Promise(function (resolve) { resolveOuter = resolve; });
  const headers = {};
  let statusCode = 200;
  const chunks = [];
  const nodeRes = {
    statusCode: 200,
    headersSent: false,
    finished: false,
    setHeader(k, v) {
      const key = String(k).toLowerCase();
      const val = Array.isArray(v) ? v.map(String) : String(v);
      if (headers[key] != null) {
        const cur = Array.isArray(headers[key]) ? headers[key] : [headers[key]];
        headers[key] = cur.concat([val]);
      } else {
        headers[key] = val;
      }
    },
    getHeader(k) { return headers[String(k).toLowerCase()]; },
    removeHeader(k) { delete headers[String(k).toLowerCase()]; },
    writeHead(code, h) {
      if (typeof code === 'number') statusCode = code;
      if (h && typeof h === 'object') {
        for (const k in h) this.setHeader(k, h[k]);
      }
      this.headersSent = true;
    },
    write(chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    },
    end(body) {
      if (body != null) chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
      this.finished = true;
      const webHeaders = new Headers();
      for (const k in headers) {
        const v = headers[k];
        if (Array.isArray(v)) v.forEach(function (vv) { webHeaders.append(k, vv); });
        else webHeaders.set(k, v);
      }
      const bodyBuf = Buffer.concat(chunks);
      resolveOuter(new Response(bodyBuf, { status: statusCode, headers: webHeaders }));
    },
    on() { return this; },
    once() { return this; },
    emit() { return true; }
  };
  return { nodeRes: nodeRes, promise: promise };
}

export default async function onRequest(context) {
  const webReq = context.request;
  // ★ 关键：server.js 用 req.url 路由（精确字符串匹配 '/api/classify/ancient'）
  //   因此必须只传 path + query · 不能带 host
  const rawUrl = (typeof webReq.url === 'string' && webReq.url) || '/';
  const pathOnly = rawUrl.startsWith('http') ? (new URL(rawUrl).pathname + new URL(rawUrl).search) : rawUrl;

  const nodeReq = webRequestToNodeReq(webReq, pathOnly);
  const { nodeRes, promise } = makeNodeResPromise();

  try {
    nodeHandler(nodeReq, nodeRes);
  } catch (e) {
    console.error('[EdgeOne] server.js handler threw:', e && e.message);
    return new Response(JSON.stringify({
      ok: false,
      error: 'edgeone-handler-exception',
      message: String(e && e.message || e)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const timeoutPromise = new Promise(function (resolve) {
    setTimeout(function () {
      resolve(new Response(JSON.stringify({
        ok: false,
        error: 'edgeone-timeout',
        message: 'EdgeOne 兜底 90 秒未收到 server.js 响应'
      }), {
        status: 504,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
    }, 90000);
  });

  return Promise.race([promise, timeoutPromise]);
}

export const onRequestPost = onRequest;
export const onRequestGet = onRequest;
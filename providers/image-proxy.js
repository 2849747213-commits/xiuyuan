// ============================================
// image-proxy.js · 共用图片代理工具
// ============================================
// 用途：拿到 Provider 返回的临时图片 URL 后，服务器端立即 fetch → 转 base64 data URL
// 原因：供应商临时 OSS URL 经常 ERR_CONNECTION_RESET · 不能直接交给浏览器
// 共用：ancient / modern / western 所有需要展示生成图的接口都用此模块
//
// 日志规范（不要打印完整 URL 签名 / 完整 base64）：
//   [IMAGE_PROXY] provider url received · host=<host>
//   [IMAGE_PROXY] upstream status <code>
//   [IMAGE_PROXY] content-type <type> · bytes=<n>
//   [IMAGE_PROXY] base64 bytes <n> (<kb> KB) · within budget / over soft-limit
//   [IMAGE_PROXY] converted to data-url
//   [IMAGE_PROXY] download failed · <reason>
// ============================================
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Vercel serverless 响应体限制约 4.5MB（免费 Hobby）· 留 1MB buffer 给 JSON 壳
// 转 base64 后会比原图大约 33% · 所以原图 ≤ ~2.7MB 是安全阈值
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;   // 8MB 原始下载上限
const SOFT_DATAURL_BUDGET = 3 * 1024 * 1024;  // 3MB base64 上限 · 优先返回
const HARD_DATAURL_BUDGET = 4 * 1024 * 1024;  // 4MB base64 硬上限 · 仍尝试
// 超过 HARD：返回 imageUrl 兜底（带 warning），不强爆接口
const FETCH_TIMEOUT_MS = 20 * 1000;

function _safeHost(urlStr) {
  try { return new URL(urlStr).host; } catch (e) { return 'invalid'; }
}

function _safePath(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.pathname.slice(0, 60) + (u.pathname.length > 60 ? '...' : '');
  } catch (e) { return 'invalid'; }
}

// 校验 content-type 必须是 image/*（image/jpeg, image/png, image/webp, image/gif 等）
function _isImageContentType(ct) {
  if (!ct || typeof ct !== 'string') return false;
  return /^image\/(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(ct.trim());
}

// 强制走 https/http 模块 · 不用第三方 · 走流式累积以支持限制大小
function _fetchToBuffer(rawUrl, maxBytes, timeoutMs) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try { urlObj = new URL(rawUrl); } catch (e) {
      return reject(new Error('invalid-url'));
    }
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return reject(new Error('unsupported-protocol-' + urlObj.protocol));
    }
    const lib = urlObj.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'GET',
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        headers: {
          'User-Agent': 'exhibition-camera-image-proxy/1.0',
          'Accept': 'image/*'
        },
        timeout: timeoutMs || FETCH_TIMEOUT_MS
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status < 200 || status >= 300) {
          // 收完 body 立刻 reject
          let drain = [];
          res.on('data', c => drain.push(c));
          res.on('end', () => reject(new Error('upstream-status-' + status)));
          return;
        }
        const chunks = [];
        let total = 0;
        let aborted = false;
        res.on('data', (c) => {
          if (aborted) return;
          total += c.length;
          if (total > maxBytes) {
            aborted = true;
            try { req.destroy(); } catch (e) {}
            reject(new Error('upstream-too-large-' + total));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          if (aborted) return;
          const buf = Buffer.concat(chunks);
          const ct = (res.headers && res.headers['content-type']) || '';
          resolve({ buffer: buf, contentType: ct, status: status });
        });
        res.on('error', (e) => { if (!aborted) reject(e); });
      }
    );
    req.on('timeout', () => { try { req.destroy(); } catch (e) {} reject(new Error('fetch-timeout')); });
    req.on('error', (e) => { reject(e); });
    req.end();
  });
}

// 规范化 mime 给 data URL
function _normalizeImageMime(rawCt) {
  if (!rawCt) return 'image/jpeg';
  const ct = rawCt.toLowerCase().split(';')[0].trim();
  if (ct === 'image/jpg') return 'image/jpeg';
  if (/^image\/(png|jpeg|webp|gif)$/.test(ct)) return ct;
  return 'image/jpeg'; // 兜底
}

/**
 * 下载远程图片 → 转 base64 data URL
 * @param {string} imageUrl 供应商返回的临时 URL
 * @param {object} [opts] { requestId, label }
 * @returns {Promise<{
 *   ok: boolean,
 *   imageDataUrl?: string,         // 成功时给浏览器
 *   mime?: string,
 *   bytes?: number,
 *   base64Bytes?: number,
 *   fallbackImageUrl?: string,     // 超过硬上限时回退给原 URL
 *   warning?: string,
 *   error?: string,
 *   upstreamStatus?: number
 * }>}
 */
async function downloadImageAsDataUrl(imageUrl, opts) {
  const o = opts || {};
  const label = o.label || 'IMAGE_PROXY';
  if (!imageUrl || typeof imageUrl !== 'string') {
    return { ok: false, error: 'no-image-url' };
  }
  console.log('[' + label + '] provider url received · host=' + _safeHost(imageUrl) + ' · path=' + _safePath(imageUrl));

  let dl;
  try {
    dl = await _fetchToBuffer(imageUrl, MAX_DOWNLOAD_BYTES, FETCH_TIMEOUT_MS);
  } catch (e) {
    console.log('[' + label + '] download failed · reason=' + e.message);
    return { ok: false, error: 'download-failed', reason: e.message };
  }

  const status = dl.status;
  const contentType = dl.contentType || '';
  const bytes = dl.buffer.length;
  console.log('[' + label + '] upstream status ' + status);
  console.log('[' + label + '] content-type ' + (contentType || '(none)') + ' · bytes=' + bytes);

  if (!_isImageContentType(contentType)) {
    console.log('[' + label + '] rejected · not image/* (content-type=' + contentType + ')');
    return { ok: false, error: 'bad-content-type', contentType, upstreamStatus: status, bytes };
  }

  if (bytes < 512) {
    console.log('[' + label + '] rejected · payload too small (' + bytes + ' bytes)');
    return { ok: false, error: 'payload-too-small', bytes, contentType, upstreamStatus: status };
  }

  const mime = _normalizeImageMime(contentType);
  const b64 = dl.buffer.toString('base64');
  const base64Bytes = b64.length;
  const kb = Math.round(base64Bytes / 1024);

  // 软上限 3MB：超过仍可发，但日志警告（Vercel 4.5MB 限制）
  if (base64Bytes > HARD_DATAURL_BUDGET) {
    console.log('[' + label + '] base64 bytes ' + base64Bytes + ' (' + kb + ' KB) · over hard limit · fallback to imageUrl');
    return {
      ok: true,
      fallbackImageUrl: imageUrl,
      mime: mime,
      bytes: bytes,
      base64Bytes: base64Bytes,
      warning: 'data-url-too-large-for-response-budget'
    };
  }

  if (base64Bytes > SOFT_DATAURL_BUDGET) {
    console.log('[' + label + '] base64 bytes ' + base64Bytes + ' (' + kb + ' KB) · over soft limit · still using data-url (vercel-budget-warning)');
  } else {
    console.log('[' + label + '] base64 bytes ' + base64Bytes + ' (' + kb + ' KB) · within budget');
  }

  const dataUrl = 'data:' + mime + ';base64,' + b64;
  console.log('[' + label + '] converted to data-url');
  return {
    ok: true,
    imageDataUrl: dataUrl,
    mime: mime,
    bytes: bytes,
    base64Bytes: base64Bytes
  };
}

module.exports = {
  downloadImageAsDataUrl: downloadImageAsDataUrl
};

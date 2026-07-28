// Vercel serverless function · 直接 import server.js 的 handler
// 避免之前 VM 黑科技在 serverless 环境崩的问题
const { Readable } = require('stream');
const handler = require('../server.js');

module.exports = async (req, res) => {
  try {
    // Vercel Node runtime 把 req 包装成 IncomingMessage-like · 但保险起见包一层
    if (!req || typeof req.method !== 'string') {
      // Edge runtime 或 Web Request · 包装
      const u = new URL(req.url || '/', 'http://localhost');
      const fakeReq = Object.assign(new Readable({ read() {} }), {
        url: req.url,
        method: req.method || 'GET',
        headers: req.headers || {},
      });
      const fakeRes = {
        statusCode: 200,
        setHeader(k, v) { this.headers = this.headers || {}; this.headers[k] = v; },
        end(body) {
          res.statusCode = this.statusCode || 200;
          if (this.headers) {
            for (const k in this.headers) res.setHeader(k, this.headers[k]);
          }
          res.end(body);
        }
      };
      return handler(fakeReq, fakeRes);
    }
    return handler(req, res);
  } catch (e) {
    console.error('[api] handler error:', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'server-error', message: String(e && e.message) }));
  }
};

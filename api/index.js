// Vercel serverless function · 包装 server.js · 不动原文件
// - 读 server.js 源码
// - 替换 http.createServer 包裹为 async function handleRequest
// - 替换 server.listen 包裹为 module.exports
// - 在 VM context 跑 · 拿 handler
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const SERVER_SRC = fs.readFileSync(SERVER_PATH, 'utf8');

const TRANSFORMED = SERVER_SRC
  .replace(
    'const server = http.createServer(async (req, res) => {',
    'async function handleRequest(req, res) {'
  )
  .replace(
    /\}\);\s*\n\s*server\.listen\(PORT, '0\.0\.0\.0', \(\) => \{\s*\n\s*console\.log\('\[server\] listening on http:\/\/localhost:' \+ PORT\);\s*\n\s*\}\);/,
    '}\n\nmodule.exports = handleRequest;\n'
  );

const ctx = {
  require: require,
  module: { exports: {} },
  exports: {},
  __dirname: path.join(__dirname, '..'),
  __filename: SERVER_PATH,
  process: process,
  console: console,
  Buffer: Buffer,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};
ctx.exports = ctx.module.exports;
vm.createContext(ctx);
vm.runInContext(TRANSFORMED, ctx);
module.exports = ctx.module.exports;
console.log('[vercel] api/index.js loaded · handleRequest type =', typeof module.exports);

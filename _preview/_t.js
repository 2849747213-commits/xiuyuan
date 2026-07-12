// _t.js · debug path
const http = require('http');
function test(path, body) {
  return new Promise((res) => {
    const req = http.request({
      hostname: 'localhost', port: 8000, path, method: 'POST', timeout: 30000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ path, status: r.statusCode, bytes: d.length, body: d.slice(0, 300) })); });
    req.on('timeout', () => { req.destroy(new Error('timeout 30s')); });
    req.on('error', e => res({ path, status: 0, err: e.message }));
    req.write(body); req.end();
  });
}
(async () => {
  const body = JSON.stringify({ system: 'ancient', sample: { width: 640, height: 480 } });
  for (const p of ['/api/classify', '/exhibition-camera/api/classify']) {
    const r = await test(p, body);
    console.log(p + ' -> status=' + r.status + ' bytes=' + r.bytes + ' body=' + r.body);
  }
})();

// _dbg.js — 验证三路径 + fallback
const http = require('http');

function post(path, body) {
  return new Promise((res, rej) => {
    const req = http.request(
      { hostname: 'localhost', port: 8000, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }
    );
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const sys of ['ancient', 'modern', 'western']) {
    const body = JSON.stringify({
      system: sys,
      sample: { width: 640, height: 480, fileName: 'demo.jpg', fileSize: 2048, dominantColor: '#888888', imageCaption: 'demo', aspect: 640 / 480 }
    });
    for (const force of [false, true]) {
      const path = force ? '/api/classify?force=fallback' : '/api/classify';
      const r = await post(path, body);
      const obj = JSON.parse(r.body);
      console.log('==== [' + sys + (force ? ' · force=fallback' : '') + '] status=' + r.status + ' ====');
      console.log('  source =', obj.source);
      console.log('  ok     =', obj.ok);
      if (obj.upstreamParseFailed) console.log('  fallbackReason =', obj.upstreamParseFailed);
      if (obj.data.verdict) console.log('  verdict =', obj.data.verdict);
      if (obj.data.fields) {
        console.log('  fields (' + obj.data.fields.length + '):');
        for (const f of obj.data.fields) console.log('    ' + f.label + ' = ' + f.value);
      }
      if (obj.data.identityCard) {
        console.log('  identityCard:');
        for (const [k, v] of Object.entries(obj.data.identityCard)) console.log('    ' + k + ' = ' + v);
      }
      if (obj.data.physiognomy) {
        console.log('  physiognomy (' + obj.data.physiognomy.length + '):');
        for (const f of obj.data.physiognomy) console.log('    ' + f.label + ' = ' + f.value);
      }
      console.log('');
    }
  }
  console.log('==== DONE ====');
})().catch(e => { console.error('ERR', e); process.exit(1); });

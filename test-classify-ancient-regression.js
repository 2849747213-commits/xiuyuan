#!/usr/bin/env node
// 验证原有 /api/classify/ancient 仍然正常工作
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      method: 'POST',
      hostname: 'localhost',
      port: 8788,
      path: path,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data, 'utf8') }
    };
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('========== /api/classify/ancient 回归验证 ==========');

  // 1) 缺少 image
  let r1 = await post('/api/classify/ancient', { allowedSampleIds: ['A01'] });
  console.log('[1] missing image status=' + r1.status, '·', r1.body);
  if (r1.status !== 400 || !r1.body.includes('invalid-camera-image')) { console.error('  ✗ FAIL'); process.exit(1); }
  console.log('  ✓ OK');

  // 2) image 过短
  let r2 = await post('/api/classify/ancient', { image: 'data:image/jpeg;base64,AAAA' });
  console.log('[2] short image status=' + r2.status, '·', r2.body);
  if (r2.status !== 400 || !r2.body.includes('invalid-camera-image')) { console.error('  ✗ FAIL'); process.exit(1); }
  console.log('  ✓ OK');

  // 3) /exhibition-camera prefix 支持
  let r3 = await post('/exhibition-camera/api/classify/ancient', { image: 'data:image/jpeg;base64,AAAA' });
  console.log('[3] /exhibition-camera prefix short image status=' + r3.status, '·', r3.body);
  if (r3.status !== 400 || !r3.body.includes('invalid-camera-image')) { console.error('  ✗ FAIL'); process.exit(1); }
  console.log('  ✓ OK (prefix兼容)');

  console.log('========== /api/classify/ancient 回归通过 ==========');
}

run().catch(e => { console.error('test err', e); process.exit(1); });

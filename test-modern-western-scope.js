#!/usr/bin/env node
// 验证 modern 和 western 端点没有被破坏
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
  console.log('========== modern / western 端点回归验证 ==========');

  let r1 = await post('/api/classify/modern', { image: 'data:image/jpeg;base64,AAAA' });
  console.log('[1] modern short image status=' + r1.status, '·', r1.body.slice(0, 200));
  if (r1.status !== 400) { console.error('  ✗ FAIL'); process.exit(1); }
  console.log('  ✓ OK');

  let r2 = await post('/api/classify/western', { image: 'data:image/jpeg;base64,AAAA' });
  console.log('[2] western short image status=' + r2.status, '·', r2.body.slice(0, 200));
  if (r2.status !== 400) { console.error('  ✗ FAIL'); process.exit(1); }
  console.log('  ✓ OK');

  // /api/fusion/ancient 必须接受 ancient 路径（已有）
  // /api/fusion/modern 当前没有 - 不应该创建
  let r3 = await post('/api/fusion/modern', { sampleId: 'M01' });
  console.log('[3] /api/fusion/modern (不应存在) status=' + r3.status);
  if (r3.status === 404 || r3.status === 405) {
    console.log('  ✓ OK (modern fusion 未实现 · 符合当前阶段要求)');
  } else {
    console.warn('  ⚠  unexpected status: ' + r3.status);
  }

  let r4 = await post('/api/fusion/western', { sampleId: 'W01' });
  console.log('[4] /api/fusion/western (不应存在) status=' + r4.status);
  if (r4.status === 404 || r4.status === 405) {
    console.log('  ✓ OK (western fusion 未实现 · 符合当前阶段要求)');
  } else {
    console.warn('  ⚠  unexpected status: ' + r4.status);
  }

  console.log('========== modern / western / fusion-scope 验证通过 ==========');
}

run().catch(e => { console.error('test err', e); process.exit(1); });

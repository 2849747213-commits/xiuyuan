#!/usr/bin/env node
// 端到端：/api/fusion/ancient 用现有 AI_API_KEY 真实生成
const http = require('http');

// 2KB 伪 base64 用户图（已实测通过 base64.length >= 1024 检查）
const fakeBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAAAAAAAAAAH//Z'.padEnd(2048, 'A');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      method: 'POST', hostname: 'localhost', port: 8788, path: path,
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

(async () => {
  console.log('========== 端到端真实生图 ==========');

  // 1. A01 + userImage · 复用 AI_API_KEY
  console.log('\n[E1] A12 苏轼相 + 2KB userImage');
  const r1 = await post('/api/fusion/ancient', {
    sampleId: 'A12',
    userImage: 'data:image/jpeg;base64,' + fakeBase64,
    requestId: 'fusion_e2e_a12'
  });
  console.log('  status =', r1.status);
  console.log('  body (first 600) =', r1.body.slice(0, 600));
  if (r1.status === 200 && r1.body.includes('"ok":true') && r1.body.includes('"imageUrl"')) {
    const o = JSON.parse(r1.body);
    console.log('  ✓✓✓ SUCCESS · imageUrl length =', (o.imageUrl || '').length);
  } else {
    console.log('  ✗ FAIL');
    process.exit(1);
  }

  // 2. A16 陈圆圆
  console.log('\n[E2] A16 陈圆圆相');
  const r2 = await post('/api/fusion/ancient', {
    sampleId: 'A16',
    userImage: 'data:image/jpeg;base64,' + fakeBase64,
    requestId: 'fusion_e2e_a16'
  });
  console.log('  status =', r2.status);
  console.log('  body (first 600) =', r2.body.slice(0, 600));
  if (r2.status === 200) {
    console.log('  ✓ A16 also generated');
  }

  // 3. 非法 sampleId 仍被拦截
  console.log('\n[E3] invalid sampleId');
  const r3 = await post('/api/fusion/ancient', {
    sampleId: 'B99',
    userImage: 'data:image/jpeg;base64,' + fakeBase64
  });
  console.log('  status =', r3.status, '·', r3.body);
  if (r3.status === 400) console.log('  ✓ still rejected');

  // 4. /exhibition-camera 前缀仍兼容
  console.log('\n[E4] /exhibition-camera prefix');
  const r4 = await post('/exhibition-camera/api/fusion/ancient', {
    sampleId: 'A01',
    userImage: 'data:image/jpeg;base64,' + fakeBase64
  });
  console.log('  status =', r4.status);
  if (r4.status === 200) console.log('  ✓ prefix 兼容');

  console.log('\n========== 端到端测试完成 ==========');
})().catch(e => { console.error(e); process.exit(1); });

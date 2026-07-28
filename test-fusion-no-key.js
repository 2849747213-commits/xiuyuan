#!/usr/bin/env node
// 验证：当所有 Key 都被清空时,/api/fusion/ancient 必须返回 503 image-provider-not-configured
// 方法: 重命名项目 .env → 启动 server → 请求 → 还原 .env
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8799;
const PROJ = path.resolve('d:\\TRAE SOLO CN\\程序艺术作业\\exhibition-camera');
const envPath = path.join(PROJ, '.env');
const bak = envPath + '.nokey.bak';

function post(p, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ method: 'POST', hostname: 'localhost', port: PORT, path: p, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data, 'utf8') } }, (res) => {
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
  // 1. 重命名 .env 阻断 server 读它
  if (fs.existsSync(envPath)) {
    fs.renameSync(envPath, bak);
    console.log('[no-key] renamed .env → .env.nokey.bak');
  }

  // 2. 启动子进程,显式置空所有 KEY
  const env = Object.assign({}, process.env, {
    PORT: String(PORT),
    AI_API_KEY: '',
    IMAGE_API_KEY: '',
    MINIMAX_API_KEY: '',
    IMAGE_KEY: '',
    AI_IMAGE_KEY: ''
  });
  const proc = spawn('node', ['server.js'], { cwd: PROJ, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let outLog = '';
  proc.stdout.on('data', d => outLog += d.toString());
  proc.stderr.on('data', d => outLog += '[err] ' + d.toString());

  // 等服务起来
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 250));
    if (outLog.includes('listening')) break;
  }
  if (!outLog.includes('listening')) {
    console.error('[no-key] server not started · log:\n' + outLog);
    if (fs.existsSync(bak)) fs.renameSync(bak, envPath);
    proc.kill();
    process.exit(1);
  }
  console.log('[no-key] server started with empty KEY');

  // 3. 测 503
  const fakeBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAAAAAAAAAAH//Z'.padEnd(2048, 'A');
  const r = await post('/api/fusion/ancient', { sampleId: 'A01', userImage: 'data:image/jpeg;base64,' + fakeBase64 });
  console.log('[no-key] POST /api/fusion/ancient status =', r.status);
  console.log('[no-key] body =', r.body);

  // 4. 关闭
  proc.kill();
  await new Promise(r => setTimeout(r, 500));

  // 5. 还原 .env
  if (fs.existsSync(bak)) {
    fs.renameSync(bak, envPath);
    console.log('[no-key] restored .env');
  }

  if (r.status !== 503 || !r.body.includes('image-provider-not-configured')) {
    console.error('  ✗ FAIL · 期望 503 image-provider-not-configured');
    process.exit(1);
  }
  console.log('  ✓ 503 image-provider-not-configured (符合预期)');
  console.log('========== 测 503 路径通过 ==========');
})().catch(e => { console.error(e); if (fs.existsSync(bak)) fs.renameSync(bak, envPath); process.exit(1); });

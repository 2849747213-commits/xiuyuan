#!/usr/bin/env node
// 探测现有 AI_API_KEY 能否直接访问 MiniMax image_generation 端点
// 真实测试，不靠猜测
const https = require('https');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = env.AI_API_KEY;
const BASE = env.AI_BASE_URL || 'https://api.minimaxi.com/v1';
console.log('[probe] BASE =', BASE);
console.log('[probe] KEY =', KEY ? '***' + KEY.slice(-4) : '(empty)');

const fakeBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAAAAAAAAAAH//Z'.padEnd(2048, 'A');

function probe(payload, label) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const url = new URL(BASE.replace(/\/$/, '') + '/image_generation');
    const opts = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(body, 'utf8')
      },
      timeout: 30 * 1000
    };
    console.log('---');
    console.log('[probe] ' + label);
    console.log('[probe] endpoint =', url.toString());
    const req = https.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        console.log('[probe] status =', res.statusCode);
        console.log('[probe] content-type =', res.headers['content-type']);
        console.log('[probe] raw (first 800) =', text.slice(0, 800));
        resolve({ status: res.statusCode, body: text });
      });
    });
    req.on('timeout', () => { console.error('[probe] TIMEOUT'); req.destroy(new Error('timeout')); });
    req.on('error', e => { console.error('[probe] err =', e.message); resolve({ status: 0, body: e.message }); });
    req.write(body);
    req.end();
  });
}

(async () => {
  if (!KEY) { console.error('No AI_API_KEY in .env'); process.exit(1); }

  // 1. 最简单的 prompt · 不带 reference · 测试 image-01 是否可用
  await probe({
    model: 'image-01',
    prompt: 'a single small red apple on a white background',
    aspect_ratio: '1:1',
    n: 1,
    response_format: 'url'
  }, 'T1: model=image-01, no reference, simple prompt');

  // 2. 用 image-01 + subject_reference (用户图) · 类似上次的融合请求
  await probe({
    model: 'image-01',
    prompt: 'generate a portrait',
    subject_reference: [{ type: 'character', image_file: 'data:image/jpeg;base64,' + fakeBase64 }],
    aspect_ratio: '3:4',
    n: 1,
    response_format: 'url'
  }, 'T2: model=image-01, subject_reference=userImage');

  // 3. 试 MiniMax 文档中的另一模型名 minimax-image-01
  await probe({
    model: 'minimax-image-01',
    prompt: 'a single small red apple on a white background',
    aspect_ratio: '1:1',
    n: 1,
    response_format: 'url'
  }, 'T3: model=minimax-image-01, simple prompt');

  // 4. 试 MiniMax 官方最新模型名 image-01-live
  await probe({
    model: 'image-01-live',
    prompt: 'a single small red apple on a white background',
    aspect_ratio: '1:1',
    n: 1,
    response_format: 'url'
  }, 'T4: model=image-01-live, simple prompt');

  console.log('---');
  console.log('[probe] done');
})();

// _e2e.js · 端到端最终测试
// 只验证 三条路径 + force=fallback + 结果页可用性
const http = require('http');

function post(opts, body) {
  return new Promise((res, rej) => {
    const req = http.request({ ...opts, timeout: 30000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d, headers: r.headers })); });
    req.on('timeout', () => { req.destroy(new Error('timeout 30s')); });
    req.on('error', rej);
    if (body) req.write(body);
    req.end();
  });
}

function get(opts) {
  return new Promise((res, rej) => {
    const req = http.request({ ...opts, timeout: 10000, method: 'GET' }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); });
    req.on('timeout', () => { req.destroy(new Error('timeout 10s')); });
    req.on('error', rej);
    req.end();
  });
}

const HOST = { hostname: 'localhost', port: 8000 };

async function classify(sys, force) {
  const body = JSON.stringify({ system: sys, sample: { width: 640, height: 480, fileName: 'EXH_demo.jpg', fileSize: 2048, dominantColor: '#888888', imageCaption: 'demo frame', aspect: 640/480 } });
  const path = force ? `/exhibition-camera/api/classify?force=fallback` : '/exhibition-camera/api/classify';
  console.log(`[client] POST ${path} · system=${sys} · force=${force}`);
  const r = await post({ ...HOST, path, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, body);
  console.log(`[client]   status=${r.status} · bytes=${r.body.length}`);
  if (r.body.length < 100) console.log(`[client]   body=${r.body}`);
  if (r.body.length === 0) throw new Error('empty body');
  return JSON.parse(r.body);
}

async function getPage(p) {
  const r = await get({ ...HOST, path: p });
  return r;
}

const pageForSystem = {
  ancient: '/exhibition-camera/_preview/ancient-skin-v4.html?v=4',
  modern:  '/exhibition-camera/_preview/modern-result-preview.html',
  western: '/exhibition-camera/_preview/western-skin.html?v=6',
};

(async () => {
  console.log('');
  console.log('==== 1. 三路径 force=fallback (AI 失败) ====');
  for (const sys of ['ancient', 'modern', 'western']) {
    try {
      const r = await classify(sys, true);
      const data = r.data;
      console.log(`[${sys}] source=${r.source} · verdict="${data.verdict}"`);
      if (data.fields) for (const f of data.fields) console.log(`     ${f.label} = ${f.value}`);
      if (data.identityCard) for (const [k, v] of Object.entries(data.identityCard)) console.log(`     ${k} = ${v}`);
      if (data.physiognomy) for (const f of data.physiognomy) console.log(`     ${f.label} = ${f.value}`);
    } catch (e) {
      console.log(`[${sys}] ERR: ${e.message}`);
    }
  }

  console.log('');
  console.log('==== 2. 三路径 force=AI 真实（10s 内可能慢或超时）====');
  for (const sys of ['ancient', 'modern', 'western']) {
    try {
      const r = await classify(sys, false);
      const data = r.data;
      console.log(`[${sys}] source=${r.source} · verdict="${data.verdict}"`);
      if (data.fields) for (const f of data.fields) console.log(`     ${f.label} = ${f.value}`);
      if (data.identityCard) for (const [k, v] of Object.entries(data.identityCard)) console.log(`     ${k} = ${v}`);
      if (data.physiognomy) for (const f of data.physiognomy) console.log(`     ${f.label} = ${f.value}`);
    } catch (e) {
      console.log(`[${sys}] ERR: ${e.message}`);
    }
  }

  console.log('');
  console.log('==== 3. 三结果页可用性 ====');
  for (const sys of ['ancient', 'modern', 'western']) {
    const r = await getPage(pageForSystem[sys]);
    const checks = {
      status_200: r.status === 200,
      no_undefined: !r.body.includes('undefined'),
      body_ok: r.body.length > 8000,
      has_fallback: (sys === 'ancient' && r.body.includes('命宫偏滞')) || (sys === 'modern' && r.body.includes('顺性偏好')) || (sys === 'western' && (r.body.includes('BERT-19') || r.body.includes('高位 · 聪慧')))
    };
    const allOk = Object.values(checks).every(v => v);
    console.log(`[${sys}] status=${r.status} bytes=${r.body.length} all_ok=${allOk}`);
  }

  console.log('');
  console.log('==== 4. 路径选择页可用性 ====');
  for (const p of ['/exhibition-camera/_preview/camera-overlay-ui.locked.html?v=current', '/exhibition-camera/_preview/path-overlay-v5.html?v=v9', '/exhibition-camera/_preview/systems-overview-v2.locked.html']) {
    const r = await getPage(p);
    console.log(`  ${r.status}  ${p}  (${r.body.length}B)`);
  }

  console.log('');
  console.log('==== DONE ====');
})().catch(e => { console.error('OUTER ERR', e); process.exit(1); });

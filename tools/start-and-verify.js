#!/usr/bin/env node
// tools/start-and-verify.js
// 杀掉所有占用 8000 的旧 node，启动 exhibition-camera/server.js，
// 然后 curl 验证 /api/health 和 /api/classify/ancient 不再 404。

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 8000;
const SERVER_DIR = path.join(__dirname, '..');
const SERVER_FILE = path.join(SERVER_DIR, 'server.js');

function isWin() { return process.platform === 'win32'; }

function killPort(port) {
  try {
    if (isWin()) {
      // 用 PowerShell 找占用端口的 PID 并 kill
      const ps = `
        $conns = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue;
        foreach ($c in $conns) {
          $pid_ = $c.OwningProcess;
          try {
            Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue;
            Write-Output "killed PID $pid_"
          } catch {}
        }
        # 也清掉所有 node.exe（彻底重启场景）
        $nodes = Get-Process node -ErrorAction SilentlyContinue;
        foreach ($n in $nodes) {
          try {
            Stop-Process -Id $n.Id -Force -ErrorAction SilentlyContinue;
            Write-Output "killed node PID $($n.Id)"
          } catch {}
        }
      `.trim();
      execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, { stdio: 'inherit' });
    } else {
      execSync(`lsof -ti tcp:${port} | xargs -r kill -9`);
    }
  } catch (e) {
    // ignore
  }
}

function startServer() {
  console.log('[start] launching:', SERVER_FILE);
  const child = spawn(process.execPath, [SERVER_FILE], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', d => process.stdout.write('[server] ' + d));
  child.stderr.on('data', d => process.stderr.write('[server] ' + d));
  child.on('exit', (code) => {
    console.log(`[start] server exited code=${code}`);
    process.exit(code || 0);
  });
  return child;
}

function httpJson(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: data ? {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      } : {}
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer(maxMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await httpJson('/api/health', 'GET');
      if (r.status === 200) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  console.log('=========================================');
  console.log('  exhibition-camera · start + verify');
  console.log('=========================================');

  console.log('[step 1/4] killing old node processes on :' + PORT);
  killPort(PORT);
  await new Promise(r => setTimeout(r, 1500));

  console.log('[step 2/4] starting new server.js');
  const child = startServer();

  console.log('[step 3/4] waiting for server ready...');
  const ready = await waitForServer(8000);
  if (!ready) {
    console.error('[FAIL] server did not become ready in 8s');
    process.exit(1);
  }
  console.log('[OK] /api/health responded');

  console.log('[step 4/4] verifying routes');
  const tests = [
    { name: 'GET /api/health', path: '/api/health', method: 'GET', expect: 200 },
    { name: 'GET /exhibition-camera/api/health', path: '/exhibition-camera/api/health', method: 'GET', expect: 200 },
    { name: 'POST /api/classify/ancient (no body)', path: '/api/classify/ancient', method: 'POST', body: {}, expectMin: 400 },
    { name: 'POST /exhibition-camera/api/classify/ancient (no body)', path: '/exhibition-camera/api/classify/ancient', method: 'POST', body: {}, expectMin: 400 },
    { name: 'POST /api/fusion/ancient (no body)', path: '/api/fusion/ancient', method: 'POST', body: {}, expectMin: 400 },
    { name: 'POST /api/fusion/ancient (bad sampleId)', path: '/api/fusion/ancient', method: 'POST', body: { sampleId: 'XX', userImage: 'data:image/png;base64,xxx' }, expect: 400 }
  ];

  let allPass = true;
  for (const t of tests) {
    try {
      const r = await httpJson(t.path, t.method, t.body);
      const ok = t.expect !== undefined
        ? r.status === t.expect
        : r.status >= (t.expectMin || 200);
      const tag = ok ? '✓' : '✗';
      console.log(`  ${tag} ${t.name} → ${r.status}`);
      if (!ok) {
        console.log('     body:', r.text.slice(0, 200));
        allPass = false;
      } else if (r.json) {
        const summary = JSON.stringify(r.json).slice(0, 120);
        console.log('     →', summary);
      }
    } catch (e) {
      console.log(`  ✗ ${t.name} → ERROR ${e.message}`);
      allPass = false;
    }
  }

  // 也测一下 vendor 静态文件
  try {
    const r = await httpJson('/vendor/mediapipe/vision_bundle.mjs', 'GET');
    const ok = r.status === 200 && r.headers['content-type'] && r.headers['content-type'].includes('javascript');
    console.log(`  ${ok ? '✓' : '✗'} GET /vendor/mediapipe/vision_bundle.mjs → ${r.status} (${r.headers['content-type']})`);
    if (!ok) allPass = false;
  } catch (e) {
    console.log(`  ✗ vendor static test ERROR ${e.message}`);
    allPass = false;
  }
  try {
    const r = await httpJson('/vendor/mediapipe/wasm/vision_wasm_internal.wasm', 'GET');
    const ok = r.status === 200 && r.headers['content-type'] && r.headers['content-type'].includes('wasm');
    console.log(`  ${ok ? '✓' : '✗'} GET /vendor/mediapipe/wasm/vision_wasm_internal.wasm → ${r.status} (${r.headers['content-type']})`);
    if (!ok) allPass = false;
  } catch (e) {
    console.log(`  ✗ vendor wasm test ERROR ${e.message}`);
    allPass = false;
  }

  console.log('-------------------------------------');
  if (allPass) {
    console.log('✓ ALL ROUTES OK · server is healthy');
  } else {
    console.log('✗ some routes failed');
  }
  console.log('server is running · press Ctrl+C to stop');

  // 不退出，让 server 继续跑
  process.on('SIGINT', () => { child.kill(); process.exit(0); });
  process.on('SIGTERM', () => { child.kill(); process.exit(0); });
}

main().catch(e => { console.error(e); process.exit(1); });

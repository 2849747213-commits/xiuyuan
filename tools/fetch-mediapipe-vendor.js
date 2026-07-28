#!/usr/bin/env node
// tools/fetch-mediapipe-vendor.js
// 把 MediaPipe FaceLandmarker 三件套（JS bundle / WASM / .task 模型）
// 从 unpkg + jsdelivr + Google Storage 下载到 vendor/mediapipe/，避免每次启动等 CDN。
//
// 用法：
//   node tools/fetch-mediapipe-vendor.js
//
// 下载后结构：
//   vendor/mediapipe/
//     vision_bundle.mjs
//     vision_bundle.mjs.map
//     wasm/
//       vision_wasm_internal.js
//       vision_wasm_internal.wasm
//       vision_wasm_nosimd_internal.js
//       vision_wasm_nosimd_internal.wasm
//       vision_wasm_simd_internal.js
//       vision_wasm_simd_internal.wasm
//     face_landmarker.task

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const VENDOR_DIR = path.join(__dirname, '..', 'vendor', 'mediapipe');
const VERSION = '0.10.18';
const PKG = '@mediapipe/tasks-vision';

const FILES = [
  // JS bundle (ES module) + sourcemap
  {
    url: `https://unpkg.com/${PKG}@${VERSION}/vision_bundle.mjs`,
    out: 'vision_bundle.mjs'
  },
  {
    url: `https://unpkg.com/${PKG}@${VERSION}/vision_bundle.mjs.map`,
    out: 'vision_bundle.mjs.map'
  },
  // WASM（0.10.18 已合并为单一 simd 变体，不再有 vision_wasm_simd_internal.*）
  { url: `https://unpkg.com/${PKG}@${VERSION}/wasm/vision_wasm_internal.js`,            out: 'wasm/vision_wasm_internal.js' },
  { url: `https://unpkg.com/${PKG}@${VERSION}/wasm/vision_wasm_internal.wasm`,           out: 'wasm/vision_wasm_internal.wasm' },
  { url: `https://unpkg.com/${PKG}@${VERSION}/wasm/vision_wasm_nosimd_internal.js`,     out: 'wasm/vision_wasm_nosimd_internal.js' },
  { url: `https://unpkg.com/${PKG}@${VERSION}/wasm/vision_wasm_nosimd_internal.wasm`,    out: 'wasm/vision_wasm_nosimd_internal.wasm' },
  // .task 模型
  {
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    out: 'face_landmarker.task'
  }
];

function fetchOnce(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      // 跟随 3xx 跳转
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return fetchOnce(next, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

async function fetchWithFallback(primary, fallbacks = []) {
  const all = [primary, ...fallbacks];
  let lastErr = null;
  for (const url of all) {
    try {
      const buf = await fetchOnce(url);
      return { url, buf };
    } catch (e) {
      console.warn(`  ✗ ${url}  (${e.message})`);
      lastErr = e;
    }
  }
  throw lastErr || new Error('all sources failed');
}

async function main() {
  console.log('=============================================');
  console.log(' MediaPipe Vendor Fetcher');
  console.log(' target: ' + VENDOR_DIR);
  console.log('=============================================');

  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  fs.mkdirSync(path.join(VENDOR_DIR, 'wasm'), { recursive: true });

  const summary = [];
  for (const f of FILES) {
    const outPath = path.join(VENDOR_DIR, f.out);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      console.log(`  ✓ ${f.out}  (cached, ${fs.statSync(outPath).size} bytes)`);
      summary.push({ file: f.out, status: 'cached', size: fs.statSync(outPath).size });
      continue;
    }
    const fallbacks = f.url.includes('unpkg.com')
      ? [`https://cdn.jsdelivr.net/npm/${PKG}@${VERSION}/${f.out.replace(/^wasm\//, 'wasm/')}`]
      : [];
    try {
      const { url, buf } = await fetchWithFallback(f.url, fallbacks);
      fs.writeFileSync(outPath, buf);
      console.log(`  ✓ ${f.out}  (${buf.length} bytes ← ${url})`);
      summary.push({ file: f.out, status: 'downloaded', size: buf.length, from: url });
    } catch (e) {
      console.error(`  ✗ ${f.out}  FAILED: ${e.message}`);
      summary.push({ file: f.out, status: 'failed', error: e.message });
    }
  }

  const failed = summary.filter(s => s.status === 'failed');
  console.log('---------------------------------------------');
  if (failed.length === 0) {
    console.log(`✓ all ${summary.length} files ready under ${VENDOR_DIR}`);
  } else {
    console.log(`✗ ${failed.length}/${summary.length} failed:`);
    failed.forEach(f => console.log(`  - ${f.file}: ${f.error}`));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

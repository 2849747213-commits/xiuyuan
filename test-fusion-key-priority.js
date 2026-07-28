#!/usr/bin/env node
// 单元测试 pickImageApiKey / pickImageBaseUrl / pickImageModel 的优先级链
// 通过直接覆盖 process.env + 阻断 .env 探测路径来构造边界
const path = require('path');
const fs = require('fs');
const os = require('os');

const providerPath = path.resolve(__dirname, 'providers', 'ancient-fusion-provider.js');

// 1. 隔离 .env:把候选 .env 临时改名,跑完恢复
const envCandidates = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env')
];

function clearAndHide() {
  const moved = [];
  for (const p of envCandidates) {
    if (fs.existsSync(p)) {
      const b = p + '.prio.bak.' + Date.now();
      fs.renameSync(p, b);
      moved.push([p, b]);
    }
  }
  return moved;
}
function restore(moved) {
  for (const [p, b] of moved) if (fs.existsSync(b)) fs.renameSync(b, p);
}

function clearEnvKeys() {
  const saved = {};
  for (const k of Object.keys(process.env)) {
    if (/^(IMAGE_|MINIMAX_|AI_(API_KEY|BASE_URL|MODEL|IMAGE_MODEL))/.test(k)) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  }
  return saved;
}
function restoreEnv(saved) {
  for (const k of Object.keys(saved)) process.env[k] = saved[k];
}

const moved = clearAndHide();
let failed = false;

try {
  // 强制清缓存,确保每个 case 重新读 .env
  function freshProvider() {
    delete require.cache[require.resolve(providerPath)];
    return require(providerPath);
  }

  // 测 1: 全空 → 期望 key=''
  let s1 = clearEnvKeys();
  let p1 = freshProvider();
  let r1 = p1.pickImageApiKey();
  restoreEnv(s1);
  console.log(`[T1] 全空 → key="${r1.key ? r1.key.slice(0, 8) + '...' : ''}" · source="${r1.source || '(empty)'}"`);
  if (r1.key !== '') { console.error('  ✗ FAIL · 应该返回空 key'); failed = true; }
  else console.log('  ✓ OK · 返回空 (会触发 503)');

  // 测 2: 只设 AI_API_KEY
  let s2 = clearEnvKeys();
  process.env.AI_API_KEY = 'sk-test-1234';
  let p2 = freshProvider();
  let r2 = p2.pickImageApiKey();
  restoreEnv(s2);
  console.log(`[T2] AI_API_KEY=sk-test-1234 → source="${r2.source}"`);
  if (r2.key !== 'sk-test-1234' || r2.source !== 'AI_API_KEY') { console.error('  ✗ FAIL'); failed = true; }
  else console.log('  ✓ OK · 复用 AI_API_KEY');

  // 测 3: AI_API_KEY + IMAGE_API_KEY → 优先 IMAGE_API_KEY
  let s3 = clearEnvKeys();
  process.env.AI_API_KEY = 'sk-text';
  process.env.IMAGE_API_KEY = 'sk-image';
  let p3 = freshProvider();
  let r3 = p3.pickImageApiKey();
  restoreEnv(s3);
  console.log(`[T3] AI_API_KEY=sk-text, IMAGE_API_KEY=sk-image → source="${r3.source}"`);
  if (r3.key !== 'sk-image' || r3.source !== 'IMAGE_API_KEY') { console.error('  ✗ FAIL'); failed = true; }
  else console.log('  ✓ OK · 优先 IMAGE_API_KEY');

  // 测 4: 三个都设 → 优先级 IMAGE_API_KEY > MINIMAX_API_KEY > AI_API_KEY
  let s4 = clearEnvKeys();
  process.env.AI_API_KEY = 'k1';
  process.env.MINIMAX_API_KEY = 'k2';
  process.env.IMAGE_API_KEY = 'k3';
  let p4 = freshProvider();
  let r4 = p4.pickImageApiKey();
  restoreEnv(s4);
  console.log(`[T4] 三个都设 → source="${r4.source}" · key="${r4.key}"`);
  if (r4.key !== 'k3' || r4.source !== 'IMAGE_API_KEY') { console.error('  ✗ FAIL'); failed = true; }
  else console.log('  ✓ OK · 优先级正确');

  // 测 5: baseUrl 默认 fallback
  let s5 = clearEnvKeys();
  let p5 = freshProvider();
  let b1 = p5.pickImageBaseUrl();
  let m1 = p5.pickImageModel();
  restoreEnv(s5);
  console.log(`[T5] baseUrl="${b1}" · model="${m1}"`);
  if (b1 !== 'https://api.minimaxi.com/v1' || m1 !== 'image-01') { console.error('  ✗ FAIL'); failed = true; }
  else console.log('  ✓ OK · 默认值正确');

  // 测 6: baseUrl IMAGE_API_BASE_URL 优先
  let s6 = clearEnvKeys();
  process.env.AI_BASE_URL = 'https://a.com/v1';
  process.env.IMAGE_API_BASE_URL = 'https://b.com/v1';
  let p6 = freshProvider();
  let b2 = p6.pickImageBaseUrl();
  restoreEnv(s6);
  console.log(`[T6] baseUrl 优先 → "${b2}"`);
  if (b2 !== 'https://b.com/v1') { console.error('  ✗ FAIL'); failed = true; }
  else console.log('  ✓ OK · 优先 IMAGE_API_BASE_URL');

  // 测 7: model IMAGE_MODEL 自定义
  let s7 = clearEnvKeys();
  process.env.IMAGE_MODEL = 'image-01-live';
  let p7 = freshProvider();
  let m2 = p7.pickImageModel();
  restoreEnv(s7);
  console.log(`[T7] model IMAGE_MODEL → "${m2}"`);
  if (m2 !== 'image-01-live') { console.error('  ✗ FAIL'); failed = true; }
  else console.log('  ✓ OK · IMAGE_MODEL 生效');

} finally {
  restore(moved);
}

if (failed) {
  console.error('\n========== 单元测试 FAIL ==========');
  process.exit(1);
} else {
  console.log('\n========== 单元测试 7/7 通过 ==========');
}

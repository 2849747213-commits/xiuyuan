// ============================================
// 古代融合像 · Provider Adapter 入口
// 规则:
//   1. 优先 IMAGE_API_KEY (以后可独立配)
//   2. 退路 MINIMAX_API_KEY
//   3. 退路 AI_API_KEY (与文本分类共用同一个 Key, MiniMax 不区分)
//   4. 退路 IMAGE_KEY / AI_IMAGE_KEY
//   5. 完全没 Key → 抛 not-configured, 由调用方转 503
// ============================================

const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  // 兼容项目里现有的 .env (server.js 同样的查找方式)
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env')
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const env = {};
    try {
      for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch (e) {}
    return env;
  }
  return {};
}

function pickImageApiKey() {
  // 1. 严格按优先级链读取 · process.env > .env
  const order = [
    'IMAGE_API_KEY',
    'MINIMAX_API_KEY',
    'AI_API_KEY',     // ★ 与文本分类共用
    'IMAGE_KEY',
    'AI_IMAGE_KEY'
  ];
  for (const k of order) {
    const v = (process.env[k] || '').trim();
    if (v) return { key: v, source: k };
  }
  const local = loadDotEnv();
  for (const k of order) {
    const v = (local[k] || '').trim();
    if (v) return { key: v, source: '.env:' + k };
  }
  return { key: '', source: '' };
}

function pickImageBaseUrl() {
  const order = [
    'IMAGE_API_BASE_URL',
    'IMAGE_BASE_URL',
    'AI_BASE_URL'      // ★ 与文本分类共用同一 base
  ];
  for (const k of order) {
    const v = (process.env[k] || '').trim();
    if (v) return v.replace(/\/$/, '');
  }
  const local = loadDotEnv();
  for (const k of order) {
    const v = (local[k] || '').trim();
    if (v) return v.replace(/\/$/, '');
  }
  return 'https://api.minimaxi.com/v1';
}

function pickImageModel() {
  const order = ['IMAGE_MODEL', 'AI_IMAGE_MODEL'];
  for (const k of order) {
    const v = (process.env[k] || '').trim();
    if (v) return v;
  }
  const local = loadDotEnv();
  for (const k of order) {
    const v = (local[k] || '').trim();
    if (v) return v;
  }
  return 'image-01';
}

module.exports = {
  pickImageApiKey,
  pickImageBaseUrl,
  pickImageModel
};

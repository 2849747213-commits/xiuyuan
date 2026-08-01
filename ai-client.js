// ai-client.js · v3 · LEGACY REMOVED
// window.AIClient.callAI(sample, settings) → 已废弃 · 仅保留 stub 不抛错
// 所有真实 AI 走 /api/classify/{ancient|modern|western} · 直接由 pipeline 调用
// 此文件已不再生成任何网络请求 · 也未引用任何 legacy / 健康检查域名

if (!window.AIClient) {
  window.AIClient = {};
}

console.log('[AIClient] loaded v3 · legacy endpoint removed · use /api/classify/{system} instead');

window.AIClient.callAI = function (sample, settings) {
  // 兼容旧调用方 · 直接返回 null 让 pipeline 进入 fallback
  console.warn('[AIClient] legacy callAI() deprecated · returning null');
  return Promise.resolve(null);
};

window.AIClient.FALLBACKS = {};
window.AIClient.withTimeout = function () {
  return new Promise(function (_, reject) {
    setTimeout(function () { reject(new Error('withTimeout deprecated')); }, 0);
  });
};
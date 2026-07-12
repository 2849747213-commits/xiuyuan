// ai-client.js · v2 · 系统分流参数 + fallback
// window.AIClient.callAI(sample, settings)
// - sample: 输入元数据（图像 / 文本 / 其他）
// - settings.system: 'ancient' | 'modern' | 'western' | null
// - settings.timeout: 超时毫秒（默认 15000）
// - 当后端不可达 / 超时 / 返回非 JSON / 字段缺失 → fallback（由 settings.system 选定默认）

if (!window.AIClient) {
  window.AIClient = {};
}

// ★ 旧版 AIClient 健康检查（xapi.yhcj.com/version 等）总开关 · 默认禁用
// 默认 true：拒绝一切 xapi.* / /version 流量；如果出现拦截，记录 trace 帮用户定位调用方
window.DISABLE_LEGACY_AI_HEALTH_CHECK = (window.DISABLE_LEGACY_AI_HEALTH_CHECK !== false);

function _isLegacyAIUrl(url) {
  if (!url) return false;
  var s = String(url);
  return s.indexOf("xapi.yhcj.com") >= 0 ||
         s.indexOf("xapi.yhchj.com") >= 0 ||
         s.indexOf("/version?") >= 0 ||
         /\/version(\s|$)/.test(s);
}

// ★ 拦截 fetch · 不伪造 200 · 直接抛错
if (typeof window.fetch === "function" && !window.__legacyFetchPatched) {
  var _origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = (typeof input === "string") ? input : (input && input.url) || "";
    if (_isLegacyAIUrl(url)) {
      console.error("[LEGACY_AI] blocked fetch", url);
      console.trace("[LEGACY_AI] fetch trace");
      return Promise.reject(new Error("LEGACY_AI_DISABLED · blocked " + url));
    }
    return _origFetch(input, init);
  };
  window.__legacyFetchPatched = true;
}

// ★ 拦截 XMLHttpRequest · 不伪造响应 · 直接抛错
if (typeof window.XMLHttpRequest === "function" && !window.__legacyXHRPatched) {
  var _OrigXHROpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (_isLegacyAIUrl(url)) {
      console.error("[LEGACY_AI] blocked XHR", method, url);
      console.trace("[LEGACY_AI] xhr trace");
      throw new Error("LEGACY_AI_DISABLED · blocked XHR " + method + " " + url);
    }
    return _OrigXHROpen.apply(this, arguments);
  };
  window.__legacyXHRPatched = true;
}

if (window.DISABLE_LEGACY_AI_HEALTH_CHECK) {
  console.log("[LEGACY_AI] all legacy AI traffic is blocked (fetch + XHR)");
} else {
  console.log("[LEGACY_AI] WARNING · DISABLE_LEGACY_AI_HEALTH_CHECK=false · legacy traffic ALLOWED");
}

// ★ 三套系统的 fallback（前端兜底 · 与 server.js / exhibition.js 中已存在的 fallback 保持一致）
const FALLBACKS = {
  ancient: {
    verdict: '你被归类为',
    system: '古代相术',
    fields: [
      { key: 'main_zones',   label: '十二宫', value: '命宫偏滞 · 财帛欠明', reason: '前额低陷 · 中正微斜 · 十二宫中以命宫为最暗。' },
      { key: 'five_features', label: '五官',    value: '眉粗目秀 · 山根略断',     reason: '眉峰有气 · 目中含蓄 · 鼻梁青痕。' },
      { key: 'three_stops',   label: '三停',    value: '上停不及 · 中停为最',     reason: '额窄光满 · 中停丰隆 · 下停略削。' },
      { key: 'five_peaks',    label: '五岳',    value: '中岳显 · 余四岳不归',     reason: '鼻为中岳最隆 · 东南西北气散。' },
      { key: 'complexion',    label: '气色',    value: '准头灰暗 · 印堂不明',     reason: '面微白 · 印堂色滞 · 准头无华。' },
      { key: 'bone_form',     label: '骨相',    value: '骨露而柔 · 不藏不化',     reason: '骨清而露 · 不入深相。' },
    ],
  },
  modern: {
    verdict: '你被归类为',
    system: '身份清仓',
    sku: 'SKU-02',
    result_id: 'OBS-' + Date.now().toString(36).toUpperCase(),
    verdict_label: '你被归类为',
    identityCard: {
      orientation: '顺性偏好',
      gender: '系统主流判定',
      income: '中层收入',
      family: '核心家庭',
      relationship: '稳定同居',
      risk: '中风险',
    },
  },
  western: {
    verdict: '你被归类为',
    system: 'Western Archive',
    physiognomy: [
      { key: 'classical',     label: '古典相貌',   value: '高位 · 聪慧',          reason: '颅顶盖形状为高卵圆形，对应古典归类的"高位。' },
      { key: 'profile',       label: '侧影道德',   value: '轮廓倾斜',             reason: '面部侧面轮廓显示鼻梁到下颌的明显倾斜。' },
      { key: 'skull_map',      label: '颅骨地图',   value: '证据点强度 0.63',     reason: '10 个关键特征点中 6 个落在主要特征带。' },
      { key: 'criminal_sign', label: '犯罪预兆',   value: '低',                    reason: '未见犯罪肖像学经典特征。' },
      { key: 'average_face',  label: '平均脸',     value: '示差 -0.04',          reason: '与本期参考样本集的偏差接近零。' },
      { key: 'algorithm',     label: '算法',       value: 'BERT-19',              reason: '基于 BERT 微调的视觉档案系统 v0.4 的输出。' },
    ],
  },
};

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('AI 请求超时（' + (ms / 1000) + '秒）')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function isValidAIData(system, data) {
  // 客户端最终质量判定：与服务端 checkQuality 保持一致
  // 解析失败 / 字段为空 / 内容是 "未定" / 都不算可用 → 触发 fallback
  if (!data || typeof data !== 'object') return false;
  const isJunk = (v) => {
    if (typeof v !== 'string') return true;
    const s = v.trim().toLowerCase();
    if (!s) return true;
    const hanzi = s.match(/[\u4e00-\u9fff]/g);
    if (hanzi && hanzi.length >= 4) return false;
    const latin = s.match(/[a-z]/g);
    if (latin && latin.length >= 6) return false;
    return /^(未定|未指定|未知|无|n\/?a|未分类|未明|未检出|无可|看不出来|unknown|indeterminate|n\/a|na|null|no_|demo|placeholder|placeholder\.|sample|demo_?|demo\.|示范占位|占位|示例|看不准|none)/i.test(s);
  };
  if (system === 'ancient') {
    if (!Array.isArray(data.fields) || data.fields.length < 3) return false;
    return data.fields.every(f => f && typeof f.value === 'string' && !isJunk(f.value));
  }
  if (system === 'modern') {
    if (!data.identityCard) return false;
    const vals = Object.values(data.identityCard);
    return vals.length >= 6 && vals.every(v => typeof v === 'string' && !isJunk(v));
  }
  if (system === 'western') {
    if (!Array.isArray(data.physiognomy) || data.physiognomy.length < 3) return false;
    return data.physiognomy.every(f => f && typeof f.value === 'string' && !isJunk(f.value));
  }
  return true;
}

function pickFallback(settings) {
  const sys = settings && settings.system;
  return FALLBACKS[sys] || FALLBACKS.modern;
}

// ★ callAI —— 透传 sample + settings（settings.system 必填）
// 返回值统一带 _source 字段（'ai' 或 'fallback'）
window.AIClient.callAI = async function (sample, settings) {
  settings = settings || {};
  const system = settings.system;
  const timeout = settings.timeout || 15000;
  console.log('[AIClient] callAI sample 系统 =', system, ', 超时 =', timeout);

  // ★ 全局开关：AI 关 → 直接返回 null · 不发任何 /api/classify
  if (typeof window !== 'undefined' && window.ENABLE_AI_ANALYSIS === false) {
    console.log('[AI DISABLED] skip /api/classify · system=' + system);
    return null;
  }

  let ai = null;
  let fromAI = false;
  try {
    const fetchP = fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: system, sample: sample, settings: settings }),
    });
    const res = await withTimeout(fetchP, timeout);
    if (!res.ok) throw new Error('AI 接口请求失败: ' + res.status);
    const data = await res.json();
    // 兼容后端包装：{ ok, data, message } 或直接对象
    const inner = (data && data.ok && data.data) ? data.data : data;
    if (isValidAIData(system, inner)) {
      ai = inner;
      fromAI = true;
    } else {
      console.warn('[AIClient] AI 返回字段不全（fallback）:', inner);
    }
  } catch (err) {
    console.warn('[AIClient] AI 失败（fallback）:', err?.message || err);
  }

  if (!fromAI) {
    ai = pickFallback(settings);
    ai._source = 'fallback';
  } else {
    ai._source = 'ai';
  }
  ai._system = system;
  return ai;
};

// 暴露 helper（可选 · 老代码可能直接调用）
window.AIClient.FALLBACKS = FALLBACKS;
window.AIClient.withTimeout = withTimeout;

console.log('[AIClient] loaded v2 · system-aware', Object.keys(window.AIClient));

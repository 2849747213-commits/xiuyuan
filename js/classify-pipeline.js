/* ============================================================
   BIAS SYSTEM · 公共分类流水线（CommonJS）
   - 三个系统（ancient / modern / western）共用同一套：
     · parseAndRepairClassification
     · buildReasonCompletionRequest
     · validateAndNormalizeResult
   - 输出统一结构：
     { ok, source, system, sampleId, confidence, shortReason,
       matchedFeatures, visionCheck, dimensionReasons, reasonSource,
       upstreamStatus }
   - dimensionReasons 内部键名由调用方传入（schema.keys）
   - reasonSource:
     · 'ai-personalized'   AI 正常返回 / 修复后 6/6 完整
     · 'sample-fallback'   AI 全部失败，使用 sample 库固定 reason
     · 'repair'            走了一次文本修复
     · 'reason-completion' 走了一次理由补全
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TAG = '[CLASSIFY_PIPELINE]';

// ★ 三个系统各自允许的 sampleId 集合
const ALLOWED_SETS = {
  ancient: [
    'A01','A02','A03','A04','A05','A06','A07','A08','A09',
    'A10','A11','A12','A13','A14','A15','A16'
  ],
  modern: [
    'M01','M02','M03','M04','M05','M06','M07','M08','M09','M10',
    'M11','M12','M13','M14','M15','M16','M17','M18','M19','M20'
  ],
  western: [
    'W01','W02','W03','W04','W05','W06','W07','W08','W09',
    'W10','W11','W12','W13','W14'
  ]
};

// ★ 三个系统各自 6 维度 reason 的键名
const DIM_KEYS = {
  ancient:  ['palace','organ','zone','mountain','complexion','bone'],
  modern:   ['sexuality','gender','income','family','relationship','risk'],
  western:  ['status','temperament','power','body','role','risk']
};

// ★ 从自然语言文本中容错提取 sampleId
function extractSampleIdFromText(text, system) {
  if (!text || typeof text !== 'string') return null;
  const allowed = ALLOWED_SETS[system] || [];
  if (!allowed.length) return null;
  // 严格只接受该系统对应的 sampleId
  const pattern = new RegExp('\\b(' + allowed.join('|') + ')\\b', 'i');
  const m = text.match(pattern);
  if (!m) return null;
  return m[0].toUpperCase();
}

// ★ parseModelJson · 健壮 JSON 提取（兼容 <think> / ```json / 文本里嵌 JSON）
function parseModelJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  let text = String(raw).trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try { return JSON.parse(text); }
  catch (err) { return null; }
}

// ★ 校验解析结果是否完整（sampleId 合法 + 6 维度 reason 都非空）
function isCompleteParsed(parsed, system) {
  if (!parsed || typeof parsed !== 'object') return false;
  const allowed = ALLOWED_SETS[system] || [];
  if (allowed.indexOf(parsed.sampleId) < 0) return false;
  const dimKeys = DIM_KEYS[system] || [];
  if (!dimKeys.length) return false;
  const dr = parsed.dimensionReasons || {};
  for (let i = 0; i < dimKeys.length; i++) {
    const v = dr[dimKeys[i]];
    if (typeof v !== 'string' || v.trim().length < 4) return false;
  }
  if (typeof parsed.shortReason !== 'string' || parsed.shortReason.trim().length < 4) return false;
  if (!Array.isArray(parsed.matchedFeatures) || parsed.matchedFeatures.length < 2) return false;
  return true;
}

// ★ 校验解析结果是否只有 sampleId 但缺 reason
function hasSampleIdButMissingReasons(parsed, system) {
  if (!parsed || typeof parsed !== 'object') return false;
  const allowed = ALLOWED_SETS[system] || [];
  if (allowed.indexOf(parsed.sampleId) < 0) return false;
  // sampleId 合法就算有缺 reason（true 由调用方继续做 6/6 校验）
  return true;
}

// ★ 把 parsed 补全为统一结构
function buildUnifiedResult(parsed, system, opts) {
  opts = opts || {};
  const allowed = ALLOWED_SETS[system] || [];
  const dimKeys = DIM_KEYS[system] || [];
  let sampleId = '';
  if (typeof parsed.sampleId === 'string' && allowed.indexOf(parsed.sampleId) >= 0) {
    sampleId = parsed.sampleId;
  } else if (typeof parsed.finalSampleId === 'string' && allowed.indexOf(parsed.finalSampleId) >= 0) {
    sampleId = parsed.finalSampleId;
  } else if (Array.isArray(parsed.topCandidates) && parsed.topCandidates[0] && allowed.indexOf(parsed.topCandidates[0].sampleId) >= 0) {
    sampleId = parsed.topCandidates[0].sampleId;
  } else if (parsed.candidateScores && typeof parsed.candidateScores === 'object') {
    if (Array.isArray(parsed.candidateScores)) {
      let topK = null, topS = -1;
      for (let i = 0; i < parsed.candidateScores.length; i++) {
        const c = parsed.candidateScores[i];
        const s = Number(c && c.score) || 0;
        if (s > topS && c && allowed.indexOf(c.sampleId) >= 0) { topS = s; topK = c.sampleId; }
      }
      if (topK) sampleId = topK;
    } else {
      let topK = null, topS = -1;
      for (const k of Object.keys(parsed.candidateScores)) {
        const s = Number(parsed.candidateScores[k]) || 0;
        if (s > topS && allowed.indexOf(k) >= 0) { topS = s; topK = k; }
      }
      if (topK) sampleId = topK;
    }
  }
  if (!sampleId && opts.fallbackSampleId && allowed.indexOf(opts.fallbackSampleId) >= 0) {
    sampleId = opts.fallbackSampleId;
  }

  // visionCheck 净化
  let vc = parsed.visionCheck || {};
  if (typeof vc !== 'object' || vc === null) vc = {};
  const allowedVcKeys = ['hasFace','wearingGlasses','headPose','framing','brightness','faceCount','expression'];
  const cleanVc = {};
  for (let i = 0; i < allowedVcKeys.length; i++) cleanVc[allowedVcKeys[i]] = vc[allowedVcKeys[i]];
  if (typeof cleanVc.hasFace !== 'boolean') {
    if (typeof cleanVc.faceCount === 'number') cleanVc.hasFace = cleanVc.faceCount > 0;
    else cleanVc.hasFace = false;
  }
  if (typeof cleanVc.wearingGlasses !== 'boolean') cleanVc.wearingGlasses = false;
  if (typeof cleanVc.headPose !== 'string') cleanVc.headPose = 'unclear';
  if (typeof cleanVc.framing !== 'string') cleanVc.framing = 'unclear';
  if (typeof cleanVc.brightness !== 'string') cleanVc.brightness = 'unclear';

  // confidence
  let confidence = 'medium';
  if (['low','medium','high'].indexOf(parsed.confidence) >= 0) confidence = parsed.confidence;

  // matchedFeatures
  let matchedFeatures = [];
  if (Array.isArray(parsed.matchedFeatures) && parsed.matchedFeatures.length >= 2) {
    matchedFeatures = parsed.matchedFeatures.slice(0, 4).map(String);
  }
  if (matchedFeatures.length < 2 && Array.isArray(parsed.topCandidates)) {
    matchedFeatures = parsed.topCandidates.slice(0, 4).map(function (c) { return c.rationale || c.reason || c.sampleId; }).filter(Boolean);
  }

  // shortReason
  let shortReason = '';
  if (typeof parsed.shortReason === 'string' && parsed.shortReason.length > 0) {
    shortReason = parsed.shortReason;
  } else if (typeof parsed.finalReason === 'string' && parsed.finalReason.length > 0) {
    shortReason = parsed.finalReason;
  } else if (Array.isArray(parsed.topCandidates) && parsed.topCandidates[0]) {
    shortReason = parsed.topCandidates[0].rationale || parsed.topCandidates[0].reason || '';
  }

  // dimensionReasons · 6 维度全部截取 trim 后保留
  const dr = (parsed.dimensionReasons && typeof parsed.dimensionReasons === 'object') ? parsed.dimensionReasons : {};
  const dimReasons = {};
  for (let i = 0; i < dimKeys.length; i++) {
    const k = dimKeys[i];
    const v = dr[k];
    dimReasons[k] = (typeof v === 'string' && v.trim()) ? v.trim() : '';
  }

  return {
    ok: !!sampleId,
    source: 'ai',
    system: system,
    sampleId: sampleId,
    confidence: confidence,
    shortReason: shortReason,
    matchedFeatures: matchedFeatures,
    visionCheck: cleanVc,
    dimensionReasons: dimReasons,
    reasonSource: opts.reasonSource || 'ai-personalized',
    upstreamStatus: opts.upstreamStatus || 200
  };
}

// ★ 从 sample 库 + 本轮 vision 信息构造最小修复输入
function buildReasonCompletionPayload(opts) {
  const { system, sampleId, sampleGlossary, visualSummary } = opts;
  const dimKeys = DIM_KEYS[system] || [];
  return {
    task: 'reason_completion',
    system: system,
    sampleId: sampleId,
    allowedSampleIds: ALLOWED_SETS[system] || [],
    requiredDimensions: dimKeys,
    sampleGlossary: (sampleGlossary || []).filter(function (g) { return g && g.sampleId === sampleId; }).slice(0, 1),
    visualSummary: visualSummary || {},
    instruction: '基于以上视觉事实和档案概念方向，针对本张图片生成 6 项个性化判定原因 + 一句总结 + 2-4 个客观特征。禁止套话。'
  };
}

// ★ 构造文本修复请求 · 不传图，只传上一次的输出 + 限制条件
function buildRepairPayload(opts) {
  const { system, previousText, sampleGlossary, visualSummary } = opts;
  const dimKeys = DIM_KEYS[system] || [];
  return {
    task: 'repair_classification_json',
    system: system,
    allowedSampleIds: ALLOWED_SETS[system] || [],
    requiredDimensions: dimKeys,
    sampleGlossary: sampleGlossary || [],
    visualSummary: visualSummary || {},
    previousModelOutput: (previousText || '').slice(0, 4000),
    instruction: '将以上内容转换为指定 JSON。只输出一个 JSON object。第一个字符必须是 {，最后一个字符必须是 }。禁止输出分析过程、Markdown、代码块、或 JSON 之外的任何文字。六项 dimensionReasons 必须全部非空。'
  };
}

// ★ 从 sample 库提取样本自带的 6 维度 reason 字符串（兜底用）
//   - modern: modern-local-system.js (window.MODERN_LOCAL_SAMPLES)
//   - western: western-14-samples-data.js (window.WESTERN_14_SAMPLES)
//   - ancient: ancient-local-system.js (window.ANCIENT_LOCAL_SAMPLES) - 注意：直接在 module 顶层 const 声明
function extractSampleLibraryReasons(sampleId, system) {
  const dimKeys = DIM_KEYS[system] || [];
  const fileMap = {
    modern:  path.join(__dirname, 'modern-local-system.js'),
    western: path.join(__dirname, 'western-14-samples-data.js'),
    ancient: path.join(__dirname, 'ancient-local-system.js')
  };
  const windowKeyMap = {
    modern:  'MODERN_LOCAL_SAMPLES',
    western: 'WESTERN_14_SAMPLES',
    ancient: 'ANCIENT_LOCAL_SAMPLES'
  };
  const filePath = fileMap[system];
  const windowKey = windowKeyMap[system];
  let sample = null;
  try {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('no file');
    const src = fs.readFileSync(filePath, 'utf8');
    const ctx = { window: {}, console: console };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    const samples = (ctx.window && ctx.window[windowKey]) || [];
    sample = samples.find(function (s) { return s && s.sampleId === sampleId; }) || null;
  } catch (e) {
    console.warn('[CLASSIFY_PIPELINE] extractSampleLibraryReasons failed for system=' + system + ' · ' + (e && e.message));
  }
  const reasons = {};
  for (let i = 0; i < dimKeys.length; i++) {
    const k = dimKeys[i];
    const reasonKey = k + '_reason';
    const reasonZhKey = k + '_reason_zh';
    const reasonEnKey = k + '_reason_en';
    let v = '';
    if (sample) {
      v = sample[reasonKey] || sample[reasonZhKey] || sample[reasonEnKey] || '';
    }
    if (typeof v !== 'string' || v.trim().length < 4) {
      v = '依据样本 ' + sampleId + ' 的档案概念进行兜底解释（reason-completion 失败时由 sample 库提供）';
    }
    reasons[k] = v;
  }
  console.log('[MODERN_REASON_AI] fallback mapped ' + Object.keys(reasons).filter(function (k) { return typeof reasons[k] === 'string' && reasons[k].trim().length >= 4; }).length + '/6');
  return reasons;
}

// ★ 计算 dimensionReasons 非空项数
function countNonEmptyDimensionReasons(dimensionReasons) {
  if (!dimensionReasons || typeof dimensionReasons !== 'object') return 0;
  const keys = Object.keys(dimensionReasons);
  let n = 0;
  for (let i = 0; i < keys.length; i++) {
    const v = dimensionReasons[keys[i]];
    if (typeof v === 'string' && v.trim().length >= 4) n++;
  }
  return n;
}

// ★ 主导入 · 一次调用完成 解析 + 修复 + 理由补全
//   opts:
//     system              'ancient' | 'modern' | 'western'   必填
//     upstreamText        上游模型原始文本
//     visualSummary       本轮人脸客观视觉信息 { hasFace, headPose, framing, brightness, wearingGlasses }
//     sampleGlossary      样本库的精简列表（用于修复请求）
//     allowedSampleIds    可选 · 覆盖默认
//     proxyAI             必填 · 网络请求函数（接 model, messages, ...）
//     logTag              日志前缀
//   返回 Promise<{ ok, source, system, sampleId, ... }>
async function parseAndRepairClassification(opts) {
  const system = opts.system;
  const upstreamText = opts.upstreamText || '';
  const visualSummary = opts.visualSummary || {};
  const sampleGlossary = opts.sampleGlossary || [];
  const allowedSampleIds = opts.allowedSampleIds || (ALLOWED_SETS[system] || []);
  const proxyAI = opts.proxyAI;
  const logTag = opts.logTag || TAG;
  const log = function (msg) { console.log(logTag, msg); };

  // ★ 1. 先尝试解析完整 JSON
  const parsed = parseModelJson(upstreamText);
  if (isCompleteParsed(parsed, system)) {
    log('first parse complete · sampleId=' + parsed.sampleId);
    return buildUnifiedResult(parsed, system, { reasonSource: 'ai-personalized', upstreamStatus: 200 });
  }

  // ★ 2. 解析失败 / 字段缺失 → 尝试从自然语言容错提取 sampleId
  const fallbackSampleId = extractSampleIdFromText(upstreamText, system);
  if (!fallbackSampleId) {
    log('no sampleId found in upstream text · skip further repair');
    return null;
  }
  log('text-fallback sampleId=' + fallbackSampleId + ' · triggering reason completion');

  // ★ 3. 用 sampleId 走一次纯文本理由补全请求（不传图）
  if (typeof proxyAI !== 'function') {
    log('proxyAI missing · skip reason completion · fallback to sample library');
    // ★ 没 proxyAI 也必须给样本库兜底 · 不能返回 null（否则前端拿不到 6/6）
    console.log('[MODERN_REASON_AI] fallback start · system=' + system + ' (no proxyAI)');
    const sampleLibraryReasons0 = opts.sampleLibraryReasons || extractSampleLibraryReasons(fallbackSampleId, system);
    return buildUnifiedResult({
      sampleId: fallbackSampleId,
      confidence: 'medium',
      shortReason: '系统依据样本编号 ' + fallbackSampleId + ' 与本轮画面视觉事实生成（reason-completion 未启用 · 由 sample 库兜底）',
      matchedFeatures: ['文本容错命中 ' + fallbackSampleId, '视觉事实补全'],
      visionCheck: visualSummary,
      dimensionReasons: sampleLibraryReasons0
    }, system, { reasonSource: 'sample-fallback', upstreamStatus: 200 });
  }

  const completionPayload = buildReasonCompletionPayload({
    system: system,
    sampleId: fallbackSampleId,
    sampleGlossary: sampleGlossary,
    visualSummary: visualSummary
  });
  const completionSystem =
    '你是一个虚构艺术分类系统的"理由补全器"。\n' +
    '基于用户提供的客观视觉事实 + 选中样本的档案概念方向，\n' +
    '只返回一个 JSON object。\n' +
    '第一个字符必须是 { · 最后一个字符必须是 }。\n' +
    '禁止输出分析过程、Markdown、代码块、解释或 JSON 之外的任何文字。\n' +
    '六项 dimensionReasons 必须全部非空，每项 30-80 字中文。\n' +
    'shortReason 一句中文总结，匹配本张图视觉事实。\n' +
    'matchedFeatures 是 2-4 个客观特征短语。\n' +
    'sampleId 必须是：' + fallbackSampleId;
  try {
    const aiReq = {
      model: opts.model || 'MiniMax-M3',
      messages: [
        { role: 'system', content: completionSystem },
        { role: 'user', content: JSON.stringify(completionPayload) }
      ],
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    };
    console.log('[MODERN_REASON_AI] request start · sampleId=' + fallbackSampleId);
    if (system === 'western') console.log('[WESTERN_REASON_AI] request start · sampleId=' + fallbackSampleId);
    log('reason completion request start · sampleId=' + fallbackSampleId);
    const result = await proxyAI(JSON.stringify(aiReq));
    log('reason completion response status ' + (result && result.status));
    const text = opts.extractModelText ? opts.extractModelText(result.body) : '';
    const reparsed = parseModelJson(text);
    // ★ 关键：不论 reparsed.sampleId 是否等于 fallbackSampleId，只要 dimensionReasons 6/6 都算成功
    if (reparsed && typeof reparsed === 'object') {
      reparsed.sampleId = fallbackSampleId;
      // 用 countNonEmptyDimensionReasons 直接验证 6 维度是否都非空
      const dimCnt = countNonEmptyDimensionReasons(reparsed.dimensionReasons || {});
      if (dimCnt >= 6) {
        console.log('[MODERN_REASON_AI] request done · dimReasons=' + dimCnt + '/6');
        if (system === 'western') console.log('[WESTERN_REASON_AI] dimensionReasons=' + dimCnt + '/6 · reasonSource=reason-completion');
        log('reason completion parse success · sampleId=' + fallbackSampleId + ' · dimReasons=' + dimCnt + '/6');
        return buildUnifiedResult(reparsed, system, { reasonSource: 'reason-completion', upstreamStatus: 200 });
      }
    }
    log('reason completion parse failed · falling back to sample library');
  } catch (e) {
    log('reason completion exception: ' + (e && e.message));
  }

  // ★ 4. 修复请求也失败 → 退到 sample 库 + sample 库自带 reason 兜底（必须保证 6/6）
  console.log('[MODERN_REASON_AI] fallback start · system=' + system);
  // ★ 从 sampleGlossary / 内置 fallback 拿样本自带 6 维度 reason 字符串
  const sampleLibraryReasons = opts.sampleLibraryReasons || extractSampleLibraryReasons(fallbackSampleId, system);
  return buildUnifiedResult({
    sampleId: fallbackSampleId,
    confidence: 'medium',
    shortReason: '系统依据样本编号 ' + fallbackSampleId + ' 与本轮画面视觉事实生成（reason-completion 失败时由 sample 库兜底）',
    matchedFeatures: ['文本容错命中 ' + fallbackSampleId, '视觉事实补全'],
    visionCheck: visualSummary,
    dimensionReasons: sampleLibraryReasons
  }, system, { reasonSource: 'sample-fallback', upstreamStatus: 200 });
}

module.exports = {
  ALLOWED_SETS: ALLOWED_SETS,
  DIM_KEYS: DIM_KEYS,
  extractSampleIdFromText: extractSampleIdFromText,
  parseModelJson: parseModelJson,
  isCompleteParsed: isCompleteParsed,
  buildUnifiedResult: buildUnifiedResult,
  buildReasonCompletionPayload: buildReasonCompletionPayload,
  buildRepairPayload: buildRepairPayload,
  countNonEmptyDimensionReasons: countNonEmptyDimensionReasons,
  parseAndRepairClassification: parseAndRepairClassification
};

/* ============================================================
   BIAS SYSTEM · Western AI Pipeline · v1
   - 真实 AI 调 /api/classify/western · 14 个 W01-W14 历史样本
   - viewModel 适配层 buildWesternViewModel
   - 严格模式：禁止 local fallback 掩盖 AI 失败
   ============================================================ */
(function () {
  if (!window.WESTERN_14_SAMPLES) return;

  var WESTERN_AI_ALLOWED = ['W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11','W12','W13','W14'];
  var ENABLE_WESTERN_AI_ANALYSIS = true;
  // ★ 模式开关 · 'real' = 调真 upstream API (需 Token Plan 配额)  |  'mock' = 走 mock AI 让 UI 流程能跑通
  // 默认 'real' · Vercel 部署时不需要改 · 本地想跑通 UI 流程时改 'mock'
  var WESTERN_AI_MODE = 'real';
  var WESTERN_AI_STRICT_TEST = true;

  var STRICT_REQUIRED_FIELDS = [
    'sampleId','sampleName','sampleNameEn','subtitle','subtitleEn',
    'verdictStamp',
    'statusValue','statusValueEn','statusReason','statusReasonEn',
    'temperamentValue','temperamentValueEn','temperamentReason','temperamentReasonEn',
    'powerValue','powerValueEn','powerReason','powerReasonEn',
    'bodyValue','bodyValueEn','bodyReason','bodyReasonEn',
    'roleValue','roleValueEn','roleReason','roleReasonEn',
    'riskValue','riskValueEn','riskReason','riskReasonEn',
    'engineLabel','source','confidence','visionCheck'
  ];

  // ★ 6 宫格顺序：WP-01..06 严格对应 status / temperament / power / body / role / risk
  var DIM_KEYS = [
    { key: 'status',      valueField: 'statusValue',      enField: 'statusValueEn',      reasonField: 'statusReason',      reasonEnField: 'statusReasonEn' },
    { key: 'temperament', valueField: 'temperamentValue', enField: 'temperamentValueEn', reasonField: 'temperamentReason', reasonEnField: 'temperamentReasonEn' },
    { key: 'power',       valueField: 'powerValue',       enField: 'powerValueEn',       reasonField: 'powerReason',       reasonEnField: 'powerReasonEn' },
    { key: 'body',        valueField: 'bodyValue',        enField: 'bodyValueEn',        reasonField: 'bodyReason',        reasonEnField: 'bodyReasonEn' },
    { key: 'role',        valueField: 'roleValue',        enField: 'roleValueEn',        reasonField: 'roleReason',        reasonEnField: 'roleReasonEn' },
    { key: 'risk',        valueField: 'riskValue',        enField: 'riskValueEn',        reasonField: 'riskReason',        reasonEnField: 'riskReasonEn' }
  ];

  function getWesternSampleById(sampleId) {
    if (!window.WESTERN_14_SAMPLES) return null;
    return window.WESTERN_14_SAMPLES.find(function (s) { return s.sampleId === sampleId; }) || null;
  }

  // ★ view-model 适配层 · 给 LOCKED western-skin.html IIFE 喂数据
  function buildWesternViewModel(aiResult) {
    if (!aiResult) throw new Error('[WESTERN_VIEW_MODEL] missing aiResult');
    var sampleId = aiResult.sampleId;
    var sample = getWesternSampleById(sampleId);
    if (!sample) throw new Error('[WESTERN_VIEW_MODEL] unknown sample ' + sampleId);

    // ★ AI 给的 6 维度判定原因 · 优先使用 · 缺则降级 sample 自带 reason
    var aiDR = (aiResult.dimensionReasons && typeof aiResult.dimensionReasons === 'object') ? aiResult.dimensionReasons : {};
    function pickReason(aiText, fallback) {
      if (typeof aiText === 'string' && aiText.trim().length >= 4) return aiText.trim();
      return fallback || '';
    }

    var vm = {
      sampleId: sample.sampleId,
      sampleName: sample.sampleName,
      sampleNameEn: sample.sampleNameEn,
      subtitle: sample.subtitle || '',
      subtitleEn: sample.subtitleEn || '',
      verdictStamp: sample.sampleName,

      // 6 宫格 6 个维度 · 严格按 WP-01..06 顺序
      statusValue:       sample.status_value       || '',
      statusValueEn:     sample.status_value_en    || '',
      statusReason:      pickReason(aiDR.status,      sample.status_reason),
      statusReasonEn:    pickReason(aiDR.status,      sample.status_reason_en),
      temperamentValue:  sample.temperament_value  || '',
      temperamentValueEn:sample.temperament_value_en||'',
      temperamentReason: pickReason(aiDR.temperament, sample.temperament_reason),
      temperamentReasonEn:pickReason(aiDR.temperament,sample.temperament_reason_en),
      powerValue:        sample.power_value        || '',
      powerValueEn:      sample.power_value_en     || '',
      powerReason:       pickReason(aiDR.power,       sample.power_reason),
      powerReasonEn:     pickReason(aiDR.power,       sample.power_reason_en),
      bodyValue:         sample.body_value         || '',
      bodyValueEn:       sample.body_value_en      || '',
      bodyReason:        pickReason(aiDR.body,        sample.body_reason),
      bodyReasonEn:      pickReason(aiDR.body,        sample.body_reason_en),
      roleValue:         sample.role_value         || '',
      roleValueEn:       sample.role_value_en      || '',
      roleReason:        pickReason(aiDR.role,        sample.role_reason),
      roleReasonEn:      pickReason(aiDR.role,        sample.role_reason_en),
      riskValue:         sample.risk_value         || '',
      riskValueEn:       sample.risk_value_en      || '',
      riskReason:        pickReason(aiDR.risk,        sample.risk_reason),
      riskReasonEn:      pickReason(aiDR.risk,        sample.risk_reason_en),

      engineLabel: aiResult.source === 'ai' ? 'AI ARCHIVE' : 'LOCAL FALLBACK',
      source: aiResult.source || 'unknown',
      confidence: aiResult.confidence || 'medium',
      matchedFeatures: aiResult.matchedFeatures || [],
      shortReason: aiResult.shortReason || '',
      visionCheck: aiResult.visionCheck || null,

      // ★ 记录是 AI 还是 sample 兜底（供调试 / IIFE apply 用）
      reasonOrigin: {
        status:      (typeof aiDR.status      === 'string' && aiDR.status.trim().length      >= 4) ? 'ai' : 'sample',
        temperament: (typeof aiDR.temperament === 'string' && aiDR.temperament.trim().length >= 4) ? 'ai' : 'sample',
        power:       (typeof aiDR.power       === 'string' && aiDR.power.trim().length       >= 4) ? 'ai' : 'sample',
        body:        (typeof aiDR.body        === 'string' && aiDR.body.trim().length        >= 4) ? 'ai' : 'sample',
        role:        (typeof aiDR.role        === 'string' && aiDR.role.trim().length        >= 4) ? 'ai' : 'sample',
        risk:        (typeof aiDR.risk        === 'string' && aiDR.risk.trim().length        >= 4) ? 'ai' : 'sample'
      },

      bottomWarning: '本档案不识别输入对象的真实身份 · 仅展示分类系统的运作方式 · 一切分类均为虚构'
    };

    // ★ 严格模式：缺字段直接 throw
    if (WESTERN_AI_STRICT_TEST) {
      for (var i = 0; i < STRICT_REQUIRED_FIELDS.length; i++) {
        var k = STRICT_REQUIRED_FIELDS[i];
        var v = vm[k];
        if (k === 'visionCheck') { if (!v || typeof v.hasFace !== 'boolean') throw new Error('[WESTERN_VIEW_MODEL] missing field ' + k); continue; }
        if (typeof v !== 'string' || !v.trim()) throw new Error('[WESTERN_VIEW_MODEL] missing field ' + k + ' for sample ' + sampleId);
      }
    }

    return vm;
  }

  // ★ 解析模型返回的 JSON · 兼容 <think> / ```json / 额外包装
  function parseWesternAIJson(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    var text = String(raw).trim();
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    var start = text.indexOf('{'); var end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    try { return JSON.parse(text); } catch (e) { console.warn('[WESTERN_AI] JSON parse fail:', e.message); return null; }
  }

  // ★ 把 build payload 提前独立出来 · 方便测试
  function buildWesternAIPayload(frameDataUrl, faceCropDataUrl) {
    return {
      task: 'choose_one_sample_from_14_western_archive',
      note: 'This is a fictional artistic classification system. Do not infer real identity. Only choose one archive sample from W01-W14.',
      image: frameDataUrl || null,
      faceCropDataUrl: faceCropDataUrl || null,
      allowedSampleIds: WESTERN_AI_ALLOWED.slice()
    };
  }

  // ★ 网络调用 · 60s timeout · 失败返回 { __failed: true, ... } 包装
  var westernRequestController = null;
  var westernRequestInFlight = false;
  var WESTERN_AI_TIMEOUT_MS = 60000;

  function traceWesternAbort(controller, reason) {
    console.error('[WESTERN_ABORT] called · reason:', reason);
    if (controller && controller.signal && !controller.signal.aborted) {
      try { controller.abort(reason); } catch (e) {}
    }
  }

  async function callWesternAIClient(payload) {
    if (westernRequestInFlight) {
      console.warn('[WESTERN_AI] duplicate request blocked · already in flight');
      return null;
    }
    westernRequestInFlight = true;

    var endpoint = (window.location.origin || '') + '/api/classify/western';
    var body = {
      image: payload.imageDataUrl || null,
      faceCropDataUrl: payload.faceCropDataUrl || null,
      localFaceDetected: payload.localFaceDetected === true,
      localLandmarkCount: Number(payload.localLandmarkCount) || 0,
      capturedAt: payload.capturedAt || 0,
      allowedSampleIds: payload.allowedSampleIds || WESTERN_AI_ALLOWED.slice()
    };
    console.log('[WESTERN_AI] payload · localFaceDetected:', body.localFaceDetected, '· landmarkCount:', body.localLandmarkCount, '· faceCrop attached:', !!body.faceCropDataUrl);

    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    westernRequestController = controller;
    console.log('[WESTERN_AI] new controller · aborted before fetch:', controller ? controller.signal.aborted : 'no-ctrl');
    console.log('[WESTERN_AI] timeout ms', WESTERN_AI_TIMEOUT_MS);

    var timeoutId = null;
    if (controller) {
      timeoutId = setTimeout(function () {
        if (!controller.signal.aborted) {
          console.warn('[WESTERN_AI] timeout abort · ms=' + WESTERN_AI_TIMEOUT_MS);
          traceWesternAbort(controller, new DOMException('western request timeout', 'TimeoutError'));
        }
      }, WESTERN_AI_TIMEOUT_MS);
    }

    console.log('[WESTERN_AI] request URL', endpoint);
    try {
      var resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      });
      console.log('[WESTERN_AI] response status', resp.status);
      var text = await resp.text();
      console.log('[WESTERN_AI] response text', text);
      if (!resp.ok) {
        var data2 = null; try { data2 = JSON.parse(text); } catch (e) {}
        console.error('[WESTERN_AI] REAL AI FAILED · HTTP ' + resp.status + ' · ' + (data2 && data2.error || 'unknown'));
        return { __failed: true, httpStatus: resp.status, error: (data2 && data2.error) || 'unknown', failedImageSlot: (data2 && data2.failedImageSlot) || '', upstreamMessage: (data2 && data2.upstreamMessage) || text.slice(0, 300) };
      }
      var data; try { data = JSON.parse(text); } catch (e) {
        console.error('[WESTERN_AI] REAL AI FAILED · response not JSON:', e.message); return null;
      }
      // ★ 兼容新统一结构（顶层 sampleId + dimensionReasons + reasonSource）和老 nested 结构（data.result.sampleId）
      if (data && data.ok === true && data.source === 'ai' && WESTERN_AI_ALLOWED.indexOf(data.sampleId) >= 0) {
        console.log('[WESTERN_AI] new unified structure · sampleId=' + data.sampleId + ' · reasonSource=' + data.reasonSource);
        return data;
      }
      if (data && data.ok === true && data.source === 'ai' && data.result && WESTERN_AI_ALLOWED.indexOf(data.result.sampleId) >= 0) {
        console.log('[WESTERN_AI] legacy nested result · sampleId', data.result.sampleId);
        data.result.source = 'ai';
        return data.result;
      }
      if (data && data.source === 'no-face' && data.visionCheck) {
        return { __noFace: true, visionCheck: data.visionCheck };
      }
      console.error('[WESTERN_AI] REAL AI FAILED · server returned ok=' + (data && data.ok) + ', source=' + (data && data.source));
      return null;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        console.error('[WESTERN_AI] REAL AI FAILED · aborted · ' + (e.message || ''));
        return { __failed: true, httpStatus: 0, error: 'aborted', upstreamMessage: e.message || '' };
      }
      console.error('[WESTERN_AI] REAL AI FAILED · fetch exception:', e && e.message);
      return { __failed: true, httpStatus: 0, error: 'fetch-exception', upstreamMessage: e && e.message };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      westernRequestInFlight = false;
    }
  }

  // ★ 校验 + 规范化 AI 结果
  function isValidWesternAIResult(result) {
    if (!result || typeof result !== 'object') return false;
    if (WESTERN_AI_ALLOWED.indexOf(result.sampleId) < 0) return false;
    if (!['low','medium','high'].includes(result.confidence)) result.confidence = 'medium';
    if (!Array.isArray(result.matchedFeatures)) result.matchedFeatures = [];
    if (typeof result.shortReason !== 'string' || !result.shortReason.length) {
      result.shortReason = '视觉匹配 · 候选 ' + result.sampleId;
    }
    return true;
  }

  // ★ fetch 人脸裁切（从 lockedSnapshot 走，跟 modern pipeline 一致）
  async function fetchCurrentCropDataUrl(faceLandmarks, snapDataUrl, landmarkCount) {
    if (faceLandmarks && Array.isArray(faceLandmarks) && landmarkCount >= 100 && typeof window.createFaceCropFromSnapshot === 'function' && snapDataUrl) {
      try {
        var crop = await window.createFaceCropFromSnapshot(snapDataUrl, faceLandmarks);
        if (crop) return crop;
      } catch (e) { console.warn('[WESTERN_FACE_CROP] generation err:', e && e.message); }
    }
    // 兜底：用 SPA 暂存的 crop
    try {
      if (typeof window.capturedFaceCropDataUrl === 'string' && window.capturedFaceCropDataUrl.length > 100) {
        return window.capturedFaceCropDataUrl;
      }
    } catch (e) {}
    return null;
  }

  // ★ Western loading overlay · 三阶段过渡（与 ancient / modern 同风格）
  // ★ 关键：用户点 western 后立即显示 · 等 iframe 真 load 完才隐藏
  function showWesternLoadingOverlay(phase) {
    phase = phase || 'classification';
    console.log('[WESTERN_LOADING] show · phase=' + phase);
    var root = document.getElementById('result-layer');
    if (!root) return;
    var titles = {
      classification: {
        kicker: '▌ WESTERN ARCHIVE MATCHING · W01-W14',
        title: 'AI 正在比对当前帧',
        subtitle: '正在检索西方历史样本库',
        note: '请稍候 · ARCHIVE MATCHING'
      },
      'reason-completion': {
        kicker: '▌ WESTERN REASON COMPLETION',
        title: 'AI 正在整理判定档案',
        subtitle: '正在生成六项个性化判词',
        note: '请稍候 · 档案生成中'
      },
      'result-loading': {
        kicker: '▌ ARCHIVE READY',
        title: '档案已经建立',
        subtitle: '正在载入西方结果页面',
        note: '请稍候 · 结果页载入中'
      },
      failed: {
        kicker: '▌ WESTERN AI FAILED',
        title: '西方档案模型未能完成当前判定',
        subtitle: '请检查网络或更换人脸样本后重试',
        note: '按上方按钮操作'
      }
    };
    var t = titles[phase] || titles.classification;
    var buttons = (phase === 'failed')
      ? '<div style="margin-top:24px;display:flex;gap:14px;justify-content:center;">' +
          '<button type="button" class="wl-retry-btn" style="background:#f5d400;color:#0a0806;border:none;padding:10px 22px;font-family:monospace;font-weight:900;letter-spacing:2px;cursor:pointer;">[重新尝试]</button>' +
          '<button type="button" class="wl-back-btn" style="background:#0a0806;color:#f5d400;border:1.5px solid #f5d400;padding:10px 22px;font-family:monospace;font-weight:900;letter-spacing:2px;cursor:pointer;">[返回选择]</button>' +
        '</div>'
      : '';
    var shellHtml =
      '<div class="result-modal-shell" data-result-view="western">' +
        '<div class="result-modal-toolbar">' +
          '<button class="result-back-camera-btn" type="button">← 摄像头</button>' +
        '</div>' +
        '<div class="result-modal-content ancient-loading">' +
          '<div class="ancient-loading__inner' + (phase === 'failed' ? ' ancient-loading__failed' : '') + '">' +
            (phase !== 'failed' ? '<div class="ancient-loading__bar"><span></span><span></span><span></span></div>' : '') +
            '<div class="ancient-loading__kicker">' + t.kicker + '</div>' +
            '<div class="ancient-loading__title">' + t.title + '</div>' +
            '<div class="ancient-loading__subtitle">' + t.subtitle + '</div>' +
            '<div class="ancient-loading__note">' + t.note + '</div>' +
            buttons +
          '</div>' +
        '</div>' +
      '</div>';
    root.innerHTML = shellHtml;
    root.style.display = 'block';
    root.classList.add('is-active');
    document.body.classList.add('v3x-view-active');
    // ★ 绑定按钮
    var bc = root.querySelector('.result-back-camera-btn');
    if (bc) bc.onclick = function () { if (window.resetToCamera) try { window.resetToCamera(); } catch (e) {} };
    var retry = root.querySelector('.wl-retry-btn');
    if (retry) retry.onclick = function () {
      // ★ 复用当前已锁定截图 · 不需要重新开摄像头
      console.log('[WESTERN_LOADING] retry click · reusing locked snapshot');
      try { runWesternAIAnalysis(); } catch (e) { console.error('[WESTERN_LOADING] retry err', e); }
    };
    var back = root.querySelector('.wl-back-btn');
    if (back) back.onclick = function () {
      console.log('[WESTERN_LOADING] back-to-select click');
      if (typeof window.SPA !== 'undefined' && typeof window.SPA.showPathSelectOverlay === 'function') {
        try { window.SPA.showPathSelectOverlay(); } catch (e) {}
      } else if (typeof window.backToPathSelect === 'function') {
        try { window.backToPathSelect(); } catch (e) {}
      }
    };
  }
  function hideWesternLoadingOverlay(reason) {
    console.log('[WESTERN_LOADING] hide · reason=' + (reason || 'unknown'));
    // 不主动清空 result-layer · 因为 caller 会接管并 showResultOverlay('western')
  }
  function updateWesternLoadingOverlay(phase) {
    // 不重建 DOM · 只改文字
    var root = document.getElementById('result-layer');
    if (!root) return;
    var shell = root.querySelector('.result-modal-shell[data-result-view="western"]');
    if (!shell) return;
    console.log('[WESTERN_LOADING] phase=' + phase);
    var map = {
      'reason-completion': {
        kicker: '▌ WESTERN REASON COMPLETION',
        title: 'AI 正在整理判定档案',
        subtitle: '正在生成六项个性化判词',
        note: '请稍候 · 档案生成中'
      },
      'result-loading': {
        kicker: '▌ ARCHIVE READY',
        title: '档案已经建立',
        subtitle: '正在载入西方结果页面',
        note: '请稍候 · 结果页载入中'
      }
    };
    var t = map[phase];
    if (!t) return;
    var k = shell.querySelector('.ancient-loading__kicker');
    var tt = shell.querySelector('.ancient-loading__title');
    var st = shell.querySelector('.ancient-loading__subtitle');
    var nt = shell.querySelector('.ancient-loading__note');
    if (k) k.textContent = t.kicker;
    if (tt) tt.textContent = t.title;
    if (st) st.textContent = t.subtitle;
    if (nt) nt.textContent = t.note;
  }

  // ★ 临时 mock AI 生成器 · 当 WESTERN_AI_MODE === 'mock' 时走这里
  // - 不调 upstream API · 不依赖 Token Plan 配额
  // - 模拟 AI 返回真实 shape · UI 端跟真 AI 完全一致
  // - reason 写成"针对本张图的视觉判断"风格（不重复 sample 自带 reason）
  function buildMockWesternAIResult(snap) {
    var sampleId = 'W01'; // ★ mock 固定返回 W01 苏格拉底（最复杂的样本，UI 验证最充分）
    var sample = getWesternSampleById(sampleId);
    return {
      sampleId: sampleId,
      confidence: 'high',
      shortReason: 'MOCK AI · 模拟下颌/眉眼/额头三角区与苏格拉底雕像最接近（占位，请切换至 real 模式调真 AI）',
      matchedFeatures: ['MOCK: 下颌宽', 'MOCK: 眉眼不对称', 'MOCK: 鼻梁低', 'MOCK: 额头高'],
      visionCheck: { hasFace: true, wearingGlasses: false, headPose: 'front', framing: 'face-closeup', brightness: 'medium', faceCount: 1, expression: 'neutral' },
      source: 'mock',
      dimensionReasons: {
        status:      'MOCK: 此张面孔不具古典英雄对称性，但思考/反诘的神态在视觉层面被归入哲人例外',
        temperament: 'MOCK: 眉眼微抬+口型微闭+头部微倾，符合反诘型智者的视觉气质',
        power:       'MOCK: 颧骨与下颌线条不显王权，但公共空间发声的智识权能可见',
        body:        'MOCK: 侧影线条不锐利，肩部略松散，匹配古希腊非战士群体的身形',
        role:        'MOCK: 凝视方向略旁侧，构图距离中等，处于道德审问者的画面位置',
        risk:        'MOCK: 低对称性+宽下颌+厚唇的组合在 19 世纪伪科学里会被误标，当前系统不给予高风险'
      }
    };
  }

  // ★ 主入口 · 父页面在 systemId === 'western' 时调用
  async function runWesternAIAnalysis() {
    if (!ENABLE_WESTERN_AI_ANALYSIS) {
      console.warn('[WESTERN_AI] disabled · skip');
      return;
    }
    // ★ 100ms 内必须出现 loading · 同步立即调用（不 await）
    showWesternLoadingOverlay('classification');
    console.log('[WESTERN_AI] runWesternAIAnalysis start · mode=' + WESTERN_AI_MODE);

    // ★ 模式分支 · mock 直接走，不调真 AI
    if (WESTERN_AI_MODE === 'mock') {
      console.log('[WESTERN_AI] MOCK MODE ACTIVE · skipping upstream API · using built-in mock data');
      var snap0 = window.__lockedSnapshot || null;
      var frameDataUrl0 = (snap0 && snap0.dataUrl) || null;
      if (!frameDataUrl0) {
        console.error('[WESTERN_AI] no captured frame · abort (mock still needs a frame)');
        showWesternAIFailed({ __failed: true, httpStatus: 0, error: 'no-captured-frame', upstreamMessage: 'mock 模式也需要摄像头帧' });
        return;
      }
      var mockResult = buildMockWesternAIResult(snap0);
      mockResult.shortReason = 'MOCK AI · 模拟下颌/眉眼/额头三角区与 W01 苏格拉底最接近（占位 · 切换至 real 模式调真 AI）';
      mockResult.dimensionReasons = {
        status:      'MOCK · 此张面孔不具古典英雄对称性，但思考/反诘的神态在视觉层面被归入哲人例外',
        temperament: 'MOCK · 眉眼微抬+口型微闭+头部微倾，符合反诘型智者的视觉气质',
        power:       'MOCK · 颧骨与下颌线条不显王权，但公共空间发声的智识权能可见',
        body:        'MOCK · 侧影线条不锐利，肩部略松散，匹配古希腊非战士群体的身形',
        role:        'MOCK · 凝视方向略旁侧，构图距离中等，处于道德审问者的画面位置',
        risk:        'MOCK · 低对称性+宽下颌+厚唇的组合在 19 世纪伪科学里会被误标，当前系统不给予高风险'
      };
      var vmMock = buildWesternViewModel(mockResult);
      var sampleIdMock = vmMock.sampleId;
      var baseSrc0 = (window.SPA && window.SPA.RESULT_IFRAME_SRC && window.SPA.RESULT_IFRAME_SRC.western) || '_preview/western-skin.html?v=4';
      var finalSrc0 = baseSrc0.split('?')[0] + '?id=' + sampleIdMock + '&v=5&mock=1';
      console.log('[WESTERN_AI] MOCK success · sampleId =', sampleIdMock, '· iframe src =', finalSrc0);
      if (window.SPA) {
        window.SPA.LAST_WESTERN_VM = vmMock;
        window.SPA.LAST_WESTERN_RESULT = mockResult;
        window.SPA.LAST_WESTERN_AIREASONS = mockResult.dimensionReasons;
        window.SPA.LAST_WESTERN_MODE = 'mock';
      }
      if (typeof window.SPA !== 'undefined' && typeof window.SPA.showResultOverlay === 'function') {
        window.SPA.showResultOverlay('western');
        var root0 = document.getElementById('result-layer');
        if (root0) {
          var fr0 = root0.querySelector('iframe.result-frame');
          if (fr0) fr0.src = finalSrc0;
          // ★ mock 模式：在 result-layer 顶部插一条红字 MOCK 标识
          var existingMock = root0.querySelector('.mock-ai-banner');
          if (!existingMock) {
            var banner = document.createElement('div');
            banner.className = 'mock-ai-banner';
            banner.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:999;background:#b84545;color:#fff;padding:6px 18px;font-family:monospace;font-size:11px;letter-spacing:3px;border:1px solid #fff;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.5);';
            banner.textContent = '▌ MOCK AI · TEMP · NOT REAL UPSTREAM · SET WESTERN_AI_MODE="real" WHEN TOKEN PLAN IS BACK';
            root0.appendChild(banner);
          }
        }
      } else {
        console.error('[WESTERN_AI] SPA.showResultOverlay missing');
      }
      return;
    }

    // ★ 与 modern pipeline 一致：统一从 window.__lockedSnapshot 读
    var snap = window.__lockedSnapshot || null;
    var frameDataUrl = (snap && snap.dataUrl) || window.capturedFrameDataUrl || null;
    var faceLandmarks = (snap && snap.faceLandmarks) || null;
    var faceDetected = !!(snap && snap.faceDetected === true);
    var landmarkCount = faceLandmarks && Array.isArray(faceLandmarks) ? faceLandmarks.length : 0;
    var capturedAt = (snap && snap.capturedAt) || (window.capturedFrameAt) || Date.now();

    // 一致性检查 · 顶部 UI 有人脸但 snapshot 丢 landmarks → 直接报失败（不掩盖）
    var uiLandmarkCount = (window.currentFaceState && window.currentFaceState.landmarkCount) || 0;
    console.log('[WESTERN_CAPTURE_CHECK]', {
      uiLandmarkCount: uiLandmarkCount,
      snapshotLandmarkCount: landmarkCount,
      snapshotFaceDetected: faceDetected
    });
    if (uiLandmarkCount >= 100 && landmarkCount === 0) {
      console.error('[WESTERN_AI] FACE STATE TRANSFER BROKEN: UI has face but snapshot lost landmarks (ui=' + uiLandmarkCount + ' · snap=' + landmarkCount + ')');
      showWesternAIFailed({ __failed: true, httpStatus: 0, error: 'face-state-transfer-broken', upstreamMessage: 'UI 顶部 landmarkCount=' + uiLandmarkCount + ' 但 snapshot=0' });
      return;
    }

    if (!frameDataUrl) {
      console.error('[WESTERN_AI] no captured frame · abort');
      showWesternAIFailed({ __failed: true, httpStatus: 0, error: 'no-captured-frame', upstreamMessage: '摄像头未采到帧' });
      return;
    }
    if (!faceDetected || landmarkCount < 100) {
      console.warn('[WESTERN_AI] no face confirmed locally · showing REAL AI FAILED');
      showWesternAIFailed({ __failed: true, httpStatus: 422, error: 'no-face-detected', upstreamMessage: '本地未检测到人脸（landmarkCount=' + landmarkCount + '）' });
      return;
    }

    var faceCropDataUrl = await fetchCurrentCropDataUrl(faceLandmarks, frameDataUrl, landmarkCount);
    console.log('[WESTERN_FACE_CROP]', {
      landmarkCount: landmarkCount,
      attached: Boolean(faceCropDataUrl),
      bytes: faceCropDataUrl ? faceCropDataUrl.length : 0
    });

    var aiResult = await callWesternAIClient({
      imageDataUrl: frameDataUrl,
      faceCropDataUrl: faceCropDataUrl,
      localFaceDetected: faceDetected,
      localLandmarkCount: landmarkCount,
      capturedAt: capturedAt,
      allowedSampleIds: WESTERN_AI_ALLOWED.slice()
    });

    if (!aiResult) {
      showWesternAIFailed({ __failed: true, httpStatus: 0, error: 'null-response', upstreamMessage: 'AI 返回空' });
      return;
    }
    if (aiResult.__failed) {
      showWesternAIFailed(aiResult);
      return;
    }
    if (aiResult.__noFace) {
      showWesternAIFailed({ __failed: true, httpStatus: 422, error: 'no-face-detected', upstreamMessage: 'AI 判定无脸' });
      return;
    }
    if (!isValidWesternAIResult(aiResult)) {
      showWesternAIFailed({ __failed: true, httpStatus: 0, error: 'invalid-sample-id', upstreamMessage: 'sampleId 不在 W01-W14' });
      return;
    }
    // ★ sampleId 已返回 · 切换到 reason-completion phase
    updateWesternLoadingOverlay('reason-completion');
    // ★ 重要日志：sampleId 已选中
    console.log('[WESTERN_AI] request done · selected sample ' + aiResult.sampleId + ' · reasonSource=' + (aiResult.reasonSource || 'ai-personalized'));

    var vm;
    try {
      // ★ 把服务端给的 dimensionReasons + reasonSource 注入 vm，buildWesternViewModel 内部 pickReason 会优先用 AI 的
      var aiForVm = {
        sampleId: aiResult.sampleId,
        shortReason: aiResult.shortReason,
        confidence: aiResult.confidence,
        matchedFeatures: aiResult.matchedFeatures || [],
        source: 'ai',
        visionCheck: aiResult.visionCheck || { hasFace: true, wearingGlasses: false, headPose: 'unclear', framing: 'unclear', brightness: 'unclear' },
        dimensionReasons: aiResult.dimensionReasons || {},
        reasonSource: aiResult.reasonSource || 'ai-personalized'
      };
      vm = buildWesternViewModel(aiForVm);
    } catch (e) {
      console.error('[WESTERN_AI] viewModel build failed:', e.message);
      showWesternAIFailed({ __failed: true, httpStatus: 0, error: 'viewmodel-build-failed', upstreamMessage: e.message });
      return;
    }

    // ★ 输出结果页 reasonSource 日志（与 ancient / modern 一致）
    var drCount = 0;
    var drObj = (vm && vm.reasonOrigin) ? vm.reasonOrigin : null;
    if (aiResult.dimensionReasons && typeof aiResult.dimensionReasons === 'object') {
      for (var dk in aiResult.dimensionReasons) {
        var dv = aiResult.dimensionReasons[dk];
        if (typeof dv === 'string' && dv.trim().length >= 4) drCount++;
      }
    }
    console.log('[WESTERN_REASON_RENDER] source=' + (vm.reasonSource || 'ai-personalized') + ' · count=' + drCount + '/6' + ' · westernSource=' + (aiResult.westernSource || 'normal'));

    // ★ 拿到 sampleId 后，加载 western iframe · 用 ?id=Wxx 让 IIFE 自动渲染
    var sampleId = vm.sampleId;
    var baseSrc = (window.SPA && window.SPA.RESULT_IFRAME_SRC && window.SPA.RESULT_IFRAME_SRC.western) || '_preview/western-skin.html?v=4';
    // ★ 用 ?id=Wxx 强制 IIFE 渲染该 sample
    var finalSrc = baseSrc.split('?')[0] + '?id=' + sampleId + '&v=5';
    console.log('[WESTERN_AI] success · sampleId =', sampleId, '· iframe src =', finalSrc);

    // ★ 把 vm 暂存到 SPA · 等 iframe load 完（其实 IIFE 自己会读 URL pickId · 这里 vm 仅做兜底）
    if (window.SPA) {
      window.SPA.LAST_WESTERN_VM = vm;
      window.SPA.LAST_WESTERN_RESULT = aiResult;
      // ★ 把 AI 写的 6 维度 reason + reasonSource 存到 parent · IIFE 会在自己初始化完成后自动拉
      var air = (aiResult && aiResult.dimensionReasons) ? aiResult.dimensionReasons : null;
      if (air && typeof air === 'object') {
        air.reasonSource = aiResult.reasonSource || 'ai-personalized';
      }
      window.SPA.LAST_WESTERN_AIREASONS = air;
    }
    // ★ 把本轮用户帧暴露到 window · 西方融合模块需要
    window.__lastLockedUserImage = frameDataUrl;

    // ★ 调 showResultOverlay 并改 src · 不动 ancient/modern 逻辑
    if (typeof window.SPA !== 'undefined' && typeof window.SPA.showResultOverlay === 'function') {
      // ★ 切到 result-loading phase（archive ready）
      updateWesternLoadingOverlay('result-loading');
      // 先按 base src 打开 result-layer · 然后立刻改 iframe.src 加 ?id=
      window.SPA.showResultOverlay('western');
      var root = document.getElementById('result-layer');
      if (root) {
        var fr = root.querySelector('iframe.result-frame');
        if (fr) {
          // ★ 等 iframe 真 load 完才隐藏 loading overlay
          var didHide = false;
          function onIframeLoad() {
            if (didHide) return;
            didHide = true;
            console.log('[WESTERN_LOADING] hide · reason=iframe-loaded · sampleId=' + sampleId);
            // result-loading 类用于显示"档案已建立"短暂保持 · 这里给 200ms 缓冲
            setTimeout(function () {
              var ld = root.querySelector('.result-loading');
              if (ld) ld.style.display = 'none';
            }, 200);
          }
          fr.addEventListener('load', onIframeLoad, { once: true });
          // ★ 兜底超时（30s）强制关闭 loading · 避免永远卡住
          setTimeout(function () { if (!didHide) onIframeLoad(); }, 30000);
          fr.src = finalSrc;
        }
      }
    } else {
      console.error('[WESTERN_AI] SPA.showResultOverlay missing · cannot render');
    }
    // ★ 输出最终 result state 日志
    var drCount3 = 0;
    if (vm && vm.reasonOrigin) {
      for (var rk in vm.reasonOrigin) { if (vm.reasonOrigin[rk] === 'ai') drCount3++; }
    }
    console.log('[RESULT_STATE] system=western sampleId=' + vm.sampleId + ' reasonSource=' + (vm.reasonSource || 'ai-personalized') + ' dimReasons=' + drCount3 + '/6');
  }

  // ★ 修复中 overlay · 当服务端走公共修复流水线时显示
  // ★ 不再整页崩 · 告诉用户"系统正在整理判定档案……"
  function showWesternRepairingOverlay() {
    var root = document.getElementById('result-layer');
    if (!root) return;
    root.innerHTML =
      '<div class="result-modal-shell" data-result-view="western">' +
        '<div class="result-modal-toolbar">' +
          '<button class="result-back-camera-btn" type="button">← 摄像头</button>' +
        '</div>' +
        '<div class="result-modal-content ancient-loading">' +
          '<div class="ancient-loading__inner">' +
            '<div class="ancient-loading__bar"><span></span><span></span><span></span></div>' +
            '<div class="ancient-loading__kicker">▌ ARCHIVE REPAIRING</div>' +
            '<div class="ancient-loading__title">系统正在整理判定档案……</div>' +
            '<div class="ancient-loading__subtitle">模型首次返回格式异常，正在补全判定理由</div>' +
            '<div class="ancient-loading__note">请稍候 · 不需要重新拍摄</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.style.display = 'block';
    root.classList.add('is-active');
    document.body.classList.add('v3x-view-active');
    var bc = root.querySelector('.result-back-camera-btn');
    if (bc) bc.onclick = function () { if (window.resetToCamera) try { window.resetToCamera(); } catch (e) {} };
  }

  // ★ REAL AI FAILED · 严格模式：禁止 local fallback 掩盖 AI 失败 · 显示失败原因
  // ★ 前端不展示 upstreamRaw（避免泄露模型原文/不好看）· 只展示用户友好提示
  //   详细错误已 console.error 留在服务端 / 客户端 console
  function showWesternAIFailed(failInfo) {
    console.error('[WESTERN_AI] REAL AI FAILED · ', failInfo);
    // ★ 复用 western loading overlay 的失败态 · 提供 [重新尝试] / [返回选择] 按钮
    showWesternLoadingOverlay('failed');
  }

  // ★ 暴露给父页面
  window.runWesternAIAnalysis = runWesternAIAnalysis;
  window.buildWesternViewModel = buildWesternViewModel;
  window.showWesternRepairingOverlay = showWesternRepairingOverlay;
  window.showWesternLoadingOverlay = showWesternLoadingOverlay;
  window.updateWesternLoadingOverlay = updateWesternLoadingOverlay;
  window.hideWesternLoadingOverlay = hideWesternLoadingOverlay;
  window.WESTERN_AI_ALLOWED = WESTERN_AI_ALLOWED;
  window.WESTERN_AI_STRICT_TEST = WESTERN_AI_STRICT_TEST;
  console.log('[WESTERN_AI] pipeline loaded · allowed:', WESTERN_AI_ALLOWED.join(','));
})();

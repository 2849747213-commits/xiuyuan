/* ============================================================
   BIAS SYSTEM · Modern AI Pipeline · v2 (HOTFIX)
   - 真实 AI + 字段适配层 buildModernViewModel
   - 绝对图片路径 /exhibition-camera/assets/sample-library/modern/normalized/
   - 严格必填字段校验
   ============================================================ */
(function () {
  if (!window.MODERN_LOCAL_SAMPLES) return;
  var MODERN_AI_ALLOWED = ['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','M13','M14','M15','M16','M17','M18','M19','M20'];
  var ENABLE_MODERN_AI_ANALYSIS = true;
  var MODERN_AI_MODE = 'real';
  // ★ 严格模式默认开启：禁止 local fallback 掩盖 AI 失败
  var MODERN_AI_STRICT_TEST = true;
  var STRICT_REQUIRED_FIELDS = ['sampleId','sampleName','systemVerdict','verdictCategoryLine','matchReasonLine','sexualityValue','sexualityReason','genderValue','genderReason','incomeValue','incomeReason','familyValue','familyReason','relationshipValue','relationshipReason','riskValue','riskReason','evidenceTitle','evidenceSubtitle','evidenceIntro','evidenceNote','evidenceImages','engineLabel','source','confidence','visionCheck'];

  // ★ 绝对图片根路径 · iframe 内页面位于 /exhibition-camera/_preview/
  // 浏览器解析绝对路径时不会再加 _preview/ 前缀
  var MODERN_ASSET_ROOT = '/exhibition-camera/assets/sample-library/modern/normalized/';

  function getModernImagePath(sampleId, role) {
    return MODERN_ASSET_ROOT + sampleId + '_sample_' + role + '.jpg';
  }

  function getModernSampleById(sampleId) {
    if (!window.MODERN_LOCAL_SAMPLES) return null;
    return window.MODERN_LOCAL_SAMPLES.find(function (s) { return s.sampleId === sampleId; }) || null;
  }

  // ★ view-model 适配层 · 父页面调用入口
  function buildModernViewModel(aiResult) {
    if (!aiResult) throw new Error('[MODERN_VIEW_MODEL] missing aiResult');
    var sampleId = aiResult.sampleId;
    var sample = getModernSampleById(sampleId);
    if (!sample) throw new Error('[MODERN_VIEW_MODEL] unknown sample ' + sampleId);

    // ★ AI 给的 6 维度判定原因 · 优先使用 · 缺则降级 sample 自带 reason
    var aiDR = (aiResult.dimensionReasons && typeof aiResult.dimensionReasons === 'object') ? aiResult.dimensionReasons : {};
    function pickReason(aiText, fallback) {
      if (typeof aiText === 'string' && aiText.trim().length >= 4) return aiText.trim();
      return fallback || '';
    }

    var viewModel = {
      sampleId: sample.sampleId,
      sampleName: sample.sampleName,
      sampleKind: sample.sampleKind || '',
      systemVerdict: sample.systemVerdict || '',
      verdictCategoryLine: sample.verdictCategoryLine || '',
      matchReasonLine: aiResult.shortReason || sample.defaultMatchReason || '',

      // ★ 6 维度 reason 优先用 AI 生成的 · fallback 到 sample 库
      sexualityValue: sample.sexuality_value || '',
      sexualityReason: pickReason(aiDR.sexuality, sample.sexuality_reason),
      genderValue: sample.gender_value || '',
      genderReason: pickReason(aiDR.gender, sample.gender_reason),
      incomeValue: sample.income_value || '',
      incomeReason: pickReason(aiDR.income, sample.income_reason),
      familyValue: sample.family_value || '',
      familyReason: pickReason(aiDR.family, sample.family_reason),
      relationshipValue: sample.relationship_value || '',
      relationshipReason: pickReason(aiDR.relationship, sample.relationship_reason),
      riskValue: sample.risk_value || '',
      riskReason: pickReason(aiDR.risk, sample.risk_reason),

      evidenceSubtitle: sample.evidenceSubtitle || '',
      evidenceTitle: sample.evidenceTitle || '',
      evidenceIntro: sample.evidenceIntro || '',
      evidenceNote: sample.evidenceNote || '',
      evidenceImages: {
        main: getModernImagePath(sample.sampleId, 'main'),
        alt: getModernImagePath(sample.sampleId, 'alt'),
        context: getModernImagePath(sample.sampleId, 'context'),
        archive: getModernImagePath(sample.sampleId, 'archive')
      },
      evidenceCaptions: {
        main: 'ORIGINAL FACE / 标准形象',
        alt: 'INTERNET FACE / 网络面孔',
        context: 'CONTEXT / 传播语境',
        archive: 'SYSTEM CROP / 系统截取'
      },

      engineLabel: aiResult.source === 'ai' ? 'AI ARCHIVE' : 'LOCAL FALLBACK',
      source: aiResult.source || 'unknown',
      confidence: aiResult.confidence || 'medium',
      matchedFeatures: aiResult.matchedFeatures || [],
      visionCheck: aiResult.visionCheck || null,

      // ★ 把 reasonSource 透传到结果页 · 供调试 / IIFE 渲染用
      reasonSource: aiResult.reasonSource || 'ai-personalized',
      reasonOrigin: {
        sexuality:     (typeof aiDR.sexuality     === 'string' && aiDR.sexuality.trim().length     >= 4) ? 'ai' : 'sample',
        gender:        (typeof aiDR.gender        === 'string' && aiDR.gender.trim().length        >= 4) ? 'ai' : 'sample',
        income:        (typeof aiDR.income        === 'string' && aiDR.income.trim().length        >= 4) ? 'ai' : 'sample',
        family:        (typeof aiDR.family        === 'string' && aiDR.family.trim().length        >= 4) ? 'ai' : 'sample',
        relationship:  (typeof aiDR.relationship  === 'string' && aiDR.relationship.trim().length  >= 4) ? 'ai' : 'sample',
        risk:          (typeof aiDR.risk          === 'string' && aiDR.risk.trim().length          >= 4) ? 'ai' : 'sample'
      },

      bottomWarning: '本次报告未识别输入对象的真实属性 · 仅展示分类系统的运作方式'
    };

    // ★ 严格模式：缺字段直接 throw
    if (MODERN_AI_STRICT_TEST) {
      for (var i = 0; i < STRICT_REQUIRED_FIELDS.length; i++) {
        var k = STRICT_REQUIRED_FIELDS[i];
        var v = viewModel[k];
        if (k === 'evidenceImages') { if (!v || !v.main || !v.alt || !v.context || !v.archive) throw new Error('[MODERN_VIEW_MODEL] missing field ' + k); continue; }
        if (k === 'visionCheck') { if (!v || typeof v.hasFace !== 'boolean') throw new Error('[MODERN_VIEW_MODEL] missing field ' + k); continue; }
        if (typeof v !== 'string' || !v.trim()) throw new Error('[MODERN_VIEW_MODEL] missing field ' + k);
      }
    }

    return viewModel;
  }

  // ★ deprecated · 老 buildModernResultFromSampleIdV2 仍保留供本地预览
  function buildModernResultFromSampleIdV2(sampleId, meta) {
    var sample = getModernSampleById(sampleId);
    if (!sample) return null;
    meta = meta || {};
    var reason = meta.shortReason
      ? ('系统依据本地与 AI 视觉判断，将当前输入归入「' + sample.sampleName + '」：' + meta.shortReason)
      : ('系统依据本地样本特征，将当前输入归入「' + sample.sampleName + '」。');
    return {
      verdictTitle: '你被归类为',
      verdictSubtitle: '当前模式：现代面学 · 身份清仓 · 梗图宿主 / 公审样本',
      sampleId: sample.sampleId,
      sampleName: sample.sampleName,
      sampleKind: sample.sampleKind,
      systemVerdict: sample.systemVerdict,
      verdictCategoryLine: sample.verdictCategoryLine,
      verdictReasonLine: reason,
      verdictNote: '本次报告未识别输入对象的真实属性 · 仅展示分类系统的运作方式',
      identityCard: {
        orientation: { label: sample.sexuality_value || '—', reason: sample.sexuality_reason || '—' },
        gender:      { label: sample.gender_value      || '—', reason: sample.gender_reason      || '—' },
        income:      { label: sample.income_value      || '—', reason: sample.income_reason      || '—' },
        family:      { label: sample.family_value      || '—', reason: sample.family_reason      || '—' },
        relationship:{ label: sample.relationship_value|| '—', reason: sample.relationship_reason|| '—' },
        risk:        { label: sample.risk_value        || '—', reason: sample.risk_reason        || '—' }
      },
      evidenceStrip: {
        main: getModernImagePath(sample.sampleId, 'main'),
        alt: getModernImagePath(sample.sampleId, 'alt'),
        context: getModernImagePath(sample.sampleId, 'context'),
        archive: getModernImagePath(sample.sampleId, 'archive')
      },
      evidenceCaptions: {
        main: 'ORIGINAL FACE / 标准形象',
        alt: 'INTERNET FACE / 网络面孔',
        context: 'CONTEXT / 传播语境',
        archive: 'SYSTEM CROP / 系统截取'
      },
      evidenceTitle: sample.evidenceTitle,
      evidenceSubtitle: sample.evidenceSubtitle,
      evidenceIntro: sample.evidenceIntro,
      evidenceNote: sample.evidenceNote,
      archiveStrip: {
        main: getModernImagePath(sample.sampleId, 'main'),
        alt: getModernImagePath(sample.sampleId, 'alt'),
        context: getModernImagePath(sample.sampleId, 'context'),
        archive: getModernImagePath(sample.sampleId, 'archive')
      },
      aiMeta: meta,
      matchConfidence: meta.confidence || 'medium',
      matchedFeatures: meta.matchedFeatures || [],
      engine: meta.source === 'ai' ? 'AI ARCHIVE' : 'LOCAL FALLBACK',
      engineNote: meta.source === 'ai'
        ? '本次归档由真实 AI 调用 /api/classify/modern 选择样本'
        : 'AI 失败 · 已使用本地档案回退',
      bottomWarning: '本次报告未识别输入对象的真实属性 · 仅展示分类系统的运作方式'
    };
  }

  // 真实 AI 网络调用
  function buildModernAIPayload(frameDataUrl) {
    return {
      system: 'modern',
      task: 'choose_one_sample_from_fixed_library',
      note: 'This is a fictional artistic classification system. Do not infer real identity / personality / fate / health / gender / ethnicity / sexuality / income / family / relationship / risk / criminal behavior. Only choose one archive sample from the fixed M01-M20 list.',
      imageDataUrl: frameDataUrl || null,
      allowedSampleIds: MODERN_AI_ALLOWED.slice(),
      sampleGlossary: (window.MODERN_LOCAL_SAMPLES || []).map(function (s) {
        return { sampleId: s.sampleId, sampleName: s.sampleName, keywords: s.tags || [] };
      })
    };
  }

  function parseModernAIJson(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    var text = String(raw).trim();
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    var start = text.indexOf('{'); var end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    try { return JSON.parse(text); } catch (e) { console.warn('[MODERN_AI] JSON parse fail:', e.message); return null; }
  }

  function isValidModernAIResult(result) {
    if (!result || typeof result !== 'object') return false;
    // ★ 兼容模型返回 finalSampleId / topCandidates[0].sampleId
    if (MODERN_AI_ALLOWED.indexOf(result.sampleId) < 0) {
      if (result.finalSampleId && MODERN_AI_ALLOWED.indexOf(result.finalSampleId) >= 0) {
        result.sampleId = result.finalSampleId;
      } else if (Array.isArray(result.topCandidates) && result.topCandidates[0] && MODERN_AI_ALLOWED.indexOf(result.topCandidates[0].sampleId) >= 0) {
        result.sampleId = result.topCandidates[0].sampleId;
      } else if (result.candidateScores && typeof result.candidateScores === 'object') {
        var keys = Object.keys(result.candidateScores);
        var top = null, topScore = -1;
        for (var i = 0; i < keys.length; i++) {
          var s = Number(result.candidateScores[keys[i]]) || 0;
          if (s > topScore && MODERN_AI_ALLOWED.indexOf(keys[i]) >= 0) { topScore = s; top = keys[i]; }
        }
        if (top) result.sampleId = top;
      } else return false;
    }
    if (!['low','medium','high'].includes(result.confidence)) result.confidence = 'medium';
    if (!Array.isArray(result.matchedFeatures)) {
      if (Array.isArray(result.topCandidates)) {
        result.matchedFeatures = result.topCandidates.slice(0, 4).map(function (c) { return c.reason || c.sampleId; });
      } else if (result.candidateScores && typeof result.candidateScores === 'object') {
        result.matchedFeatures = Object.keys(result.candidateScores).slice(0, 4);
      } else {
        result.matchedFeatures = [];
      }
    }
    if (typeof result.shortReason !== 'string' || !result.shortReason.length) {
      if (Array.isArray(result.topCandidates) && result.topCandidates[0] && result.topCandidates[0].reason) {
        result.shortReason = result.topCandidates[0].reason;
      } else if (typeof result.confidence !== 'string') {
        result.shortReason = '视觉匹配 · 候选 ' + result.sampleId;
      }
    }
    return true;
  }

  // ★ 独立请求状态 · 防止重复 / 复用旧 signal
  var modernRequestController = null;
  var modernRequestInFlight = false;
  var MODERN_AI_TIMEOUT_MS = 60000;  // ★ 60s · upstream 多模态推理可能耗时

  function traceModernAbort(controller, reason) {
    console.error('[MODERN_ABORT] called · reason:', reason);
    if (controller && controller.signal && !controller.signal.aborted) {
      try { controller.abort(reason); } catch (e) {}
    }
  }

  async function callModernAIClient(payload) {
    // 重复请求直接忽略
    if (modernRequestInFlight) {
      console.warn('[MODERN_AI] duplicate request blocked · already in flight');
      return null;
    }
    modernRequestInFlight = true;

    var endpoint = (window.location.origin || '') + '/api/classify/modern';
    var body = {
      image: payload.imageDataUrl || null,
      faceCropDataUrl: payload.faceCropDataUrl || null,
      localFaceDetected: payload.localFaceDetected === true,
      localLandmarkCount: Number(payload.localLandmarkCount) || 0,
      capturedAt: payload.capturedAt || 0,
      allowedSampleIds: payload.allowedSampleIds || MODERN_AI_ALLOWED.slice(),
      sampleGlossary: payload.sampleGlossary || [],
      testMode: payload.testMode || 'production'
    };
    console.log('[MODERN_AI] payload · localFaceDetected:', body.localFaceDetected, '· landmarkCount:', body.localLandmarkCount, '· faceCrop attached:', !!body.faceCropDataUrl);

    // ★ 每次请求都新建独立 controller（绝不复用旧 signal）
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    modernRequestController = controller;
    console.log('[MODERN_AI] new controller · aborted before fetch:', controller ? controller.signal.aborted : 'no-ctrl');
    console.log('[MODERN_AI] timeout ms', MODERN_AI_TIMEOUT_MS);

    var timeoutId = null;
    if (controller) {
      timeoutId = setTimeout(function () {
        if (!controller.signal.aborted) {
          console.warn('[MODERN_AI] timeout abort · ms=' + MODERN_AI_TIMEOUT_MS);
          traceModernAbort(controller, new DOMException('modern request timeout', 'TimeoutError'));
        }
      }, MODERN_AI_TIMEOUT_MS);
    }

    console.log('[MODERN_AI] request URL', endpoint);

    try {
      var resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      });
      console.log('[MODERN_AI] response status', resp.status);
      var text = await resp.text();
      console.log('[MODERN_AI] response text', text);
      // ★ 上游非 200 → 返回 __failed 对象（携带 status + failedImageSlot + upstreamMessage）
      if (!resp.ok) {
        var data2 = null; try { data2 = JSON.parse(text); } catch (e) {}
        console.error('[MODERN_AI] REAL AI FAILED · HTTP ' + resp.status + ' · ' + (data2 && data2.error || 'unknown'));
        return { __failed: true, httpStatus: resp.status, error: (data2 && data2.error) || 'unknown', failedImageSlot: (data2 && data2.failedImageSlot) || '', upstreamMessage: (data2 && data2.upstreamMessage) || text.slice(0, 300) };
      }
      var data; try { data = JSON.parse(text); } catch (e) {
        console.error('[MODERN_AI] REAL AI FAILED · response not JSON:', e.message); return null;
      }
      // ★ 兼容新统一结构（顶层 sampleId + dimensionReasons + reasonSource）和老 nested 结构（data.result.sampleId）
      if (data && data.ok === true && data.source === 'ai' && MODERN_AI_ALLOWED.indexOf(data.sampleId) >= 0) {
        console.log('[MODERN_AI] response ok true · source ai · sampleId', data.sampleId);
        console.log('[MODERN_AI] response status 200 · source=' + data.source);
        console.log('[MODERN_AI] parsed sampleId', data.sampleId);
        console.log('[MODERN_AI] selected sample', data.sampleId);
        console.log('[MODERN_AI] reasonSource', data.reasonSource, '· dimReasons count =', (data.dimensionReasons ? Object.keys(data.dimensionReasons).length : 0) + '/6');
        return data;
      }
      if (data && data.ok === true && data.source === 'ai' && data.result && MODERN_AI_ALLOWED.indexOf(data.result.sampleId) >= 0) {
        console.log('[MODERN_AI] legacy nested result · sampleId', data.result.sampleId);
        return data.result;
      }
      if (data && data.source === 'no-face' && data.visionCheck) {
        return { __noFace: true, visionCheck: data.visionCheck };
      }
      console.error('[MODERN_AI] REAL AI FAILED · server returned ok=' + (data && data.ok) + ', source=' + (data && data.source));
      return null;
    } catch (e) {
      if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
        console.error('[MODERN_AI] aborted · name=' + e.name + ' · reason=' + (controller && controller.signal && controller.signal.reason || ''));
      } else {
        console.error('[MODERN_AI] REAL AI FAILED · ' + (e && e.message || e));
      }
      return null;
    } finally {
      // ★ finally 只清理 timer + 引用 · 绝不主动 abort
      if (timeoutId) { try { clearTimeout(timeoutId); } catch (e) {} }
      if (modernRequestController === controller) {
        modernRequestController = null;
      }
      modernRequestInFlight = false;
      console.log('[MODERN_AI] request lifecycle released');
    }
  }

  async function analyzeModernSampleWithAI(payloadOrDataUrl) {
    console.log('[MODERN_AI] mode ' + MODERN_AI_MODE);
    console.log('[MODERN_AI] request start');
    var payload;
    if (payloadOrDataUrl && typeof payloadOrDataUrl === 'object' && payloadOrDataUrl.imageDataUrl) {
      payload = payloadOrDataUrl;
    } else {
      payload = buildModernAIPayload(payloadOrDataUrl);
    }
    var parsed = null;
    if (MODERN_AI_MODE === 'real' || MODERN_AI_MODE === 'auto') {
      try { parsed = await callModernAIClient(payload); }
      catch (e) { console.error('[MODERN_AI] request failed', e && e.message); parsed = null; }
    }
    if (parsed && parsed.__noFace) return parsed;
    if (parsed && parsed.__failed) return parsed;  // ★ 透传 __failed
    if (!parsed) {
      console.error('[MODERN_AI] request failed · no AI result');
      return null;
    }
    if (!isValidModernAIResult(parsed)) {
      console.error('[MODERN_AI] invalid parsed result');
      return null;
    }
    console.log('[MODERN_AI] selected sample', parsed.sampleId);
    return parsed;
  }

  function runModernLocalAnalysis() {
    var sample = window.MODERN_LOCAL_SAMPLES && window.MODERN_LOCAL_SAMPLES[0];
    if (!sample) return null;
    return {
      sampleId: sample.sampleId,
      sampleName: sample.sampleName,
      confidence: 'low',
      matchReasonLine: '本地兜底：未拿到 AI 返回 · 默认使用 ' + sample.sampleId,
      matchedFeatures: sample.tags || []
    };
  }

  function showModernLoadingOverlay() {
    var root = document.getElementById('result-layer');
    if (!root) return;
    root.innerHTML =
      '<div class="result-modal-shell" data-result-view="modern">' +
        '<div class="result-modal-toolbar">' +
          '<button class="result-back-camera-btn" type="button">← 摄像头</button>' +
        '</div>' +
        '<div class="result-modal-content ancient-loading">' +
          '<div class="ancient-loading__inner">' +
            '<div class="ancient-loading__bar"><span></span><span></span><span></span></div>' +
            '<div class="ancient-loading__kicker">▌ ARCHIVE MATCHING · M01-M20</div>' +
            '<div class="ancient-loading__title">AI 正在归档当前帧</div>' +
            '<div class="ancient-loading__subtitle">正在比对 M01-M20 公共样本库</div>' +
            '<div class="ancient-loading__note">请稍候 · ARCHIVE MATCHING</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.style.display = 'block';
    root.classList.add('is-active');
    document.body.classList.add('v3x-view-active');
    var bc = root.querySelector('.result-back-camera-btn');
    if (bc) bc.onclick = function () { if (window.resetToCamera) try { window.resetToCamera(); } catch (e) {} };
  }

  function showModernAIFailedOverlay(reason) {
    var root = document.getElementById('result-layer');
    if (!root) return;
    // ★ 严格模式：禁止 upstreamRaw / 详细错误 / HTTP 状态码显示给用户
    // ★ 只显示用户友好提示
    var userTitle = 'AI 返回格式异常';
    var userHint = '系统未能完成档案整理，请重新分析。';
    root.innerHTML =
      '<div class="result-modal-shell" data-result-view="modern">' +
        '<div class="result-modal-toolbar">' +
          '<button class="result-back-camera-btn" type="button">← 摄像头</button>' +
        '</div>' +
        '<div class="result-modal-content ancient-loading">' +
          '<div class="ancient-loading__inner ancient-loading__failed">' +
            '<div class="ancient-loading__kicker">▌ REAL AI FAILED</div>' +
            '<div class="ancient-loading__title">' + userTitle + '</div>' +
            '<div class="ancient-loading__subtitle">' + userHint + '</div>' +
            '<div class="ancient-loading__note">按上方按钮返回摄像头重新采集</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.style.display = 'block';
    root.classList.add('is-active');
    document.body.classList.add('v3x-view-active');
    var bc = root.querySelector('.result-back-camera-btn');
    if (bc) bc.onclick = function () { if (window.resetToCamera) try { window.resetToCamera(); } catch (e) {} };
  }

  // ★ 修复中 overlay · 当服务端走公共修复流水线时显示
  // ★ 不再整页崩 · 告诉用户"系统正在整理判定档案……"
  function showModernRepairingOverlay() {
    var root = document.getElementById('result-layer');
    if (!root) return;
    root.innerHTML =
      '<div class="result-modal-shell" data-result-view="modern">' +
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

  function fillModernIframeWhenReady(viewModel) {
    return new Promise(function (resolve) {
      var attempts = 0;
      function apply() {
        attempts++;
        var frame = document.querySelector('#result-layer iframe.result-frame');
        if (!frame) { if (attempts < 30) return setTimeout(apply, 80); return resolve(null); }
        if (frame.contentDocument && frame.contentDocument.readyState !== 'complete') {
          frame.addEventListener('load', function onload() {
            frame.removeEventListener('load', onload); doFill();
          }, { once: true });
          return;
        }
        doFill();
      }
      function doFill() {
        var frame = document.querySelector('#result-layer iframe.result-frame');
        if (!frame || !frame.contentWindow || typeof frame.contentWindow.fillModernSkin !== 'function') {
          if (attempts < 30) return setTimeout(apply, 80);
          console.warn('[MODERN_IFRAME] fillModernSkin not ready'); return resolve(null);
        }
        console.log('[MODERN_IFRAME] fill start', viewModel.sampleId);
        frame.contentWindow.fillModernSkin(viewModel);
        console.log('[MODERN_IFRAME] fill complete', viewModel.sampleId, viewModel.sampleName);
        resolve(viewModel);
      }
      apply();
    });
  }

  // ★ 主流程 · 唯一 modern 入口 · 严格模式禁用 fallback
  async function runModernAIAnalysis() {
    showModernLoadingOverlay();
    var snap = window.__lockedSnapshot || null;
    var dataUrl = snap && snap.dataUrl || null;
    var faceLandmarks = snap && snap.faceLandmarks || null;
    var faceDetected = snap && snap.faceDetected === true;
    var landmarkCount = faceLandmarks && Array.isArray(faceLandmarks) ? faceLandmarks.length : 0;
    var capturedAt = snap && snap.capturedAt || Date.now();
    console.log('[MODERN_AI] mode real');
    console.log('[MODERN_AI] request URL=/api/classify/modern');
    console.log('[MODERN_AI] sampleId before request', null);
    console.log('[CAPTURE] landmark count', landmarkCount, '· faceDetected:', faceDetected);

    // ★ P0-7：发送前一致性检查 · 顶部 UI 与 snapshot 必须一致
    var uiLandmarkCount = (window.currentFaceState && window.currentFaceState.landmarkCount) || 0;
    console.log('[MODERN_CAPTURE_CHECK]', {
      uiLandmarkCount: uiLandmarkCount,
      snapshotLandmarkCount: landmarkCount,
      snapshotFaceDetected: faceDetected
    });
    if (uiLandmarkCount >= 100 && landmarkCount === 0) {
      throw new Error('FACE STATE TRANSFER BROKEN: UI has face but snapshot lost landmarks (ui=' + uiLandmarkCount + ' · snap=' + landmarkCount + ')');
    }

    if (!dataUrl) {
      console.error('[MODERN_AI] no locked snapshot · abort');
      showModernAIFailedOverlay('REAL MODERN AI FAILED\n未检测到锁定帧 · 请返回摄像头重新采集');
      return { ok: false, source: 'error', error: 'no-locked-snapshot' };
    }

    // ★ P0-3：按锁定 landmarks 裁出 faceCrop
    var faceCropDataUrl = null;
    if (faceDetected && landmarkCount >= 100 && typeof window.createFaceCropFromSnapshot === 'function') {
      try {
        faceCropDataUrl = await window.createFaceCropFromSnapshot(dataUrl, faceLandmarks);
      } catch (e) {
        console.warn('[MODERN_FACE_CROP] generation err:', e && e.message);
      }
    }
    console.log('[MODERN_FACE_CROP]', {
      landmarkCount: landmarkCount,
      attached: Boolean(faceCropDataUrl),
      bytes: faceCropDataUrl ? faceCropDataUrl.length : 0
    });

    var aiResult = null;
    try {
      aiResult = await analyzeModernSampleWithAI({
        imageDataUrl: dataUrl,
        faceCropDataUrl: faceCropDataUrl,
        localFaceDetected: faceDetected,
        localLandmarkCount: landmarkCount,
        capturedAt: capturedAt,
        allowedSampleIds: MODERN_AI_ALLOWED.slice(),
        sampleGlossary: (window.MODERN_LOCAL_SAMPLES || []).map(function (s) {
          return { sampleId: s.sampleId, sampleName: s.sampleName };
        }),
        testMode: 'production'
      });
    } catch (e) {
      console.error('[MODERN_AI] request failed', e && e.message);
    }
    if (aiResult && aiResult.__noFace) {
      showModernAIFailedOverlay('REAL MODERN AI FAILED\n未检测到可归档面部 · visionCheck.hasFace=false');
      return { ok: false, source: 'no-face', error: 'no-face-detected' };
    }
    if (aiResult && aiResult.__failed) {
      // ★ 上游拒绝（422 image sensitive）或网络失败（502）· 严格模式：直接失败，不 fallback
      var failMsg = 'REAL MODERN AI FAILED\n上游 HTTP ' + aiResult.httpStatus + ' · ' + (aiResult.error || 'unknown');
      if (aiResult.failedImageSlot) failMsg += '\n失败图像槽位：' + aiResult.failedImageSlot;
      if (aiResult.upstreamMessage) failMsg += '\n上游消息：' + String(aiResult.upstreamMessage).slice(0, 200);
      console.error('[MODERN_AI] REAL AI FAILED', aiResult);
      showModernAIFailedOverlay(failMsg);
      return { ok: false, source: 'error', error: aiResult.error || 'upstream-rejected', httpStatus: aiResult.httpStatus };
    }
    if (!aiResult || !isValidModernAIResult(aiResult)) {
      if (MODERN_AI_STRICT_TEST) {
        console.error('[MODERN_AI] STRICT MODE · no local fallback · showing REAL MODERN AI FAILED');
        showModernAIFailedOverlay('REAL MODERN AI FAILED\n请求未返回合法 sampleId');
        return { ok: false, source: 'error', error: 'ai-invalid-result' };
      }
      console.warn('[MODERN_AI] using local fallback');
      var local = runModernLocalAnalysis();
      if (!local) { showModernAIFailedOverlay('REAL MODERN AI FAILED\n本地样本缺失'); return null; }
      var fbViewModel = buildModernViewModel({
        sampleId: local.sampleId,
        shortReason: local.matchReasonLine,
        confidence: local.confidence,
        matchedFeatures: local.matchedFeatures,
        source: 'local_fallback',
        visionCheck: { hasFace: true, wearingGlasses: false, headPose: 'unclear', framing: 'unclear', brightness: 'unclear' }
      });
      if (typeof window.showResultOverlay === 'function') window.showResultOverlay('modern');
      await fillModernIframeWhenReady(fbViewModel);
      console.log('[MODERN_FLOW] final result', fbViewModel.sampleId, fbViewModel.sampleName, 'local_fallback');
      return fbViewModel;
    }
    var aiForVm = {
      sampleId: aiResult.sampleId,
      shortReason: aiResult.shortReason,
      confidence: aiResult.confidence,
      matchedFeatures: aiResult.matchedFeatures || [],
      source: 'ai',
      visionCheck: aiResult.visionCheck || { hasFace: true, wearingGlasses: false, headPose: 'unclear', framing: 'unclear', brightness: 'unclear' },
      // ★ 把服务端给的 dimensionReasons + reasonSource 透传 · 供 buildModernViewModel 内部 pickReason 用
      dimensionReasons: aiResult.dimensionReasons || {},
      reasonSource: aiResult.reasonSource || 'ai-personalized'
    };
    var viewModel = buildModernViewModel(aiForVm);
    // ★ 把本轮用户帧也写进 viewModel · 融合模块需要
    viewModel.userImage = dataUrl;
    viewModel.reasonSource = aiForVm.reasonSource;
    viewModel.dimensionReasons = aiForVm.dimensionReasons;
    window.__lastLockedUserImage = dataUrl;
    console.log('[MODERN_VIEW_MODEL] built', viewModel.sampleId, '· userImage bytes=' + (viewModel.userImage || '').length);
    console.log('[MODERN_FLOW] final result', viewModel.sampleId, viewModel.sampleName, 'ai · reasonSource=' + viewModel.reasonSource);
    console.log('[MODERN_REASON_RENDER] source=' + viewModel.reasonSource + ' · count=' + (aiForVm.dimensionReasons ? Object.keys(aiForVm.dimensionReasons).filter(function (k) { return typeof aiForVm.dimensionReasons[k] === 'string' && aiForVm.dimensionReasons[k].trim().length >= 4; }).length : 0) + '/6');
    window.pendingModernResult = viewModel;
    if (typeof window.showResultOverlay === 'function') window.showResultOverlay('modern');
    await fillModernIframeWhenReady(viewModel);
    return viewModel;
  }

  // ★ 静态预览入口 · 不调 AI · 直接构造 viewModel 并填 iframe
  function previewModernSample(sampleId) {
    var sample = getModernSampleById(sampleId);
    if (!sample) { console.error('[MODERN_PREVIEW] unknown sampleId', sampleId); return null; }
    var aiForVm = {
      sampleId: sampleId,
      shortReason: sample.defaultMatchReason || '',
      confidence: 'medium',
      matchedFeatures: sample.tags || [],
      source: 'preview',
      visionCheck: { hasFace: true, wearingGlasses: false, headPose: 'unclear', framing: 'unclear', brightness: 'unclear' }
    };
    var viewModel = buildModernViewModel(aiForVm);
    if (typeof window.showResultOverlay === 'function') window.showResultOverlay('modern');
    return fillModernIframeWhenReady(viewModel);
  }

  // ★ 20 样本回归
  async function runModernSampleRegressionTest() {
    var samples = window.MODERN_LOCAL_SAMPLES || [];
    var pass = 0, imagePass = 0, fieldPass = 0;
    console.log('[MODERN_TEST] starting regression · ' + samples.length + ' samples');
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      try {
        var vm = buildModernViewModel({
          sampleId: s.sampleId,
          shortReason: s.defaultMatchReason || 'preview',
          confidence: 'medium',
          matchedFeatures: s.tags || [],
          source: 'preview',
          visionCheck: { hasFace: true, wearingGlasses: false, headPose: 'unclear', framing: 'unclear', brightness: 'unclear' }
        });
        // field check
        var fieldOk = true;
        for (var k = 0; k < STRICT_REQUIRED_FIELDS.length; k++) {
          var key = STRICT_REQUIRED_FIELDS[k];
          var v = vm[key];
          if (key === 'evidenceImages') { if (!v || !v.main || !v.alt || !v.context || !v.archive) { fieldOk = false; break; } continue; }
          if (key === 'visionCheck') { if (!v || typeof v.hasFace !== 'boolean') { fieldOk = false; break; } continue; }
          if (typeof v !== 'string' || !v.trim()) { fieldOk = false; break; }
        }
        if (fieldOk) fieldPass++;
        // image existence check
        var imgOk = true;
        for (var slot of ['main','alt','context','archive']) {
          // fetch HEAD to confirm 200
          try {
            var xhr = new XMLHttpRequest();
            xhr.open('HEAD', vm.evidenceImages[slot], false);
            xhr.send();
            if (xhr.status !== 200) { imgOk = false; break; }
          } catch (e) { imgOk = false; break; }
        }
        if (imgOk) imagePass++;
        if (fieldOk && imgOk) {
          pass++;
          console.log('[MODERN_TEST] OK', s.sampleId, s.sampleName, '· images 4/4 · fields ' + STRICT_REQUIRED_FIELDS.length + '/' + STRICT_REQUIRED_FIELDS.length);
        } else {
          console.error('[MODERN_TEST] FAIL', s.sampleId, s.sampleName, '· fieldOk=' + fieldOk + ' · imgOk=' + imgOk);
        }
      } catch (e) {
        console.error('[MODERN_TEST] ERROR', s.sampleId, e.message);
      }
    }
    var msg = 'MODERN REGRESSION ' + pass + '/' + samples.length + ' PASS · IMAGE CHECK ' + imagePass + '/' + (samples.length * 4) + ' PASS · FIELD CHECK ' + fieldPass + '/' + samples.length + ' PASS';
    console.log('[MODERN_TEST]', msg);
    return msg;
  }

  // expose
  window.ENABLE_MODERN_AI_ANALYSIS = ENABLE_MODERN_AI_ANALYSIS;
  window.MODERN_AI_MODE = MODERN_AI_MODE;
  window.MODERN_AI_STRICT_TEST = MODERN_AI_STRICT_TEST;
  window.MODERN_AI_TIMEOUT_MS = MODERN_AI_TIMEOUT_MS;

  // ★ 用户主动取消当前 modern 请求（仅由"返回摄像头"按钮触发）
  window.cancelModernRequest = function (reason) {
    if (modernRequestController && !modernRequestController.signal.aborted) {
      traceModernAbort(modernRequestController, reason || 'user-cancel');
    }
  };

  // ★ P0-8：刷新页面后清空结果状态 + 隐藏失败遮罩
  function resetResultStateOnBoot() {
    window.pendingModernResult = null;
    window.lastModernResult = null;
    window.selectedModernSampleId = null;
    window.pendingAncientResult = null;
    window.lastAncientResult = null;
    var failed = document.getElementById('modernAIFailedOverlay');
    if (failed) { failed.hidden = true; failed.style.display = 'none'; }
    var ancientFailed = document.getElementById('ancientAIFailedOverlay');
    if (ancientFailed) { ancientFailed.hidden = true; ancientFailed.style.display = 'none'; }
    var resultLayer = document.getElementById('result-layer');
    if (resultLayer) { resultLayer.style.display = 'none'; resultLayer.classList.remove('is-active'); resultLayer.innerHTML = ''; }
    document.body.classList.remove('result-open', 'modern-failed', 'ancient-failed');
    window.currentView = 'camera';
    console.log('[BOOT] resetResultStateOnBoot done');
  }
  window.resetResultStateOnBoot = resetResultStateOnBoot;
  // ★ 立即在脚本加载后执行一次
  try { resetResultStateOnBoot(); } catch (e) { console.warn('[BOOT] reset err:', e && e.message); }
  window.MODERN_ASSET_ROOT = MODERN_ASSET_ROOT;
  window.getModernImagePath = getModernImagePath;
  window.getModernSampleById = getModernSampleById;
  window.buildModernViewModel = buildModernViewModel;
  window.runModernAIAnalysis = runModernAIAnalysis;
  window.analyzeModernSampleWithAI = analyzeModernSampleWithAI;
  window.buildModernAIPayload = buildModernAIPayload;
  window.buildModernResultFromSampleIdV2 = buildModernResultFromSampleIdV2;
  window.runModernLocalAnalysis = runModernLocalAnalysis;
  window.fillModernIframeWhenReady = fillModernIframeWhenReady;
  window.showModernLoadingOverlay = showModernLoadingOverlay;
  window.showModernAIFailedOverlay = showModernAIFailedOverlay;
  window.previewModernSample = previewModernSample;
  window.runModernSampleRegressionTest = runModernSampleRegressionTest;
})();
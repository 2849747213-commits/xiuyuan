// ============================================
// fusion-handler.js · 共享的 fusion 路由处理工厂
// - 支持 ancient / modern / western 三套系统
// - 严格遵循 ancient 既有行为 + 共享 image-proxy
// - 路由前缀自动兼容 /api/fusion/<system> 和 /exhibition-camera/api/fusion/<system>
// ============================================
const path = require('path');
const fs = require('fs');
const fusionProvider = require('./ancient-fusion-provider');
const minimaxImage = require('./minimax-image-provider');
const imageProxy = require('./image-proxy');

function _safeHostForLog(u) {
  try { const x = new URL(u); return x.host + x.pathname.slice(0, 60); } catch (e) { return 'invalid'; }
}

const SAMPLE_RANGES = {
  ancient: { re: /^A(0[1-9]|1[0-6])$/, map: minimaxImage.ANCIENT_SAMPLE_NAMES, dir: 'ancient', fileTpl: '{id}_sample_main.jpg', fallbackLabel: 'Axx' },
  modern:  { re: /^M(0[1-9]|1[0-9]|20)$/, map: minimaxImage.MODERN_SAMPLE_NAMES, dir: 'modern', fileTpl: '{id}_sample_main.jpg', fallbackLabel: 'Mxx' },
  western: { re: /^W(0[1-9]|1[0-4])$/, map: minimaxImage.WESTERN_SAMPLE_NAMES, dir: 'western', fileTpl: '{id}_sample_main.jpg', fallbackLabel: 'Wxx' }
};

// ★ 优先用 window.SAMPLE 上的中文名（若该样本存在于 modern local / western local）
function resolveSampleName(system, sampleId) {
  const def = SAMPLE_RANGES[system] || SAMPLE_RANGES.ancient;
  let map = def.map;
  if (system === 'modern' && typeof window !== 'undefined' && window.MODERN_LOCAL_SAMPLES) {
    const s = window.MODERN_LOCAL_SAMPLES.find(function (x) { return x.sampleId === sampleId; });
    if (s && s.sampleName) return s.sampleName;
  }
  if (system === 'western' && typeof window !== 'undefined' && window.WESTERN_14_SAMPLES) {
    const s = window.WESTERN_14_SAMPLES.find(function (x) { return x.sampleId === sampleId; });
    if (s && (s.sampleNameEn || s.sampleName)) return s.sampleNameEn || s.sampleName;
  }
  return (map && map[sampleId]) || def.fallbackLabel;
}

// ============================================
// 工厂：返回一个 (req, res) 处理函数
// ============================================
function createFusionHandler(opts) {
  const system = (opts && opts.system) || 'ancient';
  const cfg = SAMPLE_RANGES[system];
  if (!cfg) throw new Error('unknown system: ' + system);

  const MAX_FUSION_BODY = 8 * 1024 * 1024; // 8MB
  const LABEL = 'FUSION_' + system.toUpperCase();

  return function handleFusion(req, res) {
    let body = '';
    let bodyLen = 0;
    req.on('data', c => {
      bodyLen += c.length;
      if (bodyLen > MAX_FUSION_BODY) {
        try { req.destroy(); } catch (e) {}
        if (!res.headersSent) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, source: 'error', error: 'payload-too-large', message: '请求体超过 8MB 限制' }));
        }
        return;
      }
      body += c;
    });
    req.on('end', async () => {
      console.log('[' + LABEL + '] POST /api/fusion/' + system + ' · body bytes =', body.length);
      let input;
      try { input = JSON.parse(body); } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-json', message: 'JSON 解析失败' }));
      }

      // 1. 校验 sampleId
      const sampleId = (input && typeof input.sampleId === 'string') ? input.sampleId.trim() : '';
      if (!cfg.re.test(sampleId)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-sample-id', message: 'sampleId 必须是 ' + (system === 'ancient' ? 'A01-A16' : system === 'modern' ? 'M01-M20' : 'W01-W14') }));
      }

      // 2. 校验 userImage 是合法 data URL
      const userImage = (input && typeof input.userImage === 'string') ? input.userImage : '';
      const m = userImage.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
      if (!m) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-user-image', message: 'userImage 必须是 png/jpeg/webp 的 data URL' }));
      }
      const userBase64 = m[2];
      if (userBase64.length < 1024) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-user-image', message: '用户图过小或为空' }));
      }

      // 3. 校验 requestId
      const requestId = (input && typeof input.requestId === 'string' && /^fusion_[A-Za-z0-9_-]{1,80}$/.test(input.requestId))
        ? input.requestId
        : ('fusion_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

      // 4. Provider Adapter 选 Key · Model
      const keyPick = fusionProvider.pickImageApiKey();
      if (!keyPick.key) {
        console.log('[' + LABEL + '] no usable API key · return 503');
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'error',
          error: 'image-provider-not-configured',
          message: '融合生成服务尚未连接',
          hint: '请在 Vercel / .env 配置 IMAGE_API_KEY · 或保留现有 AI_API_KEY (与文本分类共用同一 Key)'
        }));
      }
      const IMAGE_BASE_URL = fusionProvider.pickImageBaseUrl();
      const IMAGE_MODEL = fusionProvider.pickImageModel();
      console.log('[' + LABEL + '] using key source =', keyPick.source, '· baseUrl =', IMAGE_BASE_URL, '· model =', IMAGE_MODEL);

      // 5. 读取 sample main 图
      const DIRECTORY = opts.directory;
      const sampleMainFile = cfg.fileTpl.replace('{id}', sampleId);
      const sampleMainPath = path.join(DIRECTORY, 'assets', 'sample-library', cfg.dir, 'normalized', sampleId, sampleMainFile);
      // ★ modern: sample 路径不一样（normalized/{id}_sample_main.jpg 直接放在 modern/normalized/ 根）
      // ★ ancient: 根目录下 A01_sample_main.jpg
      // ★ western: 在 normalized/W05/W05_sample_main.jpg
      let sampleBase64 = '';
      let sampleReadOk = false;
      // ★ 多种路径尝试（兼容不同系统的目录结构）
      const pathCandidates = system === 'ancient'
        ? [path.join(DIRECTORY, 'assets', 'sample-library', 'ancient', sampleId + '_sample_main.jpg')]
        : system === 'western'
          ? [
              path.join(DIRECTORY, 'assets', 'sample-library', 'western', 'normalized', sampleId, sampleId + '_sample_main.jpg'),
              path.join(DIRECTORY, 'assets', 'sample-library', 'western', sampleId + '_sample_main.jpg')
            ]
          : [ // modern
              path.join(DIRECTORY, 'assets', 'sample-library', 'modern', 'normalized', sampleId + '_sample_main.jpg'),
              path.join(DIRECTORY, 'assets', 'sample-library', 'modern', sampleId + '_sample_main.jpg')
            ];
      for (const p of pathCandidates) {
        try {
          if (fs.existsSync(p)) {
            const buf = fs.readFileSync(p);
            sampleBase64 = buf.toString('base64');
            sampleReadOk = true;
            break;
          }
        } catch (e) { /* keep trying */ }
      }
      if (!sampleReadOk) {
        console.log('[' + LABEL + '] sample main image not found · tried ' + pathCandidates.length + ' paths');
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'sample-image-not-found', message: '样本主图缺失 · ' + sampleId, sampleId: sampleId, triedPaths: pathCandidates.map(function (p) { return p.replace(DIRECTORY, '~'); }) }));
      }

      // 6. 构造 prompt
      const sampleName = (opts && typeof opts.resolveSampleName === 'function')
        ? opts.resolveSampleName(sampleId)
        : (cfg.map[sampleId] || cfg.fallbackLabel);
      const fusionPrompt = minimaxImage.buildPrompt(sampleId, sampleName, system);
      console.log('[' + LABEL + '] call provider=' + minimaxImage.providerId + ' model=' + IMAGE_MODEL + ' sampleId=' + sampleId + ' requestId=' + requestId + ' userImage bytes=' + userBase64.length);

      // 7. 调 MiniMax image-01
      const startTs = Date.now();
      let upstream;
      try {
        upstream = await minimaxImage.callUpstream({
          baseUrl: IMAGE_BASE_URL,
          apiKey: keyPick.key,
          model: IMAGE_MODEL,
          prompt: fusionPrompt,
          userImageDataUrl: userImage,
          timeoutMs: 90 * 1000
        });
      } catch (e) {
        console.error('[' + LABEL + '] upstream err', e.message);
        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false, source: 'error', error: 'image-provider-timeout',
          message: '融合服务调用超时 · 请稍后重试',
          requestId: requestId, sampleId: sampleId
        }));
      }

      const elapsed = Date.now() - startTs;
      console.log('[' + LABEL + '] upstream status', upstream.status, 'elapsed', elapsed + 'ms');

      if (upstream.status < 200 || upstream.status >= 300) {
        let errBody = upstream.body || '';
        let errShort = errBody.length > 300 ? errBody.slice(0, 300) + '...' : errBody;
        let code = 'image-provider-rejected';
        if (upstream.status === 429) code = 'image-provider-rate-limit';
        if (upstream.status === 401 || upstream.status === 403) code = 'image-provider-unauthorized';
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false, source: 'error', error: code,
          message: '融合服务未返回有效图片（HTTP ' + upstream.status + '）',
          upstreamStatus: upstream.status,
          upstreamShort: errShort,
          requestId: requestId, sampleId: sampleId
        }));
      }

      // 8. 解析 Provider 响应
      const parsedResult = minimaxImage.parseUpstream(upstream.body);
      if (!parsedResult.ok) {
        console.error('[' + LABEL + '] parse failed ·', parsedResult.error, '·', parsedResult.message);
        let httpCode = 502;
        if (parsedResult.error === 'image-generation-failed') httpCode = 502;
        if (parsedResult.error === 'invalid-image-response') httpCode = 502;
        res.statusCode = httpCode;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(Object.assign({
          requestId: requestId,
          sampleId: sampleId,
          source: 'error'
        }, parsedResult)));
      }

      const imageUrl = parsedResult.imageUrl || null;
      let imageDataUrl = parsedResult.imageDataUrl || null;
      const successCount = parsedResult.successCount || 0;
      const failedCount = parsedResult.failedCount || 0;

      console.log('[' + LABEL + '] SUCCESS · sampleId=' + sampleId + ' · success=' + successCount + ' failed=' + failedCount + ' · hasUrl=' + !!imageUrl + ' hasB64=' + !!imageDataUrl);

      // 9. 共享 image-proxy：转 base64 data URL
      // ★ 关键：不把供应商临时 OSS URL 透传给浏览器（可能被 GFW 屏蔽 / 临时失效）
      //   - 如果 imageDataUrl 已由上游直出 → 直接用
      //   - 如果只有 imageUrl → 后端 image-proxy 下载 + base64
      //   - 失败时返回 ok=false · 让前端走 sample 库兜底图，不要直接命中 OSS
      let proxyWarning = null;
      if (imageUrl && !imageDataUrl) {
        console.log('[' + LABEL + '] need image proxy · url=' + _safeHostForLog(imageUrl));
        const proxy = await imageProxy.downloadImageAsDataUrl(imageUrl, { requestId: requestId, label: 'FUSION_' + system.toUpperCase() + '_IMG' });
        if (proxy.ok) {
          imageDataUrl = proxy.imageDataUrl;
          // ★ 删除 fallbackImageUrl 透传 · 即使 proxy 超大也返回 ok=false，由前端降级
          proxyWarning = proxy.warning || null;
        } else {
          console.log('[' + LABEL + '] image proxy failed · error=' + proxy.error + ' · reason=' + (proxy.reason || '') + ' · returning ok=false');
          // ★ 关键：失败时不返回 imageUrl 给浏览器（避免供应商 OSS 命中 / GFW 屏蔽）
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({
            ok: false,
            source: 'image-proxy-failed',
            error: proxy.error || 'image-proxy-failed',
            reason: proxy.reason || '',
            sampleId: sampleId,
            sampleName: sampleName,
            successCount: successCount,
            failedCount: failedCount,
            elapsedMs: elapsed,
            requestId: requestId,
            note: '供应商图片代理失败 · 请重试 · 前端会显示 sample 库兜底图'
          }));
        }
      }

      if (!imageDataUrl) {
        // 既无 base64 也无 URL → 视为失败 · 不返回 imageUrl
        console.log('[' + LABEL + '] no usable image data · returning ok=false');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'no-image-data',
          error: 'no-image-data',
          sampleId: sampleId,
          sampleName: sampleName,
          successCount: successCount,
          failedCount: failedCount,
          elapsedMs: elapsed,
          requestId: requestId,
          note: '未获得可用图片数据 · 前端会显示 sample 库兜底图'
        }));
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const out = {
        ok: true,
        source: 'ai-image',
        system: system,
        requestId: requestId,
        sampleId: sampleId,
        sampleName: sampleName,
        elapsedMs: elapsed,
        successCount: successCount,
        failedCount: failedCount
      };
      // ★ 只透出 imageDataUrl · 绝不把供应商 imageUrl 发给浏览器
      out.imageDataUrl = imageDataUrl;
      if (proxyWarning) out.warning = proxyWarning;
      return res.end(JSON.stringify(out));
    });
  };
}

module.exports = {
  createFusionHandler: createFusionHandler,
  resolveSampleName: resolveSampleName
};

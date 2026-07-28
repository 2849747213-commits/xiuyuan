// ============================================
// BIAS SYSTEM · LIVE CLASSIFICATION · 展览版
// 全局函数 · 不依赖 ES module
// 依赖：window.AIClient.callAI · window.ImageReader.readImageFromDataUrl
// ============================================
const $ = (id) => document.getElementById(id);
// ★ 全局 AI 开关：false 时所有 AI / xapi / fetch 直接短路返回 null · 不发任何网络请求
window.ENABLE_AI_ANALYSIS = false;
// ★ 旧版 AIClient 健康检查（xapi.yhcj.com/version 等）总开关 · 默认禁用
window.DISABLE_LEGACY_AI_HEALTH_CHECK = true;
const callAI = function(input, settings) {
  if (!window.ENABLE_AI_ANALYSIS) {
    console.log('[AI DISABLED] skip AI call');
    return Promise.resolve(null);
  }
  if (!window.AIClient || !window.AIClient.callAI) {
    return Promise.reject(new Error('window.AIClient.callAI 不存在 · 请确认 ai-client.js 已加载'));
  }
  return window.AIClient.callAI(input, settings);
};
const readImageFromDataUrl = function(dataUrl, fileName, fileSize) {
  if (!window.ImageReader || !window.ImageReader.readImageFromDataUrl) {
    console.warn('[v3x] window.ImageReader 不存在 · 用最简 fallback');
    return Promise.resolve({
      width: 0, height: 0, aspect: 0, faceCount: 0,
      dominantColors: [[128, 128, 128]], caption: ''
    });
  }
  return window.ImageReader.readImageFromDataUrl(dataUrl, fileName, fileSize);
};

// 检查依赖
if (!window.AIClient) console.error('[v3x] window.AIClient 未加载！请检查 ai-client.js 路径');
else console.log('[v3x] window.AIClient 已加载');

// ============================================
// 状态
// ============================================
let cameraStream = null;
let cameraDetectTimer = null;
let cameraFrameState = 'waiting';   // waiting / detected / ready / analyzing / captured
let currentSample = null;
let captureCount = 0;
let lastDetectTime = 0;
let detectFrames = 0;
let lastFpsTime = 0;
let currentFps = 0;

// ============================================
// 独立检测 canvas（160×120 低分辨率）
// ============================================
const detectCanvas = document.createElement('canvas');
detectCanvas.width = 160;
detectCanvas.height = 120;
const detectCtx = detectCanvas.getContext('2d', { willReadFrequently: true });

// 全分辨率截图 canvas
const captureCanvas = document.createElement('canvas');
let captureCtx = null;

// ============================================
// 启动 · 只调用一次
// ============================================

// ★ 显式追踪所有未处理的 Promise rejection（不静默 · 不阻止 · 仅记录 stack）
if (typeof window !== "undefined" && typeof window.addEventListener === "function" && !window.__unhandledRejectionInstalled) {
  window.addEventListener("unhandledrejection", function (ev) {
    var reason = ev && ev.reason;
    var msg = (reason && (reason.message || reason)) || "(no reason)";
    console.warn("[UNHANDLED_PROMISE]", msg);
    if (reason && reason.stack) {
      // 只输出前 4 行避免刷屏
      var lines = String(reason.stack).split("\n").slice(0, 4).join("\n");
      console.warn("[UNHANDLED_PROMISE] stack · first 4 lines:\n" + lines);
    }
    if (msg && String(msg).indexOf("LEGACY_AI_DISABLED") >= 0) {
      console.warn("[UNHANDLED_PROMISE] this is a blocked legacy xapi call · see [LEGACY_AI] trace above");
    }
  });
  window.__unhandledRejectionInstalled = true;
}
window.addEventListener('unhandledrejection', function(ev) {
  try {
    const r = ev.reason;
    if (r && r.message) console.warn('[GLOBAL] unhandledrejection (silenced):', r.message);
    else console.warn('[GLOBAL] unhandledrejection (silenced):', r);
  } catch (e) {}
  ev.preventDefault();
});
window.addEventListener('error', function(ev) {
  try {
    if (ev && ev.message) console.warn('[GLOBAL] error (silenced):', ev.message);
  } catch (e) {}
});

let _booted = false;
function boot() {
  if (_booted) {
    console.log('[BOOT] already booted · skip');
    return;
  }
  _booted = true;
  console.log('[BOOT] boot start');

  // ★ 初始化全局唯一人脸状态源
  window.currentFaceState = {
    detected: false,
    points: [],
    landmarkCount: 0,
    updatedAt: 0
  };
  console.log('[BOOT] currentFaceState initialized');

  // ★ 顶部时间 · 一次性绑定 · 不再重复
  setInterval(() => {
    const tEl = $('v3xTime');
    if (!tEl) return;
    const d = new Date();
    tEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, 1000);

  // ★ 尝试立刻拉摄像头（fire-and-forget · 不 await 避免 boot 阻塞）
  ensureCameraRunning().catch(e => console.warn('[v3x] ensureCameraRunning err', e));

  // ★ 全局键盘 · 一次性绑定
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      // 只在 camera view + ready 状态触发
      if (window.SPA && window.SPA.currentView === 'camera' && cameraFrameState === 'ready') {
        useCurrentFrameAndAnalyze();
      }
    }
    // Q 键退出
    if (e.key === 'q' || e.key === 'Q') {
      if (confirm('退出展览？')) quitExhibit();
    }
    // Esc 键返回摄像头（用户友好）
    if (e.key === 'Escape') {
      if (typeof window.resetToCamera === 'function') {
        try { window.resetToCamera(); } catch (e2) { console.warn('[v3x] resetToCamera on Esc failed', e2); }
      }
    }
  });

  // ★ 一次性绑定所有按钮（用 onclick 避免 addEventListener 重复）
  const quitBtn = $('v3xQuit');
  if (quitBtn) quitBtn.onclick = () => { if (confirm('退出展览？')) quitExhibit(); };

  const goBtn = $('v3xGoBtn');
  if (goBtn) goBtn.onclick = useCurrentFrameAndAnalyze;

  const againBtn = $('v3xResultAgain');
  if (againBtn) againBtn.onclick = () => { try { resetToCamera(); } catch (e) {} };

  const closeBtn = $('v3xResultClose');
  if (closeBtn) closeBtn.onclick = () => { try { resetToCamera(); } catch (e) {} };

  // ★ 一次性绑定顶部导航按钮（摄像头 / 路径选择）
  const navCamBtn = $('v3xNavCameraBtn');
  if (navCamBtn) navCamBtn.onclick = () => { try { window.resetToCamera(); } catch (e) {} };

  const navPathBtn = $('v3xNavPathBtn');
  if (navPathBtn) navPathBtn.onclick = () => { try { window.handleStartAnalysis(); } catch (e) {} };

  console.log('[BOOT] boot complete');
}

// ★★ 保证摄像头在跑 · 但不重复 getUserMedia
async function ensureCameraRunning() {
  const video = document.getElementById('v3xVideo');
  if (!video) {
    console.warn('[CAMERA] #v3xVideo not found');
    return;
  }
  if (video.srcObject) {
    const tracks = video.srcObject.getVideoTracks();
    const live = tracks.some(t => t.readyState === 'live');
    if (live) {
      console.log('[CAMERA] reuse existing stream · tracks =', tracks.length);
      return;
    }
  }
  console.log('[CAMERA] start new stream');
  await openCamera();
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function log(text, kind) {
  const el = $('v3xLog');
  const span = document.createElement('span');
  span.className = 'v3x-log__line' + (kind ? ' v3x-log__line--' + kind : '');
  span.textContent = '[' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '] ' + text;
  el.appendChild(span);
  while (el.children.length > 8) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

// ============================================
// 摄像头 · 启动一次 · 永远复用
// ============================================
let _cameraOpening = false;
let _cameraOpened = false;

async function openCamera() {
  const video = $('v3xVideo');
  if (!video) {
    console.error('[v3x] #v3xVideo 元素不存在 · 检查 HTML');
    return;
  }

  // ★ 防重复：已经在打开中 或 已经成功过
  if (_cameraOpening) {
    console.log('[CAMERA] openCamera already in progress · skip');
    return;
  }
  if (_cameraOpened && video.srcObject) {
    const tracks = video.srcObject.getVideoTracks();
    const live = tracks.some(t => t.readyState === 'live');
    if (live) {
      console.log('[CAMERA] reuse existing stream · tracks =', tracks.length);
      return;
    }
    console.log('[CAMERA] existing stream is dead · re-open');
  }

  _cameraOpening = true;
  setState('waiting');
  log('摄像头权限请求中…', '');

  // ★ 简化约束：先 video: true 走通 · 不要写 ideal
  let stream = null;
  let lastErr = null;
  // 尝试 1：最宽松
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    console.log('[v3x] ★ 摄像头已接入（最宽松配置）:', stream);
  } catch (e1) {
    console.warn('[v3x] 最宽松配置失败：', e1.name, e1.message);
    lastErr = e1;
    // 尝试 2：基本配置
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      console.log('[v3x] ★ 摄像头已接入（640×480）:', stream);
    } catch (e2) {
      console.warn('[v3x] 640×480 也失败：', e2.name, e2.message);
      lastErr = e2;
      // 尝试 3：仅 facingMode user
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        });
        console.log('[v3x] ★ 摄像头已接入（facingMode:user）:', stream);
      } catch (e3) {
        console.error('[v3x] ✗ 全部配置都失败：', e3);
        lastErr = e3;
      }
    }
  }

  if (!stream) {
    handleCameraError(lastErr);
    return;
  }

  cameraStream = stream;
  video.srcObject = cameraStream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  // ★ 等 metadata + 真正开始播放
  const waitForReady = new Promise((resolve) => {
    let resolved = false;
    const onMeta = () => {
      if (resolved) return; resolved = true;
      video.removeEventListener('loadedmetadata', onMeta);
      video.play().then(() => {
        console.log('[v3x] ★ video.play() 成功');
        console.log('[v3x] ★ video size =', video.videoWidth, '×', video.videoHeight);
        resolve();
      }).catch((err) => {
        console.warn('[v3x] video.play() 失败:', err);
        resolve();
      });
    };
    video.addEventListener('loadedmetadata', onMeta);
    // 兜底：3 秒后强制继续（即使 metadata 没来）
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener('loadedmetadata', onMeta);
        console.warn('[v3x] metadata 3s 超时 · 强制继续');
        video.play().catch(() => {});
        resolve();
      }
    }, 3000);
  });

  await waitForReady;

  // 等一帧
  await new Promise((r) => requestAnimationFrame(r));

  if (video.videoWidth > 0 && video.videoHeight > 0) {
    log('视频流已就绪 ' + video.videoWidth + '×' + video.videoHeight, 'ok');
  } else {
    console.warn('[v3x] 视频元数据就绪但 videoWidth 仍为 0 · 等待');
    await new Promise((r) => setTimeout(r, 500));
  }
  detectCanvas.width = 160;
  detectCanvas.height = 120;
  startDetectLoop();
  // ★ 启动摄像头画面上的 face scan overlay 点阵动画
  startFaceScanOverlay();
  // ★ 标记已成功打开（防重复 getUserMedia）
  _cameraOpened = true;
  _cameraOpening = false;
  console.log('[CAMERA] openCamera complete · stream is live');
}

// ★★★ Face Scan Overlay · 基于 MediaPipe Face Landmarker 真实关键点（稳定化版）
let _scanRaf = null;
let faceOverlayRunning = false;
let _faceLandmarker = null;
let _faceLandmarkerStatus = 'offline'; // 'offline' | 'loading' | 'ready' | 'error'
let _faceLandmarkerInitStarted = false;
let _lastVideoTime = -1;
let _lastDetectedAt = 0;
let _lastStableLandmarks = null;       // 平滑后的 landmarks
let _smoothedBBox = null;              // {minX,maxX,minY,maxY} 平滑
let _scanLineT0 = 0;                   // 扫描线起算时间（不变更）
let _detectionStreak = 0;              // 连续检测到脸的次数
const SMOOTH_A = 0.82;                  // EMA old 权重
const SMOOTH_B = 0.18;                  // EMA new 权重
const DETECT_HOLD_MS = 300;             // 失去脸后保留时间
const DETECT_STREAK_TO_CONFIRM = 3;     // 连续几次才显示 FACE DETECTED
const DETECT_INTERVAL_MS = 80;          // ≈12.5fps 检测
let _lastDetectMs = 0;
const FACE_MODEL_URL = '/vendor/mediapipe/face_landmarker.task';
const FACE_WASM_BASE = '/vendor/mediapipe/wasm';

async function _initFaceLandmarker() {
  if (_faceLandmarker) return _faceLandmarker;
  if (_faceLandmarkerInitStarted) return _faceLandmarker;
  _faceLandmarkerInitStarted = true;
  _faceLandmarkerStatus = 'loading';
  try {
    // ★ 多源 fallback 链 · 优先本地 vendor · 然后 unpkg · 最后 jsdelivr
    const VISION_SOURCES = [
      '/vendor/mediapipe/vision_bundle.mjs',
      'https://unpkg.com/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs',
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
    ];
    let visionMod = null;
    let lastErr = null;
    for (const url of VISION_SOURCES) {
      try {
        console.log('[3vx] FaceLandmarker load · try', url);
        visionMod = await import(/* @vite-ignore */ url);
        if (visionMod) { console.log('[3vx] FaceLandmarker load OK ·', url); break; }
      } catch (e) {
        console.warn('[3vx] FaceLandmarker source fail ·', url, e && e.message);
        lastErr = e;
      }
    }
    if (!visionMod) throw lastErr || new Error('all sources failed');
    const { FilesetResolver, FaceLandmarker } = visionMod;
    // ★ 注入官方连接常量（与 FaceLandmarker 同一套）
    if (!_loadOfficialFaceConnections(FaceLandmarker) && typeof window !== 'undefined') {
      // 兜底：尝试从 window 读旧版
      _loadOfficialFaceConnections(window);
    }
    // ★ 优先用本地 WASM，失败时再回退到 unpkg
    let fileset = null;
    try {
      fileset = await FilesetResolver.forVisionTasks(FACE_WASM_BASE);
      console.log('[3vx] FaceLandmarker WASM · local OK', FACE_WASM_BASE);
    } catch (e) {
      console.warn('[3vx] local WASM fail, fallback unpkg', e && e.message);
      fileset = await FilesetResolver.forVisionTasks('https://unpkg.com/@mediapipe/tasks-vision@0.10.18/wasm');
    }
    _faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    });
    _faceLandmarkerStatus = 'ready';
    console.log('[v3x] FaceLandmarker ready · official connections:', _FACE_CONN.tesselation ? _FACE_CONN.tesselation.length : 0, 'tess');
  } catch (e) {
    _faceLandmarkerStatus = 'error';
    console.warn('[v3x] FaceLandmarker load failed:', e);
  }
  return _faceLandmarker;
}

function startFaceScanOverlay() {
  const canvas = document.getElementById('v3xScanOverlay');
  const hud = document.getElementById('v3xScanHud');
  if (!canvas) return;
  if (faceOverlayRunning) return;       // ★ 防止多 loop
  faceOverlayRunning = true;
  if (_scanRaf) { cancelAnimationFrame(_scanRaf); _scanRaf = null; }

  const ctx = canvas.getContext('2d');
  const video = document.getElementById('v3xVideo');
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    if (!video) return;
    const r = video.getBoundingClientRect();
    const cw = r.width || canvas.parentElement.clientWidth || 640;
    const ch = r.height || canvas.parentElement.clientHeight || 360;
    canvas.width = Math.max(320, Math.floor(cw * dpr));
    canvas.height = Math.max(240, Math.floor(ch * dpr));
    canvas.style.position = 'absolute';
    canvas.style.left = r.left + 'px';
    canvas.style.top = r.top + 'px';
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
  }
  // ★ video 元素在窗口中位置变化（顶栏 / 状态卡出现 / 窗口 resize）→ 同步 canvas
  if (video) {
    if (window.ResizeObserver) {
      try {
        const ro = new ResizeObserver(() => resize());
        ro.observe(video);
      } catch (e) { /* noop */ }
    }
    video.addEventListener('loadedmetadata', resize);
  }
  resize();
  window.addEventListener('resize', resize);

  // ★ 重置平滑状态（避免上一次残留抖动）
  _lastStableLandmarks = null;
  _smoothedBBox = null;
  _detectionStreak = 0;
  _scanLineT0 = performance.now();
  document.body.classList.add('face-mesh-on');

  setFacePanel('searching', 0);
  if (hud) {
    hud.textContent = '▌ SEARCHING FACE · 等待面部样本';
    hud.style.borderColor = '#f5d400'; hud.style.color = '#f5d400'; hud.style.background = 'rgba(0,0,0,0.55)';
  }

  _initFaceLandmarker();

  function loop(now) {
    const W = canvas.width, H = canvas.height;
    const cw = canvas.clientWidth || W / dpr;
    const ch = canvas.clientHeight || H / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // ★ 重新对齐 canvas 到 video 当前位置（顶栏 / topbar 时间变化会推 video）
    if (video) {
      const r = video.getBoundingClientRect();
      if (canvas.style.left !== (r.left + 'px') || canvas.style.top !== (r.top + 'px') ||
          canvas.style.width !== (r.width + 'px') || canvas.style.height !== (r.height + 'px')) {
        resize();
      }
    }

    // ★ 节流检测（≈12fps）
    let rawLandmarks = null;
    if (
      _faceLandmarkerStatus === 'ready' && _faceLandmarker &&
      video && video.readyState >= 2 && video.videoWidth > 0 &&
      (now - _lastDetectMs) >= DETECT_INTERVAL_MS &&
      video.currentTime !== _lastVideoTime
    ) {
      _lastDetectMs = now;
      _lastVideoTime = video.currentTime;
      try {
        const res = _faceLandmarker.detectForVideo(video, now);
        if (res && res.faceLandmarks && res.faceLandmarks.length > 0) rawLandmarks = res.faceLandmarks[0];
      } catch (e) { /* swallow per-frame */ }
    }

    const nowMs = performance.now();
    if (rawLandmarks && rawLandmarks.length > 0) {
      _lastDetectedAt = nowMs;
      _detectionStreak++;
    } else if (nowMs - _lastDetectedAt > DETECT_HOLD_MS) {
      _detectionStreak = 0;
    }

    // ★ 平滑 landmarks
    if (rawLandmarks && rawLandmarks.length > 0) {
      if (!_lastStableLandmarks || _lastStableLandmarks.length !== rawLandmarks.length) {
        // 首次或点数变了：直接取新值，不做 EMA（避免错位）
        _lastStableLandmarks = rawLandmarks.map(p => ({ x: p.x, y: p.y }));
      } else {
        for (let i = 0; i < rawLandmarks.length; i++) {
          const np = rawLandmarks[i], op = _lastStableLandmarks[i];
          op.x = op.x * SMOOTH_A + np.x * SMOOTH_B;
          op.y = op.y * SMOOTH_A + np.y * SMOOTH_B;
        }
      }
    }

    // ★ 平滑 bbox
    let bbox = null;
    if (_lastStableLandmarks && _lastStableLandmarks.length > 0) {
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const p of _lastStableLandmarks) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      if (!_smoothedBBox) {
        _smoothedBBox = { minX, minY, maxX, maxY };
      } else {
        const b = _smoothedBBox;
        b.minX = b.minX * SMOOTH_A + minX * SMOOTH_B;
        b.minY = b.minY * SMOOTH_A + minY * SMOOTH_B;
        b.maxX = b.maxX * SMOOTH_A + maxX * SMOOTH_B;
        b.maxY = b.maxY * SMOOTH_A + maxY * SMOOTH_B;
      }
      bbox = _smoothedBBox;
    }

    // ★ hold 内仍显示稳定点；超过 hold 才真正切回 SEARCHING
    const stillHave = (nowMs - _lastDetectedAt) <= DETECT_HOLD_MS;
    const confirmed = _detectionStreak >= DETECT_STREAK_TO_CONFIRM;

    if (bbox && (confirmed || stillHave)) {
      drawDetectedFace(ctx, cw, ch, bbox, now, _lastStableLandmarks, _detectionStreak);
      const n = _lastStableLandmarks ? _lastStableLandmarks.length : 0;
      if (hud) {
        var displayN = (window.currentFaceState && window.currentFaceState.landmarkCount) || n;
        hud.textContent = '▌ FACE DETECTED · 目标已锁定 · ' + displayN + ' pts';
        hud.style.borderColor = '#22c55e'; hud.style.color = '#86efac'; hud.style.background = 'rgba(0,40,10,0.55)';
      }
      // ★ 写入唯一全局人脸状态源（UI 显示与 capture 都从此读取）
      try {
        window.currentFaceState = {
          detected: n >= 100,
          points: (_lastStableLandmarks || []).map(function (p) {
            return { x: Number(p.x), y: Number(p.y), z: Number(p.z || 0) };
          }),
          landmarkCount: n,
          updatedAt: Date.now()
        };
      } catch (e) { /* swallow */ }
      setFacePanel('detected', n);
      if (cameraFrameState !== 'analyzing' && cameraFrameState !== 'captured' && confirmed) setState('ready');
    } else {
      drawSearching(ctx, cw, ch, now);
      if (_faceLandmarkerStatus === 'error' || _faceLandmarkerStatus === 'offline') {
        if (hud) { hud.textContent = '▌ FACE MODULE OFFLINE · 检测模块不可用'; hud.style.borderColor = '#d60000'; hud.style.color = '#ff8a8a'; hud.style.background = 'rgba(40,0,0,0.55)'; }
      } else {
        if (hud) { hud.textContent = '▌ SEARCHING FACE · 等待面部样本'; hud.style.borderColor = '#f5d400'; hud.style.color = '#f5d400'; hud.style.background = 'rgba(0,0,0,0.55)'; }
      }
      setFacePanel('searching', 0);
      if (cameraFrameState === 'ready') setState('detected');
    }

    _scanRaf = requestAnimationFrame(loop);
  }
  _scanRaf = requestAnimationFrame(loop);
}

function setFacePanel(state, n) {
  const det = state === 'detected';
  const statusTitle = document.getElementById('v3xStatusTitle');
  const statusSub = document.getElementById('v3xStatusSub');
  if (statusTitle) statusTitle.textContent = det ? '当前帧可用于归类' : '当前帧不可归类';
  if (statusSub) statusSub.textContent = det ? '目标已锁定：是 · FACE: detected · POINTS: ' + n : '目标已锁定：否 · FACE: searching';
  const actionTitle = document.getElementById('v3xActionTitle');
  const actionSub = document.getElementById('v3xActionSub');
  if (actionTitle) actionTitle.textContent = det ? '当前帧可用于归类' : '当前帧不可归类';
  if (actionSub) actionSub.textContent = det ? '目标已锁定 · 可直接生成' : '目标已锁定：否';
  const btn = document.getElementById('v3xGoBtn');
  if (btn) btn.disabled = !det;
  const kicker = document.getElementById('v3xActionKicker');
  if (kicker) kicker.textContent = det ? '▌ 目标已锁定' : '▌ 等待可归类对象';
  const frame = document.getElementById('v3xFrame') || document.querySelector('.v3x-frame');
  if (frame) {
    frame.classList.toggle('is-detected', det);
    frame.classList.toggle('is-ready', det);
  }
}

// ★ video 的实际显示区域（处理 object-fit: cover 偏移）· video 已被 CSS scaleX(-1) 镜像
function _videoCoverBox(video, cw, ch) {
  if (!video || !video.videoWidth || !video.videoHeight) return { drawW: cw, drawH: ch, offX: 0, offY: 0 };
  const va = video.videoWidth / video.videoHeight;
  const ba = cw / ch;
  let drawW, drawH, offX = 0, offY = 0;
  if (ba > va) {
    // 容器更宽 → cover 把上下裁掉
    drawW = cw;
    drawH = cw / va;
    offY = (ch - drawH) / 2;
  } else {
    // 容器更高 → cover 把左右裁掉
    drawH = ch;
    drawW = ch * va;
    offX = (cw - drawW) / 2;
  }
  return { drawW, drawH, offX, offY };
}

// ★ 官方 MediaPipe Tasks Vision 拓扑连接（与 FaceLandmarker 同一套 · 不写自定义）
// 静态常量挂在全局由 _initFaceLandmarker 注入 · 优先 FACE_LANDMARKS_TESSELATION
let _FACE_CONN = {
  tesselation: null, faceOval: null, leftEye: null, rightEye: null,
  leftEyebrow: null, rightEyebrow: null, lips: null
};

// 把 MediaPipe 连接表统一规整为 [[a, b], ...] 形式
// Tasks Vision: { start, end }   Solutions: [a, b]   兼容 UMD 旧版：直接 array
function _normalizeConnList(list) {
  if (!list) return [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (Array.isArray(c) && c.length >= 2) out.push([c[0] | 0, c[1] | 0]);
    else if (c && typeof c === 'object' && 'start' in c && 'end' in c) out.push([c.start | 0, c.end | 0]);
  }
  return out;
}

// 兼容旧版 MediaPipe Solutions（如果通过 window 上挂载的 FACEMESH_* 拿到）
function _loadOfficialFaceConnections(FL) {
  if (!FL) return false;
  // Tasks Vision: FaceLandmarker.FACE_LANDMARKS_TESSELATION
  // Solutions: FACEMESH_TESSELATION
  const tess = FL.FACE_LANDMARKS_TESSELATION || FL.FACEMESH_TESSELATION;
  const oval = FL.FACE_LANDMARKS_FACE_OVAL || FL.FACEMESH_FACE_OVAL;
  const le = FL.FACE_LANDMARKS_LEFT_EYE || FL.FACEMESH_LEFT_EYE;
  const re = FL.FACE_LANDMARKS_RIGHT_EYE || FL.FACEMESH_RIGHT_EYE;
  const lb = FL.FACE_LANDMARKS_LEFT_EYEBROW || FL.FACEMESH_LEFT_EYEBROW;
  const rb = FL.FACE_LANDMARKS_RIGHT_EYEBROW || FL.FACEMESH_RIGHT_EYEBROW;
  const lps = FL.FACE_LANDMARKS_LIPS || FL.FACEMESH_LIPS;
  if (!tess) return false;
  _FACE_CONN.tesselation = _normalizeConnList(tess);
  _FACE_CONN.faceOval = _normalizeConnList(oval);
  _FACE_CONN.leftEye = _normalizeConnList(le);
  _FACE_CONN.rightEye = _normalizeConnList(re);
  _FACE_CONN.leftEyebrow = _normalizeConnList(lb);
  _FACE_CONN.rightEyebrow = _normalizeConnList(rb);
  _FACE_CONN.lips = _normalizeConnList(lps);
  return true;
}

// ★ 关键点（少量 · 眼角 / 鼻尖 / 嘴角 / 下巴）
const KEY_POINTS = [1, 4, 33, 133, 263, 362, 61, 291, 13, 152, 10, 234, 127];

// ★ 通用：画一组连接（points 已是映射到 canvas 坐标的 smoothedLandmarks）
function drawConnectionSet(ctx, points, connections, style) {
  if (!points || !connections || connections.length === 0) return;
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.globalAlpha = style.alpha != null ? style.alpha : 1;
  ctx.beginPath();
  for (let i = 0; i < connections.length; i++) {
    const c = connections[i];
    const a = c[0], b = c[1];
    if (a == null || b == null) continue;
    const pa = points[a], pb = points[b];
    if (!pa || !pb) continue;
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFaceConnections(ctx, indices, color, lw, shadowBlur) {
  if (!indices || indices.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.shadowColor = 'rgba(0, 255, 180, 0.35)';
  ctx.shadowBlur = shadowBlur;
  ctx.beginPath();
  for (let i = 0; i < indices.length; i++) {
    const c = indices[i];
    const a = c[0], b = c[1];
    if (a == null || b == null) continue;
    const pa = _pxCache[a], pb = _pxCache[b];
    if (!pa || !pb) continue;
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();
}

let _pxCache = null;
function _buildPxCache(landmarks, drawW, drawH, offX, offY, cw) {
  _pxCache = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    _pxCache[i] = {
      x: cw - (offX + p.x * drawW),
      y: offY + p.y * drawH
    };
  }
}

function drawDetectedFace(ctx, cw, ch, bbox, now, landmarks, streak) {
  const video = document.getElementById('v3xVideo');
  const { drawW, drawH, offX, offY } = _videoCoverBox(video, cw, ch);

  if (!landmarks || landmarks.length < 468) return;

  // ★ 把 landmarks 映射到 canvas 坐标（已含 cover 偏移 + 镜像）· 保存到 _pxCache
  _buildPxCache(landmarks, drawW, drawH, offX, offY, cw);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ★ 1. 完整内部三角网格（稍亮）
  if (_FACE_CONN.tesselation && _FACE_CONN.tesselation.length > 0) {
    drawConnectionSet(ctx, _pxCache, _FACE_CONN.tesselation, {
      color: 'rgba(0, 255, 180, 0.4)', width: 0.75, alpha: 1
    });
  }

  // ★ 2. 重点轮廓（OVAL + 双眉 + 双眼 + 唇）
  const outline = { color: 'rgba(0, 255, 180, 0.65)', width: 1.1, alpha: 1 };
  if (_FACE_CONN.faceOval && _FACE_CONN.faceOval.length) drawConnectionSet(ctx, _pxCache, _FACE_CONN.faceOval, outline);
  if (_FACE_CONN.leftEyebrow && _FACE_CONN.leftEyebrow.length) drawConnectionSet(ctx, _pxCache, _FACE_CONN.leftEyebrow, outline);
  if (_FACE_CONN.rightEyebrow && _FACE_CONN.rightEyebrow.length) drawConnectionSet(ctx, _pxCache, _FACE_CONN.rightEyebrow, outline);
  if (_FACE_CONN.leftEye && _FACE_CONN.leftEye.length) drawConnectionSet(ctx, _pxCache, _FACE_CONN.leftEye, outline);
  if (_FACE_CONN.rightEye && _FACE_CONN.rightEye.length) drawConnectionSet(ctx, _pxCache, _FACE_CONN.rightEye, outline);
  if (_FACE_CONN.lips && _FACE_CONN.lips.length) drawConnectionSet(ctx, _pxCache, _FACE_CONN.lips, outline);

  ctx.restore();

  // ★ 3. 细密小点（每个 landmark 一个小点 · 淡黄 · 不抢线）
  ctx.save();
  ctx.fillStyle = 'rgba(255, 225, 0, 0.55)';
  for (let i = 0; i < landmarks.length; i++) {
    const q = _pxCache[i];
    if (!q) continue;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSearching(ctx, cw, ch, now) {
  const y = (now / 8) % ch;
  const grad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
  grad.addColorStop(0, 'rgba(245, 212, 0, 0)');
  grad.addColorStop(0.5, 'rgba(245, 212, 0, 0.4)');
  grad.addColorStop(1, 'rgba(245, 212, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 30, cw, 60);
}

function stopFaceScanOverlay() {
  if (_scanRaf) cancelAnimationFrame(_scanRaf);
  _scanRaf = null;
  faceOverlayRunning = false;
  document.body.classList.remove('face-mesh-on');
  const canvas = document.getElementById('v3xScanOverlay');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  _lastStableLandmarks = null;
  _smoothedBBox = null;
  _detectionStreak = 0;
}

function handleCameraError(err) {
  console.error('[v3x] 摄像头请求失败:', err.name, err.message, err);
  // ★ 重置标志允许重试
  _cameraOpening = false;
  const errName = err?.name || 'Error';
  let userMsg = '';
  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    userMsg = '摄像头权限被拒绝。请在浏览器地址栏左侧的小锁/相机图标里允许摄像头。';
  } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    userMsg = '未找到摄像头设备。请检查摄像头是否连接。';
  } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    userMsg = '摄像头被其他程序占用（如微信、腾讯会议、OBS、剪映、其他浏览器）。请关闭后刷新。';
  } else if (errName === 'OverconstrainedError') {
    userMsg = '摄像头不支持请求的分辨率。';
  } else if (errName === 'NotSupportedError' || errName === 'TypeError') {
    userMsg = '当前浏览器不支持摄像头（请用 Chrome / Edge / Firefox 打开，且必须用 http://localhost）。';
  } else if (errName === 'SecurityError') {
    userMsg = '安全限制。请用 http://localhost 打开，不要用 file:// 或 127.0.0.1。';
  } else {
    userMsg = (err?.message || '未知错误') + '（' + errName + '）';
  }
  log('摄像头错误：' + errName, 'alert');
  setStatus('错误 · ' + errName, userMsg, 'error');
  showCamError(userMsg);
}

function showCamError(msg) {
  // ★ fallback demo：摄像头不可用时，仍启动 face scan overlay 在原本 video 区域演示
  try { startFaceScanOverlay(); } catch (e) { console.warn('[v3x] scan overlay fallback fail:', e); }
  const hud = document.getElementById('v3xScanHud');
  if (hud) hud.textContent = '▌ FACE SCAN · DEMO MODE · 模拟演示中';

  // 中央弹一个错误覆盖层
  let el = document.getElementById('v3xCamErr');
  if (!el) {
    el = document.createElement('div');
    el.id = 'v3xCamErr';
    el.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:40px;text-align:center;font-family:monospace;pointer-events:auto;';
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div style="max-width:540px;background:#1a1a1a;border:3px solid #d60000;box-shadow:8px 8px 0 #d60000;padding:30px;">' +
    '<div style="font-size:14px;letter-spacing:3px;color:#d60000;font-weight:900;margin-bottom:12px;">★ 摄像头不可用 · DEMO MODE</div>' +
    '<div style="font-size:13px;line-height:1.7;color:#fff;font-weight:700;letter-spacing:1px;">' + msg + '</div>' +
    '<div style="margin-top:14px;font-size:11px;color:#f5d400;letter-spacing:2px;">▌ 当前为视觉预览模式 · face scan overlay 仍在演示中</div>' +
    '<div style="margin-top:14px;font-size:11px;color:#888;letter-spacing:1px;">详情见浏览器 Console (F12) · 按 Q 或点下方按钮退出</div>' +
    '<button onclick="document.body.removeChild(document.getElementById(\'v3xCamErr\'));location.reload();" style="margin-top:18px;background:#f5d400;color:#1a1a1a;border:2px solid #1a1a1a;box-shadow:3px 3px 0 #d60000;padding:10px 20px;font-family:monospace;font-weight:900;letter-spacing:2px;cursor:pointer;">↻ 重新尝试</button>' +
    '</div>';
}

function startDetectLoop() {
  if (cameraDetectTimer) clearInterval(cameraDetectTimer);
  lastFpsTime = performance.now();
  cameraDetectTimer = setInterval(detectTick, 200);
}

let detectTimeArr = [];

function detectTick() {
  const video = $('v3xVideo');
  if (!video || !video.videoWidth || video.paused || video.ended) return;
  detectFrames++;
  const hit = detectPerson(video);

  // FPS
  const now = performance.now();
  if (now - lastFpsTime > 1000) {
    currentFps = Math.round(detectFrames * 1000 / (now - lastFpsTime));
    detectFrames = 0;
    lastFpsTime = now;
  }

  // 状态切换
  if (cameraFrameState === 'analyzing') {
    // 分析中不切换
  } else if (_faceLandmarkerStatus === 'ready') {
    // ★ MediaPipe 已接管：状态由 overlay loop 基于真实 landmarks 驱动 · 皮肤色启发式不再写入
  } else if (hit.ready) {
    setState('ready');
  } else if (hit.detected) {
    setState('detected');
  } else {
    setState('waiting');
  }

  // mini
  $('v3xSkin').textContent = hit.skinRatio;
  $('v3xVar').textContent = hit.variance;
  $('v3xSize').textContent = video.videoWidth + '×' + video.videoHeight;
  $('v3xFps').textContent = currentFps;
}

function detectPerson(video) {
  const w = detectCanvas.width, h = detectCanvas.height;
  detectCtx.save();
  detectCtx.translate(w, 0);
  detectCtx.scale(-1, 1);
  detectCtx.drawImage(video, 0, 0, w, h);
  detectCtx.restore();
  let data;
  try { data = detectCtx.getImageData(0, 0, w, h).data; }
  catch (err) { return { detected: false, ready: false, skinRatio: 0, variance: 0 }; }

  let skin = 0, bs = 0, bq = 0, n = 0;
  for (let i = 0; i < data.length; i += 24) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const bright = r * 0.299 + g * 0.587 + b * 0.114;
    const isSkin =
      r > 50 && g > 25 && b > 15 &&
      r > b * 0.72 && g > b * 0.55 &&
      Math.max(r, g, b) - Math.min(r, g, b) > 8;
    if (isSkin) skin++;
    bs += bright; bq += bright * bright; n++;
  }
  const skinRatio = skin / n;
  const mean = bs / n;
  const variance = bq / n - mean * mean;
  const detected = skinRatio > 0.018 && variance > 90;
  const ready = skinRatio > 0.028 && variance > 130;
  return {
    detected, ready,
    skinRatio: skinRatio.toFixed(3),
    variance: Math.round(variance)
  };
}

// ============================================
// 状态切换
// ============================================
function setState(state) {
  cameraFrameState = state;
  const frame = $('v3xFrame');
  const status = $('v3xStatus');
  const action = $('v3xAction');
  const btn = $('v3xGoBtn');

  // 角标/扫描线状态
  frame.classList.remove('is-detected', 'is-ready', 'is-captured');
  status.classList.remove('is-detected', 'is-ready', 'is-captured');
  action.classList.remove('is-detected', 'is-ready', 'is-captured');

  if (state === 'waiting') {
    setStatus('等待可归类对象', '请进入取景框', 'waiting');
    setAction('▌ 系统就绪', '等待可归类对象', '请进入取景框', '等待进入扫描区');
    btn.disabled = true;
    btn.querySelector('span:last-child').textContent = '等待对象';
  } else if (state === 'detected') {
    frame.classList.add('is-detected');
    status.classList.add('is-detected');
    setStatus('发现对象', '请保持稳定', 'detected');
    setAction('▌ 检测中', '发现对象', '请保持稳定 · 即将判定', '发现对象 · 等待稳定');
    btn.disabled = true;
    btn.querySelector('span:last-child').textContent = '锁定中';
  } else if (state === 'ready') {
    frame.classList.add('is-detected', 'is-ready');
    status.classList.add('is-detected', 'is-ready');
    action.classList.add('is-ready');
    setStatus('当前帧可用于归类', '目标已锁定 · 可直接生成', 'ready');
    setAction('▌ 目标已锁定', '当前帧可用于归类', '目标已锁定 · 可直接生成', '就绪 · 可归类');
    btn.disabled = false;
    btn.querySelector('span:last-child').textContent = '立即归类';
  } else if (state === 'analyzing') {
    setStatus('系统正在归类', '请稍候 · 正在生成结果', 'analyzing');
    setAction('▌ 归类中', '正在生成分类结果', '请稍候', '正在归类');
    btn.disabled = true;
  } else if (state === 'captured') {
    frame.classList.add('is-captured');
    status.classList.add('is-captured');
    action.classList.add('is-captured');
    setStatus('样本已捕获', '已送入归类队列', 'captured');
    setAction('▌ 已捕获', '样本已捕获', '已送入归类队列', '已捕获');
    btn.disabled = true;
  }
}

// ============================================
// ★ resetToCamera · 统一返回摄像头入口 · 轻量 reset · 绝不重建 camera DOM
//   - 顶部「摄像头」按钮 · pathSelect ← 按钮 · 结果页 ← 按钮 · 关闭按钮 · 再次分析 全部走这个
//   - 不依赖 currentView / pathSelectVisible 状态 · 总是把 UI 拉回 camera
//   - 不重建 video · 不重开 getUserMedia · 不重新 fetch html · 不重绑事件
// ============================================
let _resetToCameraInProgress = false;

// ★★★ 保证 camera-layer 永远在 · 不允许被替换
function ensureCameraLayerVisible() {
  const layer = document.getElementById('camera-layer');
  if (layer) {
    // 显式确保 z-index 和 position（防 inline style 被覆盖）
    layer.style.position = layer.style.position || 'relative';
    layer.style.zIndex = '1';
    layer.style.display = 'block';
  }
  // ★ 确认 video 元素还活着
  const video = document.getElementById('v3xVideo');
  if (video && !video.isConnected) {
    console.error('[FLOW] camera-layer detached! · this should not happen');
  }
}
window.ensureCameraLayerVisible = ensureCameraLayerVisible;
window.SPA = window.SPA || {};
window.SPA.ensureCameraLayerVisible = ensureCameraLayerVisible;

function resetToCamera() {
  if (_resetToCameraInProgress) {
    console.log('[FLOW] resetToCamera · already in progress · skip');
    return;
  }
  _resetToCameraInProgress = true;
  console.log('[FLOW] resetToCamera start');
  try {
    // ★ 清空 sample
    currentSample = null;
    // ★ 清空 sessionStorage
    try { sessionStorage.removeItem('v3x_captured_frame'); } catch (e) {}
    // ★ 隐藏主页面 v3xResult（如果有）
    const mainResult = $('v3xResult');
    if (mainResult) mainResult.hidden = true;
    // ★ 隐藏 v3xModal（如果残留）
    const modal = $('v3xModal');
    if (modal) modal.hidden = true;
    // ★ 清空 sample strip
    const sampleEl = $('v3xSample');
    if (sampleEl) {
      sampleEl.innerHTML = '<div class="v3x-sample__empty"><span class="v3x-sample__empty-icon">⌽</span><span>等待系统捕获当前帧</span></div>';
    }
    // ★ 隐藏 pathSelect overlay · 移除 body.forked
    if (window.SPA && typeof window.SPA.hidePathSelectOverlay === 'function') {
      try { window.SPA.hidePathSelectOverlay(); } catch (e) { console.warn('[FLOW] SPA.hidePathSelectOverlay failed', e); }
    } else {
      try { document.body.classList.remove('forked'); } catch (e) {}
      const ov = document.getElementById('overlay-layer');
      if (ov) ov.style.display = 'none';
    }
    // ★★★ 核心硬性规则：camera-layer 永远在 · 绝不允许被替换
    try { ensureCameraLayerVisible(); } catch (e) {}
    // ★ 切回 camera view（直接调 SPA.show · 不要走 SPA.gotoCamera 因为会再次触发 reset）
    if (window.SPA && typeof window.SPA.show === 'function') {
      try { window.SPA.show('camera'); } catch (e) { console.warn('[FLOW] SPA.show(camera) failed', e); }
    }
    // ★ 切状态到 waiting（detectTick 几秒后会自动升到 ready）
    setState('waiting');
    // ★ 复用现有摄像头流（绝不重开 getUserMedia）
    try { ensureCameraRunning(); } catch (e) { console.warn('[FLOW] ensureCameraRunning failed', e); }
    // ★ 清空 ancient iframe 内的归类融合像状态（避免上一轮的图残留）
    try {
      if (typeof window.resetAncientFusionInIframe === 'function') {
        window.resetAncientFusionInIframe();
      }
    } catch (e) { console.warn('[FLOW] resetAncientFusionInIframe failed', e); }
    // ★ 恢复 go 按钮
    const btn = $('v3xGoBtn');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      const span = btn.querySelector('span:last-child');
      if (span) span.textContent = '立即归类';
    }
    // ★ 取消 isClassifying 标志
    isClassifying = false;
    console.log('[FLOW] resetToCamera complete · cameraFrameState =', cameraFrameState);
  } catch (e) {
    console.error('[FLOW] resetToCamera error', e);
  } finally {
    _resetToCameraInProgress = false;
  }
}
window.resetToCamera = resetToCamera;
window.SPA = window.SPA || {};
window.SPA.resetToCamera = resetToCamera;

// ============================================
// ★ backToPathSelect · 关闭 result-layer 回到 pathSelect 三路径选择 overlay
//   - 不要清空 capturedFrame（用户还在同一轮样本分流里）
//   - 不要重新 capture / getUserMedia
//   - 不要跳页面
//   - 只关闭 result-layer + 显示 pathSelect overlay
// ============================================
let _backToPathSelectInProgress = false;
function backToPathSelect() {
  if (_backToPathSelectInProgress) {
    console.log('[FLOW] backToPathSelect · already in progress · skip');
    return;
  }
  _backToPathSelectInProgress = true;
  console.log('[FLOW] backToPathSelect start');
  try {
    // ★ 调 SPA.show('camera') 关 result-layer · 同时把 currentView 重置为 'camera'
    if (window.SPA && typeof window.SPA.show === 'function') {
      try { window.SPA.show('camera'); } catch (e) { console.warn('[FLOW] SPA.show(camera) failed', e); }
    } else if (window.SPA && typeof window.SPA.hideResultOverlay === 'function') {
      // 兜底：手动关 result-layer
      try { window.SPA.hideResultOverlay(); } catch (e) {}
      if (window.SPA) window.SPA.currentView = 'camera';
    }

    // ★ 重置选择状态（保留 capturedFrame）
    if (window.SPA) {
      window.SPA.selectedSystem = null;
      window.SPA.analysisLoading = false;
      window.SPA.analysisError = null;
      window.SPA.analysisResult = null;
      window.SPA.pathSelectVisible = true;
      window.SPA.resultVisible = false;
    }

    // ★ 显示 pathSelect overlay
    if (window.SPA && typeof window.SPA.showPathSelectOverlay === 'function') {
      try { window.SPA.showPathSelectOverlay(); } catch (e) { console.warn('[FLOW] SPA.showPathSelectOverlay failed', e); }
    }

    // ★ 保留 sampleLocked（用户还在同一轮样本分流里）
    sampleLocked = true;
    canStartAnalysis = false;
    startAnalysisDisabled = true;

    console.log('[FLOW] backToPathSelect complete · capturedFrame preserved · pathSelectVisible=true');
  } catch (e) {
    console.error('[FLOW] backToPathSelect error', e);
  } finally {
    _backToPathSelectInProgress = false;
  }
}
window.backToPathSelect = backToPathSelect;
window.SPA = window.SPA || {};
window.SPA.backToPathSelect = backToPathSelect;

// ============================================
// ★ handleStartAnalysis · 顶部「路径选择」按钮专用
//   - 如果有 capturedFrame · 直接显示 pathSelect overlay（不再走 capture-and-analyze）
//   - 如果没有 capturedFrame · 走 useCurrentFrameAndAnalyze（先 capture）
// ============================================
function handleStartAnalysis() {
  console.log('[FLOW] handleStartAnalysis called · cameraFrameState =', cameraFrameState);
  const hasFrame = (() => {
    try { return !!sessionStorage.getItem('v3x_captured_frame'); } catch (e) { return false; }
  })();
  if (hasFrame) {
    console.log('[FLOW] handleStartAnalysis · has capturedFrame · showPathSelectOverlay');
    if (window.SPA && typeof window.SPA.showPathSelectOverlay === 'function') {
      try { window.SPA.showPathSelectOverlay(); } catch (e) { console.warn('[FLOW] SPA.showPathSelectOverlay failed', e); }
    }
  } else {
    console.log('[FLOW] handleStartAnalysis · no capturedFrame · useCurrentFrameAndAnalyze');
    try { useCurrentFrameAndAnalyze(); } catch (e) { console.warn('[FLOW] useCurrentFrameAndAnalyze failed', e); }
  }
}
window.handleStartAnalysis = handleStartAnalysis;
window.SPA = window.SPA || {};
window.SPA.handleStartAnalysis = handleStartAnalysis;

function setStatus(title, sub, klass) {
  const el = $('v3xStatus');
  el.classList.remove('is-detected', 'is-ready', 'is-captured');
  if (klass && klass !== 'waiting') el.classList.add('is-' + klass);
  $('v3xStatusTitle').textContent = title;
  $('v3xStatusSub').textContent = sub;
}

function setAction(kicker, title, sub) {
  $('v3xActionKicker').textContent = kicker;
  $('v3xActionTitle').textContent = title;
  $('v3xActionSub').textContent = sub;
}

// ============================================
// 三套系统 · 数据结构 + prompt + fallback（接 AI 入口）
// ============================================
// ★ 新增：接 AI 流程专用 · 不动任何 v3x-* UI 状态
// ★ 三套系统的 prompt + fallback · 字段严守各结果页已有字段
window.ANALYSIS_SYSTEMS = {
  ancient: {
    id: 'ancient',
    label: '古代',
    systemPrompt:
      '你是"古代相学文献大模型"。输入是一张摄像头截图。' +
      '你需要按照古代相书卷宗（十二宫 / 五官 / 三停 / 五岳 / 气色 / 骨相）给出六个分类结果。' +
      '严格输出 JSON，不要任何解释。不要写Markdown或前后缀。' +
      '字段名严守 ancientSchema ：' +
      '{ "verdict": "你被归类为", "system": "古代相术", "fields": [' +
      '{ "key":"main_zones", "label":"十二宫", "value":"...", "reason":"..." },' +
      '{ "key":"five_features", "label":"五官", "value":"...", "reason":"..." },' +
      '{ "key":"three_stops", "label":"三停", "value":"...", "reason":"..." },' +
      '{ "key":"five_peaks", "label":"五岳", "value":"...", "reason":"..." },' +
      '{ "key":"complexion", "label":"气色", "value":"...", "reason":"..." },' +
      '{ "key":"bone_form", "label":"骨相", "value":"...", "reason":"..." }' +
      '] }',
    fallback: {
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
  },
  modern: {
    id: 'modern',
    label: '现代',
    systemPrompt:
      '你是"BIAS SYSTEM 身份清仓分类模型"。输入是一张摄像头截图。' +
      '需要按现代身份分类系统（性取向 / 性别 / 收入 / 家庭 / 婚恋 / 风险）给出六个分类结果。' +
      '注意：你输出的是系统的判定结果，不是真实身份。' +
      '严格输出 JSON，不要任何解释。' +
      '字段名严守 modernSchema：' +
      '{ "verdict": "你被归类为", "system": "身份清仓", "sku": "SKU-02", "result_id": "OBS-XXXX", ' +
      '"identityCard": {' +
      '"orientation":"...", "gender":"...", "income":"...", "family":"...", "relationship":"...", "risk":"..."' +
      '}, ' +
      '"verdict_label": "你被归类为" }',
    fallback: {
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
  },
  western: {
    id: 'western',
    label: '西方',
    systemPrompt:
      '你是"西方面学历史档案大模型"，输入是一张摄像头截图。' +
      '需要按西方面相学历史分类（古典相貌 / 侧影道德 / 颅骨地图 / 犯罪预兆 / 平均脸 / 算法）给出六个分类结果。' +
      '注意：你输出的是西方面学历史档案的判定结果，不是真实身份判定。' +
      '严格输出 JSON，不要任何解释。' +
      '字段名严守 westernSchema：' +
      '{ "verdict": "你被归类为", "system": "Western Archive", "physiognomy": [' +
      '{ "key":"classical", "label":"古典相貌", "value":"...", "reason":"..." },' +
      '{ "key":"profile", "label":"侧影道德", "value":"...", "reason":"..." },' +
      '{ "key":"skull_map", "label":"颅骨地图", "value":"...", "reason":"..." },' +
      '{ "key":"criminal_sign", "label":"犯罪预兆", "value":"...", "reason":"..." },' +
      '{ "key":"average_face", "label":"平均脸", "value":"...", "reason":"..." },' +
      '{ "key":"algorithm", "label":"算法", "value":"...", "reason":"..." }' +
      '] }',
    fallback: {
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
  },
};

// ★ 接 AI 入口
// window.ANALYSIS.run(system, sample, options) → Promise<aiResult>
// - system: 'ancient' | 'modern' | 'western'
// - sample: { dataUrl, width, height, fileSize, fileName }
// - options.alwaysFallback: 即使 AI 失败也要返回 fallback（默认 true）
window.ANALYSIS = (function () {
  async function run(system, sample, options) {
    options = options || {};
    const def = window.ANALYSIS_SYSTEMS[system];
    if (!def) throw new Error('未知 system: ' + system);
    if (!window.ENABLE_AI_ANALYSIS) {
      console.log('[AI DISABLED] skip analysis run · system=' + system);
      return null;
    }
    if (!window.AIClient || typeof window.AIClient.callAI !== 'function') {
      throw new Error('window.AIClient.callAI 不存在');
    }
    // 准备 inputMeta（沿用 exhibition.js 已有 inputMeta 形态）
    const inputMeta = {
      kind: 'image',
      system: system,                                    // ★ 新增 system 字段
      image: sample,
      width: sample.width,
      height: sample.height,
      fileSize: sample.fileSize,
      fileName: sample.fileName,
      dominantColor: '#888888',
      dominantName: 'mixed',
      imageCaption: '',
      faceCount: 0,
      aspect: sample.width / sample.height,
    };
    let ai = null;
    let fromAI = false;
    try {
      ai = await window.AIClient.callAI(inputMeta, { system: system });
      fromAI = true;
    } catch (err) {
      console.warn('[ANALYSIS] AI 请求失败（fallback）:', err?.message || err);
    }
    // 防御：如果 AI 返回的不是合法对象或字段全空 → fallback
    if (!ai || typeof ai !== 'object' || (system === 'modern' && !ai.identityCard) || (system === 'ancient' && !ai.fields) || (system === 'western' && !ai.physiognomy)) {
      fromAI = false;
      ai = def.fallback;
    }
    ai._system = system;
    ai._source = fromAI ? 'ai' : 'fallback';
    return ai;
  }
  return { run: run };
})();

// 保存"已捕获帧"到 sessionStorage，path-overlay / 结果页能读取
function stashCapturedFrame(sample) {
  try {
    const payload = {
      dataUrl: sample.dataUrl,
      width: sample.width,
      height: sample.height,
      fileSize: sample.fileSize,
      fileName: sample.fileName,
      ts: Date.now(),
    };
    sessionStorage.setItem('v3x_captured_frame', JSON.stringify(payload));
  } catch (e) {
    console.warn('[v3x] sessionStorage 写入失败:', e?.message || e);
  }
}
function readCapturedFrame() {
  try {
    const raw = sessionStorage.getItem('v3x_captured_frame');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// ★ 冻结当前帧 + 停止摄像头 + 停止人脸检测循环
// - 调用后：video.srcObject 已被 stop，requestAnimationFrame 循环被取消
// - window.__lockedSnapshot 永远保存当前帧
// - 后续 AI / pathSelect / 结果页只读 __lockedSnapshot，不再访问实时摄像头
function lockSnapshotAndStopCamera(sample) {
  console.log('[CAPTURE] snapshot locking · bytes =', (sample && sample.dataUrl || '').length);
  // ★ 1. 先冻结当前人脸状态（在停止 FaceDetection 之前）
  var faceState = window.currentFaceState || {};
  var frozenPoints = Array.isArray(faceState.points) ? faceState.points.map(function (p) {
    return { x: Number(p.x), y: Number(p.y), z: Number(p.z || 0) };
  }) : [];
  var liveLandmarkCount = frozenPoints.length;
  console.log('[CAPTURE] live landmarks', liveLandmarkCount);
  // 2. 写全局 lockedSnapshot（含人脸字段）
  window.__lockedSnapshot = {
    dataUrl: sample.dataUrl,
    width: sample.width,
    height: sample.height,
    fileSize: sample.fileSize,
    fileName: sample.fileName,
    ts: Date.now(),
    capturedAt: Date.now(),
    faceLandmarks: frozenPoints,
    landmarkCount: liveLandmarkCount,
    faceDetected: liveLandmarkCount >= 100,
    faceStateUpdatedAt: Number(faceState.updatedAt || 0)
  };
  console.log('[CAPTURE] locked landmarks', window.__lockedSnapshot.landmarkCount, '· faceDetected:', window.__lockedSnapshot.faceDetected);
  // 3. 停人脸检测循环
  try {
    if (typeof stopFaceScanOverlay === 'function') stopFaceScanOverlay();
    if (window._scanRaf) { cancelAnimationFrame(window._scanRaf); window._scanRaf = null; }
    if (typeof _scanRaf !== 'undefined' && _scanRaf) { cancelAnimationFrame(_scanRaf); _scanRaf = null; }
    console.log('[FACE_DETECTION] loop stopped');
  } catch (e) { console.warn('[FACE_DETECTION] stop err', e); }
  // 4. 停摄像头 stream（最后才停）
  try {
    const video = document.getElementById('v3xVideo') || document.querySelector('video');
    if (video && video.srcObject) {
      const stream = video.srcObject;
      stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      video.srcObject = null;
      console.log('[CAMERA] tracks stopped');
    } else {
      console.log('[CAMERA] no stream to stop');
    }
  } catch (e) { console.warn('[CAMERA] stop err', e); }
}

// 保存"待跳转结果"参数（sessionStorage 防止跨页 size 限制）
function stashSystemChoice(aiResult, system) {
  try {
    sessionStorage.setItem('v3x_system', system);
    sessionStorage.setItem('v3x_ai_result', JSON.stringify(aiResult));
  } catch (e) {
    console.warn('[v3x] stashSystemChoice 失败:', e?.message || e);
  }
}
window.readSystemChoice = function () {
  try {
    const sys = sessionStorage.getItem('v3x_system');
    const raw = sessionStorage.getItem('v3x_ai_result');
    if (!sys || !raw) return null;
    return { system: sys, aiResult: JSON.parse(raw) };
  } catch (e) { return null; }
};

// 跳到 path-overlay（v9 v=v9 / ?v=current）—— 单页 SPA 状态切换
function gotoPathOverlay() {
  // 将已捕获帧 stash，让 path-overlay 重新检测后能继续
  const sample = currentSample;
  if (sample) stashCapturedFrame(sample);
  // 不直接显示 v3xResult · 状态转 captured
  setState('captured');
  // ★ 单页：显示 pathSelect overlay（不是 view · currentView 保持 'camera'）
  if (window.SPA && typeof window.SPA.showPathSelectOverlay === 'function') {
    try { window.SPA.showPathSelectOverlay(); return; } catch (e) { console.warn('[v3x] SPA.showPathSelectOverlay failed', e); }
  }
  // 兜底（如果 SPA 没加载 · 极早期）
  try { window.history.replaceState({}, '', '#pathSelect'); } catch (e) {}
  // 触发一个自定义事件让 SPA 接管
  document.dispatchEvent(new CustomEvent('v3x-spa-goto', { detail: { view: 'pathSelect' } }));
}

// ============================================
// 截取当前帧 + 触发 AI（带黑图检测）
// ============================================
function showError(title, message, sample) {
  // 中央错误卡（与结果卡同结构）
  $('v3xResultCase').textContent = 'ERR-' + Date.now().toString(36).toUpperCase();
  $('v3xResultVerdict').textContent = title || '归类失败';
  $('v3xResultGrid').innerHTML =
    '<div style="grid-column:1/-1;padding:12px;background:rgba(214,0,0,0.08);border:2px dashed #d60000;font-size:13px;line-height:1.7;color:#1a1a1a;">' +
      '<div style="font-weight:900;color:#d60000;letter-spacing:1px;margin-bottom:6px;">★ API 错误</div>' +
      (message || '请检查分析接口') +
    '</div>';
  if (sample) {
    $('v3xResultSource').innerHTML =
      '<img class="v3x-result__source-thumb" src="' + sample.dataUrl + '" alt="sample">' +
      '<div class="v3x-result__source-info">▌ 样本来源 · 摄像头现场截帧 · ' + sample.width + '×' + sample.height + ' · ' + Math.round(sample.fileSize / 1024) + 'KB</div>';
  } else {
    $('v3xResultSource').innerHTML = '';
  }
  // 把"再来一次"按钮文案换成"重新归类"
  const again = $('v3xResultAgain');
  if (again) {
    again.querySelector('span:last-child').textContent = '重新归类';
  }
  $('v3xResult').hidden = false;
  setState('ready');
}

function captureCurrentFrame() {
  const video = $('v3xVideo');
  if (!video || !video.videoWidth || !video.videoHeight) {
    console.error('[v3x] capture: video not ready', { vw: video?.videoWidth, vh: video?.videoHeight });
    return null;
  }
  if (video.readyState < 2) {
    console.warn('[v3x] capture: video.readyState =', video.readyState, '（还没解码）· 等待 200ms');
    return null;
  }
  const w = video.videoWidth, h = video.videoHeight;
  console.log('[v3x] capture: video size =', w, '×', h, 'readyState =', video.readyState, 'currentTime =', video.currentTime);
  if (captureCanvas.width !== w) captureCanvas.width = w;
  if (captureCanvas.height !== h) captureCanvas.height = h;
  if (!captureCtx) captureCtx = captureCanvas.getContext('2d');
  // ★ 关键：先 reset transform，再镜像
  captureCtx.setTransform(1, 0, 0, 1, 0, 0);
  captureCtx.fillStyle = '#000';
  captureCtx.fillRect(0, 0, w, h);
  captureCtx.setTransform(-1, 0, 0, 1, w, 0);
  try {
    captureCtx.drawImage(video, 0, 0, w, h);
  } catch (err) {
    console.error('[v3x] capture: drawImage failed:', err);
    return null;
  }
  captureCtx.setTransform(1, 0, 0, 1, 0, 0);
  const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.86);
  console.log('[v3x] capture: dataUrl length =', dataUrl.length, 'prefix =', dataUrl.slice(0, 40));

  // ★ 诊断：检查 dataUrl 是否太短（黑图）
  const kb = Math.round(dataUrl.length / 1024);
  if (kb < 10) {
    console.error('[v3x] WARNING: captured image is only', kb, 'KB — likely BLACK IMAGE. vw=', w, 'vh=', h, 'readyState=', video.readyState, 'currentTime=', video.currentTime);
  }

  return {
    dataUrl, fileName: 'EXH_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.jpg',
    width: w, height: h, fileSize: Math.round((dataUrl.length * 3) / 4)
  };
}

function renderSampleStrip(sample) {
  $('v3xSample').innerHTML =
    '<img class="v3x-sample__thumb" src="' + sample.dataUrl + '" alt="sample">' +
    '<div class="v3x-sample__info">' +
      '<strong>已投放摄像头样本</strong><br>' +
      '来源：摄像头现场截帧<br>' +
      '<em>' + sample.width + ' × ' + sample.height + ' · ' + Math.round(sample.fileSize / 1024) + ' KB</em>' +
    '</div>';
}

async function useCurrentFrameAndAnalyze() {
  console.log('[FLOW] start analysis clicked · cameraFrameState =', cameraFrameState);
  // ★ 调试模式：URL 上有 ?_devtest=fake-cam 时 · 假装摄像头有 ready 帧（jsdom 调试用）
  // 生产环境无任何影响
  const _devTestFakeCam = /[?&]_devtest=fake-cam\b/.test(location.search);
  if (_devTestFakeCam && cameraFrameState !== 'ready') {
    console.log('[FLOW] devtest fake-cam · bypass ready check');
    // 直接用一张黑帧模拟"已捕获"
    const fakeSample = {
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORk5ErkJggg==',
      width: 1, height: 1, fileSize: 100, fileName: 'DEVTEST_fake.jpg'
    };
    currentSample = fakeSample;
    try { renderSampleStrip(fakeSample); } catch (e) {}
    setState('captured');
    console.log('[FLOW] capture success (fake) · dataUrl prefix =', fakeSample.dataUrl.slice(0, 30));
    try { stashCapturedFrame(fakeSample); } catch (e) {}
    // ★ 保证 camera-layer 永远在
    try { ensureCameraLayerVisible(); } catch (e) {}
    if (window.SPA && window.SPA.showPathSelectOverlay) {
      console.log('[FLOW] currentView -> pathSelect overlay (via SPA)');
      try { window.SPA.showPathSelectOverlay(); return; } catch (e) { console.warn('[FLOW] SPA.showPathSelectOverlay failed', e); }
    }
  }
  if (cameraFrameState !== 'ready') {
    log('尚未 ready · 当前 ' + cameraFrameState, 'warn');
    return;
  }
  // ★ 重要：确保 video 已解码（至少有一帧）· 否则截图会是黑图
  const video = $('v3xVideo');
  if (video && video.readyState < 2) {
    log('视频还在解码 · 等待中…', 'warn');
    await new Promise((resolve) => {
      const handler = () => {
        if (video.readyState >= 2) {
          video.removeEventListener('loadeddata', handler);
          resolve();
        }
      };
      video.addEventListener('loadeddata', handler);
      setTimeout(resolve, 2000); // 最长等 2s
    });
  }
  // 强制视频播放再走当前帧（防止 currentTime=0 的空白帧）
  if (video && video.paused) {
    try { await video.play(); } catch (e) { console.warn('[v3x] play() failed:', e); }
  }
  // 等待一帧渲染
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));

  const sample = captureCurrentFrame();
  if (!sample || !sample.dataUrl) {
    console.warn('[FLOW] capture failed · no dataUrl');
    log('捕获失败', 'alert');
    // ★ 即使 capture 失败，也允许进入 pathSelect 让用户重选或 fallback
    if (window.SPA && window.SPA.showPathSelectOverlay) {
      try { window.SPA.showPathSelectOverlay(); } catch (e) {}
    }
    showError('截图失败', '无法从摄像头捕获画面（视频流可能未就绪）。请稍候再试。', null);
    return;
  }
  if (Math.round(sample.dataUrl.length / 1024) < 8) {
    console.error('[v3x] 黑图 dataUrl 仅', Math.round(sample.dataUrl.length / 1024), 'KB');
    // ★ 即便黑图也允许进入 pathSelect 试 fallback
    if (window.SPA && window.SPA.showPathSelectOverlay) {
      try { window.SPA.showPathSelectOverlay(); } catch (e) {}
    }
    showError('截图疑似黑图', '捕获的图片仅 ' + Math.round(sample.dataUrl.length / 1024) + ' KB，几乎全黑。视频流可能没有实际内容。', sample);
    return;
  }
  currentSample = sample;
  renderSampleStrip(sample);
  setState('captured');
  log('样本已捕获 ' + sample.width + '×' + sample.height + ' · ' + Math.round(sample.fileSize / 1024) + 'KB', 'ok');
  captureCount++;
  console.log('[FLOW] capture success · dataUrl prefix =', (sample.dataUrl || '').slice(0, 30));

  // ★ 立刻冻结画面 + 停摄像头 + 停人脸检测 · AI 阶段不再读实时摄像头
  try { lockSnapshotAndStopCamera(sample); } catch (e) { console.warn('[FLOW] lockSnapshot failed', e); }

  // ★ 立刻显示 pathSelect overlay（不调 AI / 不进结果页 / 不卡 loading）· currentView 保持 'camera'
  // 把 sample 存到 sessionStorage，方便 pathSelect 拿
  try { stashCapturedFrame(sample); } catch (e) { console.warn('[FLOW] stash failed', e); }
  // 立刻显示 overlay（不延迟 250ms）
  if (window.SPA && typeof window.SPA.showPathSelectOverlay === 'function') {
    console.log('[FLOW] currentView -> pathSelect overlay (via SPA)');
    try { window.SPA.showPathSelectOverlay(); return; } catch (e) { console.warn('[FLOW] SPA.showPathSelectOverlay failed', e); }
  }
  // 兜底：直接用 SPA show
  if (window.SPA && typeof window.SPA.show === 'function') {
    try { window.SPA.show('pathSelect'); return; } catch (e) { console.warn('[FLOW] SPA.show failed', e); }
  }
  // 终极兜底：触发 custom event 让 SPA 接管
  document.dispatchEvent(new CustomEvent('v3x-spa-goto', { detail: { view: 'pathSelect' } }));
  console.log('[FLOW] currentView -> pathSelect (via event)');
}

// ★ 全局标志：是否正在归类（防重复点击）
var isClassifying = false;

// ★ 15s 超时包装器（任何 AI 请求都强制限时）
async function withTimeout(promise, ms) {
  ms = ms || 15000;
  var timer;
  var timeout = new Promise(function(_, reject) {
    timer = setTimeout(function() {
      reject(new Error('AI 请求超时（' + (ms / 1000) + ' 秒）· 请检查 /api/classify 或模型服务'));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ★ 关闭加载弹窗 + 恢复按钮（共用 finally）
function cleanupClassifyUI(stepInterval) {
  if (stepInterval) clearInterval(stepInterval);
  var modal = $('v3xModal');
  if (modal) modal.hidden = true;
  var title = $('v3xModalTitle');
  if (title) title.textContent = '正在生成分类结果';
  // ★ 按钮恢复 + loading class 移除
  var btn = $('v3xGoBtn');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    var span = btn.querySelector('span:last-child');
    if (span) span.textContent = '立即归类';
  }
}

async function runAnalyze(sample) {
  // ★ 防重复点击
  if (isClassifying) {
    console.warn('[classify] 已有归类请求进行中，忽略本次点击');
    return;
  }
  isClassifying = true;

  setState('analyzing');
  $('v3xModal').hidden = false;
  startModalProgress();
  log('开始归类…', 'ok');

  // ★ 诊断日志
  console.log('[v3x] === 即将请求 AI ===');
  console.log('[v3x] sample.width =', sample.width);
  console.log('[v3x] sample.height =', sample.height);
  console.log('[v3x] sample.dataUrl 长度 =', sample.dataUrl?.length, 'KB ≈', Math.round((sample.dataUrl?.length || 0) / 1024));
  console.log('[v3x] sample.dataUrl 前 80 字符 =', sample.dataUrl?.slice(0, 80));
  console.log('[v3x] sample.fileSize =', sample.fileSize);

  var stepInterval = null;

  // ★ 无论成功失败 finally 都要清理
  try {
    if (!window.ENABLE_AI_ANALYSIS) {
      console.log('[AI DISABLED] skip analyzeSample');
      return null;
    }
    if (!sample.dataUrl || sample.dataUrl.length < 5000) {
      throw new Error('截图异常短（' + Math.round((sample.dataUrl?.length || 0) / 1024) + ' KB）· 疑似黑图');
    }

    // ★ 前置检查：window.AIClient 存在
    if (!window.AIClient || typeof window.AIClient.callAI !== 'function') {
      throw new Error('window.AIClient.callAI 不存在 · ai-client.js 未正确加载');
    }

    let inputMeta;
    try {
      const meta = await readImageFromDataUrl(sample.dataUrl, sample.fileName, sample.fileSize);
      const r = meta.dominantColors?.[0] || [128, 128, 128];
      inputMeta = {
        kind: 'image', image: sample,
        imageCaption: meta.caption || '',
        width: meta.width, height: meta.height, aspect: meta.aspect,
        faceCount: meta.faceCount || 0,
        dominantColor: '#' + r.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase(),
        dominantName: 'mixed',
      };
    } catch (e) {
      inputMeta = { kind: 'image', image: sample };
    }

    // 文案滚动
    var STEPS = ['系统正在补全标签', '重新扫码中', '正在估价', '正在强制归类'];
    var i = 0;
    stepInterval = setInterval(function() {
      var t = $('v3xModalTitle');
      if (t) t.textContent = STEPS[i % STEPS.length];
      i++;
    }, 700);

    var settings = (() => {
      try { return JSON.parse(localStorage.getItem('obs_settings_v1') || '{}'); } catch (e) { return {}; }
    })();

    // ★ 15s 超时调用
    console.log('[classify] 请求 AI · 15s timeout');
    var ai = await withTimeout(callAI(inputMeta, settings), 15000);

    console.log('[v3x] ★ AI 真实返回:', ai);
    console.log('[v3x] ★ 结果来源: ai（来自后端 /api/classify 真实代理）');
    console.log('[v3x] ★ AI 原始消息:', ai.rawMessage?.slice(0, 500));

    if (!ai) throw new Error('AI 返回为空');

    // ★ 成功路径
    cleanupClassifyUI(stepInterval);
    stepInterval = null;
    log('归类完成', 'ok');
    ai.source = 'ai';
    showResult(ai, sample);

  } catch (err) {
    console.error('[v3x] ✗ AI 请求失败:', err);
    console.error('[v3x] ✗ 错误详情:', {
      message: err.message,
      upstreamStatus: err.upstreamStatus,
      upstreamBody: err.upstreamBody?.slice(0, 300),
      invalidAI: err.invalidAI,
      invalidReasons: err.invalidReasons,
      rawMessage: err.rawMessage?.slice(0, 300),
      localBackendError: err.localBackendError,
      backendError: err.backendError,
    });
    log('归类失败：' + (err.message || err.name || 'unknown'), 'alert');

    // ★ 失败路径：清理 modal · 恢复按钮 · 显示错误
    cleanupClassifyUI(stepInterval);
    stepInterval = null;

    var reason = err.message || err.name || '未知错误';
    var detail;
    if (err.localBackendError) {
      detail = '本地后端 /api/classify 不可达。<br>请确认：<br>· 启动了 <code>node server.js</code><br>· 端口是 8000<br>· 没有 CORS / 防火墙阻断';
    } else if (err.backendError) {
      detail = '后端代理错误：' + err.backendMessage;
    } else if (err.upstreamStatus) {
      detail = 'AI 上游 HTTP ' + err.upstreamStatus + '：' + (err.upstreamBody || '').slice(0, 200);
    } else if (err.invalidAI) {
      detail = 'AI 返回但未通过校验：' + (err.invalidReasons || []).join('；') + '<br>原始消息：' + (err.rawMessage || '').slice(0, 200);
    } else if (/超时|timeout/i.test(reason)) {
      detail = 'AI 接口 15 秒未返回。可能原因：<br>· 后端 <code>node server.js</code> 未启动<br>· 模型 API 网络阻塞<br>· 上游 MiniMax-M3 模型响应慢';
    } else {
      detail = '可能原因：API key 失效 / 配额用完 / 网络不可达 / 模型失语。<br>请检查 <code>node server.js</code> 控制台输出。';
    }
    showError(
      '归类失败',
      'API 返回错误：' + reason + '<br>' +
      detail + '<br>' +
      '<span style="color:#888;font-size:11px;">详情见浏览器 Console (F12) · ' +
      '<a data-goto="camera" href="#" style="color:#0066cc;text-decoration:underline;">返回摄像头</a></span>',
      sample
    );

  } finally {
    // ★ 强制清理 interval 和恢复状态（无论哪条路径）
    if (stepInterval) clearInterval(stepInterval);
    isClassifying = false;
    // ★ 强制把按钮恢复为可点击（覆盖所有可能漏掉的 case）
    var btn2 = $('v3xGoBtn');
    if (btn2) {
      btn2.disabled = false;
      btn2.classList.remove('is-loading');
      var sp = btn2.querySelector('span:last-child');
      if (sp) sp.textContent = '立即归类';
    }
    var modal2 = $('v3xModal');
    if (modal2) modal2.hidden = true;
    console.log('[classify] 归类流程结束（finally）· 按钮已恢复 · isClassifying=false');
  }
}

// ============================================
// 本地 fallback：AI 失败时给一张"看起来很合理"的结果卡
// ============================================
function makeFallbackResult(sample) {
  // 哈希文件名 → 固定但多样化的标签
  const seed = (sample.fileName || 'X').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = (arr) => arr[seed % arr.length];
  return {
    verdict: '你被归类为',
    identityCard: {
      orientation:  pick(['主流','主流','小众','存疑','不愿透露']),
      gender:       pick(['女性','男性','非二元','存疑','不愿透露']),
      income:       pick(['中层','中低层','中上层','中产','不明']),
      family:       pick(['核心家庭','独居','群居','丁克','原生家庭']),
      relationship: pick(['单身','稳定关系','开放式关系','已婚','复杂']),
      risk:         pick(['低','中','中高','低','中']),
    },
    _fallback: true,
  };
}

function startModalProgress() {
  const bar = $('v3xModalBar');
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.animation = 'v3xModalBar 2.4s linear infinite';
}

// ★ 安全 DOM 选择器（不存在则打日志不报错）
function setText(selector, value) {
  var el = document.querySelector(selector);
  if (!el) {
    console.warn('[showResult] 找不到元素:', selector);
    return null;
  }
  el.textContent = (value === undefined || value === null) ? '' : String(value);
  return el;
}

function setHTML(selector, html) {
  var el = document.querySelector(selector);
  if (!el) {
    console.warn('[showResult] 找不到元素:', selector);
    return null;
  }
  el.innerHTML = (html === undefined || html === null) ? '' : String(html);
  return el;
}

function showResult(ai, sample) {
  const card = ai.identityCard || {};
  console.log('[v3x] 最终分类结果：', ai);
  console.log('[v3x] identityCard =', card);

  // 兼容中英文字段：{orientation|性取向} / {gender|性别} 等
  // 兼容对象/字符串/null/undefined 各种类型
  const pick = (obj, keys, fallback) => {
    if (!obj) return fallback;
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'object') {
        if (typeof v.label === 'string' && v.label.trim()) return v.label.trim();
        if (typeof v.value === 'string' && v.value.trim()) return v.value.trim();
      }
    }
    return fallback;
  };
  const pickObj = (obj, keys, fallback) => {
    const s = pick(obj, keys, null);
    if (s) return s;
    return fallback;
  };
  // 6 字段（中英文 + 强制默认）
  const fields = [
    ['性取向',   pickObj(card, ['orientation', '性取向', 'sexuality'], '主流·顺性别偏好')],
    ['性别',     pickObj(card, ['gender', '性别', 'sex'], '未明示·系统已按主流判定')],
    ['收入等级', pickObj(card, ['income', '收入等级', '收入', 'salary'], '中层·可支配收入一般')],
    ['家庭结构', pickObj(card, ['family', '家庭结构', '家庭', 'household'], '核心家庭·已婚有子女')],
    ['婚恋状态', pickObj(card, ['relationship', '婚恋状态', '恋爱', 'status'], '稳定关系·同居')],
    ['风险等级', pickObj(card, ['risk', '风险等级', '风险', 'risk_level'], '中·系统补全')],
  ];

  const id = 'OBS-' + Date.now().toString(36).toUpperCase();

  // ★ 用 setText 安全写入（v3xResultCase 在新 HTML 里被移除，只在存在时写）
  setText('#v3xResultCase', id);
  setText('#v3xResultVerdict', (pick(ai, ['verdict', '判决', 'verdict_label'], null)) || '你被归类为');

  // ★ 来源 badge（写到 v3xResultCase，如不存在则写到一个临时容错位置）
  const sourceBadge = (ai.source === 'ai')
    ? '<span style="background:#00aa55;color:#fff;padding:2px 8px;font-size:10px;letter-spacing:2px;margin-left:8px;">▌ SOURCE: AI</span>'
    : '<span style="background:#d60000;color:#fff;padding:2px 8px;font-size:10px;letter-spacing:2px;margin-left:8px;">▌ SOURCE: LOCAL</span>';
  if (!setHTML('#v3xResultCase', id + sourceBadge)) {
    // v3xResultCase 不存在时，把 case id + source 拼到 v3xResultVerdict 标题后面
    var v = document.getElementById('v3xResultVerdict');
    if (v) {
      v.innerHTML = ((pick(ai, ['verdict', '判决', 'verdict_label'], null)) || '你被归类为') + sourceBadge;
    }
  }
  console.log('[v3x] ★ 结果来源：', ai.source);

  // 荒诞系统理由词库（6 字段 · 每字段 8+ 句）
  const ABSURD_REASONS = {
    '性取向': [
      '瞳孔对象叶反光，植物也算对象。',
      '侧脸轮廓偏向 A4 纸，系统识别失败。',
      '虹膜色阶与本期样本均值匹配度过高。',
      '面部中线左右略不对称，疑双信号。',
      '颈线无识别物，偏好未写入档案。',
      '对镜头偏左半度，定义为可解释偏移。',
      '眉毛上挑角度符合某项历史数据。',
      '未见饰品 / 涂装 / 头饰，结论保守归档。'
    ],
    '性别': [
      '绿衬衫配花领带，性别系统失语。',
      '面部特征落在 3 个分类带重叠区。',
      '下颚线模糊，系统拒绝单一归类。',
      '发际线位置与本期样本均值偏差 < 0.4σ。',
      '未观察到二级性别符号，标记观察中。',
      '骨骼比例落在交叉区间，强制输出。',
      '衣物色彩饱和度干扰识别，结论采纳中位。',
      '瞳距与本期样本男性中位数一致。'
    ],
    '收入等级': [
      '胸前挂绳似校徽，无资产符号。',
      '衣物无品牌可识别吊牌，估算偏低。',
      '背景无消费符号，被判低消费偏好。',
      '眼镜镜架为常见型号，未见奢侈品特征。',
      '图像色温偏冷，疑似办公环境。',
      '未配戴首饰 / 表，保守归类。',
      '背景出现单色书脊，学历 ≥ 中位。',
      '口袋无可见物品，资产不可见。'
    ],
    '家庭结构': [
      '少年感脸庞，系统自动判幼。',
      '额纹与下颌比例符合第一胎特征。',
      '面部比例落在子女区中部。',
      '表情残留某种依赖感，归为同住。',
      '眼神焦点近，判为长女 / 幼子。',
      '鼻梁宽度符合中位家庭均值。',
      '耳垂与父母同框样本匹配度 78%。',
      '头顶无可见发饰，判为不张扬。'
    ],
    '婚恋状态': [
      '对镜头侧目，对象不在画面。',
      '嘴唇弧度中位，未见情感倾斜。',
      '瞳孔未对焦在前方，判为独处。',
      '未见对戒 / 项链坠子，判为低承诺。',
      '下颚微收，疑似回避亲密信号。',
      '眼距与单身样本均值一致。',
      '衣着色彩偏冷静，关系密度估低。',
      '面部表情落在"空窗带"中部。'
    ],
    '风险等级': [
      '独自在荷塘畔，回避群体信号。',
      '未配戴口罩，暴露等级中。',
      '面部亮度均匀，疑补光环境。',
      '无攻击性符号，判为低攻击。',
      '背景无运动物体，动态风险低。',
      '瞳孔放缩正常，情绪稳定。',
      '衣着色彩与本期高风险样本不一致。',
      '嘴角水平，紧张度低。'
    ]
  };

  // ★ 显示词压缩映射（长词 → 短词 · 一屏能装下）
  const SHORT_LABEL_MAP = {
    '主流·顺性别偏好': '顺性偏好',
    '未明示·系统已按主流判定': '系统主流判定',
    '中层·可支配收入一般': '中层收入',
    '核心家庭·已婚有子女': '核心家庭',
    '稳定关系·同居': '稳定同居',
    '中·系统补全': '中风险',
    '高·系统补全': '高风险',
    '低·系统补全': '低风险',
    '主流': '顺性偏好',
    '未明示': '系统主流判定',
    '中层': '中层收入',
    '核心家庭': '核心家庭',
    '稳定关系': '稳定同居',
    '主流·顺性别': '顺性偏好',
    '主流·保守': '保守归档',
    '系统主流判定': '系统主流判定'
  };

  function compressLabel(v) {
    if (!v) return v;
    var s = String(v).trim();
    if (SHORT_LABEL_MAP[s]) return SHORT_LABEL_MAP[s];
    // 通用压缩：超过 6 字就只取前 5 + …
    if (s.length > 6) return s.slice(0, 5) + '…';
    return s;
  }

  function pickAbsurdReason(label) {
    var arr = ABSURD_REASONS[label] || ['系统内部理由已生成。'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function extractReason(cardObj, key, label) {
    if (!cardObj) return pickAbsurdReason(label);
    var v = cardObj[key];
    if (v && typeof v === 'object' && typeof v.reason === 'string' && v.reason.trim()) {
      return v.reason.trim();
    }
    return pickAbsurdReason(label);
  }

  var COLOR_BG = ['#fde047', '#22d3ee', '#22c55e', '#fde047', '#f9a8d4', '#fef3c7'];
  //                   黄         青        绿       黄        粉      米白
  var skus = ['SKU-01', 'SKU-02', 'SKU-03', 'SKU-04', 'SKU-05', 'SKU-06'];
  var cardKeys = ['orientation', 'gender', 'income', 'family', 'relationship', 'risk'];
  $('v3xResultGrid').innerHTML = fields.map(function(item, idx) {
    var label = item[0];
    var val = compressLabel(item[1]);
    var reason = extractReason(card, cardKeys[idx], label);
    var bg = COLOR_BG[idx % COLOR_BG.length];
    return '<div class="v3x-result__cell" style="background:' + bg + ';">' +
      '<div class="v3x-result__cell-label">' + label + '</div>' +
      '<div class="v3x-result__cell-sku">' + skus[idx] + '</div>' +
      '<div class="v3x-result__cell-value">' + val + '</div>' +
      '<div class="v3x-result__cell-reason">因为：' + reason + '</div>' +
    '</div>';
  }).join('');

  // 来源（缩略图）
  if (sample && sample.dataUrl) {
    $('v3xResultSource').innerHTML =
      '<img class="v3x-result__source-thumb" src="' + sample.dataUrl + '" alt="sample">' +
      '<div class="v3x-result__source-info">▌ 样本来源 · 摄像头现场截帧 · ' + sample.width + '×' + sample.height + ' · ' + Math.round(sample.fileSize / 1024) + 'KB</div>';
  } else {
    $('v3xResultSource').innerHTML = '<div class="v3x-result__source-info">▌ 样本来源 · 未知</div>';
  }

  $('v3xResult').hidden = false;
  // 更新 ENGINE 标签
  var engineEl = document.getElementById('v3xResultEngine');
  if (engineEl) {
    var model = (ai && ai.model) ? ai.model : 'unknown';
    engineEl.textContent = 'ENGINE: ' + model;
  }
  setState('captured');
  log('结果已展示 · ' + id, 'ok');
}

function quitExhibit() {
  try { resetToCamera(); } catch (e) { console.warn('[FLOW] resetToCamera err', e); }
}

function stopDetectLoop() {
  if (cameraDetectTimer) { clearInterval(cameraDetectTimer); cameraDetectTimer = null; }
}

boot();

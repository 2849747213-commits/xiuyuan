// 端到端 mock 流程：runWesternAIAnalysis 走 mock 路径，跑通 IIFE 拉 AI reason
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const dataJs = fs.readFileSync(path.join(__dirname, 'js', 'western-14-samples-data.js'), 'utf8');
const pipelineJs = fs.readFileSync(path.join(__dirname, 'js', 'western-ai-pipeline.js'), 'utf8');
const skinHtml = fs.readFileSync(path.join(__dirname, '_preview', 'western-skin.html'), 'utf8');
const manifest = fs.readFileSync(path.join(__dirname, 'assets', 'sample-library', 'western', 'western-image-manifest.json'), 'utf8');

(async () => {
  const logs = [];
  const vc = new VirtualConsole();
  vc.on('log', (...a) => logs.push(['L', ...a].join(' ')));
  vc.on('warn', (...a) => logs.push(['W', ...a].join(' ')));
  vc.on('error', (...a) => logs.push(['E', ...a].join(' ')));

  // 模拟 SPA
  const SPA = { LAST_WESTERN_AIREASONS: null, LAST_WESTERN_VM: null, LAST_WESTERN_MODE: null, showResultOverlay: () => console.log('  [SPA] showResultOverlay("western") called') };
  // 模拟 result-layer
  const resultLayerHTML = '<div id="result-layer" style="position:relative;"><iframe class="result-frame" src=""></iframe></div>';

  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body>' + resultLayerHTML + '</body></html>', {
    url: 'http://localhost/exhibition-camera/index.html',
    runScripts: 'outside-only',
    virtualConsole: vc,
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.fetch = async () => ({ ok: true, json: async () => JSON.parse(manifest) });
  // 模拟 lockedSnapshot (摄像头帧)
  window.__lockedSnapshot = {
    dataUrl: 'data:image/jpeg;base64,fake',
    faceLandmarks: Array.from({ length: 478 }, (_, i) => ({ x: i, y: i })),
    faceDetected: true,
    capturedAt: Date.now()
  };
  // 模拟 window.SPA
  window.SPA = SPA;
  // 模拟 SPA.LAST_WESTERN_AIREASONS 在 mock 模式会自动写入

  window.eval(dataJs);
  window.eval(pipelineJs);
  console.log('=== runWesternAIAnalysis() · mock 模式 ===');
  await window.runWesternAIAnalysis();
  await new Promise(r => setTimeout(r, 100));

  console.log('');
  console.log('=== SPA 状态 ===');
  console.log('  LAST_WESTERN_MODE       =', SPA.LAST_WESTERN_MODE);
  console.log('  LAST_WESTERN_VM.sampleId=', SPA.LAST_WESTERN_VM && SPA.LAST_WESTERN_VM.sampleId);
  console.log('  LAST_WESTERN_VM.source =', SPA.LAST_WESTERN_VM && SPA.LAST_WESTERN_VM.source);
  console.log('  LAST_WESTERN_AIREASONS =', JSON.stringify(SPA.LAST_WESTERN_AIREASONS).slice(0, 200));

  // ★ 现在模拟 IIFE 拉 LAST_WESTERN_AIREASONS 并 apply
  console.log('');
  console.log('=== IIFE 模拟 · 拉 AI reason 应用到 western-skin ===');
  const skin = new JSDOM(skinHtml, {
    url: 'http://localhost/exhibition-camera/_preview/western-skin.html?id=W01&v=5&mock=1',
    runScripts: 'outside-only',
    virtualConsole: vc,
    pretendToBeVisual: true
  });
  const sw = skin.window;
  sw.fetch = async () => ({ ok: true, json: async () => JSON.parse(manifest) });
  Object.defineProperty(sw, 'parent', { value: { SPA: SPA }, writable: false, configurable: true });
  sw.eval(dataJs);
  const iifeStart = skinHtml.indexOf('(function () {', skinHtml.indexOf('<script>'));
  const iifeEnd = skinHtml.indexOf('})();', iifeStart) + 5;
  sw.eval(skinHtml.substring(iifeStart, iifeEnd));
  await new Promise(r => setTimeout(r, 350)); // 等 setTimeout(250)

  const cells = Array.from(skin.window.document.querySelectorAll('.grid-section .cell'));
  console.log('  cells count:', cells.length);
  cells.forEach((c, i) => {
    const reason = c.querySelector('.reason');
    const text = reason ? reason.textContent.replace(/\s+/g, ' ').slice(0, 110) : '(none)';
    const badge = c.querySelector('.ai-reason-badge');
    console.log('  cell[' + i + '] ' + (badge ? '▌AI' : '   ') + ' ' + text);
  });

  // ★ 验证 MOCK banner 出现（result-layer 在 sw 父页面的，应该被 sw 看到？sw 是 western-skin iframe，看不到父页面的 DOM）
  console.log('');
  console.log('=== 关键日志 ===');
  logs.filter(l => l.includes('MOCK') || l.includes('WESTERN_AI') || l.includes('AIR')).forEach(l => console.log('  ', l));
})();

// Verify western IIFE applyWesternAIR + pipeline viewModel reason override
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

  // ★ 模拟 SPA · 父页面存 LAST_WESTERN_AIREASONS + LAST_WESTERN_VM + applyWesternAIR 函数
  const SPA = { LAST_WESTERN_AIREASONS: null, LAST_WESTERN_VM: null };

  // ★ 模拟 AI 返回值（包含 dimensionReasons）
  const fakeAI = {
    sampleId: 'W01',
    confidence: 'high',
    shortReason: 'AI 视觉匹配 · 此人下颌/眉眼最接近苏格拉底雕像',
    matchedFeatures: ['下颌宽', '眉眼不对称', '鼻梁低', '额头高'],
    visionCheck: { hasFace: true, wearingGlasses: false, headPose: 'front', framing: 'face-closeup', brightness: 'medium' },
    source: 'ai',
    dimensionReasons: {
      status:      '此人的面孔不具有古典英雄标准，但思考/反诘的神态被系统归入哲人例外',
      temperament: '眉眼微抬、口型微闭、头部微倾，呈现出反诘型智者的视觉气质',
      power:       '颧骨与下颌线条不像王权者，但显出在公共空间发声的智识权能',
      body:        '侧影线条不锐利，肩部略松散，符合古希腊非战士群体的身形特征',
      role:        '凝视方向略微旁侧，构图距离中等，呈现道德审问者的画面位置',
      risk:        '低对称性 + 宽下颌 + 厚唇的组合在 19 世纪伪科学里会被误标 · 当前系统不给予高风险'
    }
  };

  const html = skinHtml;
  const dom = new JSDOM(html, {
    url: 'http://localhost/exhibition-camera/_preview/western-skin.html?id=W01',
    runScripts: 'outside-only',
    virtualConsole: vc,
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.fetch = async () => ({ ok: true, json: async () => JSON.parse(manifest) });
  // ★ 模拟 parent.SPA · IIFE 会读 window.parent.SPA
  Object.defineProperty(window, 'parent', { value: { SPA: SPA }, writable: false, configurable: true });
  // ★ 模拟 parent 写入 LAST_WESTERN_AIREASONS（pipeline 在 iframe load 前已经存好）
  SPA.LAST_WESTERN_AIREASONS = fakeAI.dimensionReasons;

  window.eval(dataJs);
  const iifeStart = html.indexOf('(function () {', html.indexOf('<script>'));
  const iifeEnd = html.indexOf('})();', iifeStart) + 5;
  window.eval(html.substring(iifeStart, iifeEnd));
  // 等 350ms 让 setTimeout(250) 触发
  await new Promise(r => setTimeout(r, 350));

  const doc = window.document;
  const cells = Array.from(doc.querySelectorAll('.grid-section .cell'));
  console.log('=== W01 6 宫格 · reason 测试 ===');
  cells.forEach((c, i) => {
    const reason = c.querySelector('.reason');
    const text = reason ? reason.textContent.replace(/\s+/g, ' ').slice(0, 130) : '(none)';
    const badge = c.querySelector('.ai-reason-badge');
    const isAI = !!badge;
    console.log('  cell[' + i + '] ' + (isAI ? '▌AI' : '   ') + ' reason:', text);
  });
  console.log('');
  // ★ 测试 pipeline 的 buildWesternViewModel 是否把 AI reason 注入 vm
  window.eval(pipelineJs);
  const vm = window.buildWesternViewModel(fakeAI);
  console.log('=== pipeline.buildWesternViewModel · reasonOrigin ===');
  console.log('  reasonOrigin:', JSON.stringify(vm.reasonOrigin));
  console.log('  statusReason      =', vm.statusReason.slice(0, 80));
  console.log('  temperamentReason =', vm.temperamentReason.slice(0, 80));
  console.log('  riskReason        =', vm.riskReason.slice(0, 80));
  console.log('');
  console.log('=== IIFE 注入运行日志 ===');
  logs.filter(l => l.includes('[WESTERN') || l.includes('AIR')).forEach(l => console.log('  ', l));
})();

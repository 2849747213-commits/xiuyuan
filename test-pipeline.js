// Verify western-ai-pipeline viewModel build
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const dataJs = fs.readFileSync(path.join(__dirname, 'js', 'western-14-samples-data.js'), 'utf8');
const pipelineJs = fs.readFileSync(path.join(__dirname, 'js', 'western-ai-pipeline.js'), 'utf8');

const html = `<!DOCTYPE html><html><head></head><body></body></html>`;
const dom = new JSDOM(html, { url: 'http://localhost/exhibition-camera/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const vc = new VirtualConsole();
vc.on('log', (...a) => console.log('  [L]', ...a));
vc.on('warn', (...a) => console.log('  [W]', ...a));
vc.on('error', (...a) => console.log('  [E]', ...a));
dom.window._virtualConsole = vc;

window.eval(dataJs);
console.log('after data.js: WESTERN_14_SAMPLES.length =', (window.WESTERN_14_SAMPLES || []).length);

window.eval(pipelineJs);
console.log('after pipeline.js: window.runWesternAIAnalysis =', typeof window.runWesternAIAnalysis);
console.log('after pipeline.js: window.buildWesternViewModel =', typeof window.buildWesternViewModel);

const TARGETS = ['W01', 'W05', 'W09', 'W14'];
for (const sid of TARGETS) {
  const aiResult = {
    sampleId: sid,
    confidence: 'high',
    shortReason: 'AI matches ' + sid + ' by visual similarity',
    matchedFeatures: ['visual 1', 'visual 2'],
    visionCheck: { hasFace: true, wearingGlasses: false, headPose: 'front', framing: 'face-closeup', brightness: 'medium' },
    source: 'ai'
  };
  try {
    const vm = window.buildWesternViewModel(aiResult);
    console.log('=== ' + sid + ' ===');
    console.log('  sampleId            =', vm.sampleId);
    console.log('  sampleName          =', vm.sampleName);
    console.log('  sampleNameEn        =', vm.sampleNameEn);
    console.log('  statusValue         =', vm.statusValue);
    console.log('  temperamentValue    =', vm.temperamentValue);
    console.log('  powerValue          =', vm.powerValue);
    console.log('  bodyValue           =', vm.bodyValue);
    console.log('  roleValue           =', vm.roleValue);
    console.log('  riskValue           =', vm.riskValue);
    console.log('  engineLabel         =', vm.engineLabel);
    console.log('  source              =', vm.source);
  } catch (e) {
    console.error('  ' + sid + ' FAIL: ' + e.message);
  }
}

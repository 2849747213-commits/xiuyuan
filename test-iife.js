// Simulate browser load: load html, eval IIFE, verify replacements
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '_preview', 'western-skin.html'), 'utf8');
const dataJs = fs.readFileSync(path.join(__dirname, 'js', 'western-14-samples-data.js'), 'utf8');
const manifest = fs.readFileSync(path.join(__dirname, 'assets', 'sample-library', 'western', 'western-image-manifest.json'), 'utf8');

const TARGETS = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12', 'W13', 'W14'];

async function testOne(sid) {
  const logs = [];
  const vc = new VirtualConsole();
  vc.on('log', (...a) => logs.push(['L', ...a].join(' ')));
  vc.on('warn', (...a) => logs.push(['W', ...a].join(' ')));
  vc.on('error', (...a) => logs.push(['E', ...a].join(' ')));

  const dom = new JSDOM(html, {
    url: 'http://localhost/exhibition-camera/_preview/western-skin.html?id=' + sid,
    runScripts: 'outside-only',
    virtualConsole: vc,
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.fetch = async () => ({ ok: true, json: async () => JSON.parse(manifest) });
  window.eval(dataJs);
  const iifeStart = html.indexOf('(function () {', html.indexOf('<script>'));
  const iifeEnd = html.indexOf('})();', iifeStart) + 5;
  window.eval(html.substring(iifeStart, iifeEnd));
  await new Promise(r => setTimeout(r, 200));
  const doc = window.document;
  const cells = Array.from(doc.querySelectorAll('.grid-section .cell'));
  const a = doc.querySelector('.actions');
  const e = Array.from(doc.querySelectorAll('section')).find(s => s.textContent.includes('ARCHIVE EVIDENCE STRIP'));
  // e 在 a 之前 = PRECEDING(2)  = 注入到 .actions 之前
  const posOk = !!(a && e && (a.compareDocumentPosition(e) & window.Node.DOCUMENT_POSITION_PRECEDING));
  return {
    sid,
    id: doc.querySelector('.id .accent')?.textContent,
    meta: doc.querySelector('.heading .meta')?.textContent?.slice(0, 60),
    sub: doc.querySelector('.heading .sub')?.textContent?.slice(0, 50),
    stamp: doc.querySelector('.verdict-stamp')?.textContent,
    file: doc.querySelector('.archive-cell.note .label span')?.textContent,
    firstLabel: doc.querySelector('.archive-strip.three .archive-cell:first-child .label span')?.textContent,
    cells: cells.map(c => ({ verdict: c.querySelector('.verdict')?.textContent, sku: c.querySelector('.sku')?.textContent })),
    fsTitle: doc.querySelector('.fs-strip__title')?.textContent,
    evidenceStrip: !!e,
    evidenceBeforeActions: posOk,
    logs
  };
}

(async () => {
  const ROWS = [];
  for (const sid of TARGETS) {
    const r = await testOne(sid);
    const verdicts = r.cells.map(c => c.verdict).join(' / ');
    ROWS.push({
      sid,
      sampleName: r.stamp,
      file: r.file,
      firstLabel: r.firstLabel,
      verdicts,
      evidenceStrip: r.evidenceStrip,
      beforeActions: r.evidenceBeforeActions
    });
  }
  console.log('===== 14 SAMPLE FULL TEST · W01-W14 =====');
  console.log('sid  | sampleName                | file    | firstLabel                 | evidence-before-actions');
  console.log('-----+---------------------------+---------+----------------------------+-------------------------');
  ROWS.forEach(r => {
    const pad = (s, n) => String(s).padEnd(n, ' ');
    console.log(pad(r.sid, 5) + '| ' + pad(r.sampleName, 26) + '| ' + pad(r.file, 8) + '| ' + pad(r.firstLabel, 27) + '| ' + r.evidenceStrip + ' / ' + r.beforeActions);
  });
  console.log('');
  ROWS.forEach(r => {
    console.log('--- ' + r.sid + ' 6 宫格 verdict ---');
    r.verdicts.split(' / ').forEach((v, i) => console.log('  WP-0' + (i + 1) + ' = ' + v));
  });
  const allOk = ROWS.every(r => r.evidenceStrip === true && r.beforeActions === true && typeof r.file === 'string' && r.file.length > 0 && typeof r.sampleName === 'string' && r.sampleName.length > 0 && typeof r.firstLabel === 'string' && r.firstLabel.length > 0);
  const failed = ROWS.filter(r => !(r.evidenceStrip === true && r.beforeActions === true && typeof r.file === 'string' && r.file.length > 0 && typeof r.sampleName === 'string' && r.sampleName.length > 0 && typeof r.firstLabel === 'string' && r.firstLabel.length > 0));
  console.log('');
  console.log('===== RESULT: ' + (allOk ? 'ALL 14 SAMPLES PASS ✓' : 'SOME FAILED ✗ · ' + failed.length + ' rows: ' + failed.map(f => f.sid).join(',')) + ' =====');
  if (failed.length) {
    failed.forEach(f => console.log('   FAILED ' + f.sid + ':', 'evidenceStrip=' + JSON.stringify(f.evidenceStrip), 'beforeActions=' + JSON.stringify(f.beforeActions), 'file=' + JSON.stringify(f.file), 'sampleName=' + JSON.stringify(f.sampleName), 'firstLabel=' + JSON.stringify(f.firstLabel)));
  }
})();

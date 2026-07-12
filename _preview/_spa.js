// _spa.js · 验证 SPA 状态机 + 单页不跳页
const http = require('http');
function get(path) {
  return new Promise((res, rej) => {
    const req = http.request({ hostname: 'localhost', port: 8000, path, method: 'GET', timeout: 10000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', rej);
    req.end();
  });
}
(async () => {
  console.log('==== 1. index.html SPA 状态机检查 ====');
  const idx = await get('/exhibition-camera/index.html');
  const checks = {
    has_window_SPA: idx.body.includes('window.SPA = window.SPA || {}'),
    has_data_view_pathSelect: idx.body.includes('data-view="pathSelect"'),
    has_data_view_ancient: idx.body.includes('data-view="ancient"'),
    has_data_view_modern: idx.body.includes('data-view="modern"'),
    has_data_view_western: idx.body.includes('data-view="western"'),
    has_data_goto_attr: idx.body.includes('data-goto'),
    has_history_pushState_block: idx.body.includes('history.pushState = function(state, title, url)'),
    has_window_location_setter: idx.body.includes('window, \'location\''),
    has_spa_goto_pathselect: idx.body.includes('SPA.gotoPathSelect'),
    has_spa_goto_ancient: idx.body.includes('SPA.gotoAncient'),
    has_spa_goto_modern: idx.body.includes('SPA.gotoModern'),
    has_spa_goto_western: idx.body.includes('SPA.gotoWestern'),
    has_spa_goto_camera: idx.body.includes('SPA.gotoCamera'),
    has_inject_back_btn: idx.body.includes('injectBackBtn'),
    no_internal_html_href: !/<a href="[^"]*\.html/i.test(idx.body),
  };
  Object.entries(checks).forEach(([k, v]) => console.log('  ' + (v ? '✓' : '✗') + ' ' + k + ' = ' + v));
  const allOK = Object.values(checks).every(v => v);
  console.log('  ALL OK = ' + allOK);

  console.log('');
  console.log('==== 2. path-overlay-v5.html 三张卡片 ====');
  const pov = await get('/exhibition-camera/_preview/path-overlay-v5.html?v=v9');
  const pathChecks = {
    ancient_has_data_goto: /<a class="path-ancient" data-goto="ancient"/.test(pov.body),
    modern_has_data_goto: /<a class="path-modern" data-goto="modern"/.test(pov.body),
    western_has_data_goto: /<a class="path-western" data-goto="western"/.test(pov.body),
    no_window_location_href: !/window\.location\.href\s*=\s*['"]/.test(pov.body),
    keyboard_1_uses_spa: /SPA\.gotoAncient/.test(pov.body),
    keyboard_2_uses_spa: /SPA\.gotoModern/.test(pov.body),
    keyboard_3_uses_spa: /SPA\.gotoWestern/.test(pov.body),
  };
  Object.entries(pathChecks).forEach(([k, v]) => console.log('  ' + (v ? '✓' : '✗') + ' ' + k + ' = ' + v));

  console.log('');
  console.log('==== 3. exhibition.js 跳转清理 ====');
  const ex = await get('/exhibition-camera/exhibition.js');
  const exChecks = {
    no_window_location_html: !/window\.location\.href\s*=\s*['"][^'"]*\.html/i.test(ex.body),
    gotoPathOverlay_calls_SPA: /SPA\.gotoPathSelect/.test(ex.body),
    quitExhibit_calls_SPA: /SPA\.gotoCamera/.test(ex.body),
    no_javascript_reload: !/javascript:location\.reload\(\)/.test(ex.body),
    has_data_goto_camera: /data-goto="camera"/.test(ex.body),
  };
  Object.entries(exChecks).forEach(([k, v]) => console.log('  ' + (v ? '✓' : '✗') + ' ' + k + ' = ' + v));

  console.log('');
  console.log('==== 4. 三结果页纯净（无内部跳转）====');
  for (const sys of ['ancient', 'modern', 'western']) {
    const p = sys === 'ancient' ? '/exhibition-camera/_preview/ancient-skin-v4.html?v=4' :
              sys === 'modern'  ? '/exhibition-camera/_preview/modern-result-preview.html' :
                                  '/exhibition-camera/_preview/western-skin.html?v=6';
    const r = await get(p);
    const c = {
      status_200: r.status === 200,
      no_internal_html_href: !/<a href="[^"]*\.html/i.test(r.body),
      no_window_location: !/window\.location/.test(r.body),
    };
    console.log('  ' + sys + ' :: ' + JSON.stringify(c));
  }

  console.log('');
  console.log('==== 5. locked.html 完整性（未触碰）====');
  for (const f of ['camera-overlay-ui.locked.html?v=current', 'ancient-skin-v4.locked.html', 'modern-skin.locked.html', 'western-skin-v6.locked.html', 'systems-overview-v2.locked.html']) {
    const r = await get('/exhibition-camera/_preview/' + f);
    console.log('  ' + (r.status === 200 ? '✓' : '✗') + ' ' + f + ' = ' + r.status + ' ' + r.body.length + 'B');
  }

  console.log('');
  console.log('==== DONE ====');
})().catch(e => { console.error('OUTER ERR', e); process.exit(1); });

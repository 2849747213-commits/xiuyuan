// _reset.js · 验证 resetToCamera + 3 轮连续分析
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

(async () => {
  console.log('==== 启动 jsdom ====');
  const dom = await JSDOM.fromURL('http://localhost:8000/exhibition-camera/index.html?_devtest=fake-cam', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    storageQuota: 10000000,
  });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 4000));
  console.log('  SPA.currentView =', window.SPA?.currentView);
  console.log('  resetToCamera exists:', typeof window.resetToCamera);

  // 跑 3 轮：start → 选 system → result → resetToCamera → 重复
  for (let round = 1; round <= 3; round++) {
    const sys = ['ancient', 'modern', 'western'][round - 1];
    console.log(`\n==== 第 ${round} 轮: system=${sys} ====`);
    // 1) 模拟点开始分析
    window.SPA.gotoPathSelect();
    await new Promise(r => setTimeout(r, 200));
    console.log('  step1 gotoPathSelect · currentView =', window.SPA.currentView);
    console.log('  body.forked:', window.document.body.classList.contains('forked'));
    // 2) 选 system
    const card = window.document.querySelector(`#v3xFallbackPathSelect [data-system="${sys}"]`) ||
                 window.document.querySelector(`[data-view="pathSelect"] .path-${sys}`);
    console.log('  step2 card found:', !!card);
    if (card) {
      const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
      card.dispatchEvent(ev);
      await new Promise(r => setTimeout(r, 600));
    }
    console.log('  step3 after select · currentView =', window.SPA.currentView);
    // 3) 调 resetToCamera
    if (typeof window.resetToCamera === 'function') {
      window.resetToCamera();
      await new Promise(r => setTimeout(r, 200));
      console.log('  step4 after resetToCamera · currentView =', window.SPA.currentView);
      console.log('  body.forked:', window.document.body.classList.contains('forked'));
    } else {
      console.log('  ★ resetToCamera NOT FOUND');
    }
  }

  // 验证 location
  console.log('\n==== location 验证 ====');
  console.log('  location =', window.location.href);

  console.log('\n==== DONE ====');
  dom.window.close();
})().catch(e => { console.error('OUTER ERR', e); process.exit(1); });

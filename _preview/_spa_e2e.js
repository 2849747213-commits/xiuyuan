// _spa_e2e.js · headless jsdom 模拟单页流程
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

(async () => {
  console.log('==== 启动 jsdom 加载 http://localhost:8000/exhibition-camera/index.html ====');
  const dom = await JSDOM.fromURL('http://localhost:8000/exhibition-camera/index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    storageQuota: 10000000,
  });
  const { window } = dom;
  // 等 SPA 启动
  await new Promise(r => setTimeout(r, 5000));
  console.log('  SPA.currentView =', window.SPA?.currentView);
  console.log('  current location =', window.location.href);
  console.log('  pathSelect has data-goto: ', !!window.document.querySelector('[data-view="pathSelect"] [data-goto]'));
  console.log('  ancient has data-goto: ', !!window.document.querySelector('[data-view="ancient"] [data-goto]'));
  console.log('  modern has data-goto: ', !!window.document.querySelector('[data-view="modern"] [data-goto]'));
  console.log('  western has data-goto: ', !!window.document.querySelector('[data-view="western"] [data-goto]'));
  console.log('  back btn in pathSelect: ', !!window.document.querySelector('[data-view="pathSelect"] .v3x-spa-back'));
  console.log('  back btn in ancient: ', !!window.document.querySelector('[data-view="ancient"] .v3x-spa-back'));
  console.log('  back btn in modern: ', !!window.document.querySelector('[data-view="modern"] .v3x-spa-back'));
  console.log('  back btn in western: ', !!window.document.querySelector('[data-view="western"] .v3x-spa-back'));

  // 模拟 1. SPA.gotoPathSelect
  console.log('---- 模拟 window.SPA.gotoPathSelect()');
  window.SPA.gotoPathSelect();
  await new Promise(r => setTimeout(r, 200));
  console.log('  currentView =', window.SPA.currentView, ' location =', window.location.href);

  // 模拟 2. 点 古代卡
  console.log('---- 模拟点击 path-ancient');
  const ancientCard = window.document.querySelector('[data-view="pathSelect"] a.path-ancient');
  console.log('  ancientCard found:', !!ancientCard, ' data-goto =', ancientCard?.getAttribute('data-goto'));
  if (ancientCard) {
    // 触发 click
    const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    ancientCard.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 500));
    console.log('  currentView =', window.SPA.currentView, ' location =', window.location.href);
    console.log('  ancient view is-active: ', window.document.querySelector('[data-view="ancient"]')?.classList.contains('is-active'));
  }

  // 模拟 3. 点 "返回摄像头"
  console.log('---- 模拟点 [data-goto="camera"]');
  const back = window.document.querySelector('[data-view="ancient"] .v3x-view-back-btn[data-goto="camera"]');
  console.log('  back btn found:', !!back);
  if (back) {
    const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    back.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 500));
    console.log('  currentView =', window.SPA.currentView, ' location =', window.location.href);
  }

  // 模拟 4. SPA.gotoPathSelect + 点 现代
  console.log('---- 模拟 SPA.gotoPathSelect + click modern');
  window.SPA.gotoPathSelect();
  await new Promise(r => setTimeout(r, 200));
  const modernCard = window.document.querySelector('[data-view="pathSelect"] a.path-modern');
  if (modernCard) {
    const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    modernCard.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 500));
    console.log('  currentView =', window.SPA.currentView, ' location =', window.location.href);
  }

  // 模拟 5. SPA.gotoPathSelect + 点 西方
  console.log('---- 模拟 SPA.gotoPathSelect + click western');
  window.SPA.gotoPathSelect();
  await new Promise(r => setTimeout(r, 200));
  const westernCard = window.document.querySelector('[data-view="pathSelect"] a.path-western');
  if (westernCard) {
    const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    westernCard.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 500));
    console.log('  currentView =', window.SPA.currentView, ' location =', window.location.href);
  }

  // 6. 验证 location 从未变化
  console.log('==== 验证 location ====');
  console.log('  整个过程 location =', window.location.href);
  console.log('  expect: http://localhost:8000/exhibition-camera/index.html');
  console.log('  match:', window.location.href === 'http://localhost:8000/exhibition-camera/index.html' || window.location.href === 'http://localhost:8000/exhibition-camera/index.html#pathSelect');

  // 7. 键盘 1/2/3 测试
  console.log('---- 键盘 1');
  const ev1 = new window.KeyboardEvent('keydown', { key: '1', bubbles: true });
  window.document.dispatchEvent(ev1);
  await new Promise(r => setTimeout(r, 200));
  console.log('  after key 1: currentView =', window.SPA.currentView);

  console.log('---- 键盘 2');
  const ev2 = new window.KeyboardEvent('keydown', { key: '2', bubbles: true });
  window.document.dispatchEvent(ev2);
  await new Promise(r => setTimeout(r, 200));
  console.log('  after key 2: currentView =', window.SPA.currentView);

  console.log('---- 键盘 3');
  const ev3 = new window.KeyboardEvent('keydown', { key: '3', bubbles: true });
  window.document.dispatchEvent(ev3);
  await new Promise(r => setTimeout(r, 200));
  console.log('  after key 3: currentView =', window.SPA.currentView);

  console.log('---- 键盘 Escape');
  const ev0 = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
  window.document.dispatchEvent(ev0);
  await new Promise(r => setTimeout(r, 200));
  console.log('  after key Esc: currentView =', window.SPA.currentView);

  console.log('==== DONE ====');
  dom.window.close();
})().catch(e => { console.error('OUTER ERR', e); process.exit(1); });

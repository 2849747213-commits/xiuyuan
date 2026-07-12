// _flow.js · 真实模拟 SPA · fetch 成功加载 path-overlay-v5
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

  // ★ jsdom 默认有 fetch（如果用 resources）。但为了稳定，monkey-patch window.fetch
  const pathOverlayBody = await (async () => {
    const r = await fetch('http://localhost:8000/exhibition-camera/_preview/path-overlay-v5.html?v=v9');
    return await r.text();
  })();
  console.log('  preloaded pathOverlayBody length =', pathOverlayBody.length);

  // 替代 fetch：永远用 Node 真实拉数据
  window.fetch = async (url) => {
    if (typeof url === 'string') {
      const r = await fetch(url);
      return {
        ok: r.ok || r.status === 200,
        status: r.status,
        text: async () => await r.text()
      };
    }
    return { ok: false, status: 404, text: async () => '' };
  };

  await new Promise(r => setTimeout(r, 4000));

  console.log('==== 检查 pathSelect view 内容 ====');
  const pathSelect = window.document.querySelector('[data-view="pathSelect"]');
  console.log('  has .v3x-fork:', !!pathSelect?.querySelector('.v3x-fork'));
  console.log('  has .path-ancient:', !!pathSelect?.querySelector('a.path-ancient'));
  console.log('  has .path-modern:', !!pathSelect?.querySelector('a.path-modern'));
  console.log('  has .path-western:', !!pathSelect?.querySelector('a.path-western'));
  console.log('  innerHTML length =', pathSelect?.innerHTML?.length);

  // 切到 pathSelect
  console.log('==== SPA.gotoPathSelect ====');
  window.SPA.gotoPathSelect();
  await new Promise(r => setTimeout(r, 500));
  console.log('  currentView =', window.SPA?.currentView);
  console.log('  is-active:', pathSelect?.classList.contains('is-active'));
  const fb = window.document.getElementById('v3xFallbackPathSelect');
  console.log('  fallback display =', fb?.style?.display);

  // click 古代
  console.log('==== click 古代 ====');
  const ancient = window.document.querySelector('[data-view="pathSelect"] a.path-ancient');
  console.log('  ancient found:', !!ancient);
  if (ancient) {
    const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    ancient.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 600));
    console.log('  currentView =', window.SPA?.currentView);
    console.log('  location =', window.location.href);
    console.log('  fallback display after click =', fb?.style?.display);
  }

  console.log('==== DONE ====');
  dom.window.close();
})().catch(e => { console.error('OUTER ERR', e); process.exit(1); });

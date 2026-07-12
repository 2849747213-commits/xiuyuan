// _build_index.js · 把 path-overlay-v5.html 的 style+body 嵌入 index.html
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const idxPath = path.join(ROOT, 'index.html');
const extPath = path.join(__dirname, '_extracted_pov5.json');
const distPath = path.join(ROOT, '_preview', '_pov5_inline.json');

let idx = fs.readFileSync(idxPath, 'utf8');
const ext = JSON.parse(fs.readFileSync(extPath, 'utf8'));

// ★ 1) 把 path-overlay-v5.html 的 <style> 内容直接注入到 index.html 的 <head>
//     替换占位标记
const stylePlaceholder = '<!-- V3X_FORK_STYLES -->';
const styleInjection = '<!-- V3X_FORK_STYLES · 从 path-overlay-v5.html v9 内联 · 12 张图 200 -->\n' +
  '<style data-v3x-fork="inline">\n' + ext.styles.join('\n') + '\n</style>';

if (idx.includes(stylePlaceholder)) {
  idx = idx.replace(stylePlaceholder, styleInjection);
  console.log('  替换 style 占位标记');
} else {
  // 在 </head> 前注入
  idx = idx.replace('</head>', styleInjection + '\n</head>');
  console.log('  注入 style 到 </head> 前');
}

// ★ 2) 把 path-overlay-v5.html 的 body 内容直接注入到 pathSelect view 的 innerHTML
//     替换占位标记
const bodyPlaceholder = '<!-- V3X_FORK_BODY -->';
const bodyInjection = '<!-- V3X_FORK_BODY · 从 path-overlay-v5.html v9 内联 · 不走 runtime fetch -->\n' + ext.body;

if (idx.includes(bodyPlaceholder)) {
  idx = idx.replace(bodyPlaceholder, bodyInjection);
  console.log('  替换 body 占位标记');
} else {
  console.log('  WARN: 找不到 body 占位标记');
}

// ★ 3) 把三张卡的 href 全部改成 # + data-goto
//     path-overlay-v5.html 内已经是 data-goto=ancient/modern/western · 留之
//     但 href="ancient-skin-v4.html?v=4" 等会触发跳转 · 改成 # 让 SPA 拦截

// ★ 4) 删除运行时 fetch path-overlay-v5.html 的代码（不再需要）
//     旧代码里 SOURCES.pathSelect = '_preview/path-overlay-v5.html?v=v9'
//     改成 'inline' 让 SPA 知道这是内联
idx = idx.replace(
  "pathSelect: '_preview/path-overlay-v5.html?v=v9',",
  "pathSelect: 'INLINE',"
);

// ★ 5) 写回
fs.writeFileSync(idxPath, idx, 'utf8');
console.log('  index.html size:', idx.length);

// 把内联数据也写到 dist 给浏览器缓存路径使用
fs.writeFileSync(distPath, JSON.stringify(ext, null, 2), 'utf8');
console.log('  dist:', distPath);

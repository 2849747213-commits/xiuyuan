// _extract_pov5.js · 提取 path-overlay-v5.html 的 head<style> + body 内容
// 输出到 _preview/_extracted_pov5.js · 供 index.html 直接内联
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'path-overlay-v5.html');
const html = fs.readFileSync(src, 'utf8');

// 提取所有 <style>...</style>
const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const styles = [];
let m;
while ((m = styleRe.exec(html))) {
  styles.push(m[1]);
}

// 提取 body
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const body = bodyMatch ? bodyMatch[1] : '';

// 输出 JSON（避免 escape 问题）
const out = {
  styles: styles,
  body: body,
  meta: {
    stylesCount: styles.length,
    bodyLength: body.length,
    extractedAt: new Date().toISOString()
  }
};

const outPath = path.join(__dirname, '_extracted_pov5.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('extracted ->', outPath);
console.log('  styles =', styles.length, 'blocks');
console.log('  body length =', body.length, 'B');
console.log('  has v3x-fork:', body.includes('v3x-fork'));
console.log('  has path-ancient:', body.includes('path-ancient'));
console.log('  has path-modern:', body.includes('path-modern'));
console.log('  has path-western:', body.includes('path-western'));

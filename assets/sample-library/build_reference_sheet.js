/* build_reference_sheet.js */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const NORMALIZED_DIR = path.join(PROJECT_ROOT, 'exhibition-camera', 'assets', 'sample-library', 'modern', 'normalized');
const REFERENCE_DIR = path.join(PROJECT_ROOT, 'exhibition-camera', 'assets', 'sample-library', 'modern', 'reference');
if (!fs.existsSync(REFERENCE_DIR)) fs.mkdirSync(REFERENCE_DIR, { recursive: true });

const sharp = require(path.join(PROJECT_ROOT, 'node_modules', 'sharp'));

async function buildSheet(role) {
  const COLS = 5, ROWS = 4;
  const CELL = 360;
  const PADDING = 18;
  const LABEL_H = 36;
  const cellFullH = CELL + LABEL_H;
  const W = COLS * CELL + (COLS + 1) * PADDING;
  const H = ROWS * cellFullH + (ROWS + 1) * PADDING;

  // 背景米黄
  const bg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f5ecd0"/>
  </svg>`);

  const composites = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c + 1;
      const sid = 'M' + String(idx).padStart(2, '0');
      const imgPath = path.join(NORMALIZED_DIR, sid + '_sample_' + role + '.jpg');
      const buf = fs.readFileSync(imgPath);
      const resized = await sharp(buf).resize(CELL, CELL, { fit: 'cover' }).toBuffer();
      // 标签 svg 高度 LABEL_H
      const labelSvg = Buffer.from(`<svg width="${CELL}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.85)"/>
        <text x="12" y="27" font-family="Impact, Arial Black, sans-serif" font-size="24" font-weight="900" fill="#f5d400">${sid}</text>
      </svg>`);

      const x = PADDING + c * (CELL + PADDING);
      composites.push({ input: resized, top: PADDING + r * (cellFullH + PADDING), left: x });
      composites.push({ input: labelSvg, top: PADDING + r * (cellFullH + PADDING) + CELL, left: x });
    }
  }

  const out = await sharp(bg).composite(composites).jpeg({ quality: 88 }).toBuffer();
  const outPath = path.join(REFERENCE_DIR, 'modern_reference_' + role + '.jpg');
  fs.writeFileSync(outPath, out);
  console.log('[SHEET] OK', outPath, '·', W + 'x' + H, '· ' + out.length + ' bytes');
  return outPath;
}

(async () => {
  await buildSheet('main');
  await buildSheet('alt');
  console.log('[SHEET] DONE');
})().catch(e => { console.error('[SHEET] FATAL', e); process.exit(1); });
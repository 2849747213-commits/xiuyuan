/* build_modern_images.js
 * 扫描源目录 assets/sample-library/现代/  → 规范化生成 normalized/Mxx_sample_{main|alt|context|archive}.jpg
 * 同时写出 modern_images_manifest.json（带 sha256 / width / height / fileSize / sourceOriginalName）
 * 严格按人物名 → sampleId 映射，不允许跨样本错配。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'exhibition-camera', 'assets', 'sample-library', '现代');
const OUT_DIR = path.join(PROJECT_ROOT, 'exhibition-camera', 'assets', 'sample-library', 'modern', 'normalized');
const MANIFEST = path.join(PROJECT_ROOT, 'exhibition-camera', 'assets', 'sample-library', 'modern_images_manifest.json');

// 严格 人物 → sampleId 映射（中文关键字 → Mxx）
const PERSON_TO_SAMPLEID = {
  '麦琳': 'M01',
  '向佐': 'M02',
  '孙笑川': 'M03',
  '雷军': 'M04',
  '王境泽': 'M05',
  '张雪峰': 'M06',
  '蔡徐坤': 'M07',
  '听泉': 'M08',
  '听泉赏宝': 'M08',
  '易梦玲': 'M09',
  '全红婵': 'M10',
  '全红蝉': 'M10',  // 用户笔误也兼容
  '贾玲': 'M11',
  '李佳琦': 'M12',
  '李佳琪': 'M12',
  '汤姆猫': 'M13',
  '蜡笔小新': 'M14',
  '小妖怪': 'M15',
  '浪浪山小妖怪': 'M15',
  '拉不不': 'M16',
  'Labubu': 'M16',
  '特朗普': 'M17',
  '马斯克': 'M18',
  '丁真': 'M19',
  '柴犬': 'M20',
  'Doge': 'M20'
};

// 源文件解析：01人物名.ext / 02人物名.ext / 03人物名.ext / 04人物名.ext
function parseSrcName(filename) {
  const noExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const m = noExt.match(/^(\d{2})\s*(.+)$/);
  if (!m) return null;
  return { role: m[1], person: m[2].trim() };
}

// 文件解码宽高（PNG / JPEG）
function decodeSize(buf) {
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 1) {
      while (i < buf.length && buf[i] !== 0xFF) i++;
      if (i >= buf.length - 1) break;
      while (i < buf.length - 1 && buf[i + 1] === 0xFF) i++;
      const marker = buf[i + 1];
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        if (i + 7 < buf.length) {
          return { width: buf.readUInt16BE(i + 5), height: buf.readUInt16BE(i + 3) };
        }
      }
      const segLen = buf.readUInt16BE(i + 2);
      i += 2 + segLen;
    }
  }
  return { width: 0, height: 0 };
}

// 用 sharp 不可用 → 退而用 canvas-free JPEG 再编码方案：
// 由于 Node 标准库无图像转换，我们采取【保持原格式但写为 .jpg】：
// - 源若已是 jpeg/jpg：直接复制
// - 源是 png / webp：先读 buffer → 找出 SOI/EOI / IEND；保留原字节流写入目标 .jpg 是不合法的（后缀与内容不符）。
//   浏览器对 .jpg 后缀 + png 内容会解码失败。
// 因此必须真实再编码。我们用一个轻量方案：使用 node 内置 zlib 把 PNG IDAT 重压缩成 BMP-like。
// 简化：若源非 JPEG 且无图像库 → 调用 npm i sharp 安装 sharp 后再跑。
// 这里先写一个"检查器"，检测源是否需要转换并发出警告；下一步再真实解码。

function needsRealReencode(buf) {
  // 真 JPEG: FF D8 FF
  return !(buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF);
}

// 简易 webp/png → jpeg 解码（仅依赖 zlib + 手写 PNG/简单 webp）太复杂 → 退化为：
// 把 png / webp 转成 bmp-like raw → 写为 .jpg 的近似方案（浏览器若无法解码 .jpg 后缀的 raw，则真实转码）
// 真正做法：调用 sharp 安装后真正转码。
// 这里直接检查 sharp 是否可用：
function hasSharp() {
  try { require.resolve('sharp'); return true; } catch (e) { return false; }
}

async function transcodeToJpeg(buffer, format, deriveTag) {
  // deriveTag 用于派生条目，每条用不同 crop 区域使 hash 互异
  if (!hasSharp()) {
    if (format === 'jpeg' || format === 'jpg') return buffer;
    throw new Error('sharp 未安装 · 无法把 ' + format + ' 真实解码成 JPEG');
  }
  const sharp = require('sharp');
  let pipe = sharp(buffer);
  if (deriveTag) {
    // 派生条目做不同 crop + 轻微旋转，确保 hash 不同
    const meta = await sharp(buffer).metadata().catch(() => ({}));
    const W = meta.width || 1000, H = meta.height || 1000;
    const t = String(deriveTag);
    // hash(t) → 不同偏移
    let h = 0; for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
    const a = Math.abs(h);
    // 选 4 个不同 crop 区域之一
    const crops = [
      { left: 0, top: 0, width: Math.floor(W * 0.85), height: Math.floor(H * 0.85) },
      { left: Math.floor(W * 0.15), top: 0, width: Math.floor(W * 0.85), height: Math.floor(H * 0.85) },
      { left: 0, top: Math.floor(H * 0.15), width: Math.floor(W * 0.85), height: Math.floor(H * 0.85) },
      { left: Math.floor(W * 0.1), top: Math.floor(H * 0.1), width: Math.floor(W * 0.8), height: Math.floor(H * 0.8) }
    ];
    const c = crops[a % crops.length];
    try {
      pipe = sharp(buffer).extract(c).resize(Math.min(900, c.width)).jpeg({ quality: 80 + (a % 10) });
    } catch (e) {
      pipe = sharp(buffer).jpeg({ quality: 80 + (a % 10) });
    }
  } else {
    pipe = pipe.jpeg({ quality: 85 });
  }
  return await pipe.toBuffer();
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function extFromBuf(buf) {
  if (buf[0] === 0xFF && buf[1] === 0xD8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF') return 'webp';
  return 'bin';
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = fs.readdirSync(SRC_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log('[BUILD] src files =', files.length);

  // 1. 把每个源文件归类到 sampleId × role
  const buckets = {};  // buckets[sampleId] = { main: null, alt: null, context: null, archive: null }
  const personMap = {}; // M03 → '孙笑川' (canonical)
  let skipped = 0;
  for (const f of files) {
    const parsed = parseSrcName(f);
    if (!parsed) { console.warn('[BUILD] skip (unparseable):', f); skipped++; continue; }
    const sid = PERSON_TO_SAMPLEID[parsed.person];
    if (!sid) { console.warn('[BUILD] skip (unknown person):', f); skipped++; continue; }
    if (!buckets[sid]) buckets[sid] = {};
    const roleMap = { '01': 'main', '02': 'alt', '03': 'context', '04': 'archive' };
    const role = roleMap[parsed.role];
    if (!role) { console.warn('[BUILD] skip (unknown role):', f); skipped++; continue; }
    buckets[sid][role] = { originalName: f, person: parsed.person, path: path.join(SRC_DIR, f) };
    personMap[sid] = parsed.person;
    console.log('[BUILD] map', sid, role, '<-', f);
  }

  // 2. 填补 archive / context / alt 缺失（04系列只有 5 个）· 用 main 派生
  for (const sid of Object.keys(buckets)) {
    const order = ['main', 'alt', 'context'];
    for (const r of order) {
      if (!buckets[sid][r]) {
        // 优先用 main（与已填入的 role 错开 hash）
        const order2 = ['main', 'alt', 'context', 'archive'];
        const idx = order2.indexOf(r);
        let src = buckets[sid].main;
        if (!src) {
          for (let k = idx - 1; k >= 0; k--) { if (buckets[sid][order2[k]]) { src = buckets[sid][order2[k]]; break; } }
        }
        if (!src) src = buckets[sid].alt || buckets[sid].context;
        if (src) { buckets[sid][r] = Object.assign({}, src, { _derived: true, _deriveFrom: src.originalName }); console.log('[BUILD] derive', sid, r, 'from', src.originalName); }
      }
    }
    if (!buckets[sid].archive && buckets[sid].main) {
      buckets[sid].archive = Object.assign({}, buckets[sid].main, { _derived: true, _deriveFrom: buckets[sid].main.originalName });
      console.log('[BUILD] derive', sid, 'archive from main');
    }
    if (!buckets[sid].archive && buckets[sid].alt) {
      buckets[sid].archive = Object.assign({}, buckets[sid].alt, { _derived: true, _deriveFrom: buckets[sid].alt.originalName });
      console.log('[BUILD] derive', sid, 'archive from alt');
    }
  }

  // 3. 写出 normalized/Mxx_sample_{role}.jpg + manifest
  const manifest = { generatedAt: new Date().toISOString(), entries: [] };
  let okCount = 0;
  for (const sid of Object.keys(buckets).sort()) {
    const b = buckets[sid];
    const canonicalPerson = personMap[sid];
    for (const role of ['main', 'alt', 'context', 'archive']) {
      const slot = b[role];
      if (!slot) { console.error('[BUILD] FAIL no source for', sid, role); continue; }
      const buf = fs.readFileSync(slot.path);
      const fmt = extFromBuf(buf);
      const deriveTag = slot._derived ? (sid + '_' + role + '_' + (slot._deriveFrom || '')) : null;
      let outBuf;
      try {
        outBuf = await transcodeToJpeg(buf, fmt, deriveTag);
      } catch (e) {
        console.error('[BUILD] FAIL transcode', sid, role, e.message);
        continue;
      }
      const outName = sid + '_sample_' + role + '.jpg';
      const outPath = path.join(OUT_DIR, outName);
      fs.writeFileSync(outPath, outBuf);
      const size = decodeSize(outBuf);
      const hash = sha256(outBuf);
      manifest.entries.push({
        sampleId: sid,
        sampleName: SID_TO_NAME[sid],
        role: role,
        path: 'assets/sample-library/modern/normalized/' + outName,
        absoluteUrl: '/exhibition-camera/assets/sample-library/modern/normalized/' + outName,
        sourceOriginalName: slot.originalName,
        sourcePerson: canonicalPerson,
        sourceLabel: '0' + ({main:'1',alt:'2',context:'3',archive:'4'}[role]) + canonicalPerson,
        isDerivedCrop: !!slot._derived,
        width: size.width,
        height: size.height,
        fileSize: outBuf.length,
        sha256: hash
      });
      okCount++;
      console.log('[BUILD] OK', sid, role, '←', slot.originalName, '·', size.width + 'x' + size.height, '· sha256=' + hash.slice(0, 12));
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log('[BUILD] manifest =', MANIFEST);
  console.log('[BUILD] OK entries =', okCount, '/ total =', manifest.entries.length);
  console.log('[BUILD] skipped source files =', skipped);
}

const SID_TO_NAME = {
  M01: '麦琳脸', M02: '向佐脸', M03: '孙笑川脸', M04: '雷军脸',
  M05: '王境泽脸', M06: '张雪峰脸', M07: '蔡徐坤脸', M08: '听泉赏宝脸',
  M09: '易梦玲脸', M10: '全红婵脸', M11: '贾玲脸', M12: '李佳琦脸',
  M13: '汤姆猫脸', M14: '蜡笔小新脸', M15: '浪浪山小妖怪脸', M16: 'Labubu脸',
  M17: '特朗普脸', M18: '马斯克脸', M19: '丁真脸', M20: 'Doge脸'
};

main().catch(e => { console.error('[BUILD] fatal', e); process.exit(1); });
/* build_western.js
 * 一次性完成：
 * 1. 扫描 西方/ 目录
 * 2. 关键词归类到 W01-W14
 * 3. 数字 / (2) (3) (4) 后缀解析为 main/alt/context/archive slot
 * 4. sharp 标准化 → western/normalized/Wxx_sample_{slot}.jpg
 * 5. 缺失 slot 从 main/alt 派生（严格按类别）
 * 6. 计算 sha256
 * 7. 写出 western-image-manifest.json
 * 8. 重复 hash 警告
 * 9. 控制台完整日志
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'sharp'));

const SRC_DIR = 'D:\\TRAE SOLO CN\\程序艺术作业\\exhibition-camera\\assets\\sample-library\\西方';
const OUT_DIR = 'D:\\TRAE SOLO CN\\程序艺术作业\\exhibition-camera\\assets\\sample-library\\western\\normalized';
const MANIFEST = 'D:\\TRAE SOLO CN\\程序艺术作业\\exhibition-camera\\assets\\sample-library\\western\\western-image-manifest.json';

// 14 个样本 + 关键词
const SAMPLES = [
  { id: 'W01', name: '苏格拉底脸',          nameEn: 'SOCRATES FACE',                keywords: ['苏格拉底'] },
  { id: 'W02', name: '亚历山大大帝脸',      nameEn: 'ALEXANDER THE GREAT FACE',    keywords: ['亚历山大大帝', '亚历山大'] },
  { id: 'W03', name: '尼禄脸',              nameEn: 'NERO FACE',                   keywords: ['尼禄'] },
  { id: 'W04', name: '圣女贞德脸',          nameEn: 'JOAN OF ARC FACE',            keywords: ['圣女贞德', '贞德'] },
  { id: 'W05', name: '伊丽莎白一世脸',      nameEn: 'ELIZABETH I FACE',            keywords: ['伊丽莎白一世', '伊丽莎白'] },
  { id: 'W06', name: '路易十四脸',          nameEn: 'LOUIS XIV FACE',              keywords: ['路易十四'] },
  { id: 'W07', name: '玛丽·安托瓦内特脸',  nameEn: 'MARIE ANTOINETTE FACE',       keywords: ['玛丽安托瓦内特', '玛丽·安托瓦内特', '玛丽-安托瓦内特'] },
  { id: 'W08', name: '拿破仑脸',            nameEn: 'NAPOLEON FACE',               keywords: ['拿破仑'] },
  { id: 'W09', name: '文艺复兴女性肖像型',  nameEn: 'RENAISSANCE FEMALE PORTRAIT', keywords: ['文艺复兴女性'] },
  { id: 'W10', name: '梵高自画像型',        nameEn: 'VAN GOGH SELF-PORTRAIT',      keywords: ['梵高'] },
  { id: 'W11', name: '阿尔钦博托复合脸',    nameEn: 'ARCIMBOLDO COMPOSITE HEAD',   keywords: ['阿尔钦博托'] },
  { id: 'W12', name: '梅塞施密特性格头像',  nameEn: 'MESSERSCHMIDT CHARACTER',     keywords: ['梅塞施密', '梅塞施密特'] },
  { id: 'W13', name: '拉瓦特侧影相',        nameEn: 'LAVATERIAN PROFILE',          keywords: ['拉瓦特'] },
  { id: 'W14', name: '天生罪犯型',          nameEn: 'LOMBROSIAN CRIMINAL TYPE',    keywords: ['天生罪犯'] }
];

const SLOTS = ['main', 'alt', 'context', 'archive'];

// ============ 1. 扫描文件 ============
function scanFiles() {
  const files = fs.readdirSync(SRC_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log('[WESTERN_SCAN] found files:', files.length);
  return files;
}

// ============ 2. 关键词归类 ============
function classifyFile(filename) {
  // 去掉扩展名 + 数字前缀 + 后缀 (2)(3)(4) _ -
  const base = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  // 提取数字标记：开头的 01-04 或尾部 (2)/(3)/(4)
  let slot = null;
  const numMatch = base.match(/^(\d{1,2})/);
  let prefixNum = null;
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 4) {
      prefixNum = n;
      slot = SLOTS[n - 1];
    }
  }
  // 尾部的 (2)/(3)/(4) / （2）/（3）/（4） / _2 _3 _4 -2 -3 -4 / 2 3 4（裸数字）
  if (!slot) {
    const paren = base.match(/[\(（]\s*([234])\s*[\)）]/);
    if (paren) {
      const n = parseInt(paren[1], 10);
      slot = SLOTS[n - 1];
    }
  }
  if (!slot) {
    const tailNum = base.match(/[\s_\-]\s*([234])$/);
    if (tailNum) {
      const n = parseInt(tailNum[1], 10);
      slot = SLOTS[n - 1];
    }
  }
  if (!slot) {
    const tailDotNum = base.match(/\.([234])$/);
    if (tailDotNum) {
      const n = parseInt(tailDotNum[1], 10);
      slot = SLOTS[n - 1];
    }
  }
  // 天生罪犯2.jpg / 天生罪犯3.jpg —— 数字紧跟关键词
  if (!slot) {
    const trailingNum = base.match(/([234])$/);
    if (trailingNum) {
      const n = parseInt(trailingNum[1], 10);
      slot = SLOTS[n - 1];
    }
  }
  // 关键词匹配
  let sampleId = null;
  for (const s of SAMPLES) {
    if (s.keywords.some(kw => base.indexOf(kw) >= 0)) {
      sampleId = s.id;
      break;
    }
  }
  // 排除其他人物关键词（防止串图）
  const forbid = ['奥古斯都', 'Augustus', '凯撒', 'Caesar', '理查', 'Richard', '亨利', 'Henry', '戴珍珠', '蒙娜丽莎', 'Mona'];
  for (const f of forbid) {
    if (base.indexOf(f) >= 0) {
      console.log('[WESTERN_FORBID] ' + filename + ' contains forbid keyword: ' + f);
      return null;
    }
  }

  // 兜底：如果归类到 sampleId 但 slot 仍未确定 → 默认 main（基图）
  if (!slot && sampleId) slot = 'main';

  return { sampleId, slot, prefixNum };
}

// ============ 3. 派生规则 ============
// 从 sourceBuf 按 slot 派生新 buffer
async function deriveCrop(sourceBuf, slot, sampleId, sourceMeta) {
  // sourceMeta: {width, height}
  const W = sourceMeta.width || 800, H = sourceMeta.height || 800;
  // 长边限制 1600
  const longSide = Math.max(W, H);
  let pipe = sharp(sourceBuf).rotate();
  let cropW = W, cropH = H, left = 0, top = 0;
  switch (slot) {
    case 'context': {
      // 较宽语境裁切：保留全图，但更窄的垂直范围
      cropH = Math.round(H * 0.85);
      top = Math.round((H - cropH) / 2);
      cropW = W;
      left = 0;
      break;
    }
    case 'archive': {
      // 面部局部裁切：中央 60% 区域
      const factor = 0.6;
      cropW = Math.round(W * factor);
      cropH = Math.round(H * factor);
      left = Math.round((W - cropW) / 2);
      top = Math.round((H - cropH) / 2);
      break;
    }
    default: break;
  }
  if (slot !== 'main' && slot !== 'alt') {
    pipe = pipe.extract({ left, top, width: cropW, height: cropH });
  }
  // 限制长边
  if (Math.max(cropW, cropH) > 1600) {
    const scale = 1600 / Math.max(cropW, cropH);
    cropW = Math.round(cropW * scale);
    cropH = Math.round(cropH * scale);
    pipe = pipe.resize(cropW, cropH);
  } else if (cropW !== W || cropH !== H) {
    pipe = pipe.resize(cropW, cropH);
  }
  return await pipe.jpeg({ quality: 90, mozjpeg: false }).toBuffer();
}

// ============ 4. 处理 ============
async function build() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = scanFiles();
  const perSample = {};
  SAMPLES.forEach(s => { perSample[s.id] = { name: s.name, nameEn: s.nameEn, slots: {} }; });

  for (const f of files) {
    const info = classifyFile(f);
    if (!info || !info.sampleId || !info.slot) {
      console.log('[WESTERN_UNKNOWN]', f, info);
      continue;
    }
    if (perSample[info.sampleId].slots[info.slot]) {
      console.log('[WESTERN_DUP_SLOT]', info.sampleId, info.slot, '· old=', perSample[info.sampleId].slots[info.slot], '· new=', f);
      // Keep first encountered
      continue;
    }
    perSample[info.sampleId].slots[info.slot] = f;
    console.log('[WESTERN_MAP]', info.sampleId, '·', perSample[info.sampleId].name, '·', info.slot, '<-', f);
  }

  // 对每个 sample 检查四个 slot 完整
  const hashSet = new Map();
  const manifest = {};
  let dupCount = 0;
  for (const s of SAMPLES) {
    const id = s.id;
    const slots = perSample[id].slots;
    const sampleDir = path.join(OUT_DIR, id);
    if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true });
    manifest[id] = {
      sampleName: s.name,
      sampleNameEn: s.nameEn,
      main: null, alt: null, context: null, archive: null
    };

    // 收集可用原图（按 main → alt → context → archive 顺序）
    const haveSlots = [];
    for (const sl of SLOTS) {
      if (slots[sl]) haveSlots.push({ slot: sl, file: slots[sl] });
    }

    // 缺失补位
    for (const targetSlot of SLOTS) {
      const sourceEntry = slots[targetSlot];
      let derived = false, derivedFrom = null, cropType = null;
      let outBuf = null, outPath = null, originalPath = null, originalFilename = null;

      if (sourceEntry) {
        originalFilename = sourceEntry;
        originalPath = path.join(SRC_DIR, sourceEntry);
        outBuf = fs.readFileSync(originalPath);
        outPath = path.join(sampleDir, id + '_sample_' + targetSlot + '.jpg');
      } else {
        // 派生
        if (!haveSlots.length) {
          console.log('[WESTERN_MISSING]', id, 'no source for derive');
          continue;
        }
        const sourceFile = haveSlots[Math.min(haveSlots.length - 1, targetSlot === 'context' ? 1 : (targetSlot === 'archive' ? 0 : 0))].file;
        originalFilename = sourceFile;
        originalPath = path.join(SRC_DIR, sourceFile);
        const srcBuf = fs.readFileSync(originalPath);
        const meta = await sharp(srcBuf).metadata();
        outBuf = await deriveCrop(srcBuf, targetSlot, id, { width: meta.width, height: meta.height });
        derived = true;
        derivedFrom = sourceFile;
        cropType = targetSlot;
        outPath = path.join(sampleDir, id + '_sample_' + targetSlot + '.jpg');
        console.log('[WESTERN_DERIVE]', id, targetSlot, '<- generated from', sourceFile, '(' + cropType + ')');
      }

      fs.writeFileSync(outPath, outBuf);
      const ext = path.extname(outBuf === null ? originalPath : '').toLowerCase() || '.jpg';
      const outMeta = await sharp(outBuf).metadata();
      const sha = crypto.createHash('sha256').update(outBuf).digest('hex');
      if (hashSet.has(sha)) {
        console.log('[WESTERN_IMAGE_DUPLICATE]', id, targetSlot, '· same as', hashSet.get(sha));
        dupCount++;
      } else {
        hashSet.set(sha, id + '/' + targetSlot);
      }
      manifest[id][targetSlot] = {
        normalizedPath: outPath.replace(/^D:\\TRAE SOLO CN\\程序艺术作业\\exhibition-camera/, '/exhibition-camera').replace(/\\/g, '/'),
        normalizedPathFs: outPath,
        originalPath: originalPath.replace(/^D:\\TRAE SOLO CN\\程序艺术作业\\exhibition-camera/, '/exhibition-camera').replace(/\\/g, '/'),
        originalFilename: originalFilename,
        extension: ext.replace('.', ''),
        width: outMeta.width,
        height: outMeta.height,
        bytes: outBuf.length,
        sha256: sha,
        derived: derived,
        derivedFrom: derivedFrom,
        cropType: cropType
      };
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  // 汇总
  let mainOk = 0, altOk = 0, contextOk = 0, archiveOk = 0, derivedCount = 0;
  for (const id of Object.keys(manifest)) {
    if (manifest[id].main) mainOk++;
    if (manifest[id].alt) altOk++;
    if (manifest[id].context) contextOk++;
    if (manifest[id].archive) archiveOk++;
    for (const sl of SLOTS) {
      if (manifest[id][sl] && manifest[id][sl].derived) derivedCount++;
    }
  }
  console.log('\n[WESTERN_MAPPING_COMPLETE]');
  console.log('samples:', SAMPLES.length);
  console.log('main:', mainOk + '/' + SAMPLES.length);
  console.log('alt:', altOk + '/' + SAMPLES.length);
  console.log('context:', contextOk + '/' + SAMPLES.length);
  console.log('archive:', archiveOk + '/' + SAMPLES.length);
  console.log('missing:', SAMPLES.length * 4 - mainOk - altOk - contextOk - archiveOk);
  console.log('derived crops:', derivedCount);
  console.log('duplicate hashes:', dupCount);
  console.log('manifest:', MANIFEST);
  return manifest;
}

build().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
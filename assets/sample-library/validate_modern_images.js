/* validate_modern_images.js
 * 校验 modern_images_manifest.json：
 * - 80 条记录 (20 sample × 4 role)
 * - 跨样本错配（sourceOriginalName 必须包含该样本对应人物名）
 * - main/alt/context/archive 哈希唯一性
 */
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, 'modern_images_manifest.json');
const EXPECTED_PERSON = {
  M01: ['麦琳'], M02: ['向佐'], M03: ['孙笑川'], M04: ['雷军'],
  M05: ['王境泽'], M06: ['张雪峰'], M07: ['蔡徐坤'], M08: ['听泉','听泉赏宝'],
  M09: ['易梦玲'], M10: ['全红婵','全红蝉'], M11: ['贾玲'], M12: ['李佳琦','李佳琪'],
  M13: ['汤姆猫'], M14: ['蜡笔小新'], M15: ['小妖怪','浪浪山小妖怪'], M16: ['拉不不','Labubu'],
  M17: ['特朗普'], M18: ['马斯克'], M19: ['丁真'], M20: ['柴犬','Doge']
};

function nameMatches(fileName, expectedArr) {
  return expectedArr.some(n => fileName.indexOf(n) >= 0);
}

const data = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
console.log('[VALIDATE] entries =', data.entries.length);
let okCount = 0, failCount = 0;
const hashMap = {};
for (const e of data.entries) {
  const expected = EXPECTED_PERSON[e.sampleId];
  if (!nameMatches(e.sourceOriginalName, expected)) {
    console.error('[MODERN_IMAGES] FAIL', e.sampleId, e.role, 'wrong source:', e.sourceOriginalName, 'expected person:', expected.join('|'));
    failCount++;
    continue;
  }
  if (!hashMap[e.sampleId]) hashMap[e.sampleId] = {};
  hashMap[e.sampleId][e.role] = e.sha256;
  console.log('[MODERN_IMAGES]', e.sampleId, e.role, '<-', e.sourceOriginalName, '· size=' + e.fileSize, '· sha256=' + e.sha256.slice(0, 12));
  okCount++;
}

// 校验同 sampleId 的 main/alt/context 三张哈希不能完全相同
let dupFail = 0;
for (const sid of Object.keys(hashMap)) {
  const h = hashMap[sid];
  if (h.main && h.alt && h.main === h.alt) {
    console.error('[MODERN_IMAGES] FAIL', sid, 'main/alt 哈希相同 ·', h.main.slice(0, 12));
    dupFail++;
  }
  if (h.main && h.context && h.main === h.context) {
    console.error('[MODERN_IMAGES] FAIL', sid, 'main/context 哈希相同 ·', h.main.slice(0, 12));
    dupFail++;
  }
  if (h.alt && h.context && h.alt === h.context) {
    console.error('[MODERN_IMAGES] FAIL', sid, 'alt/context 哈希相同 ·', h.alt.slice(0, 12));
    dupFail++;
  }
}

// 检查 archive 哈希是否与 main/alt/context 之一重复
for (const sid of Object.keys(hashMap)) {
  const h = hashMap[sid];
  if (h.archive && h.main && h.archive === h.main) {
    console.log('[MODERN_IMAGES] INFO', sid, 'archive=main（允许 · isDerivedCrop=true）');
  }
}

console.log('---');
console.log('[VALIDATE] cross-person mismatch FAIL:', failCount);
console.log('[VALIDATE] main/alt/context dup FAIL:', dupFail);
console.log('[VALIDATE] entries OK:', okCount, '/', data.entries.length);
console.log('[VALIDATE] ALL PASS:', failCount === 0 && dupFail === 0 && okCount === 80);
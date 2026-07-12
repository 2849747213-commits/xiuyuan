/* inject_visual_profile.js
 * 给 modern-local-system.js 中的 M01-M20 自动注入 visualProfile 字段
 * 不触碰现有 sexuality_value / gender_value 等社会字段
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'js', 'modern-local-system.js');
let src = fs.readFileSync(FILE, 'utf8');

const PROFILES = {
  M01: ['成年女性', '椭圆偏长脸', '短发或中长发', '眉眼圆润', '鼻部中等', '下颌柔和', '表情通常较丰富'],
  M02: ['成年男性', '窄长脸型', '短黑发', '眉眼锐利', '鼻梁高挺', '下颌较窄', '常见动态表情'],
  M03: ['成年男性', '偏圆或偏宽脸型', '短黑发', '眉眼平直', '鼻部较宽', '下颌偏宽', '低修饰度'],
  M04: ['成年男性', '椭圆偏长脸', '短黑发', '常见眼镜', '眉眼温和', '下颌较窄', '常见微笑'],
  M05: ['成年男性', '偏圆脸', '短发', '眉眼平直', '鼻部中等', '下颌偏宽', '表情变化夸张'],
  M06: ['成年男性', '圆形或宽形脸', '短发', '经常佩戴眼镜', '口型表达明显', '面中部较饱满'],
  M07: ['成年男性', '窄长脸', '短发', '眉眼细长', '鼻梁高挺', '下颌尖锐', '高对比妆容'],
  M08: ['成年男性', '偏方脸', '短发', '眉眼粗直', '鼻部较宽', '下颌方阔', '口型夸张'],
  M09: ['成年女性', '椭圆小脸', '长发', '眉眼细长', '鼻梁中等', '下颌尖锐', '高完成度滤镜'],
  M10: ['未成年面孔', '圆润脸', '短发', '眉眼自然', '鼻部小巧', '下颌柔和', '表情松弛'],
  M11: ['成年女性', '圆脸偏宽', '短发或盘发', '眉眼弯细', '鼻部中等', '下颌圆厚', '笑容夸张'],
  M12: ['成年男性', '椭圆脸', '短发', '眉眼较平', '鼻部中等', '下颌较窄', '口型动态'],
  M13: ['虚拟猫科拟人形象', '圆润猫脸', '虚拟面部', '大眼', '鼻部小巧', '夸张表情', '无种族'],
  M14: ['动漫幼体形象', '圆润脸', '动漫眉毛粗短', '鼻部小巧', '下颌圆厚', '夸张表情', '儿童气质'],
  M15: ['国漫妖怪形象', '非人类轮廓', '圆润耳朵', '素描感面部', '鼻部小巧', '草根气质'],
  M16: ['潮玩形象', '丑萌轮廓', '尖锐牙型', '夸张耳朵', '卡通面部', '毛绒材质'],
  M17: ['成年男性', '椭圆脸', '浅色头发', '眉眼较窄', '鼻部中等', '下颌较窄', '口型鲜明'],
  M18: ['成年男性', '窄长脸', '短发', '眉眼平直', '鼻部中等', '下颌较窄', '低表情幅度'],
  M19: ['成年男性', '椭圆脸', '短发', '眉眼自然', '鼻部中等', '下颌柔和', '高原素颜'],
  M20: ['柴犬拟人形象', '圆润犬脸', '斜眼', '虚拟面部', '彩色内心独白字幕']
};

let insertCount = 0;
for (const [sid, profile] of Object.entries(PROFILES)) {
  const profileStr = JSON.stringify(profile, null, 2).replace(/\n/g, '\n      ');
  const re = new RegExp('("sampleId"\\s*:\\s*"' + sid + '"[\\s\\S]*?"sampleName"\\s*:\\s*"[^"]+",)');
  if (re.test(src)) {
    src = src.replace(re, function (match, p1) {
      if (match.includes('"visualProfile"')) return match;
      return p1 + '\n    "visualProfile": ' + profileStr + ',';
    });
    insertCount++;
  }
}

fs.writeFileSync(FILE, src);
console.log('[INJECT] inserted visualProfile into', insertCount, 'samples');
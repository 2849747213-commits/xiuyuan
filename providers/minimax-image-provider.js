// ============================================
// MiniMax image-01 Provider · 通过 /image_generation
// - 已实测: 同一 AI_API_KEY 可直接调通
// - 支持 subject_reference 单图 (用户图) + 文字 prompt 描述样本
// - 双图融合由 prompt 描述样本风格实现 (避免传两张图被供应商拒)
// - 返回: { ok, source, imageUrl | imageDataUrl, raw }
// ============================================
const https = require('https');
const { URL } = require('url');

const SAMPLE_NAMES = {
  A01: '武则天相', A02: '慈禧相', A03: '张居正相', A04: '严嵩相',
  A05: '海瑞相',   A06: '包拯相', A07: '狄仁杰相', A08: '于谦相',
  A09: '王阳明相', A10: '徐渭相', A11: '蒲松龄相', A12: '苏轼相',
  A13: '王昭君相', A14: '杨贵妃相', A15: '柳如是相', A16: '陈圆圆相'
};

function buildPrompt(sampleId, sampleName) {
  return [
    '生成一张完整、统一、重新创作的竖向人物肖像。',
    '主体参考图（subject_reference）来自当前摄像头用户。必须严格保留该用户可辨识的面部结构：脸型、眉眼关系、鼻部、嘴部和整体神态。',
    '将当前用户写入中国古代相书「' + sampleName + '」档案：吸收该历史样本的古代发式、冠帽、服饰、姿态、绘画语言、纸张质感和档案气质，但不要直接复制历史样本人物的整张脸。',
    '最终图像表现为：系统把当代用户强制写入该历史人物脸谱档案后形成的新肖像。',
    '画面为单人、正面或轻微侧面、胸像构图、竖向 4:5（接近 3:4 比例）。',
    '整体视觉接近古代人物画像、旧卷宗、设色纸本、历史档案肖像与轻微半写实再创作。',
    '保留自然的人脸结构，不要产生双脸、额外眼睛、重复五官、扭曲手部或多个人头。',
    '禁止左右拼图。禁止透明叠加。禁止双重曝光。禁止把两个人并排放置。',
    '禁止保留摄影房间背景。禁止现代 UI、文字、标签、水印、印章文字或随机汉字。',
    '禁止直接变成历史样本的原人物。',
    '输出必须是一张新的、完整统一的融合肖像。',
    '归类档案：' + sampleId,
    '样本名称：' + sampleName
  ].join('\n');
}

// 在 Browser/Node 都可用 · https 模块直接发请求
function callUpstream({ baseUrl, apiKey, model, prompt, userImageDataUrl, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const endpoint = baseUrl.replace(/\/$/, '') + '/image_generation';
    const payload = {
      model: model,
      prompt: prompt,
      subject_reference: [
        { type: 'character', image_file: userImageDataUrl }
      ],
      aspect_ratio: '3:4',
      n: 1,
      response_format: 'url',
      prompt_optimizer: false
    };
    const data = JSON.stringify(payload);
    const url = new URL(endpoint);
    const opts = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data, 'utf8')
      },
      timeout: timeoutMs || 90 * 1000
    };
    const req = https.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: body, headers: res.headers });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('upstream-timeout')); });
    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

function parseUpstream(bodyText) {
  let parsed;
  try { parsed = JSON.parse(bodyText); } catch (e) {
    return { ok: false, error: 'invalid-image-response', message: '供应商返回非 JSON' };
  }
  const baseResp = parsed && parsed.base_resp;
  const statusCode = baseResp && typeof baseResp.status_code === 'number' ? baseResp.status_code : 0;
  if (statusCode !== 0) {
    return {
      ok: false,
      error: 'image-generation-failed',
      message: '供应商生图失败 · ' + ((baseResp && baseResp.status_msg) || 'unknown'),
      upstreamStatusCode: statusCode,
      upstreamStatusMsg: (baseResp && baseResp.status_msg) || 'unknown'
    };
  }
  const data = parsed && parsed.data;
  const meta = parsed && parsed.metadata;
  const failedCount = (meta && typeof meta.failed_count === 'string') ? parseInt(meta.failed_count, 10) : 0;
  const successCount = (meta && typeof meta.success_count === 'string') ? parseInt(meta.success_count, 10) : 0;
  let imageUrl = null;
  let imageBase64 = null;
  if (data && Array.isArray(data.image_urls) && data.image_urls.length) {
    imageUrl = data.image_urls[0];
  } else if (data && Array.isArray(data.image_base64) && data.image_base64.length) {
    imageBase64 = 'data:image/png;base64,' + data.image_base64[0];
  }
  if (!imageUrl && !imageBase64) {
    return {
      ok: false,
      error: 'invalid-image-response',
      message: '供应商未返回图片 URL 或 base64',
      failedCount, successCount
    };
  }
  return {
    ok: true,
    imageUrl: imageUrl,
    imageDataUrl: imageBase64,
    successCount, failedCount
  };
}

module.exports = {
  providerId: 'minimax-image-01',
  SAMPLE_NAMES: SAMPLE_NAMES,
  buildPrompt: buildPrompt,
  callUpstream: callUpstream,
  parseUpstream: parseUpstream
};

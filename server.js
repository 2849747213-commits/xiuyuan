// ============================================
// 本地后端代理 · 解决"前端读不到 .env 的 key"问题
// 启动: node server.js
// 端口: 8000
// 浏览器只请求 /api/classify · 拿真实 AI 响应
// ============================================
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { URL } = require('url');
const classifyPipeline = require('./js/classify-pipeline');

const PORT = parseInt(process.env.PORT || '8000', 10);
// 关键：找 .env 时向上找 1 级（兼容从上级目录启动）
const DIRECTORY = __dirname;
const SEARCH_DIR = fs.existsSync(path.join(DIRECTORY, '.env')) ? DIRECTORY : path.join(DIRECTORY, '..');

// 读 .env
function loadEnv() {
  const envPath = path.join(SEARCH_DIR, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of txt.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) { console.warn('[server] read .env failed:', e); }
  return env;
}
const ENV = loadEnv();
const AI_BASE_URL = ENV.AI_BASE_URL || process.env.AI_BASE_URL || 'https://api.minimaxi.com/v1';
const AI_API_KEY  = ENV.AI_API_KEY  || process.env.AI_API_KEY  || '';
const AI_MODEL    = ENV.AI_MODEL    || process.env.AI_MODEL    || 'MiniMax-M3';

console.log('[server] AI_BASE_URL =', AI_BASE_URL);
console.log('[server] AI_API_KEY =', AI_API_KEY ? '***' + AI_API_KEY.slice(-4) : '(empty)');
console.log('[server] AI_MODEL =', AI_MODEL);

function proxyAI(body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(AI_BASE_URL + '/chat/completions');
    const opts = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AI_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(opts, (res) => {
      let rawText = '';
      res.on('data', (chunk) => rawText += chunk);
      res.on('end', () => {
        console.log('[API_CLASSIFY] upstream status', res.statusCode);
        console.log('[API_CLASSIFY] upstream content-type', res.headers['content-type']);
        console.log('[API_CLASSIFY] upstream raw text', rawText.slice(0, 800));
        let parsed = null;
        try { parsed = JSON.parse(rawText); } catch (e) { parsed = { _raw: rawText }; }
        resolve({ status: res.statusCode, body: parsed, raw: rawText });
      });
    });
    req.on('error', (err) => {
      console.error('[server] upstream error:', err);
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

// ★ extractModelText · 兼容 OpenAI / Anthropic / Responses / MiniMax 等多种结构
function extractModelText(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data.output_text === 'string') return data.output_text;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.result === 'string') return data.result;
  if (data.data && typeof data.data.output_text === 'string') return data.data.output_text;
  if (data.data && typeof data.data.text === 'string') return data.data.text;
  if (data.choices && data.choices[0] && data.choices[0].message && typeof data.choices[0].message.content === 'string') {
    return data.choices[0].message.content;
  }
  if (data.choices && data.choices[0] && typeof data.choices[0].text === 'string') {
    return data.choices[0].text;
  }
  if (data.output && Array.isArray(data.output) && data.output[0] && data.output[0].content && Array.isArray(data.output[0].content) && data.output[0].content[0]) {
    return data.output[0].content[0].text || data.output[0].content[0].content || '';
  }
  if (data.response && typeof data.response.output_text === 'string') return data.response.output_text;
  if (Array.isArray(data.content)) {
    return data.content.map(function (item) {
      return (item && (item.text || item.content || item.output_text)) || '';
    }).filter(Boolean).join('\n');
  }
  return '';
}

// ★ parseModelJson · 健壮 JSON 提取
function parseModelJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  let text = String(raw).trim();
  // 去除 <think>...</think> 思考块
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try { return JSON.parse(text); }
  catch (err) {
    console.error('[API_CLASSIFY] JSON parse failed', err && err.message);
    console.error('[API_CLASSIFY] unparsed model text', text.slice(0, 400));
    return null;
  }
}

// ★ extractWesternSampleIdFromText · 从自然语言中容错提取 W01-W14
// 严格只接受 W01-W14，其它值丢弃
function extractWesternSampleIdFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\bW(?:0[1-9]|1[0-4])\b/i);
  if (!match) return null;
  const id = match[0].toUpperCase();
  return id;
}

// ★ buildMinimalWesternParsed · 文本容错时构造最小合法 parsed 对象
// - sampleId + shortReason + visionCheck(hasFace=true) + candidateScores
// - 6 维度 reason 留空字符串，由前端 / 后续 viewModel 用 sample 自带 reason 兜底
function buildMinimalWesternParsed(sampleId, reasonTag) {
  return {
    sampleId: sampleId,
    confidence: 'medium',
    shortReason: reasonTag + ' · ' + sampleId,
    matchedFeatures: [reasonTag + ' · ' + sampleId, '文本容错命中 Wxx'],
    visionCheck: {
      hasFace: true,
      wearingGlasses: false,
      headPose: 'front',
      framing: 'face-closeup',
      brightness: 'medium',
      faceCount: 1,
      expression: 'neutral'
    },
    candidateScores: [{ sampleId: sampleId, score: 0.5 }],
    dimensionReasons: {
      status: '', temperament: '', power: '', body: '', role: '', risk: ''
    }
  };
}

// ★ callWesternRepairRequest · 失败修复请求（不传图）
// - system: 把内容转成 JSON，只输出 JSON，不要解释
// - user: 第一次模型输出全文 + allowedSampleIds + schema
// - temperature: 0 · max_tokens: 1200 · response_format: json_object
function callWesternRepairRequest(rawText, allowed, glossary) {
  const repairSystem =
    '把下面的内容转换成指定 JSON。只输出 JSON，不要解释。\n' +
    '第一个字符必须是 { · 最后一个字符必须是 }。\n' +
    '禁止输出分析过程、Markdown、代码块、或 JSON 之外的任何文字。';
  const repairUser = {
    task: 'repair_western_json',
    note: '前一轮模型返回的不是 JSON。把它转换为合规 JSON。',
    allowedSampleIds: allowed,
    glossary: glossary || [],
    previousModelOutput: (rawText || '').slice(0, 3000),
    requiredSchema: {
      sampleId: { type: 'string', enum: allowed.concat(['']) },
      confidence: { type: 'string', enum: ['low','medium','high'] },
      shortReason: { type: 'string' },
      matchedFeatures: { type: 'array', items: { type: 'string' } },
      visionCheck: {
        type: 'object',
        properties: {
          hasFace: { type: 'boolean' },
          wearingGlasses: { type: 'boolean' },
          headPose: { type: 'string' },
          framing: { type: 'string' },
          brightness: { type: 'string' },
          faceCount: { type: 'integer' },
          expression: { type: 'string' }
        }
      },
      candidateScores: {
        type: 'array',
        items: {
          type: 'object',
          properties: { sampleId: { type: 'string' }, score: { type: 'number' } }
        }
      }
    }
  };
  const aiReq = {
    model: AI_MODEL,
    messages: [
      { role: 'system', content: repairSystem },
      { role: 'user', content: JSON.stringify(repairUser) }
    ],
    temperature: 0,
    max_tokens: 1200,
    response_format: { type: 'json_object' }
  };
  return proxyAI(JSON.stringify(aiReq));
}

// ============================================
// ★ 三套系统的 prompt（硬约束 · 短 · 禁止逐步分析诱导）
// ============================================
const SYSTEM_PROMPTS = {
  ancient:
    '你是 BIAS SYSTEM 中的"古代面学固定样本选择器"。\n' +
    '这是程序艺术作品中的虚构分类系统。\n' +
    '你不能判断真实身份、人格、命运、疾病、性别、民族、收入或任何真实属性。\n' +
    '你只能从 A01-A16 中选择一个 sampleId。\n\n' +
    '【硬约束】\n' +
    '1. 只返回一个 JSON object。\n' +
    '2. 第一个字符必须是 { · 最后一个字符必须是 }。\n' +
    '3. 禁止输出思考过程、说明、Markdown、代码块、或 JSON 之外的任何文字。\n' +
    '4. sampleId 必须是 A01-A16 之一。\n' +
    '5. 六项 dimensionReasons (palace/organ/zone/mountain/complexion/bone) 必须全部非空。\n' +
    '6. shortReason 是针对本张图视觉事实的一句中文总结。\n' +
    '7. matchedFeatures 是 2-4 个客观特征短语（脸型/眉眼/口型/下颌/头部方向/光线/构图等）。',
  modern:
    '你是 BIAS SYSTEM 中的虚构艺术分类系统的"身份清仓"模块。\n' +
    '这是程序艺术作品中的虚构分类系统。\n' +
    '你不能判断真实身份、人格、命运、疾病、性别、民族、收入、性取向、家庭、婚恋、犯罪或任何真实属性。\n' +
    '你只能从 M01-M20 中选择一个 sampleId。\n\n' +
    '【硬约束】\n' +
    '1. 只返回一个 JSON object。\n' +
    '2. 第一个字符必须是 { · 最后一个字符必须是 }。\n' +
    '3. 禁止输出思考过程、说明、Markdown、代码块、或 JSON 之外的任何文字。\n' +
    '4. sampleId 必须是 M01-M20 之一。\n' +
    '5. 六项 dimensionReasons (sexuality/gender/income/family/relationship/risk) 必须全部非空。\n' +
    '6. shortReason 是针对本张图视觉事实的一句中文总结。\n' +
    '7. matchedFeatures 是 2-4 个客观特征短语。',
  western:
    '你是 BIAS SYSTEM 中的"西方面学历史档案大模型"。\n' +
    '这是程序艺术作品中的虚构分类系统。\n' +
    '你不能判断真实身份、人格、命运、疾病、性别、民族、收入或任何真实属性。\n' +
    '你只能从 W01-W14 中选择一个 sampleId。\n\n' +
    '【硬约束】\n' +
    '1. 只返回一个 JSON object。\n' +
    '2. 第一个字符必须是 { · 最后一个字符必须是 }。\n' +
    '3. 禁止输出思考过程、说明、Markdown、代码块、或 JSON 之外的任何文字。\n' +
    '4. sampleId 必须是 W01-W14 之一。\n' +
    '5. 六项 dimensionReasons (status/temperament/power/body/role/risk) 必须全部非空。\n' +
    '6. shortReason 是针对本张图视觉事实的一句中文总结。\n' +
    '7. matchedFeatures 是 2-4 个客观特征短语。'
};

// ★ 三套系统的 fallback（与前端 ai-client.js / exhibition.js 完全一致）
const SYSTEM_FALLBACKS = {
  ancient: {
    verdict: '你被归类为',
    system: '古代相术',
    fields: [
      { key: 'main_zones',   label: '十二宫', value: '命宫偏滞 · 财帛欠明', reason: '前额低陷 · 中正微斜 · 十二宫中以命宫为最暗。' },
      { key: 'five_features', label: '五官',    value: '眉粗目秀 · 山根略断',     reason: '眉峰有气 · 目中含蓄 · 鼻梁青痕。' },
      { key: 'three_stops',   label: '三停',    value: '上停不及 · 中停为最',     reason: '额窄光满 · 中停丰隆 · 下停略削。' },
      { key: 'five_peaks',    label: '五岳',    value: '中岳显 · 余四岳不归',     reason: '鼻为中岳最隆 · 东南西北气散。' },
      { key: 'complexion',    label: '气色',    value: '准头灰暗 · 印堂不明',     reason: '面微白 · 印堂色滞 · 准头无华。' },
      { key: 'bone_form',     label: '骨相',    value: '骨露而柔 · 不藏不化',     reason: '骨清而露 · 不入深相。' },
    ],
  },
  modern: {
    verdict: '你被归类为',
    system: '身份清仓',
    sku: 'SKU-02',
    result_id: 'OBS-' + Date.now().toString(36).toUpperCase(),
    verdict_label: '你被归类为',
    identityCard: {
      orientation: '顺性偏好',
      gender: '系统主流判定',
      income: '中层收入',
      family: '核心家庭',
      relationship: '稳定同居',
      risk: '中风险',
    },
  },
  western: {
    verdict: '你被归类为',
    system: 'Western Archive',
    physiognomy: [
      { key: 'classical',     label: '古典相貌',   value: '高位 · 聪慧',          reason: '颅顶盖形状为高卵圆形，对应古典归类的"高位。' },
      { key: 'profile',       label: '侧影道德',   value: '轮廓倾斜',             reason: '面部侧面轮廓显示鼻梁到下颌的明显倾斜。' },
      { key: 'skull_map',      label: '颅骨地图',   value: '证据点强度 0.63',     reason: '10 个关键特征点中 6 个落在主要特征带。' },
      { key: 'criminal_sign', label: '犯罪预兆',   value: '低',                    reason: '未见犯罪肖像学经典特征。' },
      { key: 'average_face',  label: '平均脸',     value: '示差 -0.04',          reason: '与本期参考样本集的偏差接近零。' },
      { key: 'algorithm',     label: '算法',       value: 'BERT-19',              reason: '基于 BERT 微调的视觉档案系统 v0.4 的输出。' },
    ],
  },
};

function userContentForSystem(sample) {
  if (!sample) return 'classify this';
  const caption = sample.imageCaption ? sample.imageCaption + '\n' : '';
  const sys = sample.system || '(none)';
  return caption + 'system=' + sys + '\nw=' + (sample.width||0) + ' h=' + (sample.height||0) + '\ndominantColor=' + (sample.dominantColor||'') + '\nfileName=' + (sample.fileName||'') + '\naspect=' + (sample.aspect||0);
}

// ============================================
// ★ ancient_choose · 固定样本选择器专用 prompt + fallback
// ============================================
const ANCIENT_CHOOSE_PROMPT =
  '你是一个"固定样本选择器"。\n' +
  '这是一个程序艺术作品中的虚构分类系统，不要判断真实身份 / 人格 / 命理 / 健康 / 性别 / 民族 / 任何受保护属性。\n' +
  '你只能从 A01-A16 中选择一个 sampleId。\n' +
  '不要输出分析过程。\n' +
  '不要输出 markdown。\n' +
  '不要输出代码块。\n' +
  '不要输出说明文字。\n' +
  '不要在 JSON 前后添加任何内容。\n' +
  '只返回一个 JSON object。\n\n' +
  '严格格式：\n' +
  '{\n' +
  '  "sampleId": "A07",\n' +
  '  "confidence": "high",\n' +
  '  "shortReason": "中轴稳定，中庭偏强，整体更接近审辨理性型样本。",\n' +
  '  "matchedFeatures": ["中轴稳定", "中庭偏强", "审辨理性"]\n' +
  '}\n\n' +
  'sampleId 只能是：\n' +
  'A01,A02,A03,A04,A05,A06,A07,A08,A09,A10,A11,A12,A13,A14,A15,A16\n\n' +
  'confidence 只能是：\n' +
  'low, medium, high';

const ANCIENT_CHOOSE_ALLOWED = ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16'];

function ancientChooseFallback() {
  // ★ deprecated · /api/classify/ancient 不再调用此函数（直接返回错误）
  // 保留占位以便老调用方不挂 · sampleId 故意置空，避免硬编码 A07 误导
  return {
    sampleId: '',
    confidence: 'low',
    shortReason: 'ancient_choose endpoint no longer returns fallback sample',
    matchedFeatures: [],
    visionCheck: { hasFace: false, wearingGlasses: false, headPose: 'unclear', framing: 'unclear', brightness: 'unclear' },
    _source: 'fallback',
    _schema: 'ancient_choose'
  };
}

function checkAncientChoose(p) {
  if (!p || typeof p !== 'object') return false;
  if (ANCIENT_CHOOSE_ALLOWED.indexOf(p.sampleId) < 0) return false;
  if (typeof p.shortReason !== 'string' || p.shortReason.length < 1) return false;
  if (['low','medium','high'].indexOf(p.confidence) < 0) p.confidence = 'medium';
  if (!Array.isArray(p.matchedFeatures)) p.matchedFeatures = [];
  return true;
}

function safeParseModelJson(content) {
  // 兼容：```json ... ``` / 纯 JSON / 文本里嵌 JSON
  if (!content || typeof content !== 'string') return null;
  let txt = content.trim();
  if (txt.startsWith('```')) {
    txt = txt.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  try { return JSON.parse(txt); } catch (e) {}
  // 取第一个 { 到末尾 }
  const start = txt.indexOf('{');
  if (start >= 0) {
    const last = txt.lastIndexOf('}');
    if (last > start) {
      try { return JSON.parse(txt.slice(start, last + 1)); } catch (e) {}
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // /api/classify · 带 query 参数也可 · 支持 /exhibition-camera/api/classify 前缀
  const apiPath = req.url.split('?')[0];
  const isClassify = (apiPath === '/api/classify' || apiPath === '/exhibition-camera/api/classify');
  if (req.method === 'POST' && isClassify) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      console.log('[server] POST /api/classify · body =', body.slice(0, 200));
      let input;
      try { input = JSON.parse(body); }
      catch (e) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid json' })); }

      // ★ v2：解析 { system, sample, settings } 形态
      const system = (input && (input.system || (input.settings && input.settings.system))) || '';
      const sample = (input && input.sample) || {};
      const task = (sample && sample.task) || (input && input.task) || '';
      let aiReq;
      let fb;
      let schema = system; // 记录校验用 schema（ancient / modern / western / ancient_choose）

      if (task === 'ancient_choose') {
        // ★ ancient AI 选择器专用：用 ANCIENT_CHOOSE_PROMPT + 老 messages 通道
        const userMsg = (input && input.messages && input.messages.find && input.messages.find(m => m.role === 'user'))
          ? input.messages.find(m => m.role === 'user').content
          : JSON.stringify(input.payload || input.settings || sample || {});
        aiReq = {
          model: AI_MODEL,
          messages: [
            { role: 'system', content: ANCIENT_CHOOSE_PROMPT },
            { role: 'user',   content: userMsg }
          ],
          temperature: 0.2,
          max_tokens: 200,
          // ★ 强制 JSON 输出
          response_format: { type: 'json_object' }
        };
        fb = ancientChooseFallback();
        schema = 'ancient_choose';
      } else if (system === 'ancient' || system === 'modern' || system === 'western') {
        aiReq = {
          model: AI_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPTS[system] },
            { role: 'user',   content: userContentForSystem(sample) },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        };
        fb = SYSTEM_FALLBACKS[system];
      } else {
        // 老接口兼容：前端没传 system
        aiReq = {
          model: AI_MODEL,
          messages: input.messages || [
            { role: 'system', content: input.systemPrompt || 'You are a classifier.' },
            { role: 'user',   content: input.userContent || 'classify this' }
          ],
          temperature: 0.7,
          max_tokens: 1000
        };
        fb = SYSTEM_FALLBACKS.modern;
      }

      try {
        if (!AI_API_KEY) {
          // 没 API key，直接返回 fallback 包装
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, source: 'fallback', data: fb }));
          return;
        }
        // ★ 调试：?force=fallback 用于测试 fallback 路径
        const reqUrl = new URL(req.url, 'http://localhost');
        const forceFallback = reqUrl.searchParams.get('force') === 'fallback';
        if (forceFallback) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, source: 'fallback-forced', data: fb }));
          return;
        }
        const result = await proxyAI(JSON.stringify(aiReq));
        // 抽取模型文本 → 解析 JSON
        const txt = extractModelText(result.body);
        const parsed = parseModelJson(txt);
        console.log('[API_CLASSIFY] extracted text', (txt || '').slice(0, 400));
        console.log('[API_CLASSIFY] parsed', parsed);
        // ★ 校验：解析失败 → fallback；字段为空 / AI 不会答（未检出） → fallback
        const isJunk = (v) => {
          if (typeof v !== 'string') return true;
          const s = v.trim().toLowerCase();
          if (!s) return true;
          // 至少 2 个汉字的实质内容才不是 junk
          const hanzi = s.match(/[\u4e00-\u9fff]/g);
          if (hanzi && hanzi.length >= 4) return false;
          // 含至少 4 个拉丁字母的实质内容
          const latin = s.match(/[a-z]/g);
          if (latin && latin.length >= 6) return false;
          return /^(未定|未指定|未知|无|n\/?a|未分类|未明|未检出|无可|看不出来|unknown|indeterminate|n\/a|na|null|no_|demo|placeholder|placeholder\.|sample|demo_?|demo\.|示范占位|占位|示例|看不准|none)/i.test(s);
        };
        const checkQuality = (sys, p) => {
          if (!p) return false;
          if (sys === 'ancient') {
            if (!Array.isArray(p.fields) || p.fields.length < 3) return false;
            return p.fields.every(f => f && typeof f.value === 'string' && !isJunk(f.value));
          }
          if (sys === 'modern') {
            if (!p.identityCard) return false;
            const vals = Object.values(p.identityCard);
            return vals.length >= 6 && vals.every(v => typeof v === 'string' && !isJunk(v));
          }
          if (sys === 'western') {
            if (!Array.isArray(p.physiognomy) || p.physiognomy.length < 3) return false;
            return p.physiognomy.every(f => f && typeof f.value === 'string' && !isJunk(f.value));
          }
          return false;
        };
        const useAI = (schema === 'ancient_choose')
          ? checkAncientChoose(parsed)
          : checkQuality(system, parsed);
        console.log('[API_CLASSIFY] useAI', useAI, '· schema', schema);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        if (useAI) {
          const aiPayload = { ...parsed, system: schema, _source: 'ai', _schema: schema };
          res.end(JSON.stringify({
            ok: true,
            source: 'ai',
            result: aiPayload,
            data: aiPayload,                       // ★ 兼容老字段
            upstreamStatus: result.status
          }));
        } else {
          const reason = !parsed ? 'parse-failed' : (schema === 'ancient_choose' ? 'invalid-sampleId' : 'field-junk');
          res.end(JSON.stringify({
            ok: false,
            source: 'fallback',
            result: { ...fb, _source: 'fallback' },
            data: { ...fb, _source: 'fallback' },
            error: reason,
            upstreamStatus: result.status,
            upstreamParseFailed: reason
          }));
        }
      } catch (e) {
        console.error('[server] proxy error:', e);
        res.statusCode = 200; // 仍然 200 · 业务降级到 fallback
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, source: 'fallback', data: fb, error: 'proxy failed', message: e.message, upstreamStatus: 502 }));
      }
    });
    return;
  }

  // ============================================
  // ★ /api/classify/ancient · 独立 ancient 专用路由 · 视觉版
  // - 多模态 image_url 把摄像头帧发给 vision 模型
  // - 返回 visionCheck（非敏感视觉事实）+ sampleId
  // - 图片无效或无人脸 → 硬返回错误，不强行选样本
  // ============================================
  const isAncientApi = (req.url.split('?')[0] === '/api/classify/ancient' ||
                        req.url.split('?')[0] === '/exhibition-camera/api/classify/ancient');
  if (req.method === 'POST' && isAncientApi) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      console.log('[ANCIENT_API] POST /api/classify/ancient · body bytes =', body.length);
      let input;
      try { input = JSON.parse(body); } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-json', message: e.message }));
      }

      const image = input && input.image;
      const allowed = (input && Array.isArray(input.allowedSampleIds) && input.allowedSampleIds.length === 16)
        ? input.allowedSampleIds
        : ANCIENT_CHOOSE_ALLOWED;
      const glossary = (input && Array.isArray(input.sampleGlossary)) ? input.sampleGlossary : [];

      // ★ 1. 验证图片格式 + 体积
      let mime = null, base64 = null;
      if (typeof image === 'string') {
        const m = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
        if (m) { mime = 'image/' + (m[1] === 'jpg' ? 'jpeg' : m[1].toLowerCase()); base64 = m[2]; }
      }
      console.log('[ANCIENT_VISION] image mime:', mime);
      console.log('[ANCIENT_VISION] image bytes:', base64 ? base64.length : 0);
      if (!mime || !base64) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: 'image 必须是 data:image/(png|jpeg|webp);base64,…' }));
      }
      if (base64.length < 4096) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: 'base64 太短 · 拒绝 1×1 / 占位图' }));
      }

      // ★ 2. 解码 base64 验证宽高
      let imgW = 0, imgH = 0;
      try {
        const buf = Buffer.from(base64, 'base64');
        // PNG: IHDR at byte 16-23
        if (buf[0] === 0x89 && buf[1] === 0x50) {
          imgW = buf.readUInt32BE(16); imgH = buf.readUInt32BE(20);
        }
        // JPEG: SOF marker scan · robust against Exif orientation
        else if (buf[0] === 0xFF && buf[1] === 0xD8) {
          let i = 2;
          while (i < buf.length - 1) {
            while (i < buf.length && buf[i] !== 0xFF) i++;
            if (i >= buf.length - 1) break;
            // skip fill bytes (0xFF 0xFF ...)
            while (i < buf.length - 1 && buf[i + 1] === 0xFF) i++;
            const marker = buf[i + 1];
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
              // SOF: length(2) precision(1) height(2) width(2) ...
              if (i + 7 < buf.length) {
                imgH = buf.readUInt16BE(i + 3);
                imgW = buf.readUInt16BE(i + 5);
              }
              break;
            }
            // step to next marker
            const segLen = buf.readUInt16BE(i + 2);
            i += 2 + segLen;
          }
        }
      } catch (e) { console.warn('[ANCIENT_VISION] decode err', e.message); }
      console.log('[ANCIENT_VISION] image width:', imgW);
      console.log('[ANCIENT_VISION] image height:', imgH);
      // ★ 短边必须 ≥ 256
      if (!imgW || !imgH || Math.min(imgW, imgH) < 256) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: '图像短边 < 256 · 拒绝', width: imgW, height: imgH }));
      }

      if (!AI_API_KEY) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'missing-api-key' }));
      }

      // ★ 3. 短硬约束 prompt（不再长篇罗列，逐步分析诱导已删除）
      const systemPrompt =
        SYSTEM_PROMPTS.ancient +
        '\n允许的 sampleId 列表：' + allowed.join(',') + '\n';

      const userText = JSON.stringify({
        task: 'choose_one_sample_from_fixed_library',
        allowedSampleIds: allowed,
        sampleGlossary: glossary.map(function (g) { return { sampleId: g.sampleId, sampleName: g.sampleName }; })
      });

      console.log('[ANCIENT_VISION] vision model:', AI_MODEL);
      console.log('[ANCIENT_VISION] image attached to multimodal request: true');

      const aiReq = {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + base64 } }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ancient_vision_result',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['sampleId', 'confidence', 'shortReason', 'matchedFeatures', 'visionCheck', 'dimensionReasons'],
              properties: {
                sampleId: { type: 'string', enum: allowed },
                confidence: { type: 'string', enum: ['low','medium','high'] },
                shortReason: { type: 'string' },
                matchedFeatures: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
                visionCheck: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['hasFace', 'wearingGlasses', 'headPose', 'framing', 'brightness'],
                  properties: {
                    hasFace: { type: 'boolean' },
                    wearingGlasses: { type: 'boolean' },
                    headPose: { type: 'string', enum: ['front','left','right','up','down','unclear'] },
                    framing: { type: 'string', enum: ['face-closeup','head-and-shoulders','upper-body','distant','unclear'] },
                    brightness: { type: 'string', enum: ['dark','medium','bright','unclear'] }
                  }
                },
                dimensionReasons: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['palace','organ','zone','mountain','complexion','bone'],
                  properties: {
                    palace:     { type: 'string' },
                    organ:      { type: 'string' },
                    zone:       { type: 'string' },
                    mountain:   { type: 'string' },
                    complexion: { type: 'string' },
                    bone:       { type: 'string' }
                  }
                }
              }
            }
          }
        }
      };

      try {
        const upstream = await proxyAI(JSON.stringify(aiReq));
        console.log('[ANCIENT_API] upstream status', upstream.status);
        console.log('[ANCIENT_API] upstream raw text', (upstream.raw || '').slice(0, 800));

        const txt = extractModelText(upstream.body);
        const parsed = parseModelJson(txt);
        console.log('[ANCIENT_API] parsed', parsed);

        // ★ hasFace=false 直接返回 · 不进入分类（保留原有逻辑）
        // ★ 校验 visionCheck · 至少 5 个核心字段存在 · 缺则用默认值
        let vc = parsed ? (parsed.visionCheck || {}) : {};
        // 强制规范化 5 个核心字段 · 允许模型使用同义词（比如 pose → headPose）
        if (typeof vc !== 'object' || vc === null) vc = {};
        // hasFace
        if (typeof vc.hasFace !== 'boolean') {
          if (typeof vc.faceCount === 'number') vc.hasFace = vc.faceCount > 0;
          else if (typeof vc.hasFace === 'string') vc.hasFace = /true|yes|present|found/i.test(vc.hasFace);
          else vc.hasFace = false;
        }
        // wearingGlasses
        if (typeof vc.wearingGlasses !== 'boolean') {
          if (typeof vc.glasses === 'boolean') vc.wearingGlasses = vc.glasses;
          else vc.wearingGlasses = false;
        }
        // headPose (front/left/right/up/down/unclear)
        if (typeof vc.headPose !== 'string' || !['front','left','right','up','down','unclear'].includes(vc.headPose)) {
          const p = (vc.pose || vc.headPose || vc.headPoseRaw || '').toString().toLowerCase();
          if (/front|center|frontal/.test(p)) vc.headPose = 'front';
          else if (/left/.test(p)) vc.headPose = 'left';
          else if (/right/.test(p)) vc.headPose = 'right';
          else if (/up|tilted up/.test(p)) vc.headPose = 'up';
          else if (/down|bowed/.test(p)) vc.headPose = 'down';
          else vc.headPose = 'unclear';
        }
        // framing
        if (typeof vc.framing !== 'string' || !['face-closeup','head-and-shoulders','upper-body','distant','unclear'].includes(vc.framing)) {
          const f = (vc.framing || vc.composition || '').toString().toLowerCase();
          if (/close|tight/.test(f)) vc.framing = 'face-closeup';
          else if (/shoulder|head-?and-?shoulders|portrait/.test(f)) vc.framing = 'head-and-shoulders';
          else if (/upper|half/.test(f)) vc.framing = 'upper-body';
          else if (/distant|far|wide|full/.test(f)) vc.framing = 'distant';
          else vc.framing = 'unclear';
        }
        // brightness
        if (typeof vc.brightness !== 'string' || !['dark','medium','bright','unclear'].includes(vc.brightness)) {
          const b = (vc.brightness || vc.light || vc.lighting || '').toString().toLowerCase();
          if (/dark|dim|shadow|low.light/.test(b)) vc.brightness = 'dark';
          else if (/bright|overexposed|high.light|well.lit/.test(b)) vc.brightness = 'bright';
          else if (/medium|normal|mid/.test(b)) vc.brightness = 'medium';
          else vc.brightness = 'unclear';
        }

        // ★ hasFace=false → 不强行选样本
        if (vc.hasFace === false) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({
            ok: false,
            source: 'no-face',
            error: 'no-face-detected',
            visionCheck: vc
          }));
        }

        // ★ 1. 优先使用模型直接返回的完整 JSON
        if (parsed && classifyPipeline.isCompleteParsed(parsed, 'ancient')) {
          console.log('[ANCIENT_API] first parse complete · sampleId =', parsed.sampleId);
          // ★ 把模型同义词补齐（shortReason / matchedFeatures / sampleId）
          if (typeof parsed.shortReason !== 'string' || parsed.shortReason.length === 0) {
            if (typeof parsed.reason === 'string') parsed.shortReason = parsed.reason;
            else if (typeof parsed.why === 'string') parsed.shortReason = parsed.why;
            else if (typeof parsed.explanation === 'string') parsed.shortReason = parsed.explanation;
            else if (parsed.visionCheck && typeof parsed.visionCheck.reason === 'string') parsed.shortReason = parsed.visionCheck.reason;
            else if (parsed.visionCheck && typeof parsed.visionCheck.notes === 'string') parsed.shortReason = parsed.visionCheck.notes;
            else if (parsed.visionCheck && typeof parsed.visionCheck.description === 'string') parsed.shortReason = parsed.visionCheck.description;
            else if (parsed.sampleId) parsed.shortReason = 'AI 根据面部构图与气质选择样本 ' + parsed.sampleId;
          }
          if (!['low','medium','high'].includes(parsed.confidence)) {
            const c = (parsed.confidence || '').toString().toLowerCase();
            if (/high|strong|very|明显|高/.test(c)) parsed.confidence = 'high';
            else if (/low|weak|slight|轻微|低/.test(c)) parsed.confidence = 'low';
            else parsed.confidence = 'medium';
          }
          if (!Array.isArray(parsed.matchedFeatures) || parsed.matchedFeatures.length < 2) {
            if (Array.isArray(parsed.features)) parsed.matchedFeatures = parsed.features;
            else if (Array.isArray(parsed.tags)) parsed.matchedFeatures = parsed.tags;
            else if (parsed.visionCheck && Array.isArray(parsed.visionCheck.matchedFeatures)) parsed.matchedFeatures = parsed.visionCheck.matchedFeatures;
            else if (typeof parsed.shortReason === 'string') {
              const segs = parsed.shortReason.split(/[，。,；;]+/).filter(Boolean);
              if (segs.length >= 2) parsed.matchedFeatures = segs.slice(0, 4);
              else parsed.matchedFeatures = ['面部构图匹配', 'AI 选样本 ' + (parsed.sampleId || '')];
            }
          }
          const unified = classifyPipeline.buildUnifiedResult(parsed, 'ancient', { reasonSource: 'ai-personalized', upstreamStatus: upstream.status });
          unified.visionCheck = vc;
          unified.matchedFeatures = Array.isArray(unified.matchedFeatures) ? unified.matchedFeatures.slice(0, 4) : [];
          console.log('[ANCIENT_API] SUCCESS · sampleId =', unified.sampleId, '· reasonSource =', unified.reasonSource, '· dimReasons =', classifyPipeline.countNonEmptyDimensionReasons(unified.dimensionReasons) + '/6');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({
            ok: true,
            source: 'ai',
            system: 'ancient',
            sampleId: unified.sampleId,
            confidence: unified.confidence,
            shortReason: unified.shortReason,
            matchedFeatures: unified.matchedFeatures,
            visionCheck: unified.visionCheck,
            dimensionReasons: unified.dimensionReasons,
            reasonSource: unified.reasonSource,
            upstreamStatus: upstream.status
          }));
        }

        // ★ 2. 解析失败 / 字段缺失 → 公共修复流水线（先从自然语言提取 Axx，再走理由补全）
        console.warn('[ANCIENT_API] first parse incomplete · entering common pipeline');
        const repaired = await classifyPipeline.parseAndRepairClassification({
          system: 'ancient',
          upstreamText: txt,
          visualSummary: vc,
          sampleGlossary: glossary,
          proxyAI: proxyAI,
          model: AI_MODEL,
          logTag: '[ANCIENT_REPAIR]',
          extractModelText: extractModelText
        });
        if (!repaired || !repaired.sampleId) {
          console.error('[ANCIENT_API] repair pipeline returned no sampleId');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({ ok: false, source: 'error', error: 'model-output-not-json', upstreamStatus: upstream.status, upstreamRaw: (upstream.raw || '').slice(0, 400) }));
        }
        repaired.visionCheck = vc;
        repaired.matchedFeatures = Array.isArray(repaired.matchedFeatures) ? repaired.matchedFeatures.slice(0, 4) : [];
        console.log('[ANCIENT_API] SUCCESS · sampleId =', repaired.sampleId, '· reasonSource =', repaired.reasonSource, '· dimReasons =', classifyPipeline.countNonEmptyDimensionReasons(repaired.dimensionReasons) + '/6');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: true,
          source: 'ai',
          system: 'ancient',
          sampleId: repaired.sampleId,
          confidence: repaired.confidence,
          shortReason: repaired.shortReason,
          matchedFeatures: repaired.matchedFeatures,
          visionCheck: repaired.visionCheck,
          dimensionReasons: repaired.dimensionReasons,
          reasonSource: repaired.reasonSource,
          upstreamStatus: upstream.status
        }));
      } catch (e) {
        console.error('[ANCIENT_API] error', e && e.message);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'proxy-exception', message: e && e.message }));
      }
    });
    return;
  }

  // ============================================
  // ★ /api/classify/modern · 独立 modern 专用路由 · 单图视觉匹配版
  // - 真实 AI 只接收一张当前摄像头截图 + 20 组纯视觉 visualProfile
  // - 不再发送 reference 联系表（避免上游多图 sensitive 拦截）
  // - 上游 422 → 返回 HTTP 422（不再包 200）
  // - 上游网络失败 → 502；解析失败 → 502
  // - 支持 mode=A/B/C 单图分测
  // ============================================
  const isModernApi = (req.url.split('?')[0] === '/api/classify/modern' ||
                       req.url.split('?')[0] === '/exhibition-camera/api/classify/modern');
  if (req.method === 'POST' && isModernApi) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      console.log('[MODERN_API] POST /api/classify/modern · body bytes =', body.length);
      let input;
      try { input = JSON.parse(body); } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-json', message: e.message }));
      }

      const image = input && input.image;
      const allowed = (input && Array.isArray(input.allowedSampleIds) && input.allowedSampleIds.length === 20)
        ? input.allowedSampleIds
        : ['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','M13','M14','M15','M16','M17','M18','M19','M20'];
      // ★ 拒绝可能泄露本地匹配 / 历史结果
      const forbidden = ['localCandidate','localMatch','recommendedSampleId','previousSampleId','lastSampleId','defaultSampleId'];
      for (const k of forbidden) {
        if (input && input[k] !== undefined) console.warn('[MODERN_API] WARN forbidden field', k, 'ignored');
      }

      // ★ TEST MODE 分测：A=仅 current, B=current+reference_main, C=current+reference_alt
      const testMode = (input && typeof input.testMode === 'string') ? input.testMode : 'production';

      // 解析 current frame
      let mime = null, base64 = null;
      if (typeof image === 'string') {
        const m = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
        if (m) { mime = 'image/' + (m[1] === 'jpg' ? 'jpeg' : m[1].toLowerCase()); base64 = m[2]; }
      }
      console.log('[MODERN_VISION] current frame mime:', mime, '· bytes:', base64 ? base64.length : 0);
      if (!mime || !base64) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: 'image 必须是 data:image/(png|jpeg|webp);base64,…' }));
      }
      if (base64.length < 4096) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: 'base64 太短 · 拒绝 1×1 / 占位图' }));
      }

      let imgW = 0, imgH = 0;
      try {
        const buf = Buffer.from(base64, 'base64');
        if (buf[0] === 0x89 && buf[1] === 0x50) {
          imgW = buf.readUInt32BE(16); imgH = buf.readUInt32BE(20);
        } else if (buf[0] === 0xFF && buf[1] === 0xD8) {
          let i = 2;
          while (i < buf.length - 1) {
            while (i < buf.length && buf[i] !== 0xFF) i++;
            if (i >= buf.length - 1) break;
            while (i < buf.length - 1 && buf[i + 1] === 0xFF) i++;
            const marker = buf[i + 1];
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
              if (i + 7 < buf.length) {
                imgH = buf.readUInt16BE(i + 3);
                imgW = buf.readUInt16BE(i + 5);
              }
              break;
            }
            const segLen = buf.readUInt16BE(i + 2);
            i += 2 + segLen;
          }
        }
      } catch (e) { console.warn('[MODERN_VISION] decode err', e.message); }
      console.log('[MODERN_VISION] current frame width:', imgW, '· height:', imgH);
      if (!imgW || !imgH || Math.min(imgW, imgH) < 256) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: '图像短边 < 256 · 拒绝', width: imgW, height: imgH }));
      }

      // ★ P0-1：保存服务端真正收到的图 · 便于人工确认
      try {
        const debugDir = path.join(__dirname, '_debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const debugBuf = Buffer.from(base64, 'base64');
        const sha = require('crypto').createHash('sha256').update(debugBuf).digest('hex');
        const ext = mime.indexOf('jpeg') >= 0 ? 'jpg' : (mime.indexOf('png') >= 0 ? 'png' : 'webp');
        const savedPath = path.join(debugDir, 'modern_last_received_frame.' + ext);
        fs.writeFileSync(savedPath, debugBuf);
        console.log('[MODERN_DEBUG_IMAGE] mime:', mime);
        console.log('[MODERN_DEBUG_IMAGE] bytes:', debugBuf.length);
        console.log('[MODERN_DEBUG_IMAGE] width:', imgW);
        console.log('[MODERN_DEBUG_IMAGE] height:', imgH);
        console.log('[MODERN_DEBUG_IMAGE] sha256:', sha);
        console.log('[MODERN_DEBUG_IMAGE] saved path:', savedPath);
      } catch (e) { console.warn('[MODERN_DEBUG_IMAGE] save err:', e.message); }

      // ★ P0-2：本地 MediaPipe 人脸 gate（优先于模型 visionCheck）
      const localFaceDetected = input && input.localFaceDetected === true;
      const localLandmarkCount = Number(input && input.localLandmarkCount) || 0;
      const confirmedHasFace = localFaceDetected && localLandmarkCount >= 100;
      console.log('[MODERN_FACE_GATE] localFaceDetected:', localFaceDetected, '· landmarkCount:', localLandmarkCount, '· confirmedHasFace:', confirmedHasFace);

      // ★ P0-3：接收并保存前端裁切的人脸图
      let cropMime = null, cropBase64 = null, cropW = 0, cropH = 0;
      const faceCropDataUrl = input && input.faceCropDataUrl;
      if (typeof faceCropDataUrl === 'string') {
        const cm = faceCropDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
        if (cm) {
          cropMime = 'image/' + (cm[1] === 'jpg' ? 'jpeg' : cm[1].toLowerCase());
          cropBase64 = cm[2];
          const cbuf = Buffer.from(cropBase64, 'base64');
          if (cbuf[0] === 0xFF && cbuf[1] === 0xD8) {
            let j = 2;
            while (j < cbuf.length - 1) {
              while (j < cbuf.length && cbuf[j] !== 0xFF) j++;
              if (j >= cbuf.length - 1) break;
              while (j < cbuf.length - 1 && cbuf[j + 1] === 0xFF) j++;
              const mk = cbuf[j + 1];
              if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) {
                if (j + 7 < cbuf.length) { cropH = cbuf.readUInt16BE(j + 3); cropW = cbuf.readUInt16BE(j + 5); }
                break;
              }
              j += 2 + cbuf.readUInt16BE(j + 2);
            }
          } else if (cbuf[0] === 0x89 && cbuf[1] === 0x50) {
            cropW = cbuf.readUInt32BE(16); cropH = cbuf.readUInt32BE(20);
          }
          try {
            const debugDir = path.join(__dirname, '_debug');
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
            const cropExt = cropMime.indexOf('jpeg') >= 0 ? 'jpg' : (cropMime.indexOf('png') >= 0 ? 'png' : 'webp');
            const cropPath = path.join(debugDir, 'modern_last_face_crop.' + cropExt);
            fs.writeFileSync(cropPath, cbuf);
            console.log('[MODERN_FACE_CROP] width:', cropW, '· height:', cropH, '· bytes:', cbuf.length, '· attached: true · saved:', cropPath);
          } catch (e) { console.warn('[MODERN_FACE_CROP] save err:', e.message); }
        }
      } else {
        console.log('[MODERN_FACE_CROP] attached: false (no faceCropDataUrl)');
      }

      // ★ P0-5：只有本地也无人脸时才返回 no-face
      if (!confirmedHasFace) {
        console.log('[MODERN_FACE_GATE] no face confirmed locally · returning no-face (HTTP 422)');
        res.statusCode = 422;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'no-face', error: 'no-face-detected' }));
      }

      // 读取 visualProfile（仅视觉特征）
      let refProfiles = null;
      try {
        const modernSrc = fs.readFileSync(path.join(__dirname, 'js', 'modern-local-system.js'), 'utf8');
        const ctx = { window: {} };
        vm.createContext(ctx);
        vm.runInContext(modernSrc, ctx);
        const samples = ctx.window.MODERN_LOCAL_SAMPLES || [];
        refProfiles = samples.map(function (s) {
          return { sampleId: s.sampleId, visualProfile: s.visualProfile || [] };
        });
      } catch (e) {
        console.error('[MODERN_VISION] FAIL load profiles:', e.message);
      }
      console.log('[MODERN_VISION] visual profiles count:', refProfiles ? refProfiles.length : 0);

      // 可选：reference 联系表（仅在 TEST MODE=B/C 时加载）
      let refMainBuf = null, refAltBuf = null;
      if (testMode === 'B' || testMode === 'C') {
        try {
          const refDir = path.join(__dirname, 'assets', 'sample-library', 'modern', 'reference');
          if (testMode === 'B') refMainBuf = fs.readFileSync(path.join(refDir, 'modern_reference_main.jpg'));
          if (testMode === 'C') refAltBuf = fs.readFileSync(path.join(refDir, 'modern_reference_alt.jpg'));
        } catch (e) {
          console.error('[MODERN_VISION] FAIL load reference:', e.message);
        }
      }

      if (!AI_API_KEY) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'missing-api-key' }));
      }

      const systemPrompt =
        '你是 BIAS SYSTEM 中的虚构艺术分类系统的视觉匹配器。\n' +
        '任务不是识别当前用户身份，\n' +
        '也不是判断当前用户真实属性。\n' +
        '你只能比较：\n' +
        '- 当前摄像头中已由本地人脸检测器（MediaPipe FaceLandmarker）裁切好的人脸图（content[1]）\n' +
        '- 完整摄像头帧（content[2]，作为辅助语境）\n' +
        '- 20 个样本的纯视觉描述（visualProfile）\n\n' +
        '【关键·人脸已确认】本地 MediaPipe FaceLandmarker 已确认裁切图中存在完整人脸（共 ' + localLandmarkCount + ' 个 landmarks）。\n' +
        '你不得重新否定人脸存在。\n' +
        '你不得返回 visionCheck.hasFace=false。\n' +
        '你必须从 M01-M20 中选择一个视觉最接近的样本。\n\n' +
        '【步骤一·先观察 content[1] 裁切图】描述客观可见特征：是否戴眼镜、脸型、头发、眉眼形态、口型状态、下颌宽度、头部方向、构图距离、明暗。\n\n' +
        '【步骤二·在 20 个样本中找出视觉上最接近的三个候选】只能使用 visualProfile 中给出的客观视觉特征，不允许引用样本的真实人物姓名、职业、社会标签、梗文化或公共事件。\n\n' +
        '【步骤三·比较三个候选的差异】给出 candidateScores（0-1 浮点）。\n\n' +
        '【步骤四·只返回最终 sampleId】\n\n' +
        '严禁：因为画面像直播截图就选 M03；因为画面戴眼镜就机械选 M06；因为画面像梗图就选孙笑川相关样本；因为人物名气或社会标签选择样本。\n' +
        '必须综合：脸型、眉眼、下颌、口型、发型、明暗、构图距离。\n';

      const userText = JSON.stringify({
        task: 'visual_match_only',
        allowedSampleIds: allowed,
        visualProfiles: refProfiles || []
      });

      console.log('[MODERN_VISION] vision model:', AI_MODEL);
      console.log('[MODERN_VISION] test mode:', testMode);

      // ★ content 数组：TEST MODE 控制
      const content = [];
      // TEST MODE=B/C 时先放 reference 联系表
      if (refMainBuf) {
        content.push({ type: 'text', text: '参考联系表 main（5×4 联系表）' });
        content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + refMainBuf.toString('base64') } });
      }
      if (refAltBuf) {
        content.push({ type: 'text', text: '参考联系表 alt（5×4 联系表）' });
        content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + refAltBuf.toString('base64') } });
      }
      // ★ P0-3：content[1] = 前端裁好的人脸图（如果有）；content[2] = 完整帧（辅助语境）
      if (cropBase64 && cropMime) {
        content.push({ type: 'text', text: '本地 MediaPipe 裁切的人脸图（' + cropW + '×' + cropH + '，已确认 ' + localLandmarkCount + ' landmarks）' });
        content.push({ type: 'image_url', image_url: { url: 'data:' + cropMime + ';base64,' + cropBase64 } });
        content.push({ type: 'text', text: '完整摄像头帧（' + imgW + '×' + imgH + '，作为辅助语境）' });
        content.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + base64 } });
      } else {
        content.push({ type: 'text', text: '当前摄像头截帧（' + imgW + '×' + imgH + '）' });
        content.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + base64 } });
      }
      // 任务文本
      content.push({ type: 'text', text: userText });

      // ★ 输出每个 image slot 的索引映射（不打印 base64，只打印 slot 信息）
      content.forEach(function (item, idx) {
        if (item.type === 'image_url' && item.image_url && item.image_url.url) {
          const m = item.image_url.url.match(/^data:image\/([^;]+);base64,(.+)$/);
          if (m) {
            let w = 0, h = 0;
            try {
              const b = Buffer.from(m[2], 'base64');
              if (b[0] === 0x89 && b[1] === 0x50) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
              else if (b[0] === 0xFF && b[1] === 0xD8) {
                let i = 2;
                while (i < b.length - 1) {
                  while (i < b.length && b[i] !== 0xFF) i++;
                  if (i >= b.length - 1) break;
                  while (i < b.length - 1 && b[i + 1] === 0xFF) i++;
                  const marker = b[i + 1];
                  if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                    if (i + 7 < b.length) { h = b.readUInt16BE(i + 3); w = b.readUInt16BE(i + 5); }
                    break;
                  }
                  i += 2 + b.readUInt16BE(i + 2);
                }
              }
            } catch (e) {}
            console.log('[MODERN_IMAGE_SLOT] index', idx, 'mime', m[1], 'bytes', m[2].length, 'width', w, 'height', h);
          }
        } else if (item.type === 'text') {
          console.log('[MODERN_REQUEST_MAP] content[' + idx + '] text:', item.text.slice(0, 80));
        }
      });
      console.log('[MODERN_VISION] current frame attached true');
      console.log('[MODERN_VISION] reference main attached:', !!refMainBuf);
      console.log('[MODERN_VISION] reference alt attached:', !!refAltBuf);

      const aiReq = {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'modern_visual_match',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['sampleId','confidence','shortReason','matchedFeatures','visionCheck','candidateScores'],
              properties: {
                sampleId: { type: 'string', enum: allowed.concat(['']) },
                confidence: { type: 'string', enum: ['low','medium','high'] },
                shortReason: { type: 'string' },
                matchedFeatures: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
                visionCheck: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['hasFace','wearingGlasses','headPose','framing','brightness'],
                  properties: {
                    hasFace: { type: 'boolean' },
                    wearingGlasses: { type: 'boolean' },
                    headPose: { type: 'string', enum: ['front','left','right','up','down','unclear'] },
                    framing: { type: 'string', enum: ['face-closeup','head-and-shoulders','upper-body','distant','unclear'] },
                    brightness: { type: 'string', enum: ['dark','medium','bright','unclear'] },
                    faceCount: { type: 'integer' },
                    expression: { type: 'string' }
                  }
                },
                candidateScores: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 20,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['sampleId','score'],
                    properties: {
                      sampleId: { type: 'string', enum: allowed },
                      score: { type: 'number', minimum: 0, maximum: 1 }
                    }
                  }
                },
                dimensionReasons: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['sexuality','gender','income','family','relationship','risk'],
                  properties: {
                    sexuality:     { type: 'string' },
                    gender:        { type: 'string' },
                    income:        { type: 'string' },
                    family:        { type: 'string' },
                    relationship:  { type: 'string' },
                    risk:          { type: 'string' }
                  }
                }
              }
            }
          }
        }
      };

      let upstream;
      try {
        upstream = await proxyAI(JSON.stringify(aiReq));
      } catch (e) {
        console.error('[MODERN_API] upstream network exception:', e && e.message);
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'upstream-request-failed', message: e && e.message }));
      }
      console.log('[MODERN_API] upstream status', upstream.status);
      console.log('[MODERN_API] upstream raw text', (upstream.raw || '').slice(0, 800));

      // ★ 上游 4xx/5xx → 直接透传 status code（不再包 200）
      if (upstream.status >= 400) {
        let upstreamMessage = (upstream.raw || '').slice(0, 500);
        // 试图从 upstream.body 提取 message 字段
        let parsedBody = upstream.body;
        let failedImageSlot = '';
        let errorCode = 'upstream-rejected';
        try {
          if (typeof parsedBody === 'string') parsedBody = JSON.parse(parsedBody);
          if (parsedBody && parsedBody.error && parsedBody.error.message) upstreamMessage = parsedBody.error.message;
          // 解析 messages[1].content[3].image is sensitive
          const m = upstreamMessage.match(/content\[(\d+)\][^\[]*?(\w+)?\s*is\s*sensitive/i);
          if (m) failedImageSlot = 'content[' + m[1] + ']';
        } catch (e) {}
        console.error('[MODERN_API] upstream rejected · status', upstream.status, '· slot:', failedImageSlot, '· message:', upstreamMessage);
        const errCode = upstream.status === 422 ? 'upstream-image-rejected' : ('upstream-' + upstream.status);
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'error',
          error: errCode,
          upstreamStatus: upstream.status,
          failedImageSlot: failedImageSlot,
          upstreamMessage: upstreamMessage
        }));
      }

      const txt = extractModelText(upstream.body);
      const parsed = parseModelJson(txt);
      console.log('[MODERN_API] parsed', parsed);

      // visionCheck 净化
      let vc = parsed ? (parsed.visionCheck || {}) : {};
      if (typeof vc !== 'object' || vc === null) vc = {};
      const allowedKeys = ['hasFace','wearingGlasses','headPose','framing','brightness','faceCount','expression'];
      const cleanedVc = {};
      for (const k of allowedKeys) cleanedVc[k] = vc[k];
      if (typeof cleanedVc.hasFace !== 'boolean') {
        if (typeof cleanedVc.faceCount === 'number') cleanedVc.hasFace = cleanedVc.faceCount > 0;
        else cleanedVc.hasFace = false;
      }
      if (typeof cleanedVc.wearingGlasses !== 'boolean') cleanedVc.wearingGlasses = false;
      if (!['front','left','right','up','down','unclear'].includes(cleanedVc.headPose)) cleanedVc.headPose = 'unclear';
      if (!['face-closeup','head-and-shoulders','upper-body','distant','unclear'].includes(cleanedVc.framing)) cleanedVc.framing = 'unclear';
      if (!['dark','medium','bright','unclear'].includes(cleanedVc.brightness)) cleanedVc.brightness = 'unclear';
      vc = cleanedVc;

      // ★ P0-4：本地 MediaPipe 已确认人脸 → 规范化覆盖模型 visionCheck.hasFace=false
      if (confirmedHasFace && vc.hasFace === false) {
        console.warn('[MODERN_VISION_WARNING] model returned hasFace=false while MediaPipe confirmed face (landmarkCount=' + localLandmarkCount + ') · normalizing to true');
        vc.hasFace = true;
        vc.faceCount = 1;
      }

      if (vc.hasFace === false) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'no-face',
          error: 'no-face-detected',
          visionCheck: vc
        }));
      }

      // ★ 1. 优先使用模型直接返回的完整 JSON（isCompleteParsed 已校验 sampleId + 6 维度）
      if (parsed && classifyPipeline.isCompleteParsed(parsed, 'modern')) {
        console.log('[MODERN_API] first parse complete · sampleId =', parsed.sampleId);
        // ★ 把 sampleId 同义词补齐
        if (typeof parsed.sampleId !== 'string' || allowed.indexOf(parsed.sampleId) < 0) {
          if (typeof parsed.finalSampleId === 'string' && allowed.indexOf(parsed.finalSampleId) >= 0) parsed.sampleId = parsed.finalSampleId;
          else if (Array.isArray(parsed.topCandidates) && parsed.topCandidates[0] && allowed.indexOf(parsed.topCandidates[0].sampleId) >= 0) parsed.sampleId = parsed.topCandidates[0].sampleId;
          else if (parsed.candidateScores && typeof parsed.candidateScores === 'object') {
            let topK = null, topS = -1;
            for (const k of Object.keys(parsed.candidateScores)) {
              const s = Number(parsed.candidateScores[k]) || 0;
              if (s > topS && allowed.indexOf(k) >= 0) { topS = s; topK = k; }
            }
            if (topK) parsed.sampleId = topK;
          }
        }
        // ★ 规范化 confidence / shortReason / matchedFeatures
        var confidence = ['low','medium','high'].indexOf(parsed.confidence) >= 0 ? parsed.confidence : 'medium';
        if (!['low','medium','high'].includes(parsed.confidence)) parsed.confidence = 'medium';
        if (typeof parsed.shortReason !== 'string' || parsed.shortReason.length === 0) {
          if (typeof parsed.finalReason === 'string') parsed.shortReason = parsed.finalReason;
          else if (Array.isArray(parsed.topCandidates) && parsed.topCandidates[0] && parsed.topCandidates[0].rationale) parsed.shortReason = parsed.topCandidates[0].rationale;
          else if (parsed.sampleId) parsed.shortReason = '视觉匹配 · 候选 ' + parsed.sampleId;
        }
        if (!Array.isArray(parsed.matchedFeatures) || parsed.matchedFeatures.length < 2) {
          if (Array.isArray(parsed.topCandidates)) parsed.matchedFeatures = parsed.topCandidates.slice(0, 4).map(function (c) { return c.rationale || c.sampleId; }).filter(Boolean);
          else parsed.matchedFeatures = ['视觉匹配', '视觉特征比对'];
        }
        const unified = classifyPipeline.buildUnifiedResult(parsed, 'modern', { reasonSource: 'ai-personalized', upstreamStatus: upstream.status });
        unified.visionCheck = vc;
        unified.matchedFeatures = Array.isArray(unified.matchedFeatures) ? unified.matchedFeatures.slice(0, 4) : [];
        const dimCount = classifyPipeline.countNonEmptyDimensionReasons(unified.dimensionReasons);
        console.log('[MODERN_API] SUCCESS · sampleId =', unified.sampleId, '· reasonSource =', unified.reasonSource, '· dimReasons =', dimCount + '/6');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: true,
          source: 'ai',
          system: 'modern',
          sampleId: unified.sampleId,
          confidence: unified.confidence,
          shortReason: unified.shortReason,
          matchedFeatures: unified.matchedFeatures,
          visionCheck: unified.visionCheck,
          dimensionReasons: unified.dimensionReasons,
          reasonSource: unified.reasonSource,
          upstreamStatus: upstream.status
        }));
      }

      // ★ 2. 解析失败 / 字段缺失 → 公共修复流水线（先从自然语言提取 Mxx，再走理由补全）
      console.warn('[MODERN_API] first parse incomplete · entering common pipeline');
      const repaired = await classifyPipeline.parseAndRepairClassification({
        system: 'modern',
        upstreamText: txt,
        visualSummary: vc,
        sampleGlossary: (refProfiles || []).map(function (r) { return { sampleId: r.sampleId, sampleName: r.sampleId }; }),
        proxyAI: proxyAI,
        model: AI_MODEL,
        logTag: '[MODERN_REPAIR]',
        extractModelText: extractModelText
      });
      if (!repaired || !repaired.sampleId) {
        console.error('[MODERN_API] repair pipeline returned no sampleId');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'upstream-parse-failed', upstreamStatus: upstream.status }));
      }
      repaired.visionCheck = vc;
      repaired.matchedFeatures = Array.isArray(repaired.matchedFeatures) ? repaired.matchedFeatures.slice(0, 4) : [];
      const dimCount2 = classifyPipeline.countNonEmptyDimensionReasons(repaired.dimensionReasons);
      console.log('[MODERN_API] SUCCESS · sampleId =', repaired.sampleId, '· reasonSource =', repaired.reasonSource, '· dimReasons =', dimCount2 + '/6');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        ok: true,
        source: 'ai',
        system: 'modern',
        sampleId: repaired.sampleId,
        confidence: repaired.confidence,
        shortReason: repaired.shortReason,
        matchedFeatures: repaired.matchedFeatures,
        visionCheck: repaired.visionCheck,
        dimensionReasons: repaired.dimensionReasons,
        reasonSource: repaired.reasonSource,
        upstreamStatus: upstream.status
      }));
    });
    return;
  }

  // ============================================
  // ★ /api/fusion/ancient · 古代归类融合像 · Provider Adapter
  // - 校验 sampleId ∈ A01-A16 · 校验 userImage 是合法 data URL
  // - 限制 body 8MB · 后端读取 sample_main.jpg
  // - 通过 providers/ancient-fusion-provider.js 选 Key + Model
  // - 优先 IMAGE_API_KEY · 退路 AI_API_KEY (与文本分类共用)
  // - 没任何 Key → 503 image-provider-not-configured
  // - 不在前端返回任何 API key
  // - 不在日志输出完整 base64
  // - ★ 关键：Provider 返回的临时 OSS URL 浏览器常 ERR_CONNECTION_RESET
  //          后端立即 fetch → 转 base64 data URL → 给前端（共用 image-proxy）
  // ============================================
  const fusionProvider = require('./providers/ancient-fusion-provider');
  const minimaxImage = require('./providers/minimax-image-provider');
  const imageProxy = require('./providers/image-proxy');
  // 日志 helper：只打 host+path · 不打签名参数
  function _safeHostForLog(u) {
    try { const x = new URL(u); return x.host + x.pathname.slice(0, 60); } catch (e) { return 'invalid'; }
  }
  const isFusionAncientApi = (req.url.split('?')[0] === '/api/fusion/ancient' ||
                              req.url.split('?')[0] === '/exhibition-camera/api/fusion/ancient');
  if (req.method === 'POST' && isFusionAncientApi) {
    let body = '';
    let bodyLen = 0;
    const MAX_FUSION_BODY = 8 * 1024 * 1024; // 8MB
    req.on('data', c => {
      bodyLen += c.length;
      if (bodyLen > MAX_FUSION_BODY) {
        try { req.destroy(); } catch (e) {}
        if (!res.headersSent) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, source: 'error', error: 'payload-too-large', message: '请求体超过 8MB 限制' }));
        }
        return;
      }
      body += c;
    });
    req.on('end', async () => {
      console.log('[FUSION_ANCIENT] POST /api/fusion/ancient · body bytes =', body.length);
      let input;
      try { input = JSON.parse(body); } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-json', message: 'JSON 解析失败' }));
      }

      // ★ 1. 校验 sampleId
      const sampleId = (input && typeof input.sampleId === 'string') ? input.sampleId.trim() : '';
      if (!/^A(0[1-9]|1[0-6])$/.test(sampleId)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-sample-id', message: 'sampleId 必须是 A01-A16' }));
      }

      // ★ 2. 校验 userImage 是合法 data URL
      const userImage = (input && typeof input.userImage === 'string') ? input.userImage : '';
      const m = userImage.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
      if (!m) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-user-image', message: 'userImage 必须是 png/jpeg/webp 的 data URL' }));
      }
      const userMime = m[1].toLowerCase();
      const userBase64 = m[2];
      // base64 长度粗略检查（解码后 ≥ 1KB）
      if (userBase64.length < 1024) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-user-image', message: '用户图过小或为空' }));
      }

      // ★ 3. 校验 requestId
      const requestId = (input && typeof input.requestId === 'string' && /^fusion_[A-Za-z0-9_-]{1,80}$/.test(input.requestId))
        ? input.requestId
        : ('fusion_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

      // ★ 4. 通过 Provider Adapter 选 Key · 复用 AI_API_KEY
      const keyPick = fusionProvider.pickImageApiKey();
      if (!keyPick.key) {
        console.log('[FUSION_ANCIENT] no usable API key (need one of IMAGE_API_KEY / MINIMAX_API_KEY / AI_API_KEY / IMAGE_KEY / AI_IMAGE_KEY) · return 503');
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'error',
          error: 'image-provider-not-configured',
          message: '融合生成服务尚未连接',
          hint: '请在 Vercel / .env 配置 IMAGE_API_KEY · 或保留现有 AI_API_KEY (与文本分类共用同一 Key)'
        }));
      }
      const IMAGE_BASE_URL = fusionProvider.pickImageBaseUrl();
      const IMAGE_MODEL = fusionProvider.pickImageModel();
      console.log('[FUSION_ANCIENT] using key source =', keyPick.source, '· baseUrl =', IMAGE_BASE_URL, '· model =', IMAGE_MODEL);

      // ★ 5. 读取 sample main 图（白名单路径，server 端固定目录）
      const sampleMainPath = path.join(DIRECTORY, 'assets', 'sample-library', 'ancient', sampleId + '_sample_main.jpg');
      let sampleBase64 = '';
      try {
        if (!fs.existsSync(sampleMainPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({ ok: false, source: 'error', error: 'sample-image-not-found', message: '样本主图缺失 · ' + sampleId }));
        }
        const sampleBuf = fs.readFileSync(sampleMainPath);
        sampleBase64 = sampleBuf.toString('base64');
      } catch (e) {
        console.error('[FUSION_ANCIENT] read sample err', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'sample-image-not-found', message: '样本主图读取失败' }));
      }

      // ★ 6. 构造 prompt · 通过 Provider Adapter
      const sampleName = minimaxImage.SAMPLE_NAMES[sampleId] || sampleId;
      const fusionPrompt = minimaxImage.buildPrompt(sampleId, sampleName);
      console.log('[FUSION_ANCIENT] call provider=' + minimaxImage.providerId + ' model=' + IMAGE_MODEL + ' sampleId=' + sampleId + ' requestId=' + requestId + ' userImage bytes=' + userBase64.length);

      // ★ 7. 调 MiniMax image-01 · subject_reference = userImage（用户图作主体）
      const startTs = Date.now();
      let upstream;
      try {
        upstream = await minimaxImage.callUpstream({
          baseUrl: IMAGE_BASE_URL,
          apiKey: keyPick.key,
          model: IMAGE_MODEL,
          prompt: fusionPrompt,
          userImageDataUrl: userImage,
          timeoutMs: 90 * 1000
        });
      } catch (e) {
        console.error('[FUSION_ANCIENT] upstream err', e.message);
        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false, source: 'error', error: 'image-provider-timeout',
          message: '融合服务调用超时 · 请稍后重试',
          requestId: requestId, sampleId: sampleId
        }));
      }

      const elapsed = Date.now() - startTs;
      console.log('[FUSION_ANCIENT] upstream status', upstream.status, 'elapsed', elapsed + 'ms');

      if (upstream.status < 200 || upstream.status >= 300) {
        // ★ 透传错误但脱敏
        let errBody = upstream.body || '';
        let errShort = errBody.length > 300 ? errBody.slice(0, 300) + '...' : errBody;
        let code = 'image-provider-rejected';
        if (upstream.status === 429) code = 'image-provider-rate-limit';
        if (upstream.status === 401 || upstream.status === 403) code = 'image-provider-unauthorized';
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false, source: 'error', error: code,
          message: '融合服务未返回有效图片（HTTP ' + upstream.status + '）',
          upstreamStatus: upstream.status,
          upstreamShort: errShort,
          requestId: requestId, sampleId: sampleId
        }));
      }

      // ★ 8. 解析 Provider 响应
      const parsedResult = minimaxImage.parseUpstream(upstream.body);
      if (!parsedResult.ok) {
        console.error('[FUSION_ANCIENT] parse failed ·', parsedResult.error, '·', parsedResult.message);
        let httpCode = 502;
        if (parsedResult.error === 'image-generation-failed') httpCode = 502;
        if (parsedResult.error === 'invalid-image-response') httpCode = 502;
        res.statusCode = httpCode;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(Object.assign({
          requestId: requestId,
          sampleId: sampleId,
          source: 'error'
        }, parsedResult)));
      }

      const imageUrl = parsedResult.imageUrl || null;
      let imageDataUrl = parsedResult.imageDataUrl || null;
      const successCount = parsedResult.successCount || 0;
      const failedCount = parsedResult.failedCount || 0;

      console.log('[FUSION_ANCIENT] SUCCESS · sampleId=' + sampleId + ' · success=' + successCount + ' failed=' + failedCount + ' · hasUrl=' + !!imageUrl + ' hasB64=' + !!imageDataUrl);

      // ★ 关键：Provider 返回的临时 OSS URL 浏览器加载常 ERR_CONNECTION_RESET
      //   后端立即下载 → 转 base64 data URL → 给前端
      //   ancient / modern / western 共用 providers/image-proxy
      let proxyFallbackUrl = null;
      let proxyWarning = null;
      if (imageUrl && !imageDataUrl) {
        console.log('[FUSION_ANCIENT] need image proxy · url=' + _safeHostForLog(imageUrl));
        const proxy = await imageProxy.downloadImageAsDataUrl(imageUrl, { requestId: requestId, label: 'FUSION_IMAGE_FETCH' });
        if (proxy.ok) {
          imageDataUrl = proxy.imageDataUrl;
          proxyFallbackUrl = proxy.fallbackImageUrl || null;
          proxyWarning = proxy.warning || null;
        } else {
          console.log('[FUSION_ANCIENT] image proxy failed · error=' + proxy.error + ' · reason=' + (proxy.reason || '') + ' · fallback to raw imageUrl');
        }
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const out = {
        ok: true,
        source: 'ai-image',
        requestId: requestId,
        sampleId: sampleId,
        sampleName: sampleName,
        elapsedMs: elapsed,
        successCount: successCount,
        failedCount: failedCount
      };
      // 优先 imageDataUrl · 没 dataUrl 才回退到 imageUrl
      if (imageDataUrl) out.imageDataUrl = imageDataUrl;
      else if (imageUrl) out.imageUrl = imageUrl;
      if (proxyFallbackUrl) out.imageUrl = proxyFallbackUrl;
      if (proxyWarning) out.warning = proxyWarning;
      return res.end(JSON.stringify(out));
    });
    return;
  }

  // ============================================
  // ★ /api/fusion/modern · 现代身份合成像 · 共享 fusion handler
  // - 校验 sampleId ∈ M01-M20 · 校验 userImage 是合法 data URL
  // - 限制 body 8MB · 后端读取 modern sample main 图
  // - 共用 ancient-fusion-provider (Key/BaseUrl/Model) + image-proxy
  // ============================================
  const isFusionModernApi = (req.url.split('?')[0] === '/api/fusion/modern' ||
                              req.url.split('?')[0] === '/exhibition-camera/api/fusion/modern');
  if (req.method === 'POST' && isFusionModernApi) {
    const fusionHandler = require('./providers/fusion-handler');
    return fusionHandler.createFusionHandler({
      system: 'modern',
      directory: DIRECTORY,
      resolveSampleName: function (sampleId) {
        const map = minimaxImage && minimaxImage.MODERN_SAMPLE_NAMES;
        return (map && map[sampleId]) || sampleId;
      }
    })(req, res);
  }

  // ============================================
  // ★ /api/fusion/western · 西方历史合成像 · 共享 fusion handler
  // - 校验 sampleId ∈ W01-W14 · 校验 userImage 是合法 data URL
  // - 后端读取 western sample main 图 (normalized/Wxx/Wxx_sample_main.jpg)
  // - 共用 ancient-fusion-provider (Key/BaseUrl/Model) + image-proxy
  // ============================================
  const isFusionWesternApi = (req.url.split('?')[0] === '/api/fusion/western' ||
                               req.url.split('?')[0] === '/exhibition-camera/api/fusion/western');
  if (req.method === 'POST' && isFusionWesternApi) {
    const fusionHandler = require('./providers/fusion-handler');
    return fusionHandler.createFusionHandler({
      system: 'western',
      directory: DIRECTORY,
      resolveSampleName: function (sampleId) {
        const map = minimaxImage && minimaxImage.WESTERN_SAMPLE_NAMES;
        return (map && map[sampleId]) || sampleId;
      }
    })(req, res);
  }

  // ============================================
  // ★ /api/classify/western · 独立 western 专用路由 · 14 个历史样本
  // - 真实 AI 只接收一张当前摄像头截图 + 14 组样本元数据
  // - 不传 visualProfile（历史人物是固定档案，直接传 sampleId + 类别）
  // - 严格模式：上游 4xx/5xx → 透传 status code
  // - 返回 sampleId (W01-W14) + confidence + shortReason + matchedFeatures + visionCheck
  // ============================================
  const isWesternApi = (req.url.split('?')[0] === '/api/classify/western' ||
                        req.url.split('?')[0] === '/exhibition-camera/api/classify/western');
  if (req.method === 'POST' && isWesternApi) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      console.log('[WESTERN_API] POST /api/classify/western · body bytes =', body.length);
      let input;
      try { input = JSON.parse(body); } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-json', message: e.message }));
      }

      const image = input && input.image;
      const allowed = (input && Array.isArray(input.allowedSampleIds) && input.allowedSampleIds.length > 0)
        ? input.allowedSampleIds
        : ['W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11','W12','W13','W14'];
      console.log('[WESTERN_API] allowed sampleIds:', allowed.join(','));

      // 拒绝本地匹配 / 历史结果泄露
      const forbidden = ['localCandidate','localMatch','recommendedSampleId','previousSampleId','lastSampleId','defaultSampleId'];
      for (const k of forbidden) {
        if (input && input[k] !== undefined) console.warn('[WESTERN_API] WARN forbidden field', k, 'ignored');
      }

      // 解析 current frame
      let mime = null, base64 = null;
      if (typeof image === 'string') {
        const m = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
        if (m) { mime = 'image/' + (m[1] === 'jpg' ? 'jpeg' : m[1].toLowerCase()); base64 = m[2]; }
      }
      console.log('[WESTERN_VISION] current frame mime:', mime, '· bytes:', base64 ? base64.length : 0);
      if (!mime || !base64) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: 'image 必须是 data:image/(png|jpeg|webp);base64,…' }));
      }
      if (base64.length < 4096) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: 'base64 太短 · 拒绝 1×1 / 占位图' }));
      }

      let imgW = 0, imgH = 0;
      try {
        const buf = Buffer.from(base64, 'base64');
        if (buf[0] === 0x89 && buf[1] === 0x50) {
          imgW = buf.readUInt32BE(16); imgH = buf.readUInt32BE(20);
        } else if (buf[0] === 0xFF && buf[1] === 0xD8) {
          let i = 2;
          while (i < buf.length - 1) {
            while (i < buf.length && buf[i] !== 0xFF) i++;
            if (i >= buf.length - 1) break;
            while (i < buf.length - 1 && buf[i + 1] === 0xFF) i++;
            const marker = buf[i + 1];
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
              if (i + 7 < buf.length) { imgH = buf.readUInt16BE(i + 3); imgW = buf.readUInt16BE(i + 5); }
              break;
            }
            const segLen = buf.readUInt16BE(i + 2);
            i += 2 + segLen;
          }
        }
      } catch (e) { console.warn('[WESTERN_VISION] decode err', e.message); }
      console.log('[WESTERN_VISION] current frame width:', imgW, '· height:', imgH);
      if (!imgW || !imgH || Math.min(imgW, imgH) < 256) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'invalid-camera-image', message: '图像短边 < 256 · 拒绝', width: imgW, height: imgH }));
      }

      // ★ P0-1：保存服务端真正收到的图
      try {
        const debugDir = path.join(__dirname, '_debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const debugBuf = Buffer.from(base64, 'base64');
        const sha = require('crypto').createHash('sha256').update(debugBuf).digest('hex');
        const ext = mime.indexOf('jpeg') >= 0 ? 'jpg' : (mime.indexOf('png') >= 0 ? 'png' : 'webp');
        const savedPath = path.join(debugDir, 'western_last_received_frame.' + ext);
        fs.writeFileSync(savedPath, debugBuf);
        console.log('[WESTERN_DEBUG_IMAGE] mime:', mime, '· bytes:', debugBuf.length, '· width:', imgW, '· height:', imgH, '· sha256:', sha);
        console.log('[WESTERN_DEBUG_IMAGE] saved path:', savedPath);
      } catch (e) { console.warn('[WESTERN_DEBUG_IMAGE] save err:', e.message); }

      // ★ 本地 MediaPipe 人脸 gate
      const localFaceDetected = input && input.localFaceDetected === true;
      const localLandmarkCount = Number(input && input.localLandmarkCount) || 0;
      const confirmedHasFace = localFaceDetected && localLandmarkCount >= 100;
      console.log('[WESTERN_FACE_GATE] localFaceDetected:', localFaceDetected, '· landmarkCount:', localLandmarkCount, '· confirmedHasFace:', confirmedHasFace);

      // ★ 接收并保存前端裁切的人脸图
      let cropMime = null, cropBase64 = null, cropW = 0, cropH = 0;
      const faceCropDataUrl = input && input.faceCropDataUrl;
      if (typeof faceCropDataUrl === 'string') {
        const cm = faceCropDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
        if (cm) {
          cropMime = 'image/' + (cm[1] === 'jpg' ? 'jpeg' : cm[1].toLowerCase());
          cropBase64 = cm[2];
          const cbuf = Buffer.from(cropBase64, 'base64');
          if (cbuf[0] === 0xFF && cbuf[1] === 0xD8) {
            let j = 2;
            while (j < cbuf.length - 1) {
              while (j < cbuf.length && cbuf[j] !== 0xFF) j++;
              if (j >= cbuf.length - 1) break;
              while (j < cbuf.length - 1 && cbuf[j + 1] === 0xFF) j++;
              const mk = cbuf[j + 1];
              if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) {
                if (j + 7 < cbuf.length) { cropH = cbuf.readUInt16BE(j + 3); cropW = cbuf.readUInt16BE(j + 5); }
                break;
              }
              j += 2 + cbuf.readUInt16BE(j + 2);
            }
          } else if (cbuf[0] === 0x89 && cbuf[1] === 0x50) {
            cropW = cbuf.readUInt32BE(16); cropH = cbuf.readUInt32BE(20);
          }
          try {
            const debugDir = path.join(__dirname, '_debug');
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
            const cropExt = cropMime.indexOf('jpeg') >= 0 ? 'jpg' : (cropMime.indexOf('png') >= 0 ? 'png' : 'webp');
            const cropPath = path.join(debugDir, 'western_last_face_crop.' + cropExt);
            fs.writeFileSync(cropPath, cbuf);
            console.log('[WESTERN_FACE_CROP] width:', cropW, '· height:', cropH, '· bytes:', cbuf.length, '· attached: true · saved:', cropPath);
          } catch (e) { console.warn('[WESTERN_FACE_CROP] save err:', e.message); }
        }
      } else {
        console.log('[WESTERN_FACE_CROP] attached: false (no faceCropDataUrl)');
      }

      // ★ 本地无人脸 → 422
      if (!confirmedHasFace) {
        console.log('[WESTERN_FACE_GATE] no face confirmed locally · returning no-face (HTTP 422)');
        res.statusCode = 422;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'no-face', error: 'no-face-detected' }));
      }

      // 加载 W01-W14 sample glossary
      let westernGlossary = null;
      try {
        const wSrc = fs.readFileSync(path.join(__dirname, 'js', 'western-14-samples-data.js'), 'utf8');
        const ctx = { window: {} };
        vm.createContext(ctx);
        vm.runInContext(wSrc, ctx);
        const samples = ctx.window.WESTERN_14_SAMPLES || [];
        westernGlossary = samples.map(function (s) {
          return {
            sampleId: s.sampleId,
            sampleName: s.sampleName,
            sampleNameEn: s.sampleNameEn,
            subtitle: s.subtitle
          };
        });
      } catch (e) {
        console.error('[WESTERN_VISION] FAIL load glossary:', e.message);
      }
      console.log('[WESTERN_VISION] glossary count:', westernGlossary ? westernGlossary.length : 0);

      if (!AI_API_KEY) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'missing-api-key' }));
      }

      // ★ 硬约束短 prompt：禁止模型在正文里逐步分析（"步骤一/二/三/四"会诱导它先输出推理文字）
      // ★ 14 个样本的视觉风格 + 6 维度 reason 仍然必要，但只能塞进 JSON 字段中
      const systemPrompt =
        '你是 BIAS SYSTEM 中的"西方面学历史档案大模型"。\n' +
        '输入是一张摄像头截图。\n' +
        '【硬约束】\n' +
        '1. 只输出一个 JSON object。\n' +
        '2. 第一个字符必须是 { · 最后一个字符必须是 }。\n' +
        '3. 严禁输出任何分析过程、说明、Markdown、代码块、或 JSON 之外的任何文字。\n' +
        '4. 必须从 W01-W14 中选择一个 sampleId。\n' +
        '5. 本地 MediaPipe FaceLandmarker 已确认裁切图中存在完整人脸（共 ' + localLandmarkCount + ' 个 landmarks），不得返回 visionCheck.hasFace=false。\n\n' +
        '【W01-W14 视觉档案】\n' +
        '- W01 苏格拉底 / Socrates · 丑陋与智慧悖论\n' +
        '- W02 亚历山大大帝 / Alexander the Great · 英雄侧影\n' +
        '- W03 尼禄 / Nero · 暴君道德化\n' +
        '- W04 圣女贞德 / Joan of Arc · 圣徒与异端\n' +
        '- W05 伊丽莎白一世 / Elizabeth I · 双面假面\n' +
        '- W06 路易十四 / Louis XIV · 太阳王表演\n' +
        '- W07 玛丽·安托瓦内特 / Marie Antoinette · 奢侈归罪\n' +
        '- W08 拿破仑 / Napoleon · 英雄与讽刺画\n' +
        '- W09 文艺复兴女性肖像型 · 理想美被格式化\n' +
        '- W10 梵高自画像型 · 重复凝视的艺术家\n' +
        '- W11 阿尔钦博托复合脸 · 面孔被自然接管\n' +
        '- W12 梅塞施密特性格头像 · 极端表情被永久定型\n' +
        '- W13 拉瓦特侧影相 · 轮廓被转换成人格\n' +
        '- W14 天生罪犯型 / Lombroso · 面孔提前定罪\n\n' +
        '【匹配规则】只比较视觉特征（脸型 / 五官比例 / 头部姿态 / 明暗 / 表情 / 构图距离）。严禁因为人物名气、艺术品类别或社会标签选择样本。\n' +
        '【6 维度 reason】必须在 dimensionReasons 内为 status / temperament / power / body / role / risk 各写 30-80 字中文判定原因（针对本张图 + 选中的 Wxx 样本的视觉关系），不能是套话。';

      const userText = JSON.stringify({
        task: 'choose_one_sample_from_14_western_archive',
        allowedSampleIds: allowed,
        glossary: westernGlossary || []
      });

      console.log('[WESTERN_VISION] vision model:', AI_MODEL);

      const content = [];
      // content[0] = 任务文本
      content.push({ type: 'text', text: userText });
      // content[1] = 裁切人脸图（如果有）；content[2] = 完整帧
      if (cropBase64 && cropMime) {
        content.push({ type: 'text', text: '本地 MediaPipe 裁切的人脸图（' + cropW + '×' + cropH + '，已确认 ' + localLandmarkCount + ' landmarks）' });
        content.push({ type: 'image_url', image_url: { url: 'data:' + cropMime + ';base64,' + cropBase64 } });
        content.push({ type: 'text', text: '完整摄像头帧（' + imgW + '×' + imgH + '，作为辅助语境）' });
        content.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + base64 } });
      } else {
        content.push({ type: 'text', text: '当前摄像头截帧（' + imgW + '×' + imgH + '）' });
        content.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + base64 } });
      }

      // 打印 image slot 映射
      content.forEach(function (item, idx) {
        if (item.type === 'image_url' && item.image_url && item.image_url.url) {
          const m = item.image_url.url.match(/^data:image\/([^;]+);base64,(.+)$/);
          if (m) {
            let w = 0, h = 0;
            try {
              const b = Buffer.from(m[2], 'base64');
              if (b[0] === 0x89 && b[1] === 0x50) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
              else if (b[0] === 0xFF && b[1] === 0xD8) {
                let i = 2;
                while (i < b.length - 1) {
                  while (i < b.length && b[i] !== 0xFF) i++;
                  if (i >= b.length - 1) break;
                  while (i < b.length - 1 && b[i + 1] === 0xFF) i++;
                  const marker = b[i + 1];
                  if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                    if (i + 7 < b.length) { h = b.readUInt16BE(i + 3); w = b.readUInt16BE(i + 5); }
                    break;
                  }
                  i += 2 + b.readUInt16BE(i + 2);
                }
              }
            } catch (e) {}
            console.log('[WESTERN_IMAGE_SLOT] index', idx, 'mime', m[1], 'bytes', m[2].length, 'width', w, 'height', h);
          }
        } else if (item.type === 'text') {
          console.log('[WESTERN_REQUEST_MAP] content[' + idx + '] text:', item.text.slice(0, 80));
        }
      });

      const aiReq = {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'western_visual_match',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['sampleId','confidence','shortReason','matchedFeatures','visionCheck','candidateScores'],
              properties: {
                sampleId: { type: 'string', enum: allowed.concat(['']) },
                confidence: { type: 'string', enum: ['low','medium','high'] },
                shortReason: { type: 'string' },
                matchedFeatures: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
                visionCheck: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['hasFace','wearingGlasses','headPose','framing','brightness'],
                  properties: {
                    hasFace: { type: 'boolean' },
                    wearingGlasses: { type: 'boolean' },
                    headPose: { type: 'string', enum: ['front','left','right','up','down','unclear'] },
                    framing: { type: 'string', enum: ['face-closeup','head-and-shoulders','upper-body','distant','unclear'] },
                    brightness: { type: 'string', enum: ['dark','medium','bright','unclear'] },
                    faceCount: { type: 'integer' },
                    expression: { type: 'string' }
                  }
                },
                candidateScores: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 14,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['sampleId','score'],
                    properties: {
                      sampleId: { type: 'string', enum: allowed },
                      score: { type: 'number', minimum: 0, maximum: 1 }
                    }
                  }
                },
                dimensionReasons: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['status','temperament','power','body','role','risk'],
                  properties: {
                    status:       { type: 'string' },
                    temperament:  { type: 'string' },
                    power:        { type: 'string' },
                    body:         { type: 'string' },
                    role:         { type: 'string' },
                    risk:         { type: 'string' }
                  }
                }
              }
            }
          }
        }
      };

      let upstream;
      try {
        upstream = await proxyAI(JSON.stringify(aiReq));
      } catch (e) {
        console.error('[WESTERN_API] upstream network exception:', e && e.message);
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, source: 'error', error: 'upstream-request-failed', message: e && e.message }));
      }
      console.log('[WESTERN_API] upstream status', upstream.status);
      console.log('[WESTERN_API] upstream raw text', (upstream.raw || '').slice(0, 800));

      // ★ 上游 4xx/5xx → 透传 status code
      if (upstream.status >= 400) {
        let upstreamMessage = (upstream.raw || '').slice(0, 500);
        let parsedBody = upstream.body;
        let failedImageSlot = '';
        try {
          if (typeof parsedBody === 'string') parsedBody = JSON.parse(parsedBody);
          if (parsedBody && parsedBody.error && parsedBody.error.message) upstreamMessage = parsedBody.error.message;
          const m = upstreamMessage.match(/content\[(\d+)\][^\[]*?(\w+)?\s*is\s*sensitive/i);
          if (m) failedImageSlot = 'content[' + m[1] + ']';
        } catch (e) {}
        console.error('[WESTERN_API] upstream rejected · status', upstream.status, '· slot:', failedImageSlot, '· message:', upstreamMessage);
        const errCode = upstream.status === 422 ? 'upstream-image-rejected' : ('upstream-' + upstream.status);
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'error',
          error: errCode,
          upstreamStatus: upstream.status,
          failedImageSlot: failedImageSlot,
          upstreamMessage: upstreamMessage
        }));
      }

      const txt = extractModelText(upstream.body);
      console.log('[WESTERN_AI] upstream response received · status', upstream.status, '· raw length', (upstream.raw || '').length);
      console.log('[WESTERN_AI] first response text head:', (txt || '').slice(0, 200));
      let parsed = parseModelJson(txt);
      console.log('[WESTERN_API] first parse parsed?', !!parsed);

      // visionCheck 净化
      let vc = parsed ? (parsed.visionCheck || {}) : {};
      if (typeof vc !== 'object' || vc === null) vc = {};
      const allowedKeys = ['hasFace','wearingGlasses','headPose','framing','brightness','faceCount','expression'];
      const cleanedVc = {};
      for (const k of allowedKeys) cleanedVc[k] = vc[k];
      if (typeof cleanedVc.hasFace !== 'boolean') {
        if (typeof cleanedVc.faceCount === 'number') cleanedVc.hasFace = cleanedVc.faceCount > 0;
        else cleanedVc.hasFace = false;
      }
      if (typeof cleanedVc.wearingGlasses !== 'boolean') cleanedVc.wearingGlasses = false;
      if (!['front','left','right','up','down','unclear'].includes(cleanedVc.headPose)) cleanedVc.headPose = 'unclear';
      if (!['face-closeup','head-and-shoulders','upper-body','distant','unclear'].includes(cleanedVc.framing)) cleanedVc.framing = 'unclear';
      if (!['dark','medium','bright','unclear'].includes(cleanedVc.brightness)) cleanedVc.brightness = 'unclear';
      vc = cleanedVc;

      // 本地 MediaPipe 已确认 → 覆盖模型 visionCheck.hasFace=false
      if (confirmedHasFace && vc.hasFace === false) {
        console.warn('[WESTERN_VISION_WARNING] model returned hasFace=false while MediaPipe confirmed face (landmarkCount=' + localLandmarkCount + ') · normalizing to true');
        vc.hasFace = true;
        vc.faceCount = 1;
      }

      if (vc.hasFace === false) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'no-face',
          error: 'no-face-detected',
          visionCheck: vc
        }));
      }

      // ★ 1. 优先使用模型直接返回的完整 JSON（isCompleteParsed 已校验 sampleId + 6 维度）
      if (parsed && classifyPipeline.isCompleteParsed(parsed, 'western')) {
        console.log('[WESTERN_API] first parse complete · sampleId =', parsed.sampleId);
        // ★ 把 sampleId 同义词补齐
        if (typeof parsed.sampleId !== 'string' || allowed.indexOf(parsed.sampleId) < 0) {
          if (typeof parsed.finalSampleId === 'string' && allowed.indexOf(parsed.finalSampleId) >= 0) parsed.sampleId = parsed.finalSampleId;
          else if (Array.isArray(parsed.topCandidates) && parsed.topCandidates[0] && allowed.indexOf(parsed.topCandidates[0].sampleId) >= 0) parsed.sampleId = parsed.topCandidates[0].sampleId;
          else if (parsed.candidateScores && typeof parsed.candidateScores === 'object') {
            let topK = null, topS = -1;
            if (Array.isArray(parsed.candidateScores)) {
              for (const c of parsed.candidateScores) { const s = Number(c && c.score) || 0; if (s > topS && c && allowed.indexOf(c.sampleId) >= 0) { topS = s; topK = c.sampleId; } }
            } else {
              for (const k of Object.keys(parsed.candidateScores)) {
                const s = Number(parsed.candidateScores[k]) || 0;
                if (s > topS && allowed.indexOf(k) >= 0) { topS = s; topK = k; }
              }
            }
            if (topK) parsed.sampleId = topK;
          }
        }
        // ★ 规范化 confidence / shortReason / matchedFeatures
        if (!['low','medium','high'].includes(parsed.confidence)) parsed.confidence = 'medium';
        if (typeof parsed.shortReason !== 'string' || parsed.shortReason.length === 0) {
          if (typeof parsed.finalReason === 'string') parsed.shortReason = parsed.finalReason;
          else if (Array.isArray(parsed.topCandidates) && parsed.topCandidates[0] && parsed.topCandidates[0].rationale) parsed.shortReason = parsed.topCandidates[0].rationale;
          else if (parsed.sampleId) parsed.shortReason = '视觉匹配 · 候选 ' + parsed.sampleId;
        }
        if (!Array.isArray(parsed.matchedFeatures) || parsed.matchedFeatures.length < 2) {
          if (Array.isArray(parsed.topCandidates)) parsed.matchedFeatures = parsed.topCandidates.slice(0, 4).map(function (c) { return c.rationale || c.sampleId; }).filter(Boolean);
          else parsed.matchedFeatures = ['视觉匹配', '视觉特征比对'];
        }
        const unified = classifyPipeline.buildUnifiedResult(parsed, 'western', { reasonSource: 'ai-personalized', upstreamStatus: upstream.status });
        unified.visionCheck = vc;
        unified.matchedFeatures = Array.isArray(unified.matchedFeatures) ? unified.matchedFeatures.slice(0, 4) : [];
        const dimCount = classifyPipeline.countNonEmptyDimensionReasons(unified.dimensionReasons);
        console.log('[WESTERN_API] SUCCESS · sampleId =', unified.sampleId, '· reasonSource =', unified.reasonSource, '· dimReasons =', dimCount + '/6 · westernSource = normal');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: true,
          source: 'ai',
          system: 'western',
          sampleId: unified.sampleId,
          confidence: unified.confidence,
          shortReason: unified.shortReason,
          matchedFeatures: unified.matchedFeatures,
          visionCheck: unified.visionCheck,
          dimensionReasons: unified.dimensionReasons,
          reasonSource: unified.reasonSource,
          upstreamStatus: upstream.status,
          westernSource: 'normal'
        }));
      }

      // ★ 2. 解析失败 / 字段缺失 → 公共修复流水线（先从自然语言提取 Wxx，再走理由补全）
      console.warn('[WESTERN_API] first parse incomplete · entering common pipeline');
      const repaired = await classifyPipeline.parseAndRepairClassification({
        system: 'western',
        upstreamText: txt,
        visualSummary: vc,
        sampleGlossary: (westernGlossary || []).map(function (g) { return { sampleId: g.sampleId, sampleName: g.sampleName, subtitle: g.subtitle }; }),
        proxyAI: proxyAI,
        model: AI_MODEL,
        logTag: '[WESTERN_REPAIR]',
        extractModelText: extractModelText
      });
      if (!repaired || !repaired.sampleId) {
        console.error('[WESTERN_API] repair pipeline returned no sampleId');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          ok: false,
          source: 'error',
          error: 'upstream-parse-failed',
          upstreamStatus: upstream.status,
          upstreamMessage: '模型返回格式异常 · 请重新分析'
        }));
      }
      repaired.visionCheck = vc;
      repaired.matchedFeatures = Array.isArray(repaired.matchedFeatures) ? repaired.matchedFeatures.slice(0, 4) : [];
      // ★ 区分修复来源：reasonSource='reason-completion' / 'sample-fallback'
      const dimCount2 = classifyPipeline.countNonEmptyDimensionReasons(repaired.dimensionReasons);
      const westernSourceTag = (repaired.reasonSource === 'reason-completion') ? 'repair' : ((repaired.reasonSource === 'sample-fallback') ? 'repair-text-fallback' : 'text-fallback');
      console.log('[WESTERN_API] SUCCESS · sampleId =', repaired.sampleId, '· reasonSource =', repaired.reasonSource, '· dimReasons =', dimCount2 + '/6 · westernSource =', westernSourceTag);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        ok: true,
        source: 'ai',
        system: 'western',
        sampleId: repaired.sampleId,
        confidence: repaired.confidence,
        shortReason: repaired.shortReason,
        matchedFeatures: repaired.matchedFeatures,
        visionCheck: repaired.visionCheck,
        dimensionReasons: repaired.dimensionReasons,
        reasonSource: repaired.reasonSource,
        upstreamStatus: upstream.status,
        westernSource: westernSourceTag
      }));
    });
    return;
  }

  // /api/health · 支持 /exhibition-camera/api/health 前缀
  if (req.method === 'GET' && (req.url === '/api/health' || req.url === '/exhibition-camera/api/health')) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      ok: true,
      hasKey: !!AI_API_KEY,
      baseUrl: AI_BASE_URL,
      model: AI_MODEL
    }));
  }

  // /favicon.ico → 静默返回 204
  if (req.url === '/favicon.ico') {
    res.statusCode = 204;
    return res.end();
  }

  // 静态文件 · 支持 / 和 /exhibition-camera/ 两种入口
  let url = req.url.split('?')[0];
  if (url === '/') {
    // 根路径默认显示新版 exhibition-camera/index.html
    const filePath = path.join(DIRECTORY, 'index.html');
    return fs.readFile(filePath, (err, data) => {
      if (err) { res.statusCode = 404; return res.end('not found'); }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(data);
    });
  }
  // 如果以 /exhibition-camera/ 开头 → 去子目录
  if (url.startsWith('/exhibition-camera/')) {
    url = url.replace('/exhibition-camera/', '/');
  }
  // 其它路径直接在子目录找
  let filePath = path.join(DIRECTORY, url);
  // 防止路径穿越
  if (!filePath.startsWith(DIRECTORY)) {
    res.statusCode = 403;
    return res.end('forbidden: ' + url);
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      return res.end('not found: ' + url);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = {
      '.html': 'text/html',
      '.js':   'application/javascript',
      '.mjs':  'application/javascript',
      '.css':  'text/css',
      '.json': 'application/json',
      '.png':  'image/png',
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif':  'image/gif',
      '.webp': 'image/webp',
      '.svg':  'image/svg+xml',
      '.ico':  'image/x-icon',
      '.wasm': 'application/wasm',
      '.map':  'application/json'
    }[ext] || 'application/octet-stream';
    // 文本类资源带 charset，wasm/binary 不带
    const isBinary = /\.(wasm|png|jpe?g|gif|webp|ico)$/i.test(ext);
    res.setHeader('Content-Type', isBinary ? mime : (mime + '; charset=utf-8'));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(data);
  });
});

// 同时支持：本地 node server.js 启动 HTTP 服务 · Vercel serverless 导出 handler
if (require.main === module) {
  // 本地启动
  server.listen(PORT, '0.0.0.0', () => {
    console.log('[server] listening on http://localhost:' + PORT);
  });
} else {
  // Vercel / 其他 serverless 平台直接导出 handler
  module.exports = (req, res) => {
    // 兼容 Vercel serverless 的 req/res 接口
    if (typeof req.on !== 'function') {
      // Vercel 提供的是 Web Request · 包装成 Node IncomingMessage
      const u = new URL(req.url || '/', 'http://localhost');
      const nodeReq = Object.assign(new Readable({ read() {} }), {
        url: req.url,
        method: req.method,
        headers: req.headers,
      });
      const nodeRes = {
        statusCode: 200,
        setHeader(k, v) { this.headers = this.headers || {}; this.headers[k] = v; },
        getHeader(k) { return (this.headers || {})[k]; },
        end(body) {
          res.statusCode = this.statusCode || 200;
          if (this.headers) {
            for (const k in this.headers) res.setHeader(k, this.headers[k]);
          }
          res.end(body);
        }
      };
      return server.emit('request', nodeReq, nodeRes);
    }
    return server.emit('request', req, res);
  };
}

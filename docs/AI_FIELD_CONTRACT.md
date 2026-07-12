# BIAS SYSTEM · AI 分析字段合同

> 文档版本：v0.1（待用户确认）
> 范围：仅约定 AI 接入阶段的输入 / 输出 / 兜底，不修改 UI
> 状态：**仅方案 · 未动代码**

---

## 0. 文档目的

把「摄像头画面 → AI 分析 → 填入结果页」这一段流程的**字段合同**（schema）写清楚，作为下一阶段接 AI 的对接文档。本文档不是产品介绍，不是技术综述，仅用于：

- 让前端知道每个 AI 字段要填到哪个 UI 槽位
- 让 AI prompt 知道自己必须返回什么、必须禁止什么
- 让失败兜底有明确规则可循

确认本文档后，再进入实际编码。

---

## 1. AI 调用时机

```
handleStartAnalysis()
  → 捕捉摄像头画面 → capturedFrame (dataUrl)
  → showPathSelectOverlay()              ← 不调 AI
用户点击 [ancient / modern / western]
  → analyzeWithAI(systemId, capturedFrame) ← 此时才调 AI
  → 拿到 result
  → mergeWithFallback(systemId, result)
  → fillResultPanel(systemId, merged)
  → showResultOverlay(systemId)          ← 弹出 result-layer
```

| 节点 | 是否调 AI | 说明 |
|---|---|---|
| 点击「开始分析」 | ❌ | 只捕捉画面 + 显示路径选择 |
| 路径选择出现后 | ❌ | 等待用户点击 |
| 用户点 ancient | ✅ | 仅调用 ANCIENT_PROMPT |
| 用户点 modern  | ✅ | 仅调用 MODERN_PROMPT |
| 用户点 western | ✅ | 仅调用 WESTERN_PROMPT |

硬约束：
- 三套 prompt 不会同时调用
- 一次只调用一套
- 选择路径前绝不发请求

---

## 2. 输入 payload

调用形态：`analyzeWithAI(systemId, capturedFrame)`

```js
{
  systemId:     "ancient" | "modern" | "western",
  image:        capturedFrame.dataUrl,        // base64 dataUrl
  prompt:       ANALYSIS_SYSTEMS[systemId].prompt,
  mode:         "structured_json",
  outputFormat: "json",
  requestId:    "r_" + Date.now() + "_" + Math.random().toString(36).slice(2,8),
  ts:           Date.now()
}
```

字段说明：

| 字段 | 取值 | 说明 |
|---|---|---|
| `systemId` | "ancient" / "modern" / "western" | 决定用哪条 prompt |
| `image` | base64 dataUrl | 形如 `"data:image/png;base64,iVBOR…"` |
| `prompt` | 三选一 | 与 systemId 强绑定，不混 |
| `mode` | "structured_json" | 写死 |
| `outputFormat` | "json" | 写死 |
| `requestId` | 时间戳 + 随机 | 防重入 / 调试追踪 |
| `ts` | Date.now() | 用于超时计算 |

不传给 AI 的内容：
- 不传摄像头元数据（FPS / 分辨率 / trackId 等）
- 不传 fallback（fallback 是前端硬编码兜底，AI 看不见）
- 不传 UI 文案 / SKU 标签 / className / DOM 结构

---

## 3. 字段命名约定

每套系统字段都用 `<slot>_<value|reason>` 这种下划线风格：

- `xxx_value`：要展示的主要归类词（短 · 4-12 字）
- `xxx_reason`：归类原因（句式固定：`因为：……`）

ancient 用 `palace_verdict` / `palace_reason`、`organ_verdict` / `organ_reason` ……
modern 用 `sexuality_value` / `sexuality_reason`、`gender_value` / `gender_reason` ……
western 用 `classical_verdict` / `classical_reason`、`silhouette_verdict` / `silhouette_reason` ……

---

## 4. 三套系统的 outputSchema

### 4.1 ancient · 古代面学（15 字段）

对应 UI：[`_preview/ancient-skin-v4.html`](file:///d:/TRAE%20SOLO%20CN/%E7%A8%8B%E5%BA%8F%E8%89%BA%E6%9C%AF%E4%BD%9C%E4%B8%9A/exhibition-camera/_preview/ancient-skin-v4.html)

#### 顶部判读栏（Nº 02 · verdict）

| 字段名 | 类型 | 示例 | fallback | UI 位置 |
|---|---|---|---|---|
| `verdictMajor` | string | `"命宫闭塞"` | `"命宫闭塞"` | `.vb-major` 大标题 |
| `verdictLine` | string | `"命宫闭塞 / 审辨官偏 / 山根限险"` | `"命宫闭塞 / 审辨官偏 / 山根限险"` | `.vb-line[0] .v` 归类行 |
| `judgement` | string | `"印堂不展，主检索入口受阻。"` | `"印堂不展，主档案入口受阻。"` | `.vb-line[1] .v` 判词 |

#### 6 宫格（AX-01 ~ AX-06）

| 字段名 | 类型 | fallback | UI 位置 |
|---|---|---|---|
| `palace_verdict` / `palace_reason` | string / string | `"命宫闭塞"` / `"因为：印堂不展，主档案入口受阻。"` | AX-01 |
| `organ_verdict` / `organ_reason` | string / string | `"审辨官偏"` / `"因为：鼻势偏斜，判断系统失准。"` | AX-02 |
| `zone_verdict` / `zone_reason` | string / string | `"中停独旺"` / `"因为：鼻准与中庭突出，中年限被过度放大。"` | AX-03 |
| `mountain_verdict` / `mountain_reason` | string / string | `"五岳不归"` / `"因为：额、鼻、颧、地阁不能互应。"` | AX-04 |
| `complexion_verdict` / `complexion_reason` | string / string | `"准头灰暗"` / `"因为：鼻头色暗，财帛信号被扣除。"` | AX-05 |
| `bone_verdict` / `bone_reason` | string / string | `"山根限险"` / `"因为：山根为中限关口，系统标记三十五前后有一劫。"` | AX-06 |

### 4.2 modern · 现代归类（12 字段）

对应 UI：[`_preview/modern-result-preview.html`](file:///d:/TRAE%20SOLO%20CN/%E7%A8%8B%E5%BA%8F%E8%89%BA%E6%9C%AF%E4%BD%9C%E4%B8%9A/exhibition-camera/_preview/modern-result-preview.html)

#### 6 张分类卡（SKU-01 ~ SKU-06）

| 字段名 | 类型 | fallback | UI 位置 |
|---|---|---|---|
| `sexuality_value` / `sexuality_reason` | string / string | `"顺性偏好"` / `"因为：经典样本分布占比显著高于系统基线。"` | SKU-01 |
| `gender_value` / `gender_reason` | string / string | `"系统主流判定"` / `"因为：面部轮廓匹配主流分布带。"` | SKU-02 |
| `income_value` / `income_reason` | string / string | `"中层收入"` / `"因为：综合体征与系统定义的中产聚类高度一致。"` | SKU-03 |
| `family_value` / `family_reason` | string / string | `"核心家庭"` / `"因为：眉眼特征对照\"核心家庭\"原型匹配度最高。"` | SKU-04 |
| `relationship_value` / `relationship_reason` | string / string | `"稳定同居"` / `"因为：唇相与法令纹对照\"稳定同居\"档位对位。"` | SKU-05 |
| `risk_value` / `risk_reason` | string / string | `"中风险"` / `"因为：综合档案判定为\"中风险\"档位。"` | SKU-06 |

### 4.3 western · 西方测量（18 字段）

对应 UI：[`_preview/western-skin.html`](file:///d:/TRAE%20SOLO%20CN/%E7%A8%8B%E5%BA%8F%E8%89%BA%E6%9C%AF%E4%BD%9C%E4%B8%9A/exhibition-camera/_preview/western-skin.html)

#### 6 宫格（WP-01 ~ WP-06）

| 字段名 | 类型 | fallback | UI 位置 |
|---|---|---|---|
| `classical_verdict` / `classical_reason` | string / string | `"古典兽相"` / `"因为：系统将五官与动物性格相连，用类比替代真实理解。"` | WP-01 |
| `silhouette_verdict` / `silhouette_reason` | string / string | `"侧影道德化"` / `"因为：系统根据侧脸轮廓推测理性、克制与高贵程度。"` | WP-02 |
| `cranial_verdict` / `cranial_reason` | string / string | `"颅骨地图化"` / `"因为：系统把头骨表面误读为人格能力的分区图。"` | WP-03 |
| `criminalization_verdict` / `criminalization_reason` | string / string | `"犯罪预兆化"` / `"因为：系统把低额 / 突颌 / 不对称等特征标记为危险倾向。"` | WP-04 |
| `averageness_verdict` / `averageness_reason` | string / string | `"平均脸规训"` / `"因为：系统用统计平均值制造\"正常脸\"，再把偏差视为异常。"` | WP-05 |
| `algo_verdict` / `algo_reason` | string / string | `"算法再分类"` / `"因为：系统以中立技术之名，重新执行旧相貌学的分类冲动。"` | WP-06 |

#### 档案测量卡（FILE 027-A · 第 2 列）

| 字段名 | 类型 | fallback | UI 位置 |
|---|---|---|---|
| `ht` | string | `"178.0"` | `.k=HT .v` |
| `cranialIdx` | string | `"82.4 / brachy"` | `.k="CR IDX" .v` |
| `nasW` | string | `"36"` | `.k="NAS W" .v` |
| `earL` | string | `"64"` | `.k="EAR L" .v` |
| `jaw` | string | `"124"` | `.k="JAW" .v` |
| `age` | string | `"indeterm."` | `.k="AGE" .v` |

---

## 5. 字段合同（统一格式）

```js
const ANALYSIS_SYSTEMS = {
  ancient: {
    id: "ancient",
    label: "古代面学",
    promptName: "ANCIENT_PROMPT",
    input: {
      image: "capturedFrame.dataUrl",
      systemId: "ancient"
    },
    outputSchema: {
      verdictMajor:        { type: "string", example: "命宫闭塞",                              fallback: "命宫闭塞",                              uiTarget: "ancient .vb-major" },
      verdictLine:         { type: "string", example: "命宫闭塞 / 审辨官偏 / 山根限险",           fallback: "命宫闭塞 / 审辨官偏 / 山根限险",          uiTarget: "ancient .vb-line[0] .v" },
      judgement:           { type: "string", example: "印堂不展，主检索入口受阻。",                fallback: "印堂不展，主档案入口受阻。",             uiTarget: "ancient .vb-line[1] .v" },
      palace_verdict:      { type: "string", example: "命宫闭塞",                              fallback: "命宫闭塞",                              uiTarget: "ancient [data-slot=AX-01] .verdict" },
      palace_reason:       { type: "string", example: "因为：印堂不展，主档案入口受阻。",           fallback: "因为：印堂不展，主档案入口受阻。",        uiTarget: "ancient [data-slot=AX-01] .reason" },
      organ_verdict:       { type: "string", example: "审辨官偏",                              fallback: "审辨官偏",                              uiTarget: "ancient [data-slot=AX-02] .verdict" },
      organ_reason:        { type: "string", example: "因为：鼻势偏斜，判断系统失准。",            fallback: "因为：鼻势偏斜，判断系统失准。",          uiTarget: "ancient [data-slot=AX-02] .reason" },
      zone_verdict:        { type: "string", example: "中停独旺",                              fallback: "中停独旺",                              uiTarget: "ancient [data-slot=AX-03] .verdict" },
      zone_reason:         { type: "string", example: "因为：鼻准与中庭突出，中年限被过度放大。",     fallback: "因为：鼻准与中庭突出，中年限被过度放大。", uiTarget: "ancient [data-slot=AX-03] .reason" },
      mountain_verdict:    { type: "string", example: "五岳不归",                              fallback: "五岳不归",                              uiTarget: "ancient [data-slot=AX-04] .verdict" },
      mountain_reason:     { type: "string", example: "因为：额、鼻、颧、地阁不能互应。",           fallback: "因为：额、鼻、颧、地阁不能互应。",        uiTarget: "ancient [data-slot=AX-04] .reason" },
      complexion_verdict:  { type: "string", example: "准头灰暗",                              fallback: "准头灰暗",                              uiTarget: "ancient [data-slot=AX-05] .verdict" },
      complexion_reason:   { type: "string", example: "因为：鼻头色暗，财帛信号被扣除。",           fallback: "因为：鼻头色暗，财帛信号被扣除。",        uiTarget: "ancient [data-slot=AX-05] .reason" },
      bone_verdict:        { type: "string", example: "山根限险",                              fallback: "山根限险",                              uiTarget: "ancient [data-slot=AX-06] .verdict" },
      bone_reason:         { type: "string", example: "因为：山根为中限关口，系统标记三十五前后有一劫。", fallback: "因为：山根为中限关口，系统标记三十五前后有一劫。", uiTarget: "ancient [data-slot=AX-06] .reason" }
    },
    fallback: { /* 见第 7 节 ANCIENT_FALLBACK */ }
  },

  modern: {
    id: "modern",
    label: "现代归类",
    promptName: "MODERN_PROMPT",
    input: {
      image: "capturedFrame.dataUrl",
      systemId: "modern"
    },
    outputSchema: {
      sexuality_value:     { type: "string", example: "顺性偏好",   fallback: "顺性偏好",   uiTarget: "modern [data-slot=SKU-01] .v3x-result__cell-value" },
      sexuality_reason:    { type: "string", example: "因为：经典样本分布占比显著高于系统基线。", fallback: "因为：经典样本分布占比显著高于系统基线。", uiTarget: "modern [data-slot=SKU-01] .v3x-result__cell-reason" },
      gender_value:        { type: "string", example: "系统主流判定", fallback: "系统主流判定", uiTarget: "modern [data-slot=SKU-02] value" },
      gender_reason:       { type: "string", example: "因为：面部轮廓匹配主流分布带。",       fallback: "因为：面部轮廓匹配主流分布带。",       uiTarget: "modern [data-slot=SKU-02] reason" },
      income_value:        { type: "string", example: "中层收入",   fallback: "中层收入",   uiTarget: "modern [data-slot=SKU-03] value" },
      income_reason:       { type: "string", example: "因为：综合体征与系统定义的中产聚类高度一致。", fallback: "因为：综合体征与系统定义的中产聚类高度一致。", uiTarget: "modern [data-slot=SKU-03] reason" },
      family_value:        { type: "string", example: "核心家庭",   fallback: "核心家庭",   uiTarget: "modern [data-slot=SKU-04] value" },
      family_reason:       { type: "string", example: "因为：眉眼特征对照\"核心家庭\"原型匹配度最高。", fallback: "因为：眉眼特征对照\"核心家庭\"原型匹配度最高。", uiTarget: "modern [data-slot=SKU-04] reason" },
      relationship_value:  { type: "string", example: "稳定同居",   fallback: "稳定同居",   uiTarget: "modern [data-slot=SKU-05] value" },
      relationship_reason: { type: "string", example: "因为：唇相与法令纹对照\"稳定同居\"档位对位。", fallback: "因为：唇相与法令纹对照\"稳定同居\"档位对位。", uiTarget: "modern [data-slot=SKU-05] reason" },
      risk_value:          { type: "string", example: "中风险",     fallback: "中风险",     uiTarget: "modern [data-slot=SKU-06] value" },
      risk_reason:         { type: "string", example: "因为：综合档案判定为\"中风险\"档位。",   fallback: "因为：综合档案判定为\"中风险\"档位。",   uiTarget: "modern [data-slot=SKU-06] reason" }
    },
    fallback: { /* MODERN_FALLBACK */ }
  },

  western: {
    id: "western",
    label: "西方测量",
    promptName: "WESTERN_PROMPT",
    input: {
      image: "capturedFrame.dataUrl",
      systemId: "western"
    },
    outputSchema: {
      classical_verdict:        { type: "string", example: "古典兽相",   fallback: "古典兽相",   uiTarget: "western [data-slot=WP-01] .verdict" },
      classical_reason:         { type: "string", example: "因为：系统将五官与动物性格相连，用类比替代真实理解。", fallback: "因为：系统将五官与动物性格相连，用类比替代真实理解。", uiTarget: "western [data-slot=WP-01] .reason" },
      silhouette_verdict:       { type: "string", example: "侧影道德化", fallback: "侧影道德化", uiTarget: "western [data-slot=WP-02] .verdict" },
      silhouette_reason:        { type: "string", example: "因为：系统根据侧脸轮廓推测理性、克制与高贵程度。",   fallback: "因为：系统根据侧脸轮廓推测理性、克制与高贵程度。",   uiTarget: "western [data-slot=WP-02] .reason" },
      cranial_verdict:          { type: "string", example: "颅骨地图化", fallback: "颅骨地图化", uiTarget: "western [data-slot=WP-03] .verdict" },
      cranial_reason:           { type: "string", example: "因为：系统把头骨表面误读为人格能力的分区图。",      fallback: "因为：系统把头骨表面误读为人格能力的分区图。",      uiTarget: "western [data-slot=WP-03] .reason" },
      criminalization_verdict:  { type: "string", example: "犯罪预兆化", fallback: "犯罪预兆化", uiTarget: "western [data-slot=WP-04] .verdict" },
      criminalization_reason:   { type: "string", example: "因为：系统把低额 / 突颌 / 不对称等特征标记为危险倾向。", fallback: "因为：系统把低额 / 突颌 / 不对称等特征标记为危险倾向。", uiTarget: "western [data-slot=WP-04] .reason" },
      averageness_verdict:      { type: "string", example: "平均脸规训", fallback: "平均脸规训", uiTarget: "western [data-slot=WP-05] .verdict" },
      averageness_reason:       { type: "string", example: "因为：系统用统计平均值制造\"正常脸\"，再把偏差视为异常。", fallback: "因为：系统用统计平均值制造\"正常脸\"，再把偏差视为异常。", uiTarget: "western [data-slot=WP-05] .reason" },
      algo_verdict:             { type: "string", example: "算法再分类", fallback: "算法再分类", uiTarget: "western [data-slot=WP-06] .verdict" },
      algo_reason:              { type: "string", example: "因为：系统以中立技术之名，重新执行旧相貌学的分类冲动。", fallback: "因为：系统以中立技术之名，重新执行旧相貌学的分类冲动。", uiTarget: "western [data-slot=WP-06] .reason" },
      ht:                       { type: "string", example: "178.0",      fallback: "178.0",      uiTarget: "western [data-slot=FILE-HT]   .v" },
      cranialIdx:               { type: "string", example: "82.4 / brachy", fallback: "82.4 / brachy", uiTarget: "western [data-slot=FILE-CRIDX] .v" },
      nasW:                     { type: "string", example: "36",         fallback: "36",         uiTarget: "western [data-slot=FILE-NASW]  .v" },
      earL:                     { type: "string", example: "64",         fallback: "64",         uiTarget: "western [data-slot=FILE-EARL]  .v" },
      jaw:                      { type: "string", example: "124",        fallback: "124",        uiTarget: "western [data-slot=FILE-JAW]   .v" },
      age:                      { type: "string", example: "indeterm.",  fallback: "indeterm.",  uiTarget: "western [data-slot=FILE-AGE]   .v" }
    },
    fallback: { /* WESTERN_FALLBACK */ }
  }
};
```

---

## 6. 字段到 UI 的映射总览

```
ancient.vb-major                          ← ancient.verdictMajor
ancient.vb-line[0].v                      ← ancient.verdictLine
ancient.vb-line[1].v                      ← ancient.judgement
ancient[AX-01].verdict / .reason          ← ancient.palace_*
ancient[AX-02].verdict / .reason          ← ancient.organ_*
ancient[AX-03].verdict / .reason          ← ancient.zone_*
ancient[AX-04].verdict / .reason          ← ancient.mountain_*
ancient[AX-05].verdict / .reason          ← ancient.complexion_*
ancient[AX-06].verdict / .reason          ← ancient.bone_*

modern[SKU-01].value / .reason            ← modern.sexuality_*
modern[SKU-02].value / .reason            ← modern.gender_*
modern[SKU-03].value / .reason            ← modern.income_*
modern[SKU-04].value / .reason            ← modern.family_*
modern[SKU-05].value / .reason            ← modern.relationship_*
modern[SKU-06].value / .reason            ← modern.risk_*

western[WP-01].verdict / .reason          ← western.classical_*
western[WP-02].verdict / .reason          ← western.silhouette_*
western[WP-03].verdict / .reason          ← western.cranial_*
western[WP-04].verdict / .reason          ← western.criminalization_*
western[WP-05].verdict / .reason          ← western.averageness_*
western[WP-06].verdict / .reason          ← western.algo_*
western[FILE-HT] .v / CRIDX / NASW / EARL / JAW / AGE
                                           ← western.ht / cranialIdx / nasW / earL / jaw / age
```

> 注：`data-slot="..."` 是动手阶段唯一允许加到结果页 HTML 的属性。**只加定位标记，不动 UI 文案、不动结构、不动样式。**

---

## 7. 三套 fallback

fallback 是**前端硬编码**，AI 完全不知道它的存在。当 AI 请求失败 / 返回非 JSON / 字段缺失时使用，保证结果页永远不空白、不出现 undefined、不卡在 loading。

```js
const ANCIENT_FALLBACK = {
  verdictMajor:        "命宫闭塞",
  verdictLine:         "命宫闭塞 / 审辨官偏 / 山根限险",
  judgement:           "印堂不展，主档案入口受阻。",
  palace_verdict:      "命宫闭塞",
  palace_reason:       "因为：印堂不展，主档案入口受阻。",
  organ_verdict:       "审辨官偏",
  organ_reason:        "因为：鼻势偏斜，判断系统失准。",
  zone_verdict:        "中停独旺",
  zone_reason:         "因为：鼻准与中庭突出，中年限被过度放大。",
  mountain_verdict:    "五岳不归",
  mountain_reason:     "因为：额、鼻、颧、地阁不能互应。",
  complexion_verdict:  "准头灰暗",
  complexion_reason:   "因为：鼻头色暗，财帛信号被扣除。",
  bone_verdict:        "山根限险",
  bone_reason:         "因为：山根为中限关口，系统标记三十五前后有一劫。"
};

const MODERN_FALLBACK = {
  sexuality_value:     "顺性偏好",
  sexuality_reason:    "因为：经典样本分布占比显著高于系统基线。",
  gender_value:        "系统主流判定",
  gender_reason:       "因为：面部轮廓匹配主流分布带。",
  income_value:        "中层收入",
  income_reason:       "因为：综合体征与系统定义的中产聚类高度一致。",
  family_value:        "核心家庭",
  family_reason:       "因为：眉眼特征对照\"核心家庭\"原型匹配度最高。",
  relationship_value:  "稳定同居",
  relationship_reason: "因为：唇相与法令纹对照\"稳定同居\"档位对位。",
  risk_value:          "中风险",
  risk_reason:         "因为：综合档案判定为\"中风险\"档位。"
};

const WESTERN_FALLBACK = {
  classical_verdict:        "古典兽相",
  classical_reason:         "因为：系统将五官与动物性格相连，用类比替代真实理解。",
  silhouette_verdict:       "侧影道德化",
  silhouette_reason:        "因为：系统根据侧脸轮廓推测理性、克制与高贵程度。",
  cranial_verdict:          "颅骨地图化",
  cranial_reason:           "因为：系统把头骨表面误读为人格能力的分区图。",
  criminalization_verdict:  "犯罪预兆化",
  criminalization_reason:   "因为：系统把低额 / 突颌 / 不对称等特征标记为危险倾向。",
  averageness_verdict:      "平均脸规训",
  averageness_reason:       "因为：系统用统计平均值制造\"正常脸\"，再把偏差视为异常。",
  algo_verdict:             "算法再分类",
  algo_reason:              "因为：系统以中立技术之名，重新执行旧相貌学的分类冲动。",
  ht:                       "178.0",
  cranialIdx:               "82.4 / brachy",
  nasW:                     "36",
  earL:                     "64",
  jaw:                      "124",
  age:                      "indeterm."
};
```

### mergeWithFallback

```js
function mergeWithFallback(systemId, result) {
  const fallback = FALLBACK_MAP[systemId] || {};
  const merged = Object.assign({}, fallback, result || {});
  // 字符串字段防空：AI 返回 null/空串时强制回 fallback
  for (const k in merged) {
    if (typeof merged[k] === 'string' && merged[k].trim() === '') {
      if (fallback[k] != null) merged[k] = fallback[k];
    }
  }
  return merged;
}
```

调用链：
```
analyzeWithAI(systemId, capturedFrame)
  ↓ try { … }
  ↓ .then(parse → mergeWithFallback → fillResultPanel)
  ↓ .catch(任意异常 → mergeWithFallback(systemId, null) → fillResultPanel)
  ↓ .finally(() => showResultOverlay(systemId))
```

---

## 8. 三套 prompt 草案

### 8.1 通用强约束（写在每条 prompt 头部）

```
你是一个 BIAS-SYSTEM 虚构艺术化分类系统的一部分。
本系统不是真实判断、不是医学诊断、不是心理诊断、不是犯罪鉴定。
所有输出仅为展示分类系统本身的运作方式。
```

### 8.2 ANCIENT_PROMPT

```
[任务]
你扮演「古代面学 · 相书卷宗判读系统」。
你收到一张人像图像。
按 BIAS-SYSTEM 的虚构分类规则给出判词。

[输出格式]
必须输出严格 JSON。
禁止 markdown 包裹 / 禁止代码块标记 / 禁止任何前缀文字。
禁止 HTML。
禁止解释。

[字段]
{
  "verdictMajor":       string,   // 大标题 · 4-8 字 · 古籍风格名词
  "verdictLine":        string,   // 归类行 · 三个名词用 " / " 串联
  "judgement":          string,   // 判词 · 一句 ≤ 24 字 · 印堂/山根/准头等古籍意象
  "palace_verdict":     string,   // 十二宫分区
  "palace_reason":      string,
  "organ_verdict":      string,   // 五官取象
  "organ_reason":       string,
  "zone_verdict":       string,   // 三停比例
  "zone_reason":        string,
  "mountain_verdict":   string,   // 五岳四渎
  "mountain_reason":    string,
  "complexion_verdict": string,   // 气色标记
  "complexion_reason":  string,
  "bone_verdict":       string,   // 骨相纹路
  "bone_reason":        string
}

[禁止]
不要分析真实身份 / 不要做命理保证 / 不要解释什么是相学。
不要写 markdown / 不要写解释段 / 不要写代码块包裹。
所有 reason 必须以 "因为：" 起头。

[仅输出 JSON]
```

### 8.3 MODERN_PROMPT

```
[任务]
你扮演「现代归类 · 身份清仓系统」。
按 BIAS-SYSTEM 虚构现代分类规则，对图像给出现代化分类项。

[输出格式]
必须输出严格 JSON。禁止 markdown / 禁止代码块 / 禁止 HTML / 禁止任何前缀。

[字段]
{
  "sexuality_value":     string,   // 顺性偏好 / 多向 / 不定
  "sexuality_reason":    string,
  "gender_value":        string,   // 系统主流判定 / 偏差判定
  "gender_reason":       string,
  "income_value":        string,   // 高 / 中 / 低 收入
  "income_reason":       string,
  "family_value":        string,   // 核心家庭 / 单亲 / 独居 / …
  "family_reason":       string,
  "relationship_value":  string,   // 单身 / 稳定同居 / 已婚 …
  "relationship_reason": string,
  "risk_value":          string,   // 低风险 / 中风险 / 高风险
  "risk_reason":         string
}

[禁止]
不要写真实身份 / 不要做医学判断 / 不要做心理诊断。
所有 value 必须是 BIAS-SYSTEM 虚构分类用语。
所有 reason 必须以 "因为：" 起头并解释"系统"判定的逻辑，不是真人判断。

[仅输出 JSON]
```

### 8.4 WESTERN_PROMPT

```
[任务]
你扮演「西方面学 · 编号档案系统」。
按 BIAS-SYSTEM 虚构西方旧式体貌测量规则，对图像给出 6 维度判词 + 6 项测量值。

[输出格式]
必须输出严格 JSON。禁止 markdown / 禁止代码块 / 禁止 HTML。

[字段]
{
  "classical_verdict":        string,   // 古典相貌
  "classical_reason":         string,
  "silhouette_verdict":       string,   // 侧影道德
  "silhouette_reason":        string,
  "cranial_verdict":          string,   // 颅骨地图
  "cranial_reason":           string,
  "criminalization_verdict":  string,   // 犯罪预兆
  "criminalization_reason":   string,
  "averageness_verdict":      string,   // 平均脸规训
  "averageness_reason":       string,
  "algo_verdict":             string,   // 算法再分类
  "algo_reason":              string,
  "ht":                       string,   // 身高（cm · 含小数）
  "cranialIdx":               string,   // "82.4 / brachy" 之类
  "nasW":                     string,
  "earL":                     string,
  "jaw":                      string,
  "age":                      string
}

[禁止]
不要做真实犯罪预测 / 不要做真实颅相学 / 不要做真实 Bertillon。
所有 verdict 必须以"分类系统的运作"为对象，不是对真人下结论。
所有 reason 必须以 "因为：" 起头并指出"系统"的偏见逻辑。

[仅输出 JSON]
```

### 8.5 三条 prompt 共同底线

| ✅ 必须 | ❌ 禁止 |
|---|---|
| 仅返回 JSON object | 返回 markdown |
| 字段缺失 = 用 fallback 补 | 返回 ``` 代码块包裹 |
| reason 以"因为："起头 | 返回 HTML |
| value 短词 4-12 字 | 返回 UI 文案 / className / SKU |
| | 返回数组（除非 schema 显式声明） |
| | 真实身份判断 / 医学 / 犯罪 / 心理诊断 |
| | 解释段 / 前缀文字 |

---

## 9. API 失败兜底

### 9.1 try / catch 边界

```js
async function analyzeWithAI(systemId, capturedFrame) {
  // ① 重入锁
  if (window.SPA._aiInFlight) return null;
  window.SPA._aiInFlight = true;

  // ② 超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s

  try {
    const payload = {
      systemId,
      image: capturedFrame.dataUrl,
      prompt: ANALYSIS_SYSTEMS[systemId].prompt,
      mode: 'structured_json',
      outputFormat: 'json',
      requestId: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      ts: Date.now()
    };
    const resp = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!resp.ok) throw new Error('HTTP_' + resp.status);
    const text = await resp.text();
    const json = safeJsonParse(text);
    return mergeWithFallback(systemId, json);
  } catch (e) {
    console.warn('[AI] analyzeWithAI failed', e);
    return mergeWithFallback(systemId, null);
  } finally {
    clearTimeout(timeoutId);
    window.SPA._aiInFlight = false;
  }
}
```

### 9.2 安全 JSON 解析

```js
function safeJsonParse(text) {
  if (!text) return null;
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(stripped); } catch (_) {}
  const m = stripped.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}
```

### 9.3 失败兜底清单

| 情况 | 处理 |
|---|---|
| `fetch` 网络失败 | catch → 走 fallback |
| HTTP 4xx / 5xx | throw → catch → fallback |
| 超时 12s | AbortController.abort() → catch → fallback |
| 返回非 JSON | `safeJsonParse` 返回 null → fallback |
| JSON 字段缺失 | `mergeWithFallback` 用 fallback 补齐 |
| 字段类型错（非 string） | `mergeWithFallback` 强制 `String(x)`，空串 → fallback |
| API 端报错（如 `xapi.yhchj.com/version` 异常） | 不会阻塞 fallback · fallback 是前端硬编码 |
| Uncaught promise | `analyzeWithAI` 内部 try/catch + finally 保证 `_aiInFlight=false`；调用方也包 try/catch |
| 按钮双击 | `_aiInFlight` 重入锁 + iframe 加载前禁用点击 |
| AI 在飞时点「返回摄像头」 | `resetToCamera()` 调用时若 `_aiInFlight` 则忽略结果，但 UI 仍按 fallback 走完 |

### 9.4 弹层永不空白保证

```
handleSelectSystem(systemId):
  1) 即时调 analyzeWithAI(systemId, capturedFrame) → 异步
  2) 不等 AI 立即显示 result-layer（壳）
     · loading 文字 "▌ 加载档案 · {systemId}"
  3) AI 返回 / fallback 到位 → fillResultPanel + 隐藏 loading
  4) 任意失败：loading 永远会被 800ms 后兜底隐藏
     （fillResultPanel 即使全空也至少显示 verdict 文字）
```

兜底：
```js
setTimeout(() => {
  const ld = document.querySelector('.result-loading');
  if (ld) ld.style.display = 'none';
}, 800);
```

---

## 10. 确认清单（动手前请逐项勾选）

- [ ] AI 只在用户选 ancient / modern / western 后调用
- [ ] 字段数量：ancient 15 / modern 12 / western 18
- [ ] 字段命名约定：`<slot>_<value|reason>`
- [ ] 三套 prompt 的强约束（仅 JSON / 无 markdown / 无 HTML / 无解释 / 不做真实判断）
- [ ] fallback 三套硬编码（即使 AI 全挂也能完整显示结果页）
- [ ] 12s 超时 + 重入锁 + 安全 JSON 解析
- [ ] 不改结果页 UI / 不改样式 / 不改文案 — 只加 `data-slot="..."` 定位标记
- [ ] 不动摄像头页 / pathSelect / 返回按钮 / iframe 加载逻辑
- [ ] 实施阶段先用本地 mock endpoint 走通，再切真接口

---

## 附录 A · 现有 UI 字段来源文件

| 系统 | 静态预览文件 | 数据来源说明 |
|---|---|---|
| ancient | [_preview/ancient-skin-v4.html](file:///d:/TRAE%20SOLO%20CN/%E7%A8%8B%E5%BA%8F%E8%89%BA%E6%9C%AF%E4%BD%9C%E4%B8%9A/exhibition-camera/_preview/ancient-skin-v4.html) | 6 字段（十二宫 / 五官 / 三停 / 五岳 / 气色 / 骨相） |
| modern  | [_preview/modern-result-preview.html](file:///d:/TRAE%20SOLO%20CN/%E7%A8%8B%E5%BA%8F%E8%89%BA%E6%9C%AF%E4%BD%9C%E4%B8%9A/exhibition-camera/_preview/modern-result-preview.html) | 6 张分类卡（性取向 / 性别 / 收入 / 家庭 / 婚恋 / 风险） |
| western | [_preview/western-skin.html](file:///d:/TRAE%20SOLO%20CN/%E7%A8%8B%E5%BA%8F%E8%89%BA%E6%9C%AF%E4%BD%9C%E4%B8%9A/exhibition-camera/_preview/western-skin.html) | 6 宫格 + 6 项测量值 |

## 附录 B · 动手阶段允许改的范围

| 可改 | 不可改 |
|---|---|
| 主项目 `index.html` 新增 `analyzeWithAI / mergeWithFallback / safeJsonParse / fillResultPanel` 等函数 | 三个结果页 preview 文件的样式 / 结构 / 文案 |
| 主项目 `index.html` 新增 `data-slot="..."` 定位属性到三个结果页 iframe 的 wrapper | 摄像头页 UI / pathSelect UI |
| 主项目新增 `ANALYSIS_SYSTEMS / FALLBACK_MAP / API_ENDPOINT` 配置 | "立即归类"按钮逻辑 |
| 主项目新增 mock endpoint（本地 `/mock-ai/ancient.html` 之类） | iframe 加载机制 / 返回选择 / 返回摄像头 |
# BIAS SYSTEM · 三套面学基线锁定 · BASELINE LOCK

> 锁定时间：2026-07-07
> 锁定版本：v9 (path-overlay-v5.html) · v4 (ancient-skin-v4) · preview (modern-result-preview) · v6 (western-skin) · v2 (systems-overview)
> 状态：**已锁定 · 不允许改动这些 UI / 文案 / 跳转逻辑**

---

## 1️⃣ 锁定清单 · 哪些 UI 已锁定

### A. 摄像头分流 Overlay（`camera-overlay-ui.locked.html` = `path-overlay-v5.html`）

| 元素 | 已锁定 |
|---|---|
| 摄像头背景：保持主页 `.v3x-video-bg` + `v3x-vignette` + `v3x-noise` | ✅ 锁 |
| 检测框：90×90 金黄角 + box-shadow 30px + `DETECTED / LOCKED` 标签 | ✅ 锁 |
| 中央"分流命令"提示（PHASE 03 · 检测完成 · 请选择归类路径） | ✅ 锁文 |
| 右侧"样本已锁定 · 等待选择分类器"卡片（隐藏"开始分析"按钮） | ✅ 锁 |
| 底部三分支卡位置：`bottom: 5%` · `width: min(1200px, 96vw)` | ✅ 锁 |
| 古代入口：卷宗索引卡（旧纸 + 朱砂方印 + 隶书 + 十二宫标签） | ✅ 锁 |
| 现代入口：身份清仓标签机（黑底 + 摄像头噪点 + AI-LIVE + SKU + 红硬章） | ✅ 锁 |
| 西方入口：冷档案索引卡（Bertillon 底纹 + 5 帧档案胶片条 + Lavater 真图叠加） | ✅ 锁 |
| 三入口跳转：古代 → ancient-skin-v4 · 现代 → modern-result-preview · 西方 → western-skin | ✅ 锁 |
| 键盘 1 / 2 / 3 / Esc 快捷键 | ✅ 锁 |

❌ **不允许做**：
- 不要把这页改成独立全屏页面
- 不要改回"三个结果页截图预览"
- 不要替换成普通按钮菜单

### B. 古代面学结果页（`ancient-skin.locked.html` = `ancient-skin-v4.html?v=4`）

| 元素 | 已锁定 |
|---|---|
| 旧纸卷宗质感：`#f1e3b6` + 极淡横纹 + 6 类宫位线 | ✅ 锁 |
| 隶书大字标题（28px · 8px 字距） | ✅ 锁 |
| 朱砂方印「卷六已裁」· 朱批旁注 · 红色硬阴影 | ✅ 锁 |
| 六类：命宫闭塞 / 审辨官偏 / 中停独旺 / 五岳不归 / 准头灰暗 / 山根限险 | ✅ 锁文 |
| 主归类结果：隶书大字 36-44px | ✅ 锁 |
| 内置滚动条：`overflow-y: auto` · 卡片内部滚动 | ✅ 锁 |
| 底部"六类卷宗条目" (SKR-01..06) | ✅ 锁 |

❌ 不允许做：换掉整体布局 / 改成普通国风网页

### C. 现代面学结果页（`modern-skin.locked.html` = `modern-result-preview.html`）

| 元素 | 已锁定 |
|---|---|
| `v3x-result` 弹窗结构（米白 + 黑边 + 红色 12px 阴影） | ✅ 锁 |
| "你被归类为"结论大字（Impact 6vw + 黄阴影 + 红阴影） | ✅ 锁 |
| 6 张彩色 SKU 卡（黄/青/绿/黄/粉/米白）· SKU-01..06 | ✅ 锁 |
| 字段：性取向 · 性别 · 收入 · 家庭 · 婚恋 · 风险 | ✅ 锁文 |
| "再来一次 / 关闭"按钮 + 黄色警示条 | ✅ 锁 |
| `v3xSample` 缩略图 + `v3xResultEngine` 引擎标识 | ✅ 锁 |
| `v3xResultSource` 证据行 · `v3xResultInfoRow` 单行证据链 | ✅ 锁 |

❌ 不允许做：把摄像头入口页当现代面学结果页

### D. 西方面学结果页（`western-skin.locked.html` = `western-skin.html?v=6`）

| 元素 | 已锁定 |
|---|---|
| 冷灰档案底色：`#1a1a1a` + 旧纸 `#ece8db` | ✅ 锁 |
| 真实公版图嵌入：`bertillon-portrait-parle-1909.jpg` 等 9 张 Wellcome 公版图 | ✅ 锁 |
| 6 类：古典相貌 / 侧影道德 / 颅骨地图 / 犯罪预兆 / 平均脸 / 算法 | ✅ 锁文 |
| 内置滚动条 + NUM POINTS / 算法标注 | ✅ 锁 |
| 测量/编号/档案系统视觉（数字密度、Tusche 噪声） | ✅ 锁 |

❌ 不允许做：改成大字报 / 游戏结算页 / 普通卡片页

### E. 三套总览预览页（`systems-overview.locked.html` = `systems-overview.html?v=2`）

| 元素 | 已锁定 |
|---|---|
| 三栏并列（待确认/已锁定标签） | ✅ 锁 |
| 每套 iframe 引用 + "打开单独页面" 入口 | ✅ 锁 |
| Western 标识"WESTERN" 与任务原语义 | ✅ 锁 |

---

## 2️⃣ 三套系统分别是什么

| 系统 | 中文名 | 英文名 | 字段分类 | 文件 |
|---|---|---|---|---|
| **古代面学** | 相书卷宗 · 卷六判读 | **Ancient Chinese Physiognomic Archive** | 十二宫 / 五官 / 三停 / 五岳 / 气色 / 骨相 | `ancient-skin-v4.html` |
| **现代面学** | 身份清仓 · SYSTEM RECOMMEND | **Modern Identity Clearance** | 性取向 / 性别 / 收入 / 家庭 / 婚恋 / 风险 | `modern-result-preview.html` |
| **西方面学** | 冷档案识别 · W.P.A | **Western Physiognomic Archive** | 古典相貌 / 侧影道德 / 颅骨地图 / 犯罪预兆 / 平均脸 / 算法 | `western-skin.html` |

🔒 三套**并列**·不许覆盖、删除、合并

---

## 3️⃣ 接下来只会修改哪些 **逻辑文件**

✅ **可以改**（接 AI 流程）：

| 文件 | 内容 |
|---|---|
| `index.html`（主项目） | `<button id="v3xGoBtn">` 点击后跳 `path-overlay.html`（或嵌 inline） |
| `exhibition.js`（主项目） | `useCurrentFrameAndAnalyze` 之前/之后插入"跳 selection overlay"逻辑 |
| `ai-client.js`（主项目） | 改 `/api/classify` 调用参数 · prompt · 模型 · timeout |
| `ai-prompt.js`（主项目） | 改 system prompt / user prompt 模板 |
| `server.js`（主项目） | 改 `/api/classify` 路由逻辑 · fallback 逻辑 |
| `image-reader.js`（主项目） | 改图片 base64 编码 / 压缩策略 |
| `path-overlay-v5.html`（预览） | **只**增加"键盘 Enter 触发" / 加载状态 / 占位/分块对接 |
| 主流程跳转逻辑 | iframe → window.location · 路径参数传递 |

❌ **不允许改**（任何 UI / 文案 / 视觉）：

| 不能改 |
|---|
| 已锁定的 5 个 `.locked.html` |
| 三套结果页任何位置（HTML / CSS / 文案） |
| 三入口卡的视觉 / 文案 / 跳转 |
| 检测框 / 中央提示 / 右侧锁定状态卡 |
| 三个系统的名称 / 字段 / 分类 |

---

## 4️⃣ 不会改动哪些 UI 文件

| 文件 | 不能动 |
|---|---|
| `camera-overlay-ui.locked.html` | 完整不动 |
| `ancient-skin-v4.locked.html` + `ancient-skin.locked.html` | 完整不动 |
| `modern-skin.locked.html` | 完整不动 |
| `western-skin-v6.locked.html` + `western-skin.locked.html` | 完整不动 |
| `systems-overview-v2.locked.html` + `systems-overview.locked.html` | 完整不动 |
| 三套结果页的 HTML / CSS / 文案 / 视觉 | 全部不动 |

---

## 5️⃣ 下一阶段 · 接 AI 流程的可控路径

允许做的事（只改逻辑 / 不改 UI）：

1. ✅ 在 `index.html`「开始分析」点击后 → 跳 `camera-overlay-ui.locked.html`
2. ✅ 在 `_preview/path-overlay-v5.html` 上：
   - 改键盘 1/2/3 → 跳转目标可微调（保持同 3 个目标）
   - 改 hover "ROUTING TO" 显示文案（保持英文模板不变）
3. ✅ 在 `ai-prompt.js` 中加入"系统分流提示"语境（不引用 UI 文案）
4. ✅ 改 fallback 文本（仍是仅 `class` 内容，不进 UI）

**可写不可改的分界线**：

```
✅ 可改:    跳转 href / 参数 / API endpoint / prompt 文本（不引用 UI 文案）/ loading class / 数据结构
❌ 不可改:  任何 .locked.html 里的 HTML / CSS / 文案 / 图片
```

---

## ✅ 锁定确认（已执行）

| 基线名称 | 源文件 | 锁定版本 |
|---|---|---|
| `camera-overlay-ui.locked.html` | `path-overlay-v5.html` | v9 (44996B) |
| `ancient-skin.locked.html` + `-v4.locked.html` | `ancient-skin-v4.html` | v4 (36959B) |
| `modern-skin.locked.html` | `modern-result-preview.html` | preview (12241B) |
| `western-skin.locked.html` + `-v6.locked.html` | `western-skin.html` | v6 (23762B) |
| `systems-overview.locked.html` + `-v2.locked.html` | `systems-overview.html` | v2 (11295B) |

下一步：等你拍板开始接 AI 流程。

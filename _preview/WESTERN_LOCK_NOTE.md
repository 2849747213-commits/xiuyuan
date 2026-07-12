# Western Physiognomic Archive UI · LOCK NOTE

> 西方面学 UI 已锁定为 v3.1 基线。本文件说明什么是固定的、什么是允许改的、什么是禁止改的。

---

## ✅ 锁定版本

| 角色 | 文件 |
|---|---|
| **锁定备份（只读）** | `western-skin.locked.html` |
| **当前工作版本（与锁定版内容一致）** | `western-skin.html` |
| **保护说明（本文件）** | `WESTERN_LOCK_NOTE.md` |
| **规范** | `../DESIGN_RULES.md` |

基线时间：2026-07-07 · 版本 v3.1

---

## 🎯 必须保留的 7 项

### 1. 整体方向 · 冷档案识别系统

```
Bertillon 警务档案 + Lavater 侧影图谱 + 颅相学/人类测量图像 + Galton 式复合肖像
```

**不是** 现代 dashboard / 游戏抽卡页 / 国风 / 塔罗 / 哥特 / 复古海报。

### 2. 版式结构（按文件出现顺序）

```
顶部归档信息栏
  → "你被归类为 / classification notice" 标题区
  → 左 Bertillon 图像 + 中测量数据栏 + 右 Lavater 侧影
  → 6 宫格分类条目（WP-01..06）
  → 历史图像参考区（phrenology / anthropometric / physiognomy plate）
  → 底部证据链 + 警示 + 操作按钮
  → attribution 出处行
```

### 3. 视觉素材（真实历史图 · 不许删）

| 文件 | 来源 | License |
|---|---|---|
| `bertillon-portrait-parle-1909.jpg` | Met Museum · 289245 · Alphonse Bertillon | CC0 |
| `lavater-silhouette-L-1789.jpg` | Wellcome · L0012506 | CC BY 4.0 |
| `wellcome-phrenology-32099.jpg` | Wellcome · L0032099 | CC BY 4.0 |
| `wellcome-anthropometry-32016.jpg` | Wellcome · L0032016 | CC BY 4.0 |
| `wellcome-physiognomy-9293.jpg` | Wellcome · V0009293 | CC BY 4.0 |

外加底纹（Lavater 1789 复用作为 `.archive-scroll` 第一层 · 极淡）。

### 4. 颜色 / 字体

**字体系统**（已嵌入 Google Fonts）：
```
Noto Serif SC     (中文)
IBM Plex Mono     (英文 / 编号)
Courier Prime     (小装饰)
```

**配色**：
```
--paper:        #ece8db       主背景
--paper-inside: #f4f0e3       卡内背景（被 .cell: rgba(246,241,228,0.9) 替代）
--ink-black:    #141414       黑墨
--ink-deep:     #2a2a2a       正文
--ink-gray:     #4a4a4a       灰文
--rule:         #5a5a5a       边框行线
--rule-soft:    #8a8a8a       软行线
--archive-blue: #1f3142       冷档蓝
--ink-red:      #8a1a1a       印泥红（仅编号 + 极少量）
```

**不许**：高饱和黄黑红 / 厚重描边 / 大投影 / 大红大金 / 娱乐化标题字。

### 5. 滚动方式 · 卡片内置滚动（★ 不可改回 body 滚）

```css
html, body    { overflow: hidden; }                  /* 浏览器不滚 */
.western-page { overflow: hidden; height: 100dvh; } /* 页面不滚 */
.western-archive-card { overflow: hidden; height: calc(100dvh - 48px); }  /* 卡片不滚 */
.archive-scroll { overflow-y: auto; overscroll-behavior: contain; }      /* ★ 唯一可滚 */
```

自定义滚动条：`.archive-scroll::-webkit-scrollbar { width: 10px; ... }` · **只出现在卡片内部右侧**。

### 6. 阅读保护 · 信息层永远高于气氛层

```css
.top            { background: rgba(238,232,216,0.86); backdrop-filter: blur(1px); }
.heading        { background: linear-gradient(...rgba(238,232,216,...) ...); backdrop-filter: blur(0.5px); }
.archive-strip  { background: rgba(238,232,216,0.84); }
.archive-cell.note { background: rgba(238,232,216,0.94); }
.grid-section   { background: rgba(238,232,216,0.78); backdrop-filter: blur(0.5px); }
.cell           { background: rgba(246,241,228,0.9); }
.bottom         { background: rgba(238,232,216,0.92); backdrop-filter: blur(1px); }
.attribution    { background: rgba(245,239,222,0.96); }
```

任意一处加遮罩时，**不许**改 `.archive-scroll` 的第一层 `background-image url('img/lavater-silhouette-L-1789.jpg')`。

### 7. 6 宫格分类内容（不许替换 / 删减 / 重写）

| SKU | 字段（dimension）| 小类（small_class）|
|---|---|---|
| WP-01 | 古典相貌 | 古典兽相 |
| WP-02 | 侧影道德 | 侧影道德化 |
| WP-03 | 颅骨地图 | 颅骨地图化 |
| WP-04 | 犯罪预兆 | 犯罪预兆化 |
| WP-05 | 平均脸规训 | 平均脸规训 |
| WP-06 | 算法再分类 | 算法再分类 |

---

## ✅ 允许的小修

- 调整间距（margin / padding / gap）
- 修正滚动（仅在 .archive-scroll 内，不改回 body）
- 优化可读性（背景遮罩的 rgba alpha 值微调）
- 修正错字 / 拼写 / 中英文混排
- 统一按钮状态（hover / focus / disabled）
- 优化移动端适配（@media 规则）

---

## ❌ 不允许的修改

- 大幅重排版式（保留上述 7 项的结构顺序）
- 更换整体视觉风格
- 删除历史图像（按 §3 列表）
- 改成现代 dashboard / 改成游戏抽卡页
- 改成国风 / 塔罗 / 哥特 / 复古海报风
- 把 `.archive-scroll` 内部滚动改回浏览器 body 整体滚动
- 把第一层 Lavater 背景图换掉或调到全局很淡

---

## 📜 修改历史

| 版 | 时间 | 内容 |
|---|---|---|
| v1 | 早 | 大色块 + 厚重投影 · 已被替换 |
| v2 | — | 引入真实历史图 + Noto Serif SC + IBM Plex Mono + 冷灰主调 · 表格化 |
| v3 | — | 外部滚动 → 卡片内置滚动 · body 不滚 · 三段 .western-page → .western-archive-card → .archive-scroll · 自定义 webkit 滚动条 |
| v3.1 | 2026-07-07 | 阅读保护 · 文字区域加干净纸色遮罩 · Lavater 保留 · 卡片内背景再稳一点 |
| LOCK | 2026-07-07 | 用户确认锁定 v3.1 为基线 · 写入本文件 · 复制出 western-skin.locked.html |

---

## 🛡️ 后人再次修改前请做的事

1. **必须**先读本文件 WESTERN_LOCK_NOTE.md
2. **必须**看一眼 `western-skin.locked.html` 作为对照
3. **必须**在回复里写："我已读取 WESTERN_LOCK_NOTE.md 与 western-skin.locked.html，本次只做符合锁定基线的小修。"
4. 修改完后，**重新复制** 到 `western-skin.locked.html` · 或同步更新本文件

---

## 📍 后续若重做"古代面学 UI"

请注意：

- **不要碰** `western-skin.locked.html` 或 `western-skin.html`
- **新做** `_preview/ancient-skin-vN.html`（N = 版本号递增），基于新的古代视觉系统单独做
- 古代面学**不许**沿用西方面学的冷档案气质，也不许反过来贴西方的修饰
- 古代面学的内容（相格 / 骨相 / 气色 / 命势 / 亲缘 / 断语）按 `ancient-vocab-v2.json` 不可改

---

最后更新：2026-07-07

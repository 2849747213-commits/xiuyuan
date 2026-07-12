# _preview/ 读我手册

> 三套 BIAS SYSTEM 面学的所有"非主流程"文件 · 静态预览 / 词库 / 类型 / 注册表都在这里。
> 改 UI 前先看本文件。

## 📂 文件清单

| 文件 | 作用 |
|---|---|
| `modes-registry.json` | **三套系统的统一注册表** · 改任意一套前先查本表 |
| `modes.d.ts` | **三套系统的统一 TypeScript 类型** · 后续接入 prompt / 渲染都用 |
| `ancient-vocab-v2.json` | 古代面学 v2 词库（旧）· 6 字段 × 6 小类 |
| `ancient-vocab-v3.json` | **古代面学 v3 词库（当前）** · 6 新字段：十二宫分区 / 五官取象 / 三停比例 / 五岳四渎 / 气色标记 / 骨相纹路 |
| `ancient-skin.html` | 古代面学 v3 静态视觉稿（旧 · 仅参考） |
| `ancient-skin-v4.html` | **古代面学 v4 卷宗系统（当前）** · v4.1 刚调整字号 + 判读 + 朱批 |
| `overview.html` | **三套判读系统并列总览** · 一个页面同时看古代 / 现代 / 西方面学 |
| `western-vocab-v1.json` | 西方面学词库（9 维度 · 4-6 小类/维度）|
| `mockups.html` | 三套风格的早期对比（动画 + 切换）|
| `western-skin.html` | 西方面学当前工作版本（v3.1）|
| `western-skin.locked.html` | **西方面学锁定版本 · 不要改** |
| `WESTERN_LOCK_NOTE.md` | **西方面学锁定保护说明** · 改 UI 前先读 |

## 🔒 西方面学已锁定（v3.1 · 2026-07-07）

| 项 | 内容 |
|---|---|
| 工作版本 | `western-skin.html` |
| 锁定备份 | `western-skin.locked.html` |
| 保护说明 | `WESTERN_LOCK_NOTE.md` |
| 锁定时间 | 2026-07-07 |
| 基线版本 | v3.1（卡片内置滚动 + 阅读保护）|

后续若要重做古代面学，请基于新视觉系统单独做（新建 `ancient-skin-vN.html`），**不要碰** 任何 western-* 文件。

详细禁止清单见 `WESTERN_LOCK_NOTE.md`。

## 🔒 三套系统 · 禁混用 / 禁替换

```
modern  ← 作为基准 · 已接入主流程
ancient ← 词库 + 视觉稿暂定 · 静态预览状态
western ← 词库暂定 · 早期 mockup · 视觉稿待做
```

**严禁**：
- ❌ 把 modern 替换成 ancient
- ❌ 把 ancient 改成 western 的样子
- ❌ 把三套合并
- ❌ 只剩其一

**允许**：
- ✅ 给每一套做 skin（不同色彩 / 贴纸 / 字段名）
- ✅ 三套共用同一份 `modes.d.ts` 接口
- ✅ 共用同一份 `modes-registry.json` 注册

## 🔁 修改流程（强制）

1. **先读**：`../DESIGN_RULES.md`
2. **回确认**："我已读取 DESIGN_RULES.md，本次只按规范修改 UI。"
3. **找文件**：根据要改的 system，去对应 `*-skin.html` / `*-vocab-*.json`
4. **假数据预览**：在 `_preview/<mode>-skin.html` 做静态预览，不接 AI
5. **不动主流程**：未确认视觉前不接 `exhibition.js` / `ai-client.js`

## 📐 数据模型（统一）

每套系统词库 JSON 都遵循：

```ts
interface VocabFile {
  version: string;
  mode: '古代面学' | '现代面学' | '西方面学';
  subtitle: string;
  fields?: string[];          // 古代 + 现代
  dimensions?: string[];      // 西方（9 个）
  dictionaries: {
    [fieldOrDim: string]: {
      label: string;
      options: { small_class: string; reason: string; }[];
    };
  };
  rendering_rules: { ... };
}
```

## 🚦 每套当前状态

```
modern  · STATUS: live · 改动需谨慎
ancient · STATUS: static preview · 可继续调皮肤
western · STATUS: earliest mockup · 下一步做 western-skin.html
```

---

最后更新：2026-07-07

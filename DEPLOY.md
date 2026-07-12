# ============================================
# BIAS SYSTEM · Vercel 部署指引
# ============================================
# 5 步把网页部署到 Vercel · 别人打开链接就能用
# ============================================

## 0. 你要准备的

- GitHub 账号（[github.com](https://github.com) 注册）
- Vercel 账号（[vercel.com](https://vercel.com) · 用 GitHub 登录）
- MiniMax API Key（已有 · 在 `.env` 里）

---

## 1. 准备 GitHub 仓库

1. 打开 [github.com/new](https://github.com/new)
2. Repository name: `exhibition-camera`（或你喜欢的名字）
3. 选 **Private**（private 仓库不公开代码，但部署后网页能正常用）
4. **不要**勾 "Add a README file"
5. 点 "Create repository"

---

## 2. 推代码到 GitHub

在 `exhibition-camera/` 目录执行：

```bash
cd d:/TRAE\ SOLO\ CN/程序艺术作业/exhibition-camera

# 1. 初始化 git（如果还没有）
git init
git add .
git commit -m "deploy to vercel"

# 2. 关联 GitHub 仓库（替换成你的仓库 URL）
git remote add origin https://github.com/你的用户名/exhibition-camera.git

# 3. 推送
git branch -M main
git push -u origin main
```

> ⚠️ **重要**：`.gitignore` 已经把 `.env` 排除了，所以你的 key **不会**被推到 GitHub

---

## 3. 在 Vercel 创建项目

1. 打开 [vercel.com/new](https://vercel.com/new)
2. 点 "Import" 你刚创建的 `exhibition-camera` 仓库
3. **Project Name**: 随便起（决定你的域名，比如 `bias-system` → `bias-system.vercel.app`）
4. **Framework Preset**: 选 `Other`
5. **Build Command**: 留空
6. **Output Directory**: 留空
7. 点 "Environment Variables" · 添加 3 个变量：

| Name           | Value                                          |
|----------------|------------------------------------------------|
| `AI_API_KEY`   | `sk-cp-...你的key`（从本地 `.env` 复制）       |
| `AI_BASE_URL`  | `https://api.minimaxi.com/v1`                  |
| `AI_MODEL`     | `MiniMax-M3`                                   |

8. 点 "Deploy"

---

## 4. 等 1-2 分钟 · 部署完成

Vercel 会显示：

```
✓ Compiled successfully
✓ Build completed
```

然后给你一个链接，比如：

```
https://bias-system.vercel.app
```

**打开这个链接 · 你的网页就在云端了 · 别人也能打开**

---

## 5. 验证部署

打开 Vercel 给你的链接：
- ✅ 摄像头页面能打开
- ✅ 点 "开始分析" 弹出三条路径（现代/古代/西方）
- ✅ 选一个 → 调用 AI → 6 宫格出现 reason
- ✅ 切到其他样本也正常

---

## ⚠️ 注意事项

### Free Tier 限制

Vercel 免费版：
- **超时 10 秒**（Pro 60 秒）· MiniMax AI 调用可能 8-15 秒
- 如果超时会自动 mock 兜底（不报错，但 AI 没真接通）
- **如果想稳定跑**：升级 Vercel Pro（$20/月）· 或保持 `WESTERN_AI_MODE = 'mock'` 走预设

### key 安全

- ✅ Vercel Environment Variables 加密存储
- ✅ `.gitignore` 阻止 `.env` 推到 GitHub
- ❌ **不要**把 `.env` 提交到任何公开仓库
- ❌ **不要**在聊天/截图里发完整 key

### 改代码后重新部署

```bash
git add .
git commit -m "改了啥"
git push
```

Vercel 会自动检测到 GitHub push · 自动重新部署 · 1-2 分钟生效

### 改回 mock 模式（如果 AI 配额又用完了）

打开 `js/western-ai-pipeline.js` 第 13 行：
```js
var WESTERN_AI_MODE = 'mock';  // 改成 'mock'
```

`git add . && git commit -m "mock mode" && git push` · 30 秒后生效

---

## 📁 项目结构（部署相关）

```
exhibition-camera/
├── api/
│   └── index.js          ← Vercel serverless function（包装 server.js）
├── js/
│   └── western-ai-pipeline.js   ← AI 模式开关在这里
├── index.html            ← 入口页面
├── exhibition.js / .css
├── server.js             ← 本地后端（Vercel 通过 api/index.js 复用）
├── vercel.json           ← Vercel 路由配置
├── package.json          ← Node 18+ 声明
├── .env.example          ← 环境变量模板
├── .env                  ← 本地 key（已加 .gitignore · 不会推送）
└── DEPLOY.md             ← 你正在看的这个文件
```

---

## 🆘 部署报错？

| 报错 | 解决 |
|------|------|
| `404: NOT_FOUND` 在 Vercel 域名 | 检查 Vercel Dashboard → Deployments → Function Logs |
| AI 返回 429 | MiniMax 配额用完 · 改 `WESTERN_AI_MODE = 'mock'` |
| 摄像头不工作 | 浏览器要求 HTTPS · Vercel 默认 HTTPS · 应该没问题 |
| 静态文件 404 | Vercel 默认根目录静态托管 · 检查 `vercel.json` 有没有奇怪的 rewrites |

---

## 🎉 完成

部署完你会得到一个永久链接，比如：

```
https://bias-system.vercel.app
```

任何人打开这个链接 → 看到你的 BIAS SYSTEM 摄像头 + 3 个分类路径 + 6 宫格 AI 分类结果

# ============================================
# BIAS SYSTEM · 极简部署指引（GitHub Actions 自动版）
# ============================================
# 一共 3 步 · 5 分钟上线
# ============================================

## STEP 1 · 创建 Vercel Token（30 秒）

打开 [vercel.com/account/tokens](https://vercel.com/account/tokens) →
点 "Create Token" → Name 填 `github-actions-deploy` → Scope 选 **Full Account** →
复制 token（只显示一次！）

## STEP 2 · 推代码到 GitHub（2 分钟）

在 `exhibition-camera/` 目录打开 PowerShell：

```powershell
cd "d:/TRAE SOLO CN/程序艺术作业/exhibition-camera"

# 1. 初始化 + 提交（如果还没 git init）
git init
git add .
git commit -m "init: deploy to vercel"

# 2. 关联你的 GitHub 仓库（替换成你刚新建的）
git remote add origin https://github.com/你的用户名/exhibition-camera.git
git branch -M main
git push -u origin main
```

如果 GitHub 弹登录框：用 Personal Access Token 登录
（[github.com/settings/tokens](https://github.com/settings/tokens) · 勾 `repo` · 复制 token · 当密码用）

## STEP 3 · 在 GitHub 加 Vercel Token（30 秒）

打开你 GitHub 仓库的 `Settings → Secrets and variables → Actions` →
点 "New repository secret"：

| Name           | Value                              |
|----------------|------------------------------------|
| `VERCEL_TOKEN` | 刚才复制的 Vercel token            |

## STEP 4 · 自动部署

`git push` 已经触发 workflow · 打开
`https://github.com/你的用户名/exhibition-camera/actions`
看实时部署日志（1-2 分钟）

## STEP 5 · 拿到永久链接

部署完成会显示：
```
✓ Compiled successfully
✓ Deployed to production
```

访问 Vercel 给你分配的域名（GitHub Actions 日志里有，或者去 Vercel Dashboard 看）
类似 `https://exhibition-camera-xxx.vercel.app`

**🎉 任何人打开这个链接就能用你的 BIAS SYSTEM**

---

## 以后改代码怎么再部署

```powershell
git add .
git commit -m "改了啥"
git push
```

GitHub Actions 自动跑 → 自动部署 → 30 秒后生效

---

## 环境变量怎么加

AI 用的 key 在 Vercel Dashboard 加，不在 GitHub Secrets：
- 打开 [vercel.com](https://vercel.com) → 选你的项目
- Settings → Environment Variables
- 加 3 个：
  - `AI_API_KEY` = `sk-cp-...`（你的 key）
  - `AI_BASE_URL` = `https://api.minimaxi.com/v1`
  - `AI_MODEL` = `MiniMax-M3`

加完 → 重新触发一次 deployment（Deployments → 最新一次 → Redeploy）

---

## 出问题

| 现象 | 解决 |
|------|------|
| GitHub Actions 报 `Error: Token not found` | 检查 Secret 名字必须是 `VERCEL_TOKEN`（全大写） |
| 部署成功但 404 | 等 30 秒 CDN 同步；或清浏览器缓存 |
| AI 返回 429 | MiniMax 配额用完 · 改 `js/western-ai-pipeline.js` 第 14 行 `WESTERN_AI_MODE = 'mock'` 然后 `git push` |
| 摄像头不工作 | Vercel 默认 HTTPS · 浏览器要求 HTTPS 才能用 getUserMedia · 应该没问题 |

---

## 文件清单

- `.github/workflows/deploy.yml` ← 你刚 push 进去的 workflow
- `vercel.json` ← Vercel 路由配置
- `api/index.js` ← Serverless function 包装
- `package.json` ← Node 18+ 声明
- `.env.example` ← 环境变量模板
- `DEPLOY.md` ← 详细版指引（你看的这个是极简版）

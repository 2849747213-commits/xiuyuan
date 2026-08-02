# EdgeOne Makers 部署指南（免费版）

本项目在保留 Vercel 部署的同时，新增一份 EdgeOne Makers 免费版部署。

## 0 · 项目已经具备

- 同仓库同 main 分支 → Vercel 自动部署 + EdgeOne Makers 自动部署
- 不需要重新写业务代码
- EdgeOne 适配层 `cloud-functions/api/[[default]].js` 复用 Vercel 那条线已经验过的 `server.js`

## 1 · 在 EdgeOne 控制台创建项目

1. 打开 https://console.cloud.tencent.com/edgeone/makers
2. 单击 **创建项目**
3. 选择 **从 GitHub 导入**
4. 选仓库：`2849747213-commits/xiuyuan`（或你自己的 fork）
5. 项目名（决定默认域名）：例如 `exhibition-camera-edgeone` → 默认域 `exhibition-camera-edgeone.edgeone.app`
6. **Framework Preset**：选 **Other**（不是 Next.js / Vite 等）
7. **Build Command**：留空
8. **Output Directory**：留空（仓库根目录就是输出目录）
9. **Install Command**：`npm install`

## 2 · 配置环境变量

在项目 → **Settings → Environment Variables** 添加以下变量（值从 Vercel 复制）：

| Name | 用途 | 示例 |
|---|---|---|
| `AI_API_KEY` | MiniMax 文本分类 Key | `sk-cp-xxx` |
| `AI_BASE_URL` | MiniMax base URL | `https://api.minimaxi.com/v1` |
| `AI_MODEL` | 模型名 | `MiniMax-M3` |
| `IMAGE_API_KEY` | MiniMax image-01 Key（fusion 用） | `sk-cp-xxx` |
| `IMAGE_API_BASE_URL` | image base URL（可选） | `https://api.minimaxi.com/v1` |
| `IMAGE_MODEL` | image 模型名（可选） | `image-01` |

注意：
- 真实 Key 永远不要写在 `.env.example` 或 Git 仓库里
- EdgeOne 不读 `.env` 文件，必须在控制台填

## 3 · 部署

- 一旦 `edgeone.json` 在 main 分支就绪，EdgeOne 会自动按 git push 重新部署
- 默认分配 Makers 域名 `xxx.edgeone.app`，免费版可直接访问
- 无需购买域名、无需备案

## 4 · 验证部署

打开 EdgeOne 默认域名：

```
https://你的项目名.edgeone.app/
```

测试项：

| 项 | 期望 |
|---|---|
| `/` | 200 · 打开 index.html |
| `/js/ancient-local-system.js` | 200 |
| `/vendor/mediapipe/vision_bundle.mjs` | 200 |
| `/assets/sample-library/modern/normalized/M01_sample_main.jpg` | 200 |
| `/_preview/ancient-skin-v4.html` | 200 |
| `/api/health` | 200 · `{"ok":true,...}` |
| 选 ancient → 摄像头 → MediaPipe 478 pts → 分类 | 返回 Axx |
| 选 modern → 同上 | 返回 Mxx |
| 选 western → 同上 | 返回 Wxx |
| 三个 fusion | 返回 imageDataUrl |

如果 `/api/*` 返回 5xx：去 EdgeOne 控制台 → Logs 看 Cloud Function 日志，搜索 `[ANCIENT_API]` / `[WESTERN_API]` / `[FUSION_ANCIENT]` 等。

## 5 · 故障排查

| 现象 | 排查 |
|---|---|
| `/` 返回 404 | 检查 `outputDirectory` 留空 + 仓库根目录有 `index.html` |
| `/api/health` 返回 5xx | 检查 Cloud Function 路径 `cloud-functions/api/[[default]].js` 是否在仓库 + 命名正确 |
| AI 返回 timeout | 检查 `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` 是否正确填入 |
| 静态文件返回 HTML | 检查 `edgeone.json` 的 `headers` 配置是否覆盖了 `.mjs` / `.wasm` 的 MIME |
| 提示 "Cannot find module '../server.js'" | 检查 `cloudFunctions.includeFiles` 包含 `server.js` |

## 6 · 文件结构（EdgeOne 关心）

```
exhibition-camera/
├── edgeone.json                       ← EdgeOne Makers 配置
├── cloud-functions/                   ← EdgeOne Cloud Functions
│   ├── package.json                   ← 强制 ESM
│   └── api/
│       └── [[default]].js             ← /api/* 全部路由
├── server.js                          ← 业务代码（同一份 Vercel + EdgeOne 共用）
├── api/index.js                       ← Vercel 适配（不动）
├── vercel.json                        ← Vercel 配置（不动）
├── js/, providers/, assets/, vendor/  ← 业务模块（不动）
└── .env.example                       ← 环境变量模板
```

## 7 · 失败保护

- Vercel 配置（`vercel.json` / `api/index.js`）**完全未修改**
- `server.js` 只新增 `requestId` 字段用于追踪，无业务逻辑改动
- 即使 EdgeOne 部署失败，Vercel Production 仍然 100% 正常运行
- git push 到 main 后，Vercel 仍按其原有 webhook 部署
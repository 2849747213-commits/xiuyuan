# ============================================
# BIAS SYSTEM · 一键初始化脚本
# 在 d:/TRAE SOLO CN/程序艺术作业/exhibition-camera 目录运行
# ============================================

$ErrorActionPreference = "Stop"
Set-Location "d:/TRAE SOLO CN/程序艺术作业/exhibition-camera"

Write-Host "=== BIAS SYSTEM · 一键部署 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ERR] git 没装 · 先装 git: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# 2. 问 GitHub 仓库 URL
$repoUrl = Read-Host "请输入你的 GitHub 仓库 URL (例如 https://github.com/xxx/exhibition-camera.git)"
if ($repoUrl -notmatch "^https://github.com/.+/.+\.git$") {
    Write-Host "[ERR] URL 格式不对 · 应该是 https://github.com/用户名/仓库.git" -ForegroundColor Red
    exit 1
}

# 3. 检查 .env 不在 git 里
if (-not (Test-Path ".gitignore")) {
    Write-Host "[ERR] .gitignore 缺失" -ForegroundColor Red
    exit 1
}

# 4. 初始化 + 提交
if (-not (Test-Path ".git")) {
    Write-Host "[1/4] git init ..." -ForegroundColor Yellow
    git init
    git config user.email "deploy@bias.system" 2>$null
    git config user.name "Bias Deploy Bot" 2>$null
}

Write-Host "[2/4] git add . + commit ..." -ForegroundColor Yellow
git add .
git commit -m "deploy: bias system to vercel via github actions" 2>$null

# 5. 关联远程
$remoteExists = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[3/4] 关联 remote origin ..." -ForegroundColor Yellow
    git remote add origin $repoUrl
    git branch -M main
} else {
    Write-Host "[3/4] origin 已存在 · 跳过" -ForegroundColor Yellow
}

# 6. push
Write-Host "[4/4] git push ..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== 推送完成 ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "接下来 2 步：" -ForegroundColor Cyan
    Write-Host "1. 打开 https://vercel.com/account/tokens 创建 token" -ForegroundColor White
    Write-Host "2. 打开 GitHub 仓库 → Settings → Secrets → New repository secret" -ForegroundColor White
    Write-Host "   Name:  VERCEL_TOKEN" -ForegroundColor White
    Write-Host "   Value: 刚才创建的 Vercel token" -ForegroundColor White
    Write-Host ""
    Write-Host "3. 推送一次（workflow 自动跑）：" -ForegroundColor White
    Write-Host "   git commit --allow-empty -m 'trigger deploy' && git push" -ForegroundColor White
    Write-Host ""
    Write-Host "4. 在 GitHub Actions 看部署日志：" -ForegroundColor White
    Write-Host "   $repoUrl/actions" -ForegroundColor White
} else {
    Write-Host "[ERR] push 失败 · 检查 GitHub 认证" -ForegroundColor Red
}

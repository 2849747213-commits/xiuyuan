# 打包 exhibition-camera 核心代码到桌面 · 给 GPT 看
# 排除: node_modules / .git / _debug / 图片 / 日志

# 强制 UTF-8 编码 · 解决 PowerShell 5.1 中文路径乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

$src = "d:/TRAE SOLO CN/程序艺术作业/exhibition-camera"
$dst = "$env:USERPROFILE\Desktop\bias-system-code.zip"

if (Test-Path $dst) { Remove-Item $dst -Force }

# Compress-Archive 不支持排除列表 · 所以先复制到临时目录再打包
$tmp = "$env:TEMP\bias-system-pack"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null

# 排除规则
$excludeDirs = @('node_modules', '.git', '_debug', 'img', 'sample-library', 'normalized', 'reference', '西方', '现代', '古代', 'tools', 'docs')
$excludeExts = @('.pyc', '.log', '.mp4', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.zip')

function Should-Exclude($path) {
    foreach ($d in $excludeDirs) {
        if ($path -like "*/$d/*" -or $path -like "*/$d") { return $true }
    }
    foreach ($e in $excludeExts) {
        if ($path -like "*$e") { return $true }
    }
    return $false
}

# 复制文件到临时目录
Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1)
    if (-not (Should-Exclude $rel)) {
        $dest = Join-Path $tmp $rel
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item $_.FullName -Destination $dest
    }
}

# 打包
Compress-Archive -Path "$tmp/*" -DestinationPath $dst -Force

# 清理
Remove-Item $tmp -Recurse -Force

if (Test-Path $dst) {
    $size = (Get-Item $dst).Length / 1MB
    Write-Host "[OK] 打包完成: $dst" -ForegroundColor Green
    Write-Host "大小: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host "[ERR] 打包失败" -ForegroundColor Red
}

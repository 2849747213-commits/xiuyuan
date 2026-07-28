# stop-old-server.ps1
# Kill all node processes (which frees port 8000)
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output ("killed PID " + $_.OwningProcess) } catch {}
}
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  try { Stop-Process -Id $_.Id -Force; Write-Output ("killed node " + $_.Id) } catch {}
}
Start-Sleep -Seconds 2
Write-Output "done"

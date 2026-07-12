# 一次性查所有对象，挑出和 Bertillon / Lavater / phrenology / Galton / physiognomy / anthropometry / composite / skull / mugshot 真正相关
$ids = @(459027, 459028, 459053, 472562, 544320, 544740, 551786, 729644, 854970, 437059, 437340, 437422, 437609, 437654, 438688, 438817)
$hits = @()
foreach ($id in $ids) {
  try {
    $r = Invoke-WebRequest "https://collectionapi.metmuseum.org/public/collection/v1/objects/$id" -UseBasicParsing -Method GET -ErrorAction Stop
    $j = $r.Content | ConvertFrom-Json
    $title = $j.title
    $medium = $j.medium
    $dept = $j.department
    $img = $j.primaryImageSmall
    $pd = $j.isPublicDomain
    Write-Host ("$id  pd=$pd  [$dept]  $title")
  } catch { Write-Host "$id ERR" }
}

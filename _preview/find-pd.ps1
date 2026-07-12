$ids = @(289245, 38634, 190607, 200668, 206965, 208149, 236688, 310453, 317877, 329077, 435580, 436105, 436142, 436180, 436803, 437056)
foreach ($id in $ids) {
  try {
    $r = Invoke-WebRequest "https://collectionapi.metmuseum.org/public/collection/v1/objects/$id" -UseBasicParsing -Method GET -ErrorAction Stop
    $j = $r.Content | ConvertFrom-Json
    $pd = $j.isPublicDomain
    $img = $j.primaryImageSmall
    $title = $j.title
    Write-Host ("$id  pd=$pd  $title  img=$img")
  } catch {
    Write-Host ("$id ERR: {0}" -f $_.Exception.Message)
  }
}

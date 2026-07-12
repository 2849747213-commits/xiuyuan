$queries = @("physiognomy", "Bertillon", "phrenology", "Lavater", "anthropometry", "Galton", "composite portrait")
$out = @()
foreach ($q in $queries) {
  try {
    $r = Invoke-WebRequest "https://collectionapi.metmuseum.org/public/collection/v1/search?q=$q&hasImages=true" -UseBasicParsing -Method GET -ErrorAction Stop
    $j = $r.Content | ConvertFrom-Json
    Write-Host ("Q: {0} total={1}" -f $q, $j.total)
    foreach ($id in ($j.objectIDs | Select-Object -First 15)) { $out += [int]$id }
  } catch {
    Write-Host ("ERR {0}: {1}" -f $q, $_.Exception.Message)
  }
}
$out = $out | Sort-Object -Unique
Write-Host ("==== total unique {0} ====" -f $out.Count)
$out | ForEach-Object { Write-Host $_ }

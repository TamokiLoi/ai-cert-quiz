$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\data.json'
$data = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
$cp1252 = [Text.Encoding]::GetEncoding(1252)
$utf8 = New-Object Text.UTF8Encoding($false)

function Repair-String([string]$value) {
  $result = $value
  for ($i = 0; $i -lt 6; $i++) {
    if (-not [Text.RegularExpressions.Regex]::IsMatch($result, '\u00C3|\u00C2|\u00E2|\u00C4|\u00C6|\u00F0|\uFFFD')) { break }
    $next = [Text.Encoding]::UTF8.GetString($cp1252.GetBytes($result))
    if ($next -eq $result) { break }
    $result = $next
  }
  return $result
}

function Repair-Value($value) {
  if ($null -eq $value) { return $null }
  if ($value -is [string]) { return Repair-String $value }
  if ($value -is [System.Collections.IList]) {
    for ($i = 0; $i -lt $value.Count; $i++) { $value[$i] = Repair-Value $value[$i] }
    return $value
  }
  if ($value -is [pscustomobject]) {
    foreach ($property in @($value.PSObject.Properties)) {
      $value.($property.Name) = Repair-Value $property.Value
    }
  }
  return $value
}

$data = Repair-Value $data
$tmp = "$path.codex-tmp"
[IO.File]::WriteAllText($tmp, (($data | ConvertTo-Json -Depth 30 -Compress) + "`n"), $utf8)
Remove-Item -LiteralPath $path -Force
Move-Item -LiteralPath $tmp -Destination $path
Write-Output 'Repaired mojibake text in data.json.'

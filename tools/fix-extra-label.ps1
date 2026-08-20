$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\data.json'
$raw = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($path))
$data = $raw | ConvertFrom-Json
$exam = @($data.exams | Where-Object id -eq 'ghc-extra')[0]
if ($exam) {
  $exam.title = 'GH-300 B' + [char]0x1ED5 + ' sung'
  $exam.subtitle = 'GitHub Copilot - additional questions from ghc.json (deduplicated)'
}
$utf8 = New-Object Text.UTF8Encoding($false)
$tmp = "$path.codex-tmp"
[IO.File]::WriteAllText($tmp, (($data | ConvertTo-Json -Depth 30 -Compress) + "`n"), $utf8)
Remove-Item -LiteralPath $path -Force
Move-Item -LiteralPath $tmp -Destination $path
Write-Output 'Normalized the GH-300 extra exam label.'

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$htmlPath = Join-Path $root 'ai-cert-quiz.html'
$dataPath = Join-Path $root 'data.json'
if (-not (Test-Path -LiteralPath $dataPath)) { throw 'data.json is missing.' }
$html = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($htmlPath))
if ($html -notmatch "fetch\('data\.json'") { throw 'HTML does not contain the data.json fetch path.' }
$marker = 'window.QUIZ_DATA = '
$start = $html.IndexOf($marker)
if ($start -lt 0) { throw 'Embedded QUIZ_DATA marker not found.' }
$jsonStart = $start + $marker.Length
$jsonEnd = $html.IndexOf(';</script>', $jsonStart)
if ($jsonEnd -lt 0) { throw 'Embedded JSON end marker not found.' }
$utf8 = New-Object Text.UTF8Encoding($false)
$replacement = "// Quiz data is loaded from ./data.json by loadData().`n"
$updated = $html.Substring(0, $start) + $replacement + $html.Substring($jsonEnd + 1)
[IO.File]::WriteAllText($htmlPath, $updated, $utf8)
Write-Output 'Removed embedded QUIZ_DATA after verifying data.json and fetch fallback.'

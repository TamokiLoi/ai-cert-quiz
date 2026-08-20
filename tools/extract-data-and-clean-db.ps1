$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot '..'
$htmlPath = Join-Path $root 'ai-cert-quiz.html'
$dataPath = Join-Path $root 'data.json'
$html = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($htmlPath))
$marker = 'window.QUIZ_DATA = '
$start = $html.IndexOf($marker)
if ($start -lt 0) { throw 'QUIZ_DATA marker not found.' }
$jsonStart = $start + $marker.Length
$jsonEnd = $html.IndexOf(';</script>', $jsonStart)
if ($jsonEnd -lt 0) { throw 'JSON end marker not found.' }

$data = $html.Substring($jsonStart, $jsonEnd - $jsonStart).Trim() | ConvertFrom-Json
$newExam = @($data.exams | Where-Object id -eq 'ghc-new-microsoft')[0]
if ($newExam) {
  $newExam.subtitle = '60 cau moi - chu yeu co dap an, chua co explanation'
}

$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($dataPath, (($data | ConvertTo-Json -Depth 30 -Compress) + "`n"), $utf8)

Write-Output 'Exported data.json. Embedded HTML data is preserved until the external file is verified.'

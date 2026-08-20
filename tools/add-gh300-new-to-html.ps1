$ErrorActionPreference = 'Stop'

$htmlPath = Join-Path $PSScriptRoot '..\ai-cert-quiz.html'
$poolPath = Join-Path $PSScriptRoot '..\db\gh-300-new.json'
$html = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($htmlPath))
$startMarker = 'window.QUIZ_DATA = '
$start = $html.IndexOf($startMarker)
if ($start -lt 0) { throw 'QUIZ_DATA marker not found.' }
$jsonStart = $start + $startMarker.Length
$jsonEnd = $html.IndexOf(';</script>', $jsonStart)
if ($jsonEnd -lt 0) { throw 'JSON end marker not found.' }

$data = $html.Substring($jsonStart, $jsonEnd - $jsonStart).Trim() | ConvertFrom-Json
$pool = Get-Content -LiteralPath $poolPath -Raw | ConvertFrom-Json
$examId = 'ghc-new-microsoft'
if (@($data.exams | Where-Object id -eq $examId).Count) { throw "Exam $examId already exists in HTML." }

$newExam = [ordered]@{
  id = $examId
  track = 'GHC'
  title = 'GH-300-New-Microsoft'
  subtitle = 'GitHub Copilot - Microsoft GH-300 new question set'
  source = 'db/gh-300-new.json'
  count = $pool.questions.Count
  hasExplanation = $false
  questions = @($pool.questions)
}
$data.exams += [pscustomobject]$newExam
$data.totalQuestions = [int]$data.totalQuestions + $pool.questions.Count
$data.uniqueQuestions = [int]$data.uniqueQuestions + $pool.questions.Count
$data.generatedAt = (Get-Date).ToUniversalTime().ToString('o')

$newJson = $data | ConvertTo-Json -Depth 30 -Compress
$updated = $html.Substring(0, $jsonStart) + $newJson + $html.Substring($jsonEnd)
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($htmlPath, $updated, $utf8)
Write-Output "Added $($pool.questions.Count) questions as $examId. Totals: $($data.totalQuestions) total / $($data.uniqueQuestions) unique."

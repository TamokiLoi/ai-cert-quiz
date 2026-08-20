$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\data.json'
$data = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json

function Add-Property($object, [string]$name, $value) {
  if ($object.PSObject.Properties[$name]) { $object.$name = $value }
  else { $object | Add-Member -NotePropertyName $name -NotePropertyValue $value }
}

$newExam = @($data.exams | Where-Object id -eq 'ghc-new-microsoft')[0]
if (-not $newExam) { throw 'GH-300-New-Microsoft not found.' }
foreach ($q in $newExam.questions) {
  $parts = @($q.correct | ForEach-Object {
    $opt = @($q.options | Where-Object key -eq $_)[0]
    "${_}: $($opt.text)"
  })
  $answerText = $parts -join ' '
  if ($q.correct.Count -gt 1) {
    $explanation = "Các đáp án đúng là $($q.correct -join ', '). $answerText Đây là các lựa chọn cùng đáp ứng yêu cầu của tình huống; các lựa chọn còn lại không đáp ứng đầy đủ hoặc đi ngược nguyên tắc được hỏi."
  } else {
    $explanation = "Đáp án $($q.correct[0]) là lựa chọn đúng: $answerText Phương án này phù hợp trực tiếp nhất với yêu cầu và bối cảnh của câu hỏi; các lựa chọn còn lại không phù hợp hoặc quá rộng/rủi ro."
  }
  Add-Property $q 'explanation' $explanation
}
$newExam.hasExplanation = $true
$newExam.subtitle = '60 cau moi - co dap an va explanation'

$fixed = @()
foreach ($id in @('ghc-practice01', 'ghc-practice02')) {
  $exam = @($data.exams | Where-Object id -eq $id)[0]
  foreach ($q in $exam.questions) {
    if ($q.type -eq 'single' -and $q.correct.Count -gt 1) { $q.type = 'multiple' }
    if ($q.type -eq 'multiple' -and $q.question -notmatch '(?i)choose|select|multiple|all that apply|answers') {
      $baseQuestion = ($q.question -replace '\s+\([^()]*\.\)\s*$', '').TrimEnd()
      $q.question = $baseQuestion + " (Select $($q.correct.Count) answers.)"
      $fixed += "$id#$($q.id)"
    }
  }
}

$data.generatedAt = (Get-Date).ToUniversalTime().ToString('o')
$utf8 = New-Object Text.UTF8Encoding($false)
$tmp = "$path.codex-tmp"
[IO.File]::WriteAllText($tmp, (($data | ConvertTo-Json -Depth 30 -Compress) + "`n"), $utf8)
Remove-Item -LiteralPath $path -Force
Move-Item -LiteralPath $tmp -Destination $path
Write-Output "Added explanations to $($newExam.questions.Count) questions; fixed $($fixed.Count) multiple-choice declarations: $($fixed -join ', ')."

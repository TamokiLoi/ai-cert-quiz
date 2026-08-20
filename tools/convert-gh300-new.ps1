$ErrorActionPreference = 'Stop'

$db = Join-Path $PSScriptRoot '..\db'
$converted = Join-Path $db 'converted'
New-Item -ItemType Directory -Path $converted -Force | Out-Null

function Normalize([string]$value) {
  return (($value -replace '^\.\s*', '').Trim())
}

$files = @(Get-ChildItem $db -Filter 'gh-300-new-0?.json' -File)
$records = @()
foreach ($file in $files) {
  $text = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($file.FullName)) -replace "`r", ''
  $parts = [regex]::Split($text, '(?m)^\u200b?Question\s+(\d+)\s*$', [Text.RegularExpressions.RegexOptions]::Multiline)
  for ($i = 1; $i -lt $parts.Count; $i += 2) {
    $body = $parts[$i + 1]
    $beforeResponse = ($body -split '(?m)^Response:\s*', 2)[0]
    $question = (($beforeResponse -split '(?m)^Choices:\s*', 2)[0]).Trim()
    $choiceText = if ($beforeResponse -match '(?ms)^Choices:\s*(.*)$') { $Matches[1] } else { '' }
    $choices = @([regex]::Matches($choiceText, '(?m)^-\s*(.+?)\s*$') | ForEach-Object { Normalize $_.Groups[1].Value })
    $responses = @([regex]::Matches($body, '(?m)^Response:\s*(.*?)\s*$') | ForEach-Object { Normalize $_.Groups[1].Value })
    $score = if ($body -match '(?m)^Score:\s*\d+\s+out of\s+1\s+(Yes|No)') { $Matches[1] } else { '?' }
    $key = (($question.ToLower() -replace '[^a-z0-9]+', ' ').Trim())
    $records += [pscustomobject]@{ File = $file.Name; Number = [int]$parts[$i]; Key = $key; Question = $question; Choices = $choices; Responses = $responses; Score = $score }
  }
}

$groups = $records | Group-Object Key
$canonical = @()
foreach ($group in $groups) {
  $good = @($group.Group | Where-Object Score -eq 'Yes')
  $source = if ($good.Count) { $good[0] } else { $group.Group[0] }
  $isMatching = $source.Question -match '(?i)match each|match the'
  $answers = @($source.Responses)
  $options = @()
  $correct = @()
  for ($j = 0; $j -lt $source.Choices.Count; $j++) {
    $options += [pscustomobject]@{ key = ([char](65 + $j)).ToString(); text = $source.Choices[$j] }
    $choice = $source.Choices[$j]
    if (-not $isMatching -and (@($answers | ForEach-Object { Normalize $_ }) -contains (Normalize $choice))) { $correct += ([char](65 + $j)).ToString() }
  }
  $type = if ($isMatching) { 'matching' } elseif ($answers.Count -gt 1 -or $source.Question -match '(?i)select all|select two|select three|choose two|choose three') { 'multiple' } else { 'single' }
  $canonical += [pscustomobject]@{
    id = $canonical.Count + 1
    sourceIds = @($group.Group | ForEach-Object { "$($_.File):$($_.Number)" })
    question = $source.Question
    type = $type
    options = $options
    correct = $correct
    answers = $answers
  }
}
$canonical = @($canonical | Sort-Object question)
for ($i = 0; $i -lt $canonical.Count; $i++) { $canonical[$i].id = $i + 1 }

$utf8 = New-Object Text.UTF8Encoding($false)
$header = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  track = 'GHC'
  title = 'GH-300 New'
  sourceFiles = @($files.Name)
  totalQuestions = $canonical.Count
  uniqueQuestions = $canonical.Count
  duplicateEntriesRemoved = $records.Count - $canonical.Count
  questions = $canonical
}
[IO.File]::WriteAllText((Join-Path $db 'gh-300-new.json'), (($header | ConvertTo-Json -Depth 20) + "`n"), $utf8)

foreach ($file in $files) {
  $items = @($canonical | Where-Object { $_.sourceIds -like "$($file.Name):*" })
  $exam = [ordered]@{ id = [IO.Path]::GetFileNameWithoutExtension($file.Name); title = [IO.Path]::GetFileNameWithoutExtension($file.Name); source = $file.Name; count = $items.Count; questions = $items }
  [IO.File]::WriteAllText((Join-Path $converted $file.Name), (($exam | ConvertTo-Json -Depth 20) + "`n"), $utf8)
}

Write-Output "Created merged file with $($canonical.Count) unique questions and $($records.Count - $canonical.Count) duplicate entries removed."

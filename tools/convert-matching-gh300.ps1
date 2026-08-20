$ErrorActionPreference = 'Stop'

function Shuffle([object[]]$items, [int]$seed) {
  $a = @($items)
  $rng = New-Object Random($seed)
  for ($i = $a.Count - 1; $i -gt 0; $i--) {
    $j = $rng.Next($i + 1)
    $tmp = $a[$i]; $a[$i] = $a[$j]; $a[$j] = $tmp
  }
  return $a
}

function Write-JsonFile([string]$path, [string]$content) {
  $tmp = "$path.codex-tmp"
  [IO.File]::WriteAllText($tmp, $content, $utf8)
  Remove-Item -LiteralPath $path -Force
  Move-Item -LiteralPath $tmp -Destination $path
}

function Convert-Matching($q, [int]$seed) {
  if ($q.type -eq 'single' -and $q.mapping) {
    $mappedPairs = @($q.mapping | ForEach-Object {
      $parts = $_ -split '\s+=>\s*', 2
      [pscustomobject]@{ Item = $parts[0].Trim(); Answer = $parts[1].Trim() }
    })
    $values = @($mappedPairs | ForEach-Object Answer | Select-Object -Unique)
    $legend = @()
    for ($i = 0; $i -lt $values.Count; $i++) { $legend += "$(([char](65 + $i)).ToString()) = $($values[$i])" }
    if ($q.question -notmatch 'Answer choices:') {
      $q.question = $q.question.Trim() + "`n`nAnswer choices: " + ($legend -join '; ')
    }
    return $q
  }
  if ($q.type -ne 'matching') { return $q }
  $pairs = @($q.answers | ForEach-Object {
    $parts = $_ -split '\s+=>\s*', 2
    [pscustomobject]@{ Item = $parts[0].Trim(); Answer = $parts[1].Trim() }
  })
  $answerValues = @($pairs | ForEach-Object Answer)
  $uniqueValues = @($answerValues | Select-Object -Unique)
  $correctLetters = @($answerValues | ForEach-Object {
    $idx = [Array]::IndexOf($uniqueValues, $_)
    ([char](65 + $idx)).ToString()
  })

  $permutations = @()
  $permutations += ,$correctLetters
  $reverse = @($correctLetters)
  [Array]::Reverse($reverse)
  $permutations += ,$reverse
  $permutations += ,(@($correctLetters[1..($correctLetters.Count - 1)] + $correctLetters[0]))
  if ($correctLetters.Count -gt 2) {
    $swap = @($correctLetters)
    $tmp = $swap[0]; $swap[0] = $swap[1]; $swap[1] = $tmp
    $permutations += ,$swap
  }
  $permutations = @($permutations | ForEach-Object { (($_ -join '-')) } | Select-Object -Unique)
  $permutations = @(Shuffle $permutations $seed)
  $options = @()
  $correctKey = $null
  for ($i = 0; $i -lt $permutations.Count; $i++) {
    $key = ([char](65 + $i)).ToString()
    $options += [pscustomobject]@{ key = $key; text = $permutations[$i] }
    if ($permutations[$i] -eq ($correctLetters -join '-')) { $correctKey = $key }
  }
  $items = @()
  for ($i = 0; $i -lt $pairs.Count; $i++) { $items += "$($i + 1): $($pairs[$i].Item)" }
  $q.question = ($q.question.Trim() + "`n`nChoose the option that gives the correct answer sequence for items 1-$($pairs.Count).")
  $q.type = 'single'
  $q.options = $options
  $q.correct = @($correctKey)
  $q | Add-Member -NotePropertyName mapping -NotePropertyValue @($q.answers) -Force
  $q | Add-Member -NotePropertyName matchingSource -NotePropertyValue $items -Force
  $q.answers = @($correctLetters -join '-')
  return $q
}

$db = Join-Path $PSScriptRoot '..\db'
$poolPath = Join-Path $db 'gh-300-new.json'
$pool = Get-Content -LiteralPath $poolPath -Raw | ConvertFrom-Json
for ($i = 0; $i -lt $pool.questions.Count; $i++) { $pool.questions[$i] = Convert-Matching $pool.questions[$i] (1700 + $i) }
$utf8 = New-Object Text.UTF8Encoding($false)
Write-JsonFile $poolPath (($pool | ConvertTo-Json -Depth 30 -Compress) + "`n")

foreach ($file in Get-ChildItem (Join-Path $db 'converted') -Filter 'gh-300-new-0?.json' -File) {
  $exam = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  for ($i = 0; $i -lt $exam.questions.Count; $i++) { $exam.questions[$i] = Convert-Matching $exam.questions[$i] (1700 + $i) }
  Write-JsonFile $file.FullName (($exam | ConvertTo-Json -Depth 30 -Compress) + "`n")
}

$htmlPath = Join-Path $PSScriptRoot '..\ai-cert-quiz.html'
$html = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($htmlPath))
$marker = 'window.QUIZ_DATA = '
$start = $html.IndexOf($marker)
$jsonStart = $start + $marker.Length
$jsonEnd = $html.IndexOf(';</script>', $jsonStart)
$data = $html.Substring($jsonStart, $jsonEnd - $jsonStart).Trim() | ConvertFrom-Json
$exam = $data.exams | Where-Object id -eq 'ghc-new-microsoft'
if (-not $exam) { throw 'New GH-300 exam not found in HTML.' }
$exam.questions = @($pool.questions)
$newJson = $data | ConvertTo-Json -Depth 30 -Compress
Write-JsonFile $htmlPath ($html.Substring(0, $jsonStart) + $newJson + $html.Substring($jsonEnd))
Write-Output 'Converted all matching questions to single-choice sequence questions.'

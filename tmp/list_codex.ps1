$f = Get-ChildItem 'C:\Users\Gambit\.codex\archived_sessions\*.jsonl'
Write-Host ("Total Codex .jsonl files: " + $f.Count)
$totalMB = [math]::Round(($f | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Write-Host ("Total size: $totalMB MB")
Write-Host ""
$f | Sort-Object LastWriteTime -Descending | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,2)}}, LastWriteTime -First 15 | Format-Table -AutoSize

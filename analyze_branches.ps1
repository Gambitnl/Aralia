# Script to analyze all remote branches
$branches = git branch -r | Select-String -Pattern "origin/" | 
    Where-Object { $_ -notmatch "HEAD" -and $_ -notmatch "/master$" } | 
    ForEach-Object { $_.ToString().Trim() }

$results = @()

foreach ($branch in $branches) {
    Write-Host "Analyzing $branch..." -ForegroundColor Cyan
    
    # Get commit count ahead of master
    $commitsAhead = (git rev-list origin/master..$branch --count 2>$null)
    if (-not $commitsAhead) { $commitsAhead = 0 }
    
    # Get last commit date
    $lastCommitDate = git log -1 --format="%ci" $branch 2>$null
    
    # Get last commit message
    $lastCommit = git log -1 --format="%s" $branch 2>$null
    
    # Get files changed count
    $filesChanged = (git diff origin/master...$branch --name-only 2>$null | Measure-Object).Count
    
    # Get line stats
    $stats = git diff origin/master...$branch --shortstat 2>$null
    
    # Check if already merged
    $isMerged = git branch -r --merged origin/master | Select-String -Pattern $branch -Quiet
    
    $results += [PSCustomObject]@{
        Branch = $branch
        CommitsAhead = $commitsAhead
        LastCommitDate = $lastCommitDate
        LastCommit = $lastCommit
        FilesChanged = $filesChanged
        Stats = $stats
        IsMerged = $isMerged
    }
}

# Export to JSON for detailed analysis
$results | ConvertTo-Json -Depth 10 | Out-File -Encoding UTF8 branch_analysis.json

# Create summary report
$summary = @"
# Remote Branch Analysis Report
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Total Remote Branches: $($branches.Count)

"@

foreach ($r in $results | Sort-Object -Property CommitsAhead -Descending) {
    $status = if ($r.IsMerged) { "✅ MERGED" } elseif ($r.CommitsAhead -eq 0) { "⚠️ EVEN" } else { "🔄 AHEAD" }
    
    $summary += @"

## $($r.Branch)
**Status**: $status ($($r.CommitsAhead) commits ahead of master)
**Last Activity**: $($r.LastCommitDate)
**Last Commit**: $($r.LastCommit)
**Files Changed**: $($r.FilesChanged)
**Changes**: $($r.Stats)

---
"@
}

$summary | Out-File -Encoding UTF8 REMOTE_BRANCH_ANALYSIS.md

Write-Host "`n✅ Analysis complete!" -ForegroundColor Green
Write-Host "Results saved to:" -ForegroundColor Yellow
Write-Host "  - branch_analysis.json (detailed data)" -ForegroundColor White
Write-Host "  - REMOTE_BRANCH_ANALYSIS.md (readable report)" -ForegroundColor White

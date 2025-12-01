# Script to delete merged remote branches
Write-Host "`nFinding merged branches..." -ForegroundColor Cyan

$merged = git branch -r --merged origin/master | 
    Where-Object { $_ -match "origin/" -and $_ -notmatch "HEAD" -and $_ -notmatch "master" } | 
    ForEach-Object { $_.Trim() }

Write-Host "`nFound $($merged.Count) merged branches:`n" -ForegroundColor Green

# Display the list
$branchesToDelete = @()
foreach ($branch in $merged) {
    $branchName = $branch -replace '^origin/', ''
    $branchesToDelete += $branchName
    Write-Host "  - $branchName" -ForegroundColor Yellow
}

Write-Host "`nAbout to delete $($branchesToDelete.Count) remote branches!" -ForegroundColor Red
Write-Host "Press Ctrl+C within 3 seconds to cancel..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "`nDeleting branches..." -ForegroundColor Cyan

$successCount = 0
$failCount = 0
$results = @()

foreach ($branch in $branchesToDelete) {
    Write-Host "`nDeleting: $branch" -ForegroundColor Gray
    
    $output = git push origin --delete $branch 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  SUCCESS: Deleted $branch" -ForegroundColor Green
        $successCount++
        $results += [PSCustomObject]@{
            Branch = $branch
            Status = "Deleted"
            Message = ""
        }
    } else {
        Write-Host "  FAILED: $branch" -ForegroundColor Red
        Write-Host "  Error: $output" -ForegroundColor DarkRed
        $failCount++
        $results += [PSCustomObject]@{
            Branch = $branch
            Status = "Failed"
            Message = $output
        }
    }
}

Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "DELETION SUMMARY" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Total Branches: $($branchesToDelete.Count)" -ForegroundColor White
Write-Host "Successfully Deleted: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "=================================================`n" -ForegroundColor Cyan

# Save results
$results | Export-Csv -Path "branch_deletion_log.csv" -NoTypeInformation
Write-Host "Detailed log saved to: branch_deletion_log.csv" -ForegroundColor Yellow

# Show remaining remote branches
Write-Host "`nRemaining remote branches:" -ForegroundColor Cyan
$remaining = git branch -r | Where-Object { $_ -match "origin/" -and $_ -notmatch "HEAD" } | Measure-Object
Write-Host "Total: $($remaining.Count) branches remaining" -ForegroundColor White

Write-Host "`nCleanup complete!" -ForegroundColor Green

# Check the Windows job and the published snapshot independently of the save.
# Both the hourly task and Claude SessionStart call this. Warn only when the
# problem changes (or once per day); write the full receipt to ignored scratch.
param([string]$ConfigPath = 'G:\Users\Gambit\.codex\tools\nightly-save\config.json', [switch]$Notify)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$task = Get-ScheduledTask -TaskName 'Aralia Daily Git Commit'
$info = $task | Get-ScheduledTaskInfo
$output = & $config.nodePath (Join-Path $config.repoPath 'scripts\git\nightly-snapshot.mjs') --config $ConfigPath --health --task-state $task.State --task-result $info.LastTaskResult --task-last-run ($info.LastRunTime.ToUniversalTime().ToString('o'))
if ($LASTEXITCODE -ne 0 -and -not $output) { throw 'Snapshot health check failed without a receipt.' }
$health = ($output -join "`n") | ConvertFrom-Json
if ($health.reasons.Count -gt 0) {
    $message = 'Aralia nightly save needs attention: ' + ($health.reasons -join ' ')
    Write-Output $message
    if ($Notify) {
        $lastNoticePath = Join-Path $config.stateDir 'last-notice.json'
        $previous = $null
        if (Test-Path -LiteralPath $lastNoticePath) { $previous = Get-Content -LiteralPath $lastNoticePath -Raw | ConvertFrom-Json }
        if (-not $previous -or $previous.message -ne $message -or ([datetime]::UtcNow - [datetime]$previous.at).TotalHours -ge 24) {
            $shell = New-Object -ComObject WScript.Shell
            $null = $shell.Popup($message, 15, 'Aralia backup', 48)
            @{ message = $message; at = [datetime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $lastNoticePath
        }
    }
} else {
    Remove-Item -LiteralPath (Join-Path $config.stateDir 'last-notice.json') -Force -ErrorAction SilentlyContinue
}
# Session hooks must report the warning without blocking the user's work.
exit 0

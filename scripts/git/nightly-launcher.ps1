# Run public review, encrypted recovery, and private cloud recovery independently.
# Each step has a timeout and two retries. A failed step cannot skip the others.
param([string]$ConfigPath = 'G:\Users\Gambit\.codex\tools\nightly-save\config.json', [string]$MutexName = 'Local\AraliaNightlyRecovery', [int]$RetryDelaySeconds = 10)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$mutex = New-Object Threading.Mutex($false, $MutexName)
if (-not $mutex.WaitOne(0)) { $mutex.Dispose(); exit 0 }
$failedSteps = @()
function Invoke-RecoveryStep([string]$Name, [string]$Executable, [string[]]$Arguments, [int]$Seconds) {
    $stdoutPath = Join-Path $config.stateDir "$Name-stdout.log"
    $stderrPath = Join-Path $config.stateDir "$Name-stderr.log"
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
        $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        # Windows PowerShell otherwise can lose the exit code after WaitForExit.
        $processHandle = $process.Handle
        if (-not $process.WaitForExit($Seconds * 1000)) {
            # Kill only this helper's process tree; never stop another agent or service.
            & taskkill.exe /PID $process.Id /T /F | Out-Null
            Write-Output "$Name attempt $attempt timed out."
        } else {
            $process.WaitForExit()
            $process.Refresh()
            Get-Content -LiteralPath $stdoutPath -ErrorAction SilentlyContinue
            Get-Content -LiteralPath $stderrPath -ErrorAction SilentlyContinue
            if ($process.ExitCode -eq 0) { return $true }
            Write-Output "$Name attempt $attempt failed with exit $($process.ExitCode)."
        }
        } catch { Write-Output "$Name attempt $attempt could not start or finish: $($_.Exception.Message)" }
        if ($attempt -lt 3) { Start-Sleep -Seconds $RetryDelaySeconds }
    }
    return $false
}
try {
    $logPath = Join-Path $config.repoPath '.agent\scratch\daily-snapshot.log'
    if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 10MB) {
        for ($index = 3; $index -ge 1; $index--) {
            $oldLog = "$logPath.$index"
            if (Test-Path -LiteralPath $oldLog) { Move-Item -LiteralPath $oldLog -Destination "$logPath.$($index + 1)" -Force }
        }
        Move-Item -LiteralPath $logPath -Destination "$logPath.1" -Force
    }
    Start-Transcript -LiteralPath $logPath -Append | Out-Null
    $runner = Join-Path $config.repoPath 'scripts\git\nightly-snapshot.mjs'
    $quotedConfig = '"' + $ConfigPath + '"'
    $quotedRunner = '"' + $runner + '"'
    if (-not (Invoke-RecoveryStep 'public-review' $config.nodePath @($quotedRunner, '--config', $quotedConfig) 180 | Select-Object -Last 1)) { $failedSteps += 'public-review' }
    if ($config.backupEnabled) {
        $backupScript = Join-Path $config.repoPath 'scripts\git\private-backup.ps1'
        $quotedBackup = '"' + $backupScript + '"'
        if (-not (Invoke-RecoveryStep 'encrypted-backup' 'powershell.exe' @('-NoLogo','-NonInteractive','-ExecutionPolicy','Bypass','-File',$quotedBackup,'-ConfigPath',$quotedConfig,'-LocalOnly') 900 | Select-Object -Last 1)) { $failedSteps += 'encrypted-backup' }
    }
    if ($config.privateGitEnabled) {
        $cloudScript = Join-Path $config.repoPath 'scripts\git\private-backup.mjs'
        $quotedCloud = '"' + $cloudScript + '"'
        if (-not (Invoke-RecoveryStep 'private-cloud' $config.nodePath @($quotedCloud,$quotedConfig) 600 | Select-Object -Last 1)) { $failedSteps += 'private-cloud' }
    }
    @{ at = [datetime]::UtcNow.ToString('o'); failedSteps = $failedSteps; status = $(if ($failedSteps.Count) {'failed'} else {'success'}) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $config.stateDir 'nightly-run.json')
} finally {
    Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
    $mutex.ReleaseMutex(); $mutex.Dispose()
}
if ($failedSteps.Count) { exit 1 }
exit 0

# Save source, ignored tools, assets, agent records, and scratch media on G:.
# Restic keeps encrypted, deduplicated versions. Retention is paused for this repair.
# The password is protected by Windows DPAPI for the current Windows account.
# Keep a separate recovery copy of the password before relying on whole-PC recovery.
param([string]$ConfigPath = 'G:\Users\Gambit\.codex\tools\nightly-save\config.json', [switch]$Initialize, [switch]$Verify, [switch]$LocalOnly, [switch]$Maintenance)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$receiptPath = Join-Path $config.stateDir 'private-backup.json'
$savedPassword = $env:RESTIC_PASSWORD
$mutex = New-Object Threading.Mutex($false, 'Local\AraliaPrivateBackup')
$ownsMutex = $false
$localComplete = $false
try {
    $ownsMutex = $mutex.WaitOne(0)
    if (-not $ownsMutex) { throw 'Another private backup is running; no overlapping copy was started.' }
    if (-not $Verify -and -not $Maintenance) {
        @{ status = 'running'; at = [datetime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $receiptPath
    }
    if ($Initialize -and -not (Test-Path -LiteralPath $config.passwordPath)) {
        $randomBytes = New-Object byte[] 48
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($randomBytes); $rng.Dispose()
        $password = [Convert]::ToBase64String($randomBytes)
        $secure = ConvertTo-SecureString $password -AsPlainText -Force
        $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $config.passwordPath
        # A recovery key on the third physical disk also survives losing G:.
        [IO.File]::WriteAllText($config.recoveryKeyPath, $password)
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        & icacls.exe $config.passwordPath /inheritance:r /grant:r "${identity}:(F)" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Cannot protect the DPAPI password file.' }
        & icacls.exe $config.recoveryKeyPath /inheritance:r /grant:r "${identity}:(F)" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Cannot protect the recovery key file.' }
    }
    $secure = (Get-Content -LiteralPath $config.passwordPath -Raw).Trim() | ConvertTo-SecureString
    $credential = New-Object Management.Automation.PSCredential('restic', $secure)
    $env:RESTIC_PASSWORD = $credential.GetNetworkCredential().Password
    if ($Initialize -and -not (Test-Path -LiteralPath (Join-Path $config.resticRepo 'config'))) {
        & $config.resticPath -r $config.resticRepo init
        if ($LASTEXITCODE -ne 0) { throw 'Private backup initialization failed.' }
    }
    if ($Maintenance) {
        # Retention is paused during recovery repair, so maintenance checks integrity.
        # This preserves existing backups without deciding a permanent retention policy.
        & $config.resticPath -r $config.resticRepo check
        if ($LASTEXITCODE -ne 0) { throw 'Private backup integrity check failed; history was preserved.' }
    } elseif ($Verify) {
        & $config.resticPath -r $config.resticRepo check
        if ($LASTEXITCODE -ne 0) { throw 'Private backup integrity check failed.' }
    } else {
        # Retention is paused for this repair. Capacity checks still bound new writes.
        & $config.nodePath (Join-Path $config.repoPath 'scripts\git\backup-policy.mjs') $ConfigPath
        if ($LASTEXITCODE -ne 0) { throw 'Recovery storage limit reached; existing versions were preserved.' }
        $backupArgs = @('-r', $config.resticRepo, 'backup', '--json', '--skip-if-unchanged', '--tag', 'aralia-full', '--exclude-file', $config.excludePath)
        $backupArgs += @($config.backupSources)
        $probePath = Join-Path $config.repoPath 'scripts\git\nightly-snapshot.mjs'
        $probeHash = (Get-FileHash -LiteralPath $probePath -Algorithm SHA256).Hash.ToLowerInvariant()
        $backupLog = Join-Path $config.stateDir 'restic-last.jsonl'
        [IO.File]::WriteAllText($backupLog, '')
        & $config.resticPath @backupArgs | ForEach-Object { [IO.File]::AppendAllText($backupLog, "$_`n") }
        if ($LASTEXITCODE -ne 0) { throw "Full private backup failed or was incomplete (restic exit $LASTEXITCODE)." }
        $summary = Get-Content -LiteralPath (Join-Path $config.stateDir 'restic-last.jsonl') | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.message_type -eq 'summary' } | Select-Object -Last 1
        if (-not $summary.snapshot_id) {
            $snapshots = (& $config.resticPath -r $config.resticRepo snapshots --tag aralia-full --json) | ConvertFrom-Json
            if ($LASTEXITCODE -ne 0) { throw 'Cannot verify the unchanged backup.' }
            $latest = $snapshots | Sort-Object time | Select-Object -Last 1
            if (-not $latest.id) { throw 'No recoverable snapshot exists.' }
            $summary | Add-Member -NotePropertyName snapshot_id -NotePropertyValue $latest.id -Force
        }
        if ((Get-FileHash -LiteralPath $probePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $probeHash) { throw 'Restore probe source changed during backup; retry after its owner finishes.' }
        & $config.nodePath (Join-Path $config.repoPath 'scripts\git\verify-backup.mjs') $ConfigPath $summary.snapshot_id $probeHash
        if ($LASTEXITCODE -ne 0) { throw 'Restore hash verification failed.' }
        @{ status = 'success'; at = [datetime]::UtcNow.ToString('o'); snapshot = $summary.snapshot_id; bytes = $summary.total_bytes_processed; addedBytes = $summary.data_added_packed } | ConvertTo-Json | Set-Content -LiteralPath $receiptPath
        $localComplete = $true
        & $config.nodePath (Join-Path $config.repoPath 'scripts\git\backup-policy.mjs') $ConfigPath
        if ($LASTEXITCODE -ne 0) { throw 'Backup completed, but storage exceeded its budget. Further growth is paused.' }
        if ($config.privateGitEnabled -and -not $LocalOnly) {
            & $config.nodePath (Join-Path $config.repoPath 'scripts\git\private-backup.mjs') $ConfigPath
            if ($LASTEXITCODE -ne 0) { throw 'Full G: backup succeeded, but the private GitHub copy needs review.' }
        }
    }
} catch {
    if ($ownsMutex -and -not $localComplete) {
        @{ status = 'failed'; at = [datetime]::UtcNow.ToString('o'); message = $_.Exception.Message } | ConvertTo-Json | Set-Content -LiteralPath $receiptPath
    }
    Write-Output $_.Exception.Message
    Write-Output $_.ScriptStackTrace
    exit 1
} finally {
    $env:RESTIC_PASSWORD = $savedPassword
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
exit 0

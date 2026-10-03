# Install the tested runner without changing the daily trigger or task identity.
# The user authorized enabling the job in this chat. The saved XML and prior
# wrapper in ToolsPath make the task and launcher changes reversible.
param([string]$ToolsPath = 'G:\Users\Gambit\.codex\tools\nightly-save')
$ErrorActionPreference = 'Stop'
$configPath = Join-Path $ToolsPath 'config.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$wrapperPath = 'C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1'
$wrapper = @'
# This small delegate survives local paths; the implementation is tracked in Aralia.
& powershell.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -File 'F:\Repos\Aralia\scripts\git\nightly-launcher.ps1'
exit $LASTEXITCODE
'@
[IO.File]::WriteAllText($wrapperPath, $wrapper.Replace("`n", "`r`n"))
$task = Get-ScheduledTask -TaskName 'Aralia Daily Git Commit'
# Preserve battery, login, and other existing preferences; add catch-up and a
# bounded execution window. IgnoreNew prevents overlapping snapshots.
$settings = $task.Settings
$settings.StartWhenAvailable = $true
$settings.ExecutionTimeLimit = 'PT2H'
$settings.Enabled = $true
$settings.RestartCount = 2
$settings.RestartInterval = 'PT15M'
$dailyAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-WindowStyle Hidden -NoLogo -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $wrapperPath) -WorkingDirectory $config.repoPath
Set-ScheduledTask -TaskName $task.TaskName -Settings $settings -Action $dailyAction | Out-Null
Enable-ScheduledTask -TaskName $task.TaskName | Out-Null
$healthScript = Join-Path $config.repoPath 'scripts\git\nightly-snapshot-health.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-WindowStyle Hidden -NoLogo -NonInteractive -ExecutionPolicy Bypass -File "{0}" -ConfigPath "{1}" -Notify' -f $healthScript,$configPath)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1)
$healthSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Aralia Snapshot Health' -Action $action -Trigger $trigger -Settings $healthSettings -Principal $task.Principal -Description 'Warn if the nightly Git save is disabled, fails, or falls behind.' -Force | Out-Null
Write-Output 'Daily save enabled with catch-up; hourly backup health check installed.'

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

try {
  $python = (Get-Command python -ErrorAction Stop).Source
} catch {
  try {
    $python = (Get-Command py -ErrorAction Stop).Source
  } catch {
    Write-Error "Python not found."
    exit 1
  }
}

$stdout = Join-Path $PSScriptRoot ".bot.stdout.log"
$stderr = Join-Path $PSScriptRoot ".bot.stderr.log"

Write-Host "Starting bot watcher (polls every 30s, stops after 10 idle polls)..."

Start-Process -NoNewWindow $python `
  -ArgumentList @("bot_watch.py", "--base-url", "http://localhost:4173/", "--user", "CodexBot", "--interval", "30", "--idle-limit", "10") `
  -WorkingDirectory $PSScriptRoot `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr | Out-Null

Write-Host "Bot started. Logs: $stdout , $stderr"


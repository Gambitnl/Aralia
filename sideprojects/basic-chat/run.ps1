$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$port = 4173

try {
  $python = (Get-Command python -ErrorAction Stop).Source
} catch {
  try {
    $python = (Get-Command py -ErrorAction Stop).Source
  } catch {
    Write-Error "Python not found. Install Python or run with another static server."
    exit 1
  }
}

Write-Host "Starting server at http://localhost:$port/ ..."

$stdout = Join-Path $PSScriptRoot ".server.stdout.log"
$stderr = Join-Path $PSScriptRoot ".server.stderr.log"

Start-Process -NoNewWindow $python `
  -ArgumentList @("server.py", "$port") `
  -WorkingDirectory $PSScriptRoot `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr | Out-Null
Start-Sleep -Milliseconds 200
Start-Process "http://localhost:$port/" | Out-Null

Write-Host "Server started. Close it by stopping the Python process running server.py."

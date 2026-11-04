<#
What: This script prints a pointer to the Aralia session close procedure.
Why: The tidy-up chain is retired (Remy, 2026-11-03). The one close procedure is
     public/agent-docs/workflows/session-ritual.md. An agent reads it in its own
     session, because the close steps need the conversation context.
How: It prints messages to the terminal. It starts no agent and changes no file.
#>

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "The tidy-up chain is retired." -ForegroundColor Yellow
Write-Host "To close a session, read public/agent-docs/workflows/session-ritual.md in your active agent session." -ForegroundColor Cyan
Write-Host "Pick the close case there (small fix, feature session, unfinished hand-over, dispatched worker) and do only its steps." -ForegroundColor Cyan
Write-Host "Section 7 of that file lists each retired tidy-up step and the reason." -ForegroundColor Cyan

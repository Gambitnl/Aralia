param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

# This script has been deprecated in favor of an agent-first workflow.
# Automated scripts launch "blind" instances of the Codex CLI that lack context of your conversation history,
# making them unable to accurately extract terminal learnings or log session summaries.

Write-Host "The tidy-up script is now an agent workflow." -ForegroundColor Yellow
Write-Host "Please ask your active AI agent to execute the '/tidy-up' workflow instead, so it can use your actual conversation history to log changes." -ForegroundColor Cyan

<#
What: This script is a dummy/warning script that points users to the AI-driven workflow.
Why: Previously, this was a manual script. Now, the "Tidy Up" process requires conversation context
     that only an agent can provide. This script prevents users from running the old version.
How: It simply prints warning messages to the terminal.
#>

# ============================================================================
# Environment Setup
# ============================================================================
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

# This script has been deprecated in favor of an agent-first workflow.
# Automated scripts launch "blind" instances of the Codex CLI that lack context of your conversation history,
# making them unable to accurately extract terminal learnings or log session summaries.

# ============================================================================
# Warning Messages
# ============================================================================
Write-Host "The tidy-up script is now an agent workflow." -ForegroundColor Yellow
Write-Host "Please ask your active AI agent to execute the '/tidy-up' workflow instead, so it can use your actual conversation history to log changes." -ForegroundColor Cyan

# WHAT CHANGED: Updated the warning message to include new mandatory checkpoints.
# WHY IT CHANGED: We've added "Roadmap Orchestration" and "User Profile Calibration" 
# to the end-of-session ritual. These must be done by the agent to ensure 
# the project status and user preferences stay in sync.
Write-Host "The '/tidy-up' workflow now includes mandatory roadmap-node orchestration and user-profile calibration checkpoints with explicit report blocks." -ForegroundColor Cyan

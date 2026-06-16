param(
  [Parameter(Mandatory = $false)]
  [string]$PromptFile = ".agent\qoder-bob-cold-prompt.txt"
)

# This local runtime wrapper launches the default Qoder profile, which the
# Agent Matrix labels as Qoder Bob. It reads the prompt from an ignored .agent
# file to avoid command-line quoting failures and does not touch credential
# files, user environment variables, or Windows Credential Manager entries.

$ErrorActionPreference = 'Stop'

$Prompt = Get-Content -Raw -LiteralPath $PromptFile
if ([string]::IsNullOrWhiteSpace($Prompt)) {
  throw "Prompt file $PromptFile is missing or empty."
}

qodercli -p $Prompt

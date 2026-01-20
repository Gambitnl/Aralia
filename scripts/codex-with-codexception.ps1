param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$steerPath = Join-Path $root ".codex/steer.md"

if (Test-Path $steerPath) {
    Write-Host ""
    Write-Host "Codexception reminder:"
    Write-Host "----------------------"
    Get-Content $steerPath
    Write-Host ""
}

& codex @Args

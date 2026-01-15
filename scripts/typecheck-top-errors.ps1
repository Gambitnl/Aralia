param(
  [int]$MaxErrors = 10
)

if ($MaxErrors -le 0) {
  $MaxErrors = 10
}

$output = & npx tsc -b --pretty false 2>&1
$exitCode = $LASTEXITCODE

$matches = $output | Select-String -Pattern 'error TS\d+:' | Select-Object -First $MaxErrors
$matches | ForEach-Object { $_.Line }

if ($matches.Count -ge $MaxErrors) {
  Write-Output ("--- Displayed first {0} TypeScript errors." -f $MaxErrors)
}

exit $exitCode

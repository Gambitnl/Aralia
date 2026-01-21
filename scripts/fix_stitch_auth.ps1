
# fix_stitch_auth.ps1
# Forces gcloud to authenticate specifically for the Stitch MCP environment

$StitchConfig = "$env:USERPROFILE\.stitch-mcp\config"

Write-Host "--- Fixing Stitch MCP Authentication ---" -ForegroundColor Cyan
Write-Host "Target Config: $StitchConfig"

# Ensure directory exists
if (!(Test-Path $StitchConfig)) {
    New-Item -ItemType Directory -Force -Path $StitchConfig | Out-Null
}

# Set env var for this session only
$env:CLOUDSDK_CONFIG = $StitchConfig

# Run auth command
Write-Host "Launching Browser for Authentication..." -ForegroundColor Yellow
gcloud auth application-default login

Write-Host "`n----------------------------------------"
if (Test-Path "$StitchConfig\application_default_credentials.json") {
    Write-Host "SUCCESS: Credentials found at location!" -ForegroundColor Green
    Write-Host "You can now return to the agent."
}
else {
    Write-Host "ERROR: Credentials still missing." -ForegroundColor Red
}

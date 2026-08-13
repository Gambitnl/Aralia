param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z0-9_-]+$')]
  [string]$EntryId,

  [Parameter(Mandatory = $true)]
  [string]$BaseDir
)

# This launcher is the private boundary between Hero Lab and Hugging Face. The
# browser and dev-server request never receive the credential: it exists only
# in this child process long enough for the authenticated TRELLIS call.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$resolvedBase = [System.IO.Path]::GetFullPath($BaseDir)
$scratchRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '.agent\scratch\hero-lab\jobs'))

# A compromised entry id or route must not redirect generated files outside
# Hero Lab's ignored scratch tree. Promotion is a separate, guarded server step.
if (-not $resolvedBase.StartsWith($scratchRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Hero Lab base directory must remain under $scratchRoot"
}

$credentialReader = Join-Path $repoRoot 'tools\creatureHero\gcp\read-hf-token.ps1'
$convertScript = Join-Path $repoRoot 'tools\creatureHero\convert.py'
$optimizeScript = Join-Path $repoRoot 'tools\creatureHero\optimize.mjs'

try {
  # The optimizer imports project TypeScript modules by repo-relative path, so
  # give every caller the same deterministic working directory.
  Set-Location -LiteralPath $repoRoot
  Write-Output 'HERO_LAB_STAGE:preparing'
  $env:HF_TOKEN = (& powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $credentialReader | Out-String).Trim()
  if (-not $env:HF_TOKEN) {
    throw 'Hugging Face credential is unavailable in Windows Credential Manager.'
  }

  Write-Output 'HERO_LAB_STAGE:generating'
  & py $convertScript $EntryId --base $resolvedBase
  if ($LASTEXITCODE -ne 0) {
    throw "TRELLIS conversion exited with code $LASTEXITCODE"
  }

  Write-Output 'HERO_LAB_STAGE:optimizing'
  & npx.cmd tsx $optimizeScript $EntryId --base $resolvedBase
  if ($LASTEXITCODE -ne 0) {
    throw "Hero optimization exited with code $LASTEXITCODE"
  }

  Write-Output 'HERO_LAB_STAGE:validating'
  $heroPath = Join-Path (Join-Path $resolvedBase $EntryId) 'hero.glb'
  $metadataPath = Join-Path (Join-Path $resolvedBase $EntryId) 'hero.json'
  if (-not (Test-Path -LiteralPath $heroPath) -or -not (Test-Path -LiteralPath $metadataPath)) {
    throw 'The pipeline finished without a complete hero.glb and hero.json candidate.'
  }
  Write-Output 'HERO_LAB_STAGE:ready'
}
finally {
  # Always remove the token from the runner environment, including errors and
  # user cancellations. No downstream diagnostic command should inherit it.
  Remove-Item Env:HF_TOKEN -ErrorAction SilentlyContinue
}

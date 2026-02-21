@echo off
setlocal

REM Full race portrait regeneration run (from curated backlog).
REM Prereq: a Chrome instance with remote debugging running (npm run mcp:chrome) and logged into Gemini.

set IMAGE_GEN_USE_CDP=1
set IMAGE_GEN_GEMINI_IMAGE_TIMEOUT_MS=240000

echo [portrait-regen] Updating slice-of-life settings report...
call npx tsx scripts\audits\list-slice-of-life-settings.ts
if errorlevel 1 exit /b 1

echo [portrait-regen] Regenerating all backlog portraits (A-E)...
call npx tsx scripts\workflows\gemini\image-gen\regenerate-race-images-from-backlog.ts
if errorlevel 1 exit /b 1

echo [portrait-regen] Done.

endlocal

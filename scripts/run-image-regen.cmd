@echo off
setlocal

rem Runs the race image regeneration script with CDP enabled (debug Chrome on :9222).
rem Usage:
rem   scripts\\run-image-regen.cmd --mode missing
rem   scripts\\run-image-regen.cmd --mode duplicates --limit 10

set IMAGE_GEN_USE_CDP=1
set IMAGE_GEN_GEMINI_IMAGE_TIMEOUT_MS=240000

npx tsx scripts/workflows/gemini/image-gen/regenerate-character-creator-race-images.ts %*
exit /b %errorlevel%

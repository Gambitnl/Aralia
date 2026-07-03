@echo off
node "%~dp0git-shim.mjs" %*
exit /b %errorlevel%

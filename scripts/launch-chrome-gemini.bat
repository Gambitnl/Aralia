@echo off
echo Launching Chrome with Bobbenhouzer profile for Gemini automation...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --profile-directory="Profile 3" https://gemini.google.com/app
echo.
echo Chrome launched! You can now run the server:
echo   npx tsx scripts/gemini-browser-server.ts

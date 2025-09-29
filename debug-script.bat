@echo off
echo Starting debug session...
echo Make sure to run: npm run build (or your build command) first
echo.
node --inspect-brk=9229 ./threads-automation/dist-electron/automation/scenarios/postAndComment.js
pause

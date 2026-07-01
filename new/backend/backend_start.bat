@echo off
REM Helper to start backend from its own folder (used by START_POS.bat)
pushd "%~dp0" >nul 2>&1

echo Starting Vendora backend in this window...
node server.js

REM Keep window open if server exits
echo.
echo Backend process exited. Press any key to close.
pause >nul
popd

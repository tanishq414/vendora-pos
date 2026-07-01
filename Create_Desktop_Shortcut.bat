@echo off
setlocal enabledelayedexpansion

REM Create Desktop Shortcut for Vendora
REM This script creates a shortcut on the Desktop to launch Vendora

echo.
echo ========================================
echo   Vendora Desktop Shortcut Creator
echo ========================================
echo.

REM Get the full path of the current directory
for /f "delims=" %%A in ('cd') do set "VENDORAPATH=%%A"

REM Get the user's Desktop path
for /f "tokens=3" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v Desktop ^| findstr "Desktop"') do set "DESKTOP=%%A"

if not defined DESKTOP (
    echo ERROR: Could not find Desktop path
    pause
    exit /b 1
)

echo Creating shortcut on Desktop...
echo.

REM Create the VBScript that will make the shortcut
set "VBS_FILE=%TEMP%\create_shortcut.vbs"

(
    echo Set oWS = WScript.CreateObject("WScript.Shell"^)
    echo sLinkFile = "%DESKTOP%\Vendora.lnk"
    echo Set oLink = oWS.CreateShortcut(sLinkFile^)
    echo oLink.TargetPath = "%VENDORAPATH%\START_POS.bat"
    echo oLink.WorkingDirectory = "%VENDORAPATH%"
    echo oLink.Description = "Vendora - Point of Sale System"
    echo oLink.IconLocation = "%VENDORAPATH%\START_POS.bat",0
    echo oLink.Save
) > "%VBS_FILE%"

REM Run the VBScript
cscript "%VBS_FILE%"

REM Clean up
del "%VBS_FILE%"

echo.
echo ========================================
echo   Shortcut Created Successfully!
echo ========================================
echo.
echo Look for "Vendora" shortcut on your Desktop
echo Double-click it to start the POS system
echo.
pause

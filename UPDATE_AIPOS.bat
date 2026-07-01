@echo off
setlocal enabledelayedexpansion

REM Vendora Auto-Updater
REM This script checks for updates and installs the latest version

color 0A
title Vendora - Auto Updater

echo.
echo ========================================
echo   Vendora - Auto Updater
echo ========================================
echo.

REM Get current version
if exist version.txt (
    for /f "tokens=*" %%a in (version.txt) do set CURRENT_VERSION=%%a
) else (
    set CURRENT_VERSION=unknown
)

echo Current version: %CURRENT_VERSION%
echo.

REM Check if Git is installed (for automated updates)
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [INFO] Git not found - using manual update method
    echo.
    echo You have two options:
    echo.
    echo Option 1 - Install Git (recommended):
    echo   Download from: https://git-scm.com/download/win
    echo   Then run this updater again
    echo.
    echo Option 2 - Manual download:
    echo   1. Go to: https://github.com/your-repo/aipos
    echo   2. Click "Code" ^> "Download ZIP"
    echo   3. Extract to a new folder
    echo   4. Copy your pos.db file to the new folder
    echo   5. Delete the old folder and rename the new one
    echo.
    pause
    exit /b 1
)

echo [INFO] Checking for updates...
echo.

REM Fetch latest version info from GitHub
REM This assumes you have a releases API or a version file in a repo

REM Option 1: Using GitHub Releases API
REM Requires curl or PowerShell

where curl >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Using curl to check for updates...
    REM Example: curl -s https://api.github.com/repos/your-repo/aipos/releases/latest
    REM For now, we'll use a simpler approach with a version file
)

REM Option 2: Simple version check from a file
echo [INFO] Checking GitHub for latest version...

REM Create a temporary file to store update info
set TEMP_FILE=%TEMP%\vendora_update_check.txt

REM Use PowerShell to fetch the latest version (more reliable on Windows)
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/your-repo/aipos/main/version.txt' -UseBasicParsing -TimeoutSec 5; Write-Output $response.Content | Out-File -FilePath '%TEMP_FILE%' -Encoding UTF8 } catch { Write-Output 'error' | Out-File -FilePath '%TEMP_FILE%' }" >nul 2>&1

if %errorlevel% equ 0 (
    if exist %TEMP_FILE% (
        for /f "tokens=*" %%a in (%TEMP_FILE%) do set LATEST_VERSION=%%a
        del %TEMP_FILE%
    )
) else (
    echo.
    echo [ERROR] Could not check for updates (network issue?)
    echo.
    echo Make sure:
    echo - You have internet connection
    echo - Your firewall allows GitHub access
    echo.
    pause
    exit /b 1
)

if not defined LATEST_VERSION (
    set LATEST_VERSION=unknown
)

echo Latest version: %LATEST_VERSION%
echo.

REM Compare versions
if "%CURRENT_VERSION%"=="%LATEST_VERSION%" (
    echo [OK] You are already on the latest version!
    echo.
    pause
    exit /b 0
)

echo [INFO] Update available: %CURRENT_VERSION% ^-^> %LATEST_VERSION%
echo.

REM Ask user to confirm update
set /p CONFIRM="Do you want to update now? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Update cancelled.
    pause
    exit /b 0
)

echo.
echo [INFO] Starting update...
echo.

REM Backup current database
if exist pos.db (
    echo [INFO] Backing up database...
    set BACKUP_FILE=pos.db.backup.%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%
    copy pos.db "!BACKUP_FILE!" >nul
    echo [OK] Backup created: !BACKUP_FILE!
    echo.
)

REM Update from Git
echo [INFO] Downloading latest version from GitHub...
git fetch origin main
if %errorlevel% neq 0 (
    echo [ERROR] Failed to fetch updates
    pause
    exit /b 1
)

git reset --hard origin/main
if %errorlevel% neq 0 (
    echo [ERROR] Failed to apply updates
    echo Your database backup is safe: !BACKUP_FILE!
    pause
    exit /b 1
)

echo [OK] Update completed successfully!
echo.
echo [INFO] Installing any new dependencies...
call npm install >nul 2>&1

echo.
echo ========================================
echo   Update Complete!
echo ========================================
echo.
echo Changes installed:
echo - Latest features and fixes
echo - Updated database schema (if any)
echo.
echo Your data has been preserved.
echo.
echo Next steps:
echo 1. Click "START_POS.bat" to restart Vendora
echo 2. The app will apply any schema updates automatically
echo.
pause

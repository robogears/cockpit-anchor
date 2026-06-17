@echo off
REM Cockpit Anchor — double-click installer. Self-elevates to admin, then runs install.ps1.
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator permission...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause

@echo off
REM Cockpit Anchor — double-click uninstaller. Self-elevates to admin, then runs uninstall.ps1.
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator permission...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
powershell -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause

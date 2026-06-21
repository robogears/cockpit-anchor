@echo off
title Cockpit Anchor
cd /d "%~dp0"

if not exist "node_modules\electron" (
  echo First run - installing dependencies, this can take a minute...
  call npm install
)

echo Launching Cockpit Anchor...
call npm start

if errorlevel 1 (
  echo.
  echo Something went wrong above. Press any key to close.
  pause >nul
)

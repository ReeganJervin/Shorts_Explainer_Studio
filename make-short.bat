@echo off
cd /d "%~dp0"
if "%~1"=="" (
  echo.
  echo  Usage:  make-short.bat shorts\your-short.txt
  echo  Tip:    you can also drag a script file onto make-short.bat
  echo.
  pause & exit /b 1
)
node tools\make-short.js "%~f1"
echo.
pause

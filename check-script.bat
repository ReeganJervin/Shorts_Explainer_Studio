@echo off
cd /d "%~dp0"
if "%~1"=="" ( echo  Usage: check-script.bat shorts\your-short.txt & pause & exit /b 1 )
node tools\make-short.js "%~f1" --check
echo.
pause

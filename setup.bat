@echo off
setlocal
cd /d "%~dp0"
echo.
echo  ===== Shorts Explainer Studio setup (run once) =====
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed.
  echo  Install the LTS version from https://nodejs.org and run setup.bat again.
  pause & exit /b 1
)

set "PY="
for %%V in (3.12 3.13 3.11 3.10) do (
  if not defined PY (
    py -%%V -c "print()" >nul 2>nul && set "PY=py -%%V"
  )
)
if not defined PY (
  python -c "import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,13) else 1)" >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo  Python 3.10 - 3.13 is not installed.
  echo  Install Python 3.12 from https://www.python.org/downloads/
  echo  ^(tick "Add python.exe to PATH" during install^) and run setup.bat again.
  pause & exit /b 1
)
echo  Using Python: %PY%

echo.
echo  [1/3] Installing the video tools (Node packages)...
call npm install --no-audit --no-fund || goto :failed

echo.
echo  [2/3] Installing the voice tool (Python)...
if not exist ".venv\Scripts\python.exe" (
  %PY% -m venv .venv || goto :failed
)
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :failed

echo.
echo  [3/3] Downloading the voice model (about 120 MB, once)...
node tools\download-models.js || goto :failed

echo.
echo  ===== All set! =====
echo  Put a clip in the clips folder, copy shorts\_template.txt, then:
echo    make-short.bat shorts\your-short.txt
echo.
pause
exit /b 0

:failed
echo.
echo  Setup stopped because of the error above.
pause
exit /b 1

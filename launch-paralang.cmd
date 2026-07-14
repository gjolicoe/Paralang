@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launch-paralang.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
    echo Paralang launcher finished successfully.
) else (
    echo Paralang launcher failed with exit code %EXIT_CODE%.
)
echo Press any key to close this window.
pause >nul
exit /b %EXIT_CODE%

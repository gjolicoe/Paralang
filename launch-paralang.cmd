@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PYTHON_EXE="

cd /d "%SCRIPT_DIR%"

if exist "C:\Program Files\anaconda3\python.exe" (
    set "PYTHON_EXE=C:\Program Files\anaconda3\python.exe"
    goto python_found
)

if defined CONDA_PREFIX if exist "%CONDA_PREFIX%\python.exe" (
    set "PYTHON_EXE=%CONDA_PREFIX%\python.exe"
    goto python_found
)

where py.exe >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_EXE=py.exe"
    goto python_found
)

for /f "delims=" %%P in ('where python.exe 2^>nul ^| findstr /v /i "\WindowsApps\"') do (
    if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
)

if not defined PYTHON_EXE (
    echo Could not find a usable Python installation.
    echo The Microsoft Store Python alias is not sufficient.
    goto failed
)

:python_found
echo Using Python: %PYTHON_EXE%
echo Checking Paralang dependencies...
"%PYTHON_EXE%" -c "import flask, bs4" >nul 2>nul
if errorlevel 1 (
    echo Installing required packages...
    "%PYTHON_EXE%" -m pip install flask beautifulsoup4
    if errorlevel 1 (
        echo Could not install the required packages.
        goto failed
    )
)

if /i "%~1"=="--check" (
    echo Launcher check passed.
    exit /b 0
)

echo.
echo Starting Paralang...
echo Open http://127.0.0.1:5000 in your browser.
echo Keep this window open while using Paralang.
echo Press Ctrl+C to stop the application.
echo.

start "" "http://127.0.0.1:5000"
"%PYTHON_EXE%" "%SCRIPT_DIR%app.py"

if errorlevel 1 goto failed
echo.
echo Paralang has stopped.
pause
exit /b 0

:failed
echo.
echo Paralang could not start. Error code: %ERRORLEVEL%
echo Press any key to close this window.
pause >nul
exit /b 1

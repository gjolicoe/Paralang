@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PYTHON_EXE="

cd /d "%SCRIPT_DIR%"

if exist "C:\Program Files\anaconda3\python.exe" call :try_python "C:\Program Files\anaconda3\python.exe"
if defined PYTHON_EXE goto python_found

if defined CONDA_PREFIX if exist "%CONDA_PREFIX%\python.exe" call :try_python "%CONDA_PREFIX%\python.exe"
if defined PYTHON_EXE goto python_found

where py.exe >nul 2>nul
if not errorlevel 1 call :try_python "py.exe"
if defined PYTHON_EXE goto python_found

for /f "delims=" %%P in ('where python.exe 2^>nul ^| findstr /v /i "\WindowsApps\"') do (
    if not defined PYTHON_EXE call :try_python "%%P"
)

if not defined PYTHON_EXE (
    echo Could not run a usable Python installation.
    echo Python may be missing or blocked by workplace Group Policy.
    echo Ask IT to allow an installed python.exe, then run this launcher again.
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

:try_python
"%~1" -c "import sys" >nul 2>nul
if not errorlevel 1 set "PYTHON_EXE=%~1"
exit /b 0

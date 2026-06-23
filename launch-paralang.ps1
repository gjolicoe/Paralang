$ProjectDir = $PSScriptRoot
$PythonExe = "C:\Program Files\anaconda3\python.exe"

Set-Location $ProjectDir

& $PythonExe -c "import flask, bs4" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Required packages missing. Installing with Anaconda Python..."
    & $PythonExe -m pip install flask beautifulsoup4
}

Write-Host "Starting Paralang..."
& $PythonExe app.py
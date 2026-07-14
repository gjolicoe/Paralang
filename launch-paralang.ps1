$ProjectDir = $PSScriptRoot
$PreferredPythonExe = "C:\Program Files\anaconda3\python.exe"

Set-Location $ProjectDir

function Resolve-PythonExe {
    if (Test-Path $PreferredPythonExe) { return $PreferredPythonExe }
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) { return $pythonCmd.Source }
    $pyCmd = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCmd) { return "py" }
    return $null
}

$PythonExe = Resolve-PythonExe
if (-not $PythonExe) {
    Write-Host "Could not find Python. Install Python and try again." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Checking Paralang dependencies..."
& $PythonExe -c "import flask, bs4" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing required packages..."
    & $PythonExe -m pip install flask beautifulsoup4
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Could not install the required packages." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "Starting Paralang..."
$serverUrl = "http://127.0.0.1:5000"
$process = Start-Process -FilePath $PythonExe -ArgumentList "app.py" -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru

for ($i = 0; $i -lt 20; $i++) {
    if ($process.HasExited) {
        Write-Host "Paralang stopped before it could start." -ForegroundColor Red
        exit $process.ExitCode
    }
    try {
        $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { break }
    }
    catch {}
    Start-Sleep -Seconds 1
}

try { Start-Process $serverUrl }
catch { Write-Host "Open $serverUrl in your browser." -ForegroundColor Yellow }

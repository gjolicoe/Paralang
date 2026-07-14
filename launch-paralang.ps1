$ProjectDir = $PSScriptRoot
$PreferredPythonExe = "C:\Program Files\anaconda3\python.exe"

Set-Location $ProjectDir

function Resolve-PythonExe {
    if (Test-Path $PreferredPythonExe) { return $PreferredPythonExe }

    if ($env:CONDA_PREFIX) {
        $condaPython = Join-Path $env:CONDA_PREFIX "python.exe"
        if (Test-Path $condaPython) { return $condaPython }
    }

    $pyCmd = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCmd) { return $pyCmd.Source }

    $pythonCmd = Get-Command python -All -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notlike "*\WindowsApps\*" } |
        Select-Object -First 1
    if ($pythonCmd) { return $pythonCmd.Source }

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
$logDir = Join-Path $ProjectDir ".cache\launcher"
$stdoutLog = Join-Path $logDir "paralang.stdout.log"
$stderrLog = Join-Path $logDir "paralang.stderr.log"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
Remove-Item $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue

try {
    $process = Start-Process `
        -FilePath $PythonExe `
        -ArgumentList "app.py" `
        -WorkingDirectory $ProjectDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru
}
catch {
    Write-Host "Could not start Python: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$serverReady = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            break
        }
    }
    catch {}

    if ($process.HasExited) { break }
    Start-Sleep -Seconds 1
}

if (-not $serverReady) {
    Write-Host "Paralang could not start." -ForegroundColor Red
    if (Test-Path $stderrLog) {
        $details = Get-Content $stderrLog -Raw
        if ($details) {
            Write-Host ""
            Write-Host $details.Trim()
        }
    }
    Write-Host ""
    Write-Host "Diagnostic log: $stderrLog"
    exit 1
}

try { Start-Process $serverUrl }
catch { Write-Host "Open $serverUrl in your browser." -ForegroundColor Yellow }

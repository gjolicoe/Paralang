$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuildPython = Join-Path $ProjectRoot ".build-venv\Scripts\python.exe"
$Requirements = Join-Path $ProjectRoot "requirements.txt"
$DownloadStage = Join-Path $ProjectRoot ".vendor-download"
$VendorWheels = Join-Path $ProjectRoot "vendor-wheels"

if (-not (Test-Path -LiteralPath $BuildPython -PathType Leaf)) {
    throw "Build Python was not found at $BuildPython. Create .build-venv first."
}

if (Test-Path -LiteralPath $DownloadStage) {
    Remove-Item -LiteralPath $DownloadStage -Recurse -Force
}
New-Item -ItemType Directory -Path $DownloadStage | Out-Null

& $BuildPython -m pip download `
    --only-binary=:all: `
    --destination-directory $DownloadStage `
    --requirement $Requirements

if ($LASTEXITCODE -ne 0) {
    throw "Downloading Python dependency archives failed."
}

if (-not (Test-Path -LiteralPath $VendorWheels)) {
    New-Item -ItemType Directory -Path $VendorWheels | Out-Null
}
Get-ChildItem -LiteralPath $VendorWheels -File -Filter "*.whl" |
    Remove-Item -Force
Get-ChildItem -LiteralPath $DownloadStage -File -Filter "*.whl" |
    Copy-Item -Destination $VendorWheels
$PrepareWheels = Join-Path $ProjectRoot "tools\prepare_vendor_wheels.py"
& $BuildPython $PrepareWheels $VendorWheels
if ($LASTEXITCODE -ne 0) {
    throw "Preparing dependency archives for direct imports failed."
}
Remove-Item -LiteralPath $DownloadStage -Recurse -Force

Write-Host "Bundled dependency archives refreshed at: $VendorWheels"

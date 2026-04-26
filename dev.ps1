$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $repoRoot "backend"
$frontendPath = Join-Path $repoRoot "frontend"
$frontendPackageJson = Join-Path $frontendPath "package.json"

Write-Host ""
Write-Host "CognitoBIZ dev launcher" -ForegroundColor Cyan
Write-Host "Devs: kimo, caleb, satya" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $backendPath)) {
    throw "Backend folder not found at $backendPath"
}

Write-Host "Starting backend on http://localhost:5000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$backendPath'; python -m uvicorn app.main:app --host 127.0.0.1 --port 5000"
)

if (Test-Path $frontendPackageJson) {
    Write-Host "Starting frontend with npm run dev ..." -ForegroundColor Green
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$frontendPath'; npm.cmd run dev"
    )
}
else {
    Write-Host "Skipping frontend start: no package.json found in /frontend." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "Dev processes launched in new PowerShell windows." -ForegroundColor Cyan

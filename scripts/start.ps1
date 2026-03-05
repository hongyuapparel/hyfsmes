# Hongyu ERP - Start backend and frontend (use this script only)
# Usage: .\scripts\start.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot + "\.."
$BackendDir = $ProjectRoot + "\backend"
$FrontendDir = $ProjectRoot + "\frontend"

if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
    Write-Host "ERROR: backend\.env not found. Copy backend\.env.example to backend\.env and configure." -ForegroundColor Red
    exit 1
}

$BackendPort = 3000
$FrontendPort = 5173

function Test-PortFree {
    param ([int]$Port)
    $null -eq (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue)
}

# If port in use, run stop.ps1 once and wait, then re-check
$backendInUse = -not (Test-PortFree $BackendPort)
$frontendInUse = -not (Test-PortFree $FrontendPort)
if ($backendInUse -or $frontendInUse) {
    Write-Host "Port(s) in use. Running stop.ps1..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "stop.ps1")
    Start-Sleep -Seconds 3
    $backendInUse = -not (Test-PortFree $BackendPort)
    $frontendInUse = -not (Test-PortFree $FrontendPort)
}
if ($backendInUse) {
    Write-Host ("ERROR: Port " + $BackendPort + " still in use. Close the process manually or restart PC.") -ForegroundColor Red
    exit 1
}
if ($frontendInUse) {
    Write-Host ("ERROR: Port " + $FrontendPort + " still in use. Close the process manually or restart PC.") -ForegroundColor Red
    exit 1
}

Write-Host ("Starting backend (port " + $BackendPort + ") and frontend (port " + $FrontendPort + ")...") -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; npm run start:dev"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm run dev"
Write-Host "Done. Two windows opened. Run scripts\check.ps1 to verify." -ForegroundColor Green
Write-Host "Tip: Code changes auto-reload; only restart when changing .env or deps. Use scripts\restart.ps1 to restart." -ForegroundColor Gray

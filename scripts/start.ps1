# Hongyu ERP - Start backend and frontend (use this script only)
# Usage: .\scripts\start.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BackendDir = $ProjectRoot + "\backend"
$FrontendDir = $ProjectRoot + "\frontend"
$BackendLog = Join-Path $ProjectRoot ".codex-backend-3000.log"
$BackendErrLog = Join-Path $ProjectRoot ".codex-backend-3000.err.log"
$FrontendLog = Join-Path $ProjectRoot ".codex-frontend-5173.log"
$FrontendErrLog = Join-Path $ProjectRoot ".codex-frontend-5173.err.log"

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

function Start-DetachedNpm {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$StdoutLog,
        [Parameter(Mandatory = $true)]
        [string]$StderrLog
    )

    if (-not (Test-Path $StdoutLog)) {
        New-Item -ItemType File -Path $StdoutLog -Force | Out-Null
    }
    if (-not (Test-Path $StderrLog)) {
        New-Item -ItemType File -Path $StderrLog -Force | Out-Null
    }

    $command = "npm.cmd $Arguments >> `"$StdoutLog`" 2>> `"$StderrLog`""
    $cmdArgs = "/d /s /c `"$command`""
    Start-Process -FilePath $env:ComSpec -ArgumentList $cmdArgs -WorkingDirectory $WorkingDirectory -WindowStyle Hidden | Out-Null
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
Start-DetachedNpm -WorkingDirectory $BackendDir -Arguments 'run start:dev' -StdoutLog $BackendLog -StderrLog $BackendErrLog
Start-Sleep -Seconds 2
Start-DetachedNpm -WorkingDirectory $FrontendDir -Arguments 'run dev' -StdoutLog $FrontendLog -StderrLog $FrontendErrLog
Write-Host "Done. Services started with hidden windows. Run scripts\check.ps1 to verify." -ForegroundColor Green
Write-Host ("Logs: " + $BackendLog + ", " + $FrontendLog) -ForegroundColor Gray
Write-Host "Tip: Code changes auto-reload; only restart when changing .env or deps. Use scripts\restart.ps1 to restart." -ForegroundColor Gray

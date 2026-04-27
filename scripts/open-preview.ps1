# Hongyu ERP - One-click restart and open local preview
# Usage: .\scripts\open-preview.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot + "\.."
$BackendDir = $ProjectRoot + "\backend"
$FrontendDir = $ProjectRoot + "\frontend"
$BackendPort = 3000
$FrontendPort = 5173

if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
    Write-Host "ERROR: backend\\.env not found. Copy backend\\.env.example to backend\\.env and configure it first." -ForegroundColor Red
    exit 1
}

$npmCmd = (Get-Command npm.cmd).Source

function Test-PortUp {
    param([int]$Port, [string]$Url = $null)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if (-not $conn) { return $false }
    if ($Url) {
        try {
            $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            return ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500)
        } catch {
            return $false
        }
    }
    return $true
}

function Start-HiddenNpm {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$Arguments
    )

    Start-Process -WindowStyle Hidden -FilePath $npmCmd -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory | Out-Null
}

Write-Host "Stopping any existing backend/frontend processes..." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "stop.ps1")
Start-Sleep -Seconds 2

Write-Host "Starting backend and frontend in hidden windows..." -ForegroundColor Green
Start-HiddenNpm -WorkingDirectory $BackendDir -Arguments 'run start:dev'
Start-Sleep -Seconds 2
Start-HiddenNpm -WorkingDirectory $FrontendDir -Arguments 'run dev'

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    $backendUp = Test-PortUp -Port $BackendPort -Url ("http://127.0.0.1:$BackendPort/health")
    $frontendUp = Test-PortUp -Port $FrontendPort -Url ("http://127.0.0.1:$FrontendPort/")
    if ($backendUp -and $frontendUp) {
        Write-Host "Backend and frontend are up." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
}

if (-not (Test-PortUp -Port $BackendPort -Url ("http://127.0.0.1:$BackendPort/health"))) {
    Write-Host "ERROR: backend did not become ready on port 3000." -ForegroundColor Red
    exit 1
}

if (-not (Test-PortUp -Port $FrontendPort -Url ("http://127.0.0.1:$FrontendPort/"))) {
    Write-Host "ERROR: frontend did not become ready on port 5173." -ForegroundColor Red
    exit 1
}

Start-Process "http://localhost:5173/" | Out-Null
Write-Host "Opened preview at http://localhost:5173/" -ForegroundColor Green

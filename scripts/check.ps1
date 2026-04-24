# Hongyu ERP - Check backend / frontend / db status
# Usage: .\scripts\check.ps1

$ErrorActionPreference = "SilentlyContinue"
$BackendPort = 3000
$FrontendPort = 5173
$BackendBase = "http://127.0.0.1:" + $BackendPort
$ProjectRoot = $PSScriptRoot + "\.."
$BackendDir = $ProjectRoot + "\backend"

$allOk = $true

if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
    Write-Host "FAIL: backend\.env missing. Copy from .env.example and configure." -ForegroundColor Red
    $allOk = $false
} else {
    Write-Host "OK: backend\.env exists" -ForegroundColor Green
}

$backendConn = Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue
if (-not $backendConn) {
    Write-Host ("WARN: Backend port " + $BackendPort + " not visible from this shell. Will verify via /health instead.") -ForegroundColor Yellow
} else {
    Write-Host ("OK: Port " + $BackendPort + " in use (backend)") -ForegroundColor Green
}

try {
    $r = Invoke-WebRequest -Uri ($BackendBase + "/health") -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) {
        Write-Host "OK: GET /health returns 200" -ForegroundColor Green
    } else {
        Write-Host ("FAIL: GET /health returns " + $r.StatusCode) -ForegroundColor Red
        $allOk = $false
    }
} catch {
    Write-Host ("FAIL: GET /health error: " + $_.Exception.Message) -ForegroundColor Red
    $allOk = $false
}

try {
    $r = Invoke-WebRequest -Uri ($BackendBase + "/health/db") -UseBasicParsing -TimeoutSec 3
    $json = $r.Content | ConvertFrom-Json
    if ($json.status -eq "ok" -and $json.db -eq "connected") {
        Write-Host "OK: GET /health/db database connected" -ForegroundColor Green
    } else {
        Write-Host ("FAIL: GET /health/db: " + $r.Content) -ForegroundColor Red
        $allOk = $false
    }
} catch {
    Write-Host ("FAIL: GET /health/db error: " + $_.Exception.Message) -ForegroundColor Red
    $allOk = $false
}

$frontendConn = Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue
if (-not $frontendConn) {
    Write-Host ("WARN: Frontend port " + $FrontendPort + " not visible from this shell. Will verify via HTTP page check instead.") -ForegroundColor Yellow
} else {
    Write-Host ("OK: Port " + $FrontendPort + " in use (frontend)") -ForegroundColor Green
}

try {
    $r = Invoke-WebRequest -Uri ("http://127.0.0.1:" + $FrontendPort + "/") -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) {
        Write-Host ("OK: Frontend page http://127.0.0.1:" + $FrontendPort + "/") -ForegroundColor Green
    } else {
        Write-Host ("WARN: Frontend returned " + $r.StatusCode) -ForegroundColor Yellow
    }
} catch {
    Write-Host ("FAIL: Frontend request error: " + $_.Exception.Message) -ForegroundColor Red
    $allOk = $false
}

Write-Host ""
if ($allOk) {
    Write-Host "db / backend / frontend all OK." -ForegroundColor Green
} else {
    Write-Host "Some checks failed. Fix .env or port issues as above." -ForegroundColor Yellow
    exit 1
}

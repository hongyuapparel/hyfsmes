# Hongyu ERP - Restart backend and frontend (stop then start, avoid port stuck)
# Usage: .\scripts\restart.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot + "\.."

Write-Host "Stopping backend and frontend..." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "stop.ps1")
Start-Sleep -Seconds 3
Write-Host "Starting backend and frontend..." -ForegroundColor Green
& (Join-Path $PSScriptRoot "start.ps1")

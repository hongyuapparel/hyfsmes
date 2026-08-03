# Hongyu ERP - Stop backend and frontend by port
# Usage: .\scripts\stop.ps1

$BackendPort = 3000
$FrontendPort = 5173
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LogDir = Join-Path $ProjectRoot "logs"
$BackendPidFile = Join-Path $LogDir "backend-3000.pid"
$FrontendPidFile = Join-Path $LogDir "frontend-5173.pid"

function Stop-TrackedProcessTree {
    param ([string]$PidFile, [string]$Label)
    if (-not (Test-Path -LiteralPath $PidFile)) { return }
    $rawPid = (Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $trackedPid = 0
    if ([int]::TryParse([string]$rawPid, [ref]$trackedPid) -and $trackedPid -gt 0) {
        $process = Get-Process -Id $trackedPid -ErrorAction SilentlyContinue
        if ($process) {
            $null = cmd /c "taskkill /F /T /PID $trackedPid 2>nul"
            Write-Host ("Stopped tracked " + $Label + " process tree PID " + $trackedPid) -ForegroundColor Yellow
        }
    }
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-ProcessOnPort {
    param ([int]$Port)
    for ($retry = 0; $retry -lt 2; $retry++) {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if (-not $conn) {
            if ($retry -eq 0) { Write-Host ("Port " + $Port + " not in use.") -ForegroundColor Gray }
            return
        }
        $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -and $_ -ne 0 }
        if (-not $pids) {
            Write-Host ("Port " + $Port + " Listen but no valid PID. Wait a few seconds and try start again.") -ForegroundColor Yellow
            return
        }
        foreach ($procId in $pids) {
            try {
                # Kill process tree so child processes (e.g. node) release the port
                $null = cmd /c "taskkill /F /T /PID $procId 2>nul"
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host ("Stopped port " + $Port + " process PID " + $procId) -ForegroundColor Yellow
            } catch {
                Write-Host ("WARN: Could not stop PID " + $procId + " : " + $_) -ForegroundColor Yellow
            }
        }
        Start-Sleep -Seconds 2
    }
    $still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        Write-Host ("Port " + $Port + " may still be in use. Wait 5s and run start.ps1 again, or restart PC.") -ForegroundColor Yellow
    }
}

Stop-TrackedProcessTree -PidFile $BackendPidFile -Label "backend"
Stop-TrackedProcessTree -PidFile $FrontendPidFile -Label "frontend"
Start-Sleep -Seconds 1
Stop-ProcessOnPort -Port $BackendPort
Stop-ProcessOnPort -Port $FrontendPort
Write-Host "Done." -ForegroundColor Green

# Hongyu ERP - Stop backend and frontend by port
# Usage: .\scripts\stop.ps1

$BackendPort = 3000
$FrontendPort = 5173

function Stop-ProcessOnPort {
    param ([int]$Port)
    for ($retry = 0; $retry -lt 2; $retry++) {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if (-not $conn) {
            if ($retry -eq 0) { Write-Host ("Port " + $Port + " not in use.") -ForegroundColor Gray }
            return
        }
        $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -and $_ -ne 0 }
        if (-not $pids) {
            Write-Host ("Port " + $Port + " in use but no valid PID (e.g. OwningProcess=0). Wait a few seconds and try start again.") -ForegroundColor Yellow
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
    $still = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($still) {
        Write-Host ("Port " + $Port + " may still be in use. Wait 5s and run start.ps1 again, or restart PC.") -ForegroundColor Yellow
    }
}

Stop-ProcessOnPort -Port $BackendPort
Stop-ProcessOnPort -Port $FrontendPort
Write-Host "Done." -ForegroundColor Green

---
name: open-preview
description: Restart hyfsmes ERP backend on :3000 + frontend on :5173 with hidden windows, wait until both are healthy, and open the preview page in the browser. Use when the user asks to "打开预览 / open preview", "重启看看 / restart and check", "截图 / screenshot the page", verify a UI change visually, or bring services up after `git pull`. Always go through this skill — never spawn visible console windows or run `npm run dev` directly.
---

# Hongyu ERP — Open Preview

This skill is fully self-contained. Don't look for a wrapper `.ps1` — execute the steps below in order.

## Steps

### 1. Restart services (hidden windows)

Always use the project's restart script — it stops + starts both nest and vite with hidden windows per `CLAUDE.md`:

```powershell
& "scripts/restart.ps1"
```

Do **not** open visible PowerShell / CMD windows, and do **not** run `npm run dev` / `npm run start:dev` directly.

### 2. Wait for backend health (max 120s)

```powershell
$deadline = (Get-Date).AddSeconds(120)
$backendOk = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:3000/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $backendOk = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $backendOk) { throw "Backend not ready at http://127.0.0.1:3000/health within 120s" }
```

### 3. Wait for frontend (max 120s)

```powershell
$deadline = (Get-Date).AddSeconds(120)
$frontendOk = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $frontendOk = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $frontendOk) { throw "Frontend not ready at http://127.0.0.1:5173/ within 120s" }
```

### 4. Open the preview page

```powershell
Start-Process "http://127.0.0.1:5173/"
```

## Skip restart if already healthy

If both URLs already respond before step 1, skip `restart.ps1` and just go to step 4 — no point in restarting healthy services.

```powershell
$backendOk = $false; $frontendOk = $false
try { $r = Invoke-WebRequest "http://127.0.0.1:3000/health" -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -lt 400) { $backendOk = $true } } catch {}
try { $r = Invoke-WebRequest "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -lt 400) { $frontendOk = $true } } catch {}
if ($backendOk -and $frontendOk) {
  Start-Process "http://127.0.0.1:5173/"
} else {
  # run steps 1 → 4
}
```

## After it opens

- Backend log: `.codex-backend-3000.log`
- Frontend log: `.codex-frontend-5173.log`
- If anything's wrong, the user has `scripts/check.ps1` for a health check summary.

## Related scripts (still in `scripts/`)

- `start.ps1` — start only, no health wait
- `restart.ps1` — stop + start (called by this skill)
- `stop.ps1` — stop both
- `check.ps1` — health summary

These are project tools usable from any shell (Cursor / Codex / human). This skill is the Claude Code bundled version that also waits + opens the page.

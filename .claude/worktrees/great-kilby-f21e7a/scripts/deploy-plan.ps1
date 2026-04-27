param(
    [string]$BaseRef = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Set-Location $ProjectRoot

function Get-ChangedFiles {
    param([string]$Ref)

    $files = New-Object System.Collections.Generic.HashSet[string]

    if ($Ref) {
        git rev-parse --verify $Ref *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "BaseRef '$Ref' not found. Please use a valid git commit, tag, or branch."
        }

        $diffRange = $Ref + "..HEAD"
        $tracked = git diff --name-only $diffRange
        foreach ($file in $tracked) {
            if ($file) { [void]$files.Add($file.Trim()) }
        }
    } else {
        $tracked = git diff --name-only HEAD
        foreach ($file in $tracked) {
            if ($file) { [void]$files.Add($file.Trim()) }
        }
    }

    $untracked = git ls-files --others --exclude-standard
    foreach ($file in $untracked) {
        if ($file) { [void]$files.Add($file.Trim()) }
    }

    return @($files | Sort-Object)
}

function Test-AnyMatch {
    param(
        [string[]]$Files,
        [string[]]$Patterns
    )

    foreach ($file in $Files) {
        foreach ($pattern in $Patterns) {
            if ($file -like $pattern) {
                return $true
            }
        }
    }
    return $false
}

$changedFiles = Get-ChangedFiles -Ref $BaseRef

if (-not $changedFiles.Count) {
    Write-Host "No deployable code changes detected." -ForegroundColor Yellow
    Write-Host "If you already committed and pushed, run again with -BaseRef to compare from the previous deploy point."
    exit 0
}

$frontendChanged = Test-AnyMatch -Files $changedFiles -Patterns @(
    "frontend/*"
)

$backendChanged = Test-AnyMatch -Files $changedFiles -Patterns @(
    "backend/*"
)

$dbChanged = Test-AnyMatch -Files $changedFiles -Patterns @(
    "backend/src/entities/*",
    "backend/src/database/*",
    "backend/src/migrations/*",
    "backend/scripts/*.sql",
    "backend/**/*.sql"
)

$deployType = "unknown"
if ($frontendChanged -and $backendChanged) {
    $deployType = "full"
} elseif ($frontendChanged) {
    $deployType = "frontend"
} elseif ($backendChanged) {
    $deployType = "backend"
}

Write-Host ""
Write-Host "Changed files:" -ForegroundColor Cyan
foreach ($file in $changedFiles) {
    Write-Host ("- " + $file)
}

Write-Host ""
Write-Host ("frontend changed : " + ($(if ($frontendChanged) { "YES" } else { "NO" }))) -ForegroundColor $(if ($frontendChanged) { "Green" } else { "DarkGray" })
Write-Host ("backend changed  : " + ($(if ($backendChanged) { "YES" } else { "NO" }))) -ForegroundColor $(if ($backendChanged) { "Green" } else { "DarkGray" })
Write-Host ("db changed       : " + ($(if ($dbChanged) { "YES" } else { "NO" }))) -ForegroundColor $(if ($dbChanged) { "Yellow" } else { "DarkGray" })

Write-Host ""
switch ($deployType) {
    "frontend" {
        Write-Host "Recommended deploy script: scripts/deploy-frontend.sh" -ForegroundColor Green
    }
    "backend" {
        Write-Host "Recommended deploy script: scripts/deploy-backend.sh" -ForegroundColor Green
    }
    "full" {
        Write-Host "Recommended deploy script: scripts/deploy-full.sh" -ForegroundColor Green
    }
    default {
        Write-Host "Could not classify the changes automatically. Please review manually." -ForegroundColor Yellow
    }
}

if ($dbChanged) {
    Write-Host ""
    Write-Host "Warning: possible database schema related changes detected." -ForegroundColor Yellow
    Write-Host "Review SQL or migration steps before deploying backend changes."
}

Write-Host ""
Write-Host "Suggestion: ask Codex to review whether DB work is really required before deployment." -ForegroundColor Cyan

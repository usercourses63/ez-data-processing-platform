# Complete Task-Orchestrator Uninstallation Script
# Run this to remove all Java and task-orchestrator installations

$ErrorActionPreference = "Continue"

Write-Host "=" -NoNewline -ForegroundColor Red
Write-Host ("=" * 79) -ForegroundColor Red
Write-Host "Complete Task-Orchestrator Uninstallation" -ForegroundColor Red
Write-Host "=" -NoNewline -ForegroundColor Red
Write-Host ("=" * 79) -ForegroundColor Red
Write-Host ""

# Kill any running Java processes
Write-Host "[1/6] Stopping Java processes..." -ForegroundColor Yellow
Get-Process -Name "java" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "javaw" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Processes stopped" -ForegroundColor Green

# Remove Java directory
Write-Host "[2/6] Removing Java..." -ForegroundColor Yellow
if (Test-Path "C:\Java") {
    Remove-Item -Path "C:\Java" -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path "C:\Java") {
        Write-Host "  WARNING: Could not remove C:\Java (files may be in use)" -ForegroundColor Yellow
        Write-Host "  Scheduling for removal on reboot..." -ForegroundColor Yellow
        $null = cmd /c "rd /s /q C:\Java" 2>&1
    } else {
        Write-Host "  Java removed" -ForegroundColor Green
    }
} else {
    Write-Host "  Java already removed" -ForegroundColor Green
}

# Remove MCP-Servers
Write-Host "[3/6] Removing MCP-Servers..." -ForegroundColor Yellow
if (Test-Path "C:\MCP-Servers") {
    Remove-Item -Path "C:\MCP-Servers" -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path "C:\MCP-Servers") {
        Write-Host "  WARNING: Could not remove C:\MCP-Servers (files may be in use)" -ForegroundColor Yellow
    } else {
        Write-Host "  MCP-Servers removed" -ForegroundColor Green
    }
} else {
    Write-Host "  MCP-Servers already removed" -ForegroundColor Green
}

# Remove task-orchestrator repository
Write-Host "[4/6] Removing task-orchestrator repository..." -ForegroundColor Yellow
if (Test-Path "C:\Users\UserC\task-orchestrator") {
    Remove-Item -Path "C:\Users\UserC\task-orchestrator" -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path "C:\Users\UserC\task-orchestrator") {
        Write-Host "  WARNING: Could not remove repository (files may be in use)" -ForegroundColor Yellow
    } else {
        Write-Host "  Repository removed" -ForegroundColor Green
    }
} else {
    Write-Host "  Repository already removed" -ForegroundColor Green
}

# Remove MCP configuration
Write-Host "[5/6] Removing MCP configuration..." -ForegroundColor Yellow
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
if (Test-Path $configPath) {
    Remove-Item -Path $configPath -Force -ErrorAction SilentlyContinue
    Write-Host "  MCP config removed" -ForegroundColor Green
} else {
    Write-Host "  MCP config already removed" -ForegroundColor Green
}

# Remove Gradle cache
Write-Host "[6/6] Removing Gradle cache..." -ForegroundColor Yellow
if (Test-Path "C:\Users\UserC\.gradle") {
    Remove-Item -Path "C:\Users\UserC\.gradle" -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path "C:\Users\UserC\.gradle") {
        Write-Host "  WARNING: Could not remove Gradle cache" -ForegroundColor Yellow
    } else {
        Write-Host "  Gradle cache removed" -ForegroundColor Green
    }
} else {
    Write-Host "  Gradle cache already removed" -ForegroundColor Green
}

# Clean up temp files
Write-Host ""
Write-Host "Cleaning temporary files..." -ForegroundColor Yellow
Remove-Item -Path "$env:TEMP\openjdk*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\Downloads\openjdk*.zip" -Force -ErrorAction SilentlyContinue
Write-Host "  Temp files cleaned" -ForegroundColor Green

# Final verification
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "Verification Report" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

$allClean = $true

Write-Host "Java (C:\Java): " -NoNewline
if (Test-Path "C:\Java") {
    Write-Host "STILL EXISTS" -ForegroundColor Yellow
    $allClean = $false
} else {
    Write-Host "REMOVED" -ForegroundColor Green
}

Write-Host "MCP-Servers (C:\MCP-Servers): " -NoNewline
if (Test-Path "C:\MCP-Servers") {
    Write-Host "STILL EXISTS" -ForegroundColor Yellow
    $allClean = $false
} else {
    Write-Host "REMOVED" -ForegroundColor Green
}

Write-Host "Repository (C:\Users\UserC\task-orchestrator): " -NoNewline
if (Test-Path "C:\Users\UserC\task-orchestrator") {
    Write-Host "STILL EXISTS" -ForegroundColor Yellow
    $allClean = $false
} else {
    Write-Host "REMOVED" -ForegroundColor Green
}

Write-Host "MCP Config: " -NoNewline
if (Test-Path $configPath) {
    Write-Host "STILL EXISTS" -ForegroundColor Yellow
    $allClean = $false
} else {
    Write-Host "REMOVED" -ForegroundColor Green
}

Write-Host "Gradle Cache: " -NoNewline
if (Test-Path "C:\Users\UserC\.gradle") {
    Write-Host "STILL EXISTS" -ForegroundColor Yellow
    $allClean = $false
} else {
    Write-Host "REMOVED" -ForegroundColor Green
}

Write-Host ""
if ($allClean) {
    Write-Host "STATUS: Complete uninstallation successful!" -ForegroundColor Green
} else {
    Write-Host "STATUS: Some files could not be removed (may be in use)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SOLUTION:" -ForegroundColor Cyan
    Write-Host "  1. Close all applications (especially Claude Code, IDEs)" -ForegroundColor White
    Write-Host "  2. Run this script again" -ForegroundColor White
    Write-Host "  3. Or restart your computer and run this script" -ForegroundColor White
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Red
Write-Host ("=" * 79) -ForegroundColor Red
Write-Host ""

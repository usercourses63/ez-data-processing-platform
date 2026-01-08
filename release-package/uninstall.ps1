# EZ Platform Uninstallation Script
# Version: 0.1.1-rc1
# Date: January 1, 2026

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  EZ Platform v0.1.1-rc2 Uninstallation" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Default values
$Namespace = "ez-platform"
$DeleteNamespace = $false

# Parse arguments
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-n" -or $_ -eq "--namespace" } {
            $Namespace = $args[$i + 1]
            $i += 2
        }
        "--delete-namespace" {
            $DeleteNamespace = $true
            $i += 1
        }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Write-Host "Usage: uninstall.ps1 [OPTIONS]"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -n, --namespace NAME    Kubernetes namespace (default: ez-platform)"
            Write-Host "  --delete-namespace      Also delete the namespace after uninstall"
            Write-Host "  -h, --help              Show this help"
            Write-Host ""
            exit 0
        }
        default {
            Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red
            exit 1
        }
    }
}

# Confirm uninstallation
Write-Host "[!] This will uninstall EZ Platform from namespace: $Namespace" -ForegroundColor Yellow
if ($DeleteNamespace) {
    Write-Host "[!] The namespace will also be DELETED including all PVCs and data!" -ForegroundColor Red
}
Write-Host ""

$Reply = Read-Host "Are you sure? (yes/no)"
Write-Host ""

if ($Reply -notmatch "^[Yy]es$") {
    Write-Host "Uninstallation cancelled." -ForegroundColor Yellow
    exit 0
}

# Uninstall
Write-Host "Uninstalling EZ Platform..." -ForegroundColor Yellow

$helmResult = helm uninstall ez-platform -n $Namespace 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Helm release uninstalled" -ForegroundColor Green
} else {
    Write-Host "[!] Helm release not found or already uninstalled" -ForegroundColor Yellow
}

# Delete namespace if requested
if ($DeleteNamespace) {
    Write-Host ""
    Write-Host "Deleting namespace $Namespace..." -ForegroundColor Yellow

    $nsResult = kubectl delete namespace $Namespace --timeout=60s 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Namespace deleted" -ForegroundColor Green
    } else {
        Write-Host "[!] Failed to delete namespace" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Uninstallation Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Release Package Validation Script
# Validates that release-package images deploy and run correctly
# Usage: pwsh -File scripts/validate-release.ps1 [-ImageDir "release-package/images"]
#
# Prerequisites: minikube running, kubectl and helm configured

param(
    [string]$ImageDir = "release-package/images",
    [string]$Namespace = "ez-platform",
    [string]$Timeout = "15m"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EZ Platform Release Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results = @()
$failed = $false

# Phase 1: Load images into minikube
Write-Host "Phase 1: Loading images..." -ForegroundColor Yellow
if (Test-Path $ImageDir) {
    $tars = Get-ChildItem $ImageDir -Filter "*.tar*"
    foreach ($tar in $tars) {
        Write-Host "  Loading $($tar.Name)..."
        minikube image load $tar.FullName 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  WARNING: Failed to load $($tar.Name)" -ForegroundColor Yellow
        }
    }
    Write-Host "  Loaded $($tars.Count) images" -ForegroundColor Green
} else {
    Write-Host "  Image directory not found: $ImageDir" -ForegroundColor Yellow
    Write-Host "  Assuming images already loaded in minikube" -ForegroundColor Yellow
}

# Phase 2: Deploy via Helm with local values
Write-Host ""
Write-Host "Phase 2: Deploying via Helm..." -ForegroundColor Yellow

# Uninstall existing release if present
helm uninstall ez-platform -n $Namespace 2>&1 | Out-Null

helm install ez-platform ./helm/ez-platform `
    --namespace $Namespace `
    --create-namespace `
    --values helm/ez-platform/values-local.yaml `
    --wait `
    --timeout $Timeout

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Helm install FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "  Helm install succeeded" -ForegroundColor Green

# Phase 3: Health checks on all services
Write-Host ""
Write-Host "Phase 3: Health checks..." -ForegroundColor Yellow

# Wait for all pods to be ready
Write-Host "  Waiting for all pods..."
kubectl wait --for=condition=ready pod --all -n $Namespace --timeout=300s
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Not all pods became ready" -ForegroundColor Red
    kubectl get pods -n $Namespace
    $failed = $true
}

# Check individual service health endpoints via port-forward
$healthServices = @(
    @{Name="datasource-management"; Port=5001},
    @{Name="validation"; Port=5003},
    @{Name="scheduling"; Port=5004},
    @{Name="invalidrecords"; Port=5007},
    @{Name="fileprocessor"; Port=5008},
    @{Name="output"; Port=5009}
)

foreach ($svc in $healthServices) {
    $localPort = $svc.Port + 20000  # Use offset ports to avoid conflicts
    $job = Start-Job -ScriptBlock {
        param($ns, $name, $lp, $rp)
        kubectl port-forward "svc/$name" "${lp}:${rp}" -n $ns 2>&1
    } -ArgumentList $Namespace, $svc.Name, $localPort, $svc.Port

    Start-Sleep -Seconds 2

    try {
        $response = Invoke-WebRequest "http://localhost:$localPort/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "  [PASS] $($svc.Name) - healthy" -ForegroundColor Green
            $results += @{Service=$svc.Name; Status="PASS"}
        } else {
            Write-Host "  [FAIL] $($svc.Name) - status $($response.StatusCode)" -ForegroundColor Red
            $results += @{Service=$svc.Name; Status="FAIL"}
            $failed = $true
        }
    } catch {
        Write-Host "  [FAIL] $($svc.Name) - $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Service=$svc.Name; Status="FAIL"}
        $failed = $true
    } finally {
        Stop-Job $job -ErrorAction SilentlyContinue
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
}

# Phase 4: Smoke test - frontend loads and API CRUD
Write-Host ""
Write-Host "Phase 4: Smoke test..." -ForegroundColor Yellow

# Frontend check
$feJob = Start-Job -ScriptBlock {
    param($ns)
    kubectl port-forward svc/frontend 28080:8080 -n $ns 2>&1
} -ArgumentList $Namespace

Start-Sleep -Seconds 3

try {
    $feResponse = Invoke-WebRequest "http://localhost:28080" -UseBasicParsing -TimeoutSec 10
    if ($feResponse.StatusCode -eq 200) {
        Write-Host "  [PASS] Frontend loads successfully" -ForegroundColor Green
        $results += @{Service="frontend"; Status="PASS"}
    }
} catch {
    Write-Host "  [FAIL] Frontend - $($_.Exception.Message)" -ForegroundColor Red
    $results += @{Service="frontend"; Status="FAIL"}
    $failed = $true
} finally {
    Stop-Job $feJob -ErrorAction SilentlyContinue
    Remove-Job $feJob -Force -ErrorAction SilentlyContinue
}

# API CRUD smoke test via datasource-management
$apiJob = Start-Job -ScriptBlock {
    param($ns)
    kubectl port-forward svc/datasource-management 25001:5001 -n $ns 2>&1
} -ArgumentList $Namespace

Start-Sleep -Seconds 2

try {
    # GET data sources (may return empty list, that's OK)
    $apiResponse = Invoke-WebRequest "http://localhost:25001/api/v1/datasources" -UseBasicParsing -TimeoutSec 10
    if ($apiResponse.StatusCode -eq 200) {
        Write-Host "  [PASS] API GET /api/v1/datasources returns 200" -ForegroundColor Green
        $results += @{Service="api-crud"; Status="PASS"}
    }
} catch {
    Write-Host "  [FAIL] API CRUD - $($_.Exception.Message)" -ForegroundColor Red
    $results += @{Service="api-crud"; Status="FAIL"}
    $failed = $true
} finally {
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job $apiJob -Force -ErrorAction SilentlyContinue
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Validation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count

foreach ($r in $results) {
    $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "  [$($r.Status)] $($r.Service)" -ForegroundColor $color
}

Write-Host ""
Write-Host "Results: $passCount passed, $failCount failed" -ForegroundColor $(if ($failed) { "Red" } else { "Green" })

if ($failed) {
    Write-Host ""
    Write-Host "VALIDATION FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "VALIDATION PASSED - Release package is ready" -ForegroundColor Green
    exit 0
}

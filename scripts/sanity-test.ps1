# ============================================================================
# EZ Platform - Local Sanity Deploy & Test Script (PowerShell)
# Performs a full clean deploy from dist/ artifacts and runs the sanity test
# suite twice in headed browser mode to verify consistency.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/sanity-test.ps1 [-PkgDir <path>]
# ============================================================================

param(
    [string]$PkgDir = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Namespace = "ez-platform"

# ---------------------------------------------------------------------------
# Step 1 - Auto-detect deployment package
# ---------------------------------------------------------------------------
if ([string]::IsNullOrEmpty($PkgDir)) {
    $PkgDir = Get-ChildItem -Path "$RepoRoot\dist" -Directory -Filter "deployment-*" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

if ([string]::IsNullOrEmpty($PkgDir)) {
    Write-Error "No deployment package found in dist/"
    Write-Host "Run these commands first:"
    Write-Host "  pwsh -File scripts/build-all-images.ps1"
    Write-Host "  pwsh -File scripts/pull-infra-images.ps1"
    Write-Host "  pwsh -File scripts/assemble-package.ps1"
    exit 1
}

if (-not (Test-Path "$PkgDir\images\services")) {
    Write-Error "$PkgDir\images\services does not exist. Invalid deployment package."
    exit 1
}

Write-Host "==> Using deployment package: $PkgDir" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Step 2 - Delete namespace
# ---------------------------------------------------------------------------
Write-Host "==> Deleting namespace $Namespace..." -ForegroundColor Cyan
kubectl delete namespace $Namespace --ignore-not-found --timeout=120s --wait=true 2>$null

# ---------------------------------------------------------------------------
# Step 3 - Remove cached application images from minikube
# ---------------------------------------------------------------------------
Write-Host "==> Removing cached ez-platform images from minikube..." -ForegroundColor Cyan
$images = minikube image ls 2>$null | Where-Object { $_ -match "ez-platform/" }
foreach ($img in $images) {
    if ($img) {
        minikube image rm $img 2>$null
    }
}

# ---------------------------------------------------------------------------
# Step 4 - Load service images (parallel with Start-Job)
# ---------------------------------------------------------------------------
Write-Host "==> Loading service images into minikube (parallel)..." -ForegroundColor Cyan
$serviceTars = Get-ChildItem "$PkgDir\images\services\*.tar" -ErrorAction SilentlyContinue
$jobs = @()
foreach ($tar in $serviceTars) {
    Write-Host "  Loading $($tar.FullName) ..."
    $jobs += Start-Job -ScriptBlock {
        param($tarPath)
        minikube image load $tarPath 2>$null
    } -ArgumentList $tar.FullName
}
if ($jobs.Count -gt 0) {
    $jobs | Wait-Job | Out-Null
    foreach ($job in $jobs) {
        if ($job.State -eq 'Failed') {
            Write-Error "ERROR: Service image load failed"
            $jobs | Remove-Job -Force
            exit 1
        }
    }
    $jobs | Receive-Job 2>$null | Out-Null
    $jobs | Remove-Job -Force
}

# ---------------------------------------------------------------------------
# Step 5 - Load infrastructure images (parallel with Start-Job)
# ---------------------------------------------------------------------------
$infraDir = "$PkgDir\images\infrastructure"
if (Test-Path $infraDir) {
    $infraTars = Get-ChildItem "$infraDir\*.tar" -ErrorAction SilentlyContinue
    if ($infraTars) {
        Write-Host "==> Loading infrastructure images into minikube (parallel)..." -ForegroundColor Cyan
        $jobs = @()
        foreach ($tar in $infraTars) {
            Write-Host "  Loading $($tar.FullName) ..."
            $jobs += Start-Job -ScriptBlock {
                param($tarPath)
                minikube image load $tarPath 2>$null
            } -ArgumentList $tar.FullName
        }
        if ($jobs.Count -gt 0) {
            $jobs | Wait-Job | Out-Null
            foreach ($job in $jobs) {
                if ($job.State -eq 'Failed') {
                    Write-Error "ERROR: Infrastructure image load failed"
                    $jobs | Remove-Job -Force
                    exit 1
                }
            }
            $jobs | Receive-Job 2>$null | Out-Null
            $jobs | Remove-Job -Force
        }
    }
}

# ---------------------------------------------------------------------------
# Step 6 - Helm deploy (no --wait: we manage readiness manually below)
# ---------------------------------------------------------------------------
Write-Host "==> Deploying via Helm..." -ForegroundColor Cyan
helm upgrade --install ez-platform "$RepoRoot\helm\ez-platform" `
    --namespace $Namespace `
    --create-namespace `
    --values "$RepoRoot\helm\ez-platform\values-local.yaml" `
    --timeout 15m
if ($LASTEXITCODE -ne 0) {
    Write-Error "Helm deploy failed"
    exit 1
}

# ---------------------------------------------------------------------------
# Step 6a - Wait for MongoDB pod, then initiate replica set
# post-install hooks only fire after --wait succeeds, creating a deadlock:
# services crash waiting for RS primary, --wait times out, hook never runs.
# We break the cycle by initiating RS explicitly here.
# ---------------------------------------------------------------------------
Write-Host "==> Waiting for MongoDB pod to be ready..." -ForegroundColor Cyan
kubectl wait --for=condition=Ready pod -l app=mongodb -n $Namespace --timeout=180s
if ($LASTEXITCODE -ne 0) {
    Write-Host "MongoDB pod did not become ready:" -ForegroundColor Red
    kubectl get pods -n $Namespace -l app=mongodb
    exit 1
}

Write-Host "==> Initiating MongoDB replica set..." -ForegroundColor Cyan
$rsScript = @"
try {
  var s = rs.status();
  print('RS already initialized: ' + s.set);
} catch(e) {
  rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb-0.mongodb-service.$Namespace.svc.cluster.local:27017'}]});
  print('RS initiated');
}
"@
kubectl exec -n $Namespace mongodb-0 -- mongosh --quiet --eval $rsScript
Start-Sleep -Seconds 8

# ---------------------------------------------------------------------------
# Step 7 - Wait for all pods
# ---------------------------------------------------------------------------
Write-Host "==> Waiting for all pods to be Ready..." -ForegroundColor Cyan
kubectl wait --for=condition=Ready pod --all -n $Namespace --timeout=300s
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pod readiness timeout - current state:" -ForegroundColor Red
    kubectl get pods -n $Namespace
    exit 1
}

# ---------------------------------------------------------------------------
# Step 8 - Start port-forwards (background)
# ---------------------------------------------------------------------------
Write-Host "==> Starting port-forwards..." -ForegroundColor Cyan
$portForwardArgs = @(
    "port-forward --address 127.0.0.1 -n $Namespace svc/datasource-management 5001:5001",
    "port-forward --address 127.0.0.1 -n $Namespace svc/metrics-configuration 5002:5002",
    "port-forward --address 127.0.0.1 -n $Namespace svc/validation 5003:5003",
    "port-forward --address 127.0.0.1 -n $Namespace svc/scheduling 5004:5004",
    "port-forward --address 127.0.0.1 -n $Namespace svc/invalidrecords 5007:5007",
    "port-forward --address 127.0.0.1 -n $Namespace svc/fileprocessor 5008:5008",
    "port-forward --address 127.0.0.1 -n $Namespace svc/output 5009:5009",
    "port-forward --address 127.0.0.1 -n $Namespace svc/frontend 7000:8080",
    "port-forward --address 127.0.0.1 -n $Namespace svc/docs 30800:80",
    "port-forward --address 127.0.0.1 -n $Namespace svc/mongodb-service 27017:27017"
)
foreach ($args in $portForwardArgs) {
    Start-Process -WindowStyle Hidden kubectl -ArgumentList $args
}
Start-Sleep -Seconds 10

# ---------------------------------------------------------------------------
# Step 8a - Wait for critical port-forwards to be ready
# ---------------------------------------------------------------------------
Write-Host "==> Waiting for port-forwards to be ready..." -ForegroundColor Cyan
$portsToCheck = @(5001, 27017)
foreach ($port in $portsToCheck) {
    $maxWait = 30
    $waited = 0
    $ready = $false
    while ($waited -lt $maxWait) {
        $tcp = New-Object System.Net.Sockets.TcpClient
        try {
            $tcp.Connect("127.0.0.1", $port)
            $tcp.Close()
            Write-Host "  Port $port ready"
            $ready = $true
            break
        } catch {
            Start-Sleep -Seconds 2
            $waited += 2
        } finally {
            $tcp.Dispose()
        }
    }
    if (-not $ready) {
        Write-Error "Port $port did not become ready after ${maxWait}s - port-forward may have failed"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Step 9 - Seed with DemoDataGenerator
# ---------------------------------------------------------------------------
Write-Host "==> Seeding cluster with DemoDataGenerator..." -ForegroundColor Cyan
dotnet run --project "$RepoRoot\tools\DemoDataGenerator" -- --direct-connection --api-url http://localhost:5001
if ($LASTEXITCODE -ne 0) {
    Write-Error "DemoDataGenerator seeding failed"
    exit 1
}

# ---------------------------------------------------------------------------
# Step 10 - Ensure Playwright installed
# ---------------------------------------------------------------------------
Write-Host "==> Ensuring Playwright chromium is installed..." -ForegroundColor Cyan
Set-Location "$RepoRoot\src\Frontend"
npx playwright install chromium

# ---------------------------------------------------------------------------
# Step 10a - Open frontend and docs in browser for user observation
# ---------------------------------------------------------------------------
Write-Host "==> Opening frontend and docs in default browser..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:7000"
Start-Process "http://127.0.0.1:30800/docs/user-guide-he"
Write-Host "    Waiting 5 seconds for pages to load..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# ---------------------------------------------------------------------------
# Step 11 - Run sanity tests twice
# ---------------------------------------------------------------------------
Write-Host "==> Running sanity tests (Run 1 of 2)..." -ForegroundColor Cyan
$Run1Exit = 0
npm run test:e2e:sanity:watch
if ($LASTEXITCODE -ne 0) { $Run1Exit = $LASTEXITCODE }

Write-Host "==> Running sanity tests (Run 2 of 2)..." -ForegroundColor Cyan
$Run2Exit = 0
npm run test:e2e:sanity:watch
if ($LASTEXITCODE -ne 0) { $Run2Exit = $LASTEXITCODE }

# ---------------------------------------------------------------------------
# Step 12 - Print summary and cleanup
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host "  SANITY TEST RESULTS" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White
Write-Host "Run 1: $(if ($Run1Exit -eq 0) { 'PASSED' } else { 'FAILED' })" -ForegroundColor $(if ($Run1Exit -eq 0) { 'Green' } else { 'Red' })
Write-Host "Run 2: $(if ($Run2Exit -eq 0) { 'PASSED' } else { 'FAILED' })" -ForegroundColor $(if ($Run2Exit -eq 0) { 'Green' } else { 'Red' })
if ($Run1Exit -eq 0 -and $Run2Exit -eq 0) {
    Write-Host "OVERALL: PASSED" -ForegroundColor Green
} else {
    Write-Host "OVERALL: FAILED" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor White

# Cleanup port-forwards
Write-Host "==> Cleaning up port-forwards..." -ForegroundColor Yellow
taskkill /F /IM kubectl.exe 2>$null

if ($Run1Exit -eq 0 -and $Run2Exit -eq 0) {
    exit 0
} else {
    exit 1
}

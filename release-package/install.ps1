# EZ Platform Installation Script
# Version: 0.5.0
# Date: March 2026

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  EZ Platform v0.5.0 Installation" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Prerequisites check
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check kubectl
try {
    $null = Get-Command kubectl -ErrorAction Stop
    Write-Host "[OK] kubectl found" -ForegroundColor Green
} catch {
    Write-Host "[X] kubectl not found. Please install kubectl first." -ForegroundColor Red
    exit 1
}

# Check helm
try {
    $null = Get-Command helm -ErrorAction Stop
    Write-Host "[OK] Helm found" -ForegroundColor Green
} catch {
    Write-Host "[X] Helm not found. Please install Helm 3.8+ first." -ForegroundColor Red
    exit 1
}

# Check cluster connection
$clusterInfo = kubectl cluster-info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Cannot connect to Kubernetes cluster. Please configure kubectl." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Kubernetes cluster accessible" -ForegroundColor Green

Write-Host ""
Write-Host "Prerequisites check passed!" -ForegroundColor Green
Write-Host ""

# Default values
$Namespace = "ez-platform"
$ValuesFile = ""
$WaitTimeout = "15m"

# Parse arguments
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-n" -or $_ -eq "--namespace" } {
            $Namespace = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-f" -or $_ -eq "--values" } {
            $ValuesFile = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-t" -or $_ -eq "--timeout" } {
            $WaitTimeout = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-l" -or $_ -eq "--local" } {
            $ValuesFile = "helm/ez-platform/values-local.yaml"
            Write-Host "Using local deployment values (single replicas, reduced resources)" -ForegroundColor Yellow
            $i += 1
        }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Write-Host "Usage: install.ps1 [OPTIONS]"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -n, --namespace NAME    Kubernetes namespace (default: ez-platform)"
            Write-Host "  -f, --values FILE       Custom values.yaml file"
            Write-Host "  -l, --local             Use local dev values (single replicas, reduced resources)"
            Write-Host "  -t, --timeout DURATION  Wait timeout (default: 15m)"
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

# Pre-install: clean up cluster-scoped RBAC resources that survive namespace deletion
# ClusterRole and ClusterRoleBinding are not namespace-scoped, so helm uninstall / kubectl delete namespace
# does NOT remove them. On reinstall, helm install fails with "already exists".
Write-Host "Cleaning up cluster-scoped RBAC resources (safe on fresh cluster)..." -ForegroundColor Yellow
kubectl delete clusterrolebinding nas-device-manager-pv-binding --ignore-not-found=true 2>$null | Out-Null
kubectl delete clusterrole nas-pv-manager --ignore-not-found=true 2>$null | Out-Null
Write-Host "[OK] RBAC cleanup complete" -ForegroundColor Green
Write-Host ""

# Installation
Write-Host "Installing EZ Platform to namespace: $Namespace" -ForegroundColor Yellow
Write-Host ""

# Build helm install command (no --wait: we do a two-phase wait to handle MongoDB RS init)
$HelmArgs = @(
    "install", "ez-platform", "./helm/ez-platform",
    "--namespace", $Namespace,
    "--create-namespace"
)

if ($ValuesFile -ne "") {
    $HelmArgs += "--values"
    $HelmArgs += $ValuesFile
    Write-Host "Using custom values from: $ValuesFile" -ForegroundColor Yellow
}

Write-Host "Running: helm $($HelmArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

try {
    # Execute installation (no --wait — pods start in background)
    & helm @HelmArgs

    if ($LASTEXITCODE -ne 0) {
        throw "Helm installation failed"
    }

    Write-Host ""

    # ── Phase 1: Wait for MongoDB to become ready before initialising RS ──────
    # datasource-management crashes with MongoNotPrimaryException if RS is not
    # initialized. MongoDB must be Primary before any application service starts.
    Write-Host "Waiting for MongoDB to become ready..." -ForegroundColor Yellow
    $mongoReady = kubectl wait --for=condition=ready pod/mongodb-0 -n $Namespace --timeout=300s 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "MongoDB did not become ready in time: $mongoReady"
    }
    Write-Host "[OK] MongoDB pod is ready" -ForegroundColor Green

    # ── Phase 2: Initialize MongoDB replica set ───────────────────────────────
    Write-Host "Initializing MongoDB replica set..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    $rsInit = kubectl exec -n $Namespace mongodb-0 -- mongosh --quiet --eval "
      try {
        var s = rs.status();
        print('RS already initialized: ' + s.set);
      } catch(e) {
        rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongodb-0.mongodb-service:27017'}]});
        print('RS initiated');
      }
    " 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] MongoDB replica set ready: $rsInit" -ForegroundColor Green
    } else {
        throw "rs.initiate() failed: $rsInit"
    }
    Write-Host ""

    # ── Phase 3: Wait for all remaining pods ─────────────────────────────────
    Write-Host "Waiting for all pods to become ready (timeout: $WaitTimeout)..." -ForegroundColor Yellow
    $allReady = kubectl wait --for=condition=ready pod --all -n $Namespace --timeout=$WaitTimeout 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] Some pods did not reach Ready state:" -ForegroundColor Yellow
        kubectl get pods -n $Namespace --no-headers | Where-Object { $_ -notmatch "Running|Completed" }
        # Not a hard failure — some transient pods (Jobs) may not be Ready
    } else {
        Write-Host "[OK] All pods are ready" -ForegroundColor Green
    }
    Write-Host ""

    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  Installation Successful!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""

    # Show deployment status
    Write-Host "Deployment Status:" -ForegroundColor Yellow
    kubectl get pods -n $Namespace
    Write-Host ""

    # Show services
    Write-Host "Services:" -ForegroundColor Yellow
    kubectl get svc -n $Namespace
    Write-Host ""

    # Get frontend access
    Write-Host "Access Instructions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Via Port-Forward (localhost):" -ForegroundColor Cyan
    Write-Host "   kubectl port-forward svc/frontend 7000:8080 -n $Namespace"
    Write-Host "   Then open: http://localhost:7000"
    Write-Host ""
    Write-Host "2. Via LoadBalancer (if available):" -ForegroundColor Cyan
    Write-Host "   kubectl get svc frontend -n $Namespace"
    Write-Host ""
    Write-Host "3. Documentation Portal:" -ForegroundColor Cyan
    Write-Host "   kubectl port-forward svc/docs 8080:8080 -n $Namespace"
    Write-Host "   Then open: http://localhost:8080"
    Write-Host ""
    Write-Host "4. Monitoring Dashboards:" -ForegroundColor Cyan
    Write-Host "   Grafana:    kubectl port-forward svc/grafana 3001:3000 -n $Namespace"
    Write-Host "   Prometheus: kubectl port-forward svc/prometheus-system 9090:9090 -n $Namespace"
    Write-Host "   Jaeger:     kubectl port-forward svc/jaeger 16686:16686 -n $Namespace"
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "  Installation Failed!" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "For troubleshooting:" -ForegroundColor Yellow
    Write-Host "  helm status ez-platform -n $Namespace"
    Write-Host "  kubectl get events -n $Namespace --sort-by='.lastTimestamp'"
    Write-Host ""
    exit 1
}

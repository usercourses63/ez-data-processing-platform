# EZ Platform Installation Script
# Version: 0.1.1-rc1
# Date: January 1, 2026

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  EZ Platform v0.1.1-rc2 Installation" -ForegroundColor Cyan
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
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Write-Host "Usage: install.ps1 [OPTIONS]"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -n, --namespace NAME    Kubernetes namespace (default: ez-platform)"
            Write-Host "  -f, --values FILE       Custom values.yaml file"
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

# Installation
Write-Host "Installing EZ Platform to namespace: $Namespace" -ForegroundColor Yellow
Write-Host ""

# Build helm install command
$HelmArgs = @(
    "install", "ez-platform", "./helm/ez-platform",
    "--namespace", $Namespace,
    "--create-namespace",
    "--wait",
    "--timeout", $WaitTimeout
)

if ($ValuesFile -ne "") {
    $HelmArgs += "--values"
    $HelmArgs += $ValuesFile
    Write-Host "Using custom values from: $ValuesFile" -ForegroundColor Yellow
}

Write-Host "Running: helm $($HelmArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

try {
    # Execute installation
    & helm @HelmArgs

    if ($LASTEXITCODE -ne 0) {
        throw "Helm installation failed"
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
    Write-Host "   kubectl port-forward svc/frontend 3000:80 -n $Namespace"
    Write-Host "   Then open: http://localhost:3000"
    Write-Host ""
    Write-Host "2. Via LoadBalancer (if available):" -ForegroundColor Cyan
    Write-Host "   kubectl get svc frontend -n $Namespace"
    Write-Host ""
    Write-Host "3. Monitoring Dashboards:" -ForegroundColor Cyan
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

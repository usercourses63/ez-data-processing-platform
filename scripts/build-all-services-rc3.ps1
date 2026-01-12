# Build All Services - v0.1.1-rc3
# MongoDB Replica Set Support Release

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building EZ Platform Services v0.1.1-rc3" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{Name="datasource-management"; Dockerfile="docker/DataSourceManagementService.Dockerfile"; Image="ez-platform/datasource-management"},
    @{Name="fileprocessor"; Dockerfile="docker/FileProcessorService.Dockerfile"; Image="ez-platform/fileprocessor"},
    @{Name="filediscovery"; Dockerfile="docker/FileDiscoveryService.Dockerfile"; Image="ez-platform/filediscovery"},
    @{Name="validation"; Dockerfile="docker/ValidationService.Dockerfile"; Image="ez-platform/validation"},
    @{Name="scheduling"; Dockerfile="docker/SchedulingService.Dockerfile"; Image="ez-platform/scheduling"},
    @{Name="output"; Dockerfile="docker/OutputService.Dockerfile"; Image="ez-platform/output"},
    @{Name="metrics-configuration"; Dockerfile="docker/MetricsConfigurationService.Dockerfile"; Image="ez-platform/metrics-configuration"},
    @{Name="invalidrecords"; Dockerfile="docker/InvalidRecordsService.Dockerfile"; Image="ez-platform/invalidrecords"}
)

$version = "v0.1.1-rc3"
$buildCount = 0
$failedBuilds = @()

foreach ($service in $services) {
    Write-Host "[$($buildCount + 1)/$($services.Count)] Building $($service.Name)..." -ForegroundColor Yellow

    try {
        # Check if Dockerfile exists
        if (-not (Test-Path $service.Dockerfile)) {
            Write-Host "  ⚠️  Dockerfile not found at $($service.Dockerfile) - Skipping" -ForegroundColor Yellow
            continue
        }

        # Build Docker image from repository root
        Write-Host "  Building: $($service.Image):$version" -ForegroundColor Gray
        Write-Host "  Dockerfile: $($service.Dockerfile)" -ForegroundColor Gray

        docker build -f $service.Dockerfile -t "$($service.Image):$version" .

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Build successful: $($service.Name)" -ForegroundColor Green

            # Load into minikube
            Write-Host "  Loading into minikube..." -ForegroundColor Gray
            minikube image load "$($service.Image):$version"

            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ Loaded into minikube" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  Failed to load into minikube" -ForegroundColor Yellow
            }

            $buildCount++
        } else {
            throw "Docker build failed"
        }
    }
    catch {
        Write-Host "  ❌ Build failed: $($service.Name)" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
        $failedBuilds += $service.Name
    }

    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successful builds: $buildCount/$($services.Count)" -ForegroundColor $(if ($buildCount -eq $services.Count) { "Green" } else { "Yellow" })

if ($failedBuilds.Count -gt 0) {
    Write-Host "Failed builds:" -ForegroundColor Red
    foreach ($failed in $failedBuilds) {
        Write-Host "  - $failed" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "✅ All services built successfully!" -ForegroundColor Green
}

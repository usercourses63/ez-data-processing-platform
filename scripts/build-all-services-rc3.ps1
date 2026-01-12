# Build All Services - v0.1.1-rc3
# MongoDB Replica Set Support Release

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building EZ Platform Services v0.1.1-rc3" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{Name="datasource-management"; Path="src/Services/DataSourceManagementService"; Image="ez-platform/datasource-management"},
    @{Name="fileprocessor"; Path="src/Services/FileProcessorService"; Image="ez-platform/fileprocessor"},
    @{Name="filediscovery"; Path="src/Services/FileDiscoveryService"; Image="ez-platform/filediscovery"},
    @{Name="validation"; Path="src/Services/ValidationService"; Image="ez-platform/validation"},
    @{Name="scheduling"; Path="src/Services/SchedulingService"; Image="ez-platform/scheduling"},
    @{Name="output"; Path="src/Services/OutputService"; Image="ez-platform/output"},
    @{Name="metrics-configuration"; Path="src/Services/MetricsConfigurationService"; Image="ez-platform/metrics-configuration"},
    @{Name="invalidrecords"; Path="src/Services/InvalidRecordsService"; Image="ez-platform/invalidrecords"}
)

$version = "v0.1.1-rc3"
$buildCount = 0
$failedBuilds = @()

foreach ($service in $services) {
    Write-Host "[$($buildCount + 1)/$($services.Count)] Building $($service.Name)..." -ForegroundColor Yellow

    try {
        # Check if Dockerfile exists
        $dockerfilePath = Join-Path $service.Path "Dockerfile"
        if (-not (Test-Path $dockerfilePath)) {
            Write-Host "  ⚠️  Dockerfile not found at $dockerfilePath - Skipping" -ForegroundColor Yellow
            continue
        }

        # Build Docker image
        $buildCmd = "docker build -f `"$dockerfilePath`" -t `"$($service.Image):$version`" ."
        Write-Host "  Building: $($service.Image):$version" -ForegroundColor Gray

        Invoke-Expression $buildCmd

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

# Build All Docker Images - Parallel Execution with Version Injection
# PowerShell 7+ required for ForEach-Object -Parallel
#
# Usage:
#   pwsh -File scripts/build-all-images.ps1 -Version "v0.2.0" -CommitSha "abc1234"
#
# Environment variables (for CI/CD):
#   VERSION - overrides -Version parameter
#   COMMIT_SHA - overrides -CommitSha parameter

#Requires -Version 7.0
param(
    [Parameter(Mandatory=$false)]
    [string]$Version = "v0.0.0",

    [Parameter(Mandatory=$false)]
    [string]$CommitSha = "unknown"
)

$ErrorActionPreference = "Stop"

# Read from environment if available (GitHub Actions integration)
if ($env:VERSION) {
    $Version = $env:VERSION
}
if ($env:COMMIT_SHA) {
    $CommitSha = $env:COMMIT_SHA
}

# Short SHA for tagging (first 7 characters)
$ShortSha = $CommitSha.Substring(0, [Math]::Min(7, $CommitSha.Length))

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building EZ Platform Docker Images" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Version:    $Version" -ForegroundColor Cyan
Write-Host "Commit:     $CommitSha" -ForegroundColor Cyan
Write-Host "Short SHA:  $ShortSha" -ForegroundColor Cyan
Write-Host "Parallel:   ThrottleLimit 5" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define all 10 services to build (9 backend/frontend + Docusaurus)
$services = @(
    @{Name="datasource-management"; Dockerfile="docker/DataSourceManagementService.Dockerfile"; Image="ez-platform/datasource-management"},
    @{Name="validation"; Dockerfile="docker/ValidationService.Dockerfile"; Image="ez-platform/validation"},
    @{Name="fileprocessor"; Dockerfile="docker/FileProcessorService.Dockerfile"; Image="ez-platform/fileprocessor"},
    @{Name="filediscovery"; Dockerfile="docker/FileDiscoveryService.Dockerfile"; Image="ez-platform/filediscovery"},
    @{Name="scheduling"; Dockerfile="docker/SchedulingService.Dockerfile"; Image="ez-platform/scheduling"},
    @{Name="output"; Dockerfile="docker/OutputService.Dockerfile"; Image="ez-platform/output"},
    @{Name="metrics-configuration"; Dockerfile="docker/MetricsConfigurationService.Dockerfile"; Image="ez-platform/metrics-configuration"},
    @{Name="invalidrecords"; Dockerfile="docker/InvalidRecordsService.Dockerfile"; Image="ez-platform/invalidrecords"},
    @{Name="frontend"; Dockerfile="docker/Frontend.Dockerfile"; Image="ez-platform/frontend"},
    @{Name="docusaurus"; Dockerfile="docker/Docusaurus.Dockerfile"; Image="ez-platform/docusaurus"}
)

# Thread-safe collections for parallel execution (per research Pattern 2)
$failedBuilds = [System.Collections.Concurrent.ConcurrentBag[string]]::new()
$successBuilds = [System.Collections.Concurrent.ConcurrentBag[string]]::new()

$startTime = Get-Date

# Build all services in parallel with ThrottleLimit 5
$services | ForEach-Object -Parallel {
    $service = $_
    $version = $using:Version
    $commitSha = $using:CommitSha
    $shortSha = $using:ShortSha
    $failedBuilds = $using:failedBuilds
    $successBuilds = $using:successBuilds

    Write-Host "[$($service.Name)] Starting build..." -ForegroundColor Yellow

    try {
        # Check if Dockerfile exists
        if (-not (Test-Path $service.Dockerfile)) {
            throw "Dockerfile not found at $($service.Dockerfile)"
        }

        # Build Docker image with version and commit SHA build arguments
        # Tags: version, latest, short SHA
        $buildResult = docker build `
            --build-arg VERSION=$version `
            --build-arg COMMIT_SHA=$commitSha `
            -f $service.Dockerfile `
            -t "$($service.Image):$version" `
            -t "$($service.Image):latest" `
            -t "$($service.Image):$shortSha" `
            . 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$($service.Name)] Build successful - tagged: $version, latest, $shortSha" -ForegroundColor Green
            $successBuilds.Add($service.Name)
        } else {
            throw "Docker build exited with code $LASTEXITCODE`n$buildResult"
        }
    }
    catch {
        Write-Host "[$($service.Name)] Build FAILED: $_" -ForegroundColor Red
        $failedBuilds.Add($service.Name)
    }
} -ThrottleLimit 5

$endTime = Get-Date
$duration = $endTime - $startTime

# Build Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Duration:   $([math]::Round($duration.TotalSeconds, 1)) seconds" -ForegroundColor Gray
Write-Host "Successful: $($successBuilds.Count)/$($services.Count)" -ForegroundColor $(if ($successBuilds.Count -eq $services.Count) { "Green" } else { "Yellow" })

if ($successBuilds.Count -gt 0) {
    Write-Host ""
    Write-Host "Successful builds:" -ForegroundColor Green
    foreach ($success in $successBuilds) {
        Write-Host "  + $success" -ForegroundColor Green
    }
}

if ($failedBuilds.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed builds:" -ForegroundColor Red
    foreach ($failed in $failedBuilds) {
        Write-Host "  - $failed" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Build failed with $($failedBuilds.Count) error(s)" -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "All $($services.Count) services built successfully!" -ForegroundColor Green
    exit 0
}

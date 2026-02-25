# Export Docker Images to Release Package
# Usage: .\export-images.ps1 -Version v0.2.0
#
# Exports all EZ Platform service images and infrastructure images to tarballs
# for offline/air-gapped OCP deployment.

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$false)]
    [string]$OutputDir = "release-package/images",

    [Parameter(Mandatory=$false)]
    [switch]$SkipInfrastructure
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Exporting Images $Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create directory structure
$servicesDir = "$OutputDir/services"
$infraDir = "$OutputDir/infrastructure"

Write-Host "Creating directory structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $servicesDir | Out-Null
if (-not $SkipInfrastructure) {
    New-Item -ItemType Directory -Force -Path $infraDir | Out-Null
}
Write-Host "Directories created" -ForegroundColor Green
Write-Host ""

# Define service images (10 services: 8 backend + frontend + docs)
$serviceImages = @(
    @{Name="datasource-management"; Image="ez-platform/datasource-management:$Version"},
    @{Name="fileprocessor"; Image="ez-platform/fileprocessor:$Version"},
    @{Name="filediscovery"; Image="ez-platform/filediscovery:$Version"},
    @{Name="validation"; Image="ez-platform/validation:$Version"},
    @{Name="scheduling"; Image="ez-platform/scheduling:$Version"},
    @{Name="output"; Image="ez-platform/output:$Version"},
    @{Name="metrics-configuration"; Image="ez-platform/metrics-configuration:$Version"},
    @{Name="invalidrecords"; Image="ez-platform/invalidrecords:$Version"},
    @{Name="frontend"; Image="ez-platform/frontend:$Version"},
    @{Name="docs"; Image="ezplatform-docs:$Version"}
)

# Define infrastructure images (pinned versions from values.yaml)
$infraImages = @(
    @{Name="mongodb"; Image="mongo:8.0"},
    @{Name="kafka"; Image="confluentinc/cp-kafka:7.5.0"},
    @{Name="zookeeper"; Image="confluentinc/cp-zookeeper:7.5.0"},
    @{Name="rabbitmq"; Image="rabbitmq:3.12-management-alpine"},
    @{Name="hazelcast"; Image="hazelcast/hazelcast:5.6"},
    @{Name="elasticsearch"; Image="docker.elastic.co/elasticsearch/elasticsearch:8.17.0"},
    @{Name="prometheus"; Image="prom/prometheus:v2.53.0"},
    @{Name="grafana"; Image="grafana/grafana:10.4.1"},
    @{Name="jaeger"; Image="jaegertracing/all-in-one:1.62.0"},
    @{Name="otel-collector"; Image="otel/opentelemetry-collector-contrib:0.113.0"},
    @{Name="fluent-bit"; Image="fluent/fluent-bit:3.2.2"},
    @{Name="curl"; Image="curlimages/curl:8.5.0"}
)

# Export service images
Write-Host "Exporting Service Images..." -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Gray
$exportCount = 0
$failedImages = @()

foreach ($img in $serviceImages) {
    Write-Host "[$($exportCount + 1)/$($serviceImages.Count)] Exporting $($img.Name)..." -ForegroundColor Cyan

    $safeName = $img.Name
    $outputFile = "$servicesDir/$safeName-$Version.tar"

    try {
        docker save $img.Image -o $outputFile

        if ($LASTEXITCODE -eq 0) {
            $fileSize = (Get-Item $outputFile).Length / 1MB
            Write-Host "  Exported: $($fileSize.ToString('F2')) MB" -ForegroundColor Green
            $exportCount++
        } else {
            throw "Docker save failed with exit code $LASTEXITCODE"
        }
    }
    catch {
        Write-Host "  Failed: $($img.Name)" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
        $failedImages += $img.Name
    }
}

# Export infrastructure images (unless skipped)
$infraCount = 0
if (-not $SkipInfrastructure) {
    Write-Host ""
    Write-Host "Exporting Infrastructure Images..." -ForegroundColor Yellow
    Write-Host "-----------------------------------" -ForegroundColor Gray

    foreach ($img in $infraImages) {
        Write-Host "[$($infraCount + 1)/$($infraImages.Count)] Exporting $($img.Name)..." -ForegroundColor Cyan

        $safeName = $img.Image -replace ":", "-" -replace "/", "-"
        $outputFile = "$infraDir/$safeName.tar"

        try {
            docker save $img.Image -o $outputFile

            if ($LASTEXITCODE -eq 0) {
                $fileSize = (Get-Item $outputFile).Length / 1MB
                Write-Host "  Exported: $($fileSize.ToString('F2')) MB" -ForegroundColor Green
                $infraCount++
            } else {
                throw "Docker save failed"
            }
        }
        catch {
            Write-Host "  Failed: $($img.Name)" -ForegroundColor Red
            Write-Host "  Error: $_" -ForegroundColor Red
            $failedImages += $img.Name
        }
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Export Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Services exported: $exportCount/$($serviceImages.Count)" -ForegroundColor Green

if (-not $SkipInfrastructure) {
    Write-Host "Infrastructure exported: $infraCount/$($infraImages.Count)" -ForegroundColor Green
}

if ($failedImages.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed images:" -ForegroundColor Red
    foreach ($failed in $failedImages) {
        Write-Host "  - $failed" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Some images failed to export!" -ForegroundColor Red
    exit 1
}

$totalSize = (Get-ChildItem -Recurse $OutputDir -Filter "*.tar" | Measure-Object -Property Length -Sum).Sum / 1GB
Write-Host "Total package size: $($totalSize.ToString('F2')) GB" -ForegroundColor Cyan

Write-Host ""
Write-Host "Image export complete!" -ForegroundColor Green
Write-Host "Images saved to:" -ForegroundColor Yellow
Write-Host "  - Services: $servicesDir" -ForegroundColor Gray
if (-not $SkipInfrastructure) {
    Write-Host "  - Infrastructure: $infraDir" -ForegroundColor Gray
}
Write-Host ""
Write-Host "To load on air-gapped OCP:" -ForegroundColor Yellow
Write-Host "  1. Copy $OutputDir to target machine" -ForegroundColor Gray
Write-Host "  2. Run: for f in services/*.tar; do docker load -i `$f; done" -ForegroundColor Gray
Write-Host "  3. Tag and push to internal registry" -ForegroundColor Gray

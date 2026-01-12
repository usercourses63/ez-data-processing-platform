# Export Docker Images to Release Package - v0.1.1-rc3

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Exporting Images v0.1.1-rc3" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create directory structure
$releaseDir = "release-package/images"
$servicesDir = "$releaseDir/services"
$infraDir = "$releaseDir/infrastructure"

Write-Host "Creating directory structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $servicesDir | Out-Null
New-Item -ItemType Directory -Force -Path $infraDir | Out-Null
Write-Host "✅ Directories created" -ForegroundColor Green
Write-Host ""

# Define service images
$serviceImages = @(
    @{Name="datasource-management"; Image="ez-platform/datasource-management:v0.1.1-rc3"},
    @{Name="fileprocessor"; Image="ez-platform/fileprocessor:v0.1.1-rc3"},
    @{Name="filediscovery"; Image="ez-platform/filediscovery:v0.1.1-rc3"},
    @{Name="validation"; Image="ez-platform/validation:v0.1.1-rc3"},
    @{Name="scheduling"; Image="ez-platform/scheduling:v0.1.1-rc3"},
    @{Name="output"; Image="ez-platform/output:v0.1.1-rc3"},
    @{Name="metrics-configuration"; Image="ez-platform/metrics-configuration:v0.1.1-rc3"},
    @{Name="invalidrecords"; Image="ez-platform/invalidrecords:v0.1.1-rc3"},
    @{Name="frontend"; Image="ez-platform/frontend:v0.1.1-rc3"},
    @{Name="docs"; Image="ezplatform-docs:v0.1.1-rc3"}
)

# Define infrastructure images
$infraImages = @(
    @{Name="mongodb"; Image="mongo:8.0"},
    @{Name="kafka"; Image="confluentinc/cp-kafka:7.5.0"},
    @{Name="zookeeper"; Image="confluentinc/cp-zookeeper:7.5.0"},
    @{Name="rabbitmq"; Image="rabbitmq:3-management-alpine"},
    @{Name="hazelcast"; Image="hazelcast/hazelcast:5.6"},
    @{Name="elasticsearch"; Image="docker.elastic.co/elasticsearch/elasticsearch:8.17.0"},
    @{Name="prometheus"; Image="prom/prometheus:latest"},
    @{Name="grafana"; Image="grafana/grafana:latest"},
    @{Name="jaeger"; Image="jaegertracing/all-in-one:latest"},
    @{Name="otel-collector"; Image="otel/opentelemetry-collector-contrib:latest"},
    @{Name="fluent-bit"; Image="fluent/fluent-bit:latest"}
)

# Export service images
Write-Host "Exporting Service Images..." -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Gray
$exportCount = 0

foreach ($img in $serviceImages) {
    Write-Host "[$($exportCount + 1)/$($serviceImages.Count)] Exporting $($img.Name)..." -ForegroundColor Cyan

    $outputFile = "$servicesDir/$($img.Name)-v0.1.1-rc3.tar"

    try {
        docker save $img.Image -o $outputFile

        if ($LASTEXITCODE -eq 0) {
            $fileSize = (Get-Item $outputFile).Length / 1MB
            Write-Host "  ✅ Exported: $($fileSize.ToString('F2')) MB" -ForegroundColor Green
            $exportCount++
        } else {
            throw "Docker save failed"
        }
    }
    catch {
        Write-Host "  ❌ Failed: $($img.Name)" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Exporting Infrastructure Images..." -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Gray
$infraCount = 0

foreach ($img in $infraImages) {
    Write-Host "[$($infraCount + 1)/$($infraImages.Count)] Exporting $($img.Name)..." -ForegroundColor Cyan

    # Clean up image name for filename
    $safeName = $img.Image -replace ":", "-" -replace "/", "-"
    $outputFile = "$infraDir/$safeName.tar"

    try {
        docker save $img.Image -o $outputFile

        if ($LASTEXITCODE -eq 0) {
            $fileSize = (Get-Item $outputFile).Length / 1MB
            Write-Host "  ✅ Exported: $($fileSize.ToString('F2')) MB" -ForegroundColor Green
            $infraCount++
        } else {
            throw "Docker save failed"
        }
    }
    catch {
        Write-Host "  ❌ Failed: $($img.Name)" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}

# Clean up old rc1/rc2 images from root
Write-Host ""
Write-Host "Cleaning up old images from root directory..." -ForegroundColor Yellow
Get-ChildItem $releaseDir -Filter "*-rc1.tar*" | ForEach-Object {
    Write-Host "  Removing: $($_.Name)" -ForegroundColor Gray
    Remove-Item $_.FullName -Force
}
Get-ChildItem $releaseDir -Filter "*-rc2.tar*" | ForEach-Object {
    Write-Host "  Removing: $($_.Name)" -ForegroundColor Gray
    Remove-Item $_.FullName -Force
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Export Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Services exported: $exportCount/$($serviceImages.Count)" -ForegroundColor Green
Write-Host "Infrastructure exported: $infraCount/$($infraImages.Count)" -ForegroundColor Green

$totalSize = (Get-ChildItem -Recurse $servicesDir, $infraDir | Measure-Object -Property Length -Sum).Sum / 1GB
Write-Host "Total package size: $($totalSize.ToString('F2')) GB" -ForegroundColor Cyan

Write-Host ""
Write-Host "✅ Image export complete!" -ForegroundColor Green
Write-Host "Images saved to:" -ForegroundColor Yellow
Write-Host "  - Services: $servicesDir" -ForegroundColor Gray
Write-Host "  - Infrastructure: $infraDir" -ForegroundColor Gray

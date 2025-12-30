# Build all EZ Platform services with v0.1.0-beta tag
# Run from repository root

$ErrorActionPreference = "Stop"
$VERSION = "v0.1.0-beta"

Write-Host "Building EZ Platform Services - Version: $VERSION" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$services = @(
    @{Name="DataSourceManagementService"; Tag="datasource-management"; Proj="DataProcessing.DataSourceManagement.csproj"},
    @{Name="FileDiscoveryService"; Tag="filediscovery"; Proj="DataProcessing.FileDiscovery.csproj"},
    @{Name="FileProcessorService"; Tag="fileprocessor"; Proj="DataProcessing.FileProcessor.csproj"},
    @{Name="ValidationService"; Tag="validation"; Proj="DataProcessing.Validation.csproj"},
    @{Name="OutputService"; Tag="output"; Proj="DataProcessing.Output.csproj"},
    @{Name="InvalidRecordsService"; Tag="invalidrecords"; Proj="InvalidRecordsService.csproj"},
    @{Name="SchedulingService"; Tag="scheduling"; Proj="DataProcessing.Scheduling.csproj"},
    @{Name="MetricsConfigurationService"; Tag="metrics-configuration"; Proj="MetricsConfigurationService.csproj"}
)

$buildCount = 0
$totalServices = $services.Count

foreach ($svc in $services) {
    $buildCount++
    Write-Host ""
    Write-Host "[$buildCount/$totalServices] Building $($svc.Name)..." -ForegroundColor Yellow

    # Publish to output directory
    Write-Host "  Publishing..." -ForegroundColor Gray
    dotnet publish "src/Services/$($svc.Name)/$($svc.Proj)" `
        -c Release `
        -o "publish/$($svc.Name)" `
        --nologo `
        --verbosity quiet

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED to publish $($svc.Name)" -ForegroundColor Red
        exit 1
    }

    # Build Docker image
    Write-Host "  Building Docker image..." -ForegroundColor Gray
    docker build -t "$($svc.Tag):$VERSION" "publish/$($svc.Name)" -q

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED to build Docker image for $($svc.Name)" -ForegroundColor Red
        exit 1
    }

    Write-Host "  SUCCESS: $($svc.Tag):$VERSION" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "All services built successfully!" -ForegroundColor Green
Write-Host "Version: $VERSION" -ForegroundColor Cyan
Write-Host "Images created: $buildCount" -ForegroundColor Cyan

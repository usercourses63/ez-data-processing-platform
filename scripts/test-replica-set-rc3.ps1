# Test MongoDB Replica Set and Service Connectivity - v0.1.1-rc3

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing EZ Platform v0.1.1-rc3" -ForegroundColor Cyan
Write-Host "MongoDB Replica Set Connectivity" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check MongoDB Replica Set Status
Write-Host "[Test 1] MongoDB Replica Set Status" -ForegroundColor Yellow
Write-Host "------------------------------------" -ForegroundColor Gray

$rsStatusCmd = "rs.status()"
$rsStatus = kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet --eval $rsStatusCmd 2>&1

if ($rsStatus -match "PRIMARY" -and $rsStatus -match "SECONDARY") {
    Write-Host "✅ Replica set is healthy" -ForegroundColor Green
    Write-Host "   Primary and Secondary nodes detected" -ForegroundColor Gray
} else {
    Write-Host "❌ Replica set issue detected" -ForegroundColor Red
    Write-Host $rsStatus
}
Write-Host ""

# Test 2: Check MongoDB pod connectivity
Write-Host "[Test 2] MongoDB Pods Status" -ForegroundColor Yellow
Write-Host "-----------------------------" -ForegroundColor Gray

$mongoPods = kubectl get pods -n ez-platform -l app=mongodb -o jsonpath='{.items[*].metadata.name}'
$podCount = ($mongoPods -split ' ').Count

Write-Host "MongoDB pods: $podCount" -ForegroundColor Cyan
foreach ($pod in ($mongoPods -split ' ')) {
    $status = kubectl get pod $pod -n ez-platform -o jsonpath='{.status.phase}'
    $ready = kubectl get pod $pod -n ez-platform -o jsonpath='{.status.containerStatuses[0].ready}'

    if ($status -eq "Running" -and $ready -eq "true") {
        Write-Host "  ✅ $pod - Running and Ready" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $pod - Status: $status, Ready: $ready" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: Check service pods connection to MongoDB
Write-Host "[Test 3] Service MongoDB Connectivity" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Gray

$services = @(
    "datasource-management",
    "fileprocessor",
    "filediscovery",
    "validation",
    "scheduling",
    "output",
    "metrics-configuration",
    "invalidrecords"
)

$connectedCount = 0
$totalServices = $services.Count

foreach ($service in $services) {
    $logs = kubectl logs -n ez-platform deployment/$service --tail=100 2>&1

    if ($logs -match "MongoDB.*initialized successfully" -or $logs -match "database connection initialized") {
        Write-Host "  ✅ $service - Connected" -ForegroundColor Green
        $connectedCount++
    } elseif ($logs -match "MongoDB.*error" -or $logs -match "connection.*failed" -or $logs -match "27017") {
        Write-Host "  ❌ $service - Connection Error" -ForegroundColor Red
        Write-Host "     Check logs: kubectl logs deployment/$service -n ez-platform" -ForegroundColor Gray
    } else {
        Write-Host "  ⏳ $service - Starting or Unknown" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Connected: $connectedCount/$totalServices services" -ForegroundColor $(if ($connectedCount -eq $totalServices) { "Green" } else { "Yellow" })
Write-Host ""

# Test 4: Verify ConfigMap
Write-Host "[Test 4] ConfigMap Configuration" -ForegroundColor Yellow
Write-Host "---------------------------------" -ForegroundColor Gray

$mongoConnection = kubectl get configmap services-config -n ez-platform -o jsonpath='{.data.mongodb-connection}'

if ($mongoConnection -match "mongodb://.*mongodb-0.*mongodb-1.*mongodb-2.*replicaSet=rs0") {
    Write-Host "✅ ConfigMap has replica set connection string" -ForegroundColor Green
    Write-Host "   Connection: $($mongoConnection.Substring(0, [Math]::Min(80, $mongoConnection.Length)))..." -ForegroundColor Gray
} else {
    Write-Host "❌ ConfigMap missing replica set configuration" -ForegroundColor Red
    Write-Host "   Current: $mongoConnection" -ForegroundColor Gray
}
Write-Host ""

# Test 5: API Health Checks
Write-Host "[Test 5] Service Health Endpoints" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Gray

$healthEndpoints = @(
    @{Name="DataSource Management"; URL="http://localhost:5001/health"},
    @{Name="Metrics Configuration"; URL="http://localhost:5002/health"},
    @{Name="Validation"; URL="http://localhost:5003/health"}
)

$healthyCount = 0

foreach ($endpoint in $healthEndpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint.URL -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ $($endpoint.Name) - Healthy" -ForegroundColor Green
            $healthyCount++
        } else {
            Write-Host "  ⚠️  $($endpoint.Name) - Status: $($response.StatusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  ❌ $($endpoint.Name) - Unreachable" -ForegroundColor Red
        Write-Host "     Make sure port forwarding is running" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Healthy: $healthyCount/$($healthEndpoints.Count) endpoints" -ForegroundColor $(if ($healthyCount -eq $healthEndpoints.Count) { "Green" } else { "Yellow" })
Write-Host ""

# Final Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "MongoDB Replica Set:" -ForegroundColor Yellow
Write-Host "  - Pods: $podCount/3" -ForegroundColor $(if ($podCount -eq 3) { "Green" } else { "Red" })
Write-Host "  - Replica Set: $(if ($rsStatus -match 'PRIMARY') { 'Healthy' } else { 'Issue Detected' })" -ForegroundColor $(if ($rsStatus -match 'PRIMARY') { "Green" } else { "Red" })
Write-Host ""
Write-Host "Service Connectivity:" -ForegroundColor Yellow
Write-Host "  - MongoDB Connected: $connectedCount/$totalServices" -ForegroundColor $(if ($connectedCount -eq $totalServices) { "Green" } else { "Yellow" })
Write-Host "  - Health Endpoints: $healthyCount/$($healthEndpoints.Count)" -ForegroundColor $(if ($healthyCount -eq $healthEndpoints.Count) { "Green" } else { "Yellow" })
Write-Host ""

if ($podCount -eq 3 -and $connectedCount -ge 6 -and $healthyCount -ge 2) {
    Write-Host "✅ System is operational!" -ForegroundColor Green
    Write-Host "MongoDB replica set is working correctly" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some issues detected" -ForegroundColor Yellow
    Write-Host "Check logs with: kubectl logs -f deployment/<service-name> -n ez-platform" -ForegroundColor Gray
}

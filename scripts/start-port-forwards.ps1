# EZ Platform - Persistent Port Forwards Script
# Creates reliable port forwards for all services
# Version: 1.0
# Date: December 11, 2025

Write-Host "Starting persistent port forwards for EZ Platform..." -ForegroundColor Cyan

# Kill ONLY this project's existing port forwards (ez-platform namespace).
# IMPORTANT: do NOT `taskkill /IM kubectl.exe` — this host runs a parallel Claude session
# with its own `file-simulator` kubectl port-forwards; a blanket kill would tear those down.
# We match kubectl processes whose command line is a port-forward into the ez-platform ns.
Write-Host "Cleaning up existing ez-platform port forwards..." -ForegroundColor Yellow
Get-CimInstance Win32_Process -Filter "Name = 'kubectl.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'port-forward' -and $_.CommandLine -match 'ez-platform' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

# Define port forwards
$portForwards = @(
    # Application Services
    @{Name="Frontend"; Port=7000; Service="frontend"; TargetPort=8080},
    @{Name="Datasource Management"; Port=5001; Service="datasource-management"; TargetPort=5001},
    @{Name="Validation"; Port=5003; Service="validation"; TargetPort=5003},
    @{Name="Scheduling"; Port=5004; Service="scheduling"; TargetPort=5004},
    @{Name="Invalid Records"; Port=5007; Service="invalidrecords"; TargetPort=5007},
    @{Name="FileProcessor"; Port=5008; Service="fileprocessor"; TargetPort=5008},
    @{Name="Output"; Port=5009; Service="output"; TargetPort=5009},
    @{Name="Metrics Config"; Port=5002; Service="metrics-configuration"; TargetPort=5002},
    # Observability Stack
    @{Name="Grafana"; Port=3001; Service="ezplatform-grafana"; TargetPort=3000},
    @{Name="Prometheus System"; Port=9090; Service="prometheus-system"; TargetPort=9090},
    @{Name="Prometheus Business"; Port=9091; Service="prometheus-business"; TargetPort=9090},
    @{Name="Elasticsearch"; Port=9200; Service="elasticsearch"; TargetPort=9200},
    @{Name="Jaeger UI"; Port=16686; Service="jaeger"; TargetPort=16686},
    @{Name="OTEL Collector gRPC"; Port=4317; Service="otel-collector"; TargetPort=4317},
    @{Name="OTEL Collector HTTP"; Port=4318; Service="otel-collector"; TargetPort=4318},
    # Infrastructure
    @{Name="MongoDB"; Port=27017; Service="mongodb-service"; TargetPort=27017},
    @{Name="Kafka"; Port=9094; Service="kafka-external"; TargetPort=9094},
    @{Name="RabbitMQ"; Port=5672; Service="rabbitmq"; TargetPort=5672},
    @{Name="Hazelcast"; Port=5701; Service="hazelcast-service"; TargetPort=5701},
    # Documentation Portal
    # Host port 7100 (NOT 30800: that node-port is in a Windows reserved range and won't bind;
    # the node IP 192.168.49.2 is also not host-routable on the Docker driver). The frontend's
    # docsUrl is set to http://localhost:7100 to match. Service is ezplatform-docs (port 80).
    @{Name="Docs Portal"; Port=7100; Service="ezplatform-docs"; TargetPort=80}
)

# Start each port forward in background
foreach ($pf in $portForwards) {
    Write-Host "Forwarding $($pf.Name): localhost:$($pf.Port) -> $($pf.Service):$($pf.TargetPort)" -ForegroundColor Green
    Start-Process -WindowStyle Hidden kubectl -ArgumentList "port-forward --context=minikube -n ez-platform svc/$($pf.Service) $($pf.Port):$($pf.TargetPort)"
    Start-Sleep -Milliseconds 500
}

Start-Sleep -Seconds 3

# Verify port forwards
Write-Host "`nVerifying port forwards..." -ForegroundColor Cyan
$listening = netstat -an | Select-String "LISTENING" | Select-String -Pattern "3000|5001|5007|9090|9091|9200|16686|4317"
if ($listening) {
    Write-Host "Port forwards active:" -ForegroundColor Green
    $listening | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Warning: Some port forwards may not be active" -ForegroundColor Yellow
}

Write-Host "`nAccess URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:         http://localhost:3000" -ForegroundColor White
Write-Host "  Invalid Records:  http://localhost:3000/invalid-records" -ForegroundColor White
Write-Host "  Datasources:      http://localhost:3000/datasources" -ForegroundColor White
Write-Host "`nObservability:" -ForegroundColor Cyan
Write-Host "  Grafana:              http://localhost:3001" -ForegroundColor White
Write-Host "  Prometheus System:    http://localhost:9090" -ForegroundColor White
Write-Host "  Prometheus Business:  http://localhost:9091" -ForegroundColor White
Write-Host "  Elasticsearch:        http://localhost:9200" -ForegroundColor White
Write-Host "  Jaeger UI:            http://localhost:16686" -ForegroundColor White
Write-Host "  OTEL Collector:       http://localhost:4318 (HTTP) / localhost:4317 (gRPC)" -ForegroundColor White
Write-Host "`nDocumentation:" -ForegroundColor Cyan
Write-Host "  Docs Portal:          http://localhost:7100" -ForegroundColor White
Write-Host "`nAPIs:" -ForegroundColor Cyan
Write-Host "  Datasource API:       http://localhost:5001/api/v1/datasource" -ForegroundColor White
Write-Host "  Invalid Records API:  http://localhost:5007/api/v1/invalid-records" -ForegroundColor White
Write-Host "  Metrics API:          http://localhost:5002/api/v1/metrics" -ForegroundColor White
Write-Host "`nPort forwards are running in background. Keep this terminal open or they will stop." -ForegroundColor Yellow
Write-Host "To stop ONLY these ez-platform port forwards (not the file-simulator session's):" -ForegroundColor Yellow
Write-Host "  kill the kubectl.exe processes whose command line contains both 'port-forward' and 'ez-platform'." -ForegroundColor DarkGray
Write-Host "  Do NOT run taskkill /IM kubectl.exe -- it also kills the other session's forwards." -ForegroundColor Yellow

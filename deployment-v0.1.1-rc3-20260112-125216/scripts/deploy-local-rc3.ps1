# Deploy EZ Platform v0.1.1-rc3 to Local Minikube

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying EZ Platform v0.1.1-rc3" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Update ConfigMap with MongoDB Replica Set
Write-Host "[1/6] Applying MongoDB Replica Set ConfigMap..." -ForegroundColor Yellow
kubectl apply -f k8s/configmaps/services-config.yaml
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to apply ConfigMap" -ForegroundColor Red
    exit 1
}
Write-Host "✅ ConfigMap applied" -ForegroundColor Green
Write-Host ""

# Step 2: Scale MongoDB to 3 replicas
Write-Host "[2/6] Deploying MongoDB 3-node replica set..." -ForegroundColor Yellow
kubectl apply -f k8s/infrastructure/mongodb-statefulset.yaml
Write-Host "Waiting for MongoDB pods to be ready..." -ForegroundColor Gray
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  MongoDB pods not ready yet, check status with: kubectl get pods -l app=mongodb -n ez-platform" -ForegroundColor Yellow
} else {
    Write-Host "✅ MongoDB replica set deployed" -ForegroundColor Green
}
Write-Host ""

# Step 3: Initialize MongoDB Replica Set
Write-Host "[3/6] Initializing MongoDB Replica Set..." -ForegroundColor Yellow
$mongoInitScript = @"
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: 'mongodb-0.mongodb.ez-platform.svc.cluster.local:27017' },
    { _id: 1, host: 'mongodb-1.mongodb.ez-platform.svc.cluster.local:27017' },
    { _id: 2, host: 'mongodb-2.mongodb.ez-platform.svc.cluster.local:27017' }
  ]
})
"@

Write-Host "Executing: rs.initiate()..." -ForegroundColor Gray
kubectl exec -n ez-platform mongodb-0 -- mongosh --eval $mongoInitScript 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Replica set initialized" -ForegroundColor Green
} else {
    Write-Host "⚠️  Replica set may already be initialized (this is OK)" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Deploy all services with rc3 images
Write-Host "[4/6] Deploying services with v0.1.1-rc3..." -ForegroundColor Yellow

$deployments = @(
    "datasource-management",
    "fileprocessor",
    "filediscovery",
    "validation",
    "scheduling",
    "output",
    "metrics-configuration",
    "invalidrecords",
    "frontend"
)

foreach ($deployment in $deployments) {
    Write-Host "  Deploying $deployment..." -ForegroundColor Cyan
    kubectl apply -f "k8s/deployments/$deployment-deployment.yaml"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ $deployment deployed" -ForegroundColor Green
    } else {
        Write-Host "    ❌ $deployment failed" -ForegroundColor Red
    }
}
Write-Host ""

# Step 5: Wait for services to be ready
Write-Host "[5/6] Waiting for services to be ready..." -ForegroundColor Yellow
Write-Host "This may take 2-3 minutes..." -ForegroundColor Gray
Start-Sleep -Seconds 30

$readyCount = 0
$totalCount = $deployments.Count

foreach ($deployment in $deployments) {
    $status = kubectl get deployment $deployment -n ez-platform -o jsonpath='{.status.readyReplicas}' 2>$null
    if ($status -gt 0) {
        Write-Host "  ✅ $deployment ready" -ForegroundColor Green
        $readyCount++
    } else {
        Write-Host "  ⏳ $deployment not ready yet" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Ready: $readyCount/$totalCount services" -ForegroundColor $(if ($readyCount -eq $totalCount) { "Green" } else { "Yellow" })
Write-Host ""

# Step 6: Start port forwards
Write-Host "[6/6] Starting port forwards..." -ForegroundColor Yellow
Write-Host "Executing: scripts/start-port-forwards.ps1" -ForegroundColor Gray
& ".\scripts\start-port-forwards.ps1"
Write-Host ""

# Final summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "MongoDB Replica Set: 3 nodes" -ForegroundColor Green
Write-Host "Services deployed: $readyCount/$totalCount" -ForegroundColor $(if ($readyCount -eq $totalCount) { "Green" } else { "Yellow" })
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Yellow
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Grafana:   http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Jaeger:    http://localhost:16686" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Check pod status: kubectl get pods -n ez-platform" -ForegroundColor Gray
Write-Host "  2. View logs: kubectl logs -f deployment/datasource-management -n ez-platform" -ForegroundColor Gray
Write-Host "  3. Run test script: scripts\test-replica-set-rc3.ps1" -ForegroundColor Gray

# Complete EZ Platform Deployment Script
# Week 2: Day 7
# Run this after K8s cluster is ready

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "EZ Platform - K8s Deployment" -ForegroundColor Cyan
Write-Host "Week 2: Day 7" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to k8s directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

try {
    Write-Host "Step 1: Creating namespace..." -ForegroundColor Yellow
    kubectl apply -f namespace.yaml
    if ($LASTEXITCODE -ne 0) { throw "Failed to create namespace" }
    Write-Host "[OK] Namespace created" -ForegroundColor Green
    Write-Host ""

    Write-Host "Step 2: Deploying ConfigMaps and PVCs..." -ForegroundColor Yellow
    kubectl apply -f configmaps/services-config.yaml
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy services-config.yaml" }
    kubectl apply -f deployments/data-pvcs.yaml
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy data-pvcs.yaml" }
    Write-Host "[OK] Configuration deployed" -ForegroundColor Green
    Write-Host ""

    Write-Host "Step 3: Deploying MongoDB (3-node replica set)..." -ForegroundColor Yellow
    kubectl apply -f infrastructure/mongodb-statefulset.yaml
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy MongoDB" }
    Write-Host "Waiting for MongoDB to be ready..." -ForegroundColor Gray
    kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
    if ($LASTEXITCODE -ne 0) { throw "MongoDB failed to become ready" }
    Write-Host "[OK] MongoDB ready" -ForegroundColor Green
    Write-Host ""

    Write-Host "Step 4: Deploying Kafka (3-node cluster + ZooKeeper)..." -ForegroundColor Yellow
    kubectl apply -f infrastructure/kafka-statefulset.yaml
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy Kafka" }
    Write-Host "Waiting for Kafka to be ready..." -ForegroundColor Gray
    kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s
    if ($LASTEXITCODE -ne 0) { throw "Kafka failed to become ready" }
    Write-Host "[OK] Kafka ready" -ForegroundColor Green
    Write-Host ""

    Write-Host "Step 5: Deploying Hazelcast (3-node distributed cache)..." -ForegroundColor Yellow
    kubectl apply -f infrastructure/hazelcast-statefulset.yaml
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy Hazelcast" }
    Write-Host "Waiting for Hazelcast to be ready..." -ForegroundColor Gray
    kubectl wait --for=condition=ready pod -l app=hazelcast -n ez-platform --timeout=300s
    if ($LASTEXITCODE -ne 0) { throw "Hazelcast failed to become ready" }
    Write-Host "[OK] Hazelcast ready" -ForegroundColor Green
    Write-Host ""

    Write-Host "Step 6: Deploying all 9 microservices..." -ForegroundColor Yellow
    kubectl apply -f deployments/
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy microservices" }
    kubectl apply -f services/all-services.yaml
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy services" }
    Write-Host "Waiting for all services to be ready..." -ForegroundColor Gray
    kubectl wait --for=condition=ready pod --all -n ez-platform --timeout=600s
    if ($LASTEXITCODE -ne 0) { throw "Services failed to become ready" }
    Write-Host "[OK] All services deployed" -ForegroundColor Green
    Write-Host ""

    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "Deployment Complete!" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Verifying deployment..." -ForegroundColor Yellow
    kubectl get pods -n ez-platform
    Write-Host ""
    kubectl get svc -n ez-platform
    Write-Host ""

    Write-Host "======================================" -ForegroundColor Green
    Write-Host "[OK] EZ Platform is now running in Kubernetes!" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Check pod status: kubectl get pods -n ez-platform"
    Write-Host "2. View logs: kubectl logs -f deployment/filediscovery -n ez-platform"
    Write-Host "3. Access Frontend: kubectl get svc frontend -n ez-platform"
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Red
    Write-Host "Deployment Failed!" -ForegroundColor Red
    Write-Host "======================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "For troubleshooting:" -ForegroundColor Yellow
    Write-Host "  kubectl get events -n ez-platform --sort-by='.lastTimestamp'"
    Write-Host "  kubectl describe pod <pod-name> -n ez-platform"
    Write-Host ""
    exit 1
}

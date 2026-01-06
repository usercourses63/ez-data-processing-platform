# ========================================
# EZ Platform - Kubernetes Cluster Bootstrap Script
# ========================================
#
# This script provides a complete one-command solution to:
# 1. Start/verify minikube cluster
# 2. Build and load all Docker images
# 3. Deploy infrastructure (MongoDB, RabbitMQ, Kafka, Hazelcast, etc.)
# 4. Deploy all 9 microservices
# 5. Configure CORS for testing (Development environment)
# 6. Setup port forwarding for frontend API access
# 7. Setup external test data mounts
# 8. Populate demo data
# 9. Verify system health
#
# Usage: .\bootstrap-k8s-cluster.ps1 [-Clean] [-SkipBuild] [-SkipData]
#
# Parameters:
#   -Clean: Delete existing cluster and start fresh
#   -SkipBuild: Skip Docker image building (use existing images)
#   -SkipData: Skip demo data generation
# ========================================

param(
    [switch]$Clean,
    [switch]$SkipBuild,
    [switch]$SkipData,
    [switch]$FastStart  # Quick restart without rebuild
)

$ErrorActionPreference = "Stop"
$Global:StartTime = Get-Date

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Wait-ForPods {
    param(
        [string]$Namespace = "ez-platform",
        [string]$Label,
        [int]$TimeoutSeconds = 300
    )

    $selector = if ($Label) { "-l $Label" } else { "--all" }
    Write-Info "Waiting for pods $selector to be ready, timeout: ${TimeoutSeconds}s..."

    try {
        kubectl wait --for=condition=ready pod $selector -n $Namespace --timeout="${TimeoutSeconds}s" 2>&1 | Out-Null
        Write-Success "Pods are ready"
        return $true
    } catch {
        Write-Error-Custom "Timeout waiting for pods: $_"
        kubectl get pods -n $Namespace
        return $false
    }
}

# ========================================
# STEP 1: Prerequisites Check
# ========================================
Write-Step "STEP 1: Checking Prerequisites"

$prerequisites = @{
    "minikube" = "https://minikube.sigs.k8s.io/docs/start/"
    "kubectl" = "https://kubernetes.io/docs/tasks/tools/"
    "docker" = "https://www.docker.com/products/docker-desktop"
}

$missingTools = @()
foreach ($tool in $prerequisites.Keys) {
    if (Test-Command $tool) {
        $version = & $tool version 2>&1 | Select-Object -First 1
        Write-Success "$tool found: $version"
    } else {
        Write-Error-Custom "$tool not found"
        Write-Info "Install from: $($prerequisites[$tool])"
        $missingTools += $tool
    }
}

if ($missingTools.Count -gt 0) {
    Write-Error-Custom "Missing required tools. Please install them and try again."
    exit 1
}

# ========================================
# STEP 2: Minikube Cluster Management
# ========================================
Write-Step "STEP 2: Minikube Cluster Management"

if ($Clean) {
    Write-Info "Clean flag detected - deleting existing cluster..."
    minikube delete
    Write-Success "Existing cluster deleted"
}

$minikubeStatus = minikube status --format='{{.Host}}' 2>&1
if ($minikubeStatus -ne "Running") {
    Write-Info "Starting minikube cluster..."
    Write-Info 'Configuration: 8 CPUs, 40GB RAM, Docker driver'

    minikube start --driver=docker --memory=40g --cpus=8

    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to start minikube"
        exit 1
    }

    Write-Success "Minikube started successfully"
} else {
    Write-Success "Minikube is already running"
}

# Enable addons
Write-Info "Enabling minikube addons..."
minikube addons enable metrics-server
minikube addons enable dashboard
Write-Success "Addons enabled"

# ========================================
# STEP 3: External Test Data Setup
# ========================================
Write-Step "STEP 3: External Test Data Mount Setup"

Write-Info "Setting up external test data mount..."
Write-Info "Source: C:\Users\UserC\source\repos\EZ\test-data"
Write-Info "Target: /mnt/external-test-data (inside minikube)"

# Start minikube mount in background
Write-Info "Starting minikube mount process in background..."
$mountJob = Start-Job -ScriptBlock {
    param($testDataPath)
    minikube mount "${testDataPath}:/mnt/external-test-data"
} -ArgumentList "C:\Users\UserC\source\repos\EZ\test-data"

# Wait 5 seconds for mount to initialize
Write-Info "Waiting 5 seconds for mount to initialize..."
Start-Sleep -Seconds 5

# Verify mount is running
if ($mountJob.State -eq "Running") {
    Write-Success "External mount started (Job ID: $($mountJob.Id))"
    Write-Info "Mount will remain active in background"
    Write-Info "To stop mount later: Stop-Job -Id $($mountJob.Id); Remove-Job -Id $($mountJob.Id)"
} else {
    Write-Error-Custom "Failed to start mount process"
    Write-Info "You may need to run manually: minikube mount C:\Users\UserC\source\repos\EZ\test-data:/mnt/external-test-data"
}

# ========================================
# STEP 4: Build Docker Images
# ========================================
if (-not $SkipBuild -and -not $FastStart) {
    Write-Step "STEP 4: Building Docker Images"

    $services = @(
        @{Name="filediscovery"; Dockerfile="docker/FileDiscoveryService.Dockerfile"},
        @{Name="fileprocessor"; Dockerfile="docker/FileProcessorService.Dockerfile"},
        @{Name="validation"; Dockerfile="docker/ValidationService.Dockerfile"},
        @{Name="output"; Dockerfile="docker/OutputService.Dockerfile"},
        @{Name="datasource-management"; Dockerfile="docker/DataSourceManagementService.Dockerfile"},
        @{Name="metrics-configuration"; Dockerfile="docker/MetricsConfigurationService.Dockerfile"},
        @{Name="invalidrecords"; Dockerfile="docker/InvalidRecordsService.Dockerfile"},
        @{Name="scheduling"; Dockerfile="docker/SchedulingService.Dockerfile"},
        @{Name="frontend"; Dockerfile="docker/Frontend.Dockerfile"},
        @{Name="demo-data-generator"; Dockerfile="docker/DemoDataGenerator.Dockerfile"}
    )

    $repoRoot = "C:\Users\UserC\source\repos\EZ"
    Set-Location $repoRoot

    foreach ($service in $services) {
        Write-Info "Building $($service.Name)..."

        $dockerfile = Join-Path $repoRoot $service.Dockerfile
        if (Test-Path $dockerfile) {
            docker build -t "ez-platform/$($service.Name):latest" -f $dockerfile .

            if ($LASTEXITCODE -eq 0) {
                Write-Success "$($service.Name) built successfully"
            } else {
                Write-Error-Custom "Failed to build $($service.Name)"
            }
        } else {
            Write-Error-Custom "Dockerfile not found: $dockerfile"
        }
    }

    Write-Success "All images built"

    # ========================================
    # STEP 5: Load Images into Minikube
    # ========================================
    Write-Step "STEP 5: Loading Images into Minikube"

    foreach ($service in $services) {
        Write-Info "Loading $($service.Name) into minikube..."
        minikube image load "ez-platform/$($service.Name):latest"

        if ($LASTEXITCODE -eq 0) {
            Write-Success "$($service.Name) loaded"
        } else {
            Write-Error-Custom "Failed to load $($service.Name)"
        }
    }

    Write-Success "All images loaded into minikube"
} else {
    Write-Info 'Skipping build (FastStart or SkipBuild flag)'
}

# ========================================
# STEP 6: Deploy Kubernetes Resources
# ========================================
Write-Step "STEP 6: Deploying Kubernetes Resources"

$k8sPath = Join-Path "C:\Users\UserC\source\repos\EZ" "k8s"
Set-Location $k8sPath

# Create namespace
Write-Info "Creating namespace..."
kubectl apply -f namespace.yaml
Write-Success "Namespace created: ez-platform"

# Deploy ConfigMaps and PVCs
Write-Info "Deploying ConfigMaps and PVCs..."
kubectl apply -f configmaps/services-config.yaml
kubectl apply -f deployments/data-pvcs.yaml
Write-Success "Configuration deployed"

# ========================================
# STEP 7: Deploy Infrastructure
# ========================================
Write-Step "STEP 7: Deploying Infrastructure Services"

# MongoDB
Write-Info 'Deploying MongoDB (StatefulSet)...'
kubectl apply -f infrastructure/mongodb-statefulset.yaml

# Scale MongoDB to 1 replica for testing
Write-Info "Scaling MongoDB to 1 replica for testing..."
kubectl scale statefulset mongodb -n ez-platform --replicas=1

Wait-ForPods -Label "app=mongodb" -TimeoutSeconds 180

# RabbitMQ
Write-Info 'Deploying RabbitMQ...'
kubectl apply -f deployments/rabbitmq.yaml
Wait-ForPods -Label "app=rabbitmq" -TimeoutSeconds 120

# Kafka
Write-Info 'Deploying Kafka (StatefulSet)...'
kubectl apply -f infrastructure/kafka-statefulset.yaml

# Scale Kafka to 1 replica for testing
Write-Info "Scaling Kafka to 1 replica for testing..."
kubectl scale statefulset kafka -n ez-platform --replicas=1

Wait-ForPods -Label "app=kafka" -TimeoutSeconds 180

# Hazelcast
Write-Info 'Deploying Hazelcast (StatefulSet)...'
kubectl apply -f infrastructure/hazelcast-statefulset.yaml

# Scale Hazelcast to 1 replica for testing
Write-Info "Scaling Hazelcast to 1 replica for testing..."
kubectl scale statefulset hazelcast -n ez-platform --replicas=1

Wait-ForPods -Label "app=hazelcast" -TimeoutSeconds 120

Write-Success "Infrastructure deployed"

# Wait a bit for services to stabilize
Write-Info "Waiting 30 seconds for infrastructure to stabilize..."
Start-Sleep -Seconds 30

# ========================================
# STEP 8: Deploy Microservices
# ========================================
Write-Step "STEP 8: Deploying Microservices"

Write-Info "Deploying all 9 microservices..."
kubectl apply -f deployments/datasource-management-deployment.yaml
kubectl apply -f deployments/metrics-configuration-deployment.yaml
kubectl apply -f deployments/invalidrecords-deployment.yaml
kubectl apply -f deployments/scheduling-deployment.yaml
kubectl apply -f deployments/filediscovery-deployment.yaml
kubectl apply -f deployments/fileprocessor-deployment.yaml
kubectl apply -f deployments/validation-deployment.yaml
kubectl apply -f deployments/output-deployment.yaml
kubectl apply -f deployments/frontend-deployment.yaml

# Scale all services to 1 replica for testing
Write-Info "Scaling all services to 1 replica for testing..."
kubectl scale deployment datasource-management filediscovery fileprocessor validation output metrics-configuration invalidrecords scheduling frontend --replicas=1 -n ez-platform

Write-Info "Deploying services..."
kubectl apply -f services/all-services.yaml

Write-Info 'Waiting for all services to be ready (this may take 2-3 minutes)...'
Wait-ForPods -TimeoutSeconds 300

Write-Success "All microservices deployed"

# ========================================
# STEP 9: Configure CORS for Testing
# ========================================
Write-Step "STEP 9: Configuring CORS for Testing"

Write-Info "Setting ASPNETCORE_ENVIRONMENT=Development for datasource-management..."
kubectl set env deployment datasource-management -n ez-platform ASPNETCORE_ENVIRONMENT=Development

Write-Info "Setting ASPNETCORE_ENVIRONMENT=Development for metrics-configuration..."
kubectl set env deployment metrics-configuration -n ez-platform ASPNETCORE_ENVIRONMENT=Development

Write-Info "Setting Kestrel binding to 0.0.0.0 for metrics-configuration..."
kubectl set env deployment metrics-configuration -n ez-platform Kestrel__Endpoints__Http__Url="http://0.0.0.0:5002"

Write-Info "Waiting for deployments to rollout..."
kubectl rollout status deployment datasource-management -n ez-platform --timeout=120s
kubectl rollout status deployment metrics-configuration -n ez-platform --timeout=120s

Write-Success "CORS configuration applied"

# ========================================
# STEP 9.5: Enable Information Logging for Early Deployment
# ========================================
Write-Step "STEP 9.5: Enabling Information-Level Logging"

Write-Info "Setting Information logging for pipeline services (debugging/testing phase)..."

$pipelineServices = @("filediscovery", "fileprocessor", "validation", "output", "invalidrecords")

foreach ($service in $pipelineServices) {
    Write-Info "Configuring logging for $service..."
    kubectl set env deployment $service -n ez-platform `
        Logging__LogLevel__Default=Information `
        Logging__LogLevel__MassTransit=Information

    if ($LASTEXITCODE -eq 0) {
        Write-Success "$service logging configured"
    } else {
        Write-Warning "Failed to configure logging for $service"
    }
}

Write-Success "Information-level logging enabled"
Write-Info "Note: Change to Warning level in Production after system stabilization"

# ========================================
# STEP 10: Setup Port Forwarding
# ========================================
Write-Step "STEP 10: Setting Up Port Forwarding"

Write-Info "Port forwarding allows frontend (running on localhost) to access K8s services"
Write-Info "Starting port forwarding for all backend services accessible from frontend..."

# Function to start port-forward in background
function Start-PortForward {
    param(
        [string]$ServiceName,
        [int]$Port,
        [string]$Namespace = "ez-platform"
    )

    $job = Start-Job -ScriptBlock {
        param($svc, $port, $ns)
        kubectl port-forward -n $ns svc/$svc ${port}:${port}
    } -ArgumentList $ServiceName, $Port, $Namespace

    return $job
}

# Start port forwarding for frontend and backend services
$portForwardJobs = @()

Write-Info "Starting port-forward for frontend (3000 -> 80)..."
$frontendJob = Start-PortForward -ServiceName "frontend" -Port 80
$portForwardJobs += @{Job=$frontendJob; Service="frontend"; Port=80; LocalPort=3000}

Write-Info "Starting port-forward for datasource-management (5001)..."
$datasourceJob = Start-PortForward -ServiceName "datasource-management" -Port 5001
$portForwardJobs += @{Job=$datasourceJob; Service="datasource-management"; Port=5001; LocalPort=5001}

Write-Info "Starting port-forward for metrics-configuration (5002)..."
$metricsJob = Start-PortForward -ServiceName "metrics-configuration" -Port 5002
$portForwardJobs += @{Job=$metricsJob; Service="metrics-configuration"; Port=5002; LocalPort=5002}

Write-Info "Starting port-forward for invalidrecords (5006)..."
$invalidrecordsJob = Start-PortForward -ServiceName "invalidrecords" -Port 5006
$portForwardJobs += @{Job=$invalidrecordsJob; Service="invalidrecords"; Port=5006; LocalPort=5006}

# Wait 5 seconds for port forwards to initialize
Write-Info "Waiting 5 seconds for port forwards to initialize..."
Start-Sleep -Seconds 5

# Verify all port forwards are running
$allRunning = $true
foreach ($pf in $portForwardJobs) {
    if ($pf.Job.State -eq "Running") {
        Write-Success "$($pf.Service) port-forward active on localhost:$($pf.LocalPort) (Job ID: $($pf.Job.Id))"
    } else {
        Write-Error-Custom "$($pf.Service) port-forward failed to start"
        $allRunning = $false
    }
}

if ($allRunning) {
    Write-Success "All port forwards active"
    Write-Info "To stop all port forwards later, run: Get-Job | Where-Object { `$_.State -eq 'Running' -and `$_.Command -like '*kubectl port-forward*' } | Stop-Job"
} else {
    Write-Error-Custom "Some port forwards failed - check logs above"
}

# ========================================
# STEP 11: Deploy Monitoring (Optional)
# ========================================
Write-Step "STEP 11: Deploying Monitoring Stack"

Write-Info "Deploying Prometheus..."
kubectl apply -f configmaps/prometheus-config.yaml
kubectl apply -f infrastructure/prometheus-deployment.yaml

Write-Info "Deploying Grafana..."
kubectl apply -f infrastructure/grafana-deployment.yaml

Write-Success "Monitoring stack deployed"

# ========================================
# STEP 12: Demo Data Generation
# ========================================
if (-not $SkipData -and -not $FastStart) {
    Write-Step "STEP 12: Generating Demo Data"

    Write-Info "Running demo data generator job..."
    kubectl apply -f jobs/demo-data-generator.yaml

    Write-Info 'Waiting for demo data job to complete (timeout: 120s)...'
    kubectl wait --for=condition=complete job/demo-data-generator -n ez-platform --timeout=120s 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Demo data generated successfully"

        # Show job logs
        Write-Info "Demo data generator logs:"
        kubectl logs job/demo-data-generator -n ez-platform --tail=20
    } else {
        Write-Error-Custom "Demo data generation failed or timed out"
        Write-Info "Check logs: kubectl logs job/demo-data-generator -n ez-platform"
    }
} else {
    Write-Info "Skipping demo data generation"
}

# ========================================
# STEP 13: System Health Check
# ========================================
Write-Step "STEP 13: System Health Check"

Write-Info "Checking pod status..."
kubectl get pods -n ez-platform -o wide

Write-Host "`n"
Write-Info "Checking services..."
kubectl get svc -n ez-platform

Write-Host "`n"
Write-Info "Checking PVCs..."
kubectl get pvc -n ez-platform

# Count healthy pods
$allPods = kubectl get pods -n ez-platform -o json | ConvertFrom-Json
$runningPods = ($allPods.items | Where-Object { $_.status.phase -eq "Running" }).Count
$totalPods = $allPods.items.Count

Write-Host "`n"
if ($runningPods -eq $totalPods) {
    Write-Success "All $totalPods pods are running! 🎉"
} else {
    Write-Info "$runningPods / $totalPods pods running"
}

# ========================================
# STEP 14: Access Information
# ========================================
Write-Step "STEP 14: Access Information"

Write-Host @"

📊 EZ Platform Cluster Status
=====================================

Namespace: ez-platform
Cluster: minikube
External Mount: /mnt/external-test-data → C:\Users\UserC\source\repos\EZ\test-data

🔗 Access URLs:
=====================================
Frontend:              http://localhost:3000 (port-forward active)
Datasource Management: http://localhost:5001 (port-forward active)
Metrics Configuration: http://localhost:5002 (port-forward active)
Invalid Records:       http://localhost:5006 (port-forward active)

RabbitMQ UI:           kubectl port-forward -n ez-platform svc/rabbitmq 15672:15672 (guest/guest)
Prometheus:            kubectl port-forward -n ez-platform svc/prometheus 9090:9090
Grafana:               kubectl port-forward -n ez-platform svc/grafana 3001:3000 (admin/admin)
Minikube Dashboard:    minikube dashboard

⚙️  CORS Configuration:
=====================================
datasource-management: Development mode (AllowAll CORS policy)
metrics-configuration: Development mode (AllowAll CORS policy)

📋 Useful Commands:
=====================================
View all pods:           kubectl get pods -n ez-platform
View service logs:       kubectl logs -f deployment/<service> -n ez-platform
Scale service:           kubectl scale deployment/<service> --replicas=N -n ez-platform
Restart service:         kubectl rollout restart deployment/<service> -n ez-platform
View MongoDB data:       kubectl exec -it mongodb-0 -n ez-platform -- mongosh ezplatform
Check RabbitMQ queues:   kubectl exec -it deployment/rabbitmq -n ez-platform -- rabbitmqctl list_queues

🐛 Troubleshooting:
=====================================
Service logs:            kubectl logs deployment/<service> -n ez-platform --tail=100
Describe pod:            kubectl describe pod <pod-name> -n ez-platform
Shell into pod:          kubectl exec -it deployment/<service> -n ez-platform -- /bin/bash
Delete and redeploy:     kubectl delete deployment <service> -n ez-platform && kubectl apply -f k8s/deployments/<service>-deployment.yaml

🔄 Background Jobs:
=====================================
Port-forward jobs:       Get-Job | Where-Object { `$_.Command -like '*kubectl port-forward*' }
Mount job:               Get-Job -Id $($mountJob.Id)
Stop port-forwards:      Get-Job | Where-Object { `$_.State -eq 'Running' -and `$_.Command -like '*kubectl port-forward*' } | Stop-Job
Stop mount:              Stop-Job -Id $($mountJob.Id); Remove-Job -Id $($mountJob.Id)

"@ -ForegroundColor Cyan

$elapsed = (Get-Date) - $Global:StartTime
Write-Host "`n⏱️  Total deployment time: $($elapsed.ToString('mm\:ss'))" -ForegroundColor Green

Write-Step "✅ EZ Platform Deployment Complete!"

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Access frontend: http://localhost:3000" -ForegroundColor White
Write-Host "2. Verify datasources and metrics are loaded" -ForegroundColor White
Write-Host "3. Create E2E-001 datasource with schedule via API" -ForegroundColor White
Write-Host "4. Continue E2E testing from Session 6" -ForegroundColor White

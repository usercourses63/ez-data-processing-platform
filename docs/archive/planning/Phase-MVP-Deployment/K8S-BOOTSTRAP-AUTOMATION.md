# K8s Bootstrap Automation - Complete Guide

**Last Updated:** 2025-12-10
**Status:** ✅ Complete and Automated
**Session:** 7 (Continuation)

## Overview

This document describes the fully automated Kubernetes cluster bootstrap solution for the EZ Platform. After PC shutdowns or cluster resets, a single PowerShell script recreates the entire environment including CORS configuration, port forwarding, and external mounts.

## Key Features

The bootstrap script (`scripts/bootstrap-k8s-cluster.ps1`) provides complete one-command deployment:

1. ✅ Minikube cluster startup/verification
2. ✅ Docker image building and loading
3. ✅ Infrastructure deployment (MongoDB, RabbitMQ, Kafka, Hazelcast)
4. ✅ All 9 microservices deployment
5. ✅ **CORS configuration for testing (Development mode)**
6. ✅ **Port forwarding for frontend API access**
7. ✅ **External test data mount automation**
8. ✅ Demo data generation
9. ✅ System health verification

## What's New in Session 7

### 1. CORS Automation (Step 9)

**Problem:** Frontend running on localhost cannot access K8s services due to CORS restrictions in Production mode.

**Solution:** Automated environment configuration to Development mode with AllowAll CORS policy.

```powershell
# Automatically set Development environment for APIs
kubectl set env deployment datasource-management -n ez-platform ASPNETCORE_ENVIRONMENT=Development
kubectl set env deployment metrics-configuration -n ez-platform ASPNETCORE_ENVIRONMENT=Development

# Fix Kestrel binding for metrics-configuration
kubectl set env deployment metrics-configuration -n ez-platform Kestrel__Endpoints__Http__Url="http://0.0.0.0:5002"
```

**Why This Works:**
- In [Program.cs:214-222](../../src/Services/DataSourceManagementService/Program.cs#L214-L222), services check environment:
  ```csharp
  if (app.Environment.IsDevelopment())
  {
      app.UseCors("AllowAll");  // Allows all origins
  }
  else
  {
      app.UseCors("Production");  // Restricted CORS
  }
  ```

### 2. Port Forwarding Automation (Step 10)

**Problem:** Frontend needs to connect to K8s services on localhost, but services only have ClusterIP.

**Solution:** Automated port forwarding for all backend services accessible from frontend.

```powershell
# Port forwards run in background PowerShell jobs
kubectl port-forward -n ez-platform svc/frontend 80:80           # Frontend
kubectl port-forward -n ez-platform svc/datasource-management 5001:5001
kubectl port-forward -n ez-platform svc/metrics-configuration 5002:5002
kubectl port-forward -n ez-platform svc/invalidrecords 5006:5006
```

**Services Exposed:**
- **Frontend (port 80):** Nginx serving React app → accessible at http://localhost:3000
- **Datasource Management (port 5001):** Schema and datasource APIs
- **Metrics Configuration (port 5002):** Metrics and alerts APIs
- **Invalid Records (port 5006):** Invalid records management API

**Why These Ports:**
Frontend API clients connect to these services:
- [schema-api-client.ts:18](../../src/Frontend/src/services/schema-api-client.ts#L18) → `http://localhost:5001/api/v1/schema`
- [metrics-api-client.ts:4](../../src/Frontend/src/services/metrics-api-client.ts#L4) → `http://localhost:5002/api/v1/metrics`
- [invalidrecords-api-client.ts:76](../../src/Frontend/src/services/invalidrecords-api-client.ts#L76) → `http://localhost:5006/api/v1/invalid-records`

### 3. External Mount Automation (Step 3)

**Problem:** FileDiscovery service needs access to test files on host machine.

**Solution:** Automated minikube mount in background job.

```powershell
# Mount runs in background PowerShell job
$mountJob = Start-Job -ScriptBlock {
    param($testDataPath)
    minikube mount "${testDataPath}:/mnt/external-test-data"
} -ArgumentList "C:\Users\UserC\source\repos\EZ\test-data"
```

**Mount Details:**
- **Source:** `C:\Users\UserC\source\repos\EZ\test-data`
- **Target:** `/mnt/external-test-data` (inside minikube VM)
- **Usage:** FileDiscovery service reads test files from this mount

## Usage

### Quick Start (Existing Cluster)

```powershell
# Fast restart without rebuilding images
.\scripts\bootstrap-k8s-cluster.ps1 -FastStart
```

### Full Deployment (Clean Slate)

```powershell
# Delete existing cluster and start fresh
.\scripts\bootstrap-k8s-cluster.ps1 -Clean
```

### Partial Deployment

```powershell
# Skip building images (use existing)
.\scripts\bootstrap-k8s-cluster.ps1 -SkipBuild

# Skip demo data generation
.\scripts\bootstrap-k8s-cluster.ps1 -SkipData
```

## Script Parameters

| Parameter | Description |
|-----------|-------------|
| `-Clean` | Delete existing cluster and start fresh |
| `-SkipBuild` | Skip Docker image building (use existing images) |
| `-SkipData` | Skip demo data generation |
| `-FastStart` | Quick restart without rebuild (implies -SkipBuild -SkipData) |

## Resource Configuration

All services scaled to **1 replica** for testing to minimize resource usage:

### Infrastructure Services
- **MongoDB:** 1 replica (from 3-node StatefulSet)
- **RabbitMQ:** 1 replica (Deployment)
- **Kafka:** 1 replica (from 3-node StatefulSet)
- **Hazelcast:** 1 replica (from 3-node StatefulSet)

### Microservices
All 9 services run with 1 replica:
- datasource-management
- metrics-configuration
- invalidrecords
- scheduling
- filediscovery
- fileprocessor
- validation
- output
- frontend

## Background Jobs Management

The script creates PowerShell background jobs for:
1. **Minikube mount** - Keeps test data accessible
2. **Port forwarding** - Keeps frontend APIs accessible

### View Background Jobs

```powershell
# List all jobs
Get-Job

# View port-forward jobs
Get-Job | Where-Object { $_.Command -like '*kubectl port-forward*' }

# View mount job (Job ID shown at end of script)
Get-Job -Id <mount-job-id>
```

### Stop Background Jobs

```powershell
# Stop all port forwards
Get-Job | Where-Object { $_.State -eq 'Running' -and $_.Command -like '*kubectl port-forward*' } | Stop-Job

# Stop mount job (replace <id> with actual Job ID)
Stop-Job -Id <id>
Remove-Job -Id <id>
```

## Access Information

### Frontend and APIs

After script completion, access via:

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | Port-forward 3000→80 |
| Datasource Management | http://localhost:5001 | Port-forward active |
| Metrics Configuration | http://localhost:5002 | Port-forward active |
| Invalid Records | http://localhost:5006 | Port-forward active |

### Infrastructure Services

```powershell
# RabbitMQ Management UI
kubectl port-forward -n ez-platform svc/rabbitmq 15672:15672
# Access: http://localhost:15672 (guest/guest)

# Prometheus
kubectl port-forward -n ez-platform svc/prometheus 9090:9090
# Access: http://localhost:9090

# Grafana
kubectl port-forward -n ez-platform svc/grafana 3001:3000
# Access: http://localhost:3001 (admin/admin)

# Minikube Dashboard
minikube dashboard
```

## Troubleshooting

### Port Forward Failures

If port forwarding fails:

```powershell
# Check if ports are already in use
netstat -ano | findstr ":5001"
netstat -ano | findstr ":5002"

# Manually start port forward
kubectl port-forward -n ez-platform svc/datasource-management 5001:5001
```

### Mount Failures

If mount fails to start:

```powershell
# Run mount manually in separate terminal
minikube mount C:\Users\UserC\source\repos\EZ\test-data:/mnt/external-test-data

# Verify mount inside minikube
minikube ssh
ls -la /mnt/external-test-data
```

### CORS Issues

If frontend still shows CORS errors:

```powershell
# Verify environment is Development
kubectl get deployment datasource-management -n ez-platform -o yaml | findstr "ASPNETCORE_ENVIRONMENT"

# Should show: value: Development
# If not, manually set:
kubectl set env deployment datasource-management -n ez-platform ASPNETCORE_ENVIRONMENT=Development
```

### Service Not Ready

If services fail to start:

```powershell
# Check pod status
kubectl get pods -n ez-platform

# View logs for problematic pod
kubectl logs deployment/<service-name> -n ez-platform --tail=100

# Describe pod for detailed events
kubectl describe pod <pod-name> -n ez-platform
```

## Architecture Details

### Service Discovery

All services use **Service names** instead of pod-specific names for better scalability:

| Configuration | Value | Benefit |
|---------------|-------|---------|
| MongoDB | `mongodb` | Load balancing across replicas |
| Kafka | `kafka:9092` | Automatic broker discovery |
| RabbitMQ | `rabbitmq.ez-platform.svc.cluster.local` | DNS-based routing |
| Hazelcast | `hazelcast:5701` | Cluster formation |

See [k8s/configmaps/services-config.yaml](../../k8s/configmaps/services-config.yaml) for complete configuration.

### CORS Policies

Services implement dual CORS policies:

**Development Mode (Testing):**
```csharp
options.AddPolicy("AllowAll", policy =>
{
    policy.AllowAnyOrigin()
          .AllowAnyMethod()
          .AllowAnyHeader();
});
```

**Production Mode (Deployment):**
```csharp
options.AddPolicy("Production", policy =>
{
    policy.WithOrigins(configuration.GetSection("Cors:AllowedOrigins").Get<string[]>())
          .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
          .WithHeaders("Content-Type", "Authorization", "X-Correlation-ID")
          .AllowCredentials();
});
```

### Port Forwarding Implementation

Port forwarding runs as background PowerShell jobs:

```powershell
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
```

This approach:
- Runs in background without blocking script
- Returns job handle for later management
- Survives script completion
- Can be stopped independently

## Next Steps

After successful bootstrap:

1. ✅ Verify all pods are Running: `kubectl get pods -n ez-platform`
2. ✅ Access frontend: http://localhost:3000
3. ✅ Verify datasources and metrics are loaded in UI
4. ⏳ Create E2E-001 datasource with schedule via API
5. ⏳ Continue E2E testing from Session 6

## Related Documentation

- [Bootstrap Implementation](../../scripts/bootstrap-k8s-cluster.ps1)
- [Service Configuration](../../k8s/configmaps/services-config.yaml)
- [All Services Definition](../../k8s/services/all-services.yaml)
- [Session 6 E2E Testing](./SESSION-6-E2E-TESTING.md)
- [CORS Configuration in DataSourceManagement](../../src/Services/DataSourceManagementService/Program.cs#L101-L120)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-10 | Initial automated bootstrap script |
| 2.0 | 2025-12-10 | Added CORS automation (Session 7) |
| 2.1 | 2025-12-10 | Added port forwarding automation (Session 7) |
| 2.2 | 2025-12-10 | Added external mount automation (Session 7) |

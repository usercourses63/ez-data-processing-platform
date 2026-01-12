# EZ Platform v0.1.1-rc3 Deployment Guide

MongoDB Replica Set Support Release

## Quick Start

Execute these scripts in order:

```powershell
# 1. Build all services (20-30 minutes)
.\scripts\build-all-services-rc3.ps1

# 2. Export images to release package (5-10 minutes)
.\scripts\export-images-rc3.ps1

# 3. Deploy to local cluster (5 minutes)
.\scripts\deploy-local-rc3.ps1

# 4. Test replica set connectivity (1 minute)
.\scripts\test-replica-set-rc3.ps1
```

---

## Detailed Steps

### Step 1: Build Services

Builds all 8 services with MongoDB replica set support:

```powershell
.\scripts\build-all-services-rc3.ps1
```

**What it does:**
- Builds Docker images for all services with `v0.1.1-rc3` tag
- Loads images into minikube
- Validates each build

**Duration:** 20-30 minutes
**Output:** 8 Docker images tagged `ez-platform/*:v0.1.1-rc3`

**Services built:**
1. datasource-management
2. fileprocessor
3. filediscovery
4. validation
5. scheduling
6. output
7. metrics-configuration
8. invalidrecords

---

### Step 2: Export Images

Organizes and exports images to release package:

```powershell
.\scripts\export-images-rc3.ps1
```

**What it does:**
- Creates organized directory structure:
  - `release-package/images/services/` - Application services
  - `release-package/images/infrastructure/` - MongoDB, Kafka, etc.
- Exports all images as `.tar` files
- Removes old rc1/rc2 images from root
- Calculates total package size

**Duration:** 5-10 minutes
**Output:** Organized tar files ready for OCP deployment

---

### Step 3: Deploy to Local Cluster

Deploys with MongoDB 3-node replica set:

```powershell
.\scripts\deploy-local-rc3.ps1
```

**What it does:**
1. Applies updated ConfigMap with replica set connection string
2. Deploys MongoDB StatefulSet with 3 replicas
3. Initializes MongoDB replica set (rs.initiate)
4. Deploys all services with rc3 images
5. Starts port forwarding

**Duration:** 5 minutes
**MongoDB Replica Set:** `mongodb-0`, `mongodb-1`, `mongodb-2`

**Access URLs:**
- Frontend: http://localhost:3000
- Grafana: http://localhost:3001
- Jaeger: http://localhost:16686

---

### Step 4: Test System

Validates MongoDB replica set and service connectivity:

```powershell
.\scripts\test-replica-set-rc3.ps1
```

**What it tests:**
1. **MongoDB Replica Set Status**
   - Verifies PRIMARY and SECONDARY nodes
   - Checks `rs.status()`

2. **MongoDB Pods**
   - Validates all 3 pods are Running and Ready

3. **Service Connectivity**
   - Checks 8 services for MongoDB connection logs
   - Looks for "MongoDB initialized successfully"

4. **ConfigMap Validation**
   - Verifies replica set connection string format

5. **Health Endpoints**
   - Tests `/health` endpoints for key services

**Duration:** 1 minute
**Expected:** All tests pass with green checkmarks

---

## What's New in rc3

### MongoDB Replica Set Support
- **Connection String:** Full URI with all 3 replica set members
- **All Services Updated:** Proper URI parsing using `MongoClientSettings.FromConnectionString()`
- **High Availability:** 3-node replica set for production readiness

### Configuration Changes
```yaml
# Old (rc2):
mongodb-connection: "mongodb"

# New (rc3):
mongodb-connection: "mongodb://mongodb-0...27017,mongodb-1...27017,mongodb-2...27017/?replicaSet=rs0"
```

### Services Updated
All 8 services now correctly parse MongoDB URIs:
- DataSourceManagementService
- FileProcessorService
- FileDiscoveryService
- ValidationService
- SchedulingService
- OutputService
- MetricsConfigurationService
- InvalidRecordsService

---

## Troubleshooting

### Build Failures

```powershell
# Check Docker daemon
docker ps

# Rebuild specific service
cd src/Services/DataSourceManagementService
docker build -t ez-platform/datasource-management:v0.1.1-rc3 -f Dockerfile ../..
```

### MongoDB Replica Set Issues

```powershell
# Check replica set status
kubectl exec -n ez-platform mongodb-0 -- mongosh --eval "rs.status()"

# Check pod logs
kubectl logs mongodb-0 -n ez-platform

# Reinitialize replica set
kubectl exec -n ez-platform mongodb-0 -- mongosh --eval "rs.initiate({...})"
```

### Service Connection Errors

```powershell
# Check service logs
kubectl logs -f deployment/datasource-management -n ez-platform --tail=100

# Verify ConfigMap
kubectl get configmap services-config -n ez-platform -o yaml

# Restart service
kubectl rollout restart deployment/datasource-management -n ez-platform
```

### Port Forwarding Issues

```powershell
# Kill existing processes
taskkill /F /IM kubectl.exe

# Restart port forwards
.\scripts\start-port-forwards.ps1
```

---

## Release Package Structure

```
release-package/
├── images/
│   ├── services/               # NEW - Organized service images
│   │   ├── datasource-management-v0.1.1-rc3.tar
│   │   ├── fileprocessor-v0.1.1-rc3.tar
│   │   ├── filediscovery-v0.1.1-rc3.tar
│   │   ├── validation-v0.1.1-rc3.tar
│   │   ├── scheduling-v0.1.1-rc3.tar
│   │   ├── output-v0.1.1-rc3.tar
│   │   ├── metrics-configuration-v0.1.1-rc3.tar
│   │   ├── invalidrecords-v0.1.1-rc3.tar
│   │   ├── frontend-v0.1.1-rc3.tar
│   │   └── docs-v0.1.1-rc3.tar
│   └── infrastructure/         # NEW - Organized infra images
│       ├── mongo-8.0.tar
│       ├── confluentinc-cp-kafka-7.5.0.tar
│       ├── confluentinc-cp-zookeeper-7.5.0.tar
│       ├── rabbitmq-3-management-alpine.tar
│       ├── hazelcast-hazelcast-5.6.tar
│       ├── elasticsearch-8.17.0.tar
│       ├── prom-prometheus-latest.tar
│       ├── grafana-grafana-latest.tar
│       ├── jaegertracing-all-in-one-latest.tar
│       ├── otel-opentelemetry-collector-contrib-latest.tar
│       └── fluent-fluent-bit-latest.tar
├── k8s/                        # Updated to rc3 + replica set
│   ├── configmaps/
│   │   └── services-config.yaml  # Replica set connection string
│   ├── deployments/            # All rc3 images
│   └── infrastructure/
│       └── mongodb-statefulset.yaml  # 3 replicas
└── helm/                       # Updated to rc3
    ├── ez-platform/            # Standard K8s
    └── ez-platform-ocp/        # OpenShift

```

---

## Git Tags

- **v0.1.1-rc1** - Initial beta release
- **v0.1.1-rc2** - Frontend proxy fixes
- **v0.1.1-rc3** - MongoDB replica set support ⬅️ **Current**

---

## Next Steps After Testing

1. **Production Deployment**
   - Copy `release-package/` to OCP environment
   - Load images: `docker load -i images/services/*.tar`
   - Deploy using Helm: `helm install ez-platform helm/ez-platform-ocp -f values-production.yaml`

2. **Monitor System**
   - Check Grafana dashboards
   - Review Jaeger traces
   - Monitor replica set health

3. **Scale if Needed**
   - Scale services: `kubectl scale deployment/fileprocessor --replicas=5`
   - MongoDB replica set already at 3 nodes

---

**Version:** v0.1.1-rc3
**Release Date:** 2026-01-12
**MongoDB:** 3-node replica set (rs0)
**Services:** 8 services with replica set support

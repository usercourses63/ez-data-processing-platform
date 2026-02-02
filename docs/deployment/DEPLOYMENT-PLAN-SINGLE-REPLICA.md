# EZ Platform Deployment Plan - Single Replica Configuration

**Date:** January 28, 2026
**Objective:** Deploy EZ Platform with single replica for all services, using latest microservices built from source

---

## Phase 1: Environment Preparation

### 1.1 Clean Current Environment
```bash
# Stop all port forwards
taskkill /F /IM kubectl.exe

# Clean Minikube
minikube delete
minikube start --memory=8192 --cpus=4

# Verify cluster
kubectl cluster-info
```

**Success Criteria:** Fresh Minikube cluster running

---

### 1.2 Load Pre-Built Infrastructure Images
```bash
cd C:/Users/UserC/source/repos/EZ/deployment-v0.1.1-rc3-20260112-125216/images/infrastructure

# Load infrastructure images (MongoDB, Kafka, Prometheus, etc.)
docker load -i mongodb-8.0.tar
docker load -i kafka-7.5.0.tar
docker load -i zookeeper-7.5.0.tar
docker load -i hazelcast-5.6.tar
docker load -i prometheus-latest.tar
docker load -i grafana-latest.tar
docker load -i elasticsearch-8.17.0.tar
docker load -i jaeger-all-in-one.tar
docker load -i otel-collector-latest.tar
docker load -i rabbitmq-3-management.tar
docker load -i fluent-bit-latest.tar

# Load into Minikube
minikube image load mongo:8.0
minikube image load confluentinc/cp-kafka:7.5.0
minikube image load confluentinc/cp-zookeeper:7.5.0
minikube image load hazelcast/hazelcast:5.6
# ... (continue for all infrastructure images)
```

**Success Criteria:** All infrastructure images loaded in Minikube

---

## Phase 2: Build Latest Microservices from Source

### 2.1 Build .NET Services (8 services)
```bash
cd C:/Users/UserC/source/repos/EZ

# Build DataSourceManagement
docker build --no-cache -t ez-platform/datasource-management:latest -f src/Services/DataSourceManagementService/Dockerfile .
minikube image load ez-platform/datasource-management:latest

# Build FileProcessor
docker build --no-cache -t ez-platform/fileprocessor:latest -f src/Services/FileProcessorService/Dockerfile .
minikube image load ez-platform/fileprocessor:latest

# Build Validation
docker build --no-cache -t ez-platform/validation:latest -f src/Services/ValidationService/Dockerfile .
minikube image load ez-platform/validation:latest

# Build FileDiscovery
docker build --no-cache -t ez-platform/filediscovery:latest -f src/Services/FileDiscoveryService/Dockerfile .
minikube image load ez-platform/filediscovery:latest

# Build Output
docker build --no-cache -t ez-platform/output:latest -f src/Services/OutputService/Dockerfile .
minikube image load ez-platform/output:latest

# Build Scheduling
docker build --no-cache -t ez-platform/scheduling:latest -f src/Services/SchedulingService/Dockerfile .
minikube image load ez-platform/scheduling:latest

# Build MetricsConfiguration
docker build --no-cache -t ez-platform/metrics-configuration:latest -f src/Services/MetricsConfigurationService/Dockerfile .
minikube image load ez-platform/metrics-configuration:latest

# Build InvalidRecords
docker build --no-cache -t ez-platform/invalidrecords:latest -f src/Services/InvalidRecordsService/Dockerfile .
minikube image load ez-platform/invalidrecords:latest
```

**Success Criteria:** All 8 microservices built and loaded with `:latest` tag

---

### 2.2 Build Frontend
```bash
cd src/Frontend

# Build frontend
docker build --no-cache -t ez-platform/frontend:latest -f Dockerfile .
minikube image load ez-platform/frontend:latest
```

**Success Criteria:** Frontend built and loaded

---

## Phase 3: Create Custom Values File for Single Replicas

### 3.1 Create values-single-replica.yaml
```yaml
# Override default replicas to 1 for all services

services:
  datasourceManagement:
    replicas: 1
    image:
      repository: ez-platform/datasource-management
      tag: latest

  filediscovery:
    replicas: 1
    image:
      repository: ez-platform/filediscovery
      tag: latest

  fileprocessor:
    replicas: 1
    image:
      repository: ez-platform/fileprocessor
      tag: latest

  validation:
    replicas: 1
    image:
      repository: ez-platform/validation
      tag: latest

  output:
    replicas: 1
    image:
      repository: ez-platform/output
      tag: latest

  scheduling:
    replicas: 1
    image:
      repository: ez-platform/scheduling
      tag: latest

  metricsConfiguration:
    replicas: 1
    image:
      repository: ez-platform/metrics-configuration
      tag: latest

  invalidrecords:
    replicas: 1
    image:
      repository: ez-platform/invalidrecords
      tag: latest

  frontend:
    replicas: 1
    image:
      repository: ez-platform/frontend
      tag: latest

# Infrastructure - Single replicas
mongodb:
  replicas: 1  # Single node instead of 3-node replica set

kafka:
  replicas: 1  # Single Kafka broker

hazelcast:
  replicas: 1  # Single Hazelcast instance

rabbitmq:
  replicas: 1

# Disable network policies for development
networkPolicies:
  enabled: false
```

**Success Criteria:** Custom values file created

---

## Phase 4: Deploy Using Helm

### 4.1 Deploy EZ Platform
```bash
cd C:/Users/UserC/source/repos/EZ/deployment-v0.1.1-rc3-20260112-125216/helm/ez-platform

# Install with custom values
helm install ez-platform . \
  -n ez-platform \
  --create-namespace \
  -f values-single-replica.yaml

# Watch deployment progress
kubectl get pods -n ez-platform --watch
```

**Success Criteria:**
- All infrastructure pods Running (1/1)
- All microservice pods Running (1/1)
- No CrashLoopBackOff or ImagePullBackOff errors

---

### 4.2 Initialize MongoDB (if using single node)
```bash
# For single-node MongoDB, no replica set initialization needed
# Connection string: mongodb://mongodb:27017

# Verify MongoDB
kubectl exec -n ez-platform mongodb-0 -- mongosh --eval "db.version()"
```

**Success Criteria:** MongoDB accessible

---

## Phase 5: Generate Demo Data

### 5.1 Run Demo Data Generator
```bash
cd C:/Users/UserC/source/repos/EZ/tools/DemoDataGenerator

# Generate demo data
dotnet run
```

**Success Criteria:** Demo data created in MongoDB

---

## Phase 6: Start Port Forwarding & Access Frontend

### 6.1 Port Forward All Services
```bash
cd C:/Users/UserC/source/repos/EZ/scripts

# Use the existing port forward script
powershell.exe -ExecutionPolicy Bypass -File start-port-forwards.ps1
```

**Success Criteria:** All 19 ports forwarded

---

### 6.2 Access & Test Frontend
```bash
# Open frontend
start http://localhost:7000

# Test backend API
curl http://localhost:5001/health
curl http://localhost:5001/api/v1/datasources
```

**Success Criteria:**
- Frontend loads with data
- Backend APIs responding
- Data visible in UI

---

## Phase 7: Test with Playwright

### 7.1 Run E2E Tests
```bash
cd src/Frontend

# Run E2E tests
npm run test:e2e
```

**Success Criteria:** All E2E tests passing

---

## Troubleshooting

### Issue: ImagePullBackOff
**Solution:** Verify images loaded in Minikube
```bash
minikube image ls | grep ez-platform
```

### Issue: CrashLoopBackOff
**Solution:** Check logs
```bash
kubectl logs deployment/<service-name> -n ez-platform --tail=100
```

### Issue: MongoDB Connection Errors
**Solution:** Check ConfigMap
```bash
kubectl get configmap services-config -n ez-platform -o yaml
```

### Issue: Port Already in Use
**Solution:** Kill existing port forwards
```bash
taskkill /F /IM kubectl.exe
```

---

## Success Verification Checklist

- [ ] Minikube cluster running
- [ ] All infrastructure images loaded
- [ ] All microservices built from source (latest)
- [ ] Helm deployment successful
- [ ] All pods Running (1/1)
- [ ] MongoDB accessible
- [ ] Demo data generated
- [ ] Port forwarding active (19 ports)
- [ ] Frontend accessible at http://localhost:7000
- [ ] Data visible in UI
- [ ] Backend APIs responding
- [ ] E2E tests passing

---

## Estimated Time

- Phase 1: 5 minutes
- Phase 2: 15-20 minutes (parallel builds)
- Phase 3: 2 minutes
- Phase 4: 5-10 minutes
- Phase 5: 2 minutes
- Phase 6: 2 minutes
- Phase 7: 5 minutes

**Total:** ~40 minutes

---

## Key Differences from Standard Deployment

1. **Single Replicas:** All services running with 1 replica (easier to debug)
2. **Latest Images:** Microservices built from current source (not v0.1.1-rc3)
3. **Single MongoDB:** No replica set complexity
4. **No Network Policies:** Simplified networking for development
5. **Helm-Based:** Using Helm chart for cleaner deployment

---

## Next Steps After Successful Deployment

1. **Monitor Logs:** `kubectl logs -f deployment/<service> -n ez-platform`
2. **Check Metrics:** http://localhost:3001 (Grafana)
3. **View Traces:** http://localhost:16686 (Jaeger)
4. **Test Workflow:** Upload files, validate, output to destinations

---

**Status:** Ready to execute
**Dependencies:** Docker, Minikube, Helm, kubectl, .NET 10 SDK, Node.js

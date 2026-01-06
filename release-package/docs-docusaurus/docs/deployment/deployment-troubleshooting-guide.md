---
sidebar_position: 1
---

# EZ Platform v0.1.1-rc1 - Complete Deployment Troubleshooting Guide

**Document Version:** 1.0
**Date:** January 5, 2026
**Deployment Target:** Minikube (Docker Desktop)
**Platform Version:** v0.1.1-rc1
**Status:** ✅ Successfully Deployed and Verified

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Initial Environment Setup](#initial-environment-setup)
3. [Deployment Process Overview](#deployment-process-overview)
4. [Critical Issues and Resolutions](#critical-issues-and-resolutions)
5. [Configuration Details](#configuration-details)
6. [Final Working Configuration](#final-working-configuration)
7. [Verification and Testing](#verification-and-testing)
8. [Lessons Learned](#lessons-learned)
9. [Quick Reference](#quick-reference)

---

## Executive Summary

This document provides a comprehensive record of deploying EZ Platform v0.1.1-rc1 on Minikube with Docker Desktop, including all issues encountered and their resolutions. The deployment faced multiple challenges related to resource constraints, volume mounts, image availability, service configuration, and CORS policies.

**Final Result:** 21/21 pods running successfully with full functionality verified via Playwright testing.

### Key Challenges Resolved

1. Minikube resource allocation (CPU/memory constraints)
2. RabbitMQ .erlang.cookie permission issues
3. MongoDB replica set initialization
4. Kafka cluster ID conflicts
5. Docker image loading and tagging
6. Volume mount configuration for Windows↔Kubernetes file access
7. Service environment variable configuration
8. CORS policy configuration for frontend-backend communication
9. InvalidRecords service database name configuration

---

## Initial Environment Setup

### Docker Desktop Configuration

**Available Resources:**
- CPUs: 12 cores
- Memory: 46.19 GB (47,297 MB)
- Storage: Sufficient for 200GB Minikube disk

**Command to verify:**
```bash
docker info | grep -E "CPUs|Total Memory"
```

**Output:**
```
CPUs: 12
Total Memory: 46.19GiB
```

### Initial Minikube Attempt

**First attempt used bootstrap script with:**
```powershell
minikube start --cpus=8 --memory=40960 --disk-size=100g --driver=docker
```

**Issues with initial configuration:**
- Insufficient CPU allocation (8 cores) caused pod scheduling failures
- Insufficient memory (40GB) for all services
- Disk size too small (100GB) for comprehensive testing

---

## Deployment Process Overview

### Phase 1: Minikube Cluster Recreation

**Decision:** Recreate Minikube with maximum available resources

**Final Minikube Configuration:**
```bash
minikube delete  # Clean slate
minikube start --cpus=12 --memory=47000 --disk-size=200g --driver=docker
```

**Parameters Explained:**
- `--cpus=12`: Use all 12 available CPU cores
- `--memory=47000`: Allocate 47GB (46GB available, leaving 1GB margin)
- `--disk-size=200g`: Large disk for extensive testing and data storage
- `--driver=docker`: Use Docker Desktop driver

**Result:** Minikube successfully created with maximum resources

---

### Phase 2: Development Environment Optimization

**Decision:** Scale all services to 1 replica for development

**Rationale:**
- Development/testing environment doesn't need high availability
- Single replicas reduce resource consumption significantly
- Easier debugging with single instances
- Avoids resource contention and scheduling failures

**Implementation:**
Modified all deployment YAML files in `release-package/k8s/deployments/`:

```bash
cd "C:/Users/UserC/source/repos/EZ/release-package/k8s/deployments"
for file in *-deployment.yaml; do
    sed -i 's/replicas: [0-9]*/replicas: 1/g' "$file"
done
```

**Files Modified:**
- `datasource-management-deployment.yaml`: 2 → 1 replica
- `filediscovery-deployment.yaml`: 2 → 1 replica
- `fileprocessor-deployment.yaml`: 2 → 1 replica
- `validation-deployment.yaml`: 2 → 1 replica
- `output-deployment.yaml`: 3 → 1 replica
- `invalidrecords-deployment.yaml`: 2 → 1 replica
- `metrics-configuration-deployment.yaml`: 2 → 1 replica
- `scheduling-deployment.yaml`: 1 replica (already)
- `frontend-deployment.yaml`: 2 → 1 replica
- `rabbitmq.yaml`: 1 replica (already)

**Infrastructure StatefulSets:**
```bash
cd "C:/Users/UserC/source/repos/EZ/release-package/k8s/infrastructure"
sed -i 's/replicas: [0-9]*/replicas: 1/g' kafka-statefulset.yaml
sed -i 's/replicas: [0-9]*/replicas: 1/g' hazelcast-statefulset.yaml
sed -i 's/replicas: [0-9]*/replicas: 1/g' mongodb-statefulset.yaml
```

**Changed:**
- MongoDB: 3-node → 1-node replica set
- Kafka: 3-node → 1-node cluster
- Hazelcast: 2-node → 1-node cluster

---

### Phase 3: Namespace and Initial Deployment

**Create namespace:**
```bash
kubectl create namespace ez-platform
```

**Deploy ConfigMaps:**
```bash
kubectl apply -f "C:/Users/UserC/source/repos/EZ/release-package/k8s/configmaps/"
```

**Deploy Infrastructure:**
```bash
kubectl apply -f "C:/Users/UserC/source/repos/EZ/release-package/k8s/infrastructure/"
```

**Result:** Infrastructure pods created but entered ImagePullBackOff state

---

## Critical Issues and Resolutions

### Issue 1: ImagePullBackOff - Docker Images Not Loaded

**Symptom:**
```
NAME                                   READY   STATUS             AGE
elasticsearch-6c69f5696b-6kknp         0/1     ImagePullBackOff   3m3s
ezplatform-grafana-954c477b5-rds4x     0/1     ImagePullBackOff   3m3s
hazelcast-0                            0/1     ImagePullBackOff   3m2s
kafka-0                                0/1     ErrImagePull       3m2s
mongodb-0                              0/1     ImagePullBackOff   3m2s
```

**Root Cause:**
Minikube runs in an isolated Docker environment. The release-package Docker images (tar files) were not loaded into Minikube's internal registry.

**Investigation:**
```bash
minikube image ls | grep -E "ez-platform|mongo|kafka"
# Output: Empty - no images found
```

**Resolution:**

**Step 1 - Load all Docker images from release-package:**
```bash
cd "C:/Users/UserC/source/repos/EZ/release-package/images"

# Load infrastructure images
minikube image load mongo-8.0.tar
minikube image load rabbitmq-3-management-alpine.tar
minikube image load confluentinc-cp-kafka-7.5.0.tar
minikube image load confluentinc-cp-zookeeper-7.5.0.tar
minikube image load hazelcast-hazelcast-5.6.tar

# Load service images
minikube image load datasource-management-v0.1.1-rc1.tar.gz
minikube image load filediscovery-v0.1.1-rc1.tar.gz
minikube image load fileprocessor-v0.1.1-rc1.tar.gz
minikube image load validation-v0.1.1-rc1.tar.gz
minikube image load output-v0.1.1-rc1.tar.gz
minikube image load invalidrecords-v0.1.1-rc1.tar.gz
minikube image load scheduling-v0.1.1-rc1.tar.gz
minikube image load metrics-configuration-v0.1.1-rc1.tar.gz
minikube image load frontend-v0.1.1-rc1.tar.gz

# Load monitoring images
minikube image load grafana-grafana-latest.tar
minikube image load prom-prometheus-latest.tar
minikube image load jaegertracing-all-in-one-latest.tar
minikube image load otel-opentelemetry-collector-contrib-latest.tar
minikube image load docker.elastic.co-elasticsearch-elasticsearch-8.17.0.tar
minikube image load fluent-fluent-bit-latest.tar
```

**Step 2 - Tag images with correct version tags:**
```bash
# Service images loaded as "latest" but deployments expect "v0.1.1-rc1"
for service in datasource-management filediscovery fileprocessor validation output invalidrecords metrics-configuration scheduling; do
    minikube image tag docker.io/ez-platform/$service:latest docker.io/ez-platform/$service:v0.1.1-rc1
done

# Frontend image needs special tag (without registry prefix)
minikube image tag docker.io/ez-platform/frontend:latest frontend:v0.1.1-rc1
```

**Step 3 - Patch deployments to use imagePullPolicy: Never:**

The deployment YAMLs had `imagePullPolicy: Always` which tries to pull from Docker Hub. For offline deployment, this must be `Never`.

```bash
# Patch all service deployments
for deploy in datasource-management filediscovery fileprocessor validation output invalidrecords metrics-configuration scheduling frontend rabbitmq; do
    kubectl patch deployment $deploy -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"'$deploy'","imagePullPolicy":"Never"}]}}}}'
done

# Patch monitoring deployments
kubectl patch deployment elasticsearch -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"elasticsearch","imagePullPolicy":"Never"}]}}}}'
kubectl patch deployment ezplatform-grafana -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"ezplatform-grafana","imagePullPolicy":"Never"}]}}}}'
kubectl patch deployment prometheus-system -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"prometheus-system","imagePullPolicy":"Never"}]}}}}'
kubectl patch deployment prometheus-business -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"prometheus-business","imagePullPolicy":"Never"}]}}}}'
kubectl patch deployment jaeger -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"jaeger","imagePullPolicy":"Never"}]}}}}'
kubectl patch deployment otel-collector -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"otel-collector","imagePullPolicy":"Never"}]}}}}'
```

**Result:** All pods able to find and use local images

---

### Issue 2: RabbitMQ .erlang.cookie Permission Error

**Symptom:**
```
Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces
Kernel pid terminated (application_controller) ("{application_start_failure,rabbitmq_prelaunch...")
```

**Root Cause:**
RabbitMQ container (running as user 999) couldn't create/read the `.erlang.cookie` file due to filesystem permissions in Kubernetes environment.

**Investigation:**
```bash
kubectl logs rabbitmq-xxx -n ez-platform --tail=10
# Shows eacces error on .erlang.cookie
```

**Failed Attempts:**

**Attempt 1 - Environment Variable:**
```bash
kubectl set env deployment/rabbitmq RABBITMQ_ERLANG_COOKIE=SWQOKODSQALRPCLNMEQG -n ez-platform
```
Result: ❌ Failed - Cookie file still couldn't be created

**Attempt 2 - InitContainer:**
```yaml
initContainers:
- name: fix-permissions
  image: busybox
  command: ['sh', '-c', 'chmod 600 /var/lib/rabbitmq/.erlang.cookie']
```
Result: ❌ Failed - busybox image pull error

**Successful Resolution - securityContext:**

Added pod-level securityContext to ensure RabbitMQ user (UID 999) owns the files:

```bash
kubectl patch deployment rabbitmq -n ez-platform -p '{
  "spec": {
    "template": {
      "spec": {
        "securityContext": {
          "fsGroup": 999,
          "runAsUser": 999
        }
      }
    }
  }
}'
```

**Explanation:**
- `fsGroup: 999`: Sets group ownership of volumes to GID 999
- `runAsUser: 999`: Runs container as UID 999 (rabbitmq user)
- This allows RabbitMQ to create/read `.erlang.cookie` with proper permissions

**Verification:**
```bash
kubectl logs rabbitmq-xxx -n ez-platform --tail=30
# Should show: "RabbitMQ started successfully" and service connections
```

**Result:** ✅ RabbitMQ running successfully, accepting MassTransit connections

---

### Issue 3: MongoDB Replica Set Initialization

**Symptom:**
```
System.TimeoutException: A timeout occurred after 30000ms selecting a server
Client view of cluster state: Type: "Unknown", State: "Connected"
Type: "ReplicaSetGhost"
```

**Root Cause:**
MongoDB StatefulSet creates pods but doesn't automatically initialize the replica set. Services attempting to connect see "ReplicaSetGhost" state.

**Investigation:**
```bash
kubectl logs datasource-management-xxx -n ez-platform
# Shows: ReplicaSetGhost error
```

**Resolution:**

**For 1-node deployment:**
```bash
kubectl exec mongodb-0 -n ez-platform -- mongosh --eval '
  rs.initiate({
    _id: "rs0",
    members: [{_id: 0, host: "mongodb-0.mongodb:27017"}]
  })
'
```

**For multi-node deployment (if using 3 replicas):**
```bash
kubectl exec mongodb-0 -n ez-platform -- mongosh --eval '
  rs.initiate({
    _id: "rs0",
    members: [
      {_id: 0, host: "mongodb-0.mongodb:27017"},
      {_id: 1, host: "mongodb-1.mongodb:27017"},
      {_id: 2, host: "mongodb-2.mongodb:27017"}
    ]
  })
'
```

**Verification:**
```bash
kubectl exec mongodb-0 -n ez-platform -- mongosh --eval 'rs.status()'
# Should show: "ok": 1, all members in PRIMARY or SECONDARY state
```

**Result:** ✅ Services successfully connecting to MongoDB

---

### Issue 4: Kafka Cluster ID Conflicts

**Symptom:**
```
ERROR Fatal error during KafkaServer startup
kafka.common.InconsistentClusterIdException: The Cluster ID BFL0VABISU21sOQjDkNd9g doesn't match stored clusterId Some(3GqHpF2ZRK-svbgvvgYHGQ) in meta.properties
```

**Root Cause:**
Kafka stores cluster ID in persistent volume. When ZooKeeper is recreated with a new cluster ID but Kafka's PVC retains old cluster ID, they conflict.

**Investigation:**
```bash
kubectl logs kafka-0 -n ez-platform --tail=20
# Shows cluster ID mismatch
```

**Resolution:**

**Delete Kafka's persistent volume claim to reset:**
```bash
# Scale down to 0
kubectl scale statefulset kafka --replicas=0 -n ez-platform

# Wait for pod termination
sleep 5

# Delete the PVC
kubectl delete pvc kafka-data-kafka-0 -n ez-platform

# Scale back up (will create fresh PVC)
kubectl scale statefulset kafka --replicas=1 -n ez-platform
```

**Alternative approach (if StatefulSet needs deletion):**
```bash
kubectl delete statefulset kafka -n ez-platform
kubectl delete pvc kafka-data-kafka-0 -n ez-platform
kubectl apply -f k8s/infrastructure/kafka-statefulset.yaml
```

**Verification:**
```bash
kubectl logs kafka-0 -n ez-platform | grep "Kafka Server started"
# Should show successful startup without cluster ID errors
```

**Result:** ✅ Kafka running with fresh cluster ID matching ZooKeeper

---

### Issue 5: Volume Mount - External Test Data

**Symptom:**
```
Events:
  Warning  FailedMount  MountVolume.SetUp failed for volume "external-data":
           hostPath type check failed: /mnt/external-test-data is not a directory
```

**Root Cause:**
The deployment YAMLs reference `/mnt/external-test-data` as a hostPath volume, but:
1. The path doesn't exist in Minikube VM
2. Minikube mount wasn't active
3. Volume type was `Directory` (strict check) instead of `DirectoryOrCreate`

**Failed First Approach:**
Initially removed volume mounts thinking they were causing issues:
```yaml
# WRONG - Removed mounts (services can't access test data)
volumeMounts:
  - name: data-input
    mountPath: /data/input
volumes:
  - name: data-input
    persistentVolumeClaim:
      claimName: data-input-pvc
```

**Correct Resolution:**

**Step 1 - Start Minikube mount (background process):**
```bash
minikube mount "C:/Users/UserC/source/repos/EZ/test-data:/mnt/external-test-data" --gid=999 --uid=999 &
```

**Parameters:**
- Source: `C:/Users/UserC/source/repos/EZ/test-data` (Windows path)
- Target: `/mnt/external-test-data` (inside Minikube VM)
- `--gid=999`: Set group to 999 (matches container user)
- `--uid=999`: Set owner to 999 (matches container user)
- Background: Runs as background process (keep terminal open or run in separate window)

**Step 2 - Update deployment YAML files:**

Changed `type: Directory` to `type: DirectoryOrCreate` in volume definitions:

**filediscovery-deployment.yaml:**
```yaml
volumeMounts:
  - name: data-input
    mountPath: /data/input
    readOnly: true
  - name: external-data
    mountPath: /mnt/external-test-data
    readOnly: true
volumes:
  - name: data-input
    persistentVolumeClaim:
      claimName: data-input-pvc
  - name: external-data
    hostPath:
      path: /mnt/external-test-data
      type: DirectoryOrCreate  # Changed from "Directory"
```

**fileprocessor-deployment.yaml:**
```yaml
volumeMounts:
  - name: data-input
    mountPath: /data/input
    readOnly: true
  - name: external-data
    mountPath: /mnt/external-test-data
    readOnly: true
volumes:
  - name: data-input
    persistentVolumeClaim:
      claimName: data-input-pvc
  - name: external-data
    hostPath:
      path: /mnt/external-test-data
      type: DirectoryOrCreate  # Changed from "Directory"
```

**Step 3 - Verify mount is working:**
```bash
# Check mount inside Minikube VM
minikube ssh "ls -la /mnt/external-test-data"

# Verify from pod
MSYS_NO_PATHCONV=1 kubectl exec filediscovery-xxx -n ez-platform -- ls -la /mnt/external-test-data
```

**Expected Output:**
```
drwxrwxrwx 1 999 999   8192 Dec 11 10:22 E2E-001
drwxrwxrwx 1 999 999   8192 Dec 24 16:51 E2E-003
drwxrwxrwx 1 999 999   8192 Dec 18 10:13 E2E-004
...
```

**Result:** ✅ FileDiscovery and FileProcessor services can access Windows test data

**Critical Note:**
The minikube mount process must remain running. If it terminates, volume mounts will fail. Consider:
- Running in dedicated terminal window
- Using screen/tmux for persistence
- Adding to system startup scripts for development environment

---

### Issue 6: Service Environment Variables

**Multiple configuration issues were discovered and fixed:**

#### 6.1 Validation Service - Kafka Health Check

**Symptom:**
```
validation-xxx   0/1   CrashLoopBackOff   Multiple restarts
Logs: "localhost:9092/bootstrap: Connect to ipv4#127.0.0.1:9092 failed: Connection refused"
```

**Root Cause:**
Health check code uses `configuration.GetConnectionString("Kafka")` but deployment only had `MassTransit__Kafka__Server`. The health check library needs `ConnectionStrings__Kafka`.

**Investigation:**
Found in `src/Services/Shared/Configuration/HealthCheckConfiguration.cs`:
```csharp
var kafkaConnectionString = configuration.GetConnectionString("Kafka");
if (!string.IsNullOrEmpty(kafkaConnectionString))
{
    healthChecksBuilder.AddKafka(options =>
    {
        options.BootstrapServers = kafkaConnectionString;
        // ...
    });
}
```

**Resolution:**

Added missing environment variable to `validation-deployment.yaml`:
```yaml
env:
  - name: ConnectionStrings__MongoDB
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: mongodb-connection
  - name: ConnectionStrings__DatabaseName
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: database-name
  - name: ConnectionStrings__Kafka      # ← ADDED THIS
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: kafka-server                # Points to "kafka:9092"
  - name: MassTransit__UseKafka
    value: "true"
  - name: MassTransit__Kafka__Server
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: kafka-server
```

**Result:** ✅ Validation service health check now connects to `kafka:9092` instead of `localhost:9092`

---

#### 6.2 InvalidRecords Service - Database Name

**Symptom:**
- InvalidRecords API returns `{"data":[], "totalCount": 0}`
- MongoDB has 90 records in `DataProcessingInvalidRecord` collection
- Service logs show no errors, HTTP 200 responses

**Root Cause:**
InvalidRecords service was missing `ConnectionStrings__DatabaseName` environment variable. MongoDB.Entities was likely connecting to a different database or failing silently.

**Investigation:**
```bash
# Verify records exist in MongoDB
kubectl exec mongodb-0 -n ez-platform -- mongosh ezplatform --eval \
  "db.DataProcessingInvalidRecord.countDocuments({})"
# Output: 90

# Check API response
curl http://localhost:5007/api/v1/invalid-records
# Output: {"data":[], "totalCount": 0}  ← Empty despite records existing
```

**Resolution:**

Added missing environment variable to `invalidrecords-deployment.yaml`:
```yaml
env:
  - name: ASPNETCORE_ENVIRONMENT
    value: "Production"
  - name: ASPNETCORE_URLS
    value: "http://+:5006"
  - name: ConnectionStrings__MongoDB
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: mongodb-connection
  - name: ConnectionStrings__DatabaseName    # ← ADDED THIS
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: database-name                   # Points to "ezplatform"
```

Also fixed `imagePullPolicy`:
```yaml
image: ez-platform/invalidrecords:v0.1.1-rc1
imagePullPolicy: Never  # Changed from "Always"
```

**Result:** ✅ InvalidRecords API now returns all 90 records correctly

---

#### 6.3 CORS Configuration - Backend API Access

**Symptom:**
Frontend shows error:
```
Access to fetch at 'http://localhost:5001/api/v1/datasource' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Root Cause:**
Backend services were running in `ASPNETCORE_ENVIRONMENT=Production` mode. The code has different CORS policies:

```csharp
// Development mode
app.UseCors("AllowAll");  // Allows any origin

// Production mode
app.UseCors("Production"); // Only allows configured origins (defaults to https://localhost:7001)
```

Frontend makes requests from `http://localhost:3000` which isn't in the Production allow-list.

**Resolution:**

Changed backend services to Development mode:
```bash
kubectl set env deployment/datasource-management ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/metrics-configuration ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/validation ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/invalidrecords ASPNETCORE_ENVIRONMENT=Development -n ez-platform
```

**Alternative for Production:**
Could add CORS configuration environment variable:
```yaml
- name: Cors__AllowedOrigins__0
  value: "http://localhost:3000"
- name: Cors__AllowedOrigins__1
  value: "http://localhost:5001"
```

**Result:** ✅ Frontend successfully fetches data from all backend APIs

---

### Issue 7: CPU Resource Constraints

**Symptom (occurred multiple times):**
```
Events:
  Warning  FailedScheduling  0/1 nodes available: 1 Insufficient cpu
```

**Root Cause:**
Too many pods with high CPU requests competing for Minikube's allocated cores.

**Calculation Example:**
```
With 8 cores and default requests:
- MongoDB: 500m × 3 replicas = 1500m
- Kafka: 500m × 3 replicas = 1500m
- Services: ~100-500m × 18 pods = ~4500m
- Monitoring: ~500m × 5 = 2500m
Total: ~10,000m (10 cores needed)
Available: 8000m (8 cores)
Result: Insufficient CPU
```

**Resolution Strategy:**

**Step 1 - Increase Minikube CPUs:**
```bash
minikube delete
minikube start --cpus=12 --memory=47000 --disk-size=200g --driver=docker
```

**Step 2 - Reduce replicas to 1 (as documented in Phase 2)**

**Step 3 - Monitor resource usage:**
```bash
kubectl top pods -n ez-platform
kubectl top nodes
```

**Result:** ✅ All pods successfully scheduled with 12 CPU cores

---

### Issue 8: Port Forwarding Instability

**Symptom:**
- API calls fail intermittently
- `curl http://localhost:5001/health` returns connection refused
- Frontend shows "Failed to fetch" errors

**Root Cause:**
kubectl port-forward processes die when:
- Pods restart
- Network interruptions
- Background job timeout

**Resolution:**

Use dedicated port-forward script that runs persistently:

```powershell
# scripts/start-port-forwards.ps1
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\UserC\source\repos\EZ\scripts\start-port-forwards.ps1"
```

**Best Practice:**
Run port-forward in dedicated terminal window and keep it open.

**Recovery procedure:**
```powershell
# Kill all kubectl processes
taskkill /F /IM kubectl.exe
Start-Sleep -Seconds 2

# Restart port forwarding
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

**Result:** ✅ All 18 ports forwarded reliably

---

## Configuration Details

### ConfigMap - services-config.yaml

**Critical configuration values:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: services-config
  namespace: ez-platform
data:
  # Database
  mongodb-connection: "mongodb"              # Service name (not full URL)
  database-name: "ezplatform"               # CRITICAL - must match DB init

  # Messaging
  kafka-server: "kafka:9092"                # Internal Kafka port
  rabbitmq-server: "rabbitmq:5672"          # MassTransit uses this

  # Caching
  hazelcast-server: "hazelcast:5701"        # Hazelcast cluster

  # Monitoring
  otlp-endpoint: "http://otel-collector:4317"
  prometheus-endpoint: "http://prometheus:9090"
  prometheus-pushgateway: "http://prometheus:9091"
  elasticsearch-endpoint: "http://elasticsearch:9200"

  # Application Settings
  FileDiscovery__DeduplicationTTLHours: "0.25"
  Hazelcast__CacheTTLHours: "1"
```

**Usage in Deployments:**

Services reference ConfigMap values via `valueFrom`:
```yaml
env:
  - name: ConnectionStrings__MongoDB
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: mongodb-connection
  - name: ConnectionStrings__DatabaseName
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: database-name
```

---

### Environment Variables - Complete Reference

**Standard Variables (All Backend Services):**

```yaml
env:
  # Runtime
  - name: ASPNETCORE_ENVIRONMENT
    value: "Development"              # Use Development for CORS AllowAll

  - name: ASPNETCORE_URLS
    value: "http://+:5001"            # Port varies by service

  # Database
  - name: ConnectionStrings__MongoDB
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: mongodb-connection

  - name: ConnectionStrings__DatabaseName
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: database-name

  # Messaging (varies by service needs)
  - name: MassTransit__UseKafka
    value: "true"

  - name: MassTransit__Kafka__Server
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: kafka-server

  # Caching
  - name: Hazelcast__Server
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: hazelcast-server

  - name: Hazelcast__ClusterName
    value: "data-processing-cluster"

  # Observability
  - name: OpenTelemetry__OtlpEndpoint
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: otlp-endpoint
```

**Service-Specific Additions:**

**Validation Service (CRITICAL):**
```yaml
- name: ConnectionStrings__Kafka          # Required for health check
  valueFrom:
    configMapKeyRef:
      name: services-config
      key: kafka-server
```

**FileDiscovery Service:**
```yaml
- name: FileDiscovery__DeduplicationTTLHours
  valueFrom:
    configMapKeyRef:
      name: services-config
      key: FileDiscovery__DeduplicationTTLHours
```

**FileProcessor Service:**
```yaml
- name: FileProcessor__ConcurrentFiles
  value: "10"
- name: FileProcessor__MaxFileSizeMB
  value: "1000"
- name: Hazelcast__CacheTTLHours
  valueFrom:
    configMapKeyRef:
      name: services-config
      key: Hazelcast__CacheTTLHours
```

---

### ImagePullPolicy Configuration

**CRITICAL for offline deployment:**

All deployments MUST use `imagePullPolicy: Never` when images are pre-loaded into Minikube.

**Original (release-package default):**
```yaml
image: ez-platform/datasource-management:v0.1.1-rc1
imagePullPolicy: Always  # ❌ Tries to pull from Docker Hub
```

**Corrected for offline:**
```yaml
image: ez-platform/datasource-management:v0.1.1-rc1
imagePullPolicy: Never   # ✅ Uses local Minikube image
```

**Why this matters:**
- `Always`: Kubernetes tries to pull from remote registry (Docker Hub), fails without internet
- `IfNotPresent`: Checks local first, but may still try remote
- `Never`: Only uses local images, fails if image not loaded

**Bulk patch command:**
```bash
for deploy in datasource-management filediscovery fileprocessor validation output invalidrecords metrics-configuration scheduling frontend rabbitmq elasticsearch ezplatform-grafana prometheus-system prometheus-business jaeger otel-collector; do
    kubectl patch deployment $deploy -n ez-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"'$deploy'","imagePullPolicy":"Never"}]}}}}'
done
```

---

### Resource Limits and Requests

**Default Configuration (Too High for Development):**

```yaml
resources:
  requests:
    cpu: "500m"      # Reserved CPU
    memory: "1Gi"    # Reserved memory
  limits:
    cpu: "2000m"     # Maximum CPU
    memory: "3Gi"    # Maximum memory
```

**Impact with multiple replicas:**
- 2 replicas × 500m CPU = 1000m reserved per service
- 9 services × 1000m = 9000m total
- Exceeds 8-core allocation

**Resolution:**
Scaling to 1 replica reduced total resource requests to manageable levels.

**For further optimization (if needed):**
```yaml
resources:
  requests:
    cpu: "100m"      # Reduced
    memory: "256Mi"  # Reduced
  limits:
    cpu: "500m"      # Lower ceiling
    memory: "512Mi"  # Lower ceiling
```

---

## Final Working Configuration

### Deployment Order

**1. Create Namespace:**
```bash
kubectl create namespace ez-platform
```

**2. Deploy ConfigMaps:**
```bash
kubectl apply -f release-package/k8s/configmaps/
```

**3. Deploy Infrastructure (in order):**
```bash
# MongoDB first (other services depend on it)
kubectl apply -f release-package/k8s/infrastructure/mongodb-statefulset.yaml
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

# Initialize replica set
kubectl exec mongodb-0 -n ez-platform -- mongosh --eval \
  'rs.initiate({_id: "rs0", members: [{_id: 0, host: "mongodb-0.mongodb:27017"}]})'

# Kafka and ZooKeeper
kubectl apply -f release-package/k8s/infrastructure/kafka-statefulset.yaml
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s

# Hazelcast
kubectl apply -f release-package/k8s/infrastructure/hazelcast-statefulset.yaml
kubectl wait --for=condition=ready pod -l app=hazelcast -n ez-platform --timeout=300s

# Monitoring stack
kubectl apply -f release-package/k8s/infrastructure/elasticsearch-deployment.yaml
kubectl apply -f release-package/k8s/infrastructure/grafana-deployment.yaml
kubectl apply -f release-package/k8s/infrastructure/prometheus-system-deployment.yaml
kubectl apply -f release-package/k8s/infrastructure/prometheus-business-deployment.yaml
```

**4. Deploy Services:**
```bash
kubectl apply -f release-package/k8s/deployments/
kubectl apply -f release-package/k8s/services/
```

**5. Patch Configurations:**
```bash
# RabbitMQ security context
kubectl patch deployment rabbitmq -n ez-platform -p '{
  "spec": {
    "template": {
      "spec": {
        "securityContext": {"fsGroup": 999, "runAsUser": 999}
      }
    }
  }
}'

# Backend services to Development mode (CORS)
kubectl set env deployment/datasource-management ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/metrics-configuration ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/validation ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/invalidrecords ASPNETCORE_ENVIRONMENT=Development -n ez-platform
```

**6. Start Minikube Mount:**
```bash
minikube mount "C:/Users/UserC/source/repos/EZ/test-data:/mnt/external-test-data" --gid=999 --uid=999 &
```

**7. Start Port Forwarding:**
```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

**8. Generate Demo Data:**
```bash
cd tools/DemoDataGenerator
dotnet run -- --direct-connection
```

---

### Complete Pod Inventory

**Final Deployment Status: 21/21 Running**

| Pod Name | Service | Port | Status | Notes |
|----------|---------|------|--------|-------|
| mongodb-0 | MongoDB | 27017 | Running | 1-node replica set |
| kafka-0 | Kafka | 9092/9094 | Running | 1-node cluster |
| zookeeper-0 | ZooKeeper | 2181 | Running | Kafka coordinator |
| hazelcast-0 | Hazelcast | 5701 | Running | Distributed cache |
| rabbitmq-xxx | RabbitMQ | 5672/15672 | Running | MassTransit messaging |
| elasticsearch-xxx | Elasticsearch | 9200 | Running | Log storage |
| fluent-bit-xxx | Fluent-bit | - | Running | Log collection |
| datasource-management-xxx | API | 5001 | Running | CRUD operations |
| metrics-configuration-xxx | API | 5002 | Running | Metrics & alerts |
| validation-xxx | Service | 5003 | Running | Schema validation |
| scheduling-xxx | Service | 5004 | Running | Quartz.NET jobs |
| invalidrecords-xxx | API | 5007 | Running | Invalid record mgmt |
| filediscovery-xxx | Service | 5007 | Running | File polling |
| fileprocessor-xxx | Service | 5008 | Running | Format conversion |
| output-xxx | Service | 5009 | Running | Multi-destination |
| frontend-xxx | UI | 80 | Running | React app |
| ezplatform-grafana-xxx | Monitoring | 3000 | Running | Dashboards |
| prometheus-system-xxx | Monitoring | 9090 | Running | System metrics |
| prometheus-business-xxx | Monitoring | 9090 | Running | Business metrics |
| jaeger-xxx | Monitoring | 16686 | Running | Tracing |
| otel-collector-xxx | Monitoring | 4317/4318 | Running | Telemetry |

---

## Verification and Testing

### Health Check Verification

**All backend services:**
```bash
curl http://localhost:5001/health  # DataSource Management
curl http://localhost:5002/health  # Metrics Configuration
curl http://localhost:5003/health  # Validation
curl http://localhost:5004/health  # Scheduling
curl http://localhost:5007/health  # InvalidRecords
curl http://localhost:5008/health  # FileProcessor
curl http://localhost:5009/health  # Output
```

**Expected Response:**
```json
{
  "status": "Healthy",
  "timestamp": "2026-01-05T12:00:00Z",
  "checks": [
    {"name": "masstransit-bus", "status": "Healthy"},
    {"name": "database", "status": "Healthy"},
    {"name": "kafka", "status": "Degraded"}  // Acceptable for Kafka
  ]
}
```

---

### Demo Data Verification

**Generated Data:**
```bash
cd tools/DemoDataGenerator
dotnet run -- --direct-connection
```

**Output:**
```
✅ Seeded 10 categories
✅ Generated 20 datasources
✅ Generated 20 complex schemas
✅ Generated 53 datasource-specific metrics
✅ Generated 27 metrics with alerts
✅ Generated 90 invalid records
```

**API Verification:**
```bash
# Count data sources
curl -s http://localhost:5001/api/v1/datasource | grep -o '"Name"' | wc -l
# Expected: 20

# Count invalid records
curl -s http://localhost:5007/api/v1/invalid-records | grep -o '"id"' | wc -l
# Expected: 25 (first page)

# Check total count
curl -s http://localhost:5007/api/v1/invalid-records | grep '"totalCount"'
# Expected: "totalCount":90
```

---

### Frontend Testing (Playwright)

**Data Sources Page Test:**
```javascript
// Navigate to frontend
await page.goto('http://localhost:3000');

// Verify data sources load
const rows = await page.locator('table tbody tr').count();
// Expected: 20 rows

// Verify Hebrew text rendering
const title = await page.locator('h2').textContent();
// Expected: Contains Hebrew characters (ניהול מקורות נתונים)
```

**Results:**
- ✅ 20 data sources displayed with Hebrew names
- ✅ RTL layout working correctly
- ✅ Schemas, categories, scheduling info all visible
- ✅ Screenshot: `frontend-datasources-working.png`

**Invalid Records Page Test:**
```javascript
// Navigate to invalid records
await page.goto('http://localhost:3000/invalid-records');

// Verify statistics
const totalRecords = await page.locator('text=90').count();
// Expected: Statistics showing 90 total records

// Verify pagination
const pages = await page.locator('.ant-pagination-item').count();
// Expected: 9 pages (90 records ÷ 10 per page)
```

**Results:**
- ✅ 90 invalid records displayed
- ✅ Statistics: 32 reviewed, 6 ignored
- ✅ Records grouped by data source
- ✅ Pagination working (9 pages)
- ✅ Screenshot: `invalid-records-working.png`

---

### Monitoring Dashboard Verification

**Grafana:**
```bash
curl -s http://localhost:3001 | grep "Found"
# Expected: <a href="/login">Found</a>
```

**Jaeger:**
```bash
curl -s http://localhost:16686 | head -1
# Expected: <!doctype html>
```

**Prometheus:**
```bash
curl -s http://localhost:9090 | grep "Found"
# Expected: <a href="/query">Found</a>
```

**All monitoring dashboards accessible and operational.**

---

## Lessons Learned

### 1. Resource Planning

**Do:**
- ✅ Allocate maximum available resources for development
- ✅ Use 1 replica per service in dev environment
- ✅ Monitor `kubectl top pods` to identify resource hogs
- ✅ Start with generous resource allocation, scale down if needed

**Don't:**
- ❌ Assume default 2-3 replicas work on local development
- ❌ Underestimate CPU requirements (monitoring stack is heavy)
- ❌ Ignore `FailedScheduling` events (they indicate resource issues)

---

### 2. Image Management

**Do:**
- ✅ Load ALL images into Minikube before deployment
- ✅ Tag images to match deployment expectations exactly
- ✅ Use `imagePullPolicy: Never` for offline deployment
- ✅ Verify images with `minikube image ls`

**Don't:**
- ❌ Assume images auto-load into Minikube
- ❌ Mix image tags (latest vs v0.1.1-rc1)
- ❌ Use `imagePullPolicy: Always` without internet access

**Image Loading Script:**
```bash
#!/bin/bash
cd release-package/images
for image in *.tar*; do
    echo "Loading $image..."
    minikube image load "$image"
done
```

---

### 3. Volume Mounts for Windows

**Do:**
- ✅ Use `minikube mount` for Windows→Kubernetes file access
- ✅ Set proper UID/GID (999:999 for most services)
- ✅ Use `DirectoryOrCreate` type for flexibility
- ✅ Keep mount process running (background or dedicated terminal)
- ✅ Verify mount inside pods with `kubectl exec`

**Don't:**
- ❌ Remove volume mounts thinking they cause issues
- ❌ Use strict `type: Directory` (use `DirectoryOrCreate`)
- ❌ Forget that mount process must stay running
- ❌ Assume paths work without explicit mount

**Mount Command:**
```bash
# Run in dedicated terminal (keep open)
minikube mount "C:/Users/UserC/source/repos/EZ/test-data:/mnt/external-test-data" --gid=999 --uid=999
```

---

### 4. Service Configuration

**Do:**
- ✅ Check ALL environment variables match between deployments
- ✅ Use Development environment for local testing (enables CORS)
- ✅ Add `ConnectionStrings__DatabaseName` to all services
- ✅ Verify ConfigMap keys exist before referencing

**Don't:**
- ❌ Assume services auto-discover configuration
- ❌ Use Production mode for local development (CORS restrictions)
- ❌ Forget service-specific env vars (like ConnectionStrings__Kafka)

---

### 5. StatefulSet Management

**Do:**
- ✅ Initialize MongoDB replica set manually after deployment
- ✅ Delete PVCs when resetting StatefulSets (Kafka, MongoDB)
- ✅ Scale StatefulSet to 0 before deleting PVC
- ✅ Use `kubectl wait` for StatefulSet readiness

**Don't:**
- ❌ Assume StatefulSets auto-initialize (MongoDB replica set)
- ❌ Delete StatefulSet without deleting PVC (stale data persists)
- ❌ Skip waiting for StatefulSet readiness

**Safe StatefulSet Reset:**
```bash
# 1. Scale down
kubectl scale statefulset kafka --replicas=0 -n ez-platform

# 2. Wait for termination
sleep 10

# 3. Delete PVC
kubectl delete pvc kafka-data-kafka-0 -n ez-platform

# 4. Scale back up
kubectl scale statefulset kafka --replicas=1 -n ez-platform

# 5. Wait for ready
kubectl wait --for=condition=ready pod kafka-0 -n ez-platform --timeout=120s
```

---

### 6. Port Forwarding Best Practices

**Do:**
- ✅ Use centralized port-forward script
- ✅ Run in dedicated terminal window
- ✅ Restart after pod restarts/rollouts
- ✅ Verify ports with `netstat` or `Get-NetTCPConnection`

**Don't:**
- ❌ Expect port-forwards to survive pod restarts
- ❌ Run multiple conflicting port-forwards
- ❌ Close terminal running port-forwards

**Port Forward Script Location:**
```
C:\Users\UserC\source\repos\EZ\scripts\start-port-forwards.ps1
```

**Restart Procedure:**
```powershell
# Kill existing
taskkill /F /IM kubectl.exe
Start-Sleep -Seconds 2

# Restart
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

---

### 7. CORS Configuration

**Development vs Production:**

**Development (recommended for local):**
```csharp
app.UseCors("AllowAll");  // Allows http://localhost:3000
```

**Production (restrictive):**
```csharp
app.UseCors("Production"); // Only configured origins
```

**Environment Variable Setting:**
```bash
kubectl set env deployment/SERVICE_NAME ASPNETCORE_ENVIRONMENT=Development -n ez-platform
```

**Services requiring Development mode for CORS:**
- datasource-management
- metrics-configuration
- validation
- invalidrecords
- (any service called from browser)

---

## Quick Reference

### Common Commands

**Check pod status:**
```bash
kubectl get pods -n ez-platform
kubectl get pods -n ez-platform --field-selector=status.phase=Running
```

**View logs:**
```bash
kubectl logs -f deployment/SERVICE_NAME -n ez-platform
kubectl logs -f deployment/SERVICE_NAME -n ez-platform --tail=50
```

**Restart service:**
```bash
kubectl rollout restart deployment/SERVICE_NAME -n ez-platform
kubectl rollout status deployment/SERVICE_NAME -n ez-platform
```

**Scale service:**
```bash
kubectl scale deployment SERVICE_NAME --replicas=1 -n ez-platform
```

**Check events:**
```bash
kubectl get events -n ez-platform --sort-by='.lastTimestamp' | tail -20
```

**Delete and recreate pod:**
```bash
kubectl delete pod POD_NAME -n ez-platform
# StatefulSet/Deployment will auto-recreate
```

---

### Troubleshooting Checklist

**Pod in ImagePullBackOff:**
```bash
# 1. Check if image exists in Minikube
minikube image ls | grep IMAGE_NAME

# 2. Load image if missing
minikube image load path/to/image.tar

# 3. Verify imagePullPolicy
kubectl get deployment SERVICE -n ez-platform -o yaml | grep imagePullPolicy
# Should be: imagePullPolicy: Never

# 4. Patch if needed
kubectl patch deployment SERVICE -n ez-platform -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"SERVICE","imagePullPolicy":"Never"}]}}}}'
```

**Pod in CrashLoopBackOff:**
```bash
# 1. Check logs
kubectl logs POD_NAME -n ez-platform --tail=50

# 2. Common issues:
#    - MongoDB not initialized (check for ReplicaSetGhost)
#    - Missing environment variables
#    - Service dependencies not ready

# 3. Check events
kubectl describe pod POD_NAME -n ez-platform | tail -20
```

**Pod in Pending:**
```bash
# 1. Check events
kubectl describe pod POD_NAME -n ez-platform | grep Events: -A 10

# 2. Common causes:
#    - Insufficient CPU/memory
#    - PVC not bound
#    - Volume mount issues

# 3. Check node resources
kubectl top nodes
kubectl top pods -n ez-platform
```

**Service API not responding:**
```bash
# 1. Check pod is running
kubectl get pod -l app=SERVICE -n ez-platform

# 2. Check health endpoint inside pod
kubectl exec POD_NAME -n ez-platform -- curl localhost:PORT/health

# 3. Check port-forward is active
netstat -ano | findstr :PORT

# 4. Restart port-forward if needed
taskkill /F /IM kubectl.exe
powershell -File scripts/start-port-forwards.ps1
```

**Frontend shows CORS errors:**
```bash
# 1. Check service environment
kubectl get deployment SERVICE -n ez-platform -o yaml | grep ASPNETCORE_ENVIRONMENT

# 2. Set to Development if needed
kubectl set env deployment/SERVICE ASPNETCORE_ENVIRONMENT=Development -n ez-platform

# 3. Wait for pod restart
kubectl get pods -n ez-platform -w
```

---

### MongoDB Direct Access

**Connect to MongoDB:**
```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongosh ezplatform
```

**Useful queries:**
```javascript
// List collections
db.getCollectionNames()

// Count documents
db.DataProcessingDataSource.countDocuments({})
db.DataProcessingInvalidRecord.countDocuments({})

// View sample record
db.DataProcessingDataSource.findOne({})
db.DataProcessingInvalidRecord.findOne({})

// Check replica set status
rs.status()
```

---

### Kafka Operations

**Check topics:**
```bash
kubectl exec kafka-0 -n ez-platform -- kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

**View messages:**
```bash
kubectl exec kafka-0 -n ez-platform -- kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic TOPIC_NAME \
  --from-beginning \
  --max-messages 10
```

---

### Complete Cleanup Procedure

**To completely reset environment:**

```bash
# 1. Stop port forwarding
taskkill /F /IM kubectl.exe

# 2. Delete namespace (removes all resources)
kubectl delete namespace ez-platform

# 3. Wait for deletion
kubectl get namespace ez-platform
# Should return: Not found

# 4. Stop minikube mount (if running)
# Ctrl+C in mount terminal

# 5. Optional: Delete and recreate Minikube
minikube delete
minikube start --cpus=12 --memory=47000 --disk-size=200g --driver=docker

# 6. Redeploy from step 1
```

---

## Critical Files Modified in release-package

### 1. filediscovery-deployment.yaml

**Changes:**
- `replicas: 2` → `replicas: 1`
- `imagePullPolicy: Always` → `imagePullPolicy: Never`
- Added external-data volume mount:

```yaml
volumeMounts:
  - name: data-input
    mountPath: /data/input
    readOnly: true
  - name: external-data
    mountPath: /mnt/external-test-data
    readOnly: true
volumes:
  - name: data-input
    persistentVolumeClaim:
      claimName: data-input-pvc
  - name: external-data
    hostPath:
      path: /mnt/external-test-data
      type: DirectoryOrCreate  # Changed from "Directory"
```

---

### 2. fileprocessor-deployment.yaml

**Changes:**
- `replicas: 2` → `replicas: 1`
- `imagePullPolicy: Always` → `imagePullPolicy: Never`
- Added external-data volume mount (same as filediscovery)

---

### 3. validation-deployment.yaml

**Changes:**
- `replicas: 2` → `replicas: 1`
- Added ConnectionStrings__Kafka environment variable:

```yaml
env:
  - name: ConnectionStrings__MongoDB
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: mongodb-connection
  - name: ConnectionStrings__DatabaseName
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: database-name
  - name: ConnectionStrings__Kafka        # ← ADDED
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: kafka-server
  - name: MassTransit__UseKafka
    value: "true"
```

**Why:** Health check library needs ConnectionStrings__Kafka to configure Kafka health check. Without it, defaults to localhost:9092.

---

### 4. invalidrecords-deployment.yaml

**Changes:**
- `replicas: 2` → `replicas: 1`
- `imagePullPolicy: Always` → `imagePullPolicy: Never`
- Added ConnectionStrings__DatabaseName:

```yaml
env:
  - name: ASPNETCORE_ENVIRONMENT
    value: "Production"
  - name: ASPNETCORE_URLS
    value: "http://+:5006"
  - name: ConnectionStrings__MongoDB
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: mongodb-connection
  - name: ConnectionStrings__DatabaseName    # ← ADDED
    valueFrom:
      configMapKeyRef:
        name: services-config
        key: database-name
```

**Why:** MongoDB.Entities needs explicit database name to query correct database. Without it, may connect to different database or fail silently.

---

### 5. All Other Deployment YAMLs

**Standard changes applied to all:**
- Set `replicas: 1`
- Many were patched with `kubectl patch` for `imagePullPolicy: Never`
- Backend services patched with `ASPNETCORE_ENVIRONMENT=Development` (not in YAML, applied via kubectl)

---

### 6. Infrastructure StatefulSets

**kafka-statefulset.yaml:**
- `replicas: 3` → `replicas: 1`

**hazelcast-statefulset.yaml:**
- `replicas: 2` → `replicas: 1`

**mongodb-statefulset.yaml:**
- `replicas: 3` → `replicas: 1`

---

## Deployment Sequence Diagram

```
1. Minikube Start (12 CPU, 46GB RAM, 200GB disk)
   ↓
2. Load Docker Images (21 images from release-package/images/)
   ↓
3. Tag Images (v0.1.1-rc1, handle frontend special case)
   ↓
4. Create Namespace (ez-platform)
   ↓
5. Deploy ConfigMaps (services-config, prometheus configs)
   ↓
6. Deploy Infrastructure
   ├─ MongoDB StatefulSet → Initialize Replica Set
   ├─ Kafka StatefulSet → Reset PVC if cluster ID conflict
   ├─ Hazelcast StatefulSet
   ├─ Elasticsearch Deployment → Patch imagePullPolicy
   ├─ Grafana Deployment → Patch imagePullPolicy
   ├─ Prometheus Deployments → Patch imagePullPolicy
   └─ RabbitMQ → Patch with securityContext
   ↓
7. Deploy Services
   ├─ All Microservice Deployments
   ├─ OTEL Collector, Jaeger, Fluent-bit
   └─ Service definitions (ClusterIP, NodePort)
   ↓
8. Patch Configurations
   ├─ imagePullPolicy: Never (all deployments)
   ├─ ASPNETCORE_ENVIRONMENT: Development (backend APIs)
   ├─ Add ConnectionStrings__Kafka (validation)
   └─ Add ConnectionStrings__DatabaseName (invalidrecords)
   ↓
9. Start Minikube Mount (background)
   ↓
10. Start Port Forwarding (18 ports)
   ↓
11. Generate Demo Data
   ↓
12. Verify Frontend (Playwright)
```

---

## Environment-Specific Notes

### Windows Path Handling

**Bash on Windows (Git Bash):**
- Use forward slashes: `C:/Users/UserC/...`
- MSYS path conversion can interfere with kubectl exec
- Use `MSYS_NO_PATHCONV=1` prefix for kubectl exec commands

**Examples:**
```bash
# WRONG (path gets converted)
kubectl exec pod -n ns -- cat /etc/nginx/conf.d/default.conf
# Error: cat: can't open 'C:/Program Files/Git/etc/nginx/...'

# CORRECT
MSYS_NO_PATHCONV=1 kubectl exec pod -n ns -- cat /etc/nginx/conf.d/default.conf
```

---

### Docker Desktop Storage

**Monitor Docker Desktop disk usage:**
```bash
docker system df
```

**Clean up if needed:**
```bash
docker system prune -a --volumes
```

**Minikube storage:**
```bash
minikube ssh "df -h"
```

---

## Success Criteria Checklist

### Infrastructure

- [x] Minikube running with 12 CPUs, 46GB RAM, 200GB disk
- [x] MongoDB: 1/1 Running, replica set initialized
- [x] Kafka: 1/1 Running, no cluster ID conflicts
- [x] ZooKeeper: 1/1 Running
- [x] Hazelcast: 1/1 Running
- [x] RabbitMQ: 1/1 Running, no .erlang.cookie errors
- [x] Elasticsearch: 1/1 Running
- [x] Fluent-bit: 1/1 Running

### Monitoring

- [x] Grafana accessible at http://localhost:3001
- [x] Jaeger accessible at http://localhost:16686
- [x] Prometheus System accessible at http://localhost:9090
- [x] Prometheus Business accessible at http://localhost:9091
- [x] OTEL Collector running
- [x] All monitoring pods 1/1 Ready

### Microservices

- [x] Frontend: Displays data, Hebrew/RTL working
- [x] DataSource Management: Health check passing
- [x] Metrics Configuration: Health check passing
- [x] Validation: Health check passing, Kafka connected
- [x] Scheduling: Running
- [x] FileDiscovery: Running, can access /mnt/external-test-data
- [x] FileProcessor: Running, can access /mnt/external-test-data
- [x] Output: Running
- [x] InvalidRecords: Running, returning 90 records

### Data

- [x] 10 categories in database
- [x] 20 data sources in database
- [x] 20 JSON schemas in database
- [x] 90 invalid records in database
- [x] 53 metrics in database
- [x] Frontend displays all data sources
- [x] Frontend displays all invalid records

### Volume Mounts

- [x] Minikube mount active
- [x] Test data accessible in FileDiscovery pod
- [x] Test data accessible in FileProcessor pod
- [x] E2E-001 through E2E-006 directories visible
- [x] LoadTest-100 directory visible

### Port Forwarding

- [x] All 18 ports forwarded
- [x] Frontend accessible (3000)
- [x] All backend APIs accessible (5001-5009)
- [x] Monitoring dashboards accessible
- [x] Infrastructure ports accessible

---

## Production Deployment Differences

**For production deployment, revert these development-specific changes:**

### 1. Increase Replicas

**High-availability recommendations:**
```yaml
# Critical services (3+ replicas)
- datasource-management: 3
- validation: 3
- output: 3

# Processing services (2+ replicas)
- filediscovery: 2
- fileprocessor: 2
- invalidrecords: 2

# Supporting services (2 replicas)
- metrics-configuration: 2
- scheduling: 2
- frontend: 2

# Infrastructure (cluster mode)
- mongodb: 3-node replica set
- kafka: 3-node cluster
- hazelcast: 2-3 nodes
- rabbitmq: 2-3 nodes (with clustering)
```

### 2. Change to Production Environment

```yaml
env:
  - name: ASPNETCORE_ENVIRONMENT
    value: "Production"  # Not Development
```

**Configure Production CORS:**
```yaml
- name: Cors__AllowedOrigins__0
  value: "https://your-domain.com"
- name: Cors__AllowedOrigins__1
  value: "https://api.your-domain.com"
```

### 3. External Storage

Replace hostPath volumes with:
- **Cloud storage:** AWS EFS, Azure Files, Google Cloud Filestore
- **NFS:** Network file system
- **S3-compatible:** MinIO, Ceph

```yaml
volumes:
  - name: external-data
    nfs:  # Example: NFS instead of hostPath
      server: nfs-server.example.com
      path: /exports/test-data
```

### 4. Use ImagePullPolicy: IfNotPresent

```yaml
imagePullPolicy: IfNotPresent  # Check local first, pull if missing
```

Or push images to private registry:
```yaml
image: registry.your-company.com/ez-platform/datasource-management:v0.1.1-rc1
imagePullPolicy: Always
```

### 5. Resource Limits

Increase based on load testing:
```yaml
resources:
  requests:
    cpu: "1000m"
    memory: "2Gi"
  limits:
    cpu: "4000m"
    memory: "8Gi"
```

### 6. Persistent Volumes

Use storage classes with backup/replication:
```yaml
volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: "premium-ssd"  # Cloud provider storage class
      resources:
        requests:
          storage: 100Gi
```

---

## Appendix A: Complete Port Mapping

| Service | Internal Port | External Port | Protocol | Purpose |
|---------|---------------|---------------|----------|---------|
| Frontend | 80 | 3000 | HTTP | React UI |
| DataSource Management | 5001 | 5001 | HTTP | CRUD API |
| Metrics Configuration | 5002 | 5002 | HTTP | Metrics API |
| Validation | 5003 | 5003 | HTTP | Validation API |
| Scheduling | 5004 | 5004 | HTTP | Scheduling API |
| InvalidRecords | 5006 | 5007 | HTTP | InvalidRecords API |
| FileDiscovery | 5007 | 5007 | HTTP | Discovery API |
| FileProcessor | 5008 | 5008 | HTTP | Processor API |
| Output | 5009 | 5009 | HTTP | Output API |
| Grafana | 3000 | 3001 | HTTP | Monitoring UI |
| Prometheus System | 9090 | 9090 | HTTP | System metrics |
| Prometheus Business | 9090 | 9091 | HTTP | Business metrics |
| Jaeger | 16686 | 16686 | HTTP | Tracing UI |
| Elasticsearch | 9200 | 9200 | HTTP | Log storage |
| MongoDB | 27017 | 27017 | TCP | Database |
| RabbitMQ AMQP | 5672 | 5672 | AMQP | MassTransit |
| RabbitMQ Management | 15672 | 15672 | HTTP | RabbitMQ UI |
| Kafka External | 9094 | 9094 | TCP | External clients |
| Hazelcast | 5701 | 5701 | TCP | Distributed cache |
| OTEL Collector gRPC | 4317 | 4317 | gRPC | Telemetry |
| OTEL Collector HTTP | 4318 | 4318 | HTTP | Telemetry |

---

## Appendix B: Error Message Reference

### Common Error Patterns and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `ImagePullBackOff` | Image not in Minikube | `minikube image load image.tar` |
| `ErrImageNeverPull` | imagePullPolicy=Never but image missing | Load image with correct tag |
| `FailedScheduling: Insufficient cpu` | Too many pods, not enough cores | Increase Minikube CPUs or reduce replicas |
| `ReplicaSetGhost` | MongoDB not initialized | Run `rs.initiate()` in mongosh |
| `InconsistentClusterIdException` | Kafka PVC has old cluster ID | Delete PVC and recreate |
| `eacces .erlang.cookie` | RabbitMQ permission issue | Add securityContext with fsGroup/runAsUser 999 |
| `MountVolume.SetUp failed` | Volume path doesn't exist | Start minikube mount or use DirectoryOrCreate |
| `CORS policy blocked` | Production mode restricts origins | Set ASPNETCORE_ENVIRONMENT=Development |
| `Failed to fetch` | Port forward not active | Restart port-forward script |
| `Connection refused localhost:9092` | Missing ConnectionStrings__Kafka | Add environment variable |

---

## Appendix C: Monitoring Credentials

| Service | URL | Username | Password | Notes |
|---------|-----|----------|----------|-------|
| Grafana | http://localhost:3001 | admin | EZPlatform2025!Beta | From grafana-credentials Secret |
| RabbitMQ Management | http://localhost:15672 | guest | guest | Default credentials |
| Prometheus | http://localhost:9090 | - | - | No auth |
| Jaeger | http://localhost:16686 | - | - | No auth |
| Elasticsearch | http://localhost:9200 | - | - | xpack.security disabled |

---

## Appendix D: Demo Data Details

### Categories (10)

Hebrew categories generated:
1. מכירות (Sales)
2. כספים (Finance)
3. משאבי אנוש (HR)
4. מלאי (Inventory)
5. שירות לקוחות (Customer Service)
6. שיווק (Marketing)
7. לוגיסטיקה (Logistics)
8. תפעול (Operations)
9. מחקר ופיתוח (R&D)
10. רכש (Procurement)

### DataSources (20)

Each with:
- Hebrew name
- Supplier name
- Connector type (Local, FTP, SFTP, HTTP, Kafka)
- File pattern
- Cron schedule
- Complex JSON schema (4-12 fields)

### Invalid Records (90)

**Error Types:**
- RequiredFieldMissing: 18 records
- PatternViolation: 8 records
- TypeMismatch: 8 records
- RangeViolation: 8 records
- FormatError: 8 records
- MultipleErrors: 40 records

**Severity Distribution:**
- Critical: ~40 records
- Error: ~45 records
- Warning: ~5 records

**Review Status:**
- Reviewed: 32 records
- Not Reviewed: 58 records
- Ignored: 6 records

---

## Contact and Support

**For issues:**
1. Check this troubleshooting guide
2. Review pod logs: `kubectl logs POD_NAME -n ez-platform`
3. Check events: `kubectl get events -n ez-platform --sort-by='.lastTimestamp'`
4. Verify configuration: Review modified YAML files in this document

**Documentation files:**
- Main installation guide: `release-package/docs/docs/installation.md`
- This troubleshooting guide: `release-package/DEPLOYMENT-TROUBLESHOOTING-GUIDE.md`
- Project standards: `docs/PROJECT_STANDARDS.md`
- Architecture overview: `docs/COMPREHENSIVE-PROJECT-ANALYSIS.md`

---

## Conclusion

This deployment successfully overcame multiple challenges to achieve a fully functional EZ Platform v0.1.1-rc1 installation. The key to success was:

1. **Systematic troubleshooting** - Check logs, understand root causes
2. **Resource allocation** - Use maximum available resources
3. **Configuration consistency** - Ensure all environment variables present
4. **Image management** - Pre-load and tag correctly
5. **Volume management** - Persistent mounts for file access
6. **Service dependencies** - Initialize in correct order

**Final Status:**
- ✅ 21/21 pods running
- ✅ All services healthy
- ✅ 20 data sources displayed
- ✅ 90 invalid records displayed
- ✅ Full Hebrew/RTL support working
- ✅ Monitoring dashboards operational
- ✅ Test data accessible from Windows

**Deployment verified via Playwright automated testing.**

---

**Document End**
**Version:** 1.0
**Last Updated:** January 5, 2026
**Status:** ✅ Complete and Verified

---
sidebar_position: 2
---

# EZ Platform - Installation Guide v0.4.0

**Last Updated:** March 2026
**Version:** 0.4.0
**Platform:** Kubernetes
**Status:** Production Ready

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Installation](#detailed-installation)
4. [Configuration Options](#configuration-options)
5. [v0.4.0 Features Configuration](#v040-features-configuration)
6. [Post-Installation Verification](#post-installation-verification)
7. [Troubleshooting](#troubleshooting)
8. [Uninstallation](#uninstallation)

---

## Prerequisites

### Required Infrastructure

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Kubernetes** | v1.25+ | v1.28+ |
| **kubectl** | Configured and connected | Latest version |
| **Helm** | v3.8+ | v3.12+ |
| **CPU** | 4 cores | 8 cores |
| **Memory** | 16GB | 32GB |
| **Storage** | 50GB | 100GB |
| **Network** | Internet access for images | - |

### Required Tools
- `kubectl` (v1.25+)
- `helm` (v3.x) for chart-based deployment
- `git` (for cloning repository)
- `Node.js` (v18+) for frontend development
- `Docker` (for building custom images)

### Kubernetes Cluster Options
- **Minikube**: For local development/testing (Hyper-V or Docker driver)
- **k3s**: Lightweight production
- **EKS/AKS/GKE**: Cloud providers
- **OpenShift (OCP)**: Enterprise Kubernetes (OCP-compatible since v0.1.1-rc2)
- **On-premise**: Any K8s distribution

---

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/usercourses63/ez-data-processing-platform.git
cd ez-data-processing-platform
```

### 2. Create Namespace
```bash
kubectl create namespace ez-platform
```

### 3. Deploy Infrastructure
```bash
# Deploy MongoDB, Kafka, Elasticsearch, Hazelcast, RabbitMQ, etc.
kubectl apply -f k8s/infrastructure/

# Wait for infrastructure to be ready (3-5 minutes)
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s
```

### 4. Deploy Services
```bash
# Deploy ConfigMaps, microservices, and services
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# Wait for services to be ready (2-3 minutes)
kubectl wait --for=condition=ready pod -l component=service -n ez-platform --timeout=180s
```

### 5. Set Up Port Forwarding
```powershell
# Windows PowerShell (RECOMMENDED - configures all 18 ports)
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1

# Linux/Mac
./scripts/start-port-forwards.sh
```

### 6. Access Frontend
```
# Open browser
http://localhost:7000

# Grafana monitoring
http://localhost:3001
# Login: admin / EZPlatform2025!Beta
```

**Installation complete!** See [Post-Installation Verification](#post-installation-verification) to confirm.

---

## Detailed Installation

### Step 1: Namespace Setup

```bash
kubectl create namespace ez-platform
kubectl get namespace ez-platform
```

### Step 2: Infrastructure Deployment

Infrastructure components must be deployed first as services depend on them.

#### 2.1 MongoDB (Replica Set)
```bash
kubectl apply -f k8s/infrastructure/mongodb-deployment.yaml

# Wait for MongoDB to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

# Initialize replica set (required for first deployment)
kubectl exec mongodb-0 -n ez-platform -- mongosh --eval \
  'rs.initiate({_id: "rs0", members: [{_id: 0, host: "mongodb-0.mongodb:27017"}]})'
```

#### 2.2 Apache Kafka + ZooKeeper
```bash
kubectl apply -f k8s/infrastructure/kafka-deployment.yaml
kubectl apply -f k8s/infrastructure/zookeeper-deployment.yaml

kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s
```

#### 2.3 RabbitMQ (Internal Messaging)
```bash
kubectl apply -f k8s/infrastructure/rabbitmq-deployment.yaml
```

RabbitMQ is used for internal service-to-service event communication via MassTransit. Kafka is used for external data source inputs and output destinations.

#### 2.4 Hazelcast (Distributed Cache)
```bash
kubectl apply -f k8s/infrastructure/hazelcast-deployment.yaml
```

#### 2.5 Monitoring Stack
```bash
# Prometheus (System + Business)
kubectl apply -f k8s/infrastructure/prometheus-system-deployment.yaml
kubectl apply -f k8s/infrastructure/prometheus-business-deployment.yaml

# Grafana, Elasticsearch, Jaeger, OTEL Collector
kubectl apply -f k8s/infrastructure/grafana-deployment.yaml
kubectl apply -f k8s/infrastructure/elasticsearch-deployment.yaml
kubectl apply -f k8s/deployments/jaeger.yaml
kubectl apply -f k8s/infrastructure/otel-collector.yaml

# Fluent Bit (infrastructure log collection)
kubectl apply -f k8s/deployments/fluent-bit.yaml
```

### Step 3: ConfigMaps

```bash
kubectl apply -f k8s/configmaps/services-config.yaml
kubectl get configmap services-config -n ez-platform -o yaml
```

### Step 4: RBAC (Required for NAS Device Management)

```bash
kubectl apply -f k8s/rbac/nas-device-rbac.yaml
```

This grants the DataSourceManagement service permissions to create and manage PersistentVolumes and PersistentVolumeClaims for NAS devices.

### Step 5: Microservices Deployment

Deploy all 9 microservices:

```bash
# Core services
kubectl apply -f k8s/deployments/datasource-management.yaml
kubectl apply -f k8s/deployments/scheduling.yaml
kubectl apply -f k8s/deployments/filediscovery.yaml

# Processing pipeline
kubectl apply -f k8s/deployments/fileprocessor.yaml
kubectl apply -f k8s/deployments/validation.yaml
kubectl apply -f k8s/deployments/output.yaml

# Supporting services
kubectl apply -f k8s/deployments/invalidrecords.yaml
kubectl apply -f k8s/deployments/metrics-configuration.yaml

# Frontend (React 19 + nginx)
kubectl apply -f k8s/deployments/frontend.yaml

# Services
kubectl apply -f k8s/services/
```

### Step 6: Port Forwarding

**Windows (Recommended):**
```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

**Port Mapping (18 services):**

| Service | Port | URL |
|---------|------|-----|
| Frontend | 7000 | http://localhost:7000 |
| DataSource Management API | 5001 | http://localhost:5001 |
| Metrics Configuration API | 5002 | http://localhost:5002 |
| Validation API | 5003 | http://localhost:5003 |
| Scheduling API | 5004 | http://localhost:5004 |
| Invalid Records API | 5007 | http://localhost:5007 |
| FileProcessor API | 5008 | http://localhost:5008 |
| Output API | 5009 | http://localhost:5009 |
| Grafana | 3001 | http://localhost:3001 |
| Prometheus System | 9090 | http://localhost:9090 |
| Prometheus Business | 9091 | http://localhost:9091 |
| Jaeger UI | 16686 | http://localhost:16686 |
| Elasticsearch | 9200 | http://localhost:9200 |
| MongoDB | 27017 | mongodb://localhost:27017 |
| Kafka External | 9094 | kafka://localhost:9094 |
| RabbitMQ | 5672 | amqp://localhost:5672 |
| Hazelcast | 5701 | - |
| OTEL Collector (gRPC/HTTP) | 4317/4318 | - |

---

## Configuration Options

### Database Configuration

**Default:** MongoDB at `mongodb:27017`, database: `ezplatform`

```yaml
# k8s/configmaps/services-config.yaml
data:
  mongodb-connection: "your-mongodb-url"
  database-name: "your-database-name"
```

### Kafka Configuration

**Default:** Internal cluster at `kafka:9092`, external access at `localhost:9094`

```yaml
data:
  kafka-server: "your-kafka-broker:9092"
```

### ConfigMap Key Reference

```yaml
# k8s/configmaps/services-config.yaml
data:
  mongodb-connection: "mongodb"
  kafka-server: "kafka:9092"
  hazelcast-server: "hazelcast:5701"
  prometheus-endpoint: "http://prometheus:9090"
  otlp-endpoint: "http://otel-collector:4317"
  elasticsearch-endpoint: "http://elasticsearch:9200"
  database-name: "ezplatform"
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ConnectionStrings__DefaultConnection` | MongoDB connection string |
| `ConnectionStrings__DatabaseName` | Database name override |
| `Kafka__Brokers` | Kafka bootstrap servers |
| `OpenTelemetry__OtlpEndpoint` | OTEL Collector endpoint |
| `Hazelcast__Servers` | Hazelcast cluster address |

### Resource Limits

Default resource allocations:
```yaml
requests:
  cpu: 50m
  memory: 128Mi
limits:
  cpu: 500m
  memory: 512Mi
```

### Replica Scaling

```bash
# Scale FileProcessor to 3 replicas
kubectl scale deployment fileprocessor --replicas=3 -n ez-platform

# Scale Validation to 2 replicas
kubectl scale deployment validation --replicas=2 -n ez-platform
```

---

## v0.4.0 Features Configuration

### Clone Datasource

No additional configuration required. Clone is a frontend-only feature available from:
- List page actions menu (CopyOutlined icon)
- Edit page header button

All settings are preserved: schema, connection, archive settings, output destinations. Schedule is disabled by default on clones.

### Import from File

Import from File supports uploading CSV, JSON, XML, and Excel sample files to auto-create datasources.

**Archive support** (ZIP, TAR.GZ, 7Z, RAR including encrypted archives) requires the backend Archive API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/archive/analyze` | POST | Analyze archive contents and list files |
| `/api/v1/archive/extract` | POST | Extract specific file from archive |

**nginx configuration** -- For archive uploads, ensure the frontend nginx has sufficient body size:

```nginx
# In nginx.conf (frontend deployment)
client_max_body_size 100m;
```

The Archive API uses **SharpCompress** on the backend for multi-format archive support.

### Completeness Checklist

No additional configuration required. The completeness checklist provides:
- Real-time progress tracking with color-coded field borders
- Per-tab completion status in sidebar panel
- Auto-disable for incomplete datasources below the required threshold
- Missing fields navigation for quick form completion

### NAS Device Management (v0.2.0+)

NAS devices enable dynamic Kubernetes PV/PVC auto-provisioning for NFS storage:

1. Configure NAS devices in **Admin > System Settings > NAS Devices**
2. Test NFS connectivity before provisioning
3. Click "Provision" to auto-create PV/PVC in Kubernetes
4. Use provisioned NAS devices as connection targets in datasources

**RBAC required:** `k8s/rbac/nas-device-rbac.yaml` must be applied.

### SignalR Real-Time Updates (v0.3.0+)

SignalR provides real-time sync across all connected browser sessions:
- CRUD operations broadcast `EntityChanged` events via WebSocket
- SignalR hub at `/hubs/monitoring` for live monitoring data
- Frontend `useEntitySync` hook auto-refreshes on entity changes

No additional configuration required -- SignalR is enabled by default on all relevant services.

### Auto-Revalidation (v0.5.0)

Schema changes automatically trigger revalidation of invalid records:
- New Kafka topic: `dataprocessing.schema.updated`
- New ConfigMap key: `invalid-records-ttl-days: 4` (default TTL for invalid records)
- Daily purge job at 03:00 UTC for expired invalid records
- InvalidRecordsService requires SignalR hub configuration

---

## Post-Installation Verification

### 1. Health Checks

```bash
# DataSource Management
curl http://localhost:5001/health

# Validation Service
curl http://localhost:5003/health

# Scheduling Service
curl http://localhost:5004/health
```

Expected: `{"status":"Healthy",...}`

### 2. Frontend Access

1. Open browser: http://localhost:7000
2. Verify Hebrew interface loads
3. Sidebar shows: Data Sources, Invalid Records, Alerts, System Monitoring, etc.

### 3. Admin Settings

1. Navigate to: http://localhost:7000/admin/settings
2. Verify categories tab shows 10+ categories
3. Verify NAS Devices tab is accessible
4. Verify Servers tab is accessible

### 4. Monitoring Stack

**Grafana:** http://localhost:3001 (admin / EZPlatform2025!Beta)
**Jaeger:** http://localhost:16686
**Prometheus System:** http://localhost:9090
**Prometheus Business:** http://localhost:9091

### 5. Database Connection

```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongosh
# In mongosh:
use ezplatform
show collections
db.DataSources.countDocuments()
```

### 6. Create Test DataSource

1. Go to http://localhost:7000/datasources
2. Click "Import from File" to test the new import feature, or click "Create" for manual creation
3. Fill in basic info, configure connection, set schema
4. Verify the completeness checklist shows real-time progress
5. Save and verify it appears in the list

---

## Troubleshooting

### Issue: Pods Not Starting

```bash
kubectl get pods -n ez-platform
kubectl describe pod <pod-name> -n ez-platform
kubectl get events -n ez-platform --sort-by='.lastTimestamp'
```

### Issue: Port Forward Connection Refused

```bash
# Kill existing port forwards
taskkill /F /IM kubectl.exe  # Windows
pkill -f "kubectl port-forward"  # Linux/Mac

# Restart
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1
```

### Issue: Frontend Shows "Connection Refused"

```bash
kubectl get pods -l app=datasource-management -n ez-platform
kubectl logs deployment/datasource-management -n ez-platform --tail=50
```

### Issue: MongoDB Connection Errors

```bash
kubectl get pods -l app=mongodb -n ez-platform
kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "db.adminCommand('ping')"
```

For replica set issues, re-initialize:
```bash
kubectl exec mongodb-0 -n ez-platform -- mongosh --eval \
  'rs.initiate({_id: "rs0", members: [{_id: 0, host: "mongodb-0.mongodb:27017"}]})'
```

Use `?directConnection=true` in connection strings when connecting to a single-node replica set from outside the cluster.

### Issue: Kafka Messages Not Flowing

```bash
kubectl get pods -l app=kafka -n ez-platform
kubectl exec -it kafka-0 -n ez-platform -- kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**Kafka Cluster ID Mismatch:** If you see `InconsistentClusterIdException`, delete both Kafka and ZooKeeper StatefulSets and PVCs, then redeploy.

### Issue: Archive Upload Fails (v0.4.0)

Verify nginx `client_max_body_size` is set to at least 100MB in the frontend deployment. Check DataSourceManagement service logs for SharpCompress errors.

### Issue: NAS Mount Failures

```bash
# Check NAS device provisioning status
curl http://localhost:5001/api/v1/nasdevices

# Verify PV/PVC exist
kubectl get pv -n ez-platform
kubectl get pvc -n ez-platform
```

### Issue: SignalR Connection Drops

SignalR connections may drop on pod restarts. The frontend auto-reconnects with configurable backoff. If persistent issues, check CORS configuration and WebSocket support in your ingress controller.

---

## Uninstallation

### Clean Uninstall

```bash
kubectl delete namespace ez-platform
```

### Preserve Data Uninstall

```bash
kubectl delete deployment --all -n ez-platform
kubectl delete service --all -n ez-platform
# PVCs remain - data preserved
kubectl get pvc -n ez-platform
```

---

## Volume Mounting for File-Based DataSources

### Option 1: HostPath (Development/Minikube)

```bash
# Mount host directory into Minikube
minikube mount C:\Users\UserC\data\uploads:/mnt/data/uploads
```

### Option 2: NAS Device (Recommended)

Use the built-in NAS Device Management (Admin > System Settings > NAS Devices) for automatic PV/PVC provisioning via NFS.

### Option 3: PersistentVolume (Production)

Create PV/PVC manually for cloud storage:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: file-input-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: your-nfs-server.com
    path: "/exports/data-input"
```

---

## Resource Requirements

### Infrastructure Layer

| Component | CPU (req/limit) | Memory (req/limit) | Storage |
|-----------|-----------------|---------------------|---------|
| MongoDB | 250m/1000m | 512Mi/2Gi | 20GB per pod |
| Kafka | 500m/2000m | 1Gi/4Gi | 10GB per pod |
| Zookeeper | 250m/500m | 512Mi/1Gi | 5GB |
| Hazelcast | 250m/1000m | 512Mi/2Gi | - |
| RabbitMQ | 250m/500m | 512Mi/1Gi | 5GB |
| Elasticsearch | 500m/2000m | 2Gi/4Gi | 30GB |
| Prometheus (x2) | 250m/1000m | 1Gi/2Gi | 15GB each |
| Grafana | 250m/1000m | 512Mi/2Gi | 10GB |
| Jaeger | 250m/1000m | 512Mi/1Gi | - |

### Services Layer (9 Microservices)

| Service | CPU (req/limit) | Memory (req/limit) |
|---------|-----------------|---------------------|
| DataSourceManagement | 50m/500m | 128Mi/512Mi |
| FileDiscovery | 50m/500m | 128Mi/512Mi |
| FileProcessor | 50m/500m | 128Mi/512Mi |
| Validation | 50m/500m | 128Mi/512Mi |
| Output | 50m/500m | 128Mi/512Mi |
| Scheduling | 50m/500m | 128Mi/512Mi |
| InvalidRecords | 50m/500m | 128Mi/512Mi |
| MetricsConfiguration | 50m/500m | 128Mi/512Mi |
| Frontend | 50m/250m | 128Mi/256Mi |

---

## Verification Checklist

- [ ] Namespace created: `kubectl get namespace ez-platform`
- [ ] MongoDB running and replica set initialized
- [ ] Kafka running
- [ ] RabbitMQ running
- [ ] All 9 microservices deployed and running
- [ ] Frontend accessible: http://localhost:7000
- [ ] Health checks passing: `/health` on all services
- [ ] Grafana accessible: http://localhost:3001
- [ ] Jaeger accessible: http://localhost:16686
- [ ] Can create datasource via UI
- [ ] Clone datasource works (v0.4.0)
- [ ] Import from File works (v0.4.0)
- [ ] Completeness checklist displays (v0.4.0)
- [ ] NAS Devices tab accessible in Admin Settings
- [ ] No CrashLoopBackOff pods
- [ ] No pending PVCs

---

## Next Steps

After successful installation:

1. **Read User Guide**: [User Guide](/docs/user-guide/) (Hebrew)
2. **Configure Categories**: Go to Admin Settings > Categories
3. **Set Up NAS Devices**: Go to Admin Settings > NAS Devices
4. **Create DataSources**: Use Import from File for quick setup, or create manually
5. **Set Up Monitoring**: Configure Grafana dashboards
6. **Review Admin Guide**: [Admin Guide](/docs/admin)

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review [Admin Guide](/docs/admin)
- Review [Deployment Troubleshooting Guide](/docs/deployment/deployment-troubleshooting-guide)
- Check logs: `kubectl logs <pod-name> -n ez-platform`

---

**Installation Guide Version:** 4.0
**Platform Version:** v0.4.0
**Last Updated:** March 2026

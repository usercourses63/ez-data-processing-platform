# EZ Platform - Installation Guide v0.1.0-beta

**Last Updated:** December 29, 2025
**Version:** 0.1.0-beta
**Platform:** Kubernetes

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Installation](#detailed-installation)
4. [Configuration Options](#configuration-options)
5. [Post-Installation Verification](#post-installation-verification)
6. [Troubleshooting](#troubleshooting)
7. [Uninstallation](#uninstallation)

---

## Prerequisites

### Required Infrastructure

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Kubernetes** | v1.25+ | v1.28+ |
| **kubectl** | Configured and connected | Latest version |
| **CPU** | 4 cores | 8 cores |
| **Memory** | 16GB | 32GB |
| **Storage** | 50GB | 100GB |
| **Network** | Internet access for images | - |

### Kubernetes Cluster Options
- **Minikube**: For local development/testing
- **k3s**: Lightweight production
- **EKS/AKS/GKE**: Cloud providers
- **On-premise**: Any K8s distribution

### Tools Required
- `kubectl` (v1.25+)
- `git` (for cloning repository)
- Optional: `helm` (v3.x) for future Helm chart support

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
# Deploy MongoDB, Kafka, Elasticsearch, Hazelcast, etc.
kubectl apply -f k8s/infrastructure/

# Wait for infrastructure to be ready (3-5 minutes)
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s
```

### 4. Deploy Services
```bash
# Deploy all microservices
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# Wait for services to be ready (2-3 minutes)
kubectl wait --for=condition=ready pod -l component=service -n ez-platform --timeout=180s
```

### 5. Set Up Port Forwarding
```bash
# Windows PowerShell
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1

# Linux/Mac
./scripts/start-port-forwards.sh
```

### 6. Access Frontend
```bash
# Open browser
http://localhost:3000

# Grafana monitoring
http://localhost:3001
# Login: admin / EZPlatform2025!Beta
```

**Installation complete!** See [Post-Installation Verification](#post-installation-verification) to confirm.

---

## Detailed Installation

### Step 1: Namespace Setup

```bash
# Create namespace
kubectl create namespace ez-platform

# Verify namespace
kubectl get namespace ez-platform
```

Expected output:
```
NAME          STATUS   AGE
ez-platform   Active   5s
```

---

### Step 2: Infrastructure Deployment

Infrastructure components must be deployed first as services depend on them.

#### 2.1 MongoDB (3-node Replica Set)
```bash
kubectl apply -f k8s/infrastructure/mongodb-deployment.yaml

# Wait for MongoDB to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

# Verify MongoDB pods
kubectl get pods -l app=mongodb -n ez-platform
```

Expected: 3 pods running (mongodb-0, mongodb-1, mongodb-2)

#### 2.2 Apache Kafka (3-node Cluster)
```bash
kubectl apply -f k8s/infrastructure/kafka-deployment.yaml
kubectl apply -f k8s/infrastructure/zookeeper-deployment.yaml

# Wait for Kafka to be ready
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s

# Verify Kafka pods
kubectl get pods -l app=kafka -n ez-platform
```

Expected: 3 Kafka pods + 1 Zookeeper pod running

#### 2.3 Hazelcast (2-node Cluster)
```bash
kubectl apply -f k8s/infrastructure/hazelcast-deployment.yaml

# Verify Hazelcast cluster formation
kubectl logs -l app=hazelcast -n ez-platform --tail=10
```

Expected: Logs show "Members {2}" indicating 2-node cluster

#### 2.4 Monitoring Stack
```bash
# Deploy Prometheus (System + Business)
kubectl apply -f k8s/infrastructure/prometheus-system-deployment.yaml
kubectl apply -f k8s/infrastructure/prometheus-business-deployment.yaml

# Deploy Grafana
kubectl apply -f k8s/infrastructure/grafana-deployment.yaml

# Deploy Elasticsearch & Jaeger
kubectl apply -f k8s/infrastructure/elasticsearch-deployment.yaml
kubectl apply -f k8s/deployments/jaeger.yaml

# Deploy OpenTelemetry Collector
kubectl apply -f k8s/infrastructure/otel-collector.yaml
```

---

### Step 3: ConfigMaps

```bash
# Deploy service configuration
kubectl apply -f k8s/configmaps/services-config.yaml

# Verify ConfigMap
kubectl get configmap services-config -n ez-platform -o yaml
```

---

### Step 4: Microservices Deployment

Deploy services in order (respecting dependencies):

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

# Frontend
kubectl apply -f k8s/deployments/frontend.yaml

# Services
kubectl apply -f k8s/services/
```

---

### Step 5: Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n ez-platform

# Expected: ~25-30 pods total, all Running or Completed
```

Verify each component:
```bash
# Infrastructure pods
kubectl get pods -l component=infrastructure -n ez-platform

# Service pods
kubectl get pods -l component=service -n ez-platform

# Monitoring pods
kubectl get pods -l component=monitoring -n ez-platform
```

---

### Step 6: Port Forwarding

**Windows:**
```powershell
# Run in PowerShell (keeps running, don't close)
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

**Linux/Mac:**
```bash
# Make script executable
chmod +x scripts/start-port-forwards.sh

# Run script (keeps running)
./scripts/start-port-forwards.sh
```

**Port Mapping:**
| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| DataSource API | 5001 | http://localhost:5001 |
| Metrics API | 5002 | http://localhost:5002 |
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
| **RabbitMQ** | 5672 | amqp://localhost:5672 (MassTransit internal messaging) |
| **RabbitMQ Management** | 15672 | http://localhost:15672 (UI: guest/guest) |
| Kafka External | 9094 | kafka://localhost:9094 (data sources/outputs) |
| Hazelcast | 5701 | - |
| OTEL Collector (gRPC) | 4317 | - |
| OTEL Collector (HTTP) | 4318 | - |

---

## Configuration Options

### Database Configuration

**Default:** MongoDB at `mongodb:27017`, database: `ezplatform`

To override:
```yaml
# Edit k8s/configmaps/services-config.yaml
data:
  mongodb-connection: "your-mongodb-url"
  database-name: "your-database-name"
```

### Kafka Configuration

**Default:** Internal cluster at `kafka:9092`

To use external Kafka:
```yaml
# Edit k8s/configmaps/services-config.yaml
data:
  kafka-server: "your-kafka-broker:9092"
```

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

To adjust:
```bash
kubectl edit deployment <service-name> -n ez-platform
# Modify resources section
```

### Replica Scaling

Scale services horizontally:
```bash
# Scale FileProcessor to 3 replicas
kubectl scale deployment fileprocessor --replicas=3 -n ez-platform

# Scale Validation to 2 replicas
kubectl scale deployment validation --replicas=2 -n ez-platform
```

---

## Post-Installation Verification

### 1. Health Checks

Check all services are healthy:
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

1. Open browser: http://localhost:3000
2. You should see: "EZ - מערכת לניהול,ניטור ושינוע סג\"חים"
3. Sidebar shows: מקורות נתונים, רשומות לא תקינות, התרעות, etc.

### 3. Admin Settings

1. Navigate to: http://localhost:3000/admin/settings
2. Click "קטגוריות" tab
3. Verify categories are loaded (should show 10-16 categories)

### 4. Monitoring Stack

**Grafana:**
```bash
# Access Grafana
http://localhost:3001

# Login
Username: admin
Password: EZPlatform2025!Beta

# Verify dashboards
- Business Metrics Dashboard
- Infrastructure Metrics Dashboard
```

**Jaeger:**
```bash
# Access Jaeger
http://localhost:16686

# Check for services
- Should see: dataprocessing.* services
```

**Prometheus:**
```bash
# System metrics
http://localhost:9090

# Business metrics
http://localhost:9091

# Test query
up{namespace="ez-platform"}
```

### 5. Database Connection

```bash
# Connect to MongoDB
kubectl exec -it mongodb-0 -n ez-platform -- mongosh

# In mongosh:
use ezplatform
show collections
db.DataSources.countDocuments()
exit
```

### 6. Create Test DataSource

1. Go to http://localhost:3000/datasources
2. Click "הוסף מקור נתונים"
3. Fill in basic info:
   - Name: "Test DataSource"
   - Supplier: "Test Supplier"
   - Category: Select any
4. Configure connection (Local folder)
5. Save
6. Verify appears in list

---

## Troubleshooting

### Issue: Pods Not Starting

**Check pod status:**
```bash
kubectl get pods -n ez-platform
kubectl describe pod <pod-name> -n ez-platform
```

**Common causes:**
- Insufficient resources (CPU/Memory)
- Image pull errors
- PVC not binding

**Solution:**
```bash
# Check events
kubectl get events -n ez-platform --sort-by='.lastTimestamp'

# Check resource quotas
kubectl top pods -n ez-platform
```

### Issue: Port Forward Connection Refused

**Cause:** Port forwards died or weren't started

**Solution:**
```bash
# Kill existing port forwards
taskkill /F /IM kubectl.exe  # Windows
pkill -f "kubectl port-forward"  # Linux/Mac

# Restart port forwards
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1
```

### Issue: Frontend Shows "Connection Refused"

**Check backend service:**
```bash
# Verify DataSourceManagement is running
kubectl get pods -l app=datasource-management -n ez-platform

# Check logs
kubectl logs deployment/datasource-management -n ez-platform --tail=50

# Verify port forward
netstat -an | findstr "5001"  # Windows
lsof -i :5001  # Linux/Mac
```

### Issue: MongoDB Connection Errors

**Check MongoDB pods:**
```bash
kubectl get pods -l app=mongodb -n ez-platform

# All 3 pods should be Running
```

**Test connection:**
```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "db.adminCommand('ping')"
```

### Issue: Kafka Messages Not Flowing

**Check Kafka cluster:**
```bash
kubectl get pods -l app=kafka -n ez-platform

# View Kafka logs
kubectl logs kafka-0 -n ez-platform --tail=50
```

**Test Kafka connectivity:**
```bash
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-topics.sh --bootstrap-server localhost:9092 --list
```

### Issue: Hazelcast Cluster Not Forming

**Check Hazelcast logs:**
```bash
kubectl logs -l app=hazelcast -n ez-platform

# Look for: "Members {2}" indicating 2-node cluster
```

**If nodes can't connect:**
```bash
# Restart Hazelcast pods
kubectl rollout restart deployment/hazelcast -n ez-platform
```

### Issue: No Data in Grafana

**Verify Prometheus scraping:**
```bash
# Check Prometheus targets
http://localhost:9090/targets

# All targets should show "UP"
```

**Verify data sources in Grafana:**
```bash
# Settings → Data Sources
# Should see: System-Prometheus, Business-Prometheus, Elasticsearch-Logs
```

---

## Uninstallation

### Clean Uninstall (Removes Everything)

```bash
# Delete all resources
kubectl delete namespace ez-platform

# This removes:
# - All deployments
# - All services
# - All ConfigMaps and Secrets
# - All PersistentVolumeClaims (data is deleted!)
```

### Preserve Data Uninstall

```bash
# Delete deployments but keep PVCs
kubectl delete deployment --all -n ez-platform
kubectl delete service --all -n ez-platform

# PVCs remain - data preserved
kubectl get pvc -n ez-platform
```

### Reinstall After Uninstall

```bash
# Wait for namespace deletion to complete
kubectl get namespace ez-platform

# Once deleted, follow Quick Start from Step 2
```

---

## Volume Mounting for File-Based DataSources

### Overview

For **Local folder** datasources, you need to mount external directories into the FileDiscovery pod so it can access files.

### Option 1: HostPath (Development/Minikube)

**For Minikube:**
```bash
# Mount host directory into Minikube
minikube mount C:\Users\UserC\data\uploads:/mnt/data/uploads

# Keep this terminal running
```

**Update FileDiscovery deployment:**
```yaml
# Edit k8s/deployments/filediscovery.yaml
spec:
  template:
    spec:
      containers:
      - name: filediscovery
        volumeMounts:
        - name: external-data
          mountPath: /mnt/external-data
      volumes:
      - name: external-data
        hostPath:
          path: /mnt/data/uploads  # Path in Minikube
          type: Directory
```

**Then restart:**
```bash
kubectl apply -f k8s/deployments/filediscovery.yaml
kubectl rollout restart deployment/filediscovery -n ez-platform
```

### Option 2: PersistentVolume (Production)

**Create PV and PVC:**
```yaml
# k8s/storage/file-input-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: file-input-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany  # Multiple pods can read
  nfs:  # Or other shared storage
    server: your-nfs-server.com
    path: "/exports/data-input"

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: file-input-pvc
  namespace: ez-platform
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi
```

**Apply and mount:**
```bash
kubectl apply -f k8s/storage/file-input-pv.yaml

# Update filediscovery deployment to use PVC
kubectl set volume deployment/filediscovery \
  --add --name=file-input \
  --mount-path=/mnt/external-data \
  --type=persistentVolumeClaim \
  --claim-name=file-input-pvc \
  -n ez-platform
```

### Option 3: Cloud Storage (AWS/Azure/GCP)

**AWS EFS:**
```yaml
# Use EFS CSI driver
storageClassName: efs-sc
```

**Azure Files:**
```yaml
# Use Azure File storage class
storageClassName: azurefile
```

### Output Volume Mounting

**Similar process for Output service:**
```bash
# Mount output directory
kubectl set volume deployment/output \
  --add --name=file-output \
  --mount-path=/mnt/external-output \
  --type=persistentVolumeClaim \
  --claim-name=file-output-pvc \
  -n ez-platform
```

### Verify Mounts

```bash
# Check FileDiscovery can see files
kubectl exec deployment/filediscovery -n ez-platform -- ls -la /mnt/external-data

# Check Output can write
kubectl exec deployment/output -n ez-platform -- touch /mnt/external-output/test.txt
```

---

## Advanced Configuration

### Custom Storage Class

If your cluster uses a different storage class:

```bash
# Find available storage classes
kubectl get storageclass

# Edit PVCs to use your storage class
kubectl edit pvc ezplatform-mongodb-data-pvc -n ez-platform

# Change:
# storageClassName: standard
# To:
# storageClassName: your-storage-class
```

### External MongoDB

To use existing MongoDB instead of bundled:

```bash
# Edit k8s/configmaps/services-config.yaml
mongodb-connection: "mongodb://your-external-mongodb:27017"

# Skip MongoDB deployment
# Don't apply: k8s/infrastructure/mongodb-deployment.yaml
```

### External Kafka

To use existing Kafka cluster:

```bash
# Edit k8s/configmaps/services-config.yaml
kafka-server: "your-kafka-broker:9092"

# Skip Kafka deployment
# Don't apply: k8s/infrastructure/kafka-deployment.yaml
```

### Enable HTTPS

```bash
# Create TLS secret
kubectl create secret tls ez-platform-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  -n ez-platform

# Apply ingress
kubectl apply -f k8s/ingress/ingress-https.yaml
```

---

## Resource Requirements by Component

### Infrastructure Layer
| Component | CPU (req/limit) | Memory (req/limit) | Storage |
|-----------|-----------------|---------------------|---------|
| MongoDB (x3) | 250m/1000m | 512Mi/2Gi | 20GB per pod |
| Kafka (x3) | 500m/2000m | 1Gi/4Gi | 10GB per pod |
| Zookeeper | 250m/500m | 512Mi/1Gi | 5GB |
| Hazelcast (x2) | 250m/1000m | 512Mi/2Gi | - |
| Elasticsearch | 500m/2000m | 2Gi/4Gi | 30GB |
| Prometheus System | 250m/1000m | 1Gi/2Gi | 15GB |
| Prometheus Business | 250m/1000m | 1Gi/2Gi | 15GB |
| Grafana | 250m/1000m | 512Mi/2Gi | 10GB |
| Jaeger | 250m/1000m | 512Mi/1Gi | - |

**Total Infrastructure:** ~4.5 CPU, ~12GB RAM, ~120GB storage

### Services Layer
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

**Total Services:** ~0.5 CPU, ~1.2GB RAM

### Grand Total
- **CPU**: ~5 cores (request), ~20 cores (limit)
- **Memory**: ~13GB (request), ~35GB (limit)
- **Storage**: ~120GB

---

## Verification Checklist

Use this checklist after installation:

- [ ] Namespace created: `kubectl get namespace ez-platform`
- [ ] MongoDB running: 3 pods ready
- [ ] Kafka running: 3 pods ready
- [ ] Hazelcast cluster: 2 members
- [ ] All services deployed: 9 pods running
- [ ] Frontend accessible: http://localhost:3000
- [ ] Health checks passing: `/health` on all services
- [ ] Grafana accessible: http://localhost:3001
- [ ] Jaeger accessible: http://localhost:16686
- [ ] Can create datasource via UI
- [ ] Categories management working: http://localhost:3000/admin/settings
- [ ] No CrashLoopBackOff pods
- [ ] No pending PVCs

---

## Next Steps

After successful installation:

1. **Read User Guide**: [USER-GUIDE-HE.md](../user-guide/USER-GUIDE-HE.md) (Hebrew)
2. **Configure Categories**: Go to Admin Settings → Categories
3. **Create DataSources**: Follow user guide for datasource setup
4. **Set Up Monitoring**: Configure Grafana dashboards
5. **Review Admin Guide**: [ADMIN-GUIDE.md](../admin/ADMIN-GUIDE.md)

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review [Admin Guide](../admin/ADMIN-GUIDE.md)
- Check logs: `kubectl logs <pod-name> -n ez-platform`
- GitHub Issues: [Report Issue](https://github.com/usercourses63/ez-data-processing-platform/issues)

---

**Installation Guide Version:** 1.0
**Platform Version:** v0.1.0-beta
**Last Updated:** December 29, 2025

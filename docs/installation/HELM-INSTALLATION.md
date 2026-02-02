---
last-verified: 2026-02-02
status: current
---
# Helm Installation Guide

## Overview

The recommended way to deploy EZ Platform is using the official Helm chart, which provides:
- One-command deployment
- Easy customization via values.yaml
- Version control and rollback support
- Production-ready defaults

---

## Prerequisites

Before installing, ensure you have:

- **Kubernetes cluster** v1.25 or higher
- **Helm** v3.8 or higher
- **kubectl** configured with cluster access
- **Minimum resources:**
  - 3 nodes with 8 cores, 16GB RAM each
  - 260GB total storage
- **StorageClass** `standard` available (or customize)

---

## Quick Installation

### 1. Install Chart

```bash
# Navigate to release package
cd ez-platform-v0.1.0-beta/

# Run installation script
./install.sh

# Or use Helm directly
helm install ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --create-namespace
```

### 2. Wait for Deployment

```bash
# Wait for all pods to be ready (10-15 minutes)
kubectl wait --for=condition=ready pod --all -n ez-platform --timeout=15m

# Check status
kubectl get pods -n ez-platform
```

### 3. Access Application

```bash
# Port-forward the frontend
kubectl port-forward svc/frontend 3000:80 -n ez-platform

# Open browser
http://localhost:3000
```

---

## Custom Configuration

### Using Custom Values File

Create `custom-values.yaml`:

```yaml
# Scale up for production
services:
  fileprocessor:
    replicas: 10
    resources:
      requests:
        memory: 4Gi
  validation:
    replicas: 5

# Use production storage
mongodb:
  storage: 100Gi
  storageClass: fast-ssd

kafka:
  storage: 50Gi

# External infrastructure (optional)
mongodb:
  enabled: false
  external:
    enabled: true
    connectionString: "mongodb://external-mongo:27017"
```

Install with custom values:
```bash
helm install ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --create-namespace \
  --values custom-values.yaml
```

### Override Specific Values via CLI

```bash
helm install ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --create-namespace \
  --set services.fileprocessor.replicas=10 \
  --set mongodb.storage=100Gi
```

---

## Configuration Reference

### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.namespace` | Kubernetes namespace | `ez-platform` |
| `global.imageRegistry` | Container registry | `docker.io` |
| `global.imagePullPolicy` | Image pull policy | `IfNotPresent` |

### Microservices

| Service | Default Replicas | Port |
|---------|------------------|------|
| filediscovery | 2 | 5006 |
| fileprocessor | 5 | 5008 |
| validation | 3 | 5003 |
| output | 3 | 5009 |
| datasource-management | 2 | 5001 |
| metrics-configuration | 2 | 5002 |
| invalidrecords | 2 | 5007 |
| scheduling | 1 | 5004 |
| frontend | 2 | 80 |

Each service supports:
```yaml
services.<name>:
  enabled: true|false
  replicas: <number>
  image:
    repository: <repo>
    tag: <tag>
  resources:
    requests: { cpu, memory }
    limits: { cpu, memory }
  strategy:
    maxSurge: <number>
    maxUnavailable: <number>
  extraEnv: []
```

### Infrastructure

#### MongoDB
```yaml
mongodb:
  enabled: true
  replicas: 3               # High availability
  image: mongo:8.0
  replicaSet: rs0
  storage: 20Gi
  storageClass: standard
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  external:
    enabled: false
    connectionString: ""    # Use external MongoDB
```

#### Kafka
```yaml
kafka:
  enabled: true
  replicas: 3
  image: confluentinc/cp-kafka:7.5.0
  storage: 10Gi
  config:
    logRetentionHours: "168"
  zookeeper:
    enabled: true
    replicas: 1
    storage: 5Gi
  external:
    enabled: false
    bootstrapServers: ""    # Use external Kafka
```

#### Hazelcast
```yaml
hazelcast:
  enabled: true
  replicas: 3
  clusterName: data-processing-cluster
  storage: 5Gi
  jvm:
    minMemory: 256m
    maxMemory: 512m
  maps:
    fileContent:
      ttlSeconds: 300       # Cache TTL
      maxSizeMB: 256
```

### Storage

```yaml
storage:
  dataInput:
    enabled: true
    size: 50Gi
    storageClass: standard
  dataOutput:
    enabled: true
    size: 100Gi
    storageClass: standard
  externalData:
    enabled: true
    hostPath: /mnt/external-test-data
```

---

## Upgrade

### Upgrade Existing Deployment

```bash
# Upgrade with new values
helm upgrade ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --values custom-values.yaml

# Check rollout status
kubectl rollout status deployment/fileprocessor -n ez-platform
```

### Rollback

```bash
# List release history
helm history ez-platform -n ez-platform

# Rollback to previous version
helm rollback ez-platform -n ez-platform

# Rollback to specific revision
helm rollback ez-platform 3 -n ez-platform
```

---

## Monitoring Access

After installation, access monitoring dashboards:

### Grafana
```bash
kubectl port-forward svc/grafana 3001:3000 -n ez-platform
# Open: http://localhost:3001
# Login: admin / EZPlatform2025!Beta
```

### Prometheus
```bash
# System metrics
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform

# Business metrics
kubectl port-forward svc/prometheus-business 9091:9091 -n ez-platform
```

### Jaeger
```bash
kubectl port-forward svc/jaeger 16686:16686 -n ez-platform
# Open: http://localhost:16686
```

---

## Troubleshooting

### Pods Not Starting

```bash
# Check pod events
kubectl get events -n ez-platform --sort-by='.lastTimestamp'

# Describe problematic pod
kubectl describe pod <pod-name> -n ez-platform

# Check logs
kubectl logs <pod-name> -n ez-platform
```

### MongoDB Replica Set Init

If MongoDB pods are running but not forming a replica set:

```bash
# Connect to first pod
kubectl exec -it mongodb-0 -n ez-platform -- mongosh

# Initialize replica set
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongodb-0.mongodb-service.ez-platform.svc.cluster.local:27017" },
    { _id: 1, host: "mongodb-1.mongodb-service.ez-platform.svc.cluster.local:27017" },
    { _id: 2, host: "mongodb-2.mongodb-service.ez-platform.svc.cluster.local:27017" }
  ]
})

# Check status
rs.status()
```

### Kafka Issues

```bash
# Check Kafka pods
kubectl get pods -l app=kafka -n ez-platform

# Check Kafka logs
kubectl logs kafka-0 -n ez-platform

# List topics
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-topics.sh --bootstrap-server localhost:9092 --list
```

### Storage Issues

```bash
# Check PVCs
kubectl get pvc -n ez-platform

# Check storage class
kubectl get storageclass

# Check volume bindings
kubectl describe pvc data-input-pvc -n ez-platform
```

---

## Uninstallation

### Using Script

```bash
# Uninstall but keep namespace and PVCs
./uninstall.sh

# Uninstall and delete everything
./uninstall.sh --delete-namespace
```

### Using Helm

```bash
# Uninstall release
helm uninstall ez-platform -n ez-platform

# Delete namespace (optional)
kubectl delete namespace ez-platform
```

---

## Production Recommendations

### 1. Resource Planning

**Minimum (Development):**
- 3 nodes × 8 cores × 16GB RAM = 24 cores, 48GB RAM

**Recommended (Production):**
- 5 nodes × 16 cores × 32GB RAM = 80 cores, 160GB RAM

### 2. Storage Classes

Use fast SSD storage for databases:
```yaml
mongodb:
  storageClass: fast-ssd  # Or premium-rwo, gp3, etc.
kafka:
  storageClass: fast-ssd
```

### 3. High Availability

Scale critical services:
```yaml
services:
  fileprocessor:
    replicas: 10          # Based on throughput needs
  validation:
    replicas: 5
  datasourceManagement:
    replicas: 3

mongodb:
  replicas: 3             # Minimum for HA
kafka:
  replicas: 3             # Minimum for HA
hazelcast:
  replicas: 5             # More for better cache distribution
```

### 4. External Infrastructure

For production, consider managed services:
```yaml
mongodb:
  enabled: false
  external:
    enabled: true
    connectionString: "mongodb+srv://prod-cluster.mongodb.net"

kafka:
  enabled: false
  external:
    enabled: true
    bootstrapServers: "kafka-prod.company.com:9092"
```

### 5. Secrets Management

Use Kubernetes Secrets for sensitive data:
```bash
# Create secret for external MongoDB
kubectl create secret generic mongodb-creds \
  --from-literal=connectionString="mongodb+srv://user:pass@cluster" \
  -n ez-platform
```

---

## Support

For issues and questions:
- **Documentation:** [Full documentation site](../index.md)
- **Installation Guide:** [Standard installation](INSTALLATION-GUIDE.md)
- **Admin Guide:** [System administration](../admin/ADMIN-GUIDE.md)
- **Helm Chart README:** `helm/ez-platform/README.md`

---

**Last Updated:** December 30, 2025
**Version:** 0.1.0-beta

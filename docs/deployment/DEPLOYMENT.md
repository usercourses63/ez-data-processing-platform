---
sidebar_position: 2
last-verified: 2026-02-02
status: current
description: Complete deployment guide for EZ Platform - Kubernetes installation, configuration, scaling, and operations
---

# Deployment Guide

> Complete deployment documentation for EZ Platform on Kubernetes - from local development to production environments

---

## Overview

EZ Platform is deployed on Kubernetes with a microservices architecture. This guide covers deployment options from single-replica development setups to production-grade HA configurations.

### Deployment Options

| Environment | Configuration | Use Case |
|-------------|--------------|----------|
| **Development** | Single replica, Minikube | Local development and testing |
| **Staging** | Single/dual replica, k3s/k8s | Pre-production validation |
| **Production** | Multi-replica, HA, OCP | Production workloads |

### Prerequisites

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Kubernetes | v1.25+ | v1.28+ |
| kubectl | Configured | Latest |
| CPU | 4 cores | 8+ cores |
| Memory | 16GB | 32GB+ |
| Storage | 50GB | 100GB+ |

### Cluster Options

- **Minikube** - Local development and testing
- **k3s** - Lightweight production
- **EKS/AKS/GKE** - Cloud providers
- **OpenShift** - Enterprise container platform (OCP compliant)

---

## Operations

This section provides operational procedures for deploying and managing EZ Platform.

### Quick Start (Single Replica)

```bash
# 1. Create namespace
kubectl create namespace ez-platform

# 2. Deploy infrastructure (MongoDB, Kafka, etc.)
kubectl apply -f k8s/infrastructure/

# 3. Wait for infrastructure
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s

# 4. Deploy ConfigMaps and services
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# 5. Start port forwarding
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"

# 6. Access frontend
start http://localhost:7000
```

### Full Deployment Procedure

#### Phase 1: Environment Preparation

```bash
# Clean existing deployment (if needed)
taskkill /F /IM kubectl.exe

# Start fresh Minikube cluster
minikube delete
minikube start --memory=8192 --cpus=4

# Verify cluster
kubectl cluster-info
```

#### Phase 2: Load Infrastructure Images

```bash
# Load images to Minikube
minikube image load mongo:8.0
minikube image load confluentinc/cp-kafka:7.5.0
minikube image load confluentinc/cp-zookeeper:7.5.0
minikube image load hazelcast/hazelcast:5.6
minikube image load rabbitmq:3-management
minikube image load prom/prometheus:latest
minikube image load grafana/grafana:latest
minikube image load elasticsearch:8.17.0
minikube image load jaegertracing/all-in-one:latest
```

#### Phase 3: Build Microservices

```bash
cd C:/Users/UserC/source/repos/EZ

# Build all services
docker build --no-cache -t ez-platform/datasource-management:latest -f src/Services/DataSourceManagementService/Dockerfile .
docker build --no-cache -t ez-platform/filediscovery:latest -f src/Services/FileDiscoveryService/Dockerfile .
docker build --no-cache -t ez-platform/fileprocessor:latest -f src/Services/FileProcessorService/Dockerfile .
docker build --no-cache -t ez-platform/validation:latest -f src/Services/ValidationService/Dockerfile .
docker build --no-cache -t ez-platform/output:latest -f src/Services/OutputService/Dockerfile .
docker build --no-cache -t ez-platform/scheduling:latest -f src/Services/SchedulingService/Dockerfile .
docker build --no-cache -t ez-platform/metrics-configuration:latest -f src/Services/MetricsConfigurationService/Dockerfile .
docker build --no-cache -t ez-platform/invalidrecords:latest -f src/Services/InvalidRecordsService/Dockerfile .

# Load services to Minikube
minikube image load ez-platform/datasource-management:latest
minikube image load ez-platform/filediscovery:latest
minikube image load ez-platform/fileprocessor:latest
minikube image load ez-platform/validation:latest
minikube image load ez-platform/output:latest
minikube image load ez-platform/scheduling:latest
minikube image load ez-platform/metrics-configuration:latest
minikube image load ez-platform/invalidrecords:latest
```

#### Phase 4: Deploy with kubectl

```bash
# Create namespace
kubectl create namespace ez-platform

# Deploy infrastructure in order
kubectl apply -f k8s/infrastructure/mongodb-deployment.yaml
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

kubectl apply -f k8s/infrastructure/kafka-deployment.yaml
kubectl apply -f k8s/infrastructure/zookeeper-deployment.yaml
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s

kubectl apply -f k8s/infrastructure/hazelcast-deployment.yaml
kubectl apply -f k8s/infrastructure/rabbitmq-deployment.yaml

# Deploy monitoring stack
kubectl apply -f k8s/infrastructure/prometheus-system-deployment.yaml
kubectl apply -f k8s/infrastructure/prometheus-business-deployment.yaml
kubectl apply -f k8s/infrastructure/grafana-deployment.yaml
kubectl apply -f k8s/infrastructure/elasticsearch-deployment.yaml
kubectl apply -f k8s/deployments/jaeger.yaml
kubectl apply -f k8s/infrastructure/otel-collector.yaml

# Deploy ConfigMaps
kubectl apply -f k8s/configmaps/services-config.yaml

# Deploy microservices
kubectl apply -f k8s/deployments/datasource-management.yaml
kubectl apply -f k8s/deployments/scheduling.yaml
kubectl apply -f k8s/deployments/filediscovery.yaml
kubectl apply -f k8s/deployments/fileprocessor.yaml
kubectl apply -f k8s/deployments/validation.yaml
kubectl apply -f k8s/deployments/output.yaml
kubectl apply -f k8s/deployments/invalidrecords.yaml
kubectl apply -f k8s/deployments/metrics-configuration.yaml
kubectl apply -f k8s/deployments/frontend.yaml

# Deploy services
kubectl apply -f k8s/services/
```

#### Phase 5: Helm Deployment (Alternative)

```bash
cd deployment-v0.1.1-rc3/helm/ez-platform

# Install with custom values
helm install ez-platform . \
  -n ez-platform \
  --create-namespace \
  -f values-single-replica.yaml

# Watch deployment progress
kubectl get pods -n ez-platform --watch
```

### Port Forwarding

**Always use the port-forward script:**

```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

| Service | Port | URL |
|---------|------|-----|
| Frontend | 7000 | http://localhost:7000 |
| DataSource Management | 5001 | http://localhost:5001 |
| Metrics Configuration | 5002 | http://localhost:5002 |
| Validation | 5003 | http://localhost:5003 |
| Scheduling | 5004 | http://localhost:5004 |
| Invalid Records | 5007 | http://localhost:5007 |
| File Processor | 5008 | http://localhost:5008 |
| Output | 5009 | http://localhost:5009 |
| Grafana | 3001 | http://localhost:3001 |
| Prometheus System | 9090 | http://localhost:9090 |
| Prometheus Business | 9091 | http://localhost:9091 |
| Jaeger | 16686 | http://localhost:16686 |
| Elasticsearch | 9200 | http://localhost:9200 |
| MongoDB | 27017 | mongodb://localhost:27017 |
| RabbitMQ | 5672 | amqp://localhost:5672 |
| RabbitMQ UI | 15672 | http://localhost:15672 |
| Kafka | 9094 | kafka://localhost:9094 |

### Scaling

```bash
# Scale processing services
kubectl scale deployment fileprocessor --replicas=3 -n ez-platform
kubectl scale deployment validation --replicas=2 -n ez-platform
kubectl scale deployment output --replicas=3 -n ez-platform

# Verify scaling
kubectl get pods -l app=fileprocessor -n ez-platform
```

### Verification

```bash
# Check all pods are running
kubectl get pods -n ez-platform

# Health checks
curl http://localhost:5001/health
curl http://localhost:5003/health
curl http://localhost:5008/health

# Check events
kubectl get events -n ez-platform --sort-by='.lastTimestamp'
```

### Troubleshooting

**ImagePullBackOff:**
```bash
minikube image ls | grep ez-platform
# If missing, rebuild and reload images
```

**CrashLoopBackOff:**
```bash
kubectl logs deployment/<service-name> -n ez-platform --tail=100
kubectl describe pod <pod-name> -n ez-platform
```

**MongoDB Connection Errors:**
```bash
kubectl get configmap services-config -n ez-platform -o yaml
kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "db.adminCommand('ping')"
```

**Port Already in Use:**
```bash
taskkill /F /IM kubectl.exe
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

---

## Development

This section covers development deployment workflows and local setup.

### Local Development Setup

```bash
# 1. Ensure prerequisites
kubectl version
docker version
minikube version

# 2. Start Minikube with sufficient resources
minikube start --memory=8192 --cpus=4

# 3. Mount local data directory (optional)
minikube mount C:\Users\UserC\data\uploads:/mnt/data/uploads

# 4. Deploy infrastructure
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/infrastructure/

# 5. Generate demo data
cd tools/DemoDataGenerator
dotnet run
```

### Service Rebuild Workflow

```bash
# Build specific service
cd src/Services/FileProcessorService
docker build -t ez-platform/fileprocessor:latest -f Dockerfile ../..

# Load to Minikube
minikube image load ez-platform/fileprocessor:latest

# Update deployment
kubectl set image deployment/fileprocessor fileprocessor=ez-platform/fileprocessor:latest -n ez-platform

# Watch rollout
kubectl rollout status deployment/fileprocessor -n ez-platform
```

### Volume Mounting for File-Based DataSources

**Minikube (Development):**
```bash
# Mount host directory
minikube mount C:\Users\UserC\data\uploads:/mnt/data/uploads

# Update FileDiscovery deployment with hostPath
kubectl edit deployment filediscovery -n ez-platform
```

**Production (PersistentVolume):**
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

### ConfigMap Updates

```bash
# Edit configuration
kubectl edit configmap services-config -n ez-platform

# Key settings:
# - mongodb-connection: "mongodb://mongodb:27017"
# - kafka-server: "kafka:9092"
# - hazelcast-server: "hazelcast:5701"

# Restart services to pick up changes
kubectl rollout restart deployment/fileprocessor -n ez-platform
```

### Running Tests

```bash
# Frontend E2E tests
cd src/Frontend
npm run test:e2e
npm run test:e2e:headed  # With browser

# Backend integration tests
cd src/Services/FileProcessorService.Tests
dotnet test
```

---

## Architecture

This section covers infrastructure design, OCP compliance, and production considerations.

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     KUBERNETES CLUSTER (ez-platform)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DEPLOYMENTS (Stateless)              STATEFULSETS (Stateful)          │
│   ═══════════════════════              ════════════════════════          │
│   • Frontend (2)                       • MongoDB (2 nodes)              │
│   • DataSource Management (1)          • Kafka (1-3 brokers)            │
│   • Metrics Configuration (1)          • ZooKeeper (1)                  │
│   • Validation (1)                     • Hazelcast (1-2)                │
│   • Scheduling (1)                                                       │
│   • Invalid Records (1)                DAEMONSETS                        │
│   • File Discovery (2)                 ═══════════                       │
│   • File Processor (2)                 • Fluent Bit (all nodes)         │
│   • Output (3)                                                           │
│                                                                          │
│   MONITORING                           SERVICES                          │
│   ═══════════                          ════════                          │
│   • OTEL Collector (1)                 • ClusterIP (internal)           │
│   • Prometheus System (1)              • LoadBalancer (Frontend)        │
│   • Prometheus Business (1)            • Ingress (NGINX)                │
│   • Grafana (1)                                                          │
│   • Jaeger (1)                                                           │
│   • Elasticsearch (1)                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Resource Requirements

**Infrastructure Layer:**

| Component | CPU req/limit | Memory req/limit | Storage |
|-----------|--------------|------------------|---------|
| MongoDB (x2) | 250m/1000m | 512Mi/2Gi | 20GB/pod |
| Kafka (x1-3) | 500m/2000m | 1Gi/4Gi | 10GB/pod |
| ZooKeeper | 250m/500m | 512Mi/1Gi | 5GB |
| Hazelcast (x1-2) | 250m/1000m | 512Mi/2Gi | - |
| Elasticsearch | 500m/2000m | 2Gi/4Gi | 30GB |
| Prometheus (x2) | 250m/1000m | 1Gi/2Gi | 15GB/each |
| Grafana | 250m/1000m | 512Mi/2Gi | 10GB |

**Services Layer:**

| Service | CPU req/limit | Memory req/limit |
|---------|--------------|------------------|
| All microservices | 50m/500m | 128Mi/512Mi |
| Frontend | 50m/250m | 128Mi/256Mi |

**Totals:**
- **Development:** ~5 CPU, ~13GB RAM, ~120GB storage
- **Production:** ~20+ CPU, ~64GB+ RAM, ~500GB+ storage

### OCP Compliance

All deployments follow OpenShift Container Platform requirements:

```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: service
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: [ALL]
```

**Requirements:**
- All services use non-privileged ports (>1024)
- Images pinned to specific versions (no :latest in production)
- imagePullPolicy: IfNotPresent
- Non-root USER in Dockerfiles
- Security Context Constraints: restricted-v2

### Production Considerations

**High Availability:**
- MongoDB: 3-node replica set
- Kafka: 3-broker cluster
- Hazelcast: 2-node cluster
- Services: 2+ replicas for critical paths

**Network Policies:**
```yaml
# Default deny-all-ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

**Resource Limits:**
- Always set requests and limits
- Use LimitRange for namespace defaults
- Monitor with Prometheus alerts

**Backup Strategy:**
- MongoDB: Automated snapshots
- PVC: Volume snapshots
- ConfigMaps: GitOps (store in version control)

### Uninstallation

**Complete removal:**
```bash
kubectl delete namespace ez-platform
```

**Preserve data:**
```bash
kubectl delete deployment --all -n ez-platform
kubectl delete service --all -n ez-platform
# PVCs remain - data preserved
kubectl get pvc -n ez-platform
```

---

*Last verified: 2026-02-02*

*Consolidated from:*
- docs/deployment/DEPLOYMENT-PLAN-SINGLE-REPLICA.md
- docs/installation/INSTALLATION-GUIDE.md
- CLAUDE.md (Kubernetes operations section)

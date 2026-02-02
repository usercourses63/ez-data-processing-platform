# Week 2: Kubernetes Production Deployment - Implementation Plan

**Week:** 2 of 5
**Duration:** 7 days
**MCP Task:** task-36
**Status:** 🔄 In Progress
**Start Date:** December 9, 2025

---

## Objectives

### Primary Goal
Deploy the complete EZ Platform system in a Kubernetes cluster with all services and infrastructure.

### Success Criteria
- [ ] All 9 microservices deployed in K8s with appropriate replicas
- [ ] All infrastructure deployed (MongoDB, Kafka, Hazelcast, Prometheus, Grafana)
- [ ] Helm chart created with full configuration
- [ ] All services health checks passing
- [ ] Service-to-service communication working
- [ ] Monitoring and logging operational
- [ ] Auto-scaling configured
- [ ] Documentation complete

---

## Architecture Overview

### Target K8s Architecture

```
Namespace: ez-platform

Services (9):
├── FileDiscoveryService    (2 replicas, port 5007)
├── FileProcessorService    (5 replicas, port 5008)
├── ValidationService       (3 replicas, port 5003)
├── OutputService           (3 replicas, port 5009)
├── DataSourceManagement    (2 replicas, port 5001)
├── MetricsConfiguration    (2 replicas, port 5002)
├── InvalidRecords          (2 replicas, port 5006)
├── Scheduling              (1 replica,  port 5004)
└── Frontend                (2 replicas, port 3000)

Infrastructure:
├── MongoDB         (3-node StatefulSet, 20GB each)
├── Kafka           (3-node StatefulSet, 10GB each)
├── Hazelcast       (1-node StatefulSet, 512MB RAM, TTL-enabled)
├── Prometheus      (1 replica, 50GB storage)
├── Grafana         (1 replica, 10GB storage)
└── Elasticsearch   (3-node StatefulSet, 30GB each)
```

---

## Day-by-Day Plan

### Day 1: Service Deployments (Part 1)

**Goal:** Create K8s deployment YAMLs for core processing services

**Tasks:**
1. Create `k8s/deployments/filediscovery-deployment.yaml` (2 replicas)
2. Create `k8s/deployments/fileprocessor-deployment.yaml` (5 replicas)
3. Create `k8s/deployments/validation-deployment.yaml` (3 replicas)
4. Create `k8s/deployments/output-deployment.yaml` (3 replicas)

**Each deployment includes:**
- Container spec with image, ports, environment variables
- Resource requests (CPU: 500m, Memory: 1Gi)
- Resource limits (CPU: 2000m, Memory: 4Gi)
- Liveness probe (HTTP /health endpoint)
- Readiness probe (HTTP /health/ready endpoint)
- ConfigMap references
- Secret references

**Deliverables:**
- [ ] 4 deployment YAML files created
- [ ] All services configured with health checks
- [ ] Resource limits defined
- [ ] Replicas configured

---

### Day 2: Service Deployments (Part 2)

**Goal:** Create K8s deployment YAMLs for management services

**Tasks:**
1. Create `k8s/deployments/datasource-management-deployment.yaml` (2 replicas)
2. Create `k8s/deployments/metrics-configuration-deployment.yaml` (2 replicas)
3. Create `k8s/deployments/invalidrecords-deployment.yaml` (2 replicas)
4. Create `k8s/deployments/scheduling-deployment.yaml` (1 replica)
5. Create `k8s/deployments/frontend-deployment.yaml` (2 replicas)

**Services:**
- Create `k8s/services/` for all 9 services
- ClusterIP services for internal communication
- LoadBalancer for Frontend (port 3000)
- Ingress configuration (optional)

**Deliverables:**
- [ ] 5 deployment YAML files created
- [ ] 9 Service YAML files created
- [ ] All services have ClusterIP
- [ ] Frontend has LoadBalancer

---

### Day 3: Infrastructure - MongoDB & Kafka

**Goal:** Deploy MongoDB and Kafka StatefulSets

**MongoDB StatefulSet:**
- File: `k8s/infrastructure/mongodb-statefulset.yaml`
- 3 replicas (replica set)
- Persistent Volume Claims (20GB each)
- Headless service for replica set discovery
- Init container for replica set initialization
- ConfigMap for MongoDB configuration

**Kafka StatefulSet:**
- File: `k8s/infrastructure/kafka-statefulset.yaml`
- 3 replicas (cluster)
- Persistent Volume Claims (10GB each)
- Headless service for broker discovery
- ConfigMap for Kafka broker configuration
- Environment variables for cluster formation

**Deliverables:**
- [ ] MongoDB StatefulSet created
- [ ] MongoDB PVC and Service created
- [ ] Kafka StatefulSet created
- [ ] Kafka PVC and Service created
- [ ] Both can form clusters

---

### Day 4: Infrastructure - Hazelcast & Monitoring

**Goal:** Deploy Hazelcast, Prometheus, and Grafana

**Hazelcast StatefulSet:**
- File: `k8s/infrastructure/hazelcast-statefulset.yaml`
- 1 replica (single-node dev/staging)
- 512MB memory per pod (optimized for dev)
- Kubernetes discovery enabled
- ConfigMap for Hazelcast configuration with TTL:
  - `file-content` map: 5 min TTL, 3 min idle timeout, 256MB max, LRU eviction
  - `valid-records` map: 5 min TTL, 3 min idle timeout, 256MB max, LRU eviction
- REST API enabled for health probes
- TTL provides fallback safety if explicit cleanup fails

**Prometheus Deployment:**
- File: `k8s/infrastructure/prometheus-deployment.yaml`
- 1 replica
- 50GB persistent storage
- ConfigMap for Prometheus configuration
- Service scrape configs for all services

**Grafana Deployment:**
- File: `k8s/infrastructure/grafana-deployment.yaml`
- 1 replica
- 10GB persistent storage
- ConfigMap for datasource configuration
- Service for UI access

**Deliverables:**
- [ ] Hazelcast StatefulSet created
- [ ] Prometheus deployment created
- [ ] Grafana deployment created
- [ ] All monitoring operational

---

### Day 5-6: Helm Chart Creation

**Goal:** Create Helm chart for complete system deployment

**Helm Chart Structure:**
```
helm/ez-platform/
├── Chart.yaml                  # Chart metadata
├── values.yaml                 # Default values
├── values-dev.yaml             # Development overrides
├── values-prod.yaml            # Production overrides
├── templates/
│   ├── namespace.yaml
│   ├── configmaps/
│   │   ├── services-config.yaml
│   │   ├── mongodb-config.yaml
│   │   ├── kafka-config.yaml
│   │   ├── hazelcast-config.yaml
│   │   └── prometheus-config.yaml
│   ├── secrets/
│   │   └── platform-secrets.yaml
│   ├── deployments/
│   │   ├── filediscovery.yaml
│   │   ├── fileprocessor.yaml
│   │   ├── validation.yaml
│   │   ├── output.yaml
│   │   ├── datasource-management.yaml
│   │   ├── metrics-configuration.yaml
│   │   ├── invalidrecords.yaml
│   │   ├── scheduling.yaml
│   │   └── frontend.yaml
│   ├── statefulsets/
│   │   ├── mongodb.yaml
│   │   ├── kafka.yaml
│   │   └── hazelcast.yaml
│   ├── services/
│   │   ├── All service definitions
│   │   └── Headless services for StatefulSets
│   ├── ingress.yaml
│   └── hpa.yaml (Horizontal Pod Autoscaler)
└── README.md
```

**Deliverables:**
- [ ] Complete Helm chart structure
- [ ] All templates created
- [ ] Values files for dev/prod
- [ ] README with usage instructions

---

### Day 7: Deployment & Validation

**Goal:** Deploy via Helm and verify everything works

**Tasks:**
1. Create K8s cluster (Minikube or K3s)
2. Deploy using Helm: `helm install ez-platform ./helm/ez-platform`
3. Verify all pods are running
4. Check all services are healthy
5. Test service-to-service communication
6. Verify monitoring endpoints
7. Document deployment process

**Validation Steps:**
```bash
# Check all pods
kubectl get pods -n ez-platform

# Check services
kubectl get svc -n ez-platform

# Check StatefulSets
kubectl get statefulsets -n ez-platform

# Check health
kubectl get pods -n ez-platform -o wide | grep Running

# Test service communication
kubectl exec -it <filediscovery-pod> -- curl http://fileprocessor:5008/health
```

**Deliverables:**
- [ ] All pods running (23 total)
- [ ] All services accessible
- [ ] Health checks passing
- [ ] Service communication verified
- [ ] Deployment documented

---

## Implementation Details

### Kubernetes Deployment Template

**Example: FileDiscoveryService**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: filediscovery
  namespace: ez-platform
  labels:
    app: filediscovery
    component: processing
spec:
  replicas: 2
  selector:
    matchLabels:
      app: filediscovery
  template:
    metadata:
      labels:
        app: filediscovery
        component: processing
    spec:
      containers:
      - name: filediscovery
        image: ez-platform/filediscovery:latest
        ports:
        - containerPort: 5007
          name: http
        env:
        - name: ASPNETCORE_ENVIRONMENT
          value: "Production"
        - name: ConnectionStrings__MongoDB
          valueFrom:
            configMapKeyRef:
              name: services-config
              key: mongodb-connection
        - name: MassTransit__Kafka__Server
          valueFrom:
            configMapKeyRef:
              name: services-config
              key: kafka-server
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 5007
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 5007
          initialDelaySeconds: 15
          periodSeconds: 5
```

---

### Helm Values Template

**values.yaml:**
```yaml
# Global settings
global:
  namespace: ez-platform
  imageRegistry: docker.io
  imagePullPolicy: Always

# Services configuration
services:
  filediscovery:
    replicas: 2
    image:
      repository: ez-platform/filediscovery
      tag: latest
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 2000m
        memory: 4Gi

  fileprocessor:
    replicas: 5  # Higher for parallel processing
    image:
      repository: ez-platform/fileprocessor
      tag: latest
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 4000m
        memory: 8Gi

  # ... other services

# Infrastructure configuration
mongodb:
  replicas: 3
  storage: 20Gi
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi

kafka:
  replicas: 3
  storage: 10Gi
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi

hazelcast:
  replicas: 3
  memory: 8Gi
  storage: 5Gi

# Monitoring
prometheus:
  storage: 50Gi
  retentionDays: 15

grafana:
  storage: 10Gi
  adminPassword: <SECRET>
```

---

## Resource Planning

### Total Resource Requirements

**CPU Requests:** ~15 cores
**CPU Limits:** ~40 cores
**Memory Requests:** ~30GB
**Memory Limits:** ~80GB
**Storage:** ~300GB

**Recommended Cluster:**
- 3 worker nodes
- 16 cores per node
- 32GB RAM per node
- 100GB storage per node

---

## Week 2 Progress Tracking

### Day 1 Checklist
- [ ] FileDiscovery deployment created
- [ ] FileProcessor deployment created
- [ ] Validation deployment created
- [ ] Output deployment created

### Day 2 Checklist
- [ ] DataSourceManagement deployment created
- [ ] MetricsConfiguration deployment created
- [ ] InvalidRecords deployment created
- [ ] Scheduling deployment created
- [ ] Frontend deployment created
- [ ] All 9 services created

### Day 3 Checklist
- [ ] MongoDB StatefulSet created
- [ ] Kafka StatefulSet created
- [ ] Both can form clusters

### Day 4 Checklist
- [ ] Hazelcast StatefulSet created
- [ ] Prometheus deployment created
- [ ] Grafana deployment created

### Day 5-6 Checklist
- [ ] Helm chart structure created
- [ ] All templates created
- [ ] Values files created
- [ ] README created

### Day 7 Checklist
- [ ] Deployed via Helm
- [ ] All pods running
- [ ] Health checks passing
- [ ] Service communication verified

---

## Week 2 Sign-off

**Technical Criteria:**
- [ ] All deployments created
- [ ] All StatefulSets created
- [ ] Helm chart complete
- [ ] All pods running
- [ ] Health checks green

**Quality Criteria:**
- [ ] Resource limits appropriate
- [ ] Health checks configured
- [ ] ConfigMaps for all configs
- [ ] Secrets for credentials
- [ ] Documentation complete

**Sign-off:**
- DevOps: _____________ Date: _______
- Lead: _____________ Date: _______

**Status:** [ ] COMPLETE - Ready for Week 3

---

**Document Created:** December 2, 2025
**Last Updated:** December 2, 2025

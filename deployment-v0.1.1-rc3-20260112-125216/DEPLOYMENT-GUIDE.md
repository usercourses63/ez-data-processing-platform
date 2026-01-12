# EZ Platform v0.1.1-rc3 Deployment Package

**Build Date:** January 12, 2026
**Version:** v0.1.1-rc3
**MongoDB:** 3-node Replica Set (High Availability)

---

## 📦 Package Contents

### 1. Docker Images (20 total)

**Services (8):** `images/services/`
- datasource-management-v0.1.1-rc3.tar
- fileprocessor-v0.1.1-rc3.tar
- filediscovery-v0.1.1-rc3.tar
- validation-v0.1.1-rc3.tar
- scheduling-v0.1.1-rc3.tar
- output-v0.1.1-rc3.tar
- metrics-configuration-v0.1.1-rc3.tar
- invalidrecords-v0.1.1-rc3.tar

**Infrastructure (12):** `images/infrastructure/`
- MongoDB 8.0
- Kafka 7.5.0 + Zookeeper
- RabbitMQ 3 (management)
- Hazelcast 5.6
- Elasticsearch 8.17.0
- Prometheus (latest)
- Grafana (latest)
- Jaeger (all-in-one)
- OpenTelemetry Collector
- Fluent Bit (latest)

### 2. Kubernetes Manifests

**k8s/deployments/** - Service deployments (v0.1.1-rc3)
**k8s/services/** - Service definitions
**k8s/configmaps/** - MongoDB replica set configuration
**k8s/infrastructure/** - MongoDB StatefulSet (3 replicas), Kafka, etc.
**k8s/ingress/** - Ingress routing (if applicable)
**k8s/namespace.yaml** - Namespace definition (ez-platform)

### 3. Helm Charts

**helm/ez-platform/** - Standard Kubernetes Helm chart
**helm/ez-platform-ocp/** - OpenShift-specific Helm chart (OCP-compatible)

### 4. Scripts

**scripts/build-all-services-rc3.ps1** - Build all services
**scripts/export-images-rc3.ps1** - Export images to tar files
**scripts/deploy-local-rc3.ps1** - Deploy to local cluster
**scripts/test-replica-set-rc3.ps1** - Test MongoDB replica set
**scripts/start-port-forwards.ps1** - Start port forwarding (18 ports)
**scripts/bootstrap-k8s-cluster.ps1** - Initialize K8s cluster
**scripts/README-RC3-DEPLOYMENT.md** - Detailed deployment instructions

### 5. Documentation

**CHANGELOG.md** - v0.1.1-rc3 release notes
**DEPLOYMENT-GUIDE.md** - This file
**docs/CLAUDE.md** - Project configuration and standards
**docs/COMPREHENSIVE-PROJECT-ANALYSIS.md** - Architecture documentation

---

## 🚀 Quick Start Deployment

### Option 1: Kubernetes (Minikube/K8s)

```bash
# 1. Load images
cd images/services
for img in *.tar; do docker load -i "$img"; done
cd ../infrastructure
for img in *.tar; do docker load -i "$img"; done

# 2. Deploy to cluster
cd ../../k8s
kubectl apply -f namespace.yaml
kubectl apply -f configmaps/
kubectl apply -f infrastructure/
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
kubectl apply -f deployments/
kubectl apply -f services/

# 3. Initialize MongoDB replica set
kubectl exec -n ez-platform mongodb-0 -- mongosh --eval '
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongodb-0.mongodb.ez-platform.svc.cluster.local:27017" },
    { _id: 1, host: "mongodb-1.mongodb.ez-platform.svc.cluster.local:27017" },
    { _id: 2, host: "mongodb-2.mongodb.ez-platform.svc.cluster.local:27017" }
  ]
})'

# 4. Start port forwarding
cd ../scripts
powershell.exe -ExecutionPolicy Bypass -File start-port-forwards.ps1
```

### Option 2: Helm Deployment

```bash
# Load images first (same as above)

# Deploy with Helm
cd helm/ez-platform
helm install ez-platform . -n ez-platform --create-namespace

# Or for OpenShift
cd helm/ez-platform-ocp
helm install ez-platform . -n ez-platform --create-namespace
```

### Option 3: OpenShift (OCP)

```bash
# 1. Create project
oc new-project ez-platform

# 2. Load images to internal registry
cd images/services
for img in *.tar; do
  name=$(echo $img | sed 's/-v0.1.1-rc3.tar//')
  docker load -i "$img"
  docker tag "ez-platform/${name}:v0.1.1-rc3" "image-registry.openshift-image-registry.svc:5000/ez-platform/${name}:v0.1.1-rc3"
  docker push "image-registry.openshift-image-registry.svc:5000/ez-platform/${name}:v0.1.1-rc3"
done

# 3. Deploy using OCP-compatible Helm
cd ../../helm/ez-platform-ocp
helm install ez-platform . -n ez-platform

# 4. Initialize MongoDB replica set (same as K8s)
oc exec -n ez-platform mongodb-0 -- mongosh --eval 'rs.initiate(...)'
```

---

## 🔧 Configuration

### MongoDB Replica Set

**Connection String:**
```
mongodb://mongodb-0.mongodb.ez-platform.svc.cluster.local:27017,mongodb-1.mongodb.ez-platform.svc.cluster.local:27017,mongodb-2.mongodb.ez-platform.svc.cluster.local:27017/?replicaSet=rs0
```

**Topology:** 1 PRIMARY + 2 SECONDARY nodes

### Service Ports

| Service | Port | Protocol |
|---------|------|----------|
| DataSource Management | 5001 | HTTP |
| Metrics Configuration | 5002 | HTTP |
| Validation | 5003 | HTTP |
| Scheduling | 5004 | HTTP |
| Invalid Records | 5006 | HTTP |
| FileDiscovery | 5007 | HTTP |
| FileProcessor | 5008 | HTTP |
| Output | 5009 | HTTP |
| Frontend | 80/8080 | HTTP |
| MongoDB | 27017 | TCP |
| Kafka | 9092 (internal), 9094 (external) | TCP |
| RabbitMQ | 5672 | AMQP |
| Hazelcast | 5701 | TCP |
| Elasticsearch | 9200 | HTTP |
| Prometheus System | 9090 | HTTP |
| Prometheus Business | 9091 | HTTP |
| Grafana | 3000 | HTTP |
| Jaeger | 16686 | HTTP |
| OTEL Collector | 4317 (gRPC), 4318 (HTTP) | OTLP |

### Environment Variables

All services are configured via Kubernetes ConfigMaps:
- **services-config.yaml** - MongoDB, Kafka, RabbitMQ, Hazelcast connections
- Supports environment-specific overrides

---

## ✅ Verification

### 1. Check MongoDB Replica Set
```bash
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet --eval "rs.status().members.forEach(m => print(m.name + ' - ' + m.stateStr))"
```

**Expected Output:**
```
mongodb-0.mongodb.ez-platform.svc.cluster.local:27017 - PRIMARY
mongodb-1.mongodb.ez-platform.svc.cluster.local:27017 - SECONDARY
mongodb-2.mongodb.ez-platform.svc.cluster.local:27017 - SECONDARY
```

### 2. Check All Pods
```bash
kubectl get pods -n ez-platform
```

**Expected:** All pods Running (1/1 or 3/3 for StatefulSets)

### 3. Test Service Health
```bash
# Port forward first
kubectl port-forward -n ez-platform deployment/datasource-management 5001:5001 &

# Test endpoints
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
```

### 4. Run Automated Tests
```bash
cd scripts
powershell.exe -ExecutionPolicy Bypass -File test-replica-set-rc3.ps1
```

---

## 📊 Monitoring & Observability

### Access URLs (after port forwarding)

- **Grafana:** http://localhost:3001 (admin/admin)
- **Prometheus System:** http://localhost:9090
- **Prometheus Business:** http://localhost:9091
- **Jaeger:** http://localhost:16686
- **Elasticsearch:** http://localhost:9200

### Business Metrics

20 custom metrics available:
- `business_records_processed_total`
- `business_invalid_records_total`
- `business_files_processed_total`
- `business_processing_duration_seconds`
- `business_end_to_end_latency_seconds`

---

## 🔒 Security (OCP-Compatible)

All services configured with:
- Non-root user (UID 1000)
- Read-only root filesystem
- Dropped ALL capabilities
- Non-privileged ports (>1024)
- SeccompProfile: RuntimeDefault

**OpenShift SCC:** `restricted-v2`

---

## 🆘 Troubleshooting

### MongoDB Connection Issues
```bash
# Check replica set status
kubectl exec -n ez-platform mongodb-0 -- mongosh --eval "rs.status()"

# Check ConfigMap
kubectl get configmap services-config -n ez-platform -o yaml | grep mongodb-connection

# Restart services
kubectl rollout restart deployment/datasource-management -n ez-platform
```

### Pod Not Starting
```bash
# Check events
kubectl get events -n ez-platform --sort-by='.lastTimestamp'

# Check logs
kubectl logs deployment/<service-name> -n ez-platform --tail=100

# Describe pod
kubectl describe pod <pod-name> -n ez-platform
```

### Port Forwarding Issues
```bash
# Kill existing forwards
taskkill /F /IM kubectl.exe

# Restart port forwards
cd scripts
powershell.exe -ExecutionPolicy Bypass -File start-port-forwards.ps1
```

---

## 📝 Release Notes

### v0.1.1-rc3 (January 12, 2026)

**New Features:**
- MongoDB 3-node replica set for high availability
- Proper URI parsing for replica set connections
- All services updated with `MongoDB.Driver` namespace

**Infrastructure:**
- MongoDB StatefulSet: 3 replicas (1 PRIMARY + 2 SECONDARY)
- Connection string updated with all replica set members
- Services use `MongoClientSettings.FromConnectionString()` for proper parsing

**Bug Fixes:**
- Fixed `:27017` port concatenation issue in replica set URIs
- Added missing `using MongoDB.Driver` to all 8 services
- Updated build scripts to use correct Dockerfile paths

**Testing:**
- All 8 services verified with MongoDB replica set
- Health endpoints responding correctly
- Replica set failover tested

---

## 📞 Support

**Documentation:** See `docs/` folder
**Scripts:** See `scripts/README-RC3-DEPLOYMENT.md`
**Configuration:** See `CLAUDE.md` in docs/

**Git Repository:** https://github.com/usercourses63/ez-data-processing-platform
**Tag:** v0.1.1-rc3
**Commit:** e5e8491

---

**Package Size:** ~3.5 GB (compressed)
**Deployment Time:** ~10 minutes (including image loading)
**Target:** Kubernetes 1.28+, OpenShift 4.14+

**Status:** ✅ Production Ready (92% Complete - Week 5 Validation Phase)

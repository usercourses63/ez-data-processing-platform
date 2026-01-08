# EZ Platform v0.1.1-rc2 - Installation Package

**Complete Offline Installation Package**

---

## Package Contents

This package contains everything needed for offline deployment:

- ✅ **21 Docker Images** (4.1GB)
  - 10 application services
  - 11 infrastructure services
  - See `IMAGE-MANIFEST.txt` for complete list

- ✅ **Kubernetes Manifests** (33 files)
  - All deployments, services, configmaps
  - Infrastructure configurations
  - Ready to deploy

- ✅ **Helm Chart** (optional)
  - Alternative deployment method
  - Located in `helm/ez-platform/`

- ✅ **Documentation**
  - MkDocs site (as Docker image)
  - All guides included in `docs/`

- ✅ **Installation Scripts**
  - Automated installation
  - Image loading script

---

## Quick Installation

### Prerequisites

- Kubernetes cluster (v1.25+)
- kubectl configured
- Docker installed (for loading images)
- 16GB RAM, 50GB storage

### Install Steps

```bash
# 1. Extract package
tar -xzf ezplatform-v0.1.1-rc2.tar.gz
cd ezplatform-v0.1.1-rc2

# 2. Load Docker images (5-10 minutes)
chmod +x scripts/*.sh
./scripts/load-images.sh

# 3. Deploy to Kubernetes (5 minutes)
./scripts/install.sh

# 4. Get node IP and access
kubectl get nodes -o wide
# Access: http://<NODE-IP>:30080
```

---

## Manual Installation

### 1. Load Images

```bash
cd images/
for img in *.tar; do
    docker load -i "$img"
done
```

### 2. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace ez-platform

# Deploy infrastructure
kubectl apply -f k8s/infrastructure/

# Wait for infrastructure
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

# Deploy services
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
```

### 3. Verify Deployment

```bash
kubectl get pods -n ez-platform
# All pods should be Running
```

---

## OpenShift (OCP) Deployment

### Prerequisites for OCP

- OpenShift Container Platform 4.10+
- `oc` CLI configured and authenticated
- Cluster admin access (for SCC configuration)
- Project/namespace creation permissions
- 16GB RAM, 50GB storage available

### Security Context Constraints (SCC)

EZ Platform requires specific SCCs to run properly on OpenShift:

```bash
# 1. Create the namespace
oc new-project ez-platform

# 2. Grant restricted-v2 SCC to service accounts (recommended)
oc adm policy add-scc-to-user restricted-v2 -z default -n ez-platform

# 3. For infrastructure components that need elevated privileges:
# MongoDB, Elasticsearch, and Kafka may require anyuid SCC
oc adm policy add-scc-to-user anyuid -z mongodb -n ez-platform
oc adm policy add-scc-to-user anyuid -z elasticsearch -n ez-platform
oc adm policy add-scc-to-user anyuid -z kafka -n ez-platform
```

### OCP Deployment Steps

```bash
# 1. Login to OpenShift
oc login <cluster-url> --token=<token>

# 2. Create namespace
oc new-project ez-platform

# 3. Load images to internal registry (or use external registry)
# Option A: Push to internal registry
oc registry login
for img in images/*.tar; do
    docker load -i "$img"
done
# Tag and push images to internal registry
docker tag ezplatform-frontend:v0.1.1-rc2 image-registry.openshift-image-registry.svc:5000/ez-platform/frontend:v0.1.1-rc2
docker push image-registry.openshift-image-registry.svc:5000/ez-platform/frontend:v0.1.1-rc2
# Repeat for all images...

# Option B: Use external registry - update image references in deployments

# 4. Apply SCCs (see above)
oc adm policy add-scc-to-user restricted-v2 -z default -n ez-platform

# 5. Deploy infrastructure
oc apply -f k8s/infrastructure/

# 6. Wait for infrastructure
oc wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

# 7. Deploy configmaps and services
oc apply -f k8s/configmaps/
oc apply -f k8s/deployments/
oc apply -f k8s/services/

# 8. Create Routes (instead of Ingress)
oc apply -f k8s/ocp-routes.yaml

# 9. Verify deployment
oc get pods -n ez-platform
oc get routes -n ez-platform
```

### NetworkPolicy Requirements

OpenShift clusters with network policies enabled require the following configurations:

```bash
# Allow ingress to frontend and API services
oc apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-ingress
  namespace: ez-platform
spec:
  podSelector:
    matchLabels:
      app: frontend
  ingress:
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 8080
EOF

# Allow inter-service communication within namespace
oc apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
  namespace: ez-platform
spec:
  podSelector: {}
  ingress:
  - from:
    - podSelector: {}
EOF
```

### Routes Configuration

OpenShift Routes are provided in `k8s/ocp-routes.yaml`. These replace standard Kubernetes Ingress:

| Route | Path | Target Service | Port |
|-------|------|----------------|------|
| frontend | / | frontend | 8080 |
| docs | /docs | docs | 8080 |
| api | /api | datasource-management | 5001 |
| grafana | /grafana | ezplatform-grafana | 3000 |

Access your routes:
```bash
# List all routes
oc get routes -n ez-platform

# Get frontend URL
oc get route frontend -n ez-platform -o jsonpath='{.spec.host}'
```

### Non-Privileged Ports

**Important:** OpenShift restricts containers from binding to privileged ports (< 1024). EZ Platform uses non-privileged ports:

| Service | Container Port | Notes |
|---------|---------------|-------|
| Frontend | 8080 | Nginx configured for non-root |
| Documentation | 8080 | MkDocs/nginx on non-privileged port |
| Backend Services | 5001-5009 | Already non-privileged |

The frontend and docs containers are configured to run as non-root users and listen on port 8080 instead of port 80.

### OCP Troubleshooting

**Issue: Pods stuck in CrashLoopBackOff due to SCC**
```bash
# Check SCC issues
oc describe pod <pod-name> -n ez-platform | grep -i scc
oc get events -n ez-platform --sort-by='.lastTimestamp' | grep -i scc

# Verify SCC assignment
oc adm policy who-can use scc restricted-v2 -n ez-platform
```

**Issue: Route not accessible**
```bash
# Verify route is created
oc describe route frontend -n ez-platform

# Check if service has endpoints
oc get endpoints frontend -n ez-platform
```

**Issue: Image pull errors**
```bash
# Check image pull secrets
oc get secrets -n ez-platform | grep pull

# Create pull secret if needed
oc create secret docker-registry my-registry-secret \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<password> \
  -n ez-platform
```

---

## Access

**Frontend (NodePort):**
```bash
# Get node IP
kubectl get nodes -o wide

# Access
http://<NODE-IP>:30080
```

**Documentation Site (Optional):**
```bash
# Deploy docs
kubectl run ezplatform-docs \
  --image=ezplatform-docs:v0.1.1-rc2 \
  --port=80 \
  -n ez-platform

kubectl expose pod ezplatform-docs \
  --type=NodePort \
  --port=80 \
  --target-port=80 \
  -n ez-platform

# Access
http://<NODE-IP>:<DOCS-NODEPORT>
```

---

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Grafana | admin | EZPlatform2025!Beta |
| RabbitMQ Management | guest | guest |
| MongoDB | - | No auth (dev mode) |

---

## Documentation

Included documentation:
- **Installation Guide:** `docs/docs/installation.md`
- **Admin Guide:** `docs/docs/admin.md`
- **User Guide (Hebrew):** `docs/docs/user-guide-he.md`
- **Release Notes:** `docs/docs/release-notes.md`

View documentation:
```bash
cd docs
mkdocs serve
# Or deploy ezplatform-docs container
```

---

## Package Structure

```
ezplatform-v0.1.1-rc2/
├── images/              # 21 Docker images (.tar files, 4.1GB)
├── k8s/                 # Kubernetes manifests
│   ├── deployments/     # Service deployments
│   ├── services/        # Service definitions
│   ├── infrastructure/  # MongoDB, Kafka, etc.
│   ├── configmaps/      # Configuration
│   └── namespace.yaml   # Namespace definition
├── helm/                # Helm chart (optional)
│   └── ez-platform/
├── docs/                # MkDocs documentation site
│   ├── Dockerfile       # Docs site Docker image
│   ├── mkdocs.yml       # MkDocs configuration
│   └── docs/            # Documentation files
├── scripts/             # Installation scripts
│   ├── load-images.sh   # Load all Docker images
│   └── install.sh       # Complete installation
├── IMAGE-MANIFEST.txt   # List of all images
└── README.md            # This file
```

---

## Troubleshooting

**Issue: Pods not starting**
```bash
kubectl get events -n ez-platform --sort-by='.lastTimestamp'
kubectl describe pod <pod-name> -n ez-platform
```

**Issue: Images not loading**
```bash
# Verify Docker can see images
docker images | grep v0.1.1-rc2

# Verify minikube can see images (if using minikube)
minikube image ls | grep v0.1.1-rc2
```

---

## Support

- **Installation Guide:** docs/docs/installation.md
- **Admin Guide:** docs/docs/admin.md
- **GitHub:** https://github.com/usercourses63/ez-data-processing-platform

---

**Version:** v0.1.1-rc2
**Release Date:** January 1, 2026
**Package Size:** 4.1GB (images) + manifests + docs

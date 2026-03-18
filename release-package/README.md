# EZ Platform v0.2.0 - Installation Package

**Complete Offline Installation Package**

---

## Package Contents

This package contains everything needed for offline deployment:

- **21 Docker Images** (~4.5GB)
  - 10 application services (including Docusaurus docs portal)
  - 11 infrastructure services
  - See `IMAGE-MANIFEST.txt` for complete list

- **Helm Chart**
  - Primary deployment method
  - Located in `helm/ez-platform/`
  - Includes `values-local.yaml` for dev PC deployment

- **Documentation**
  - Docusaurus docs portal (as Docker image)
  - All guides included in `docs/`

- **Installation Scripts**
  - Automated installation (PowerShell + Bash)
  - Image loading script

---

## Quick Installation

### Prerequisites

- Kubernetes cluster (v1.25+)
- kubectl configured
- Helm 3.8+
- Docker or minikube (for loading images)
- 16GB RAM, 50GB storage

### Install Steps

```bash
# 1. Extract package
tar -xzf ezplatform-v0.2.0.tar.gz
cd ezplatform-v0.2.0

# 2. Load Docker images (5-10 minutes)
chmod +x scripts/*.sh
./scripts/load-images.sh

# 3. Deploy to Kubernetes
# For production:
./scripts/install.sh

# For local dev PC (single replicas, reduced resources):
./scripts/install.sh --local

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

### 2. Deploy via Helm

```bash
# Production deployment
helm install ez-platform ./helm/ez-platform \
    --namespace ez-platform \
    --create-namespace \
    --wait --timeout 15m

# Local dev PC deployment (single replicas, reduced resources)
helm install ez-platform ./helm/ez-platform \
    --namespace ez-platform \
    --create-namespace \
    --values helm/ez-platform/values-local.yaml \
    --wait --timeout 15m
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
docker tag frontend:v0.2.0 image-registry.openshift-image-registry.svc:5000/ez-platform/frontend:v0.2.0
docker push image-registry.openshift-image-registry.svc:5000/ez-platform/frontend:v0.2.0
# Repeat for all images...

# Option B: Use external registry - update image references in Helm values

# 4. Apply SCCs (see above)
oc adm policy add-scc-to-user restricted-v2 -z default -n ez-platform

# 5. Deploy via Helm
helm install ez-platform ./helm/ez-platform \
    --namespace ez-platform \
    --create-namespace \
    --wait --timeout 15m

# 6. Create Routes (instead of Ingress)
oc apply -f k8s/ocp-routes.yaml

# 7. Verify deployment
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
| Documentation | 8080 | Docusaurus on non-privileged port |
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

**Frontend (Port-Forward):**
```bash
kubectl port-forward svc/frontend 7000:8080 -n ez-platform
# Access: http://localhost:7000
```

**Documentation Portal:**
```bash
kubectl port-forward svc/docs 8080:8080 -n ez-platform
# Access: http://localhost:8080
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

View documentation via the Docusaurus docs portal:
```bash
kubectl port-forward svc/docs 8080:8080 -n ez-platform
# Open: http://localhost:8080
```

---

## Package Structure

```
ezplatform-v0.2.0/
├── images/              # 21 Docker images (.tar files, ~4.5GB)
├── helm/                # Helm chart (primary deployment)
│   └── ez-platform/
│       ├── values.yaml          # Production values
│       └── values-local.yaml    # Dev PC values (single replicas)
├── k8s/                 # Kubernetes manifests (alternative)
│   ├── deployments/     # Service deployments
│   ├── services/        # Service definitions
│   ├── infrastructure/  # MongoDB, Kafka, etc.
│   ├── configmaps/      # Configuration
│   └── namespace.yaml   # Namespace definition
├── docs/                # Docusaurus documentation site
│   ├── Dockerfile       # Docs site Docker image
│   └── docs/            # Documentation files
├── scripts/             # Installation scripts
│   ├── load-images.sh   # Load all Docker images
│   ├── install.ps1      # PowerShell installer
│   └── install.sh       # Bash installer
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
docker images | grep v0.2.0

# Verify minikube can see images (if using minikube)
minikube image ls | grep v0.2.0
```

---

## Support

- **Installation Guide:** docs/docs/installation.md
- **Admin Guide:** docs/docs/admin.md
- **GitHub:** https://github.com/usercourses63/ez-data-processing-platform

---

---

## Offline / Air-Gapped Deployment

The CI pipeline produces a self-contained deployment folder on every successful build. This folder can be physically transferred to an air-gapped network and deployed without internet access.

### CI Package Structure

```
deployment-{VERSION}-{YYYYMMDD}-{HHMMSS}/
├── images/
│   ├── services/           # 10 application image .tar files (built from source)
│   └── infrastructure/     # 11 infrastructure image .tar files
├── helm/
│   └── ez-platform/        # Full Helm chart
├── values-local.yaml       # Single-replica deployment config
├── install.ps1             # PowerShell installer (Windows)
├── install.sh              # Bash installer (Linux/macOS)
├── IMAGE-MANIFEST.txt      # All 21 images with versions
└── DEPLOYMENT-GUIDE.md     # Install instructions
```

### Offline Install Steps

**Prerequisites:** kubectl, helm 3.8+, minikube (or any Kubernetes cluster)

**Windows (PowerShell):**
```powershell
# 1. Load all images into your cluster
foreach ($tar in Get-ChildItem images\services\*.tar, images\infrastructure\*.tar) {
    minikube image load $tar.FullName
}

# 2. Deploy
.\install.ps1 --local
```

**Linux/macOS (Bash):**
```bash
# 1. Load all images into your cluster
for tar in images/services/*.tar images/infrastructure/*.tar; do
    minikube image load "$tar"
done

# 2. Deploy
bash install.sh ez-platform 15m
```

### OCP / OpenShift Air-Gapped

For OpenShift Container Platform (OCP) air-gapped environments:
1. Mirror images using `oc image mirror` or `skopeo copy` from the .tar files
2. Update `values-local.yaml` with your internal registry URLs
3. Apply OCP-specific resources: `kubectl apply -f helm/ez-platform/templates/ocp-routes.yaml`

See `DEPLOYMENT-GUIDE.md` in the package for full OCP instructions.

### Obtaining the Deployment Package

CI artifacts are available under **Actions -> package-release** in GitHub for 90 days after each build. Tagged releases attach the package as a release asset on the GitHub Releases page.

---

**Version:** v0.2.0
**Release Date:** March 2026
**Package Size:** ~4.5GB (images) + Helm chart + docs

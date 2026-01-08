# EZ Platform v0.1.1-rc2 - Production Deployment File List

**Generated:** January 8, 2026
**Version:** v0.1.1-rc2

---

## Quick Summary

For production deployment, copy the entire `release-package` directory. The minimum required files are listed below.

---

## REQUIRED FILES (Minimum for Deployment)

### 1. Kubernetes Manifests (`k8s/`)
```
k8s/
├── configmaps/
│   └── services-config.yaml
├── deployments/
│   ├── datasource-management-deployment.yaml
│   ├── docs-deployment.yaml
│   ├── filediscovery-deployment.yaml
│   ├── fileprocessor-deployment.yaml
│   ├── fluent-bit.yaml
│   ├── frontend-deployment.yaml
│   ├── invalidrecords-deployment.yaml
│   ├── jaeger.yaml
│   ├── metrics-configuration-deployment.yaml
│   ├── output-deployment.yaml
│   ├── otel-collector.yaml
│   ├── scheduling-deployment.yaml
│   └── validation-deployment.yaml
├── infrastructure/
│   ├── elasticsearch-deployment.yaml
│   ├── grafana-deployment.yaml
│   ├── hazelcast-statefulset.yaml
│   ├── kafka-statefulset.yaml
│   ├── mongodb-statefulset.yaml
│   ├── prometheus-business-deployment.yaml
│   ├── prometheus-system-deployment.yaml
│   └── rabbitmq.yaml
├── networkpolicies/
│   └── deny-all-ingress.yaml
├── ocp/
│   └── routes/
│       └── *.yaml (OCP Routes)
├── services/
│   └── *.yaml (Service definitions)
├── namespace.yaml
└── storage-class.yaml
```

### 2. Docker Images (`images/`)
```
images/
├── datasource-management-v0.1.1-rc2.tar.gz
├── filediscovery-v0.1.1-rc2.tar.gz
├── fileprocessor-v0.1.1-rc2.tar.gz
├── frontend-v0.1.1-rc2.tar.gz
├── invalidrecords-v0.1.1-rc2.tar.gz
├── metrics-configuration-v0.1.1-rc2.tar.gz
├── output-v0.1.1-rc2.tar.gz
├── scheduling-v0.1.1-rc2.tar.gz
├── validation-v0.1.1-rc2.tar.gz
├── docs-docusaurus-v0.1.1-rc2.tar.gz
├── mongo-8.0.tar
├── rabbitmq-3-management-alpine.tar
├── confluentinc-cp-kafka-7.5.0.tar
├── confluentinc-cp-zookeeper-7.5.0.tar
├── hazelcast-hazelcast-5.6.tar
├── grafana-grafana-11.4.0.tar
├── prom-prometheus-v3.0.0.tar
├── jaegertracing-all-in-one-1.64.0.tar
├── otel-opentelemetry-collector-contrib-0.115.0.tar
├── docker.elastic.co-elasticsearch-elasticsearch-8.17.0.tar
└── fluent-fluent-bit-3.2.2.tar
```

### 3. Deployment Scripts (`scripts/`)
```
scripts/
├── deploy-all.ps1          # Main deployment script (PowerShell)
├── install.ps1             # Installation helper
├── uninstall.ps1           # Cleanup script
└── start-port-forwards.ps1 # Port forwarding for development
```

### 4. Helm Chart (`helm/`) - Alternative to kubectl
```
helm/
└── ez-platform/
    ├── Chart.yaml
    ├── values.yaml
    ├── templates/
    │   └── *.yaml
    └── README.md
```

---

## RECOMMENDED FILES (Documentation & Troubleshooting)

### Root Documentation
```
./CHANGELOG.md                         # Version history
./DEPLOYMENT-TROUBLESHOOTING-GUIDE.md  # Troubleshooting guide (CRITICAL)
./DEPLOYMENT-SUCCESS-SUMMARY.md        # Deployment verification
./README.md                            # Quick start guide
./RELEASE-PACKAGE-MANIFEST.md          # Package contents
./IMAGE-MANIFEST.txt                   # Image versions
```

### Docusaurus Documentation Portal (`docs-docusaurus/`)
```
docs-docusaurus/
├── docs/                    # Documentation source
├── static/                  # Static assets
├── docusaurus.config.js     # Docusaurus config
├── nginx.conf               # Nginx server config
├── nginx-main.conf          # Nginx main config (OCP)
├── Dockerfile               # OCP-compatible build
└── package.json             # Node dependencies
```

---

## DEPLOYMENT COMMANDS

### Option 1: Helm (Recommended)
```bash
cd helm/ez-platform
helm install ez-platform . -n ez-platform --create-namespace
```

### Option 2: kubectl
```bash
cd k8s
kubectl create namespace ez-platform
kubectl apply -f namespace.yaml
kubectl apply -f configmaps/
kubectl apply -f infrastructure/
kubectl apply -f deployments/
kubectl apply -f services/
```

### Option 3: PowerShell Script
```powershell
.\scripts\deploy-all.ps1 -Namespace ez-platform
```

---

## IMAGE LOADING (Offline Deployment)

```bash
# Load all images into cluster
cd images/
for file in *.tar*; do
    minikube image load "$file"
    # OR for production: docker load -i "$file"
done
```

---

## FILE COUNTS

| Directory | Files | Purpose |
|-----------|-------|---------|
| k8s/ | 39 | Kubernetes manifests |
| images/ | 23 | Docker images |
| helm/ | 31 | Helm chart |
| scripts/ | 2 | Deployment scripts |
| docs/ | 96 | MkDocs documentation |
| docs-docusaurus/ | 35,786 | Docusaurus portal (node_modules) |

**Note:** The `docs-docusaurus/` directory is large due to node_modules. For production, you can:
1. Use the pre-built Docker image (`docs-docusaurus-v0.1.1-rc2.tar.gz`)
2. Or run `npm ci && npm run build` in a clean directory

---

## OCP/OpenShift Specific

For OpenShift deployment, use:
```
k8s/ocp/routes/           # OCP Routes (instead of Ingress)
k8s/networkpolicies/      # NetworkPolicies
```

All pods use:
- SecurityContext: runAsNonRoot, runAsUser 1000
- Non-privileged ports (8080 for web)
- No capabilities (drop ALL)

---

## Verification After Deployment

1. Check all pods are running:
   ```bash
   kubectl get pods -n ez-platform
   ```

2. Access frontend:
   ```bash
   kubectl port-forward svc/frontend 3000:80 -n ez-platform
   # Open http://localhost:3000
   ```

3. Check API health:
   ```bash
   curl http://localhost:5001/health
   ```

---

**Document End**

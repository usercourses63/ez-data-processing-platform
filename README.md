# EZ Platform v0.1.1-rc2

**Data Processing Platform for Enterprise File Management**

[![Release](https://img.shields.io/badge/release-v0.1.1--rc2-blue)](https://github.com/usercourses63/ez-data-processing-platform/releases/tag/v0.1.1-rc2)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-10.0-purple)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![OCP Compatible](https://img.shields.io/badge/OCP-Compatible-red)](https://www.openshift.com/)

---

## Overview

EZ Platform: Microservices-based data processing with automated file discovery, format conversion, schema validation, and multi-destination output.

**Key Features:**
- 📁 Multi-source file discovery (Local, SFTP, FTP, HTTP, Kafka)
- 🔄 Format conversion (CSV, JSON, XML, Excel)
- ✅ JSON Schema validation
- 📤 Multi-destination output
- 🌐 Hebrew/RTL UI
- 📊 Business metrics & monitoring
- 📝 Swagger/OpenAPI documentation
- 🔒 OCP/OpenShift Compatible (NEW in v0.1.1-rc2)

---

## Quick Start

### Option 1: Helm Installation (Recommended)
```bash
# Install using Helm
helm install ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --create-namespace

# Wait for deployment
kubectl wait --for=condition=ready pod --all -n ez-platform --timeout=10m

# Access via port-forward
kubectl port-forward svc/frontend 3000:80 -n ez-platform
# Open: http://localhost:3000
```

### Option 2: Direct Kubernetes Manifests
```bash
# Deploy with kubectl
kubectl create namespace ez-platform
kubectl apply -f k8s/

# Access (get node IP first)
kubectl get nodes -o wide
# Open: http://<NODE-IP>:30080
```

**📖 Full Guide:** [Installation Guide](docs/installation/INSTALLATION-GUIDE.md) | [Helm Chart README](helm/ez-platform/README.md)

---

## Network Access

### Production (Internal LAN)
```
Frontend: http://<K8S-NODE-IP>:30080
Example: http://192.168.1.50:30080
```

### Development (localhost)
```bash
scripts/start-port-forwards.ps1
# Access: http://localhost:3000
```

---

## Documentation

- **[Installation Guide](docs/installation/INSTALLATION-GUIDE.md)** - Complete deployment
- **[Admin Guide](docs/admin/ADMIN-GUIDE.md)** - System administration
- **[User Guide (Hebrew)](docs/user-guide/USER-GUIDE-HE.md)** - מדריך משתמש
- **[Release Notes](release-package/docs/docs/release-notes.md)** - What's new
- **[Deployment Plan v0.1.1](release-package/Deployment Plan v0.1.1-rc1.md)** - Offline deployment guide
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

---

## Architecture

**9 Microservices** (.NET 10) + React Frontend
- DataSourceManagement, FileDiscovery, FileProcessor
- Validation, Output, InvalidRecords
- Scheduling, MetricsConfiguration
- Frontend (React 19 + TypeScript)

**Infrastructure:**
MongoDB, RabbitMQ, Kafka, Hazelcast, Elasticsearch, Prometheus, Grafana, Jaeger

---

## Default Credentials

| Service | User | Password |
|---------|------|----------|
| Grafana | admin | EZPlatform2025!Beta |
| RabbitMQ | guest | guest |

---

**Version:** v0.1.1-rc2
**Release:** January 8, 2026
**Status:** Release Candidate - OCP Compatibility Update
**Download:** [GitHub Releases](https://github.com/usercourses63/ez-data-processing-platform/releases/tag/v0.1.1-rc2)

**What's New in v0.1.1-rc2:**
- 🔒 Full OCP/OpenShift Container Platform compatibility
- 🔐 SecurityContext with non-root user for all pods
- 🛡️ NetworkPolicies for pod isolation
- 🔌 Non-privileged ports (8080 for web services)
- 📦 All images pinned to specific versions (no :latest)
- 🪟 PowerShell deployment scripts for Windows
- 📄 Comprehensive deployment troubleshooting guide

**Previous (v0.1.1-rc1):**
- ✅ Swagger/OpenAPI documentation on all backend services
- ✅ Frontend branding with EZ Platform logo and splash screen
- ✅ Fixed MetricsConfigurationService health checks

---

## OCP Deployment

For OpenShift Container Platform, use the OCP-specific resources:

```bash
# Apply OCP Routes instead of Ingress
kubectl apply -f k8s/ocp/routes/

# Apply NetworkPolicies
kubectl apply -f k8s/networkpolicies/

# Verify SCC compliance
oc get pod -n ez-platform -o yaml | grep -A5 securityContext
```

**Requirements:**
- SCC: restricted-v2 (default)
- Ports: All services use >1024 (non-privileged)
- Users: All containers run as non-root (UID 1000+)

See [DEPLOYMENT-TROUBLESHOOTING-GUIDE.md](release-package/DEPLOYMENT-TROUBLESHOOTING-GUIDE.md) for OCP-specific issues.

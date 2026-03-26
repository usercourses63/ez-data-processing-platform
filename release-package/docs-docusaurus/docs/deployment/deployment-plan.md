---
sidebar_position: 1
---

# EZ Platform v0.4.0 - Deployment Guide

**Version:** v0.4.0
**Date:** March 2026
**Status:** Production Ready

---

## Executive Summary

This guide covers deploying EZ Platform v0.4.0 on Kubernetes. The platform consists of 9 microservices, a React frontend, and supporting infrastructure (MongoDB, Kafka, RabbitMQ, Hazelcast, Elasticsearch, Prometheus, Grafana, Jaeger).

For detailed step-by-step installation, see the [Installation Guide](/docs/installation).

---

## Service Image Tags

All v0.4.0 service images:

| Service | Image Tag | Port |
|---------|-----------|------|
| datasource-management | `datasource-management:v0.4.0` | 5001 |
| filediscovery | `filediscovery:v0.4.0` | 5005 |
| fileprocessor | `fileprocessor:v0.4.0` | 5008 |
| validation | `validation:v0.4.0` | 5003 |
| output | `output:v0.4.0` | 5009 |
| scheduling | `scheduling:v0.4.0` | 5004 |
| invalidrecords | `invalidrecords:v0.4.0` | 5007 |
| metrics-configuration | `metrics-configuration:v0.4.0` | 5002 |
| frontend | `frontend:v0.4.0` | 7000 (port-forward) / 30080 (NodePort) |

---

## Deployment Order

### Phase 1: Infrastructure

```bash
kubectl create namespace ez-platform
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/infrastructure/
```

Wait for MongoDB, Kafka, RabbitMQ, Hazelcast to be ready before proceeding.

### Phase 2: RBAC and Secrets

```bash
kubectl apply -f k8s/rbac/nas-device-rbac.yaml
```

NAS device RBAC is required for PV/PVC auto-provisioning.

### Phase 3: Microservices

```bash
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
```

### Phase 4: Port Forwarding / Ingress

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1
```

Or configure Ingress/Routes for production access.

---

## v0.4.0 Deployment Notes

### Archive API (Import from File)

The DataSourceManagement service includes new archive endpoints for Import from File:

- `POST /api/v1/archive/analyze` -- Analyze archive contents
- `POST /api/v1/archive/extract` -- Extract specific file

**nginx requirement:** The frontend nginx config must include:
```nginx
client_max_body_size 100m;
```

This is pre-configured in the v0.4.0 frontend image.

### NAS Device Provisioning

NAS devices require Kubernetes RBAC permissions for PV/PVC management:
```bash
kubectl apply -f k8s/rbac/nas-device-rbac.yaml
```

Verify RBAC:
```bash
kubectl auth can-i create persistentvolumes --as=system:serviceaccount:ez-platform:datasource-management
```

### SignalR WebSocket (v0.3.0+)

SignalR hubs are enabled by default on DataSourceManagement and InvalidRecords services. Ensure your ingress controller supports WebSocket connections if using Ingress/Routes.

### Auto-Revalidation (v0.5.0)

If deploying with v0.5.0 features:
- New Kafka topic: `dataprocessing.schema.updated`
- New ConfigMap key: `invalid-records-ttl-days: 4`
- InvalidRecordsService requires SignalR hub configuration
- Quartz.NET purge job runs daily at 03:00 UTC

---

## Migration from v0.3.0 to v0.4.0

### Backward Compatible

No breaking changes. Standard upgrade:

```bash
# Update image tags
kubectl set image deployment/datasource-management datasource-management=datasource-management:v0.4.0 -n ez-platform
kubectl set image deployment/frontend frontend=frontend:v0.4.0 -n ez-platform
# ... repeat for all services

# Or use Helm
helm upgrade ez-platform ./helm/ez-platform -f values-local.yaml --namespace ez-platform
```

### What's New

- Clone Datasource (frontend-only)
- Import from File (frontend + backend Archive API)
- Completeness Checklist (frontend-only)
- No database migration required
- Frontend image must be rebuilt (new components)

---

## ConfigMap Reference

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
  invalid-records-ttl-days: "4"  # v0.5.0
```

---

## Helm Deployment

For Helm-based deployment, see the [Helm Installation Guide](/docs/installation/helm-installation).

```bash
helm upgrade --install ez-platform ./helm/ez-platform \
  -f values-local.yaml \
  --namespace ez-platform \
  --create-namespace
```

---

## OCP Compatibility

All v0.4.0 images are OCP-compatible (since v0.1.1-rc2):
- Non-root containers (UID 1000)
- Non-privileged ports (>1024)
- `readOnlyRootFilesystem: true`
- `seccompProfile: RuntimeDefault`
- All capabilities dropped

---

## Verification

After deployment, verify:

```bash
# All pods running
kubectl get pods -n ez-platform

# Health checks
curl http://localhost:5001/health
curl http://localhost:5003/health

# Frontend accessible
curl http://localhost:7000

# v0.4.0 features
# - Clone button visible on datasource list
# - Import from File button visible on datasource list
# - Completeness checklist visible on create/edit forms
```

---

## Related Documentation

- [Installation Guide](/docs/installation) -- Detailed step-by-step installation
- [Helm Installation](/docs/installation/helm-installation) -- Helm chart deployment
- [Troubleshooting Guide](/docs/deployment/deployment-troubleshooting-guide) -- Common issues
- [Admin Guide](/docs/admin) -- System administration

---

**Deployment Guide Version:** 4.0
**Platform Version:** v0.4.0
**Last Updated:** March 2026

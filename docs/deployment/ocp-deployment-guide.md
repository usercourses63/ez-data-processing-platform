---
last-verified: 2026-02-03
status: current
---

# OCP Deployment Guide

This guide documents the deployment of EZ Platform v0.2.0 to OpenShift Container Platform (OCP) using Helm.

## Prerequisites

- OpenShift CLI (`oc`) installed and authenticated
- Helm 3.12+ installed
- Access to OCP cluster with project/namespace permissions
- For air-gapped deployments: Docker daemon access for image loading

## Chart Location

OCP-specific Helm chart: `release-package/helm/ez-platform-ocp/`

## Deployment Commands

### Standard Deployment (Connected Environment)

```bash
# Login to OCP cluster
oc login --server=https://api.cluster.example.com:6443

# Create namespace (if not exists)
oc new-project ez-platform

# Install EZ Platform
helm install prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --values values-prod.yaml \
  --timeout 15m \
  --wait \
  --history-max 3

# Verify deployment
helm list -n ez-platform
oc get pods -n ez-platform
```

### Upgrade Existing Deployment

```bash
# Upgrade with atomic rollback on failure
helm upgrade prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --values values-prod.yaml \
  --timeout 15m \
  --wait \
  --history-max 3 \
  --atomic
```

### Development Deployment

```bash
# Development deployment with reduced resources
helm install dev-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform-dev \
  --create-namespace \
  --values values.yaml \
  --values values-dev.yaml \
  --timeout 15m \
  --wait
```

### Uninstall Deployment

```bash
# Remove deployment (retains PVCs by default)
helm uninstall prod-ez-platform --namespace ez-platform

# Remove PVCs if needed
oc delete pvc --all -n ez-platform
```

## Air-Gapped Deployment

For disconnected/air-gapped OCP environments:

### 1. Export Images (On Connected Machine)

```powershell
# Export all images to tarballs
.\scripts\export-images.ps1 -Version v0.2.0 -OutputDir release-package/images

# Optional: Skip infrastructure images if using external services
.\scripts\export-images.ps1 -Version v0.2.0 -SkipInfrastructure
```

This exports:
- **Services (10):** datasource-management, fileprocessor, filediscovery, validation, scheduling, output, metrics-configuration, invalidrecords, frontend, docs
- **Infrastructure (12):** MongoDB, Kafka, Zookeeper, RabbitMQ, Hazelcast, Elasticsearch, Prometheus, Grafana, Jaeger, OTEL Collector, Fluent-Bit, Curl

### 2. Transfer to Air-Gapped Environment

Copy the `release-package/` directory to the air-gapped OCP node via approved media:
- USB drive
- Network file transfer via approved gateway
- Physical media

Directory structure:
```
release-package/
  helm/
    ez-platform-ocp/     # Helm chart
  images/
    services/            # Service tarballs
    infrastructure/      # Infrastructure tarballs
```

### 3. Load Images (On Air-Gapped OCP Node)

```bash
# Load service images
for img in release-package/images/services/*.tar; do
  docker load -i "$img"
done

# Load infrastructure images
for img in release-package/images/infrastructure/*.tar; do
  docker load -i "$img"
done
```

### 4. Tag and Push to Internal Registry

```bash
# Login to OCP internal registry
oc registry login

# Get internal registry URL
REGISTRY=$(oc get route default-route -n openshift-image-registry --template='{{ .spec.host }}')

# Tag and push each service image
for svc in datasource-management fileprocessor filediscovery validation \
           scheduling output metrics-configuration invalidrecords frontend; do
  docker tag ez-platform/$svc:v0.2.0 $REGISTRY/ez-platform/$svc:v0.2.0
  docker push $REGISTRY/ez-platform/$svc:v0.2.0
done

# Tag and push docs
docker tag ezplatform-docs:v0.2.0 $REGISTRY/ez-platform/docs:v0.2.0
docker push $REGISTRY/ez-platform/docs:v0.2.0
```

### 5. Create Air-Gap Values Override

Create `values-airgap.yaml`:

```yaml
# Air-gapped deployment - internal registry configuration
global:
  imageRegistry: image-registry.openshift-image-registry.svc:5000

services:
  datasourceManagement:
    image:
      repository: ez-platform/datasource-management
  fileprocessor:
    image:
      repository: ez-platform/fileprocessor
  filediscovery:
    image:
      repository: ez-platform/filediscovery
  validation:
    image:
      repository: ez-platform/validation
  scheduling:
    image:
      repository: ez-platform/scheduling
  output:
    image:
      repository: ez-platform/output
  metricsConfiguration:
    image:
      repository: ez-platform/metrics-configuration
  invalidrecords:
    image:
      repository: ez-platform/invalidrecords
  frontend:
    image:
      repository: ez-platform/frontend
  docs:
    image:
      repository: ez-platform/docs
```

### 6. Install with Internal Registry

```bash
helm install prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --values values-prod.yaml \
  --values values-airgap.yaml \
  --timeout 15m \
  --wait \
  --history-max 3
```

## Post-Deployment Validation

### Run Smoke Tests

```bash
# Execute Helm test hook
helm test prod-ez-platform \
  --namespace ez-platform \
  --timeout 5m \
  --logs
```

The smoke test verifies all 10 services are healthy:
- Backend services: datasource-management, metrics-configuration, validation, scheduling, invalidrecords, filediscovery, fileprocessor, output
- Frontend: frontend (port 8080)
- Documentation: ezplatform-docs (port 8080)

### Verify Services

```bash
# Check all pods are running
oc get pods -n ez-platform

# Check routes are created
oc get routes -n ez-platform

# Test frontend route
curl -sf https://$(oc get route frontend -n ez-platform -o jsonpath='{.spec.host}')/health

# Test docs route
curl -sf https://$(oc get route docs -n ez-platform -o jsonpath='{.spec.host}')/
```

### Verify Database Initialization

The db-init hook runs automatically before service deployment:

```bash
# Check db-init job completed
oc get jobs -n ez-platform | grep db-init

# View db-init logs
oc logs job/prod-ez-platform-db-init -n ez-platform
```

## Configuration

### Environment-Specific Values

| File | Environment | Use Case |
|------|-------------|----------|
| `values.yaml` | Base | Default configuration |
| `values-dev.yaml` | Development | Reduced replicas, debug logging |
| `values-prod.yaml` | Production | Full replicas, info logging |
| `values-airgap.yaml` | Air-gapped | Internal registry override |

### Key Configuration Options

```yaml
# OCP domain for routes (MUST update)
ocp:
  domain: apps.your-cluster.example.com
  routes:
    enabled: true
    tls:
      termination: edge

# Infrastructure toggles (disable for external services)
mongodb:
  enabled: true          # Set false if using external MongoDB
  external:
    enabled: false
    connectionString: "" # External MongoDB connection string

kafka:
  enabled: true          # Set false if using external Kafka
  external:
    enabled: false
    bootstrapServers: "" # External Kafka bootstrap servers

# Resource limits (adjust based on cluster capacity)
services:
  fileprocessor:
    replicas: 5          # Scale based on throughput needs
    resources:
      limits:
        memory: 8Gi
```

### Required Configuration Changes

Before deployment, update these values:

1. **OCP Domain:** Set `ocp.domain` to your cluster's app domain
2. **Storage Class:** Verify `storageClass` matches your cluster's available classes
3. **Resource Limits:** Adjust based on cluster capacity quotas
4. **External Services:** Configure `external.enabled` and connection strings if using managed services

## Rollback Procedures

### Automatic Rollback (with --atomic flag)

If deployment fails with `--atomic` flag, Helm automatically rolls back to the previous release.

### Manual Rollback

```bash
# View release history
helm history prod-ez-platform -n ez-platform

# Rollback to previous version
helm rollback prod-ez-platform -n ez-platform

# Rollback to specific revision
helm rollback prod-ez-platform 2 -n ez-platform
```

### Rollback Verification

```bash
# Verify rollback completed
helm status prod-ez-platform -n ez-platform

# Run smoke tests
helm test prod-ez-platform -n ez-platform --timeout 5m --logs
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod events
oc describe pod <pod-name> -n ez-platform

# Check security context constraints
oc get pods -n ez-platform -o yaml | grep -A5 securityContext

# Verify SCC assignment
oc get pods -n ez-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.openshift\.io/scc}{"\n"}{end}'
```

### Image Pull Errors

```bash
# Check image pull secrets
oc get secrets -n ez-platform | grep -i pull

# Verify image exists in registry
oc get imagestreams -n ez-platform

# Check image pull policy
oc get pods -n ez-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].imagePullPolicy}{"\n"}{end}'
```

### Route Not Accessible

```bash
# Check route status
oc describe route frontend -n ez-platform

# Verify TLS configuration
oc get route frontend -n ez-platform -o yaml | grep -A10 tls

# Test route directly
curl -kv https://$(oc get route frontend -n ez-platform -o jsonpath='{.spec.host}')/health
```

### Database Hook Failure

```bash
# Check db-init job status
oc describe job prod-ez-platform-db-init -n ez-platform

# View job logs
oc logs job/prod-ez-platform-db-init -n ez-platform

# Verify MongoDB is accessible
oc exec mongodb-0 -n ez-platform -- mongosh --eval "db.adminCommand('ping')"
```

### Service Health Check Failures

```bash
# Check service logs
oc logs -f deployment/datasource-management -n ez-platform --tail=100

# Check service endpoints
oc get endpoints -n ez-platform

# Verify network policy allows traffic
oc get networkpolicy -n ez-platform
```

## Security Considerations

### Pod Security Standards

All pods run with OCP restricted-v2 SCC:
- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `readOnlyRootFilesystem: true`
- `capabilities.drop: ["ALL"]`

### Network Policies

Default deny-all-ingress is enabled. Explicit allow rules permit:
- Frontend external access
- Inter-service communication
- Prometheus scraping
- OTEL collector telemetry

### Secrets Management

Secrets are managed via values file placeholders:
- Replace `ocp.domain` with actual cluster domain
- Configure external service credentials in values-prod.yaml
- Consider using OCP Secrets or external secret management for production

### Service Accounts

Each service runs with its own service account:
- Datasource Management has RBAC for PV/PVC operations (NAS device management)
- Other services use minimal permissions

## Monitoring and Observability

### Metrics Collection

```bash
# Verify Prometheus is scraping services
oc port-forward svc/prometheus 9090:9090 -n ez-platform
# Visit http://localhost:9090/targets
```

### Log Aggregation

```bash
# View logs in Elasticsearch
oc port-forward svc/elasticsearch 9200:9200 -n ez-platform
curl http://localhost:9200/_cat/indices
```

### Distributed Tracing

```bash
# Access Jaeger UI
oc port-forward svc/jaeger 16686:16686 -n ez-platform
# Visit http://localhost:16686
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.2.0 | 2026-02-03 | Initial v0.2.0 deployment automation |

## Related Documentation

- [Smoke Test Guide](smoke-test-guide.md) - Detailed smoke test documentation
- [Rollback Procedures](rollback-procedures.md) - Comprehensive rollback guide
- [Deployment Guide](DEPLOYMENT.md) - General deployment documentation

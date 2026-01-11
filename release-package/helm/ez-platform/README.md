# EZ Platform Helm Chart (OpenShift)

Production-ready Helm chart for deploying EZ Platform on OpenShift Container Platform with full OCP compliance.

## Features

- **10 Microservices**: 8 backend APIs (FileDiscovery, FileProcessor, Validation, Output, DataSource Management, Metrics Configuration, Invalid Records, Scheduling) + React frontend + Docusaurus documentation
- **Infrastructure**: MongoDB (StatefulSet), Apache Kafka (StatefulSet), Hazelcast distributed cache (StatefulSet), RabbitMQ message broker
- **Observability Stack**:
  - Dual Prometheus instances (system + business metrics)
  - Grafana dashboards
  - Jaeger distributed tracing
  - Elasticsearch log aggregation
  - OpenTelemetry Collector
- **Zero-Trust Networking**: 12 NetworkPolicies for pod-to-pod security
- **OpenShift Routes**: 4 Routes with TLS edge termination for external access
- **OCP Security Hardening**: All resources run as non-root (UID 1000), non-privileged ports only
- **Full OCP Compliance**: restricted-v2 SCC compatible, SecurityContext at pod + container level

## Version Information

- **Chart Version**: 1.1.0
- **App Version**: v0.1.1-rc2
- **OpenShift Version**: 4.12+
- **Helm Version**: 3.12+

## Prerequisites

- OpenShift Container Platform 4.12+ cluster
- Helm 3.12+ (`oc` CLI or Helm)
- cluster-admin permissions (for initial setup)
- Persistent storage provisioner (for MongoDB, Kafka, Hazelcast)
- 32GB+ RAM available in cluster
- 8+ CPU cores available

## Installation

### Quick Start

Deploy with your OpenShift domain:

```bash
helm install ez-platform ./release-package/helm/ez-platform-ocp \
  -n ez-platform --create-namespace \
  --set ocp.domain=apps.openshift-cluster.example.com
```

**Note**: Replace `apps.openshift-cluster.example.com` with your actual OpenShift cluster's apps domain.

### Custom Values

Deploy with custom configuration:

```bash
helm install ez-platform ./release-package/helm/ez-platform-ocp \
  -n ez-platform --create-namespace \
  --set ocp.domain=apps.prod.example.com \
  --set services.docs.enabled=false \
  --set mongodb.storage=50Gi
```

### Custom Values File

Create a `custom-values.yaml` file:

```yaml
global:
  namespace: ez-platform-prod

ingress:
  enabled: true
  host: ez-platform.example.com
  className: nginx
  tls:
    enabled: true
    secretName: ez-platform-tls-cert

mongodb:
  replicas: 3
  storage: 50Gi
  storageClass: fast-ssd

kafka:
  replicas: 3
  storage: 20Gi

services:
  fileprocessor:
    replicas: 10
  validation:
    replicas: 5
```

Deploy with custom values:

```bash
helm install ez-platform ./helm/ez-platform \
  -n ez-platform --create-namespace \
  -f custom-values.yaml
```

## Configuration

### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.namespace` | Kubernetes namespace | `ez-platform` |
| `global.imageRegistry` | Docker image registry | `docker.io` |
| `global.imagePullPolicy` | Image pull policy | `IfNotPresent` |

### Microservices

All microservices support these common parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `services.<service>.enabled` | Enable/disable service | `true` |
| `services.<service>.replicas` | Number of replicas | Varies |
| `services.<service>.image.repository` | Image repository | `ez-platform/<service>` |
| `services.<service>.image.tag` | Image tag | `v0.1.1-rc2` |
| `services.<service>.resources` | CPU/memory limits | Varies |

Example services:
- `services.fileprocessor` - File processing service (5 replicas)
- `services.validation` - Schema validation service (3 replicas)
- `services.output` - Multi-destination output (3 replicas)
- `services.datasourceManagement` - Primary API (2 replicas)
- `services.docs` - Docusaurus documentation (1 replica)

### Infrastructure

#### MongoDB

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mongodb.enabled` | Enable MongoDB StatefulSet | `true` |
| `mongodb.replicas` | Number of replicas | `3` |
| `mongodb.storage` | PVC size | `20Gi` |
| `mongodb.storageClass` | Storage class | `standard` |

#### Kafka

| Parameter | Description | Default |
|-----------|-------------|---------|
| `kafka.enabled` | Enable Kafka StatefulSet | `true` |
| `kafka.replicas` | Number of brokers | `3` |
| `kafka.storage` | PVC size per broker | `10Gi` |
| `kafka.storageClass` | Storage class | `standard` |

#### Hazelcast

| Parameter | Description | Default |
|-----------|-------------|---------|
| `hazelcast.enabled` | Enable Hazelcast distributed cache | `true` |
| `hazelcast.replicas` | Number of members | `3` |
| `hazelcast.storage` | PVC size | `5Gi` |

#### RabbitMQ

| Parameter | Description | Default |
|-----------|-------------|---------|
| `rabbitmq.enabled` | Enable RabbitMQ | `true` |
| `rabbitmq.replicas` | Number of replicas | `1` |
| `rabbitmq.auth.username` | Username | `guest` |
| `rabbitmq.auth.password` | Password | `guest` |

### Network Policies

| Parameter | Description | Default |
|-----------|-------------|---------|
| `networkPolicies.enabled` | Enable all NetworkPolicies | `true` |
| `networkPolicies.defaultDenyIngress` | Default deny-all ingress | `true` |
| `networkPolicies.frontend.allowExternal` | Allow external access to frontend | `true` |
| `networkPolicies.infrastructure.allowMongoDBAccess` | Allow backend → MongoDB | `true` |
| `networkPolicies.observability.allowOTELAccess` | Allow all → OTEL | `true` |

### OpenShift Routes

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ocp.enabled` | Enable OCP-specific features | `true` |
| `ocp.domain` | OpenShift cluster apps domain | `apps.example.com` |
| `ocp.routes.enabled` | Enable Route resources | `true` |
| `ocp.routes.tls.termination` | TLS termination type | `edge` |

### Security Context

All pods run with OCP-compatible SecurityContext:

```yaml
securityContext:
  pod:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  container:
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
```

### Observability Stack

The observability stack is fully templated and supports environment-specific customization.

**Components**:
- **Dual Prometheus**: System metrics (infrastructure) + Business metrics (KPIs)
- **Grafana**: Unified dashboards with 3 datasources (2 Prometheus + Elasticsearch)
- **Elasticsearch**: Centralized log storage
- **Jaeger**: Distributed tracing with Elasticsearch backend
- **OTEL Collector**: Central telemetry aggregation (4 pipelines)
- **Fluent-Bit**: DaemonSet for container log collection

**Quick Start**:
```bash
# Install with default observability settings
helm install ez-platform ./ez-platform-ocp -n ez-platform --create-namespace

# Access Grafana
oc get route grafana -n ez-platform
# Or port-forward: oc port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform

# Get Grafana password
oc get secret grafana-credentials -n ez-platform -o jsonpath='{.data.admin-password}' | base64 -d
```

**Environment-Specific Deployments**:

```bash
# Development (reduced resources, relaxed alerts)
helm install ez-platform ./ez-platform-ocp \
  -f values.yaml \
  -f values-dev.yaml \
  -n ez-platform --create-namespace

# Production (HA, strict alerts, large storage)
helm install ez-platform ./ez-platform-ocp \
  -f values.yaml \
  -f values-production.yaml \
  -n ez-platform --create-namespace
```

**Configuration**:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `observability.prometheusSystem.enabled` | `true` | Enable system metrics |
| `observability.prometheusBusiness.enabled` | `true` | Enable business metrics |
| `observability.grafana.enabled` | `true` | Enable Grafana dashboards |
| `observability.elasticsearch.enabled` | `true` | Enable log storage |
| `observability.jaeger.enabled` | `true` | Enable distributed tracing |
| `observability.otelCollector.enabled` | `true` | Enable OTEL Collector |
| `observability.fluentBit.enabled` | `true` | Enable log collection |

**Alert Configuration**:

```yaml
# Customize alert thresholds
observability:
  alerts:
    processingPipeline:
      rabbitmqQueueBacklog:
        threshold: 100      # Queue depth warning
        duration: 5m
      processingLagHigh:
        p99Threshold: 60    # P99 latency in seconds
    infrastructure:
      hazelcastMemoryHigh:
        threshold: 0.85     # 85% memory usage
```

**Documentation**:
- [Complete Observability Guide](docs/OBSERVABILITY.md)
- [Upgrade Instructions](docs/UPGRADE.md)

## Post-Installation

### Verify Deployment

Check all pods are running:

```bash
kubectl get pods -n ez-platform
```

Expected output: ~50-55 pods in Running state.

### Access Services via Routes

Get Route URLs:

```bash
oc get routes -n ez-platform
```

Access services (all with HTTPS/TLS):
- Frontend: `https://frontend.<your-ocp-domain>/`
- Documentation: `https://docs.<your-ocp-domain>/`
- API: `https://api.<your-ocp-domain>/`
- Grafana: `https://grafana.<your-ocp-domain>/`

Example with domain `apps.prod.example.com`:
- Frontend: https://frontend.apps.prod.example.com/
- Docs: https://docs.apps.prod.example.com/
- API: https://api.apps.prod.example.com/
- Grafana: https://grafana.apps.prod.example.com/

### Port Forwarding (Development/Testing)

For local development or testing:

```bash
# Frontend
oc port-forward svc/frontend 3000:8080 -n ez-platform

# API
oc port-forward svc/datasource-management 5001:5001 -n ez-platform

# Grafana
oc port-forward svc/grafana 3001:3000 -n ez-platform
```

## Upgrading

### Upgrade to New Version

```bash
helm upgrade ez-platform ./helm/ez-platform \
  -n ez-platform \
  -f custom-values.yaml
```

### Rollback

```bash
helm rollback ez-platform -n ez-platform
```

## Uninstallation

```bash
helm uninstall ez-platform -n ez-platform
```

**Warning**: This does NOT delete PersistentVolumeClaims. To delete them:

```bash
kubectl delete pvc -n ez-platform --all
```

## Troubleshooting

### Pods Not Starting

Check pod events:

```bash
kubectl describe pod <pod-name> -n ez-platform
```

Common issues:
- Insufficient resources: Check node capacity
- Image pull errors: Verify image repository access
- PVC binding: Check storage class exists

### MongoDB Replica Set Not Initializing

Check MongoDB logs:

```bash
kubectl logs mongodb-0 -n ez-platform
```

Manually initialize (if needed):

```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongosh
```

### Kafka Connection Issues

Verify Kafka brokers are running:

```bash
kubectl get pods -l app=kafka -n ez-platform
```

Check Kafka logs:

```bash
kubectl logs kafka-0 -n ez-platform
```

### NetworkPolicy Blocking Traffic

Temporarily disable NetworkPolicies:

```bash
helm upgrade ez-platform ./helm/ez-platform \
  -n ez-platform \
  --set networkPolicies.enabled=false
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  OpenShift Routes (TLS Edge)                 │
│  frontend → :8080  |  docs → :8080  |  api → :5001  |  grafana → :3000
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Microservices Layer                      │
│  FileDiscovery | FileProcessor | Validation | Output         │
│  DataSource Mgmt | Metrics Config | Invalid Records | Scheduling
│  (All running as non-root UID 1000, non-privileged ports)   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  MongoDB (StatefulSet) | Kafka (StatefulSet) | Hazelcast    │
│  RabbitMQ              | Zookeeper                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Observability Layer                        │
│  Prometheus (System) | Prometheus (Business) | Grafana       │
│  Elasticsearch       | Jaeger                | OTEL Collector│
└─────────────────────────────────────────────────────────────┘
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/usercourses63/ez-data-processing-platform/issues
- Email: team@ezplatform.com

## License

Proprietary - All Rights Reserved

---

**Maintainers**: EZ Platform Team
**Last Updated**: 2026-01-11
**Chart Version**: 1.1.0
**App Version**: v0.1.1-rc2

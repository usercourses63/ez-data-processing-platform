# EZ Platform Helm Chart (Vanilla Kubernetes)

Complete Helm chart for deploying EZ Platform on vanilla Kubernetes clusters.

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
- **Ingress**: NGINX Ingress Controller for external access
- **OCP Compatibility**: All resources include SecurityContext (pod + container level)

## Version Information

- **Chart Version**: 1.1.0
- **App Version**: v0.1.1-rc2
- **Kubernetes Version**: 1.28+
- **Helm Version**: 3.12+

## Prerequisites

- Kubernetes 1.28+ cluster
- Helm 3.12+
- Persistent storage provisioner (for MongoDB, Kafka, Hazelcast)
- NGINX Ingress Controller (or compatible ingress controller)
- 32GB+ RAM available in cluster
- 8+ CPU cores available

## Installation

### Quick Start

Deploy with default values:

```bash
helm install ez-platform ./helm/ez-platform \
  -n ez-platform --create-namespace
```

### Custom Values

Deploy with custom configuration:

```bash
helm install ez-platform ./helm/ez-platform \
  -n ez-platform --create-namespace \
  --set ingress.host=myapp.example.com \
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

### Ingress

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable Ingress resource | `true` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.host` | Hostname | `ez-platform.local` |
| `ingress.tls.enabled` | Enable TLS | `false` |
| `ingress.tls.secretName` | TLS secret name | `ez-platform-tls` |

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

## Post-Installation

### Verify Deployment

Check all pods are running:

```bash
kubectl get pods -n ez-platform
```

Expected output: ~50-55 pods in Running state.

### Access Services

Get Ingress address:

```bash
kubectl get ingress -n ez-platform
```

Access services:
- Frontend: `http://<ingress-host>/`
- Documentation: `http://<ingress-host>/docs`
- API: `http://<ingress-host>/api`
- Grafana: `http://<ingress-host>/grafana`

### Port Forwarding (Development)

For local development without Ingress:

```bash
# Frontend
kubectl port-forward svc/frontend 3000:80 -n ez-platform

# API
kubectl port-forward svc/datasource-management 5001:5001 -n ez-platform

# Grafana
kubectl port-forward svc/grafana 3001:3000 -n ez-platform
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
│                        Ingress (NGINX)                       │
│  / → frontend:80  |  /docs → docs:80  |  /api → datasource:5001
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Microservices Layer                      │
│  FileDiscovery | FileProcessor | Validation | Output         │
│  DataSource Mgmt | Metrics Config | Invalid Records | Scheduling
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

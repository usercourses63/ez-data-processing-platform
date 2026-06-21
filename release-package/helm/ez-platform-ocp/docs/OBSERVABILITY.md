# EZ Platform Observability Stack

## Overview

EZ Platform includes a comprehensive observability stack with dual-tier monitoring, distributed tracing, centralized logging, and configurable alerting. All components are fully templated and support environment-specific customization.

**Components (7 total)**:
- **Prometheus System** - Infrastructure and system metrics
- **Prometheus Business** - Application KPIs and business metrics
- **Grafana** - Unified visualization and dashboards
- **Elasticsearch** - Log storage and search
- **Jaeger** - Distributed tracing with Elasticsearch backend
- **OpenTelemetry Collector** - Central telemetry aggregation
- **Fluent-Bit** - Container log collection DaemonSet

---

## Quick Start

### Standard Deployment
```bash
# Install with default settings
helm install ez-platform ./ez-platform-ocp -n ez-platform --create-namespace

# Access dashboards
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform
# Open http://localhost:3000 (admin / check secret for password)
```

### Base Deployment
```bash
# Install with base values only
helm install ez-platform ./ez-platform-ocp \
  -f values.yaml \
  -n ez-platform --create-namespace
```

### Production Deployment
```bash
# Install with HA and strict alerts (Helm auto-loads base values.yaml first)
helm install ez-platform ./ez-platform-ocp \
  -f values-production.yaml \
  -n ez-platform --create-namespace
```

---

## Architecture

### Telemetry Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION SERVICES                          │
│  (FileProcessor, Validation, Output, Scheduling, etc.)          │
│                                                                  │
│  Serilog → OTEL Collector (gRPC 4317 / HTTP 4318)              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    OTEL COLLECTOR                                │
│  Central aggregation and routing with 4 pipelines:              │
│                                                                  │
│  1. System Metrics  → Prometheus System → Grafana               │
│  2. Business Metrics→ Prometheus Business → Grafana             │
│  3. Logs           → Elasticsearch → Grafana                    │
│  4. Traces         → Jaeger + Elasticsearch                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VISUALIZATION LAYER                           │
│                                                                  │
│  Grafana (3 datasources):                                       │
│  - System-Prometheus    (infrastructure metrics)                │
│  - Business-Prometheus  (KPIs, SLAs)                            │
│  - Elasticsearch-Logs   (application logs)                      │
│                                                                  │
│  Jaeger UI: Distributed trace visualization                     │
└─────────────────────────────────────────────────────────────────┘
```

### Container Log Collection

```
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE CONTAINERS                     │
│  (MongoDB, Kafka, Elasticsearch, Hazelcast, etc.)              │
│                                                                  │
│  Container Logs → Fluent-Bit DaemonSet → Elasticsearch         │
│                   (Kubernetes metadata enrichment)              │
│                   Index: ez-logs-YYYY.MM.DD                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Default Settings

The base `values.yaml` provides production-ready defaults:

```yaml
observability:
  prometheusSystem:
    enabled: true
    replicas: 1
    storage:
      size: 50Gi
    config:
      scrapeInterval: 15s
      retentionTime: 15d
```

### Resource Sizing

#### Small (Base / Testing)
- **Use**: base values.yaml (no overlay)
- **Specs**: 512Mi-2Gi RAM, 100m-500m CPU per component
- **Storage**: 10-50Gi
- **Retention**: 15 days
- **Best For**: Local development, CI/CD testing

```bash
helm install ez-platform ./ez-platform-ocp -f values.yaml
```

#### Medium (Staging / Small Production)
- **Use**: Default values.yaml
- **Specs**: 2-4Gi RAM, 500m-2 CPU per component
- **Storage**: 50-100Gi
- **Retention**: 15 days
- **Best For**: Staging environments, small production workloads

```bash
helm install ez-platform ./ez-platform-ocp
```

#### Large (Production)
- **Use**: values-production.yaml
- **Specs**: 4-16Gi RAM, 1-4 CPU per component
- **Storage**: 200-500Gi with fast-ssd
- **Retention**: 30 days
- **Replicas**: 2-3 for HA
- **Best For**: Production workloads with high throughput

```bash
helm install ez-platform ./ez-platform-ocp -f values.yaml -f values-production.yaml
```

---

## Security Configuration

### Grafana Credentials

**Development (Default)**:
```yaml
observability:
  grafana:
    auth:
      adminUser: admin
      adminPassword: ""  # Auto-generates random 32-char password
```

Retrieve password:
```bash
kubectl get secret grafana-credentials -n ez-platform \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

**Production (External Secret Management)**:
```yaml
observability:
  grafana:
    auth:
      adminUser: admin
      existingSecret: "grafana-vault-secret"  # From HashiCorp Vault, etc.
      existingSecretKey: "admin-password"
```

### Elasticsearch Security

**Development (Default)**:
```yaml
observability:
  elasticsearch:
    security:
      enabled: false  # No authentication
```

**Production (Security Enabled)**:
```yaml
observability:
  elasticsearch:
    security:
      enabled: true
      existingSecret: "elasticsearch-vault-secret"
      username: elastic
```

Create secret:
```bash
kubectl create secret generic elasticsearch-vault-secret \
  --from-literal=elastic-password='your-strong-password' \
  -n ez-platform
```

---

## Alert Configuration

### Alert Groups

**1. Processing Pipeline Alerts**:
- `RabbitMQQueueBacklog` - Queue depth > threshold
- `RabbitMQQueueCritical` - Critical queue depth
- `ProcessingLagHigh` - P99 latency exceeds SLA
- `ProcessingStalled` - No files processed in duration

**2. Infrastructure Alerts**:
- `HazelcastMemoryHigh` - Cache memory > 85%
- `PodNotReady` - Service pod not ready
- `FileProcessorScaledDown` - Below minimum replicas

**3. Validation Alerts**:
- `HighInvalidRecordRate` - Invalid records > 10%

### Customizing Alerts

**Relaxed Thresholds (custom overlay)**:
```yaml
# custom relaxed-thresholds overlay (e.g. values-relaxed.yaml)
observability:
  alerts:
    processingPipeline:
      rabbitmqQueueBacklog:
        threshold: 50       # Lower threshold for testing
        duration: 10m       # Longer duration to reduce noise
      processingLagHigh:
        p99Threshold: 120   # More lenient (2 minutes)
        duration: 10m
    infrastructure:
      hazelcastMemoryHigh:
        threshold: 0.90     # 90% (more tolerant)
```

**Production (Strict Thresholds)**:
```yaml
# values-production.yaml
observability:
  alerts:
    processingPipeline:
      rabbitmqQueueBacklog:
        threshold: 100
        duration: 2m        # Alert faster
      processingLagHigh:
        p99Threshold: 30    # Strict SLA (30 seconds)
        duration: 2m
        severity: critical
    infrastructure:
      hazelcastMemoryHigh:
        threshold: 0.80     # Alert earlier (80%)
        duration: 2m
```

### Alert Severity Levels
- **warning** - Requires attention, not urgent
- **critical** - Requires immediate action

---

## Access URLs

After deploying and port-forwarding:

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Grafana | http://localhost:3000 | admin / (from secret) |
| Prometheus System | http://localhost:9090 | No auth |
| Prometheus Business | http://localhost:9091 | No auth |
| Elasticsearch | http://localhost:9200 | No auth (dev) / elastic/(from secret) (prod) |
| Jaeger UI | http://localhost:16686 | No auth |
| OTEL Collector | gRPC: 4317, HTTP: 4318 | No auth |

**Port Forward Command**:
```bash
# All services at once
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform &
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform &
kubectl port-forward svc/prometheus-business 9091:9091 -n ez-platform &
kubectl port-forward svc/elasticsearch 9200:9200 -n ez-platform &
kubectl port-forward svc/jaeger 16686:16686 -n ez-platform &
kubectl port-forward svc/otel-collector 4317:4317 4318:4318 -n ez-platform &
```

---

## Grafana Dashboards

### Pre-configured Datasources

1. **System-Prometheus** (http://prometheus-system:9090)
   - Infrastructure metrics
   - Kubernetes metrics
   - RabbitMQ, MongoDB, Kafka metrics
   - Default: No

2. **Business-Prometheus** (http://prometheus-business:9091)
   - Application KPIs
   - Processing metrics
   - Validation metrics
   - Default: Yes

3. **Elasticsearch-Logs** (http://elasticsearch:9200)
   - Application logs
   - Index: dataprocessing-logs-*
   - Trace correlation

### Dashboard Organization

**System Dashboards**:
- Kubernetes Cluster Overview
- Pod Resource Usage
- Infrastructure Components (Kafka, MongoDB, RabbitMQ)

**Business Dashboards** (pre-configured):
- Business Metrics Dashboard (business-metrics.json)
- Infrastructure Metrics Dashboard (infrastructure-metrics.json)

---

## Retention Policies

### Metrics Retention

**Prometheus System**:
```yaml
observability:
  prometheusSystem:
    config:
      retentionTime: 15d    # Default
      retentionSize: ""     # Optional size-based limit (e.g., "50GB")
```

**Prometheus Business**:
```yaml
observability:
  prometheusBusiness:
    config:
      retentionTime: 15d    # Default
```

**Recommendations**:
- Development: 7 days
- Staging: 15 days
- Production: 30 days

### Log Retention

**Elasticsearch**:
- Managed via Elasticsearch ILM (Index Lifecycle Management)
- Not directly configurable in Helm chart
- Configure post-deployment via Elasticsearch API

### Trace Retention

**Jaeger (Elasticsearch backend)**:
- Stored in Elasticsearch
- Same retention policy as Elasticsearch indices
- Index prefix: `jaeger-*`

---

## Troubleshooting

### Component Not Starting

**Check pod events**:
```bash
kubectl get events -n ez-platform --sort-by='.lastTimestamp' | grep <component>
```

**Check logs**:
```bash
kubectl logs -f deployment/<component> -n ez-platform
```

**Common Issues**:

1. **PVC Pending** - Storage class not available
```bash
kubectl get pvc -n ez-platform
kubectl describe pvc <pvc-name> -n ez-platform
```

Solution: Verify storageClass exists or change to available class:
```yaml
observability:
  prometheusSystem:
    storage:
      storageClass: standard  # Change to available class
```

2. **OOMKilled** - Insufficient memory
```bash
kubectl get pods -n ez-platform | grep OOMKilled
```

Solution: Increase memory limits:
```yaml
observability:
  prometheusSystem:
    resources:
      limits:
        memory: 4Gi  # Increase from default 2Gi
```

3. **CrashLoopBackOff** - Configuration error
```bash
kubectl logs deployment/<component> -n ez-platform --previous
```

Solution: Check ConfigMap and correct errors:
```bash
kubectl get configmap <component>-config -n ez-platform -o yaml
```

### Metrics Not Appearing

**Check OTEL Collector**:
```bash
# Check collector logs
kubectl logs deployment/otel-collector -n ez-platform | grep -i error

# Check collector health
kubectl port-forward svc/otel-collector 13133:13133 -n ez-platform
curl http://localhost:13133
```

**Check service annotations**:
```bash
kubectl get pods -n ez-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.prometheus\.io/scrape}{"\n"}{end}'
```

Services must have:
```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
```

### Grafana Can't Access Datasources

**Check datasource configuration**:
```bash
kubectl get configmap grafana-datasources-config -n ez-platform -o yaml
```

**Verify service endpoints**:
```bash
kubectl get svc -n ez-platform | grep -E "(prometheus|elasticsearch)"
```

**Test connectivity from Grafana pod**:
```bash
kubectl exec -it deployment/ezplatform-grafana -n ez-platform -- \
  wget -O- http://prometheus-system:9090/-/healthy
```

### High Memory Usage

**Check Prometheus cardinality**:
```bash
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform
# Open http://localhost:9090/tsdb-status
```

**Reduce cardinality**:
- Increase scrapeInterval (15s → 30s)
- Limit high-cardinality labels
- Adjust retention (30d → 15d)

---

## Performance Tuning

### Prometheus Optimization

**Reduce scraping frequency**:
```yaml
observability:
  prometheusSystem:
    config:
      scrapeInterval: 30s  # Default: 15s
      evaluationInterval: 30s
```

**Adjust batch sizes (OTEL Collector)**:
```yaml
observability:
  otelCollector:
    processors:
      batch:
        timeout: 10s
        sendBatchSize: 2048  # Increase for higher throughput
        sendBatchMaxSize: 4096
```

### Elasticsearch Optimization

**Java heap sizing** (should be 50% of container memory):
```yaml
observability:
  elasticsearch:
    resources:
      limits:
        memory: 8Gi  # Total memory
    config:
      javaOpts: "-Xms4g -Xmx4g"  # 50% of 8Gi
```

### Fluent-Bit Optimization

**Buffer sizing**:
```yaml
observability:
  fluentBit:
    config:
      memBufLimit: 100MB   # Increase for high log volume
      bufferSize: 1MB      # Increase for better batching
      flush: 3             # Decrease for faster delivery (5 → 3)
```

---

## Migration from Previous Versions

See [UPGRADE.md](UPGRADE.md) for detailed upgrade instructions.

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Jaeger Tracing](https://www.jaegertracing.io/docs/)
- [Fluent Bit](https://docs.fluentbit.io/)

---

**Document Version**: 1.0.0
**Last Updated**: January 2026
**Helm Chart Version**: 0.1.1-rc2+

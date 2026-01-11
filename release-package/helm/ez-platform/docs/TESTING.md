# EZ Platform Observability Stack - Testing Guide

## Overview

This document provides comprehensive testing procedures for validating the observability stack deployment.

---

## Pre-Deployment Validation

### 1. Helm Chart Validation

**Lint Chart**:
```bash
cd release-package/helm/ez-platform-ocp
helm lint .

# Expected output:
# ==> Linting .
# [INFO] Chart.yaml: icon is recommended
# 1 chart(s) linted, 0 chart(s) failed
```

**Template Generation** (verify no errors):
```bash
# Default values
helm template ez-platform . -f values.yaml > /tmp/default-manifests.yaml
echo "Default template: $(grep -c '^---' /tmp/default-manifests.yaml) resources"

# Development values
helm template ez-platform . -f values.yaml -f values-dev.yaml > /tmp/dev-manifests.yaml
echo "Dev template: $(grep -c '^---' /tmp/dev-manifests.yaml) resources"

# Production values
helm template ez-platform . -f values.yaml -f values-production.yaml > /tmp/prod-manifests.yaml
echo "Prod template: $(grep -c '^---' /tmp/prod-manifests.yaml) resources"
```

**Dry-Run Installation**:
```bash
# Verify installation would succeed (no cluster access required)
helm install ez-platform . \
  -f values.yaml \
  --dry-run \
  --debug \
  -n ez-platform > /tmp/dry-run.log 2>&1

# Check for errors
grep -i "error" /tmp/dry-run.log
# Expected: No errors
```

---

## Deployment Testing

### 2. Fresh Install Test

**Objective**: Verify clean installation with default settings.

**Prerequisites**:
- Kubernetes/OpenShift cluster available
- Sufficient resources (32GB RAM, 8 CPU)
- Storage provisioner configured

**Procedure**:

```bash
# Step 1: Install with default values
helm install ez-platform ./ez-platform-ocp \
  -n ez-platform --create-namespace

# Step 2: Wait for all pods
kubectl wait --for=condition=ready pod --all -n ez-platform --timeout=600s

# Step 3: Verify pod count
POD_COUNT=$(kubectl get pods -n ez-platform --no-headers | wc -l)
echo "Total pods: $POD_COUNT (Expected: ~50-55)"

# Step 4: Check pod status
kubectl get pods -n ez-platform | grep -v "Running\|Completed"
# Expected: No output (all pods Running or Completed)
```

**Expected Results**:
- ✅ All pods reach Running/Completed status within 10 minutes
- ✅ No CrashLoopBackOff or Error states
- ✅ PVCs bound successfully
- ✅ Services created with ClusterIP
- ✅ Grafana secret auto-generated

**Verification Commands**:
```bash
# Check observability components
kubectl get pods -n ez-platform | grep -E "(prometheus|grafana|elasticsearch|jaeger|otel|fluent)"

# Check PVCs
kubectl get pvc -n ez-platform

# Check secrets
kubectl get secret grafana-credentials -n ez-platform
```

### 3. Development Install Test

**Objective**: Verify installation with reduced resources.

**Procedure**:
```bash
# Install with dev values
helm install ez-platform-dev ./ez-platform-ocp \
  -f values.yaml \
  -f values-dev.yaml \
  -n ez-platform-dev --create-namespace

# Verify resource requests are reduced
kubectl get deployment prometheus-system -n ez-platform-dev -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}'
# Expected: 512Mi (not 2Gi)

# Verify alert thresholds are relaxed
kubectl get configmap prometheus-alerts -n ez-platform-dev -o yaml | grep "threshold"
# Expected: Lower thresholds (e.g., 50 instead of 100)
```

**Expected Results**:
- ✅ Pods start with reduced memory limits
- ✅ Single replicas for all components
- ✅ Smaller PVC sizes (10Gi instead of 50Gi)
- ✅ Relaxed alert thresholds

### 4. Production Install Test

**Objective**: Verify HA deployment with strict alerts.

**Procedure**:
```bash
# Install with production values
helm install ez-platform-prod ./ez-platform-ocp \
  -f values.yaml \
  -f values-production.yaml \
  -n ez-platform-prod --create-namespace

# Verify HA replicas
kubectl get deployment prometheus-system -n ez-platform-prod -o jsonpath='{.spec.replicas}'
# Expected: 2

kubectl get deployment prometheus-business -n ez-platform-prod -o jsonpath='{.spec.replicas}'
# Expected: 2

kubectl get deployment ezplatform-grafana -n ez-platform-prod -o jsonpath='{.spec.replicas}'
# Expected: 2

# Verify strict alert thresholds
kubectl get configmap prometheus-alerts -n ez-platform-prod -o yaml | grep "p99Threshold"
# Expected: 30 (not 60)
```

**Expected Results**:
- ✅ Multiple replicas for all components (2-3)
- ✅ Larger resource limits (4-8Gi RAM)
- ✅ Larger PVC sizes (200-500Gi)
- ✅ Strict alert thresholds

---

## Functional Testing

### 5. Grafana Access Test

**Objective**: Verify Grafana UI accessible and datasources working.

**Procedure**:
```bash
# Get Grafana password
GRAFANA_PASSWORD=$(kubectl get secret grafana-credentials -n ez-platform \
  -o jsonpath='{.data.admin-password}' | base64 -d)
echo "Grafana Password: $GRAFANA_PASSWORD"

# Port forward to Grafana
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform &

# Wait for port forward
sleep 5

# Test Grafana health endpoint
curl -s http://localhost:3000/api/health | jq
# Expected: {"commit":"...", "database":"ok", "version":"..."}

# Login to Grafana (browser)
# Open http://localhost:3000
# Username: admin
# Password: <from GRAFANA_PASSWORD>
```

**Manual Verification**:
- ✅ Grafana UI loads successfully
- ✅ Login with admin credentials works
- ✅ Dashboard homepage displays
- ✅ No errors in browser console

**Datasource Verification**:
```bash
# Test datasources
curl -u admin:$GRAFANA_PASSWORD http://localhost:3000/api/datasources | jq

# Expected 3 datasources:
# - System-Prometheus
# - Business-Prometheus (default)
# - Elasticsearch-Logs
```

**In Grafana UI**:
1. Navigate to Configuration → Data Sources
2. Click each datasource
3. Click "Test" button
4. Expected: "Data source is working" for all 3

### 6. Prometheus Metrics Test

**Objective**: Verify Prometheus collecting metrics.

**Procedure**:
```bash
# Port forward to Prometheus System
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform &

# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# Expected: >0 (at least some targets)

# Query for Kubernetes metrics
curl -s 'http://localhost:9090/api/v1/query?query=up' | jq '.data.result | length'
# Expected: >0 (some services up)

# Check RabbitMQ metrics
curl -s 'http://localhost:9090/api/v1/query?query=rabbitmq_queue_messages' | jq
# Expected: Metric present (even if value is 0)
```

**Manual Verification** (browser):
1. Open http://localhost:9090
2. Go to Status → Targets
3. Expected: Targets showing as "UP"
4. Go to Graph
5. Query: `business_files_processed_total`
6. Expected: Metric visible (may be 0 if no files processed)

### 7. Elasticsearch Logs Test

**Objective**: Verify logs flowing to Elasticsearch.

**Procedure**:
```bash
# Port forward to Elasticsearch
kubectl port-forward svc/elasticsearch 9200:9200 -n ez-platform &

# Check Elasticsearch health
curl -s http://localhost:9200/_cluster/health | jq
# Expected: "status": "green" or "yellow"

# List indices
curl -s http://localhost:9200/_cat/indices?v

# Expected indices:
# - dataprocessing-logs-YYYY.MM.DD
# - ez-logs-YYYY.MM.DD
# - jaeger-span-*

# Query logs
curl -s 'http://localhost:9200/dataprocessing-logs-*/_search?size=5&sort=@timestamp:desc' | jq '.hits.total.value'
# Expected: >0 (some logs present)
```

### 8. Jaeger Traces Test

**Objective**: Verify distributed tracing working.

**Procedure**:
```bash
# Port forward to Jaeger
kubectl port-forward svc/jaeger 16686:16686 -n ez-platform &

# Check Jaeger health
curl -s http://localhost:16686/api/services | jq
# Expected: List of services (fileprocessor, validation, output, etc.)

# Query traces
curl -s 'http://localhost:16686/api/traces?service=fileprocessor&limit=10' | jq '.data | length'
# Expected: >=0 (traces present if files were processed)
```

**Manual Verification** (browser):
1. Open http://localhost:16686
2. Select service: fileprocessor
3. Click "Find Traces"
4. Expected: Traces displayed (if files processed)
5. Click on a trace
6. Expected: Span details with timing information

### 9. OTEL Collector Test

**Objective**: Verify OTEL Collector receiving and forwarding telemetry.

**Procedure**:
```bash
# Check OTEL Collector logs
kubectl logs deployment/otel-collector -n ez-platform | tail -20

# Check health endpoint
kubectl port-forward svc/otel-collector 13133:13133 -n ez-platform &
curl -s http://localhost:13133

# Expected: No errors, health check passes

# Verify pipelines configured
kubectl get configmap otel-collector-config -n ez-platform -o yaml | grep "pipelines:" -A 20

# Expected sections:
# - metrics/system
# - metrics/business
# - logs
# - traces
```

### 10. Fluent-Bit Logs Test

**Objective**: Verify Fluent-Bit collecting container logs.

**Procedure**:
```bash
# Check Fluent-Bit pods (DaemonSet)
kubectl get pods -l app=fluent-bit -n ez-platform

# Expected: One pod per node, all Running

# Check Fluent-Bit logs
kubectl logs -l app=fluent-bit -n ez-platform --tail=50 | grep -i "error"
# Expected: No errors (or minimal transient errors)

# Verify logs being forwarded
kubectl logs -l app=fluent-bit -n ez-platform --tail=100 | grep "Elasticsearch"
# Expected: Messages about sending logs to Elasticsearch
```

---

## Alert Testing

### 11. Alert Rules Validation

**Objective**: Verify alert rules loaded and evaluating.

**Procedure**:
```bash
# Port forward to Prometheus
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform &

# Check alert rules via API
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | .name'

# Expected alerts:
# - RabbitMQQueueBacklog
# - RabbitMQQueueCritical
# - ProcessingLagHigh
# - ProcessingStalled
# - HazelcastMemoryHigh
# - PodNotReady
# - FileProcessorScaledDown
# - HighInvalidRecordRate
```

**Manual Verification** (browser):
1. Open http://localhost:9090/alerts
2. Expected: All alerts listed in "Inactive" state
3. No alerts should be firing immediately after installation

### 12. Alert Threshold Customization Test

**Objective**: Verify alert thresholds can be customized.

**Procedure**:
```bash
# Check alert thresholds in ConfigMap
kubectl get configmap prometheus-alerts -n ez-platform -o yaml | grep "threshold"

# For dev environment
kubectl get configmap prometheus-alerts -n ez-platform-dev -o yaml | grep "rabbitmqQueueBacklog" -A 3
# Expected: threshold: 50 (relaxed)

# For prod environment
kubectl get configmap prometheus-alerts -n ez-platform-prod -o yaml | grep "rabbitmqQueueBacklog" -A 3
# Expected: threshold: 100 (standard)
```

---

## Upgrade Testing

### 13. In-Place Upgrade Test

**Objective**: Verify upgrade from old version preserves data.

**Procedure**:
```bash
# Backup current Grafana password (if exists)
kubectl get secret grafana-credentials -n ez-platform -o yaml > /tmp/grafana-secret-backup.yaml

# Perform upgrade
helm upgrade ez-platform ./ez-platform-ocp \
  -f values.yaml \
  -n ez-platform

# Monitor rollout
kubectl rollout status deployment/prometheus-system -n ez-platform
kubectl rollout status deployment/ezplatform-grafana -n ez-platform

# Verify upgrade completed
kubectl get pods -n ez-platform | grep -v "Running\|Completed"
# Expected: No output (all pods running)

# Check Grafana still accessible
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform &
curl -s http://localhost:3000/api/health
# Expected: {"database":"ok", ...}
```

**Expected Results**:
- ✅ Upgrade completes without errors
- ✅ All pods restart successfully
- ✅ No data loss (PVCs retained)
- ✅ Grafana password still works
- ✅ Dashboards preserved

### 14. Rollback Test

**Objective**: Verify rollback to previous version works.

**Procedure**:
```bash
# Check Helm history
helm history ez-platform -n ez-platform

# Rollback to previous revision
helm rollback ez-platform -n ez-platform

# Verify rollback
kubectl get pods -n ez-platform -w
# Expected: Pods restart with old configuration

# Check Helm status
helm status ez-platform -n ez-platform
```

**Expected Results**:
- ✅ Rollback completes within 5 minutes
- ✅ Pods return to previous state
- ✅ No data loss

---

## Performance Testing

### 15. Resource Usage Test

**Objective**: Verify components stay within resource limits.

**Procedure**:
```bash
# Check resource usage
kubectl top pods -n ez-platform

# Prometheus System memory usage
PROM_MEM=$(kubectl top pod -n ez-platform -l app=prometheus-system --no-headers | awk '{print $3}')
echo "Prometheus System Memory: $PROM_MEM"
# Expected: < 2Gi (default), < 8Gi (production)

# Grafana memory usage
GRAFANA_MEM=$(kubectl top pod -n ez-platform -l app=ezplatform-grafana --no-headers | awk '{print $3}')
echo "Grafana Memory: $GRAFANA_MEM"
# Expected: < 512Mi (default), < 4Gi (production)

# OTEL Collector CPU usage
OTEL_CPU=$(kubectl top pod -n ez-platform -l app=otel-collector --no-headers | awk '{print $2}')
echo "OTEL Collector CPU: $OTEL_CPU"
# Expected: < 500m (default), < 2000m (production)
```

### 16. Load Test

**Objective**: Verify observability stack handles load.

**Prerequisites**: Application processing files

**Procedure**:
```bash
# Monitor Prometheus memory during load
watch -n 5 'kubectl top pod -n ez-platform -l app=prometheus-system'

# Check metric cardinality
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform &
curl -s http://localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName | length'
# Expected: < 10,000 time series

# Monitor OTEL Collector throughput
kubectl logs deployment/otel-collector -n ez-platform --tail=100 | grep -i "batch"
# Expected: Batches being sent successfully
```

---

## Security Testing

### 17. Grafana Password Security Test

**Objective**: Verify Grafana password is secure.

**Procedure**:
```bash
# Check secret exists
kubectl get secret grafana-credentials -n ez-platform

# Verify password is NOT hardcoded
kubectl get deployment ezplatform-grafana -n ez-platform -o yaml | grep -i "password"
# Expected: Only secretKeyRef references, no hardcoded base64

# Verify password is random (if auto-generated)
GRAFANA_PASSWORD=$(kubectl get secret grafana-credentials -n ez-platform -o jsonpath='{.data.admin-password}' | base64 -d)
echo "Password length: ${#GRAFANA_PASSWORD}"
# Expected: 32 characters (if auto-generated)
```

### 18. Image Security Test

**Objective**: Verify no :latest tags.

**Procedure**:
```bash
# Check all image tags
kubectl get pods -n ez-platform -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | grep ":latest"
# Expected: No output (no :latest tags)

# Verify specific versions
kubectl get deployment prometheus-system -n ez-platform -o jsonpath='{.spec.template.spec.containers[0].image}'
# Expected: prom/prometheus:v2.53.0

kubectl get deployment ezplatform-grafana -n ez-platform -o jsonpath='{.spec.template.spec.containers[0].image}'
# Expected: grafana/grafana:10.4.1
```

---

## Test Summary Checklist

Use this checklist to track testing progress:

### Pre-Deployment
- [ ] Helm lint passes (0 failures)
- [ ] Template generation succeeds (default, dev, prod)
- [ ] Dry-run installation succeeds

### Fresh Install
- [ ] Default values install succeeds
- [ ] All pods reach Running status
- [ ] PVCs bound successfully
- [ ] Grafana secret auto-generated

### Environment-Specific
- [ ] Development values install succeeds (reduced resources)
- [ ] Production values install succeeds (HA replicas)
- [ ] Alert thresholds differ between environments

### Functional Testing
- [ ] Grafana UI accessible
- [ ] All 3 datasources working
- [ ] Prometheus collecting metrics
- [ ] Elasticsearch receiving logs
- [ ] Jaeger showing traces
- [ ] OTEL Collector forwarding telemetry
- [ ] Fluent-Bit collecting logs

### Alert Testing
- [ ] All 8 alert rules loaded
- [ ] Alert thresholds customizable
- [ ] Alerts evaluate correctly

### Upgrade Testing
- [ ] In-place upgrade succeeds
- [ ] Data persists after upgrade
- [ ] Rollback succeeds

### Performance Testing
- [ ] Components within resource limits
- [ ] Observability stack handles load

### Security Testing
- [ ] Grafana password secure (no hardcoded)
- [ ] No :latest image tags
- [ ] All images pinned to specific versions

---

## Troubleshooting Test Failures

### Common Issues

**PVC Stuck in Pending**:
```bash
kubectl describe pvc <pvc-name> -n ez-platform
# Check: StorageClass exists and has provisioner
```

**Pod CrashLoopBackOff**:
```bash
kubectl logs <pod-name> -n ez-platform --previous
# Check: ConfigMap errors, missing secrets, resource limits
```

**Metrics Not Appearing**:
```bash
kubectl logs deployment/otel-collector -n ez-platform | grep -i error
# Check: OTEL Collector configuration, Prometheus endpoints
```

---

**Document Version**: 1.0.0
**Last Updated**: January 2026
**Chart Version**: 0.1.1-rc2+

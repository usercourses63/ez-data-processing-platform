# Upgrading EZ Platform Observability Stack

## Overview

This guide covers upgrading from v0.1.1-rc2 (hardcoded observability) to the latest version (fully templated observability stack).

---

## Breaking Changes

### 1. Grafana Password Management

**Before (v0.1.1-rc2)**:
- Password hardcoded in deployment as base64: `RVpQbGF0Zm9ybTIwMjUhQmV0YQ==`
- Secret: `grafana-admin-secret`

**After (Latest)**:
- Password in dedicated secret: `grafana-credentials`
- Auto-generated random 32-char password by default
- Support for external secret management

**Action Required**: None - password will be auto-generated on upgrade. Retrieve new password:
```bash
kubectl get secret grafana-credentials -n ez-platform \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

### 2. Image Tags

**Before**: All images used `:latest` tag (8 components)

**After**: All images pinned to specific versions:
- Prometheus: `v2.53.0`
- Grafana: `10.4.1` (LTS)
- Elasticsearch: `8.17.0`
- Jaeger: `1.62.0`
- OTEL Collector: `0.113.0`
- Fluent-Bit: `3.2.2`

**Action Required**: None - images will be pulled on upgrade.

### 3. values.yaml Structure

**Before**: Minimal observability section (~40 lines)
```yaml
observability:
  otel:
    enabled: true
  elasticsearch:
    enabled: true
```

**After**: Comprehensive configuration (~333 lines)
```yaml
observability:
  prometheusSystem: { ... }
  prometheusBusiness: { ... }
  grafana: { ... }
  elasticsearch: { ... }
  jaeger: { ... }
  otelCollector: { ... }  # Note: renamed from "otel"
  fluentBit: { ... }
  alerts: { ... }
```

**Action Required**: If using custom `values.yaml`, merge with new structure.

### 4. Helper Function Rename

**Before**: `.Values.observability.otel.external.enabled`

**After**: `.Values.observability.otelCollector.external.enabled`

**Action Required**: Update any custom templates referencing `otel` to `otelCollector`.

---

## Pre-Upgrade Checklist

### 1. Backup Grafana Dashboards

```bash
# Port forward to Grafana
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform

# Export dashboards via Grafana UI:
# Settings → Dashboards → Export
# Save JSON files locally
```

### 2. Backup Prometheus Data (Optional)

```bash
# Create snapshot
kubectl exec -it deployment/prometheus-system -n ez-platform -- \
  promtool tsdb create-blocks-from snapshot /prometheus
```

### 3. Backup Elasticsearch Indices

```bash
# Create snapshot repository
curl -X PUT "localhost:9200/_snapshot/backup_repo" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/backup"
  }
}'

# Create snapshot
curl -X PUT "localhost:9200/_snapshot/backup_repo/snapshot_1?wait_for_completion=true"
```

### 4. Document Current Configuration

```bash
# Export current values
helm get values ez-platform -n ez-platform > current-values.yaml

# Export all resource manifests
kubectl get all -n ez-platform -o yaml > current-state.yaml
```

### 5. Verify Current Version

```bash
helm list -n ez-platform
# Expected: ez-platform, CHART: ez-platform-ocp-0.1.1-rc2
```

---

## Upgrade Procedure

### Method 1: In-Place Upgrade (Recommended)

Minimal downtime with rolling updates.

**Step 1: Update Helm repository**
```bash
cd /path/to/helm-charts
git pull origin main
cd release-package/helm/ez-platform-ocp
```

**Step 2: Review changes**
```bash
# Generate diff (requires helm-diff plugin)
helm diff upgrade ez-platform . -f values.yaml -n ez-platform

# Or use helm template
helm template ez-platform . -f values.yaml > new-manifests.yaml
# Manually compare with current-state.yaml
```

**Step 3: Perform upgrade**
```bash
# Standard upgrade
helm upgrade ez-platform . -f values.yaml -n ez-platform

# Or with environment overrides
helm upgrade ez-platform . \
  -f values.yaml \
  -f values-production.yaml \
  -n ez-platform
```

**Step 4: Monitor rollout**
```bash
# Watch pod status
kubectl get pods -n ez-platform -w

# Check for errors
kubectl get events -n ez-platform --sort-by='.lastTimestamp' | tail -20
```

**Step 5: Verify upgrade**
```bash
# Check all pods running
kubectl get pods -n ez-platform

# Check Grafana new password
kubectl get secret grafana-credentials -n ez-platform \
  -o jsonpath='{.data.admin-password}' | base64 -d

# Access Grafana
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform
# Login with admin / <new-password>

# Verify dashboards loaded
# Open http://localhost:3000/dashboards
```

**Expected Downtime**: 2-5 minutes per component (rolling updates)

---

### Method 2: Blue-Green Deployment (Zero Downtime)

Deploy new version alongside old, then switch.

**Step 1: Deploy new version in separate namespace**
```bash
# Create new namespace
kubectl create namespace ez-platform-new

# Install new version
helm install ez-platform-new ./ez-platform-ocp \
  -f values.yaml \
  -f values-production.yaml \
  -n ez-platform-new
```

**Step 2: Migrate data**
```bash
# Copy PVCs (Prometheus, Grafana, Elasticsearch)
# This requires CSI snapshots or manual migration
```

**Step 3: Switch traffic**
```bash
# Update ingress/routes to point to new namespace
kubectl patch ingress <ingress-name> -n ez-platform-new ...
```

**Step 4: Validate and cleanup**
```bash
# Monitor new deployment
kubectl get pods -n ez-platform-new

# If successful, delete old namespace
kubectl delete namespace ez-platform
```

**Expected Downtime**: 0 minutes (traffic switches instantly)

---

### Method 3: Fresh Install (Clean Slate)

Complete reinstall. Data loss expected.

**Step 1: Backup critical data**
```bash
# See "Pre-Upgrade Checklist" section above
```

**Step 2: Uninstall old version**
```bash
helm uninstall ez-platform -n ez-platform

# Wait for all pods to terminate
kubectl get pods -n ez-platform -w
```

**Step 3: Delete PVCs (optional - prevents data reuse)**
```bash
kubectl delete pvc --all -n ez-platform
```

**Step 4: Install new version**
```bash
helm install ez-platform ./ez-platform-ocp \
  -f values.yaml \
  -f values-production.yaml \
  -n ez-platform
```

**Step 5: Restore data**
```bash
# Restore Grafana dashboards via UI
# Restore Prometheus snapshots
# Restore Elasticsearch indices
```

**Expected Downtime**: 10-15 minutes

---

## Post-Upgrade Verification

### 1. Check All Pods Running
```bash
kubectl get pods -n ez-platform

# Expected: All pods Running/Completed
# - prometheus-system-*: Running
# - prometheus-business-*: Running
# - ezplatform-grafana-*: Running
# - elasticsearch-*: Running
# - jaeger-*: Running
# - otel-collector-*: Running
# - fluent-bit-*: Running (DaemonSet - one per node)
```

### 2. Verify Grafana Access
```bash
# Get new password
kubectl get secret grafana-credentials -n ez-platform \
  -o jsonpath='{.data.admin-password}' | base64 -d

# Port forward
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform

# Login: http://localhost:3000
# Username: admin
# Password: <from above>
```

### 3. Verify Datasources
```bash
# In Grafana UI:
# Configuration → Data Sources

# Expected datasources:
# - System-Prometheus (✓ Working)
# - Business-Prometheus (✓ Working, Default)
# - Elasticsearch-Logs (✓ Working)
```

### 4. Verify Metrics Collection
```bash
# Port forward to Prometheus
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform

# Open http://localhost:9090/targets
# Expected: All targets UP
```

### 5. Verify Alerts Configured
```bash
# In Prometheus UI:
# http://localhost:9090/alerts

# Expected alerts:
# - RabbitMQQueueBacklog (Inactive)
# - RabbitMQQueueCritical (Inactive)
# - ProcessingLagHigh (Inactive)
# - ProcessingStalled (Inactive)
# - HazelcastMemoryHigh (Inactive)
# - PodNotReady (Inactive)
# - FileProcessorScaledDown (Inactive)
# - HighInvalidRecordRate (Inactive)
```

### 6. Verify Logs Flowing
```bash
# Port forward to Elasticsearch
kubectl port-forward svc/elasticsearch 9200:9200 -n ez-platform

# Check indices
curl http://localhost:9200/_cat/indices?v

# Expected indices:
# - dataprocessing-logs-YYYY.MM.DD
# - ez-logs-YYYY.MM.DD
# - jaeger-span-*
```

### 7. Verify Traces
```bash
# Port forward to Jaeger
kubectl port-forward svc/jaeger 16686:16686 -n ez-platform

# Open http://localhost:16686
# Select service: fileprocessor, validation, output
# Click "Find Traces"
# Expected: Traces visible
```

---

## Rollback Procedure

If upgrade fails or causes issues:

### Quick Rollback (Helm)
```bash
# Rollback to previous release
helm rollback ez-platform -n ez-platform

# Or to specific revision
helm history ez-platform -n ez-platform
helm rollback ez-platform <revision> -n ez-platform
```

### Manual Rollback
```bash
# Restore from backup
helm uninstall ez-platform -n ez-platform
helm install ez-platform <path-to-old-chart> \
  -f current-values.yaml \
  -n ez-platform

# Restore PVCs from backups
# Restore Grafana dashboards
# Restore Elasticsearch snapshots
```

**Expected Rollback Time**: 5-10 minutes

---

## Troubleshooting Upgrade Issues

### Issue 1: Grafana Pod CrashLooping

**Symptom**: Grafana pod in CrashLoopBackOff

**Cause**: Missing `grafana-credentials` secret

**Solution**:
```bash
# Check if secret exists
kubectl get secret grafana-credentials -n ez-platform

# If missing, create manually
kubectl create secret generic grafana-credentials \
  --from-literal=admin-password=$(openssl rand -base64 32) \
  -n ez-platform

# Restart Grafana
kubectl rollout restart deployment/ezplatform-grafana -n ez-platform
```

### Issue 2: OTEL Collector Config Error

**Symptom**: OTEL Collector logs show YAML parsing errors

**Cause**: ConfigMap formatting issue

**Solution**:
```bash
# Check ConfigMap
kubectl get configmap otel-collector-config -n ez-platform -o yaml

# Look for YAML errors in config.yaml section
# Common issues: incorrect indentation, missing quotes

# Edit ConfigMap
kubectl edit configmap otel-collector-config -n ez-platform

# Restart OTEL Collector
kubectl rollout restart deployment/otel-collector -n ez-platform
```

### Issue 3: PVC Stuck in Pending

**Symptom**: PVC for Prometheus/Grafana/Elasticsearch in Pending state

**Cause**: StorageClass not available

**Solution**:
```bash
# Check storage classes
kubectl get sc

# Update values.yaml with available storage class
helm upgrade ez-platform . \
  --set observability.prometheusSystem.storage.storageClass=standard \
  --set observability.grafana.storage.storageClass=standard \
  --set observability.elasticsearch.storage.storageClass=standard \
  -n ez-platform
```

### Issue 4: Alerts Not Firing

**Symptom**: Alerts configured but never fire

**Cause**: Prometheus not loading alert rules

**Solution**:
```bash
# Check Prometheus config
kubectl logs deployment/prometheus-system -n ez-platform | grep -i alert

# Verify alert rules ConfigMap
kubectl get configmap prometheus-alerts -n ez-platform -o yaml

# Check Prometheus rules page
# http://localhost:9090/rules
```

---

## Environment-Specific Upgrade Notes

### Base Environment
```bash
# Use base values.yaml only (no overlay)
helm upgrade ez-platform . \
  -f values.yaml \
  -n ez-platform
```

### Production Environment
```bash
# Use values-production.yaml for HA (Helm auto-loads base values.yaml first)
helm upgrade ez-platform . \
  -f values-production.yaml \
  -n ez-platform

# Ensure PVCs use fast-ssd storage class
# Verify replicas scaled correctly:
kubectl get pods -n ez-platform | grep -E "(prometheus|grafana|otel)"
# Expected: 2-3 replicas each
```

---

## Additional Notes

### Grafana Dashboard Migration

Dashboards should persist across upgrades via PVC. If lost:

1. Import from JSON files (if backed up)
2. Use pre-configured dashboards in ConfigMaps:
   - `grafana-business-metrics-dashboard`
   - `grafana-infrastructure-dashboard`

### Custom Values Files

If using custom `values.yaml`:

1. Compare with new structure:
```bash
diff current-values.yaml values.yaml
```

2. Merge changes manually:
```bash
# Extract observability section from new values.yaml (lines 521-853)
sed -n '521,853p' values.yaml > observability-section.yaml

# Append to your custom values.yaml
cat observability-section.yaml >> my-custom-values.yaml
```

---

## Support

For issues during upgrade:
- Review logs: `kubectl logs <pod-name> -n ez-platform`
- Check events: `kubectl get events -n ez-platform --sort-by='.lastTimestamp'`
- Consult [OBSERVABILITY.md](OBSERVABILITY.md) for configuration details

---

**Document Version**: 1.0.0
**Last Updated**: January 2026
**Applicable Chart Version**: 0.1.1-rc2+

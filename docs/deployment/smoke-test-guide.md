---
last-verified: 2026-02-03
status: current
---

# Smoke Test Guide

This guide explains how to run and interpret EZ Platform smoke tests using Helm test hooks.

## Overview

Smoke tests verify that all EZ Platform services are healthy after deployment. The tests:
- Check `/health` endpoint on all 10 services (8 backend + frontend + docs)
- Retry 3 times with 10-second intervals on failure
- Wait 60 seconds before starting tests (service stabilization)
- Run as a Kubernetes pod with Helm test hook annotations

## Quick Reference

```bash
# Run smoke tests
helm test prod-ez-platform --namespace ez-platform --timeout 5m --logs

# Run with custom timeout (for slow environments)
helm test prod-ez-platform --namespace ez-platform --timeout 10m --logs

# View test pod logs after completion
oc logs prod-ez-platform-smoke-test -n ez-platform
```

## Test Execution

### Standard Test Run

```bash
# Run after helm install or upgrade
helm test prod-ez-platform \
  --namespace ez-platform \
  --timeout 5m \
  --logs
```

Expected output on success:
```
NAME: prod-ez-platform
LAST DEPLOYED: 2026-02-03 14:00:00
NAMESPACE: ez-platform
STATUS: deployed
REVISION: 2
TEST SUITE:     prod-ez-platform-smoke-test
Last Started:   Mon Feb 03 14:05:00 2026
Last Completed: Mon Feb 03 14:06:30 2026
Phase:          Succeeded
...
Testing datasource-management:5001...
  OK: datasource-management is healthy
Testing metrics-configuration:5002...
  OK: metrics-configuration is healthy
...
All health checks passed!
```

### Interpreting Results

| Phase | Meaning | Action |
|-------|---------|--------|
| Succeeded | All services healthy | Deployment verified |
| Failed | One or more services unhealthy | See "Handling Failures" |
| Running | Tests still executing | Wait or check timeout |
| Unknown | Pod status unclear | Check pod directly |

## Services Tested

The smoke test checks all enabled services:

| Service | Port | Health Endpoint |
|---------|------|-----------------|
| datasource-management | 5001 | /health |
| metrics-configuration | 5002 | /health |
| validation | 5003 | /health |
| scheduling | 5004 | /health |
| invalidrecords | 5006 | /health |
| filediscovery | 5007 | /health |
| fileprocessor | 5008 | /health |
| output | 5009 | /health |
| frontend | 8080 | /health |
| ezplatform-docs | 8080 | / (root path) |

## Handling Failures

### Identifying Failed Services

```bash
# View test logs
oc logs prod-ez-platform-smoke-test -n ez-platform

# Look for FAILED lines
oc logs prod-ez-platform-smoke-test -n ez-platform | grep FAILED
```

Example failure output:
```
Testing datasource-management:5001...
  OK: datasource-management is healthy
Testing validation:5003...
  Retry 1/3 for validation...
  Retry 2/3 for validation...
  Retry 3/3 for validation...
  FAILED: validation health check failed after 3 attempts
...
FAILED: 1 service(s) unhealthy
```

### Debugging Failed Services

```bash
# Check pod status
oc get pods -n ez-platform | grep validation

# View pod logs
oc logs deployment/validation -n ez-platform --tail=100

# Describe pod for events
oc describe pod -l app=validation -n ez-platform

# Check if service can resolve DNS
oc exec -it deployment/datasource-management -n ez-platform -- curl -v http://validation:5003/health
```

### Common Failure Causes

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| All services FAILED | Network policy blocking | Check NetworkPolicy allows test pod |
| Single service FAILED | Service-specific issue | Check pod logs and events |
| Timeout before tests start | Slow pod startup | Increase --timeout, check resources |
| Retry exhausted | Service temporarily unavailable | Check liveness/readiness probes |

## Retry Logic

The smoke test includes built-in retry:
- **Retry count:** 3 attempts
- **Retry interval:** 10 seconds between attempts
- **Initial wait:** 60 seconds before first test

If retries are exhausting before services stabilize:

```bash
# Option 1: Increase Helm test timeout
helm test prod-ez-platform --namespace ez-platform --timeout 10m --logs

# Option 2: Wait manually then test
sleep 120  # Wait 2 minutes
helm test prod-ez-platform --namespace ez-platform --timeout 5m --logs
```

## Manual Health Checks

If Helm test is unavailable or you need ad-hoc verification:

```bash
# From inside the cluster (exec into any pod)
oc exec -it deployment/datasource-management -n ez-platform -- /bin/sh -c '
  for svc in datasource-management:5001 validation:5003 fileprocessor:5008 frontend:8080; do
    name=$(echo $svc | cut -d: -f1)
    port=$(echo $svc | cut -d: -f2)
    curl -sf http://$name:$port/health && echo "$name: OK" || echo "$name: FAILED"
  done
'

# From outside cluster (requires port-forward or routes)
curl -sf https://$(oc get route frontend -n ez-platform -o jsonpath='{.spec.host}')/health
```

## Test Pod Cleanup

Test pods are automatically cleaned up by Helm hook policy:
- `before-hook-creation`: Deletes old test pod before creating new one
- `hook-succeeded`: Deletes test pod after successful completion

To manually clean up if needed:

```bash
# Delete test pod
oc delete pod prod-ez-platform-smoke-test -n ez-platform --ignore-not-found
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Smoke Tests
  run: |
    helm test prod-ez-platform \
      --namespace ez-platform \
      --timeout 5m \
      --logs 2>&1 | tee smoke-test-output.txt

    # Check exit code
    if [ $? -ne 0 ]; then
      echo "::error::Smoke tests failed"
      exit 1
    fi

- name: Upload Smoke Test Results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: smoke-test-output
    path: smoke-test-output.txt
```

### ArgoCD Integration

When using ArgoCD for GitOps deployments:

```yaml
# In Application manifest
spec:
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - PruneLast=true
  # ArgoCD runs Helm hooks automatically
  # Smoke test runs as post-sync hook
```

### Decision: Report-Only vs Auto-Rollback

The smoke test hook is configured for **report-only** mode:
- Test failure does NOT trigger automatic rollback
- Operators review results and decide on rollback
- Rationale: Avoids rollback churn from transient issues

To enable auto-rollback during upgrade, use `--atomic` flag:

```bash
helm upgrade prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --values values-prod.yaml \
  --atomic \
  --timeout 15m
```

With `--atomic`, Helm automatically rolls back if ANY hook (including tests) fails.

## Troubleshooting

### Test Pod Not Created

```bash
# Check Helm release status
helm status prod-ez-platform -n ez-platform

# Verify test template exists
helm get manifest prod-ez-platform -n ez-platform | grep smoke-test
```

### Test Pod Stuck in Pending

```bash
# Check pod events
oc describe pod prod-ez-platform-smoke-test -n ez-platform

# Check if image can be pulled
oc get events -n ez-platform --field-selector involvedObject.name=prod-ez-platform-smoke-test
```

### Inconsistent Results

If tests pass sometimes and fail sometimes:
1. Check resource limits on test pod
2. Check network policy rules
3. Increase initial wait time in smoke-test.yaml
4. Check if services are being restarted during tests

### Test Image Pull Errors

The smoke test uses `curlimages/curl:8.5.0`. If image pull fails:

```bash
# Check image pull status
oc get pods -n ez-platform | grep smoke-test
oc describe pod prod-ez-platform-smoke-test -n ez-platform | grep -A5 Events

# Verify image is accessible
# May need to allow registry in OCP environment
```

## Related Documentation

- [Rollback Procedures](rollback-procedures.md) - How to rollback failed deployments
- [Deployment Guide](DEPLOYMENT.md) - Full deployment procedures

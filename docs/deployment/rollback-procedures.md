---
last-verified: 2026-02-03
status: current
---

# Rollback Procedures

This document provides procedures for rolling back EZ Platform deployments using Helm.

## Overview

EZ Platform uses Helm's built-in rollback mechanism, which:
- Retains 3 versions in history (configurable via `--history-max`)
- Provides atomic rollback of all Kubernetes resources
- Does NOT rollback database state (MongoDB is schema-less but may have index changes)

## Quick Reference

```bash
# View release history
helm history prod-ez-platform --namespace ez-platform

# Rollback to previous revision
helm rollback prod-ez-platform --namespace ez-platform --timeout 10m --wait

# Rollback to specific revision
helm rollback prod-ez-platform 2 --namespace ez-platform --timeout 10m --wait

# Verify rollback success
helm test prod-ez-platform --namespace ez-platform --timeout 5m --logs
```

## Rollback Triggers

### When to Rollback

| Trigger | Severity | Action |
|---------|----------|--------|
| Smoke tests fail after upgrade | HIGH | Immediate rollback |
| Multiple services unhealthy | HIGH | Immediate rollback |
| Data corruption detected | CRITICAL | Rollback + DB investigation |
| Performance degradation >50% | MEDIUM | Assess, then rollback if persistent |
| Single non-critical service unhealthy | LOW | Fix forward or rollback |

### When NOT to Rollback

- Database migration has completed successfully (forward-only migrations)
- Only logging/metrics issues (non-critical)
- External dependency failure (not a deployment issue)

## Rollback Procedures

### Procedure 1: Standard Rollback (Upgrade Failed)

Use when an upgrade fails or smoke tests fail immediately after upgrade.

```bash
# 1. Confirm current state
helm history prod-ez-platform --namespace ez-platform

# Output shows revisions:
# REVISION  UPDATED                   STATUS     CHART               APP VERSION  DESCRIPTION
# 1         2026-01-15 10:00:00       superseded ez-platform-0.1.1   v0.1.1-rc3   Install complete
# 2         2026-02-03 14:00:00       deployed   ez-platform-0.2.0   v0.2.0       Upgrade complete
# 3         2026-02-03 14:30:00       failed     ez-platform-0.2.0   v0.2.0       Upgrade failed

# 2. Rollback to last known good (revision 1)
helm rollback prod-ez-platform 1 \
  --namespace ez-platform \
  --timeout 10m \
  --wait

# 3. Verify rollback success
helm test prod-ez-platform \
  --namespace ez-platform \
  --timeout 5m \
  --logs

# 4. Confirm pods are running
oc get pods -n ez-platform
```

### Procedure 2: Rollback After Smoke Test Failure

Use when deployment completed but smoke tests indicate unhealthy services.

```bash
# 1. Check which services failed
helm test prod-ez-platform --namespace ez-platform --timeout 5m --logs 2>&1 | tee smoke-test-output.txt

# 2. Review the failures
cat smoke-test-output.txt | grep -E "FAILED|OK"

# 3. If multiple critical services failed, rollback
helm rollback prod-ez-platform \
  --namespace ez-platform \
  --timeout 10m \
  --wait

# 4. Re-run smoke tests to verify rollback
helm test prod-ez-platform --namespace ez-platform --timeout 5m --logs

# 5. Document the failure for investigation
# Save smoke-test-output.txt and pod logs for debugging
```

### Procedure 3: Rollback with Database Considerations

Use when the deployment included database changes (new indexes, schema changes).

```bash
# 1. Check current revision and database state
helm history prod-ez-platform --namespace ez-platform

# 2. Document current indexes (before rollback)
oc exec -it mongodb-0 -n ez-platform -- mongosh ezplatform --eval "db.getCollectionNames().forEach(c => { print('Collection: ' + c); printjson(db[c].getIndexes()); })" > pre-rollback-indexes.txt

# 3. Perform rollback
helm rollback prod-ez-platform 1 \
  --namespace ez-platform \
  --timeout 10m \
  --wait

# 4. Check for index compatibility issues
# If older code fails due to missing indexes, manually add them:
oc exec -it mongodb-0 -n ez-platform -- mongosh ezplatform --eval "db.datasources.createIndex({ 'name': 1 }, { unique: true, background: true })"

# 5. Verify application health
helm test prod-ez-platform --namespace ez-platform --timeout 5m --logs
```

### Procedure 4: Emergency Rollback (Critical Failure)

Use for production-impacting failures requiring immediate action.

```bash
# 1. Immediate rollback (no history check)
helm rollback prod-ez-platform \
  --namespace ez-platform \
  --timeout 5m \
  --wait \
  --force

# 2. Quick health check (manual curl instead of full smoke test)
for svc in datasource-management:5001 validation:5003 fileprocessor:5008 frontend:8080; do
  name=$(echo $svc | cut -d: -f1)
  port=$(echo $svc | cut -d: -f2)
  oc exec -it deployment/datasource-management -n ez-platform -- curl -sf http://$name:$port/health && echo "$name: OK" || echo "$name: FAILED"
done

# 3. If critical services still failing, scale to 0 and investigate
oc scale deployment --all --replicas=0 -n ez-platform

# 4. Notify operations team
```

## Database State Handling

### MongoDB Considerations

Helm rollback does NOT affect MongoDB data. Consider these scenarios:

| Scenario | Impact | Resolution |
|----------|--------|------------|
| New index added | Old code may be slower without new index | Add index manually if needed |
| Index removed | Old code may fail if it expects index | Rollback is safe |
| New collection | Old code ignores new collection | No action needed |
| Field renamed | Old code may fail to find data | May require DB restore |

### Index Rollback (If Needed)

If rollback requires removing indexes added by newer version:

```bash
# List indexes
oc exec -it mongodb-0 -n ez-platform -- mongosh ezplatform --eval "db.datasources.getIndexes()"

# Drop specific index (be careful - this affects performance)
oc exec -it mongodb-0 -n ez-platform -- mongosh ezplatform --eval "db.datasources.dropIndex('index_name')"
```

### Data Restore (Last Resort)

If data corruption occurred and rollback is insufficient:

```bash
# 1. Stop all services
oc scale deployment --all --replicas=0 -n ez-platform

# 2. Restore from backup (assumes backup exists)
# This is environment-specific - consult your backup procedures

# 3. Restart services
helm upgrade prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --values values-prod.yaml \
  --reuse-values \
  --timeout 15m
```

## Post-Rollback Verification

After any rollback, verify the system is healthy:

```bash
# 1. Run full smoke tests
helm test prod-ez-platform --namespace ez-platform --timeout 5m --logs

# 2. Check all pods running
oc get pods -n ez-platform -o wide

# 3. Verify routes accessible
curl -sf https://$(oc get route frontend -n ez-platform -o jsonpath='{.spec.host}')/health
curl -sf https://$(oc get route docs -n ez-platform -o jsonpath='{.spec.host}')/

# 4. Check recent logs for errors
oc logs -l app.kubernetes.io/instance=prod-ez-platform --tail=50 -n ez-platform | grep -i error

# 5. Verify message processing (if applicable)
# Check RabbitMQ queue depths, Kafka consumer lag
```

## Rollback History Management

### View History

```bash
helm history prod-ez-platform --namespace ez-platform --max 10
```

### History Retention

History is automatically limited to 3 releases by `--history-max 3` flag during install/upgrade.

```bash
# Example install with history limit
helm install prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --history-max 3

# Example upgrade with history limit
helm upgrade prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --history-max 3
```

### Clean Old Releases

To manually clean if needed:

```bash
# Not recommended - let Helm manage automatically
# Only use if etcd storage is critically low
helm history prod-ez-platform --namespace ez-platform | head -n -3 | awk 'NR>1 {print $1}' | xargs -I{} helm rollback prod-ez-platform {} --cleanup-on-fail
```

## Troubleshooting

### Rollback Fails with Timeout

```bash
# Check what's blocking
oc get pods -n ez-platform -o wide | grep -v Running

# Force rollback (may leave resources in inconsistent state)
helm rollback prod-ez-platform --namespace ez-platform --force --timeout 2m

# Manual cleanup if needed
oc delete pod --field-selector=status.phase!=Running -n ez-platform
```

### Cannot Determine Last Good Revision

```bash
# Check all revisions and their statuses
helm history prod-ez-platform --namespace ez-platform

# Look for STATUS=deployed (not failed or superseded)
# Choose the most recent deployed revision before the failure
```

### Rollback Succeeds But Application Still Broken

1. Check if database state is incompatible (see Database State Handling)
2. Check external dependencies (Kafka, external APIs)
3. Check ConfigMaps haven't been manually modified outside Helm
4. Review pod logs for specific errors

## Runbook Checklist

- [ ] Identify failure trigger and severity
- [ ] Check helm history for available rollback targets
- [ ] Document current state (pods, logs, indexes)
- [ ] Execute appropriate rollback procedure
- [ ] Run post-rollback verification
- [ ] Document incident and root cause
- [ ] Plan forward fix for next deployment attempt

## Related Documentation

- [Smoke Test Guide](smoke-test-guide.md) - Running and interpreting smoke tests
- [Deployment Guide](DEPLOYMENT.md) - Full deployment procedures

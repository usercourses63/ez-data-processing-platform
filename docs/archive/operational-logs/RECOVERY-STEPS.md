# Recovery Steps - Restore Working Platform

**Issue:** Services crashing after Kafka rider implementation
**Solution:** Revert to last known working state

## Quick Recovery (5 minutes):

```bash
# 1. Delete crashing pods
kubectl delete deployment datasource-management scheduling -n ez-platform

# 2. Reapply original manifests
kubectl apply -f k8s/deployments/datasource-management.yaml
kubectl apply -f k8s/deployments/scheduling.yaml

# 3. Wait for ready
kubectl wait --for=condition=ready pod -l app=datasource-management -n ez-platform --timeout=90s
kubectl wait --for=condition=ready pod -l app=scheduling -n ez-platform --timeout=90s

# 4. Verify all services
kubectl get pods -n ez-platform
# All should be 1/1 Running

# 5. Restart port-forwards
kubectl port-forward svc/frontend 8080:80 -n ez-platform &
kubectl port-forward svc/datasource-management 5001:5001 -n ez-platform &
kubectl port-forward svc/metrics-configuration 5002:5002 -n ez-platform &

# 6. Test frontend
# Open: http://localhost:8080
# Should see 21 datasources and 73 metrics
```

## What Happened:

The Kafka rider implementation is in the code but has DI initialization errors. The Docker images were built with this code, so both new and rolled-back versions have the issue.

## Next Session: Start Here

**Priority #1:** Fix Kafka rider or revert to working architecture
**Option A:** Debug Mass Transit Kafka DI (1-2 hours)
**Option B:** Rebuild images WITHOUT Kafka changes (15 min) - use git to revert code temporarily

**Fastest Path:**
```bash
# Temporarily revert code changes
git stash

# Rebuild services
docker build -t ez-platform/datasource-management:latest -f docker/DataSourceManagementService.Dockerfile .
docker build -t ez-platform/scheduling:latest -f docker/SchedulingService.Dockerfile .

# Deploy
kubectl delete deployment datasource-management scheduling -n ez-platform
kubectl apply -f k8s/deployments/datasource-management.yaml
kubectl apply -f k8s/deployments/scheduling.yaml

# Restore stash when ready to continue Kafka work
git stash pop
```

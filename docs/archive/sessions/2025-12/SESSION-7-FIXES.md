# Session 7: Bootstrap Automation & CORS Fixes

**Date:** 2025-12-10
**Status:** ✅ Complete
**Previous Session:** [Session 6 - E2E Pipeline](./SESSION-6-E2E-TESTING.md)

## Summary

After PC shutdown destroyed the K8s cluster, we created a fully automated bootstrap solution that handles:
- ✅ Complete cluster deployment (one command)
- ✅ CORS configuration for testing
- ✅ Port forwarding automation
- ✅ External mount automation
- ✅ Demo data generation

## Problems Solved

### 1. Cluster Lost After PC Shutdown

**Problem:** PC shutdown destroyed entire minikube cluster, requiring manual recreation.

**Solution:** Enhanced `scripts/bootstrap-k8s-cluster.ps1` to automate everything:

```powershell
# One command to recreate entire environment
.\scripts\bootstrap-k8s-cluster.ps1
```

**Time to Deploy:** ~5-10 minutes (full rebuild) or ~2-3 minutes (FastStart mode)

### 2. Frontend Cannot Access K8s APIs (CORS)

**Problem:** Frontend showed "Connection Refused" errors when trying to fetch datasources/metrics.

**Root Cause:**
- Services running with `ASPNETCORE_ENVIRONMENT=Production`
- Production CORS policy restricts origins
- Frontend runs on localhost, not in cluster

**Solution:** Automated Development environment configuration in bootstrap script:

```powershell
# Step 9: Configure CORS for Testing
kubectl set env deployment datasource-management -n ez-platform ASPNETCORE_ENVIRONMENT=Development
kubectl set env deployment metrics-configuration -n ez-platform ASPNETCORE_ENVIRONMENT=Development
```

**Code Reference:** [DataSourceManagementService/Program.cs:214-222](../../src/Services/DataSourceManagementService/Program.cs#L214-L222)

### 3. No External Access to K8s Services

**Problem:** Services have ClusterIP only, cannot be accessed from localhost browser.

**Solution:** Automated port forwarding in bootstrap script:

```powershell
# Step 10: Setup Port Forwarding
kubectl port-forward -n ez-platform svc/frontend 80:80 &
kubectl port-forward -n ez-platform svc/datasource-management 5001:5001 &
kubectl port-forward -n ez-platform svc/metrics-configuration 5002:5002 &
kubectl port-forward -n ez-platform svc/invalidrecords 5006:5006 &
```

**Services Accessible:**
- http://localhost:3000 - Frontend
- http://localhost:5001 - Datasource Management API
- http://localhost:5002 - Metrics Configuration API
- http://localhost:5006 - Invalid Records API

### 4. Test Data Not Accessible to FileDiscovery

**Problem:** FileDiscovery service needs to read test files from host machine.

**Solution:** Automated minikube mount in bootstrap script:

```powershell
# Step 3: External Test Data Mount Setup
minikube mount C:\Users\UserC\source\repos\EZ\test-data:/mnt/external-test-data &
```

**Mount Path:** `/mnt/external-test-data` inside minikube VM

### 5. Metrics-Configuration Not Binding Correctly

**Problem:** Service bound to `localhost:5002` instead of `0.0.0.0:5002`, making it unreachable from outside pod.

**Root Cause:** Explicit Kestrel configuration in [appsettings.json:37-43](../../src/Services/MetricsConfigurationService/appsettings.json#L37-L43):

```json
"Kestrel": {
  "Endpoints": {
    "Http": {
      "Url": "http://localhost:5002"
    }
  }
}
```

**Solution:** Override via environment variable in bootstrap script:

```powershell
kubectl set env deployment metrics-configuration -n ez-platform \
  Kestrel__Endpoints__Http__Url="http://0.0.0.0:5002"
```

## Files Modified

### 1. Bootstrap Script

**File:** [scripts/bootstrap-k8s-cluster.ps1](../../scripts/bootstrap-k8s-cluster.ps1)

**Changes:**
- Added Step 3: External mount automation
- Added Step 9: CORS configuration automation
- Added Step 10: Port forwarding automation
- Added demo-data-generator to build list
- Added background job management
- Enhanced access information output

**Key Functions:**
```powershell
function Start-PortForward {
    param([string]$ServiceName, [int]$Port, [string]$Namespace = "ez-platform")
    $job = Start-Job -ScriptBlock {
        param($svc, $port, $ns)
        kubectl port-forward -n $ns svc/$svc ${port}:${port}
    } -ArgumentList $ServiceName, $Port, $Namespace
    return $job
}
```

### 2. Documentation

**New Files:**
- [K8S-BOOTSTRAP-AUTOMATION.md](./K8S-BOOTSTRAP-AUTOMATION.md) - Complete automation guide
- [SESSION-7-FIXES.md](./SESSION-7-FIXES.md) - This file

## Usage Examples

### Quick Start After PC Restart

```powershell
# Navigate to repo
cd C:\Users\UserC\source\repos\EZ

# Run bootstrap script
.\scripts\bootstrap-k8s-cluster.ps1

# Wait 5-10 minutes for deployment
# Script will automatically:
#   1. Start minikube
#   2. Build and load images
#   3. Deploy infrastructure
#   4. Deploy services
#   5. Configure CORS
#   6. Setup port forwarding
#   7. Mount test data
#   8. Generate demo data

# Access frontend
Start-Process "http://localhost:3000"
```

### Fast Restart (No Rebuild)

```powershell
# Use existing images, skip demo data
.\scripts\bootstrap-k8s-cluster.ps1 -FastStart
```

### Clean Slate Deployment

```powershell
# Delete cluster and start fresh
.\scripts\bootstrap-k8s-cluster.ps1 -Clean
```

## Verification Steps

After bootstrap completes:

### 1. Check All Pods Running

```powershell
kubectl get pods -n ez-platform
```

Expected output: All 9 services + infrastructure = ~13 pods with status `Running` and `1/1` ready.

### 2. Verify CORS Configuration

```powershell
# Should show "Development"
kubectl get deployment datasource-management -n ez-platform -o yaml | findstr "ASPNETCORE_ENVIRONMENT"
kubectl get deployment metrics-configuration -n ez-platform -o yaml | findstr "ASPNETCORE_ENVIRONMENT"
```

### 3. Verify Port Forwards Active

```powershell
# Check PowerShell jobs
Get-Job | Where-Object { $_.Command -like '*kubectl port-forward*' }
```

Expected: 4 jobs in "Running" state

### 4. Verify Frontend Can Access APIs

Open http://localhost:3000 and verify:
- ✅ Datasources page loads and shows 20 datasources
- ✅ Metrics page loads and shows metrics
- ✅ No CORS errors in browser console

### 5. Verify Mount Active

```powershell
# Check mount job
Get-Job | Where-Object { $_.Command -like '*minikube mount*' }

# Verify inside minikube
minikube ssh
ls -la /mnt/external-test-data
```

Expected: Test data directory visible with E2E-001 folder

## Troubleshooting

### Port Forward Fails

```powershell
# Check if ports already in use
netstat -ano | findstr ":5001"

# Kill process using port (replace <PID> with actual PID)
taskkill /F /PID <PID>

# Restart port forward manually
kubectl port-forward -n ez-platform svc/datasource-management 5001:5001
```

### CORS Still Fails

```powershell
# Verify environment
kubectl logs deployment/datasource-management -n ez-platform --tail=20

# Should see: "Environment: Development"

# If not, manually set:
kubectl set env deployment datasource-management -n ez-platform ASPNETCORE_ENVIRONMENT=Development
kubectl rollout restart deployment datasource-management -n ez-platform
```

### Mount Not Working

```powershell
# Run mount manually in new PowerShell window
minikube mount C:\Users\UserC\source\repos\EZ\test-data:/mnt/external-test-data

# Leave window open (mount must stay active)
```

## Architecture Decisions

### 1. Development vs Production CORS

**Decision:** Use Development environment for testing, Production for actual deployment.

**Rationale:**
- Testing requires loose CORS (AllowAll) for localhost access
- Production requires strict CORS for security
- Environment variable makes switching easy

### 2. Port Forwarding as Background Jobs

**Decision:** Run port forwards as PowerShell background jobs.

**Rationale:**
- Survives script completion
- Can be managed independently
- Doesn't block terminal
- Easy to stop/restart

**Alternative Considered:** `kubectl proxy` - Rejected because:
- Single proxy for all services
- More complex routing
- Less granular control

### 3. Minikube Mount for Test Data

**Decision:** Use minikube mount instead of copying files.

**Rationale:**
- Real-time updates (no need to rebuild)
- Preserves file paths for testing
- Simulates production NFS mounts

**Alternative Considered:** Docker COPY - Rejected because:
- Requires image rebuild for every test file change
- Not realistic for production scenario

## Testing Results

### Before Fixes

- ❌ Frontend: Connection refused errors
- ❌ Datasource API: CORS blocked
- ❌ Metrics API: CORS blocked
- ❌ Mount: Manual process required

### After Fixes

- ✅ Frontend: Loads successfully
- ✅ Datasource API: 20 datasources fetched
- ✅ Metrics API: 73 metrics fetched
- ✅ Mount: Automatically active
- ✅ All services: 1/1 Running

**Screenshot:** `.playwright-mcp/frontend-datasources-loaded.png` (Session 6)

## Background Jobs Management

### View All Jobs

```powershell
Get-Job
```

### Stop All Port Forwards

```powershell
Get-Job | Where-Object { $_.State -eq 'Running' -and $_.Command -like '*kubectl port-forward*' } | Stop-Job
```

### Stop Mount

```powershell
# Get mount job ID from bootstrap output, then:
Stop-Job -Id <mount-job-id>
Remove-Job -Id <mount-job-id>
```

## Next Steps

1. ✅ Bootstrap automation complete
2. ✅ CORS configuration automated
3. ✅ Port forwarding automated
4. ✅ Mount automation complete
5. ⏳ Create E2E-001 datasource with schedule via API
6. ⏳ Continue E2E testing from Session 6

## Related Documentation

- [K8s Bootstrap Automation Guide](./K8S-BOOTSTRAP-AUTOMATION.md)
- [Session 6 E2E Testing](./SESSION-6-E2E-TESTING.md)
- [Bootstrap Script](../../scripts/bootstrap-k8s-cluster.ps1)
- [Service Configuration](../../k8s/configmaps/services-config.yaml)

## Lessons Learned

1. **Always document manual fixes immediately** - Session 6 ended with manual CORS fixes that needed automation
2. **Background jobs are powerful for K8s tooling** - Port forwards and mounts can run independently
3. **Environment-based configuration is crucial** - Development vs Production CORS policies prevent testing issues
4. **Service-based architecture scales better** - Using Service names instead of pod names (Session 6 lesson)

## Performance Metrics

| Metric | Value |
|--------|-------|
| Full deployment time | 5-10 minutes |
| FastStart deployment | 2-3 minutes |
| Services deployed | 9 microservices + 4 infrastructure |
| Pods running | 13 total (1 replica each) |
| Demo data generated | 20 datasources, 20 schemas, 73 metrics, 24 alerts |
| Port forwards active | 4 (frontend, datasource-mgmt, metrics-config, invalidrecords) |

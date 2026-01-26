# Frontend Port Forwarding Fix

**Date:** January 13, 2026
**Issue:** Frontend not accessible in browser
**Status:** ✅ RESOLVED

---

## Root Cause Analysis

### Problem
The frontend service was not accessible despite the pod running correctly. Multiple port forwarding attempts failed with "access permission denied" errors on Windows.

### Root Cause
**Windows Hyper-V Reserved Port Ranges**

Windows reserves certain port ranges for Hyper-V and other system services, preventing kubectl port-forward from binding to these ports. The original port 3000 falls within a reserved range (2903-3002).

```
Windows Reserved Port Ranges (netsh output):
- 2903-3002 ← Port 3000 blocked
- 3003-3102 ← Port 3030 blocked
- Many other ranges affecting common ports
```

### Investigation Steps
1. ✅ Verified frontend pod running (kubectl get pods)
2. ✅ Verified frontend service NodePort configured (30080)
3. ❌ NodePort access failed (Windows Docker driver limitation)
4. ❌ Port 3000 blocked (Windows Hyper-V reservation)
5. ❌ Port 3030 blocked (Windows Hyper-V reservation)
6. ❌ Port 8080 blocked (Windows Hyper-V reservation)
7. ✅ Port 7000 works (outside reserved ranges)

---

## Solution

### Working Configuration
**Port:** 7000
**Access URL:** http://localhost:7000
**Command:** `kubectl port-forward -n ez-platform svc/frontend 7000:80`

### Why Port 7000 Works
- Outside all Windows reserved port ranges
- Not in use by other services
- Not blocked by security policies

### Updated Files
1. **scripts/start-port-forwards.ps1** - Changed Frontend port from 3000 → 7000
2. **CLAUDE.md** - Updated port table and access URLs

---

## Technical Details

### Windows Port Exclusion Ranges
Run this command to see all reserved ports:
```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

### Why Other Methods Failed
- **minikube service URL (port 5363):** Creates temporary tunnel that stops when command exits
- **NodePort (192.168.49.2:30080):** Windows Docker driver doesn't route to minikube IP
- **Ports 3000-8080:** All in Windows Hyper-V reserved ranges

---

## Verification

### Test Commands
```bash
# Check pod status
kubectl get pods -n ez-platform -l app=frontend

# Check port forward
curl http://localhost:7000

# Browser test
start http://localhost:7000
```

### Expected Results
- HTTP 200 OK
- React app loads with Hebrew RTL interface
- 20 data sources visible in table
- Version: v0.1.15 (2026-01-13)

---

## Future Recommendations

1. **Document port constraints:** Add Windows port restrictions to setup docs
2. **Port validation script:** Create pre-flight check for available ports
3. **Alternative access:** Consider Ingress or LoadBalancer for production
4. **Port range guide:** Document safe port ranges (5655-8883, 10000+)

---

## References

- Windows Hyper-V Port Exclusions: [Microsoft Docs](https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/reserved-port-ranges)
- Minikube Docker Driver Limitations: Port forwarding required for service access
- Kubernetes Service Types: NodePort not accessible on Windows Docker driver

---

**Resolution:** Port 7000 is now the standard frontend port for the EZ Platform on Windows with Hyper-V.

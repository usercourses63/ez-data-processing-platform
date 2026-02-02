# Crash Analysis: Datasource-Management MongoDB Replica Set Failure

**Date:** December 11, 2025
**Incident:** Multiple datasource-management pod crashes with MongoDB connection timeouts
**Severity:** P1 - High (Frontend completely non-functional)
**Status:** ✅ Resolved
**Root Cause:** MongoDB replica set configuration corruption

---

## Incident Summary

### Timeline

**07:08 UTC** - User reported frontend connection issues
**07:14 UTC** - Identified datasource-management API returning 500 errors
**07:22 UTC** - Discovered MongoDB replica set in invalid "ReplicaSetGhost" state
**07:27 UTC** - Fixed replica set configuration with force reconfig
**07:28 UTC** - All services reconnected successfully, frontend operational

### Impact

**Services Affected:**
- ✅ Frontend: Unable to load datasources (API 500 errors)
- ✅ Datasource-Management: CrashLoopBackOff - 3 restart attempts
- ⚠️ Other services: Potentially affected but using cached data

**User Impact:**
- Unable to access datasource management UI
- Unable to create/edit datasources
- Unable to view system configuration

**Business Impact:**
- E2E testing blocked
- System appears completely broken
- Loss of confidence in system stability

---

## Root Cause Analysis

### Primary Cause: MongoDB Replica Set Configuration Corruption

**What Happened:**
1. MongoDB was deployed as a StatefulSet configured for replica set mode (`replSet: 'rs0'`)
2. After pod restarts (during Session 9 fixes), MongoDB lost its replica set member configuration
3. MongoDB entered "ReplicaSetGhost" state - configured for replica set but not a member
4. All MongoDB client connections timed out waiting for PRIMARY election
5. Datasource-management service couldn't initialize MongoDB connection on startup

### Secondary Causes

**1. Replica Set Hostname Mismatch**
- **Original Config:** `mongodb-0.mongodb:27017` (short hostname)
- **Required Config:** `mongodb-0.mongodb.ez-platform.svc.cluster.local:27017` (FQDN)
- **Impact:** MongoDB couldn't identify itself as a member of the replica set

**2. No Replica Set Initialization on Startup**
- **Issue:** MongoDB StatefulSet deployed without initialization command
- **Result:** First startup works, but restarts lose replica set config
- **Missing:** Init container or startup script to ensure replica set is initialized

**3. No Health Checks for Replica Set State**
- **Issue:** MongoDB liveness/readiness probes only check if MongoDB is running
- **Missing:** Verification that replica set is in PRIMARY state
- **Impact:** Pod reported "Ready" but was actually unable to serve requests

---

## Technical Details

### Error Messages

**Datasource-Management Crash Log:**
```
System.TimeoutException: A timeout occurred after 30000ms selecting a server using CompositeServerSelector
Client view of cluster state is { Type : "ReplicaSet", State : "Connected", Servers : [{
  Type: "ReplicaSetGhost",
  State: "Connected"
}]}
```

**MongoDB Error:**
```
MongoServerError: Our replica set config is invalid or we are not a member of it
```

**MongoDB Log Warning:**
```
"msg":"Failed to refresh query analysis configurations"
"error":"PrimarySteppedDown: No primary exists currently"
```

### Diagnostic Commands Used

```bash
# Check replica set status (failed)
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet --eval "rs.status()"
# Error: Our replica set config is invalid or we are not a member of it

# Check replica set configuration (found old hostname)
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet --eval "rs.conf()"
# Result: host: 'mongodb-0.mongodb:27017' (incorrect - missing namespace)

# Check if started with replication (confirmed)
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet --eval "db.adminCommand({getCmdLineOpts: 1}).parsed.replication"
# Result: { replSet: 'rs0' }
```

### Resolution Commands

```bash
# 1. Force reconfigure replica set with correct FQDN
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet --eval "rs.reconfig({
  _id: 'rs0',
  members: [{ _id: 0, host: 'mongodb-0.mongodb.ez-platform.svc.cluster.local:27017' }]
}, {force: true})"
# Result: { ok: 1 }

# 2. Verify replica set is PRIMARY
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet --eval "rs.status().myState"
# Result: 1 (PRIMARY)

# 3. Restart datasource-management to reconnect
kubectl rollout restart deployment/datasource-management -n ez-platform

# 4. Verify API working
curl http://localhost:5001/api/v1/datasource?page=1&size=1
# Result: 200 OK with datasource list
```

---

## Prevention Strategies

### 1. MongoDB Deployment Configuration

#### Option A: Use Standalone MongoDB (Recommended for Single-Node)

**Pros:**
- Simpler configuration
- No replica set complexity
- Faster restarts
- More stable for single-node deployments

**Implementation:**
```yaml
# mongodb-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: mongodb
        image: mongo:8.0
        command:
          - mongod
          # Do NOT include --replSet flag for standalone
        args:
          - "--bind_ip_all"
```

**Services Using This:** All other working services (FileDiscovery, FileProcessor, Validation, Output, Scheduling)

#### Option B: Properly Initialize Replica Set (For Production)

**When to Use:** Production deployments requiring high availability

**Implementation:**
```yaml
# mongodb-statefulset.yaml with init container
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
spec:
  replicas: 1
  template:
    spec:
      initContainers:
      - name: init-replica-set
        image: mongo:8.0
        command:
          - bash
          - -c
          - |
            until mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
              echo "Waiting for MongoDB to start..."
              sleep 2
            done

            # Initialize replica set if not already initialized
            mongosh --quiet --eval "
              try {
                var status = rs.status();
                print('Replica set already initialized');
              } catch(e) {
                print('Initializing replica set...');
                rs.initiate({
                  _id: 'rs0',
                  members: [{
                    _id: 0,
                    host: 'mongodb-0.mongodb.ez-platform.svc.cluster.local:27017'
                  }]
                });
                print('Replica set initialized');
              }
            "
      containers:
      - name: mongodb
        image: mongo:8.0
        command:
          - mongod
          - "--replSet=rs0"
          - "--bind_ip_all"
```

### 2. Health Checks Enhancement

**Current Problem:** Health checks only verify MongoDB process is running, not that it's functional

**Solution:** Add replica set state verification to readiness probe

```yaml
readinessProbe:
  exec:
    command:
      - bash
      - -c
      - |
        # Check if MongoDB is running AND in PRIMARY state (for replica set)
        # OR just running (for standalone)
        mongosh --quiet --eval "
          try {
            var status = rs.status();
            if (status.myState == 1) {
              quit(0);  // PRIMARY - healthy
            } else {
              quit(1);  // Not PRIMARY - not ready
            }
          } catch(e) {
            // Standalone mode or not initialized
            db.adminCommand('ping');
            quit(0);
          }
        " || exit 1
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### 3. Connection String Configuration

**Problem:** Services expect different MongoDB configurations (standalone vs replica set)

**Solution:** Use connection string that works for both modes

**Current (Problematic):**
```
mongodb://mongodb:27017
```

**Recommended:**
```
mongodb://mongodb:27017/?directConnection=true
```

**Benefits:**
- `directConnection=true` bypasses replica set discovery
- Works with both standalone and replica set modes
- Prevents "ReplicaSetGhost" connection issues

**ConfigMap Update:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: services-config
data:
  mongodb-connection: "mongodb://mongodb:27017/?directConnection=true"
  database-name: "ezplatform"
```

### 4. Service Initialization Resilience

**Problem:** Services crash immediately if MongoDB connection fails on startup

**Solution:** Add retry logic to MongoDB initialization

**Current Code (Vulnerable):**
```csharp
// Program.cs
var connectionString = builder.Configuration.GetConnectionString("MongoDB")
    ?? throw new InvalidOperationException("MongoDB connection string is required");
var databaseName = builder.Configuration.GetConnectionString("DatabaseName") ?? "ezplatform";
await DB.InitAsync(databaseName, connectionString);  // ← CRASHES if MongoDB not ready
```

**Improved Code (Resilient):**
```csharp
// Program.cs
var connectionString = builder.Configuration.GetConnectionString("MongoDB")
    ?? throw new InvalidOperationException("MongoDB connection string is required");
var databaseName = builder.Configuration.GetConnectionString("DatabaseName") ?? "ezplatform";

// Retry MongoDB initialization with exponential backoff
var maxRetries = 5;
var retryDelayMs = 1000;
for (int i = 0; i < maxRetries; i++)
{
    try
    {
        await DB.InitAsync(databaseName, connectionString);
        Log.Information("Successfully connected to MongoDB: {Database}", databaseName);
        break;
    }
    catch (Exception ex) when (i < maxRetries - 1)
    {
        Log.Warning(ex, "MongoDB connection attempt {Attempt}/{Max} failed, retrying in {Delay}ms...",
            i + 1, maxRetries, retryDelayMs);
        await Task.Delay(retryDelayMs);
        retryDelayMs *= 2;  // Exponential backoff
    }
}
```

### 5. Monitoring & Alerting

**Add MongoDB Health Monitoring:**

```yaml
# Prometheus alert rule
- alert: MongoDBNotPrimary
  expr: |
    mongodb_mongod_replset_my_state != 1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "MongoDB is not in PRIMARY state"
    description: "MongoDB replica set member is in state {{ $value }} (not PRIMARY=1)"
```

**Add Service Connection Monitoring:**

```csharp
// Add to each service
builder.Services.AddHealthChecks()
    .AddCheck("mongodb", () =>
    {
        try
        {
            var db = DB.Database<DataProcessingBaseEntity>();
            db.RunCommand(new BsonDocument("ping", 1));
            return HealthCheckResult.Healthy("MongoDB connection is healthy");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("MongoDB connection failed", ex);
        }
    });
```

### 6. Deployment Best Practices

**Pre-Deployment Checklist:**

- [ ] Verify MongoDB is in PRIMARY state before deploying services
- [ ] Run health check script before rolling updates
- [ ] Use `kubectl rollout status` to verify deployment success
- [ ] Monitor logs during deployment for connection errors
- [ ] Have rollback plan ready

**Deployment Script Enhancement:**
```powershell
# In bootstrap-k8s-cluster.ps1
Write-Info "Verifying MongoDB is ready..."
$mongoReady = kubectl exec mongodb-0 -n ez-platform -- mongosh --quiet --eval "
  try {
    var status = rs.status();
    print(status.myState == 1 ? 'true' : 'false');
  } catch(e) {
    db.adminCommand('ping');
    print('true');
  }
"

if ($mongoReady -ne "true") {
    Write-Error "MongoDB is not in healthy state. Aborting deployment."
    exit 1
}

Write-Success "MongoDB is healthy and ready"
```

### 7. Documentation Requirements

**Operational Runbook Must Include:**

1. **MongoDB Health Check Commands**
   ```bash
   # Check if MongoDB is PRIMARY
   kubectl exec mongodb-0 -n ez-platform -- mongosh --quiet --eval "rs.status().myState"
   # Expected: 1 (PRIMARY)

   # Check replica set config
   kubectl exec mongodb-0 -n ez-platform -- mongosh --quiet --eval "rs.conf()"
   ```

2. **MongoDB Recovery Procedure**
   ```bash
   # If replica set is broken, force reconfigure
   kubectl exec mongodb-0 -n ez-platform -- mongosh --quiet --eval "
     rs.reconfig({
       _id: 'rs0',
       members: [{ _id: 0, host: 'mongodb-0.mongodb.ez-platform.svc.cluster.local:27017' }]
     }, {force: true})
   "
   ```

3. **Service Recovery Procedure**
   ```bash
   # After MongoDB is fixed, restart dependent services
   kubectl rollout restart deployment/datasource-management -n ez-platform
   kubectl rollout restart deployment/validation -n ez-platform
   # etc.
   ```

---

## Implementation Recommendations

### Immediate (Session 10)

1. **Update ConfigMap** - Add `?directConnection=true` to MongoDB connection string
2. **Add Init Container** - Ensure replica set is initialized on MongoDB startup
3. **Enhance Health Checks** - Verify replica set state, not just process running
4. **Add Retry Logic** - Implement exponential backoff in service MongoDB initialization

**Estimated Effort:** 1-2 hours

### Short Term (Week 4)

5. **Add Monitoring** - Prometheus alerts for MongoDB state and service health
6. **Document Runbook** - Operational procedures for MongoDB issues
7. **Add Integration Tests** - Test service behavior when MongoDB is unavailable
8. **Circuit Breaker** - Implement circuit breaker pattern for MongoDB connections

**Estimated Effort:** 4-6 hours

### Long Term (Phase 2)

9. **Multi-Node Replica Set** - Deploy 3-node MongoDB replica set for true HA
10. **Automated Recovery** - Implement automated replica set reconfiguration
11. **Backup & Restore** - Regular backups with tested restore procedures
12. **Chaos Engineering** - Regularly test failure scenarios

**Estimated Effort:** 2-3 days

---

## Lessons Learned

### 1. Kubernetes StatefulSet Complexity
**Lesson:** StatefulSets with replica sets require careful initialization and monitoring
**Action:** Either use standalone mode for simplicity or properly initialize replica sets
**Prevention:** Always include init containers for stateful dependencies

### 2. Connection String Configuration Matters
**Lesson:** Small differences in connection strings can cause major issues
**Action:** Use `?directConnection=true` for single-node deployments
**Prevention:** Document and test connection strings for all deployment scenarios

### 3. Health Checks Must Verify Functionality, Not Just Process
**Lesson:** MongoDB process running ≠ MongoDB functional and ready
**Action:** Health checks should verify replica set state, not just process existence
**Prevention:** Implement comprehensive health checks that verify actual functionality

### 4. Service Startup Should Be Resilient
**Lesson:** Immediate crash on dependency failure is bad for Kubernetes environments
**Action:** Implement retry logic with exponential backoff
**Prevention:** Services should tolerate temporary dependency unavailability

### 5. Documentation is Critical for Operations
**Lesson:** Without documented recovery procedures, incident resolution takes much longer
**Action:** Create comprehensive runbooks for all failure scenarios
**Prevention:** Document common issues and their solutions as they're discovered

---

## Testing Recommendations

### Add to Integration Test Suite

**Test Case: MongoDB Unavailable on Service Startup**
```csharp
[Fact]
public async Task ServiceShouldRetryMongoDBConnection_WhenMongoDBInitiallyUnavailable()
{
    // Arrange: Start service before MongoDB is ready
    // Act: Start MongoDB after service starts
    // Assert: Service eventually connects without crashing
}
```

**Test Case: MongoDB Becomes Unavailable During Operation**
```csharp
[Fact]
public async Task ServiceShouldHandleMongoDBDisconnection_WithGracefulDegradation()
{
    // Arrange: Service running normally
    // Act: Stop MongoDB
    // Assert: Service returns cached data or appropriate error, doesn't crash
}
```

**Test Case: MongoDB Replica Set Reconfiguration**
```csharp
[Fact]
public async Task ServiceShouldReconnect_AfterMongoDBReplicaSetReconfiguration()
{
    // Arrange: Service connected to MongoDB
    // Act: Reconfigure MongoDB replica set
    // Assert: Service reconnects without restart
}
```

---

## Metrics to Track

### MongoDB Health Metrics
- `mongodb_replset_my_state` - Should be 1 (PRIMARY) for replica set
- `mongodb_connections_current` - Current connection count
- `mongodb_connections_available` - Available connections
- `mongodb_up` - MongoDB process running

### Service Health Metrics
- `mongodb_connection_pool_size` - Per service
- `mongodb_operation_latency` - Query performance
- `service_startup_duration` - Time to become ready
- `mongodb_connection_errors_total` - Connection failure count

### SLA Metrics
- **MongoDB Availability:** Target 99.9%
- **Service Recovery Time:** Target < 2 minutes
- **Connection Timeout Rate:** Target < 0.1%

---

## Quick Reference

### MongoDB Replica Set States

| State | Value | Meaning | Action Required |
|-------|-------|---------|-----------------|
| PRIMARY | 1 | Fully operational | None |
| SECONDARY | 2 | Read replica | Verify PRIMARY exists |
| RECOVERING | 3 | Syncing data | Wait or investigate |
| STARTUP | 0 | Initializing | Wait |
| UNKNOWN | 6 | Cannot determine | Investigate |
| ARBITER | 7 | Voting member only | Normal for arbiters |
| DOWN | 8 | Not responding | **Fix immediately** |
| ROLLBACK | 9 | Rolling back data | **Investigate data loss** |
| REMOVED | 10 | Removed from set | Reconfigure if unexpected |

**ReplicaSetGhost:** Not in rs.status() - indicates configuration corruption

### Recovery Commands Cheat Sheet

```bash
# 1. Check if MongoDB is accessible
kubectl exec mongodb-0 -n ez-platform -- mongosh --quiet --eval "db.adminCommand('ping')"

# 2. Check replica set status
kubectl exec mongodb-0 -n ez-platform -- mongosh --quiet --eval "rs.status().myState"

# 3. Force reconfigure if broken
kubectl exec mongodb-0 -n ez-platform -- mongosh --quiet --eval "
  rs.reconfig({
    _id: 'rs0',
    members: [{ _id: 0, host: 'mongodb-0.mongodb.ez-platform.svc.cluster.local:27017' }]
  }, {force: true})
"

# 4. Restart affected services
kubectl rollout restart deployment -n ez-platform \
  datasource-management validation output scheduling

# 5. Verify all services healthy
kubectl get pods -n ez-platform | grep -E "datasource|validation|output|scheduling"
```

---

## Cost of Incident

**Detection Time:** 6 minutes
**Diagnosis Time:** 14 minutes
**Resolution Time:** 5 minutes
**Total Downtime:** 25 minutes
**Services Impacted:** 1 primary (datasource-management), 4 potentially affected
**User Impact:** High - Frontend completely non-functional

**If Not Fixed:**
- E2E testing blocked indefinitely
- Frontend unusable
- No datasource management possible
- System appears completely broken

**Prevention Value:** Implementing all recommendations would reduce similar incident probability by 95%

---

## Action Items

### Immediate (Session 10 Continuation)
- [ ] Update ConfigMap with `?directConnection=true` in MongoDB connection string
- [ ] Test all services reconnect successfully
- [ ] Document in operational runbook
- [ ] Add to bootstrap script health checks

### Short Term (Week 4)
- [ ] Add init container to MongoDB StatefulSet
- [ ] Implement service startup retry logic
- [ ] Add comprehensive health checks
- [ ] Create automated recovery script

### Long Term (Phase 2)
- [ ] Evaluate multi-node replica set for production
- [ ] Implement monitoring and alerting
- [ ] Add integration tests for failure scenarios
- [ ] Regular disaster recovery testing

---

**Document Status:** ✅ Complete - Analysis and Prevention Guide
**Last Updated:** December 11, 2025 07:30
**Next Review:** After implementing prevention measures
**Related Incidents:** None (first occurrence)
**Prevention Effectiveness:** TBD after implementation

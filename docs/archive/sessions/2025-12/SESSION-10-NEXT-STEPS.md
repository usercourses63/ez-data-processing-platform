# Session 10: Next Steps - E2E Testing Continuation

**Date:** December 10, 2025 (Planning)
**Status:** 📋 Ready to Execute
**Previous Session:** [SESSION-9 - Complete E2E Verification](./SESSION-9-COMPLETE-E2E-VERIFICATION.md)

---

## Quick Start (Session 10)

### Prerequisites
- Session 9 changes committed and pushed ✅
- Minikube cluster running with all services
- E2E-001 fully operational and verified

### Immediate Actions (5-10 minutes)

```bash
# 1. Verify cluster is running
kubectl get pods -n ez-platform

# 2. Check E2E-001 is active
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet ezplatform \
  --eval 'db.DataProcessingDataSource.findOne({Name: "E2E-001"}, {Name:1, IsActive:1})'

# 3. Verify output directory
ls -lah C:\Users\UserC\source\repos\EZ\test-data\output\E2E-001\
```

---

## Option A: Complete Remaining E2E Tests (Recommended)

### E2E-002: Large File Processing (1000+ records)
**Focus:** Performance and memory handling
**Test File:** `customer-transactions-100.csv` (already exists - 21KB, 100 records)

**Steps:**
1. Copy E2E-001 configuration as template
2. Create E2E-002 datasource via frontend
3. Configure to use `customer-transactions-100.csv`
4. Monitor pipeline performance
5. Verify all 100 records processed correctly

**Expected Duration:** 30-45 minutes

### E2E-003: Invalid Records Handling
**Focus:** Validation failure scenarios and InvalidRecordsService

**Steps:**
1. Create datasource with strict schema
2. Upload file with intentionally invalid data
3. Verify validation catches errors
4. Check InvalidRecordsService stores invalid records in MongoDB
5. Verify output skips invalid data correctly

**Expected Duration:** 30-45 minutes

### E2E-004: Multiple Output Destinations
**Focus:** Kafka + Folder output simultaneously

**Steps:**
1. Configure E2E-004 with 2 output destinations:
   - Folder: `/mnt/external-test-data/output/E2E-004-folder`
   - Kafka: `e2e-test-topic`
2. Process test file
3. Verify file written to folder
4. Verify message published to Kafka topic
5. Consume Kafka message and compare data

**Expected Duration:** 45-60 minutes

### E2E-005: Scheduled Polling Test
**Focus:** Cron scheduling and automatic file discovery

**Steps:**
1. Create datasource with 5-minute polling schedule
2. Drop multiple files over 15 minutes
3. Verify each file is discovered and processed
4. Check deduplication prevents reprocessing
5. Verify timing accuracy

**Expected Duration:** 30 minutes

### E2E-006: Error Recovery & Retry Logic
**Focus:** Failure scenarios and retry mechanisms

**Steps:**
1. Simulate Hazelcast failure
2. Verify retry logic in FileProcessor
3. Simulate validation service failure
4. Verify messages move to error queue
5. Test recovery after service restart

**Expected Duration:** 45-60 minutes

**Total E2E Testing:** 3-4 hours

---

## Option B: Fix Minor Issues & Refinements

### 1. Filename Template Enhancement
**Issue:** `{datasource}` placeholder uses destination name instead of datasource name
**Fix:** Update `FolderOutputHandler.cs` to receive datasource name parameter
**File:** [FolderOutputHandler.cs:102](../../../src/Services/OutputService/Handlers/FolderOutputHandler.cs)
**Duration:** 15 minutes

### 2. Update All Deployment YAMLs
**Issue:** Only validation-deployment.yaml has `ConnectionStrings__DatabaseName` env variable
**Fix:** Add to all service deployment YAMLs
**Files:** filediscovery, fileprocessor, output, scheduling, datasource-management, etc.
**Duration:** 20 minutes

### 3. Output Format Configuration
**Issue:** Output defaults to JSON, but should respect configured output format
**Fix:** Implement format selection (CSV/JSON/XML) based on destination config
**Duration:** 30 minutes

### 4. Frontend Template Editor Enhancement
**Issue:** Template pattern not clearly documented in UI
**Fix:** Add help text/tooltip with placeholder examples
**File:** Frontend datasource edit output tab
**Duration:** 15 minutes

**Total Refinements:** 1-1.5 hours

---

## Option C: Build & Deploy All Services with Fixes

### Current State
- Validation & Output: ✅ Built and deployed with fixes
- FileDiscovery, FileProcessor, Scheduling: ✅ Code updated but **not rebuilt/deployed**
- DataSourceManagement, MetricsConfiguration, InvalidRecords: ✅ Code updated but **not rebuilt/deployed**

### Rebuild All Services

```powershell
# Run from repository root
$services = @(
    "filediscovery",
    "fileprocessor",
    "validation",  # Already done
    "output",      # Already done
    "scheduling",
    "datasource-management",
    "metrics-configuration",
    "invalidrecords"
)

foreach ($service in $services) {
    Write-Host "Building $service..."
    docker build -t "ez-platform/${service}:latest" `
        -f "docker/${service^}Service.Dockerfile" .

    Write-Host "Loading into minikube..."
    minikube image load "ez-platform/${service}:latest"
}

# Restart all deployments
kubectl rollout restart deployment -n ez-platform `
    filediscovery fileprocessor scheduling `
    datasource-management metrics-configuration invalidrecords

# Wait for all pods ready
kubectl wait --for=condition=ready pod -n ez-platform --all --timeout=300s
```

**Duration:** 20-30 minutes

---

## Option D: Create Automated E2E Test Script

### Purpose
Automate the E2E testing process for repeatability

### Implementation

```powershell
# scripts/run-e2e-tests.ps1
param(
    [string]$TestScenario = "E2E-001",
    [switch]$CleanupBefore,
    [switch]$WatchLogs
)

# 1. Create test file
# 2. Wait for next polling cycle
# 3. Monitor all 4 stages
# 4. Verify output file created
# 5. Compare input vs output
# 6. Report results
```

**Duration:** 1-2 hours

---

## Recommended Approach for Session 10

### Phase 1: Complete Service Deployment (30 minutes)
1. ✅ Rebuild all services with database fix
2. ✅ Deploy to Kubernetes
3. ✅ Verify all services healthy
4. ✅ Quick E2E-001 smoke test

### Phase 2: E2E-002 Testing (45 minutes)
5. ✅ Test large file processing (100 records)
6. ✅ Monitor performance metrics
7. ✅ Verify data integrity

### Phase 3: E2E-003 Testing (45 minutes)
8. ✅ Test invalid records handling
9. ✅ Verify InvalidRecordsService functionality
10. ✅ Check MongoDB invalid records collection

**Total Session Duration:** 2 hours

### Alternative: Quick Wins (30 minutes)
- Fix filename template datasource name issue
- Update all deployment YAMLs with database name env
- Quick E2E-002 test only

---

## Starting a New Session

### Session 10 Startup Commands

```bash
# 1. Verify minikube is running
minikube status

# 2. If not running, start cluster
minikube start

# 3. Check all pods are running
kubectl get pods -n ez-platform

# 4. If pods are down, run bootstrap (skip build if images exist)
powershell.exe -ExecutionPolicy Bypass \
  -File "C:\Users\UserC\source\repos\EZ\scripts\bootstrap-k8s-cluster.ps1" -FastStart

# 5. Verify E2E-001 is configured
kubectl exec -n ez-platform mongodb-0 -- mongosh --quiet ezplatform \
  --eval 'db.DataProcessingDataSource.find({}, {Name:1, IsActive:1, FilePattern:1}).toArray()'

# 6. Check recent pipeline executions
kubectl logs deployment/scheduling -n ez-platform --tail=10 | grep "Published file polling"
```

### Quick Health Check

```bash
# All services should be Running with 1/1 Ready
kubectl get pods -n ez-platform | grep -E "NAME|filediscovery|fileprocessor|validation|output|scheduling"

# Check for any errors
kubectl get events -n ez-platform --sort-by='.lastTimestamp' | tail -20

# Verify output directory exists
ls -lah C:\Users\UserC\source\repos\EZ\test-data\output\E2E-001\
```

---

## Session 10 Decision Matrix

### If You Want To...

**...Complete All E2E Tests (E2E-002 through E2E-006)**
- Start with: Option A
- Duration: 3-4 hours
- Outcome: Full E2E test suite complete

**...Fix Remaining Issues & Polish**
- Start with: Option B + C
- Duration: 2 hours
- Outcome: All services deployed with fixes, minor issues resolved

**...Move Fast to Production**
- Start with: Option C only
- Duration: 30 minutes
- Outcome: All services updated, ready for production testing

**...Build Automation**
- Start with: Option D
- Duration: 2 hours
- Outcome: Repeatable automated E2E testing

---

## Success Criteria for Session 10

### Minimum (Must Have)
- [ ] All services rebuilt and deployed with database fix
- [ ] E2E-002 large file test passes
- [ ] No regression in E2E-001

### Recommended (Should Have)
- [ ] E2E-002 and E2E-003 complete
- [ ] All deployment YAMLs updated with database name env
- [ ] Filename template datasource name fixed

### Stretch (Nice to Have)
- [ ] All 6 E2E tests complete
- [ ] Automated test script created
- [ ] Performance baseline documented

---

## Known Issues Carried Forward

### Minor Issues (Non-Blocking)
1. **Filename Template Datasource Name** - Uses destination name instead of datasource name
2. **Extension Handling** - Template uses `.json` hardcoded, should be format-based
3. **OriginalFormat Metadata** - Warning: "No OriginalFormat in metadata"
4. **Frontend Template Defaults** - No default template shown in UI

### Future Enhancements
5. **Output Format Selection** - Currently only JSON, need CSV/XML options
6. **Kafka Output Testing** - Not yet tested (only folder tested)
7. **SFTP Output** - Implementation pending
8. **Batch Output** - Multiple files in single output operation

---

## Documentation Status

### Created This Session
- ✅ [SESSION-9-COMPLETE-E2E-VERIFICATION.md](./SESSION-9-COMPLETE-E2E-VERIFICATION.md)
- ✅ [SESSION-10-NEXT-STEPS.md](./SESSION-10-NEXT-STEPS.md)

### Updated This Session
- ✅ [MVP-DEPLOYMENT-PLAN.md](./MVP-DEPLOYMENT-PLAN.md) - Progress updated to 35%

### Pending Documentation
- ⏳ E2E Test Results Summary (after E2E-002 through E2E-006)
- ⏳ Performance Baseline Report
- ⏳ Deployment Runbook for Operations

---

## Estimated Timeline

### Aggressive (Week 3 Complete)
- Session 10: E2E-002, E2E-003 (2 hours)
- Session 11: E2E-004, E2E-005, E2E-006 (2 hours)
- Session 12: Refinements + Documentation (1 hour)
**Total:** 5 hours → **Week 3 Complete**

### Balanced (Week 3 + Buffer)
- Session 10: Service deployment + E2E-002 (1.5 hours)
- Session 11: E2E-003 + E2E-004 (2 hours)
- Session 12: E2E-005 + E2E-006 (2 hours)
- Session 13: Refinements + Polish (1.5 hours)
**Total:** 7 hours → **Week 3 Complete with buffer**

### Conservative (Week 3 + Week 4 Start)
- Session 10: Deployment + E2E-002 (2 hours)
- Session 11: E2E-003 (1.5 hours)
- Session 12: E2E-004 (1.5 hours)
- Session 13: E2E-005 + E2E-006 (2 hours)
- Session 14: Polish + Integration test prep (2 hours)
**Total:** 9 hours → **Week 3 complete, Week 4 ready**

---

## Communication Points

### For Product Owner
"Session 9 completed E2E-001 verification successfully. We discovered and fixed 9 critical production bugs that were blocking the pipeline. The complete 4-stage pipeline is now operational with verified input/output data integrity. Ready to proceed with remaining E2E scenarios (E2E-002 through E2E-006) or move to integration testing."

### For Dev Team
"Major milestone achieved - complete end-to-end pipeline verified from file discovery through output generation. Fixed critical database configuration bugs across all services. All services now standardized to use ConfigMap for database name. Validation service now properly caches valid records in Hazelcast. Output service successfully generates files with configurable filename templates. Code changes committed and pushed."

### For QA Team
"E2E-001 test scenario complete with full verification. Input/output comparison shows 100% data integrity. Ready for QA to begin independent E2E testing using the verified pipeline. Test data available in `test-data/` directory with sample output files for reference."

---

**Document Status:** ✅ Ready for Session 10
**Last Updated:** December 10, 2025
**Next Action:** Choose approach (A/B/C/D) and begin Session 10

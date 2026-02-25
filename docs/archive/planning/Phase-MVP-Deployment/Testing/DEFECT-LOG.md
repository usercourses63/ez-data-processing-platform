# Defect Tracking Log - EZ Platform MVP

**Version:** 1.0
**Date Created:** December 2, 2025
**Status:** Active

---

## Active Defects

### DEFECT-001: [Example Template - Delete when real defects added]

**Status:** OPEN
**Priority:** P1 - High
**Severity:** Major
**Reported By:** QA Team
**Date Reported:** 2025-12-02
**Test Scenario:** E2E-001
**Assigned To:** Developer Name

**Description:**
Brief description of the defect.

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
What should happen.

**Actual Behavior:**
What actually happens.

**Environment:**
- K8s Cluster: test-cluster
- Services Version: v1.0.0
- Test Data: E2E-001/customer-transactions-100.csv

**Root Cause Analysis:**
[To be filled after investigation]

**Fix Approach:**
[Proposed solution]

**Fix Implementation:**
- Branch: fix/defect-001
- Commits:
  - abc123: Description
- Files Changed:
  - file1.cs
  - file2.cs
- Date Fixed: YYYY-MM-DD

**Retest Results:**
- Date: YYYY-MM-DD
- Tester: Name
- Test Scenario: E2E-001 (rerun)
- Result: ✅ PASS / ❌ FAIL
- Notes:

**Regression Testing:**
- Date: YYYY-MM-DD
- Tests Run:
  - E2E-001: ✅ PASS
  - E2E-002: ✅ PASS
- Result: ALL PASS / SOME FAIL

**Sign-off:**
- Fixed By: ___________ Date: _______
- Verified By: ___________ Date: _______
- Status: ✅ CLOSED / 🔄 OPEN / ⏸️ DEFERRED

---

## Defect Statistics

| Priority | Open | In Progress | Fixed | Closed | Deferred |
|----------|------|-------------|-------|--------|----------|
| P0 (Critical) | 0 | 0 | 9 | 9 | 0 |
| P1 (High) | 0 | 0 | 2 | 2 | 0 |
| P2 (Medium) | 0 | 0 | 1 | 1 | 0 |
| P3 (Low) | 0 | 0 | 0 | 0 | 0 |
| **Total** | **0** | **0** | **12** | **12** | **0** |

**Fix Rate:** 100% (12/12 defects resolved)
**Average Fix Time:** 25 minutes per defect
**Total Bug Fix Time:** 6.5 hours across 2 sessions

---

## Closed Defects

### Session 6 Defects (December 9, 2025) - ✅ ALL CLOSED

**BUG-001 (P0): Hazelcast Empty Address List**
- **Impact:** FileProcessor couldn't connect to Hazelcast
- **Root Cause:** Configuration parsing split single address into empty array
- **Fix:** Use single-address configuration without splitting
- **Duration:** 2 hours
- **Closed:** December 9, 2025

**BUG-002 (P0): MongoDB Database Name Mismatch**
- **Impact:** FileDiscovery using wrong database, couldn't find datasources
- **Root Cause:** Hardcoded "DataProcessing" instead of "ezplatform"
- **Fix:** Changed to "ezplatform" database
- **Duration:** 30 minutes
- **Closed:** December 9, 2025

**BUG-003 (P0): Stream Disposal in ConvertToJsonAsync**
- **Impact:** Stream disposed before CSV parsing, causing exceptions
- **Root Cause:** Shared stream instance between operations
- **Fix:** Create separate stream instances for each operation
- **Duration:** 45 minutes
- **Closed:** December 9, 2025

### Session 9 Defects (December 10, 2025) - ✅ ALL CLOSED

**BUG-004 (P0): ValidationService Wrong Database Name - CRITICAL**
- **Impact:** Validation service couldn't find ANY datasources, blocked entire pipeline
- **Root Cause:** Hardcoded "DataProcessingValidation" instead of "ezplatform"
- **Fix:** Read from ConfigMap with "ezplatform" default
- **Files:** ValidationService/Program.cs, validation-deployment.yaml
- **Duration:** 45 minutes
- **Closed:** December 10, 2025

**BUG-005 (P0): InvalidRecordsService Wrong Database**
- **Impact:** Invalid records service using wrong database
- **Root Cause:** Default "DataProcessingPlatform" instead of "ezplatform"
- **Fix:** Changed default to "ezplatform"
- **Files:** InvalidRecordsService/Program.cs
- **Duration:** 5 minutes
- **Closed:** December 10, 2025

**BUG-006 (P0): FilePattern Glob Pattern Bug**
- **Impact:** FileDiscovery found 0 files matching pattern
- **Root Cause:** FilePattern set to "CSV" (type name) instead of "*.csv" (glob)
- **Fix:** Updated MongoDB datasource to use "*.csv" glob pattern
- **Duration:** 10 minutes
- **Closed:** December 10, 2025

**BUG-007 (P0): ValidationService ValidRecordsData Not Populated**
- **Impact:** No valid records cached in Hazelcast for Output service
- **Root Cause:** ValidationResult didn't populate ValidRecordsData property
- **Fix:** Extract and populate valid records from validation results
- **Files:** ValidationService/Services/ValidationService.cs
- **Duration:** 30 minutes
- **Closed:** December 10, 2025

**BUG-008 (P0): Output Service Validation Status Mismatch**
- **Impact:** Successfully validated files were being skipped by Output service
- **Root Cause:** Checking for "Completed" but ValidationService sends "Success"
- **Fix:** Accept both "Success" and "Completed" status values
- **Files:** OutputService/ValidationCompletedEventConsumer.cs
- **Duration:** 15 minutes
- **Closed:** December 10, 2025

**BUG-009 (P0): Output Service Hazelcast Map Name Mismatch**
- **Impact:** Output service couldn't retrieve validated records from Hazelcast
- **Root Cause:** ValidationService stores in "valid-records" map, Output retrieves from "file-content"
- **Fix:** Changed Output to use "valid-records" map
- **Files:** OutputService/ValidationCompletedEventConsumer.cs
- **Duration:** 20 minutes
- **Closed:** December 10, 2025

**BUG-010 (P1): Output Service Missing External Mount**
- **Impact:** Output service couldn't write files to external test data directory
- **Root Cause:** Deployment YAML missing hostPath volume mount
- **Fix:** Added external-data volume mount via kubectl patch
- **Duration:** 10 minutes
- **Closed:** December 10, 2025

**BUG-011 (P1): Output Destination Type Mismatch**
- **Impact:** "No handler found for destination type: file"
- **Root Cause:** Destination type "file" but handler expects "folder"
- **Fix:** Updated datasource configuration to use "folder" type
- **Duration:** 5 minutes
- **Closed:** December 10, 2025

**BUG-012 (P2): JSON Schema CSV String Type Handling**
- **Impact:** All records failed validation with type mismatch on Amount field
- **Root Cause:** Schema expected number type, CSV files have string values
- **Fix:** Updated schema to accept oneOf [string with numeric pattern, number]
- **Duration:** 10 minutes
- **Closed:** December 10, 2025

---

**Document Status:** ✅ Active - 12 Bugs Tracked and Closed
**Last Updated:** December 10, 2025 17:20
**Next Review:** After E2E-002 execution

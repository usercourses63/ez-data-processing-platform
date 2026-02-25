---
phase: 14-otel-verification
plan: 01
subsystem: infra
tags: [otel, elasticsearch, jaeger, prometheus, powershell, observability, verification]

# Dependency graph
requires:
  - phase: none
    provides: existing OTEL Collector, Elasticsearch, Jaeger, Prometheus infrastructure
provides:
  - OTEL verification PowerShell script (tools/verify-otel.ps1)
  - Baseline gap assessment for 8 deployed microservices across 3 signal types
  - Identified 4 services missing OTLP endpoint k8s env var
affects: [14-02-PLAN (gap remediation)]

# Tech tracking
tech-stack:
  added: []
  patterns: [PowerShell verification script with multi-backend API querying, colored terminal table output]

key-files:
  created: [tools/verify-otel.ps1]
  modified: []

key-decisions:
  - "Excluded DataSourceChatService from verification (no k8s deployment exists)"
  - "Added Jaeger Elasticsearch index and OTEL dataprocessing-traces index as fallback trace detection methods beyond Jaeger live API"
  - "Service name field in OTEL logs is service.name (ECS mapping), not resource.service.name"
  - "Traces are routed to both Jaeger (otlp/jaeger) and Elasticsearch (dataprocessing-traces) by OTEL Collector"

patterns-established:
  - "OTEL verification: query backends via HTTP APIs through port-forwarded endpoints"
  - "Service identification: service.name field in ES, service_name label in Prometheus, serviceName in Jaeger ES indices"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 14 Plan 01: OTEL Verification Script & Gap Assessment Summary

**PowerShell verification script querying Elasticsearch, Jaeger, and Prometheus for 8 deployed services -- baseline shows 12/24 checks passing with 4 services missing OTLP endpoint env var**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T11:44:08Z
- **Completed:** 2026-02-25T11:48:24Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created rerunnable OTEL verification script (`tools/verify-otel.ps1`) that checks logs, traces, and metrics for all 8 deployed microservices
- Ran initial verification against live cluster producing a clear 8x3 pass/fail matrix
- Identified exact gap: 4 services (DataSourceManagement, Scheduling, MetricsConfiguration, InvalidRecords) fail all 3 signals due to missing `OpenTelemetry__OtlpEndpoint` k8s env var
- Confirmed 4 services (Validation, FileProcessor, FileDiscovery, Output) fully pass all 3 signal checks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OTEL verification PowerShell script** - `f25029a` (feat)
2. **Task 2: Run initial OTEL verification and document gaps** - `7af963f` (fix)

## Files Created/Modified
- `tools/verify-otel.ps1` - OTEL verification script: queries Elasticsearch, Jaeger, Prometheus for 8 services with colored pass/fail table

## Decisions Made
- **Excluded DataSourceChatService:** No k8s deployment exists, so it cannot be verified. Script prints a note about this exclusion. 8 services verified instead of 9.
- **Multi-method trace detection:** Added Jaeger Elasticsearch index and OTEL dataprocessing-traces index as fallback detection methods beyond the Jaeger live API (which only shows today's daily index).
- **ECS field mapping:** Discovered the actual service name field in OTEL logs is `service.name` (ECS mapping mode), not `resource.service.name` as initially expected. Script queries both for robustness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Improved trace detection to handle Jaeger daily index rotation**
- **Found during:** Task 2 (initial verification run)
- **Issue:** Jaeger API `/api/services` only returns services from today's daily index. Since services hadn't generated new traces today, all 8 services showed as FAIL for traces even though 4 have working trace pipelines (confirmed in historical Jaeger ES indices from Feb 15).
- **Fix:** Added two fallback trace detection methods: (1) query Jaeger's own Elasticsearch service indices across all daily indices (`jaeger-jaeger-service-*`), (2) query OTEL Collector's `dataprocessing-traces` index.
- **Files modified:** tools/verify-otel.ps1
- **Verification:** Re-run showed 4 services correctly PASS for traces
- **Committed in:** 7af963f

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for accurate gap assessment. Without it, the trace check would produce false negatives for working services.

## Issues Encountered
None beyond the Jaeger daily index behavior documented above.

## Gap Assessment Results

### Pass/Fail Matrix (Baseline)

| Service | Logs | Traces | Metrics |
|---------|------|--------|---------|
| DataProcessing.Validation | PASS | PASS | PASS |
| DataProcessing.FileProcessor | PASS | PASS | PASS |
| DataProcessing.FileDiscovery | PASS | PASS | PASS |
| DataProcessing.Output | PASS | PASS | PASS |
| DataProcessing.DataSourceManagement | FAIL | FAIL | FAIL |
| DataProcessing.Scheduling | FAIL | FAIL | FAIL |
| DataProcessing.MetricsConfiguration | FAIL | FAIL | FAIL |
| DataProcessing.InvalidRecords | FAIL | FAIL | FAIL |

**Score: 12/24 checks passed (50%)**

### Root Cause Analysis

All 4 failing services share the same root cause: **missing `OpenTelemetry__OtlpEndpoint` environment variable** in their Kubernetes deployment YAMLs. Without this env var, the services fall back to `localhost:4317` which resolves to nothing inside the pod, causing all telemetry (logs, traces, metrics) to be silently dropped.

Additionally, DataSourceManagement has a secondary issue: it uses basic `AddConsole()`/`AddDebug()` logging instead of the shared `AddDataProcessingLogging()` call, meaning logs would not go through the OTEL pipeline even if the endpoint were configured.

### Services Missing OTLP Endpoint Env Var
| Service | K8s Deployment | Has Logging? | Has OTLP Env? |
|---------|----------------|--------------|---------------|
| DataSourceManagement | datasource-management | NO (console only) | NO |
| Scheduling | scheduling | YES | NO |
| MetricsConfiguration | metrics-configuration | YES | NO |
| InvalidRecords | invalidrecords | YES | NO |

### Remediation for Plan 02
1. Add `OpenTelemetry__OtlpEndpoint` env var (from configmap key `otlp-endpoint`) to all 4 failing deployment YAMLs
2. Replace basic logging in DataSourceManagement with `AddDataProcessingLogging()` call
3. Rebuild/redeploy affected services
4. Re-run verification script to confirm 24/24 checks pass

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Verification tool is ready and rerunnable for Plan 02
- Gap list is clear and remediation path is well-defined
- All 4 observability backends (Elasticsearch, Jaeger, Prometheus System, Prometheus Business) are healthy and reachable

## Self-Check: PASSED

- [x] tools/verify-otel.ps1 exists
- [x] Commit f25029a exists (Task 1)
- [x] Commit 7af963f exists (Task 2)
- [x] 14-01-SUMMARY.md exists

---
*Phase: 14-otel-verification*
*Completed: 2026-02-25*

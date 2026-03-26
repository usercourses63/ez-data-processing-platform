---
phase: 30-ocp-compliance-deployment-validation
plan: 01
subsystem: infra
tags: [ocp, security, compliance, dockerfile, kubernetes, restricted-v2, scc]

requires:
  - phase: 28-polish-i18n-release
    provides: v0.5.0 release with all service images built

provides:
  - Fixed InvalidRecordsService Dockerfile with non-root USER directive
  - Pinned all :latest image tags to specific versions
  - Reusable OCP restricted-v2 compliance verification script

affects: [30-02, 30-03, 30-04, deployment, release]

tech-stack:
  added: []
  patterns: [ocp-compliance-verification, runtime-pod-inspection]

key-files:
  created:
    - scripts/verify-ocp-compliance.sh
  modified:
    - src/Services/InvalidRecordsService/Dockerfile
    - docker/InvalidRecordsService.Dockerfile
    - k8s/deployments/frontend-deployment.yaml
    - k8s/deployments/otel-collector.yaml
    - k8s/jobs/demo-data-generator.yaml

key-decisions:
  - "Pinned OTEL collector to v0.96.0 (latest stable as of early 2026)"
  - "Pinned frontend and demo-data-generator to v0.5.0 matching release version"
  - "Script uses jq for JSON parsing with kubectl jsonpath fallback"
  - "Fluent-bit pods are skipped (WARN not FAIL) since they require custom SCC on OCP"

patterns-established:
  - "OCP compliance script pattern: runtime pod inspection via kubectl get pods -o json + jq"
  - "All service Dockerfiles must have USER 1000:1000 before ENTRYPOINT"

requirements-completed: [OCP-01, OCP-02, OCP-03, OCP-04, OCP-05, OCP-06, OCP-07, OCP-08, OCP-09, OCP-10, OCP-11, OCP-12, OCP-13]

duration: 2min
completed: 2026-03-26
---

# Phase 30 Plan 01: OCP Compliance Gaps & Verification Script Summary

**Fixed InvalidRecordsService non-root USER gap, pinned 3 :latest image tags, and created 534-line OCP restricted-v2 compliance verification script with 7 check functions and CI JSON output**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T21:18:30Z
- **Completed:** 2026-03-26T21:20:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added USER 1000:1000 to InvalidRecordsService Dockerfile in both src/ and docker/ locations (D-06 gap fix)
- Pinned all 3 :latest image tags: frontend to v0.5.0, otel-collector-contrib to 0.96.0, demo-data-generator to v0.5.0
- Created comprehensive OCP compliance verification script (534 lines, 7 check functions)
- Script supports --json for CI integration and --help for documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix known OCP compliance gaps (D-06, :latest tags)** - `1c3cef2` (fix)
2. **Task 2: Create OCP compliance verification script (D-01, D-05, D-07)** - `5ef1f44` (feat)

## Files Created/Modified
- `scripts/verify-ocp-compliance.sh` - OCP restricted-v2 SCC compliance verifier (7 checks, JSON output, CI-ready)
- `src/Services/InvalidRecordsService/Dockerfile` - Added USER 1000:1000 before ENTRYPOINT
- `docker/InvalidRecordsService.Dockerfile` - Added USER 1000:1000 before ENTRYPOINT
- `k8s/deployments/frontend-deployment.yaml` - Pinned frontend:latest to frontend:v0.5.0
- `k8s/deployments/otel-collector.yaml` - Pinned otel-collector-contrib:latest to 0.96.0
- `k8s/jobs/demo-data-generator.yaml` - Pinned demo-data-generator:latest to v0.5.0

## Decisions Made
- Pinned OTEL collector to v0.96.0 (latest stable contrib release as of early 2026)
- Pinned frontend and demo-data-generator to v0.5.0 matching current release version
- Script uses bash (not PowerShell) for portability across Linux/macOS/Git Bash
- Fluent-bit pods skipped with WARN status since they inherently need hostPath for log collection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired.

## Next Phase Readiness
- OCP compliance gaps are fixed, ready for clean Helm deployment (Plan 02)
- Compliance script ready to run against fresh cluster deployment
- All service Dockerfiles now have USER directive for non-root execution

---
*Phase: 30-ocp-compliance-deployment-validation*
*Completed: 2026-03-26*

---
phase: 20-cicd-production-deployment
plan: 02
subsystem: infra
tags: [helm, kubernetes, docker, ocp, minikube]

requires:
  - phase: 20-01
    provides: CI workflow and Dockerfile foundations
provides:
  - values-local.yaml for single-replica local production deployment
  - Pinned infrastructure image versions (no :latest tags)
  - Right-sized Hazelcast production resources
  - Updated IMAGE-MANIFEST.txt at v0.2.0
affects: [21-release-package, deployment]

tech-stack:
  added: []
  patterns: [helm-values-overlay-local]

key-files:
  created:
    - helm/ez-platform/values-local.yaml
  modified:
    - helm/ez-platform/values.yaml
    - release-package/IMAGE-MANIFEST.txt

key-decisions:
  - "Hazelcast production memory reduced from 8Gi to 1Gi request (JVM only uses 256m-512m)"
  - "App service image names use ez-platform/ prefix in manifest for consistency with values.yaml"

patterns-established:
  - "values-local.yaml overlay: imagePullPolicy Never + single replicas + minimal resources for dev PC"

requirements-completed: [PROD-04, PROD-05]

duration: 3min
completed: 2026-03-18
---

# Phase 20 Plan 02: Helm Values & Image Pinning Summary

**values-local.yaml for single-replica minikube deployment with all infrastructure images pinned to specific versions and Hazelcast right-sized from 8Gi to 1Gi**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T12:02:16Z
- **Completed:** 2026-03-18T12:05:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created values-local.yaml with single replicas for all 15 components (10 services + 5 infrastructure)
- Pinned all 5 infrastructure images that were using :latest tags to specific versions
- Reduced Hazelcast memory from 8Gi/10Gi to 1Gi/2Gi (request/limit) -- was massively over-provisioned
- Updated IMAGE-MANIFEST.txt from v0.1.1-rc1 to v0.2.0 for all application images

## Task Commits

Each task was committed atomically:

1. **Task 1: Create values-local.yaml with single replicas and reduced resources** - `ecf67d5` (feat)
2. **Task 2: Pin infrastructure images and update IMAGE-MANIFEST.txt** - `b604481` (chore)

## Files Created/Modified
- `helm/ez-platform/values-local.yaml` - Local production overlay with single replicas, minimal resources, imagePullPolicy: Never
- `helm/ez-platform/values.yaml` - Hazelcast resources right-sized (8Gi -> 1Gi request, 10Gi -> 2Gi limit)
- `release-package/IMAGE-MANIFEST.txt` - All images at v0.2.0, infrastructure pinned to specific versions

## Decisions Made
- Hazelcast 8Gi memory request was excessive for a cache with 256MB max map size and 512m JVM -- reduced to 1Gi
- Application image names in manifest use ez-platform/ prefix matching the values.yaml repository fields
- Frontend image kept as `frontend:v0.2.0` (no prefix) matching existing values.yaml convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- values-local.yaml ready for release-package validation on minikube
- All image versions pinned and consistent between values.yaml and IMAGE-MANIFEST.txt
- Phase 20 plans 03-04 can proceed (deploy scripts, release validation)

---
*Phase: 20-cicd-production-deployment*
*Completed: 2026-03-18*

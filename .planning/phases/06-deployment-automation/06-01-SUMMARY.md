---
phase: 06-deployment-automation
plan: 01
subsystem: infra
tags: [helm, kubernetes, openshift, deployment, smoke-test, values-overlay]

# Dependency graph
requires:
  - phase: 05-cicd-foundation
    provides: Docker images with v0.2.0 version injection
provides:
  - Helm Chart.yaml v0.2.0 for vanilla K8s and OCP charts
  - Helm test hook (smoke-test.yaml) with health checks for all 10 services
  - Environment-specific values files (values-dev.yaml, values-prod.yaml)
  - Default v0.2.0 image tags in base values.yaml files
affects: [06-02, 06-03, 06-04, deployment, release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Helm test hook with conditional service checks
    - Values overlay pattern for environment separation
    - Chart version tracking app version

key-files:
  created:
    - helm/ez-platform/templates/tests/smoke-test.yaml
    - helm/ez-platform/values-dev.yaml
    - helm/ez-platform/values-prod.yaml
    - release-package/helm/ez-platform-ocp/templates/tests/smoke-test.yaml
    - release-package/helm/ez-platform-ocp/values-dev.yaml
    - release-package/helm/ez-platform-ocp/values-prod.yaml
  modified:
    - helm/ez-platform/Chart.yaml
    - helm/ez-platform/values.yaml
    - release-package/helm/ez-platform-ocp/Chart.yaml
    - release-package/helm/ez-platform-ocp/values.yaml

key-decisions:
  - "Chart version 0.2.0 matches appVersion v0.2.0 for version alignment"
  - "Smoke test uses 60s wait + 3 retries with 10s intervals for service stabilization"
  - "curlimages/curl:8.5.0 for smoke test (OCP-compatible, non-root)"

patterns-established:
  - "Helm test hook: helm.sh/hook: test annotation, before-hook-creation,hook-succeeded delete policy"
  - "Environment values overlay: -f values.yaml -f values-{env}.yaml for clean separation"
  - "Service health check pattern: curl /health endpoint with retry logic"

# Metrics
duration: 3min
completed: 2026-02-03
---

# Phase 6 Plan 1: Helm Chart Version Alignment Summary

**Helm charts updated to v0.2.0 with smoke test hooks and environment-specific values overlays for vanilla K8s and OCP deployments**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-03T05:59:31Z
- **Completed:** 2026-02-03T06:03:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Updated Chart.yaml to v0.2.0 in both vanilla K8s and OCP helm charts
- Created smoke-test.yaml Helm test hook checking all 10 services with retry logic
- Created environment-specific values-dev.yaml and values-prod.yaml for both charts
- Updated base values.yaml files to use v0.2.0 as default image tag for all services

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Chart.yaml versions to v0.2.0** - `46e55ed` (chore)
2. **Task 2: Create Helm test hook for smoke testing** - `b776a20` (feat)
3. **Task 3: Create environment-specific values files** - `ae56f52` (feat)

## Files Created/Modified
- `helm/ez-platform/Chart.yaml` - Updated version to 0.2.0, appVersion to v0.2.0
- `release-package/helm/ez-platform-ocp/Chart.yaml` - Updated version to 0.2.0, appVersion to v0.2.0
- `helm/ez-platform/templates/tests/smoke-test.yaml` - Helm test hook for 10 services (112 lines)
- `release-package/helm/ez-platform-ocp/templates/tests/smoke-test.yaml` - Identical OCP test hook
- `helm/ez-platform/values-dev.yaml` - Dev environment overrides (67 lines)
- `helm/ez-platform/values-prod.yaml` - Prod environment overrides (44 lines)
- `release-package/helm/ez-platform-ocp/values-dev.yaml` - OCP dev environment with routes (71 lines)
- `release-package/helm/ez-platform-ocp/values-prod.yaml` - OCP prod environment with routes (48 lines)
- `helm/ez-platform/values.yaml` - Updated 10 service image tags to v0.2.0
- `release-package/helm/ez-platform-ocp/values.yaml` - Updated 10 service image tags to v0.2.0

## Decisions Made
- Chart version 0.2.0 aligns with appVersion v0.2.0 for consistent version tracking
- Smoke test includes 60-second wait before health checks (per research recommendation)
- Using 3 retries with 10-second intervals for transient failures
- Dev environment uses reduced replicas (1 for most services, 2 for fileprocessor)
- Prod environment uses 4-hour deduplication TTL (vs 15-min in dev)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Helm charts ready for v0.2.0 deployment
- `helm test <release>` will verify all 10 services after deployment
- Environment separation via `-f values-dev.yaml` or `-f values-prod.yaml` overlay
- Ready for Plan 06-02: Deployment validation (helm lint, helm template, schema validation)

---
*Phase: 06-deployment-automation*
*Completed: 2026-02-03*

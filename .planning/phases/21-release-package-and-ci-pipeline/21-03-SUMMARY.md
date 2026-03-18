---
phase: 21-release-package-and-ci-pipeline
plan: 03
subsystem: infra
tags: [github-actions, ci, helm, playwright, sanity-tests, minikube]

# Dependency graph
requires:
  - phase: 21-release-package-and-ci-pipeline (plan 01)
    provides: docker-build and package-release CI jobs with image tars and deployment package artifacts
  - phase: 21-release-package-and-ci-pipeline (plan 02)
    provides: Playwright sanity test suite with npm run test:e2e:sanity command
provides:
  - sanity-deploy CI job that deploys to Minikube and runs @Sanity tests as pipeline gate
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [self-hosted-runner-gate, parallel-minikube-image-load, helm-ci-deploy]

key-files:
  created: []
  modified: [.github/workflows/ci.yml]

key-decisions:
  - "Single package download (full zip from package-release) instead of two separate artifact downloads for services and infrastructure"
  - "Parallel image loading with background processes and wait for all PIDs"

patterns-established:
  - "Self-hosted runner gate: vars.EZ_K8S_RUNNER == 'true' AND main/tag branch filter"
  - "CI port-forward: kubectl port-forward in background with sleep 10 stabilization"

requirements-completed: [REL-05, REL-06]

# Metrics
duration: 1min
completed: 2026-03-18
---

# Phase 21 Plan 03: Sanity Deploy CI Job Summary

**Self-hosted CI job that loads image tars into Minikube, deploys via Helm, seeds with DemoDataGenerator, and gates on @Sanity Playwright tests**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T13:12:41Z
- **Completed:** 2026-03-18T13:13:48Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added sanity-deploy job to CI pipeline as final gate after package-release
- Full deployment pipeline: unzip package, load tars (parallel), helm deploy, wait pods, port-forward, seed data, run sanity tests
- Self-hosted runner gate ensures job only runs when Minikube cluster is available

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sanity-deploy job to ci.yml** - `2984f72` (feat)

## Files Created/Modified
- `.github/workflows/ci.yml` - Added sanity-deploy job (143 lines) with 14 steps covering full deploy+test cycle

## Decisions Made
- Used single package zip download from package-release output (contains both service and infrastructure tars) rather than downloading two separate artifacts
- Parallel minikube image load with background PIDs and error checking per process

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The sanity-deploy job is gated on `vars.EZ_K8S_RUNNER` which must be set in GitHub repo settings when a self-hosted runner is available.

## Next Phase Readiness
- CI pipeline complete: build -> test -> docker-build -> package-release -> sanity-deploy
- Gap closure plan (21-04) remains for PROD-01/PROD-03 verification items

---
*Phase: 21-release-package-and-ci-pipeline*
*Completed: 2026-03-18*

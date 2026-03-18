---
phase: 20-cicd-production-deployment
plan: 03
subsystem: infra
tags: [release, validation, helm, powershell, install-scripts]

requires:
  - phase: 20-01
    provides: CI pipeline with version extraction and build-all-images.ps1
  - phase: 20-02
    provides: values-local.yaml for dev PC deployment, IMAGE-MANIFEST.txt v0.2.0
provides:
  - Updated install.ps1/install.sh with v0.2.0 and --local flag
  - Release validation script (validate-release.ps1) with 4-phase end-to-end check
  - Updated README.md with v0.2.0 package structure and Docusaurus docs
affects: [21-release-package]

tech-stack:
  added: []
  patterns: [offset-port health checks, 4-phase release validation]

key-files:
  created:
    - scripts/validate-release.ps1
  modified:
    - release-package/install.ps1
    - release-package/install.sh
    - release-package/README.md

key-decisions:
  - "Offset ports (20000+) for health checks to avoid conflicts with existing port forwards"
  - "Helm-first deployment in README replacing manual kubectl apply instructions"

patterns-established:
  - "Release validation: image load -> helm deploy -> health checks -> smoke test"

requirements-completed: [PROD-02, PROD-06]

duration: 4min
completed: 2026-03-18
---

# Phase 20 Plan 03: Release Scripts & Validation Summary

**Updated install scripts to v0.2.0 with --local flag, created 4-phase release validation script (image load, Helm deploy, health checks, smoke test)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T12:06:51Z
- **Completed:** 2026-03-18T12:10:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Updated install.ps1 and install.sh from v0.1.1 to v0.2.0 with --local flag for dev PC deployment
- Created validate-release.ps1 with 4-phase validation: image load, Helm deploy, health checks on 6 services, smoke test
- Rewrote README.md for v0.2.0: Docusaurus docs, Helm-first deployment, updated package structure

## Task Commits

Each task was committed atomically:

1. **Task 1: Update install scripts and README for v0.2.0** - `504939f` (feat)
2. **Task 2: Create release validation script** - `a814e57` (feat)

## Files Created/Modified
- `scripts/validate-release.ps1` - 4-phase release validation (images, Helm, health, smoke)
- `release-package/install.ps1` - v0.2.0 banner, --local flag, port 8080 frontend, docs portal
- `release-package/install.sh` - v0.2.0 banner, --local flag, port 8080 frontend, docs portal
- `release-package/README.md` - v0.2.0, Docusaurus, Helm-first, updated package structure

## Decisions Made
- Used offset ports (20000+) in validation script to avoid conflicts with any existing port forwards
- Made Helm the primary deployment method in README, keeping kubectl apply as alternative
- Removed legacy "kubectl run ezplatform-docs" section since docs is now a Helm-managed service

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Release validation tooling complete, ready for Phase 20-04 (release packaging)
- All install scripts consistent at v0.2.0
- Validation script can be run after image build to verify release package integrity

---
*Phase: 20-cicd-production-deployment*
*Completed: 2026-03-18*

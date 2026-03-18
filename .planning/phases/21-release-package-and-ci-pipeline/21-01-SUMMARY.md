---
phase: 21-release-package-and-ci-pipeline
plan: 01
subsystem: infra
tags: [bash, docker, ci, github-actions, deployment-package]

requires:
  - phase: 20-cicd-production-deployment
    provides: existing CI pipeline (ci.yml) with build/test/docker/helm-validate jobs
provides:
  - bash scripts for building 10 app images and exporting .tar files
  - bash script for pulling 11 infrastructure images and exporting .tar files
  - bash script for assembling versioned deployment packages with canonical folder structure
  - CI docker-build job that builds images from source and uploads artifacts
  - CI package-release job that assembles and uploads 90-day deployment zip
affects: [21-02, 21-03, 21-04]

tech-stack:
  added: []
  patterns: [bash build scripts with set -euo pipefail, CI artifact chain via download-artifact]

key-files:
  created:
    - scripts/build-all-images.sh
    - scripts/pull-infra-images.sh
    - scripts/assemble-package.sh
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Bash scripts coexist with PowerShell equivalents (ubuntu CI runners need bash)"
  - "docker-build and package-release are separate from existing docker job (no modifications to existing jobs)"
  - "7-day retention for intermediate image tars, 90-day for final deployment package"

patterns-established:
  - "CI artifact chain: docker-build uploads tars -> package-release downloads and assembles"
  - "Version calculation: git tag for releases, v{SEMANTIC_VERSION}-dev-{run_number} for dev builds"

requirements-completed: [REL-03, REL-04]

duration: 2min
completed: 2026-03-18
---

# Phase 21 Plan 01: Build Scripts & CI Pipeline Summary

**Three bash build scripts and two CI jobs automating versioned offline deployment package production with 90-day artifact retention**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T13:08:36Z
- **Completed:** 2026-03-18T13:10:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created build-all-images.sh covering all 10 application services with docker build + save
- Created pull-infra-images.sh for all 11 infrastructure images from IMAGE-MANIFEST.txt
- Created assemble-package.sh producing canonical deployment-{VERSION}-{YYYYMMDD}-{HHMMSS}/ folder
- Extended ci.yml with docker-build (needs: test) and package-release (needs: docker-build) jobs
- All existing CI jobs (build, test, performance, docker, helm-validate) preserved unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create build-all-images.sh and pull-infra-images.sh** - `55c8c01` (feat)
2. **Task 2: Create assemble-package.sh and extend ci.yml** - `d7a7902` (feat)

## Files Created/Modified
- `scripts/build-all-images.sh` - Builds 10 app Docker images, exports .tar files
- `scripts/pull-infra-images.sh` - Pulls and saves 11 infrastructure Docker images
- `scripts/assemble-package.sh` - Assembles versioned deployment folder with helm chart, installers, manifests
- `.github/workflows/ci.yml` - Added docker-build and package-release jobs

## Decisions Made
- Bash scripts coexist with existing PowerShell equivalents; ubuntu CI runners require bash
- New docker-build job is separate from existing docker job to avoid breaking existing pipeline
- 7-day retention for intermediate image tar artifacts, 90-day for final deployment packages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Build scripts ready for use by 21-02 (gap closure) and 21-03 (sanity deploy)
- CI pipeline extended and ready for push to main to trigger new jobs
- Deployment package structure matches canonical layout for offline installation

---
*Phase: 21-release-package-and-ci-pipeline*
*Completed: 2026-03-18*

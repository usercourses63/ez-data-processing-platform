---
phase: 21-release-package-and-ci-pipeline
plan: 04
subsystem: infra
tags: [changelog, github-release, ci-cd, offline-deployment, helm, air-gapped]

requires:
  - phase: 21-03
    provides: sanity-deploy CI job and package-release outputs
provides:
  - v0.2.0 CHANGELOG entry documenting all milestone features
  - GitHub release CI job triggered on v* tags with CHANGELOG excerpt and deployment zip
  - Offline / air-gapped deployment guide in release-package README
affects: []

tech-stack:
  added: []
  patterns: [gh-release-on-tag, changelog-excerpt-extraction]

key-files:
  created: []
  modified:
    - release-package/CHANGELOG.md
    - release-package/README.md
    - .github/workflows/ci.yml

key-decisions:
  - "release job needs: package-release (not sanity-deploy) so release is not blocked by optional self-hosted runner"
  - "awk-based CHANGELOG excerpt extraction writes to file to avoid multiline quoting issues in GITHUB_OUTPUT"

patterns-established:
  - "Tag-triggered release: v* tag -> package-release -> release job creates GitHub release with CHANGELOG body + zip asset"

requirements-completed: [REL-01, REL-02]

duration: 2min
completed: 2026-03-18
---

# Phase 21 Plan 04: Release Artifacts & GitHub Release Job Summary

**v0.2.0 CHANGELOG with full milestone feature list, tag-triggered GitHub release CI job with CHANGELOG excerpt and deployment zip, offline Helm deployment guide for air-gapped OCP**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T13:15:35Z
- **Completed:** 2026-03-18T13:17:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wrote comprehensive v0.2.0 CHANGELOG entry covering all 12 phases of milestone features (NAS lifecycle, device health, SignalR, protocol tests, file-simulator, E2E, Docusaurus, CI/CD, offline package, OCP resources) with Added/Changed/Fixed sections
- Added release job to ci.yml as 9th job: tag-triggered, extracts CHANGELOG excerpt for release body, downloads deployment zip from package-release, creates GitHub release via gh CLI
- Added offline/air-gapped deployment section to release-package README with CI package structure, Windows/Linux install commands, and OCP mirror instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Write v0.2.0 CHANGELOG entry and update release-package README** - `f8c8967` (feat)
2. **Task 2: Add GitHub release job to ci.yml** - `5ab057d` (feat)

## Files Created/Modified
- `release-package/CHANGELOG.md` - Prepended v0.2.0 release notes with all milestone features
- `release-package/README.md` - Added Offline / Air-Gapped Deployment section with package structure and install steps
- `.github/workflows/ci.yml` - Added release job (9th job) creating GitHub release on v* tags

## Decisions Made
- release job uses `needs: package-release` instead of `needs: sanity-deploy` so that tagged releases are not blocked by the optional self-hosted runner requirement
- CHANGELOG excerpt extraction uses awk piped to a temp file to avoid multiline quoting issues with GITHUB_OUTPUT

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v0.2.0 milestone is now complete (36/36 plans)
- Running `git tag v0.2.0 && git push --tags` will trigger the full CI pipeline: build -> test -> docker-build -> package-release -> (sanity-deploy if runner available) -> release

---
*Phase: 21-release-package-and-ci-pipeline*
*Completed: 2026-03-18*

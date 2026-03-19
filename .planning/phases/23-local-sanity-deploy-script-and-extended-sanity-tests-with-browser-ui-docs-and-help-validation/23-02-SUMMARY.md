---
phase: 23-local-sanity-deploy-script-and-extended-sanity-tests-with-browser-ui-docs-and-help-validation
plan: 02
subsystem: infra
tags: [bash, powershell, helm, minikube, playwright, sanity-test, port-forward]

requires:
  - phase: 21-release-package-ci-deployment-pipeline
    provides: CI sanity-deploy job sequence (template for local script)
provides:
  - Bash local sanity deploy and test script (scripts/sanity-test.sh)
  - PowerShell local sanity deploy and test script (scripts/sanity-test.ps1)
  - Docs service port-forward in start-port-forwards.ps1
affects: [release-package, deployment, developer-workflow]

tech-stack:
  added: []
  patterns: [parallel-image-load, double-test-run-consistency, cleanup-trap]

key-files:
  created:
    - scripts/sanity-test.sh
    - scripts/sanity-test.ps1
  modified:
    - scripts/start-port-forwards.ps1

key-decisions:
  - "Bash and PowerShell scripts mirror same sequence for cross-platform parity"
  - "Background port-forward cleanup via trap (bash) and taskkill (PowerShell)"
  - "Double headed test run for consistency verification"
  - "Docs service port-forward on port 30800 added to both sanity scripts and start-port-forwards.ps1"

patterns-established:
  - "Parallel image loading with PID/Job tracking and failure detection"
  - "Auto-detect latest dist/deployment-*/ package with clear error on missing"

requirements-completed: [SANITY-SCRIPT-BASH, SANITY-SCRIPT-PS1, SANITY-PORTFWD-DOCS, SANITY-CONSISTENCY]

duration: 3min
completed: 2026-03-19
---

# Phase 23 Plan 02: Local Sanity Deploy Scripts Summary

**Bash and PowerShell scripts for full clean deploy from dist/ with double headed sanity test run, plus docs port-forward in start-port-forwards.ps1**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T08:28:32Z
- **Completed:** 2026-03-19T08:31:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created scripts/sanity-test.sh with full deploy cycle: namespace delete, image cache purge, parallel image load, Helm deploy, pod wait, port-forwards, DemoDataGenerator seeding, double headed test run
- Created scripts/sanity-test.ps1 mirroring the same logic in PowerShell idiom with Start-Job parallelism
- Updated scripts/start-port-forwards.ps1 with Docs Portal port-forward on 30800

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/sanity-test.sh** - `ddfa0e5` (feat)
2. **Task 2: Create scripts/sanity-test.ps1 and update start-port-forwards.ps1** - `b4b33a3` (feat)

## Files Created/Modified
- `scripts/sanity-test.sh` - Bash local sanity deploy and double test run script
- `scripts/sanity-test.ps1` - PowerShell equivalent for Windows developers
- `scripts/start-port-forwards.ps1` - Added Docs Portal port-forward entry (30800:80)

## Decisions Made
- Bash and PowerShell scripts mirror the same sequence for cross-platform parity
- Background port-forward cleanup via trap in bash, taskkill in PowerShell
- Double headed test run (test:e2e:sanity:headed) for consistency verification
- Docs service port-forward on port 30800 added to all relevant scripts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Local sanity deploy workflow complete for both bash and PowerShell
- Developers can run single-command sanity test from dist/ artifacts

---
*Phase: 23-local-sanity-deploy-script-and-extended-sanity-tests-with-browser-ui-docs-and-help-validation*
*Completed: 2026-03-19*

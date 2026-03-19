---
phase: 23-local-sanity-deploy-script-and-extended-sanity-tests-with-browser-ui-docs-and-help-validation
plan: 01
subsystem: testing
tags: [playwright, sanity, docs, e2e, browser]

requires:
  - phase: 21-release-package-ci-deployment-pipeline
    provides: sanity test suite (SANITY-01 through SANITY-07)
provides:
  - SANITY-08, SANITY-09, SANITY-10 browser tests for docs portal and Help button
  - test:e2e:sanity:headed npm script for local headed execution
affects: [23-02, sanity-deploy]

tech-stack:
  added: []
  patterns: [popup event capture for new-tab navigation testing]

key-files:
  created: []
  modified:
    - src/Frontend/tests/e2e/sanity.spec.ts
    - src/Frontend/package.json

key-decisions:
  - "DOCS_URL configurable via env var with localhost:30800 default"
  - "SANITY-10 uses waitForEvent('popup') to capture window.open new tab"

patterns-established:
  - "Popup capture pattern: Promise.all([page.waitForEvent('popup'), button.click()]) for window.open testing"

requirements-completed: [SANITY-08, SANITY-09, SANITY-10, SANITY-HEADED]

duration: 2min
completed: 2026-03-19
---

# Phase 23 Plan 01: Docs/Help Browser Sanity Tests Summary

**Extended sanity suite to 10 tests with SANITY-08/09/10 covering Docusaurus portal and Help button popup, plus headed npm script**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T08:28:51Z
- **Completed:** 2026-03-19T08:30:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added SANITY-08: docs homepage loads at localhost:30800 with EZ/documentation content
- Added SANITY-09: Hebrew user guide loads with Hebrew characters verified via Unicode range
- Added SANITY-10: Help button opens docs portal in new tab via popup event capture
- Added test:e2e:sanity:headed npm script for visible browser execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SANITY-08, SANITY-09, SANITY-10 tests** - `ddfa0e5` (feat)
2. **Task 2: Add test:e2e:sanity:headed npm script** - `5f13be3` (feat)

## Files Created/Modified
- `src/Frontend/tests/e2e/sanity.spec.ts` - Extended from 7 to 10 sanity tests with docs/help coverage
- `src/Frontend/package.json` - Added test:e2e:sanity:headed script

## Decisions Made
- DOCS_URL is configurable via environment variable (default: http://localhost:30800) for CI flexibility
- SANITY-10 uses waitForEvent('popup') pattern because openDocsInNewTab calls window.open, creating a new browser context rather than navigating the current page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sanity suite now covers 10 tests including docs portal verification
- Ready for 23-02 (local deploy script)

---
*Phase: 23-local-sanity-deploy-script-and-extended-sanity-tests-with-browser-ui-docs-and-help-validation*
*Completed: 2026-03-19*

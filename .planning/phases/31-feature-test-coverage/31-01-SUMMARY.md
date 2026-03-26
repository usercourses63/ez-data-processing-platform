---
phase: 31-feature-test-coverage
plan: 01
subsystem: testing
tags: [playwright, e2e, clone, rtl, ant-design]

requires:
  - phase: 30-api-sanity
    provides: "sanity.spec.ts patterns (extractId, extractData, antTabClick, antSelect, apiContext)"
provides:
  - "Production-quality clone datasource E2E test suite (5 tests)"
  - "API-based test data creation and cleanup pattern for clone workflows"
affects: [31-feature-test-coverage]

tech-stack:
  added: []
  patterns: ["API-based test data lifecycle (create/verify/cleanup)", "try/finally cleanup with deletedBy=SanityTest"]

key-files:
  created: []
  modified: ["src/Frontend/tests/e2e/clone-datasource.spec.ts"]

key-decisions:
  - "Copied helpers inline rather than importing from sanity.spec.ts (separate test file isolation)"
  - "Used try/finally for cleanup in tests that create API data"

patterns-established:
  - "Clone test pattern: create source via API, clone via UI, verify via API, cleanup via API"

requirements-completed: [TIER-2-CLONE]

duration: 4min
completed: 2026-03-27
---

# Phase 31 Plan 01: Clone Datasource E2E Tests Summary

**Rewrote clone-datasource E2E tests with production patterns: configurable URLs, APIRequestContext, shared helpers, try/finally cleanup with deletedBy=SanityTest**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T23:45:28Z
- **Completed:** 2026-03-26T23:49:28Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced hardcoded minikube IP (172.30.22.206:32608) with localhost constants matching sanity.spec.ts
- Added APIRequestContext for create/verify/cleanup lifecycle
- 5 tests covering: icon visibility, list clone with modal, API-verified clone, details page clone, cleanup API verification
- All data-creating tests use try/finally with deletedBy=SanityTest cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite clone-datasource.spec.ts with production patterns** - `2cf7073` (test)

## Files Created/Modified
- `src/Frontend/tests/e2e/clone-datasource.spec.ts` - Complete rewrite: 5 clone E2E tests with API context, shared helpers, proper cleanup

## Decisions Made
- Copied helpers inline (extractId, extractData, antTabClick, antSelect) rather than importing from shared module, maintaining test file isolation consistent with sanity.spec.ts pattern
- Used try/finally blocks for API cleanup rather than afterEach hooks, giving finer-grained control per test

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Clone E2E tests ready for execution against live cluster
- Pattern established for future feature E2E tests (import, completeness)

---
*Phase: 31-feature-test-coverage*
*Completed: 2026-03-27*

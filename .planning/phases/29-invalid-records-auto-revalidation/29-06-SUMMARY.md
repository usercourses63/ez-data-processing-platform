---
phase: 29-invalid-records-auto-revalidation
plan: 06
subsystem: testing
tags: [playwright, e2e, revalidation, invalid-records, yaml, schema]

requires:
  - phase: 29-03
    provides: Revalidate All button and backend endpoint
  - phase: 29-04
    provides: YAML download, schema editor link fix, TTL field
  - phase: 29-05
    provides: SignalR notifications for revalidation
provides:
  - Playwright E2E test suite for revalidation feature (5 tests)
affects: [testing, invalid-records, schema]

tech-stack:
  added: []
  patterns: [conditional-skip-for-data-dependent-tests, api-context-for-datasource-lookup]

key-files:
  created:
    - src/Frontend/tests/e2e/revalidation.spec.ts
  modified: []

key-decisions:
  - "Used API context to look up datasource IDs for schema tab tests rather than hardcoding"
  - "Conditional test.skip() for data-dependent tests (invalid records, schema link)"
  - "Popover dismissal via Escape key fallback when cancel button not found"

patterns-established:
  - "REVAL test naming convention: REVAL-01 through REVAL-05"
  - "Graceful skip pattern for tests requiring specific data state"

requirements-completed: [REVAL-10]

duration: 1min
completed: 2026-03-26
---

# Phase 29 Plan 06: Revalidation E2E Tests Summary

**Playwright E2E test suite with 5 tests covering Revalidate All button (2 locations), YAML download, schema editor link, and TTL field**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-26T12:10:42Z
- **Completed:** 2026-03-26T12:11:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created 5 Playwright E2E tests covering all revalidation UI features
- Tests handle missing data gracefully with conditional skip
- All tests listable by Playwright (verified with --list)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create revalidation E2E test** - `485119d` (test)

## Files Created/Modified
- `src/Frontend/tests/e2e/revalidation.spec.ts` - 5 E2E tests for revalidation feature (Revalidate All, YAML download, schema editor link, Schema tab revalidation, TTL field)

## Decisions Made
- Used API context to fetch datasource IDs dynamically rather than hardcoding, making tests portable
- Used test.skip() with descriptive messages for tests that depend on specific data state (invalid records must exist)
- Used Escape key as fallback popover dismissal mechanism when cancel button selector does not match

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All revalidation E2E tests are ready for headed execution against a running cluster
- Tests are designed to be resilient to varying data states

## Self-Check: PASSED

- FOUND: src/Frontend/tests/e2e/revalidation.spec.ts
- FOUND: commit 485119d

---
*Phase: 29-invalid-records-auto-revalidation*
*Completed: 2026-03-26*

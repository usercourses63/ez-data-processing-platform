---
phase: 31-feature-test-coverage
plan: 03
subsystem: frontend-e2e-tests
tags: [e2e, playwright, completeness, testing]
dependency_graph:
  requires: []
  provides: [completeness-e2e-api-context]
  affects: [completeness-checklist.spec.ts]
tech_stack:
  added: []
  patterns: [api-context-lifecycle, deterministic-test-data, api-cleanup]
key_files:
  created: []
  modified:
    - src/Frontend/tests/e2e/completeness-checklist.spec.ts
decisions:
  - Used try/finally pattern for API cleanup to ensure datasource deletion even on test failure
  - Kept all existing helpers (navigateAndWait, getSidebarCard, getTabItems, antSelect) intact
  - Added antTabClick helper for future use even though existing sidebar click pattern works
metrics:
  duration: ~1m
  completed: 2026-03-26T23:46:15Z
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 31 Plan 03: Completeness Checklist E2E Upgrade Summary

Upgraded completeness-checklist.spec.ts with API context lifecycle and deterministic edit-mode testing via API-created datasource with cleanup.

## What Changed

### Task 1: Upgrade completeness-checklist.spec.ts with API context and cleanup
**Commit:** `aa45084`

- Added `APIRequestContext` import and `apiContext` beforeAll/afterAll lifecycle (matching sanity.spec.ts pattern)
- Added `extractId`, `extractData`, and `antTabClick` shared helpers from sanity.spec.ts
- Upgraded Test 7 (edit form progress) to create a test datasource via API with known fields (`Name`, `SupplierName`, `Category`, `ConnectionType`, `FileType`, `Status`) instead of relying on seeded data
- Test 7 now navigates directly to `/datasources/{id}/edit` for deterministic testing
- Cleanup via `DELETE /api/v1/datasources/{id}?deletedBy=SanityTest` in a `finally` block
- All 15 existing tests preserved (10 main + 5 gap closure)
- File grew from 553 to 596 lines

## Verification Results

- `grep -c "apiContext"` = 5 (>= 3 required)
- `grep -c "deletedBy=SanityTest"` = 1 (>= 1 required)
- `npx playwright test --list` = 15 tests in 1 file
- Line count: 596 (>= 350 minimum)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is wired and operational.

## Self-Check: PASSED

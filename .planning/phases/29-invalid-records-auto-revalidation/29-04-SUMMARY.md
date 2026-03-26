---
phase: 29-invalid-records-auto-revalidation
plan: 04
subsystem: ui
tags: [react, antd, js-yaml, i18n, revalidation, invalid-records]

requires:
  - phase: 29-01
    provides: Backend revalidation API endpoints (revalidate-all, revalidate-count)
provides:
  - Revalidate All button on invalid records page header
  - Revalidate All button on Schema tab (scoped to datasource)
  - YAML schema download using js-yaml
  - Fixed schema editor link in EditRecordModal
  - Hebrew and English i18n keys for revalidation
affects: [29-05, 29-06, 29-07]

tech-stack:
  added: [js-yaml, "@types/js-yaml"]
  patterns: [location.state for cross-page tab activation]

key-files:
  created: []
  modified:
    - src/Frontend/src/services/invalidrecords-api-client.ts
    - src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx
    - src/Frontend/src/components/datasource/tabs/SchemaTab.tsx
    - src/Frontend/src/components/invalid-records/EditRecordModal.tsx
    - src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx
    - src/Frontend/src/i18n/locales/he.json
    - src/Frontend/src/i18n/locales/en.json
    - src/Frontend/package.json

key-decisions:
  - "Used location.state pattern for schema tab activation from EditRecordModal"
  - "YAML download is frontend-only via js-yaml (no backend round-trip)"

patterns-established:
  - "Cross-page tab activation: navigate with state.activeTab, useEffect reads it on mount"

requirements-completed: [REVAL-08, REVAL-18, REVAL-19, REVAL-20, REVAL-21, REVAL-22]

duration: 4min
completed: 2026-03-26
---

# Phase 29 Plan 04: Frontend Revalidation Features Summary

**Revalidate All button in two locations (invalid records page and Schema tab), YAML download via js-yaml, and fixed schema editor navigation from correction dialog**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T11:57:30Z
- **Completed:** 2026-03-26T12:01:35Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added revalidateAll() and getRevalidateCount() API client functions with BulkRevalidationResult type
- Revalidate All button on invalid records page header with Popconfirm, respects datasource filter
- Revalidate All button on Schema tab with badge showing invalid record count (conditionally visible)
- YAML download button on Schema tab using js-yaml library
- Fixed broken schema editor link in EditRecordModal to use React Router navigate with activeTab state
- Added location.state.activeTab handling in DataSourceEditEnhanced for cross-page tab activation
- Full Hebrew and English i18n keys for revalidation section

## Task Commits

Each task was committed atomically:

1. **Task 1: Add revalidation API client functions and Revalidate All button to invalid records page** - `52e5670` (feat)
2. **Task 2: YAML download button, Schema tab revalidate button, and fix broken link in EditRecordModal** - `0184b4d` (feat)

## Files Created/Modified
- `src/Frontend/src/services/invalidrecords-api-client.ts` - Added revalidateAll(), getRevalidateCount(), BulkRevalidationResult
- `src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx` - Revalidate All button with Popconfirm in header
- `src/Frontend/src/components/datasource/tabs/SchemaTab.tsx` - YAML download + Revalidate All button with badge
- `src/Frontend/src/components/invalid-records/EditRecordModal.tsx` - Fixed schema link to use navigate with state
- `src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx` - Added useLocation for activeTab from state, pass dataSourceId to SchemaTab
- `src/Frontend/src/i18n/locales/he.json` - Added revalidation section with 12 keys
- `src/Frontend/src/i18n/locales/en.json` - Added revalidation section with 12 keys
- `src/Frontend/package.json` - Added js-yaml and @types/js-yaml dependencies

## Decisions Made
- Used `location.state` pattern for cross-page tab activation (EditRecordModal -> DataSourceEditEnhanced schema tab)
- YAML download is purely frontend using js-yaml dump (no backend needed per D-18/D-19)
- Revalidate All button in Schema tab conditionally visible only when invalidCount > 0 (per D-08)
- Used `--legacy-peer-deps` for npm install due to @testing-library/react peer dependency conflict with React 19

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed BulkRevalidationResult export conflict**
- **Found during:** Task 1
- **Issue:** `export interface` and `export type` at bottom caused TS2484 duplicate export error
- **Fix:** Removed `export` keyword from interface declaration, kept re-export at bottom
- **Files modified:** src/Frontend/src/services/invalidrecords-api-client.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 52e5670 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript fix for correct module exports. No scope creep.

## Issues Encountered
- npm peer dependency conflict with @testing-library/react@14 requiring React 18 while project uses React 19. Resolved with --legacy-peer-deps flag.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is wired to actual API endpoints and i18n keys.

## Next Phase Readiness
- Frontend revalidation features complete
- Ready for end-to-end testing when backend revalidation endpoints are deployed

---
*Phase: 29-invalid-records-auto-revalidation*
*Completed: 2026-03-26*

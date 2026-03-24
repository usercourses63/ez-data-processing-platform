---
phase: 25-clone-datasource
plan: 01
subsystem: ui
tags: [react, antd, clone, dropdown, i18n, typescript]

requires:
  - phase: none
    provides: existing DataSourceList.tsx, helpers.ts, types.ts, i18n files
provides:
  - ClonePayload interface for location.state data passing
  - prepareCloneData utility function (name prefix, UUID regeneration, schedule reset)
  - Redesigned actions column with overflow dropdown (View/Edit inline, Clone/Trigger/Delete in dropdown)
  - Clone and actions i18n keys in he.json and en.json
affects: [25-clone-datasource plan 02 (details page clone + form hydration)]

tech-stack:
  added: []
  patterns: [overflow dropdown for actions column, Modal.confirm for clone confirmation, location.state for clone data passing]

key-files:
  created: []
  modified:
    - src/Frontend/src/components/datasource/shared/types.ts
    - src/Frontend/src/components/datasource/shared/helpers.ts
    - src/Frontend/src/pages/datasources/DataSourceList.tsx
    - src/Frontend/src/i18n/locales/he.json
    - src/Frontend/src/i18n/locales/en.json

key-decisions:
  - "Replaced Popconfirm with Modal.confirm for delete action (works inside Dropdown menu)"
  - "Used Ant Design Dropdown with menu prop (not deprecated overlay) for overflow actions"
  - "Delete confirmation reuses existing i18n confirmDelete keys with fallback defaultValues"

patterns-established:
  - "Overflow dropdown pattern: primary actions inline, secondary/destructive in MoreOutlined dropdown"
  - "Clone data flow: fetch full entity -> prepareCloneData transform -> navigate with location.state"

requirements-completed: [CLONE-01, CLONE-03]

duration: 3min
completed: 2026-03-24
---

# Phase 25 Plan 01: Clone Datasource - List Page & Utilities Summary

**Clone utility function with UUID regeneration, i18n keys, and redesigned list page actions column with overflow dropdown containing Clone/Trigger/Delete**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T08:55:10Z
- **Completed:** 2026-03-24T08:57:46Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added ClonePayload interface and prepareCloneData utility function that handles name prefixing, output destination UUID regeneration, and schedule disabling
- Redesigned actions column from 4 inline buttons (240px) to View/Edit inline + overflow dropdown (140px) with Clone, Trigger, and Delete
- Added all clone and actions i18n keys in both Hebrew and English translation files
- TypeScript compilation passes cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ClonePayload type, prepareCloneData utility, and i18n keys** - `51a86dd` (feat)
2. **Task 2: Redesign list page actions column and wire clone flow** - `fb26a92` (feat)

## Files Created/Modified
- `src/Frontend/src/components/datasource/shared/types.ts` - Added ClonePayload interface
- `src/Frontend/src/components/datasource/shared/helpers.ts` - Added prepareCloneData function with import of ClonePayload and OutputDestination types
- `src/Frontend/src/pages/datasources/DataSourceList.tsx` - Redesigned actions column with Dropdown, added handleClone function, replaced Popconfirm with Modal.confirm
- `src/Frontend/src/i18n/locales/he.json` - Added datasources.clone.* and datasources.actions.* keys
- `src/Frontend/src/i18n/locales/en.json` - Added datasources.clone.* and datasources.actions.* keys

## Decisions Made
- Replaced Popconfirm with Modal.confirm for delete action since Popconfirm doesn't work well inside Dropdown menus
- Used Ant Design Dropdown with `menu` prop (not deprecated `overlay`) for the overflow actions
- Delete confirmation reuses existing i18n confirmDelete keys with fallback defaultValues for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- prepareCloneData utility is ready for reuse by plan 25-02 (details page clone button)
- ClonePayload interface is ready for form hydration in DataSourceFormEnhanced.tsx
- i18n keys are complete for both clone flows (list page and details page)

---
*Phase: 25-clone-datasource*
*Completed: 2026-03-24*

## Self-Check: PASSED

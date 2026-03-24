---
plan: 25-02
phase: 25-clone-datasource
status: complete
started: 2026-03-24
completed: 2026-03-24
---

## What was built

Details page clone button and create form pre-fill from `location.state`, plus Playwright E2E tests.

### Changes

1. **DataSourceDetailsEnhanced.tsx** — Added Clone button to header (Back | Trigger | Clone | Edit), `handleClone` with `modal.confirm`, navigation with `cloneData` state
2. **DataSourceFormEnhanced.tsx** — Added `useLocation()` to read `cloneData`, `useEffect` to populate form fields + jsonSchema + outputConfig, `savedFieldValues` for ConnectionTab lazy-tab workaround, page title changes when cloning
3. **DataSourceList.tsx** — Fixed `Modal.confirm` → `modal.confirm` via `App.useApp()` (root cause: static Modal methods don't work inside `<App>` wrapper). Switched from Dropdown to icon-only buttons with Tooltips (Pattern 2)
4. **DataSourceDetailsEnhanced.tsx** — Same `App.useApp()` fix
5. **clone-datasource.spec.ts** — 3 Playwright E2E tests covering clone from list and details page

### Key discovery

**Ant Design 5 `Modal.confirm` static method is non-functional inside `<App>` wrapper.** Must use `App.useApp()` hook to get context-aware `modal` instance. This applies to `message`, `notification` too. Saved as global development standard.

### Self-Check

- [x] TypeScript compiles
- [x] Clone from list page: modal → confirm → navigate → pre-fill ✓
- [x] Clone from details page: modal → confirm → navigate → pre-fill ✓
- [x] Delete popconfirm works ✓
- [x] All 3 Playwright E2E tests pass `--headed`
- [x] Name prefixed with "העתק של" ✓
- [x] Page title shows "שכפול מקור נתונים" ✓

## Self-Check: PASSED

## key-files

### created
- `src/Frontend/tests/e2e/clone-datasource.spec.ts`

### modified
- `src/Frontend/src/pages/datasources/DataSourceDetailsEnhanced.tsx`
- `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx`
- `src/Frontend/src/pages/datasources/DataSourceList.tsx`
- `src/Frontend/src/components/datasource/shared/types.ts`

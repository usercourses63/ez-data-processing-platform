---
phase: 28-polish-i18n-release
plan: 01
subsystem: docs
tags: [playwright, screenshots, mermaid, docusaurus, documentation]

# Dependency graph
requires:
  - phase: 25-clone-datasource
    provides: Clone UI feature for screenshot subjects
  - phase: 26-completeness-checklist
    provides: Completeness panel UI for screenshot subjects
  - phase: 27-import-from-file
    provides: Import from file UI for screenshot subjects
provides:
  - Automated Playwright screenshot capture pipeline (15 screenshots)
  - Mermaid diagram rendering in Docusaurus documentation
  - Screenshot assets for Hebrew user guide pages
affects: [28-02, 28-03, docs-redesign]

# Tech tracking
tech-stack:
  added: [playwright (library), tsx, "@docusaurus/theme-mermaid"]
  patterns: [automated screenshot capture pipeline for docs]

key-files:
  created:
    - release-package/docs-docusaurus/scripts/capture-screenshots.ts
    - release-package/docs-docusaurus/scripts/tsconfig.json
    - release-package/docs-docusaurus/static/img/screenshots/ (15 PNGs)
  modified:
    - release-package/docs-docusaurus/package.json
    - release-package/docs-docusaurus/docusaurus.config.js
    - release-package/docs-docusaurus/docs/user-guide/completeness.md
    - release-package/docs-docusaurus/docs/user-guide/import-from-file.md
    - release-package/docs-docusaurus/docs/user-guide/clone-datasource.md

key-decisions:
  - "Used playwright library (not @playwright/test) since this is a capture script, not a test suite"
  - "Screenshots captured at 1280x800 with Hebrew locale for consistency with user guide"

patterns-established:
  - "Screenshot pipeline: npx tsx scripts/capture-screenshots.ts re-runs idempotently"

requirements-completed: [DOC-09, DOC-10]

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 28 Plan 01: Screenshot Pipeline & Mermaid Summary

**Automated Playwright pipeline capturing 15 frontend screenshots at 1280x800 plus Mermaid diagram rendering for Docusaurus docs**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T07:00:58Z
- **Completed:** 2026-03-26T07:08:49Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Built automated Playwright screenshot capture script covering clone, import, completeness, and general UI views
- All 15 screenshots captured successfully, each >10KB (valid PNGs)
- Installed and configured Mermaid theme for Docusaurus diagram rendering
- Docusaurus build passes with Mermaid enabled

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Playwright screenshot capture script** - `ee2c332` (feat)
2. **Task 2: Install Mermaid plugin for Docusaurus** - `9b9a9fa` (chore)
3. **Lock file update** - `9b7eb29` (chore)

## Files Created/Modified
- `release-package/docs-docusaurus/scripts/capture-screenshots.ts` - Automated 15-screenshot capture pipeline
- `release-package/docs-docusaurus/scripts/tsconfig.json` - TypeScript config for scripts
- `release-package/docs-docusaurus/package.json` - Added playwright, tsx, theme-mermaid deps + capture-screenshots script
- `release-package/docs-docusaurus/docusaurus.config.js` - Mermaid markdown config + theme
- `release-package/docs-docusaurus/static/img/screenshots/*.png` - 15 PNG screenshots (clone, import, completeness, general)
- `release-package/docs-docusaurus/docs/user-guide/completeness.md` - Fixed image paths
- `release-package/docs-docusaurus/docs/user-guide/import-from-file.md` - Fixed image paths
- `release-package/docs-docusaurus/docs/user-guide/clone-datasource.md` - Fixed image paths

## Decisions Made
- Used `playwright` library (not `@playwright/test`) since this is a standalone capture script, not a test suite
- Screenshots captured in headless Chromium with Hebrew locale (`he-IL`) and Accept-Language header
- 800ms delay after navigation for Ant Design animations to settle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed broken image paths in 3 user guide docs**
- **Found during:** Task 2 (Docusaurus build verification)
- **Issue:** User guide markdown files referenced screenshots with relative paths (`../static/img/screenshots/`) which Docusaurus cannot resolve during build
- **Fix:** Changed all image references to absolute paths (`/img/screenshots/`) which correctly resolve from the static directory
- **Files modified:** completeness.md, import-from-file.md, clone-datasource.md
- **Verification:** `npm run build` succeeds after fix
- **Committed in:** `9b9a9fa` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary for Docusaurus build to succeed. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all screenshots are real captures from the running frontend.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 15 screenshots available for Hebrew user guide and documentation pages
- Mermaid diagrams render in all markdown files using fenced code blocks
- Screenshot pipeline re-runnable via `npm run capture-screenshots` for future updates

## Self-Check: PASSED

- All key files exist (capture script, tsconfig, screenshots)
- 15 PNG screenshots in static/img/screenshots/ (all >10KB)
- All 3 commits found in git log (ee2c332, 9b9a9fa, 9b7eb29)
- Script is 549 lines (exceeds 100 line minimum)

---
*Phase: 28-polish-i18n-release*
*Completed: 2026-03-26*

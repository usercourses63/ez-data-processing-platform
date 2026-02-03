---
phase: "09"
plan: "04"
subsystem: "frontend"
tags: [help-button, docusaurus, rtl, hebrew, e2e-tests]
dependency-graph:
  requires: ["06-04"]
  provides: ["help-portal-integration", "docs-url-utility", "hebrew-user-guide-v0.2.0"]
  affects: ["10-release-polish"]
tech-stack:
  added: []
  patterns: ["runtime-environment-detection", "rtl-mdx-layout", "new-tab-navigation"]
key-files:
  created:
    - "src/Frontend/src/utils/docs-url.ts"
    - "src/Frontend/tests/e2e/help-integration.spec.ts"
  modified:
    - "src/Frontend/src/components/layout/AppHeader.tsx"
    - "release-package/docs-docusaurus/docs/user-guide-he.mdx"
decisions: ["runtime-url-detection-over-build-time", "mdx-for-rtl-support"]
metrics:
  duration: "6 min"
  completed: "2026-02-03"
---

# Phase 9 Plan 04: Help/Docs Portal Integration Summary

**One-liner:** Help button opens Docusaurus portal with runtime URL detection (localhost:3000/docs in dev, /docs in prod), plus Hebrew user guide MDX with full RTL layout.

## What Was Built

### 1. Docs URL Utility (Task 1)
- `src/Frontend/src/utils/docs-url.ts` (89 lines)
- Runtime environment detection via `window.location.hostname`
- `isProduction()` / `isDevelopment()` detection functions
- `getDocsBaseUrl()` returns `http://localhost:3000/docs` in dev, `/docs` in production
- `getDocsUrl(path?)` builds full documentation URLs
- Helper functions: `getHebrewUserGuideUrl()`, `getComponentDocsUrl(component)`, `openDocsInNewTab(path?)`

### 2. AppHeader Help Button Update (Task 2)
- `src/Frontend/src/components/layout/AppHeader.tsx` updated
- Import `openDocsInNewTab` from docs-url utility
- Help button onClick changed from `navigate('/help')` to `openDocsInNewTab()`
- Added `aria-label` for accessibility in both Hebrew and English
- Tooltip remains localized ("Help" / "עזרה")

### 3. Help Integration E2E Tests (Task 3)
- `src/Frontend/tests/e2e/help-integration.spec.ts` (249 lines)
- Tests Help button visibility in header
- Tests new tab opens with /docs URL pattern
- Verifies environment detection logic (dev vs prod URLs)
- Tests RTL and LTR mode functionality
- Verifies accessible aria-label attributes
- Visual baseline screenshots for Help button and tooltip

### 4. Hebrew User Guide MDX (Task 4)
- `release-package/docs-docusaurus/docs/user-guide-he.mdx` (813 lines)
- Converted from .md to .mdx for proper RTL component support
- Full RTL wrapper: `<div dir="rtl" lang="he" className="rtl-content" style={{textAlign: 'right', direction: 'rtl'}}>`
- Updated to v0.2.0 version content
- New sections: NAS/NFS management, NAS troubleshooting, NAS FAQ
- Technical content (code blocks) kept LTR for readability
- Updated system URL from localhost:3000 to localhost:7000
- Added Help button documentation in navigation section
- Updated glossary with NAS, NFS, PV/PVC terms

## Key Links Verified

| From | To | Via | Pattern |
|------|-----|-----|---------|
| AppHeader.tsx | docs-url.ts | import | `import { openDocsInNewTab }` |
| Help button onClick | /docs portal | window.open | `window.open(url, '_blank', ...)` |
| sidebars.js | user-guide-he.mdx | sidebar item | `'user-guide-he'` |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Runtime URL detection | Allows same bundle to work in dev and prod without rebuild |
| MDX over MD for Hebrew | MDX supports React components and better RTL styling |
| window.open for new tab | Standard browser API, respects user settings for popups |
| Technical content LTR | Code, paths, URLs more readable in LTR even in RTL document |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | b494583 | feat(09-04): add docs-url utility for runtime environment detection |
| 2 | 744b735 | feat(09-04): update Help button to open Docusaurus portal in new tab |
| 3 | b848165 | test(09-04): add Help integration E2E tests |
| 4 | de7e430 | docs(09-04): update Hebrew user guide to MDX with RTL layout for v0.2.0 |

## Next Phase Readiness

**Phase 10 Preconditions Met:**
- [x] Help button opens documentation portal
- [x] Environment-aware URL detection working
- [x] Hebrew user guide updated for v0.2.0
- [x] RTL layout verified in MDX format
- [x] E2E tests cover help integration

**Files Ready for Phase 10:**
- Frontend Help integration complete
- Docusaurus Hebrew guide ready for release
- No blockers for Release & Polish phase

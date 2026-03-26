---
phase: 28-polish-i18n-release
plan: 10
status: completed
completed_at: "2026-03-26"
---

## Summary

Comprehensive documentation enhancement of the Hebrew user guide. Added 3 new chapters (Alerts, System Settings, Invalid Records), expanded existing chapters with full field-level detail, and captured 52 screenshots covering every system page and dialog.

## Artifacts

### New Chapters (3)
- `docs/user-guide/alerts.md` — Alert management: 3 metric types, 7 PromQL templates, severity/duration settings, global config
- `docs/user-guide/system-settings.md` — Categories, Input/Output servers (all 8 protocol types), NAS devices (provision, mount options, PV/PVC)
- `docs/user-guide/invalid-records.md` — Record viewing, filtering (9 error types), editing with schema hints, bulk operations, JSON export

### Enhanced Chapters (7+index)
- `docs/user-guide/create-datasource.md` — Expanded from 9 steps to full field-level detail: all 8 form tabs documented with every field, validation rule, archive settings, schema editing with Monaco, output destinations
- `docs/user-guide/schema-validation.md` — Added Mermaid validation flow, Regex helper table, template list, tips
- `docs/user-guide/scheduling.md` — Replaced text diagram with Mermaid, added screenshots
- `docs/user-guide/monitoring.md` — Added OTEL architecture Mermaid, device health screenshots, tips
- `docs/user-guide/getting-started.md` — Added navigation Mermaid, 4 screenshots, tips section
- `docs/user-guide/troubleshooting.md` — Added problem-solving Mermaid flowchart, screenshot
- `docs/user-guide/index.md` — Updated TOC from 9 to 12 chapters, expanded Mermaid navigation map

### Screenshots (52 total)
- `scripts/capture-screenshots.ts` — Main pipeline (30 captures)
- `scripts/fix-screenshots.ts` — Fix pipeline with proper app-load waits (recaptured all 30 + modals)
- All 52 PNGs verified >10KB, showing actual content (no loading screens)

### Sidebar & Build
- `sidebars.js` — Added 3 new user-guide entries
- `npm run build` passes with zero errors (en + he)

## Acceptance Criteria
- [x] All 13 chapters contain Mermaid diagrams (1 each)
- [x] All 13 chapters contain screenshot references (1-8 each, 48 total refs)
- [x] All 13 chapters wrapped in `<div dir="rtl">`
- [x] 52 PNG screenshots (all >10KB, verified content)
- [x] `npm run build` exits with code 0
- [x] index.md TOC matches all 13 chapter files
- [x] Sidebar navigation includes all chapters

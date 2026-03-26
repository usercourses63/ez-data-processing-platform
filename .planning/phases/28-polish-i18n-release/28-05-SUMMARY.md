---
phase: 28-polish-i18n-release
plan: 05
subsystem: docs
tags: [documentation, hebrew, rtl, docusaurus, user-guide, i18n]

# Dependency graph
requires:
  - phase: 28-01
    provides: Screenshot images referenced in chapters
  - phase: 28-02
    provides: import-from-file.md chapter
  - phase: 28-03
    provides: clone-datasource.md chapter
  - phase: 28-04
    provides: completeness.md chapter
provides:
  - asset: Multi-chapter Hebrew user guide
    to: release-package/docs-docusaurus/docs/user-guide/
  - asset: Updated sidebar navigation
    to: release-package/docs-docusaurus/sidebars.js
affects:
  - release-package/docs-docusaurus/docs/user-guide-he.mdx (deprecated with draft: true)

# Tech stack
added: []
patterns:
  - Per-chapter RTL div wrapper for Hebrew content
  - Cross-chapter relative linking
  - Sidebar category with collapsed: false for user guide

# Key files
created:
  - release-package/docs-docusaurus/docs/user-guide/index.md
  - release-package/docs-docusaurus/docs/user-guide/getting-started.md
  - release-package/docs-docusaurus/docs/user-guide/create-datasource.md
  - release-package/docs-docusaurus/docs/user-guide/schema-validation.md
  - release-package/docs-docusaurus/docs/user-guide/scheduling.md
  - release-package/docs-docusaurus/docs/user-guide/monitoring.md
  - release-package/docs-docusaurus/docs/user-guide/troubleshooting.md
modified:
  - release-package/docs-docusaurus/sidebars.js
  - release-package/docs-docusaurus/docs/user-guide-he.mdx

# Decisions
key-decisions:
  - Preserved all content from monolithic guide; redistributed rather than rewritten
  - Added v0.4.0 feature cross-references (import, clone, completeness) into existing chapters
  - Used markdown admonitions (tip, warning) for actionable guidance
  - Kept old user-guide-he.mdx as draft for URL backwards-compatibility

# Metrics
duration: 7m
completed: "2026-03-26T07:18:00Z"
tasks_completed: 2
tasks_total: 2
files_created: 7
files_modified: 2
---

# Phase 28 Plan 05: Hebrew User Guide Restructuring Summary

Split monolithic 1093-line user-guide-he.mdx into 10 navigable chapters with RTL support and updated sidebar

## What Was Done

### Task 1: Extract existing content into chapter files (33daa32)

Split the monolithic Hebrew user guide into 7 new chapter files (joining the 3 already created by plans 02-04):

| Chapter | File | Lines | Content |
|---------|------|-------|---------|
| Index | index.md | 62 | Overview, v0.4.0 highlights, TOC linking all 10 chapters |
| Getting Started | getting-started.md | 93 | Login, navigation, UI overview, language toggle, first steps |
| Create Datasource | create-datasource.md | 195 | Full 9-step manual creation workflow (all tabs) |
| Import from File | import-from-file.md | 148 | (Created by plan 28-02) |
| Clone Datasource | clone-datasource.md | 109 | (Created by plan 28-03) |
| Completeness | completeness.md | 136 | (Created by plan 28-04) |
| Schema Validation | schema-validation.md | 127 | JSON Schema, templates, visual editor, auto-generated schemas |
| Scheduling | scheduling.md | 123 | Cron expressions, schedule types, manual triggers |
| Monitoring | monitoring.md | 193 | System dashboard, device health, NAS management, Grafana, OTEL |
| Troubleshooting | troubleshooting.md | 229 | 6 error types, FAQ (15 Q&As), glossary (17 terms), tips |

**Total:** 1,415 lines across 10 chapter files.

### Task 2: Update sidebar navigation (16d3295)

- Replaced single `user-guide-he` sidebar entry with 10-chapter category
- Sidebar label changed to bilingual: "User Guide / מדריך למשתמש"
- Old user-guide-he.mdx marked with `draft: true` (hidden from nav, URL preserved)
- `npm run build` passes (only pre-existing broken anchors in deployment-troubleshooting-guide)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All chapters contain substantive Hebrew content extracted from the original guide plus v0.4.0 feature cross-references.

## Self-Check: PASSED

All 7 created files verified. Both commits (33daa32, 16d3295) confirmed in git log. Sidebar references validated via successful `npm run build`.

---
gsd_state_version: 1.0
milestone: v0.2
milestone_name: Production Validation & Release
status: Phase complete — ready for verification
stopped_at: Completed 29-07-PLAN.md
last_updated: "2026-03-26T12:16:53.268Z"
progress:
  total_phases: 30
  completed_phases: 26
  total_plans: 112
  completed_plans: 107
---

## Current Position

Phase: 28 (polish-i18n-release) — NOT STARTED
Plan: 0 of 0

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Files flow reliably from any source through validation to any destination
**Current focus:** Phase 28 — Polish, i18n & Release

## Performance Metrics

**Velocity:**

- Phases 25-27 completed in v0.4.0 milestone
- Phase 25 (Clone): 1 session
- Phase 26 (Completeness): 3 sessions
- Phase 27 (Import from File): 4 sessions

## Accumulated Context

### Decisions

- All 3 features are frontend-only (React 19 + Ant Design 5.x + TypeScript)
- Phase order: Clone (25) -> Checklist (26) -> Import (27) -> Polish/Release (28)
- Phase 27 expanded scope: backend SharpCompress archive API for ZIP/TAR.GZ/7Z/RAR
- Auto-create datasource on import Continue (not just pre-fill form)
- Archive fields tracked in completeness when isArchiveSource=true
- Clone preserves all archive settings (lazy tab merge fix)
- Hebrew i18n for all auto-create messages
- [Phase 28-polish-i18n-release]: Hebrew user guide uses per-chapter template with RTL div wrapper and Mermaid diagrams
- [Phase 28]: Hebrew import-from-file chapter uses per-chapter template with RTL wrapper, Mermaid diagram, screenshot refs
- [Phase 28]: Hebrew completeness chapter uses actual he.json keys for consistent terminology
- [Phase 28]: Used playwright library (not @playwright/test) for screenshot capture script; fixed broken relative image paths in user guide docs
- [Phase 28]: Updated stale Unreleased/Next Release sections from v0.3.0 to v0.5.0 in changelog and release notes
- [Phase 28]: Hebrew user guide split into 10 workflow-centric chapters with RTL wrapper; old monolithic file kept as draft
- [Phase 28]: Used build-all-images.sh with docker/ Dockerfiles for all 10 v0.4.0 images
- [Phase 29]: Schema change detected by comparing BsonDocument JSON before/after mapping; auto-increment SchemaVersion overrides request value
- [Phase 29]: Daily Quartz.NET purge at 3 AM UTC for expired invalid records with per-datasource TTL override
- [Phase 29]: SignalR CORS uses SetIsOriginAllowed + AllowCredentials for InvalidRecordsService hub
- [Phase 29]: Used location.state for cross-page tab activation from EditRecordModal to Schema tab
- [Phase 29]: YAML download via js-yaml is frontend-only (no backend round-trip)
- [Phase 29]: Used App.useApp() for SignalR toast notifications per CLAUDE.md (not static message import)
- [Phase 29]: E2E tests use API context for dynamic datasource lookup and conditional skip for data-dependent tests
- [Phase 29]: Screenshot refs commented out as MDX comments for Docusaurus build; v0.5.0 used for changelog version

### Blockers/Concerns

- Lazy tab + Form.setFieldsValue bug: requires retry at 500ms/1500ms for unmounted tabs
- Ant Design Input.Password in lazy tabs needs same retry pattern

## Session Continuity

Last session: 2026-03-26T12:16:53.264Z
Stopped at: Completed 29-07-PLAN.md
Resume file: None

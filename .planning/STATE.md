---
gsd_state_version: 1.0
milestone: v0.2
milestone_name: Production Validation & Release
status: Executing Phase 34
stopped_at: Completed quick task 260602-odp (page header RTL/LTR alignment)
last_updated: "2026-06-02T16:06:32.928Z"
progress:
  total_phases: 35
  completed_phases: 33
  total_plans: 132
  completed_plans: 125
  percent: 94
---

## Current Position

Phase: 34 (s3-minio-connector-iam-credentials-bug-fix) — EXECUTING
Plan: 1 of 6

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Files flow reliably from any source through validation to any destination
**Current focus:** Phase 34 — s3-minio-connector-iam-credentials-bug-fix

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
- [Phase 28]: All non-user-guide Docusaurus docs updated to v0.4.0 with version-scoped sections
- [Phase 28-09]: Version bumped to v0.5.0 across frontend (package.json), Docusaurus (config + user guide), changelog
- [Phase 28-09]: Sanity tests fixed: antTabClick helper for RTL, PascalCase API fields, deletedBy param, API-based verification
- [Phase 28-09]: nginx ConfigMap updated with /hubs/invalid-records proxy for SignalR revalidation notifications
- [Phase 28-09]: Help page and footer doc links redirect to Docusaurus v0.5.0 at port 30800
- [Phase 28-09]: Docusaurus viewer Go binaries built for all 4 platforms (Windows/Linux/macOS x64+ARM)
- [Phase 30]: All 8 new sanity tests are API-only (no page.goto) for speed and reliability
- [Phase 30]: Pinned OTEL collector to v0.96.0, frontend/demo-generator to v0.5.0; OCP compliance script uses runtime pod inspection via kubectl+jq
- [Phase 31]: Completeness E2E Test 7 upgraded to use API-created datasource with try/finally cleanup pattern
- [Phase 31]: Clone E2E tests: inline helper copies for test isolation, try/finally API cleanup
- [Phase 31]: Used Hebrew regex /[\u05D0-\u05EA]/ for feature-specific i18n regression testing
- [Phase 31]: Import E2E tests: reused sanity.spec.ts helpers (antTabClick, extractId) for consistency
- [Phase 32-01]: Static NFS only for acceptance gate — dynamic NAS pods use alpine:latest (wrong image), separate bug deferred
- [Phase 32-01]: Port-forwards must be restarted after --provision-nas rollout (pod rollout severs existing kubectl port-forward)
- [Phase 32-01]: Full RBAC wipe (ClusterRole + ClusterRoleBinding) required before Helm reinstall
- [Phase 32-02]: Chrome MCP tools unavailable in executor; used API calls as fallback for CRUD validation
- [Phase 32-02]: All 6 static NFS NAS devices provisioned successfully on clean cluster
- [Phase 32-03]: MassTransit uses RabbitMQ (not Kafka) for pipeline messaging — CLAUDE.md docs are inaccurate; pipeline tasks confirmed via 28 RabbitMQ message acks
- [Phase 32-03]: FTP passive mode blocked by NodePort (data channel not exposed); NFS connector needs pod mount path; full file cycle test deferred
- [Phase 32-03]: Docusaurus NodePort 30800 verified at HTTP 200, v0.5.0 content, getDocsBaseUrl() auto-detection confirmed working

### Roadmap Evolution

- Phase 30 added: OCP Compliance & Deployment Validation (production release gate)
- Phase 31 added: Feature Test Coverage (completeness, clone, import E2E tests)
- Phase 32 added: Performance & Regression Hardening (post-OCP deploy, lower priority)

### Blockers/Concerns

- Lazy tab + Form.setFieldsValue bug: requires retry at 500ms/1500ms for unmounted tabs
- Ant Design Input.Password in lazy tabs needs same retry pattern

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260602-odp | in the UI page header: when Hebrew, align text and title RTL; when English, LTR | 2026-06-02 | 29ff994 | [260602-odp-in-the-ui-page-header-when-hebrew-align-](./quick/260602-odp-in-the-ui-page-header-when-hebrew-align-/) |

## Session Continuity

Last session: 2026-03-27T20:00:00.000Z
Stopped at: Completed quick task 260602-odp (page header RTL/LTR alignment)
Resume file: None

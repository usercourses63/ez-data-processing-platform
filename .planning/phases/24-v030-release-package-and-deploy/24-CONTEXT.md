# Phase 24: v0.3.0 Release Package & Deploy — Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Based on Phase 21 (v0.2 release package) — same scripts, updated version + content

<domain>
## Phase Boundary

Package and release v0.3.0 with all changes from today's session. Reuses Phase 21 infrastructure (build scripts, CI pipeline, assemble-package) with updated version, documentation, and sanity tests.

**What this phase IS:**
- Update frontend version display from v0.2.0 to v0.3.0
- Update Docusaurus documentation for v0.3.0 features
- Build all 10 service images from source with v0.3.0 tag
- Assemble offline deployment package (deployment-v0.3.0-{timestamp}/)
- Run sanity tests against deployed v0.3.0

**What this phase is NOT:**
- Not implementing new features (all already committed)
- Not changing the pipeline scripts (reuse from Phase 21)
- Not modifying CI/CD workflow (reuse existing)

</domain>

<decisions>
## Implementation Decisions

### Version Update
- Frontend version: update `src/Frontend/src/App.tsx` or footer component to show `v0.3.0`
- Also update `package.json` version to `0.3.0`
- CLAUDE.md version reference should be updated

### Documentation (Docusaurus)
- Add release notes page for v0.3.0 in `docs/docusaurus/`
- Document NAS UX improvements: SignalR sync for Servers/Categories, delete→deprovision, status tags
- Document monitoring fixes: Device Health tab, RabbitMQ queues, pipeline lanes, traces
- Document pipeline fixes: FileServerId, FTP connector, NasDeviceId extraction
- Update any existing pages that reference v0.2.0

### Image Builds
- Use existing `scripts/build-all-images.sh` from Phase 21
- Tag: `ez-platform/{service}:v0.3.0`
- All 10 services: datasource-management, validation, fileprocessor, filediscovery, scheduling, output, invalid-records, metrics-configuration, frontend, docusaurus
- FileDiscoveryService now has a Dockerfile (created this session)

### Deployment Package
- Use existing `scripts/assemble-package.sh` from Phase 21
- Output: `deployment-v0.3.0-{YYYYMMDD}-{HHMMSS}/`
- Same canonical structure as v0.2.0 package

### Sanity Tests (v0.3.0 specific)
- Existing sanity suite from Phase 23 should pass
- Add/update tests for:
  1. NAS lifecycle (create→connect→provision→deprovision→delete) — use `nas-lifecycle-demo.spec.ts`
  2. Monitoring Device Health tab renders cards
  3. FTP E2E pipeline (file discovery through NAS/FTP server)
  4. NAS pipeline (create datasource via UI, trigger, verify file discovery)
  5. SignalR EntityChanged sync (Servers, Categories)
- NAS tests should use erichough/nfs-server (NFSv4) devices, NOT unfs3 (NFSv3)

### Claude's Discretion
- Exact Docusaurus page structure and content
- Which existing sanity tests to update vs add new ones
- Order of operations within the phase

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 21 (template for this phase)
- `.planning/phases/21-release-package-and-ci-pipeline/21-CONTEXT.md` — Original release package design
- `.planning/phases/21-release-package-and-ci-pipeline/21-01-PLAN.md` — Build scripts plan
- `.planning/phases/21-release-package-and-ci-pipeline/21-02-PLAN.md` — Helm deploy plan
- `.planning/phases/21-release-package-and-ci-pipeline/21-03-PLAN.md` — Sanity tests plan
- `.planning/phases/21-release-package-and-ci-pipeline/21-04-PLAN.md` — Package assembly plan

### Build Scripts (from Phase 21)
- `scripts/build-all-images.sh` — Builds all 10 service images
- `scripts/pull-infra-images.sh` — Pulls infrastructure images
- `scripts/assemble-package.sh` — Assembles deployment folder

### Existing Sanity Tests
- `src/Frontend/tests/e2e/nas-lifecycle-demo.spec.ts` — NAS full lifecycle
- `src/Frontend/tests/e2e/nas-ux-manual-verification.spec.ts` — NAS UX verification
- `src/Frontend/tests/e2e/v030-e2e-ftp-pipeline.spec.ts` — FTP pipeline
- `src/Frontend/tests/e2e/v030-e2e-nas-pipeline.spec.ts` — NAS pipeline
- `src/Frontend/tests/e2e/v030-selection-verification.spec.ts` — Input/output server selection

### Documentation
- `docs/docusaurus/` — Docusaurus site source

### Frontend Version
- `src/Frontend/package.json` — version field
- `src/Frontend/src/` — footer component showing version

</canonical_refs>

<specifics>
## Specific Ideas

- The FileDiscoveryService now has a Dockerfile at `src/Services/FileDiscoveryService/Dockerfile` (created this session)
- Multi-NAS (unfs3) servers do NOT support NFSv4 — sanity tests must use erichough NAS servers (nfs-input-data, nfs-output-data)
- Pipeline deployments need `hostAliases` for `file-simulator.local` → `172.30.26.249`
- The `DeduplicationTTLHours` configmap value was changed from `0.25` to `1` (integer required)

</specifics>

<deferred>
## Deferred Ideas

- OpenTelemetry MassTransit trace propagation (v0.4)
- NAS E2E with unfs3 (NFSv3) servers
- Multi-destination NAS output test

</deferred>

---

*Phase: 24-v030-release-package-and-deploy*
*Context gathered: 2026-03-20 from session work + Phase 21 template*

# Roadmap: EZ Data Processing Platform

## Overview

This roadmap transforms a mature but under-tested brownfield system (v0.1.1-rc3) into a production-confident platform. The journey prioritizes testing foundation first (establishing confidence in existing features via file-simulator), NAS/NFS architecture implementation (enabling external file access), then CI/CD automation (enabling reliable deployments), followed by documentation consolidation (cleaning 270+ docs), frontend workflow establishment, and finally completing v0.2.0 feature work. Every phase builds on the previous, culminating in a system where changes can be made and deployed with confidence.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, ...): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: File-Simulator Integration** - Establish file-simulator infrastructure and connectivity verification
- [x] **Phase 2: NAS/NFS Architecture Implementation** - Implement NAS device entity and K8s PV/PVC dynamic mounting via .NET 10 API
- [x] **Phase 3: Protocol Test Coverage** - Verify all 8 protocols work correctly against file-simulator (including NFS via NAS devices)
- [x] **Phase 4: Format & Pipeline Testing** - Validate format conversions and end-to-end pipeline paths
- [x] **Phase 5: CI/CD Foundation** - Automated builds, pipeline quality gates, version injection, and Docusaurus build
- [x] **Phase 6: Deployment Automation** - Helm packaging, OCP deployment, Docusaurus portal deployment, documentation workflow
- [x] **Phase 7: Documentation Audit & Archive** - Audit 270+ docs, archive session logs, delete obsolete
- [x] **Phase 8: Documentation Consolidation** - GSD as single source of truth, guides consolidated
- [x] **Phase 9: Frontend Development Workflow** - Design tooling, testing strategy, Docusaurus portal integration
- [ ] **Phase 10: Feature Completion** - v0.2.0 External File Access, AdminServer, Archive settings, NAS validation

## Phase Details

### Phase 1: File-Simulator Integration
**Goal**: File-simulator infrastructure integrated and connectivity verified
**Depends on**: Nothing (first phase)
**Requirements**: TEST-04, TEST-06
**Success Criteria** (what must be TRUE):
  1. File-simulator is accessible from EZ Platform test environment (cross-cluster communication verified)
  2. EZ Platform ConfigMaps point to file-simulator endpoints for FTP, SFTP, S3, SMB, NFS, HTTP
  3. Existing E2E tests still pass (no regressions from infrastructure changes)
  4. Test setup documentation exists explaining how to configure file-simulator connection
**Note**: Actual protocol integration testing (verifying connectors work via file-simulator) is deferred to Phase 3.
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md - Infrastructure setup: ConfigMap, deployment updates, verification script
- [x] 01-02-PLAN.md - Documentation and no-regression verification

### Phase 2: NAS/NFS Architecture Implementation
**Goal**: NAS devices can be configured and dynamically mounted to pods via Kubernetes API
**Depends on**: Nothing (can run in parallel with Phase 1)
**Requirements**: NAS-01, NAS-02, NAS-03, NAS-04, NAS-05, NAS-06, NAS-07
**Reference**: C:\Users\UserC\source\repos\file-simulator-suite (NAS simulation)
**Success Criteria** (what must be TRUE):
  1. NAS device entity exists with full connection configuration (host, share path, credentials, mount options)
  2. PersistentVolume can be created dynamically via .NET 10 Kubernetes API for NAS devices
  3. PersistentVolumeClaim binds successfully to dynamically created PV
  4. Volumes mount to pods at runtime via K8s API (not static manifests)
  5. NFS protocol connector routes through NAS device configuration (not standalone NFS server)
  6. AdminServer UI supports NAS device CRUD operations
  7. NAS device creation/mounting tested against file-simulator NAS simulation
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md - NAS device entity and RBAC manifests
- [x] 02-02-PLAN.md - Kubernetes client DI and NasResourceService for PV/PVC operations
- [x] 02-03-PLAN.md - NasDevicesController REST API and business logic service
- [x] 02-04-PLAN.md - NFS connector integration with NAS device mount paths
- [x] 02-05-PLAN.md - Frontend NasDevicesTab UI and API client
- [x] 02-06-PLAN.md - Integration testing and deployment configuration

### Phase 3: Protocol Test Coverage
**Goal**: Every file protocol has verified integration tests against file-simulator
**Depends on**: Phase 1, Phase 2
**Requirements**: TEST-02
**Success Criteria** (what must be TRUE):
  1. FTP connector reads/writes files successfully via file-simulator FTP server
  2. SFTP connector reads/writes files successfully via file-simulator SFTP server
  3. S3/MinIO connector reads/writes files successfully via file-simulator S3 endpoint
  4. SMB connector reads/writes files successfully via file-simulator SMB share
  5. NFS protocol tested accessing file-simulator NAS devices (via NAS device entity and dynamic PV/PVC)
  6. HTTP/WebDAV connector reads files successfully via file-simulator HTTP endpoint
  7. Kafka connector produces/consumes messages successfully (existing tests validated)
  8. Local connector tests documented as OCP-incompatible (reference only)
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md - Test infrastructure (FileSimulatorFixture) and FTP, SFTP, HTTP tests
- [x] 03-02-PLAN.md - SMB connector implementation and S3, SMB tests
- [x] 03-03-PLAN.md - NFS tests via NAS devices and Kafka connector tests
- [x] 03-04-PLAN.md - Local connector tests (OCP-incompatible) and protocol test documentation

### Phase 4: Format & Pipeline Testing
**Goal**: All format conversions verified and critical pipeline paths have automated tests
**Depends on**: Phase 3
**Requirements**: TEST-01, TEST-03, TEST-07, TEST-08
**Success Criteria** (what must be TRUE):
  1. CSV to JSON conversion verified bidirectionally with sample files
  2. JSON parsing and output verified with nested structures
  3. XML to JSON conversion verified bidirectionally
  4. Excel (.xlsx) to JSON conversion verified with multi-sheet workbooks
  5. Pipeline integration tests cover: discovery -> processing -> validation -> output
  6. Load tests demonstrate 100-1000 file throughput via file-simulator
  7. Test documentation generated and committed to .planning/
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md - Format conversion tests (bidirectional round-trip for CSV, JSON, XML, Excel)
- [x] 04-02-PLAN.md - Pipeline integration tests (discovery -> processing -> validation -> output)
- [x] 04-03-PLAN.md - Load testing (100-1000 files) and documentation

### Phase 5: CI/CD Foundation
**Goal**: Every commit triggers automated builds with test quality gates, version injection, and Docusaurus build
**Depends on**: Phase 4
**Requirements**: TEST-05, CD-01, CD-03, CD-07, CD-08, CD-09
**Success Criteria** (what must be TRUE):
  1. Single command (script or make target) builds all 9 service Docker images
  2. GitHub Actions workflow triggers on every push to main and feature branches
  3. CI pipeline runs integration tests as quality gate before merge
  4. Build failures block PR merges
  5. Docker images are tagged with git commit SHA for traceability
  6. Version is injected into frontend version.ts during build (semantic version + build date + commit SHA)
  7. Version is injected into Docusaurus docusaurus.config.js during build
  8. Docusaurus portal builds successfully in CI pipeline (release-package/docs-docusaurus)
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md - Parallel Docker build script with version injection to all Dockerfiles
- [x] 05-02-PLAN.md - GitHub Actions CI workflow with build, test, docker jobs
- [x] 05-03-PLAN.md - Docusaurus Dockerfile and CI integration

### Phase 6: Deployment Automation
**Goal**: One-command deployment to OCP with automated validation, rollback, and Docusaurus portal deployment
**Depends on**: Phase 5
**Requirements**: CD-02, CD-04, CD-05, CD-06, CD-10, CD-11
**Success Criteria** (what must be TRUE):
  1. Helm charts packaged with semantic versioning
  2. Automated deployment script works against offline OCP environment
  3. Post-deployment smoke tests validate all services are healthy
  4. Rollback procedure documented and tested (restores previous version)
  5. Deployment can be triggered from CI/CD pipeline
  6. Docusaurus portal deployed as K8s service in ez-platform namespace
  7. Ingress configured for /docs path routing to Docusaurus portal
  8. Documentation update process documented (GSD markdown -> Docusaurus before each release)
**Plans**: 4 plans

Plans:
- [x] 06-01-PLAN.md - Helm chart versioning (v0.2.0), smoke test hooks, environment values files
- [x] 06-02-PLAN.md - Image export script, database init hook, OCP deployment documentation
- [x] 06-03-PLAN.md - Rollback procedures and smoke test execution guide
- [x] 06-04-PLAN.md - Docusaurus /docs path routing and documentation workflow

### Phase 7: Documentation Audit & Archive
**Goal**: All 401 existing documents (excluding .planning/) audited, categorized, and obsolete content archived/deleted
**Depends on**: Phase 1 (can run in parallel with Phases 2-6)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. Complete inventory of all 401 docs (excluding .planning/) with categorization (keep/archive/delete)
  2. Session logs moved to /docs/archive/sessions/ with index
  3. Obsolete/redundant documentation deleted from main docs/ tree
  4. Remaining docs tagged with last-verified date
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md - Documentation inventory and categorization (PowerShell inventory, batch categorization, reports)
- [x] 07-02-PLAN.md - Archive session logs and delete obsolete docs (git mv operations, YAML frontmatter, index update)

### Phase 8: Documentation Consolidation ✓ Complete (2026-02-02)
**Goal**: GSD becomes single source of truth, all guides consolidated
**Depends on**: Phase 7
**Requirements**: DOC-04, DOC-05
**Success Criteria** (what must be TRUE):
  1. .planning/ contains all active project planning documentation
  2. Architecture guide consolidated from scattered sources into coherent document
  3. Deployment guide consolidated with current OCP procedures
  4. Testing guide documents test strategy, running tests, and coverage
  5. No planning/execution docs exist outside .planning/ structure
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md - GSD structure finalization
- [x] 08-02-PLAN.md - Architecture and deployment guide consolidation
- [x] 08-03-PLAN.md - Testing guide consolidation

### Phase 9: Frontend Development Workflow
**Goal**: Frontend development has established tooling, testing, coordination patterns, and Docusaurus portal integration
**Depends on**: Phase 4 (testing patterns established), Phase 6 (portal deployed)
**Requirements**: FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, FE-07
**Success Criteria** (what must be TRUE):
  1. Component library documented with Storybook or equivalent
  2. Playwright E2E tests cover critical user journeys (data source CRUD, schema management)
  3. Frontend/backend API change coordination process documented
  4. React 19 patterns documented (hooks, suspense, server components if applicable)
  5. RTL/Hebrew testing verified in E2E tests
  6. Frontend integrates with Docusaurus portal (dual approach: inline user guide + Help button linking to /docs)
  7. Documentation link is environment-aware (localhost:3000 in dev, /docs in production via config)
  8. Hebrew user guide in Docusaurus displays correctly (RTL layout, right-justified text verified)
**Plans**: 4 plans

Plans:
- [x] 09-01-PLAN.md — Component library documentation in Docusaurus MDX (FE-01)
- [x] 09-02-PLAN.md — Playwright E2E tests for schema management and RTL visual regression (FE-02, FE-05)
- [x] 09-03-PLAN.md — API coordination process and React 19 patterns documentation (FE-03, FE-04)
- [x] 09-04-PLAN.md — Help button integration + Hebrew user guide (FE-05, FE-06, FE-07)

### Phase 10: Feature Completion
**Goal**: v0.2.0 feature work completed with documentation and tests, NAS/NFS architecture validated production-ready
**Depends on**: Phases 6, 8, 9 (infrastructure, docs, frontend workflow ready)
**Requirements**: FEAT-01, FEAT-02, FEAT-03
**Success Criteria** (what must be TRUE):
  1. External File Access v0.2.0 documentation complete in GSD structure
  2. E2E tests cover AdminServer CRUD via UI (including NAS device management)
  3. E2E tests cover data source with admin server reference
  4. Archive settings UI tested end-to-end
  5. AdminServer architecture documented in ARCHITECTURE.md (including NAS device entity)
  6. All protocols support archive settings (where applicable)
  7. NAS/NFS architecture validated production-ready (dynamic mounting works in OCP)
**Plans**: 4 plans

Plans:
- [ ] 10-01-PLAN.md — Datasource-NAS integration and archive extraction backend
- [ ] 10-02-PLAN.md — v0.2.0 documentation completion (NAS architecture, release notes, Hebrew guide)
- [ ] 10-03-PLAN.md — AdminServer, NAS device, and archive extraction E2E tests
- [ ] 10-04-PLAN.md — Release preparation and NAS production validation (checkpoint)

## Progress

**Execution Order:**
Phases execute in numeric order. Phase 2 (NAS/NFS) can run in parallel with Phase 1. Phases 7-8 (Documentation) can run in parallel with Phases 2-6 after Phase 1 completes.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. File-Simulator Integration | 2/2 | Complete | 2026-02-02 |
| 2. NAS/NFS Architecture Implementation | 6/6 | Complete | 2026-02-02 |
| 3. Protocol Test Coverage | 4/4 | Complete | 2026-02-02 |
| 4. Format & Pipeline Testing | 3/3 | Complete | 2026-02-02 |
| 5. CI/CD Foundation | 3/3 | Complete | 2026-02-02 |
| 6. Deployment Automation | 4/4 | Complete | 2026-02-03 |
| 7. Documentation Audit & Archive | 2/2 | Complete | 2026-02-02 |
| 8. Documentation Consolidation | 3/3 | Complete | 2026-02-02 |
| 9. Frontend Development Workflow | 4/4 | Complete | 2026-02-03 |
| 10. Feature Completion | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-02*
*Roadmap revised: 2026-02-02 (added Phase 2 NAS/NFS Architecture)*
*Roadmap revised: 2026-02-02 (added Docusaurus portal integration requirements)*
*Phase 1 planned: 2026-02-02 (2 plans in 2 waves)*
*Phase 1 revised: 2026-02-02 (narrowed scope to infrastructure + connectivity; protocol tests deferred to Phase 3)*
*Phase 2 planned: 2026-02-02 (6 plans in 5 waves)*
*Phase 3 planned: 2026-02-02 (4 plans in 2 waves)*
*Phase 4 planned: 2026-02-02 (3 plans in 3 waves)*
*Phase 5 planned: 2026-02-02 (3 plans in 3 waves)*
*Phase 6 planned: 2026-02-03 (4 plans in 2 waves)*
*Phase 9 planned: 2026-02-03 (4 plans in 2 waves)*
*Depth: Comprehensive (10 phases)*
*Total requirements: 45 | Mapped: 45*

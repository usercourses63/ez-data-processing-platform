# Roadmap: EZ Data Processing Platform

## Milestones

- v0.1 **Testing Foundation + Infrastructure** — Phases 1-10 (shipped 2026-02-11) — [archive](milestones/v0.1-ROADMAP.md)
- v0.2 **Production Validation & Release** — Phases 11-21 (in progress)
- v0.3 **NAS UX + Monitoring + Release** — Phase 22-24 (in progress)
- v0.4 **Datasource Productivity Features** — Phases 25-28 (planned)

## Next Milestone

### v0.2 Production Validation & Release

**Milestone Goal:** Ship production-ready v0.2.0 with complete NAS lifecycle, real-time monitoring, OTEL verification, and offline deployment capability.

## Phases

**Phase Numbering:**
- Integer phases (11, 12, 13): Planned milestone work
- Decimal phases (12.1, 12.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 11: Bug Fixes & UI Polish** - Fix Hebrew/RTL regressions, unwanted translations, NAS dropdown ✓ (2026-02-11)
- [x] **Phase 12: NAS Lifecycle Completion** - Auto-mount, DataSource linking, PVC verification, delete lifecycle ✓ (2026-02-11)
- [ ] **Phase 13: AdminServer & Feature Completion** - File-simulator integration, NAS auto-test in forms
- [x] **Phase 14: OTEL Verification** - Verify logs, traces, metrics for all 9 microservices (completed 2026-02-25)
- [x] **Phase 15: Device Health Monitoring** - Real monitoring data, device health/latency monitoring (completed 2026-02-25)
- [x] **Phase 15.1: Protocol File Operations Testing** - Test all device protocols against file-simulator (INSERTED) (completed 2026-03-16)
- [x] **Phase 16: SignalR Real-Time Updates** - SignalR hub for System Monitoring page (completed 2026-03-16)
- [x] **Phase 17: File-Simulator Integration** - API documentation, DemoDataGenerator integration (completed 2026-03-16)
- [ ] **Phase 18: E2E Validation** - Full file flow tests, error tests, Playwright UI verification (gap closure in progress)
- [x] **Phase 19: Documentation Update** - Docusaurus content update, container build, help link verification (completed 2026-03-17)
- [x] **Phase 20: CI/CD & Production Deployment** - Pipeline, version display, local prod mode, OCP resources (completed 2026-03-18)
- [x] **Phase 21: Release Package** - Tagged release, offline Helm package (completed 2026-03-18)
- [x] **Phase 22: SignalR Monitoring Data Integration** - Replace mock data with real K8s/Prometheus/Kafka/Jaeger data (v0.3) (completed 2026-03-19)
- [x] **Phase 23: Local Sanity Deploy & Extended Tests** - Deploy scripts, browser/UI/docs sanity tests (completed 2026-03-19)

### v0.3 NAS UX + Monitoring + Release

- [ ] **Phase 24: v0.3.0 Release Package & Deploy** - Version update, docs, build all images, assemble package, sanity tests

### v0.4 Datasource Productivity Features

- [x] **Phase 25: Clone Datasource** - Clone from list/details with full form pre-fill (completed 2026-03-24)
- [ ] **Phase 26: Completeness Checklist** - Real-time form completeness with per-tab status and navigation
- [ ] **Phase 27: Import from File** - Upload sample file to auto-fill schema and form fields
- [ ] **Phase 28: Polish, i18n & Release** - Hebrew translations, Playwright E2E tests, v0.4.0 release packaging

## Phase Details

### Phase 11: Bug Fixes & UI Polish
**Goal**: Fix known bugs and UI issues before adding new features
**Depends on**: Nothing (first v0.2 phase)
**Requirements**: BUG-01, BUG-02, BUG-03
**Success Criteria** (what must be TRUE):
  1. Hebrew/RTL layout displays correctly (fixed columns, Badge, Collapse icons)
  2. No unwanted English translations appear in Hebrew mode
  3. Connection and Output tabs show NAS device dropdown instead of NFS protocol
**Plans**: 2 plans (Wave 1 parallel)

Plans:
- [x] 11-01-PLAN.md — Fix Hebrew/RTL layout regressions (document direction sync, CSS fixes for Table/Badge/Collapse)
- [x] 11-02-PLAN.md — Replace NFS dropdown with NAS device selection in DestinationEditorModal, add translation keys

### Phase 12: NAS Lifecycle Completion
**Goal**: Complete NAS device lifecycle with auto-mounting and cleanup
**Depends on**: Phase 11
**Requirements**: NAS-08, NAS-09, NAS-10, NAS-11
**Success Criteria** (what must be TRUE):
  1. NAS devices auto-mount PV/PVC to correct services based on role (Input, Output, Both)
  2. DataSource entity links to NasDevice with auto-populated mount paths
  3. DataSource creation blocked if referenced NAS device PVC not bound
  4. NAS device delete prevented if referenced by DataSources; cleanup cascades on deprovision
**Plans**: 3 plans (Wave 1: 12-01, 12-02 parallel; Wave 2: 12-03)

Plans:
- [x] 12-01-PLAN.md — Auto-mount PV/PVC volumes to deployments based on NAS device role (NAS-08)
- [x] 12-02-PLAN.md — DataSource-NasDevice entity linking with path auto-population and PVC validation (NAS-09, NAS-10)
- [x] 12-03-PLAN.md — Delete lifecycle management with referential integrity and cascade cleanup (NAS-11)

### Phase 13: AdminServer & Feature Completion
**Goal**: DemoDataGenerator file-simulator integration and NAS auto-test in DataSource forms
**Depends on**: Phase 12
**Requirements**: FEAT-01, FEAT-02, FEAT-03
**Success Criteria** (what must be TRUE):
  1. DemoDataGenerator queries file-simulator API and seeds AdminServer + NasDevice entities
  2. NAS devices selectable in DataSource Connection tab with auto-test on selection
  3. NAS devices selectable in DataSource Output tab with auto-test on selection
  4. Translation keys exist for NAS auto-test messages
**Plans**: 3 plans (Wave 1: 13-01, 13-02 parallel; Wave 2: 13-03)

Plans:
- [ ] 13-01-PLAN.md — File-Simulator API Client + DemoDataGenerator Integration (FEAT-01)
- [ ] 13-02-PLAN.md — NAS Device Auto-Test in DataSource Forms (FEAT-02, FEAT-03)
- [ ] 13-03-PLAN.md — Translation keys and end-to-end verification

### Phase 14: OTEL Verification
**Goal**: Verify complete observability pipeline for all deployed microservices and fix all gaps
**Depends on**: Nothing (can run parallel with 12-13)
**Requirements**: OTEL-01, OTEL-02, OTEL-03
**Success Criteria** (what must be TRUE):
  1. Every microservice generates structured logs visible in Elasticsearch
  2. Every microservice generates distributed traces visible in Jaeger
  3. Every microservice generates metrics visible in Prometheus
  4. OTEL verification script confirms 24/24 checks pass (8 deployed services x 3 signals)
**Plans**: 2 plans (Wave 1: 14-01; Wave 2: 14-02)

Plans:
- [ ] 14-01-PLAN.md — Build OTEL verification PowerShell script and run initial gap assessment (OTEL-01, OTEL-02, OTEL-03)
- [ ] 14-02-PLAN.md — Fix all OTEL gaps, rebuild/redeploy services, verify 24/24 checks pass (OTEL-01, OTEL-02, OTEL-03)

### Phase 15: Device Health Monitoring
**Goal**: Implement real device health monitoring for NAS and AdminServers
**Depends on**: Phase 12 (NAS lifecycle)
**Requirements**: MON-05, MON-06
**Success Criteria** (what must be TRUE):
  1. System Monitoring page displays real component health (not mock data)
  2. NAS device health status includes connectivity, latency, and availability
  3. AdminServer health status includes connectivity and response time
  4. Health check jobs run on schedule and persist results
**Plans**: 2 plans (Wave 1: 15-01; Wave 2: 15-02)

Plans:
- [x] 15-01-PLAN.md — Backend health check infrastructure: Quartz.NET job, DeviceHealthService, MongoDB TTL history, REST API endpoint (MON-05, MON-06)
- [ ] 15-02-PLAN.md — Frontend Device Health tab: status cards, summary bar, React Query polling, Hebrew translations (MON-05, MON-06)

### Phase 15.1: Test all system devices (NAS and protocols) file operations against simulator (INSERTED)

**Goal:** Validate all device types and protocol-based file operations work correctly against the file-simulator service with full protocol x format x operation matrix coverage
**Depends on:** Phase 15
**Requirements**: SIM-TEST-01, SIM-TEST-02, SIM-TEST-03, SIM-TEST-04
**Success Criteria** (what must be TRUE):
  1. Backend file operation REST endpoints exist for List/Read/Write on any registered AdminServer
  2. All protocols pass file operations against static simulator devices (Scenario A)
  3. FTP, SFTP, and NAS pass file operations against dynamically created devices (Scenario B)
  4. Protocol x format matrix report generated showing pass/fail per combination
**Plans**: 4 plans (Wave 1: 15.1-01; Wave 2: 15.1-02, 15.1-03 parallel; Wave 3: 15.1-04)

Plans:
- [x] 15.1-01-PLAN.md — Backend file operations REST proxy + Playwright test infrastructure (SIM-TEST-01)
- [x] 15.1-02-PLAN.md — FTP, SFTP, HTTP/WebDAV protocol test files (SIM-TEST-02, SIM-TEST-03)
- [x] 15.1-03-PLAN.md — S3, Kafka, NAS/NFS protocol test files (SIM-TEST-02, SIM-TEST-03)
- [x] 15.1-04-PLAN.md — Global setup/teardown, full test execution, matrix report (SIM-TEST-04)

### Phase 16: SignalR Real-Time Updates
**Goal**: Enable real-time updates on System Monitoring page via SignalR
**Depends on**: Phase 15 (health monitoring data source)
**Requirements**: MON-07
**Success Criteria** (what must be TRUE):
  1. SignalR hub broadcasts health status changes in real-time
  2. Frontend connects to SignalR hub and updates UI without refresh
  3. Connection recovery works after temporary disconnection
**Plans**: 2 plans (Wave 1: 16-01; Wave 2: 16-02)

Plans:
- [ ] 16-01-PLAN.md — Backend SignalR hub, MonitoringBroadcaster, K8s/Prometheus/Kafka data services, CORS + RBAC (MON-07)
- [ ] 16-02-PLAN.md — Frontend useMonitoringHub hook, mock data removal, connection badge, polling fallback, i18n (MON-07)

### Phase 17: File-Simulator Integration
**Goal**: Integrate DemoDataGenerator with file-simulator for multi-protocol testing
**Depends on**: Nothing (can run parallel with 15-16)
**Requirements**: SIM-01, SIM-02, SIM-03
**Success Criteria** (what must be TRUE):
  1. File-simulator API endpoints documented and understood
  2. DemoDataGenerator reads file-simulator config and creates matching EZ devices
  3. DemoDataGenerator uploads files via file-simulator for all supported protocols
**Plans**: 2 plans (Wave 1: 17-01; Wave 2: 17-02)

Plans:
- [x] 17-01-PLAN.md — FileGeneratorService, FileUploadService, and FileSimulatorClient API docs (SIM-01, SIM-03)
- [ ] 17-02-PLAN.md — Wire --upload-files flag, DI container, and upload step into Program.cs (SIM-02, SIM-03)

### Phase 18: E2E Validation
**Goal**: Comprehensive E2E test coverage including file-simulator environment
**Depends on**: Phase 17 (file-simulator integration)
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04
**Success Criteria** (what must be TRUE):
  1. Full file flow test passes (generate -> ingest -> process -> output -> compare)
  2. Error/negative tests verify filtering and error handling with bad data
  3. Playwright UI tests cover NAS devices, AdminServer, all file protocols
  4. All existing E2E tests pass against file-simulator environment
**Plans**: 5 plans (Wave 1: 18-01, 18-02 parallel; Wave 2: 18-03; Wave 3: 18-04; Wave 4: 18-05 gap closure)

Plans:
- [x] 18-01-PLAN.md — Pipeline infrastructure + full flow E2E tests with DemoDataGenerator seeding (E2E-01)
- [x] 18-02-PLAN.md — Static bad data fixtures + error/negative E2E tests via InvalidRecords API (E2E-02)
- [x] 18-03-PLAN.md — Playwright UI tests for NAS, AdminServer, monitoring, cross-feature workflows (E2E-03)
- [x] 18-04-PLAN.md — Run all existing tests against file-simulator + E2E validation report (E2E-04)
- [ ] 18-05-PLAN.md — Gap closure: add pipeline wait/compare tests, verify report against live cluster (E2E-01, E2E-04)

### Phase 19: Documentation Update
**Goal**: Update Docusaurus documentation for v0.2.0 release
**Depends on**: Phases 11-18 (features must be complete to document)
**Requirements**: DOC-06, DOC-07, DOC-08
**Success Criteria** (what must be TRUE):
  1. Docusaurus content reflects all v0.2.0 features and changes
  2. Docusaurus container builds and deploys in release-package
  3. Frontend help link opens running Docusaurus portal
**Plans**: 2 plans (Wave 1: 19-01; Wave 2: 19-02)

Plans:
- [ ] 19-01-PLAN.md — Update Docusaurus content, new component docs, sidebar restructuring (DOC-06)
- [ ] 19-02-PLAN.md — Dockerfile nginx pin, k8s deployment update, ingress /docs route, docs-url.ts fix (DOC-07, DOC-08)

### Phase 20: CI/CD & Production Deployment
**Goal**: Production-ready CI/CD pipeline and local deployment mode
**Depends on**: Phase 19 (docs container needed)
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06
**Success Criteria** (what must be TRUE):
  1. CI/CD pipeline builds, tests, and deploys all services via Helm
  2. All services healthy in production-like deployment
  3. Frontend footer displays correct version from CI/CD build
  4. Local production mode deploys with single-pod replicas
  5. OCP resource requests/limits defined for all pods
  6. Release-package deploys locally and passes end-to-end validation
**Plans**: 3 plans (Wave 1: 20-01, 20-02 parallel; Wave 2: 20-03)

Plans:
- [ ] 20-01-PLAN.md — CI pipeline extension (tag trigger, version extraction, Helm validation) + frontend version injection fix (PROD-01, PROD-03)
- [ ] 20-02-PLAN.md — values-local.yaml for local single-replica deployment + OCP resource config + image pinning (PROD-04, PROD-05)
- [ ] 20-03-PLAN.md — Release-package install script updates + validation script (PROD-02, PROD-06)

### Phase 21: Release Package & CI Deployment Pipeline
**Goal**: CI produces versioned offline deployment packages, deploys to cluster from source, and validates with sanity tests
**Depends on**: Phase 20 (production validation complete)
**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05, REL-06
**Success Criteria** (what must be TRUE):
  1. GitHub release v0.2.0 tagged with complete CHANGELOG
  2. CI produces `deployment-{VERSION}-{YYYYMMDD}-{HHMMSS}/` artifact with all images as tars, Helm chart, and install scripts
  3. CI builds all application images from source and loads them into the Minikube cluster, replacing existing
  4. CI deploys full stack via `helm upgrade --install` with `values-local.yaml`
  5. DemoDataGenerator seeds the deployed cluster and `@Sanity` test suite passes as final CI gate
  6. Offline deployment folder is self-contained — transfer to air-gapped network and run `install.ps1` to deploy
**Plans**: 4 plans (Wave 1: 21-01, 21-02 parallel; Wave 2: 21-03; Wave 3: 21-04)

Plans:
- [ ] 21-01-PLAN.md — Build scripts (build-all-images.sh, pull-infra-images.sh, assemble-package.sh) + CI docker-build + package-release jobs (REL-03, REL-04)
- [ ] 21-02-PLAN.md — Sanity test suite (@Sanity, SANITY-01 through SANITY-07) + sanity Playwright project + test:e2e:sanity script (REL-06)
- [ ] 21-03-PLAN.md — CI sanity-deploy job: image load + Helm deploy + seed + sanity gate (self-hosted runner) (REL-05, REL-06)
- [ ] 21-04-PLAN.md — GitHub release v0.2.0 (release job in CI, CHANGELOG v0.2.0 entry, offline README) (REL-01, REL-02)

---

## v0.3 Real-Time Monitoring & Scaling

**Milestone Goal:** Replace all mock data on System Monitoring page with real data from K8s, Prometheus, Kafka, and MassTransit pipeline events via SignalR. Prepare for multi-pod scaling.

### Phase 22: SignalR Monitoring Data Integration
**Goal**: Debug and integrate all SignalR backend data services against the live cluster so System Monitoring page displays real data instead of mock fallback, with multi-user CRUD broadcast and optimistic locking
**Depends on**: Phase 21 (v0.2 released)
**Requirements**: MON-08, MON-09, MON-10, MON-11, MON-12, MON-13, MON-14
**Success Criteria** (what must be TRUE):
  1. KubernetesMonitoringService returns real pod/service status (RBAC verified, service account bound)
  2. PrometheusQueryService returns real metrics and time-series history from PromQL instant + range queries
  3. KafkaMonitoringService returns real topic depths and consumer lag via AdminClient
  4. Jaeger trace queries return real distributed traces on the Traces tab
  5. PipelineEventConsumer pushes real MassTransit events (FileDiscovered, ValidationCompleted, etc.) to EventStream
  6. All mock data generators can be removed — every tab shows real data from SignalR
  7. CRUD operations broadcast to all connected clients via SignalR with optimistic locking
**Plans**: 3 plans (Wave 1: 22-01; Wave 2: 22-02, 22-03 parallel)

Plans:
- [ ] 22-01-PLAN.md — Helm RBAC + env var config + deploy and verify all 5 backend monitoring services (MON-08, MON-09, MON-10, MON-11, MON-12)
- [ ] 22-02-PLAN.md — Remove mock data, add skeleton loading, verify real data in UI (MON-13)
- [ ] 22-03-PLAN.md — CRUD broadcast via SignalR + optimistic locking on DataSource and NAS controllers (MON-14)

---

### Phase 23: Local sanity deploy script and extended sanity tests with browser UI docs and help validation

**Goal:** Single-command local sanity deploy script and extended sanity test suite with docs portal and help button verification
**Requirements**: SANITY-08, SANITY-09, SANITY-10, SANITY-HEADED, SANITY-SCRIPT-BASH, SANITY-SCRIPT-PS1, SANITY-PORTFWD-DOCS, SANITY-CONSISTENCY
**Depends on:** Phase 21 (release package scripts must exist)
**Success Criteria** (what must be TRUE):
  1. Sanity test suite extended to 10 tests (SANITY-01 through SANITY-10) with docs homepage, Hebrew guide, and Help button tests
  2. `npm run test:e2e:sanity:headed` opens visible browser for sanity tests
  3. `scripts/sanity-test.sh` performs full clean deploy from dist/ and runs headed sanity tests twice
  4. `scripts/sanity-test.ps1` mirrors the bash script for Windows
  5. `scripts/start-port-forwards.ps1` includes docs service on port 30800
  6. Script exits 0 only if both sanity runs pass
**Plans**: 2 plans (Wave 1: 23-01, 23-02 parallel)

Plans:
- [ ] 23-01-PLAN.md — Extended sanity tests (SANITY-08, 09, 10) + headed npm script
- [ ] 23-02-PLAN.md — Local sanity deploy scripts (bash + PowerShell) + docs port-forward

### Phase 24: v0.3.0 Release Package & Deploy
**Goal**: Package and release v0.3.0 with version update, documentation, image builds, deployment package, and sanity tests
**Depends on**: Phase 23 (all v0.2 work complete)
**Requirements**: REL-03, REL-04, REL-05, REL-06, REL-07
**Success Criteria** (what must be TRUE):
  1. Frontend footer shows v0.3.0 version
  2. Docusaurus has pages for NAS UX improvements, monitoring fixes, pipeline fixes
  3. `build-all-images.sh v0.3.0` produces 10 .tar files in dist/images/services/
  4. `assemble-package.sh v0.3.0` produces deployment folder with canonical structure
  5. Sanity tests pass: NAS lifecycle, monitoring device health, FTP pipeline, NAS pipeline
**Plans**: 3 plans (Wave 1: 24-01, 24-02 parallel; Wave 2: 24-03)

Plans:
- [x] 24-01-PLAN.md — Version update (package.json, CLAUDE.md) + CHANGELOG v0.3.0 + Docusaurus release notes (REL-03, REL-04)
- [ ] 24-02-PLAN.md — Sanity test updates: SANITY-11 NAS pipeline test + NAS E2E test hardening (REL-07)
- [ ] 24-03-PLAN.md — Build all images v0.3.0, Helm deploy, sanity tests, assemble deployment package (REL-05, REL-06)

---

## v0.4 Datasource Productivity Features

**Milestone Goal:** Add 3 datasource UX productivity features to the React frontend: clone existing datasources, import schema from sample files, and completeness checklist for form fill guidance. All changes are frontend-only.

### Phase 25: Clone Datasource
**Goal**: Users can duplicate any datasource to quickly create similar configurations
**Depends on**: Phase 24 (v0.3.0 released)
**Requirements**: CLONE-01, CLONE-02, CLONE-03
**Success Criteria** (what must be TRUE):
  1. User can click "Clone" from the actions menu on the datasource list page and a new create form opens pre-filled with cloned data
  2. User can click "Clone" from the datasource details/edit page header and a new create form opens pre-filled with cloned data
  3. Cloned form has name prefixed with "Copy of", schedule is disabled, and output destinations have new unique IDs
  4. Cloned datasource saves successfully as a new independent entity (original unchanged)
**Plans**: 2 plans (Wave 1: 25-01; Wave 2: 25-02)

Plans:
- [x] 25-01-PLAN.md — Clone utility, i18n keys, list page actions redesign with clone flow (CLONE-01, CLONE-03)
- [x] 25-02-PLAN.md — Details page clone button, form pre-fill from location.state (CLONE-02, CLONE-03)

### Phase 26: Completeness Checklist
**Goal**: Users see real-time guidance on which form fields are filled and which tabs need attention
**Depends on**: Phase 25 (validates form navigation patterns)
**Requirements**: CHECK-01, CHECK-02, CHECK-03, CHECK-04
**Success Criteria** (what must be TRUE):
  1. Create datasource form displays a completeness percentage that updates in real-time as user fills fields
  2. Edit datasource form displays per-tab completion status showing which tabs have incomplete fields
  3. User can click an incomplete checklist item and the UI navigates to the corresponding tab
  4. Required fields show red indicators, recommended fields show yellow, completed show green, and optional/empty show gray
**Plans**: 7 plans (Wave 1: 26-01; Wave 2: 26-02, 26-03 parallel; Wave 3: 26-04; Gap closure Wave 1: 26-05, 26-06 parallel; Gap closure Wave 2: 26-07)

Plans:
- [x] 26-01-PLAN.md — Completeness types, field config, useCompletenessTracker hook, API utility, CSS (CHECK-01, CHECK-02, CHECK-04)
- [x] 26-02-PLAN.md — CompletenessPanel sidebar, field borders, wire into create and edit forms (CHECK-01, CHECK-02, CHECK-03, CHECK-04)
- [ ] 26-03-PLAN.md — List page enable/disable redesign with completeness enforcement (CHECK-04)
- [x] 26-04-PLAN.md — Playwright E2E and webapp-testing comprehensive tests (CHECK-01, CHECK-02, CHECK-03, CHECK-04)
- [ ] 26-05-PLAN.md — Gap closure: AJV schema validation, border fixes for all control types, sidebar missing fields, save feedback, list page mini ring (CHECK-01, CHECK-02, CHECK-04)
- [ ] 26-06-PLAN.md — Gap closure: DemoDataGenerator completeness consistency (CHECK-04)
- [ ] 26-07-PLAN.md — Gap closure: Updated tests for all gap fixes + production K8s deploy (CHECK-01, CHECK-02, CHECK-03, CHECK-04)

### Phase 27: Import from File
**Goal**: Users can upload a sample data file and have the system auto-fill the datasource form with inferred schema and field configuration
**Depends on**: Phase 26 (checklist validates form completeness after import)
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV, JSON, or XML sample file from the datasource create form and the system parses it client-side
  2. System generates a valid JSON Schema 2020-12 from the file content with correct type detection (integer, number, boolean, date, string)
  3. CSV files without a header row produce synthetic field names (field_1, field_2, ... field_N) instead of failing
  4. System detects common data patterns (email, phone, date) and applies format/pattern constraints via schemaAutoSuggest
  5. User sees a preview table of parsed data and can review/edit the inferred schema in Monaco Editor before applying it to the form
  6. CsvToJsonConverter maps headerless CSV columns to schema field names by position order (1st schema property = 1st column, 2nd = 2nd, etc.) instead of generic Column1, Column2...
**Plans**: TBD

### Phase 28: Documentation, i18n, Deploy & Release
**Goal**: Complete Hebrew translations (including user guide refactor), update Docusaurus docs, build v0.4.0 images, assemble deployment package, install from scratch, and verify with sanity tests
**Depends on**: Phase 27 (all features implemented)
**Requirements**: DOC-09, DOC-10, REL-08, REL-09, REL-10, REL-11
**Success Criteria** (what must be TRUE):
  1. All UI text for clone, import, and checklist features has Hebrew translations and displays correctly in RTL mode
  2. Hebrew user guide refactored with detailed step-by-step coverage of all 3 new features
  3. Docusaurus documentation updated (changelog, component docs, admin guide) for v0.4.0
  4. All service images built from source with v0.4.0 tag (build-all-images.sh)
  5. Deployment package assembled at dist/deployment-v0.4.0-{timestamp}/ with Helm chart, images, install scripts (all version references = v0.4.0)
  6. Fresh install from deployment package using install.ps1 succeeds on clean cluster
  7. Sanity tests pass against fresh install including documentation correctness verification
  8. Playwright E2E tests cover clone, import, and checklist workflows
**Plans**: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13 -> 14 -> 15 -> 15.1 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> 25 -> 26 -> 27 -> 28

Note: Phases 14 and 17 can run in parallel with earlier phases as they have no strict dependencies.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 11. Bug Fixes & UI Polish | v0.2 | 2/2 | Complete | 2026-02-11 |
| 12. NAS Lifecycle Completion | v0.2 | 3/3 | Complete | 2026-02-11 |
| 13. AdminServer & Feature Completion | v0.2 | 0/3 | Planned | - |
| 14. OTEL Verification | v0.2 | 2/2 | Complete | 2026-02-25 |
| 15. Device Health Monitoring | v0.2 | 2/2 | Complete | 2026-02-25 |
| 15.1. Protocol File Operations Testing | v0.2 | 3/4 | In Progress | - |
| 16. SignalR Real-Time Updates | v0.2 | 2/2 | Complete | 2026-03-16 |
| 17. File-Simulator Integration | v0.2 | 2/2 | Complete | 2026-03-16 |
| 18. E2E Validation | v0.2 | 4/5 | Gap Closure | 2026-03-16 |
| 19. Documentation Update | v0.2 | 2/2 | Complete | 2026-03-17 |
| 20. CI/CD & Production Deployment | v0.2 | 3/3 | Complete | 2026-03-18 |
| 21. Release Package & CI Pipeline | v0.2 | 4/4 | Complete | 2026-03-18 |
| 22. SignalR Monitoring Data Integration | v0.3 | 3/3 | Complete | 2026-03-19 |
| 23. Local Sanity Deploy & Extended Tests | v0.3 | 2/2 | Complete | 2026-03-19 |
| 24. v0.3.0 Release Package & Deploy | v0.3 | 2/3 | In Progress | - |
| 25. Clone Datasource | v0.4 | 2/2 | Complete    | 2026-03-24 |
| 26. Completeness Checklist | v0.4 | 4/7 | Gap Closure | - |
| 27. Import from File | v0.4 | 0/TBD | Not started | - |
| 28. Documentation, i18n, Deploy & Release | v0.4 | 0/TBD | Not started | - |

**v0.2 Totals:** 12/35 plans complete (34%)
**v0.3 Totals:** 1/3 plans complete (33%)
**v0.4 Totals:** 4/9 plans complete (44%)

---
*Roadmap updated: 2026-03-25 after Phase 26 gap closure planning*

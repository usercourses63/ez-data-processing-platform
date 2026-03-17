# Roadmap: EZ Data Processing Platform

## Milestones

- v0.1 **Testing Foundation + Infrastructure** — Phases 1-10 (shipped 2026-02-11) — [archive](milestones/v0.1-ROADMAP.md)
- v0.2 **Production Validation & Release** — Phases 11-21 (in progress)
- v0.3 **Real-Time Monitoring & Scaling** — Phase 22+ (planned)

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
- [ ] **Phase 20: CI/CD & Production Deployment** - Pipeline, version display, local prod mode, OCP resources
- [ ] **Phase 21: Release Package** - Tagged release, offline Helm package
- [ ] **Phase 22: SignalR Monitoring Data Integration** - Replace mock data with real K8s/Prometheus/Kafka/Jaeger data (v0.3)

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
**Plans**: TBD

Plans:
- [ ] 20-01: CI/CD pipeline completion with Helm deployment
- [ ] 20-02: Version injection and OCP resource configuration
- [ ] 20-03: Local production deployment mode
- [ ] 20-04: Release-package local validation

### Phase 21: Release Package
**Goal**: Create tagged release with offline deployment capability
**Depends on**: Phase 20 (production validation complete)
**Requirements**: REL-01, REL-02
**Success Criteria** (what must be TRUE):
  1. GitHub release v0.2.0 tagged with complete CHANGELOG
  2. Offline Helm package includes all mirrored images
  3. Air-gapped OCP deployment tested and documented
**Plans**: TBD

Plans:
- [ ] 21-01: Tagged GitHub release v0.2.0 with CHANGELOG
- [ ] 21-02: Offline Helm package for air-gapped OCP deployment

---

## v0.3 Real-Time Monitoring & Scaling

**Milestone Goal:** Replace all mock data on System Monitoring page with real data from K8s, Prometheus, Kafka, and MassTransit pipeline events via SignalR. Prepare for multi-pod scaling.

### Phase 22: SignalR Monitoring Data Integration
**Goal**: Debug and integrate all SignalR backend data services against the live cluster so System Monitoring page displays real data instead of mock fallback
**Depends on**: Phase 21 (v0.2 released)
**Requirements**: MON-08, MON-09, MON-10, MON-11, MON-12, MON-13
**Success Criteria** (what must be TRUE):
  1. KubernetesMonitoringService returns real pod/service status (RBAC verified, service account bound)
  2. PrometheusQueryService returns real metrics and time-series history from PromQL instant + range queries
  3. KafkaMonitoringService returns real topic depths and consumer lag via AdminClient
  4. Jaeger trace queries return real distributed traces on the Traces tab
  5. PipelineEventConsumer pushes real MassTransit events (FileDiscovered, ValidationCompleted, etc.) to EventStream
  6. All mock data generators can be removed — every tab shows real data from SignalR
**Plans**: TBD

Plans:
- [ ] 22-01: Debug and fix K8s + Prometheus + Kafka + Jaeger backend services against live cluster
- [ ] 22-02: Verify real data on all monitoring tabs, remove mock fallback, E2E validation

---

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13 -> 14 -> 15 -> 15.1 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22

Note: Phases 14 and 17 can run in parallel with earlier phases as they have no strict dependencies.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 11. Bug Fixes & UI Polish | v0.2 | 2/2 | Complete | 2026-02-11 |
| 12. NAS Lifecycle Completion | v0.2 | 3/3 | Complete | 2026-02-11 |
| 13. AdminServer & Feature Completion | v0.2 | 0/3 | Planned | - |
| 14. OTEL Verification | v0.2 | 2/2 | Complete | 2026-02-25 |
| 15. Device Health Monitoring | v0.2 | 2/2 | Complete | 2026-02-25 |
| 15.1. Protocol File Operations Testing | 3/4 | In Progress|  | - |
| 16. SignalR Real-Time Updates | 2/2 | Complete    | 2026-03-16 | - |
| 17. File-Simulator Integration | 2/2 | Complete    | 2026-03-16 | - |
| 18. E2E Validation | 4/5 | Gap Closure | 2026-03-16 | - |
| 19. Documentation Update | 2/2 | Complete   | 2026-03-17 | - |
| 20. CI/CD & Production Deployment | v0.2 | 0/4 | Not started | - |
| 21. Release Package | v0.2 | 0/2 | Not started | - |
| 22. SignalR Monitoring Data Integration | v0.3 | 0/2 | Not started | - |

**v0.2 Totals:** 12/33 plans complete (36%)
**v0.3 Totals:** 0/2 plans complete (0%)

---
*Roadmap updated: 2026-03-17 after Phase 19 planning*

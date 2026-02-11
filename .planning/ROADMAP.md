# Roadmap: EZ Data Processing Platform

## Milestones

- v0.1 **Testing Foundation + Infrastructure** — Phases 1-10 (shipped 2026-02-11) — [archive](milestones/v0.1-ROADMAP.md)
- v0.2 **Production Validation & Release** — Phases 11-21 (in progress)

## Next Milestone

### v0.2 Production Validation & Release

**Milestone Goal:** Ship production-ready v0.2.0 with complete NAS lifecycle, real-time monitoring, OTEL verification, and offline deployment capability.

## Phases

**Phase Numbering:**
- Integer phases (11, 12, 13): Planned milestone work
- Decimal phases (12.1, 12.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 11: Bug Fixes & UI Polish** - Fix Hebrew/RTL regressions, unwanted translations, NAS dropdown
- [ ] **Phase 12: NAS Lifecycle Completion** - Auto-mount, DataSource linking, PVC verification, delete lifecycle
- [ ] **Phase 13: AdminServer & Feature Completion** - AdminServer settings, NAS selection in forms, archive extraction
- [ ] **Phase 14: OTEL Verification** - Verify logs, traces, metrics for all 9 microservices
- [ ] **Phase 15: Device Health Monitoring** - Real monitoring data, device health/latency monitoring
- [ ] **Phase 16: SignalR Real-Time Updates** - SignalR hub for System Monitoring page
- [ ] **Phase 17: File-Simulator Integration** - API documentation, DemoDataGenerator integration
- [ ] **Phase 18: E2E Validation** - Full file flow tests, error tests, Playwright UI verification
- [ ] **Phase 19: Documentation Update** - Docusaurus content update, container build, help link verification
- [ ] **Phase 20: CI/CD & Production Deployment** - Pipeline, version display, local prod mode, OCP resources
- [ ] **Phase 21: Release Package** - Tagged release, offline Helm package

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
- [ ] 11-01-PLAN.md — Fix Hebrew/RTL layout regressions (document direction sync, CSS fixes for Table/Badge/Collapse)
- [ ] 11-02-PLAN.md — Replace NFS dropdown with NAS device selection in DestinationEditorModal, add translation keys

### Phase 12: NAS Lifecycle Completion
**Goal**: Complete NAS device lifecycle with auto-mounting and cleanup
**Depends on**: Phase 11
**Requirements**: NAS-08, NAS-09, NAS-10, NAS-11
**Success Criteria** (what must be TRUE):
  1. NAS devices auto-mount PV/PVC to correct services based on role (Input, Output, Both)
  2. DataSource entity links to NasDevice with auto-populated mount paths
  3. DataSource creation blocked if referenced NAS device PVC not bound
  4. NAS device delete prevented if referenced by DataSources; cleanup cascades on deprovision
**Plans**: TBD

Plans:
- [ ] 12-01: Auto-mount PV/PVC volumes based on NAS device role
- [ ] 12-02: DataSource-NasDevice entity linking and path auto-population
- [ ] 12-03: PVC binding verification and delete lifecycle management

### Phase 13: AdminServer & Feature Completion
**Goal**: Complete AdminServer integration and verify archive extraction
**Depends on**: Phase 12
**Requirements**: FEAT-01, FEAT-02, FEAT-03
**Success Criteria** (what must be TRUE):
  1. AdminServer settings pages display and save real data (NAS, protocols, system config)
  2. NAS devices selectable in DataSource Connection tab with path configuration
  3. NAS devices selectable in DataSource Output tab with path configuration
  4. Archive extraction works across all supported file protocols
**Plans**: TBD

Plans:
- [ ] 13-01: AdminServer settings pages verification with real data
- [ ] 13-02: NAS device selection in DataSource forms (Connection and Output tabs)
- [ ] 13-03: Archive extraction verification across protocols

### Phase 14: OTEL Verification
**Goal**: Verify complete observability pipeline for all microservices
**Depends on**: Nothing (can run parallel with 12-13)
**Requirements**: OTEL-01, OTEL-02, OTEL-03
**Success Criteria** (what must be TRUE):
  1. Every microservice generates structured logs visible in Elasticsearch
  2. Every microservice generates distributed traces visible in Jaeger
  3. Every microservice generates metrics visible in Prometheus
  4. OTEL verification tool/script confirms coverage for all 9 services
**Plans**: TBD

Plans:
- [ ] 14-01: OTEL verification tooling (query Elasticsearch, Jaeger, Prometheus APIs)
- [ ] 14-02: Fix OTEL gaps and verify all 9 microservices emit logs/traces/metrics

### Phase 15: Device Health Monitoring
**Goal**: Implement real device health monitoring for NAS and AdminServers
**Depends on**: Phase 12 (NAS lifecycle)
**Requirements**: MON-05, MON-06
**Success Criteria** (what must be TRUE):
  1. System Monitoring page displays real component health (not mock data)
  2. NAS device health status includes connectivity, latency, and availability
  3. AdminServer health status includes connectivity and response time
  4. Health check jobs run on schedule and persist results
**Plans**: TBD

Plans:
- [ ] 15-01: Replace mock data with real health check infrastructure
- [ ] 15-02: Implement device health monitoring (NAS, AdminServer, protocols)

### Phase 16: SignalR Real-Time Updates
**Goal**: Enable real-time updates on System Monitoring page via SignalR
**Depends on**: Phase 15 (health monitoring data source)
**Requirements**: MON-07
**Success Criteria** (what must be TRUE):
  1. SignalR hub broadcasts health status changes in real-time
  2. Frontend connects to SignalR hub and updates UI without refresh
  3. Connection recovery works after temporary disconnection
**Plans**: TBD

Plans:
- [ ] 16-01: SignalR hub implementation in DataSourceManagementService
- [ ] 16-02: Frontend SignalR integration with real-time UI updates

### Phase 17: File-Simulator Integration
**Goal**: Integrate DemoDataGenerator with file-simulator for multi-protocol testing
**Depends on**: Nothing (can run parallel with 15-16)
**Requirements**: SIM-01, SIM-02, SIM-03
**Success Criteria** (what must be TRUE):
  1. File-simulator API endpoints documented and understood
  2. DemoDataGenerator reads file-simulator config and creates matching EZ devices
  3. DemoDataGenerator uploads files via file-simulator for all supported protocols
**Plans**: TBD

Plans:
- [ ] 17-01: Document file-simulator API and create client library
- [ ] 17-02: DemoDataGenerator integration with file-simulator config and upload

### Phase 18: E2E Validation
**Goal**: Comprehensive E2E test coverage including file-simulator environment
**Depends on**: Phase 17 (file-simulator integration)
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04
**Success Criteria** (what must be TRUE):
  1. Full file flow test passes (generate -> ingest -> process -> output -> compare)
  2. Error/negative tests verify filtering and error handling with bad data
  3. Playwright UI tests cover NAS devices, AdminServer, all file protocols
  4. All existing E2E tests pass against file-simulator environment
**Plans**: TBD

Plans:
- [ ] 18-01: Full file flow E2E test with comparison validation
- [ ] 18-02: Error handling and negative E2E tests
- [ ] 18-03: Playwright UI tests for NAS, AdminServer, protocols
- [ ] 18-04: Validate all E2E tests against file-simulator

### Phase 19: Documentation Update
**Goal**: Update Docusaurus documentation for v0.2.0 release
**Depends on**: Phases 11-18 (features must be complete to document)
**Requirements**: DOC-06, DOC-07, DOC-08
**Success Criteria** (what must be TRUE):
  1. Docusaurus content reflects all v0.2.0 features and changes
  2. Docusaurus container builds and deploys in release-package
  3. Frontend help link opens running Docusaurus portal
**Plans**: TBD

Plans:
- [ ] 19-01: Update Docusaurus content for v0.2.0
- [ ] 19-02: Verify Docusaurus container build and help link integration

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

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21

Note: Phases 14 and 17 can run in parallel with earlier phases as they have no strict dependencies.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 11. Bug Fixes & UI Polish | v0.2 | 0/2 | Planned | - |
| 12. NAS Lifecycle Completion | v0.2 | 0/3 | Not started | - |
| 13. AdminServer & Feature Completion | v0.2 | 0/3 | Not started | - |
| 14. OTEL Verification | v0.2 | 0/2 | Not started | - |
| 15. Device Health Monitoring | v0.2 | 0/2 | Not started | - |
| 16. SignalR Real-Time Updates | v0.2 | 0/2 | Not started | - |
| 17. File-Simulator Integration | v0.2 | 0/2 | Not started | - |
| 18. E2E Validation | v0.2 | 0/4 | Not started | - |
| 19. Documentation Update | v0.2 | 0/2 | Not started | - |
| 20. CI/CD & Production Deployment | v0.2 | 0/4 | Not started | - |
| 21. Release Package | v0.2 | 0/2 | Not started | - |

**v0.2 Totals:** 0/28 plans complete (0%)

---
*Roadmap updated: 2026-02-11 after Phase 11 planning complete*

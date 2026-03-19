# Requirements: EZ Platform v0.2.0

**Defined:** 2026-02-11
**Core Value:** Files flow reliably from any source through validation to any destination, with complete visibility and traceability — no data loss, no silent failures, every record accounted for.

## v0.2 Requirements

Requirements for v0.2.0 Production Validation & Release. Each maps to roadmap phases.

### Bug Fixes

- [ ] **BUG-01**: Fix Hebrew/RTL layout regressions (Ant Design known issues with fixed columns, Badge, Collapse icons)
- [ ] **BUG-02**: Remove unwanted English translations that were added during v0.1
- [ ] **BUG-03**: Replace NFS protocol dropdown with NAS device selection from system settings

### Feature Completion

- [ ] **FEAT-01**: AdminServer settings pages complete and verified with real data (NAS, protocols, system config)
- [ ] **FEAT-02**: NAS devices selectable in data source Connection and Output tabs with path configuration
- [ ] **FEAT-03**: Archive extraction functional and verified across all file protocols

### NAS Lifecycle Management

- [ ] **NAS-08**: Auto-mount PV/PVC volumes to service deployments after provisioning (role-based: Input->FileDiscovery+FileProcessor, Output->OutputService, Both->all three)
- [ ] **NAS-09**: DataSource -> NasDevice entity linking (NasDeviceId field, mount path auto-population in DataSource.FilePath)
- [ ] **NAS-10**: PVC binding verification required before DataSource can use a NAS device
- [ ] **NAS-11**: NAS update/delete lifecycle (prevent delete if referenced by DataSources, cascade cleanup on deprovision, pod restart on configuration changes)

### Observability Verification

- [x] **OTEL-01**: Every microservice generates structured logs via OTEL collector to Elasticsearch
- [x] **OTEL-02**: Every microservice generates distributed traces via OTEL collector to Jaeger
- [x] **OTEL-03**: Every microservice generates metrics via OTEL collector to Prometheus

### System Monitoring

- [x] **MON-05**: System Monitoring page reflects real current system components (replace mock data generators)
- [x] **MON-06**: File access device health/latency/keep-alive monitoring (NAS devices, AdminServers)
- [x] **MON-07**: SignalR real-time updates on System Monitoring page (reference file-simulator-suite patterns)

### Protocol File Operations Testing (Phase 15.1 - INSERTED)

- [x] **SIM-TEST-01**: Backend file operation proxy endpoints (List/Read/Write) exist for all server protocols via REST API
- [x] **SIM-TEST-02**: Scenario A passes: all static devices tested with full file operation matrix (all protocols x all formats)
- [x] **SIM-TEST-03**: Scenario B passes: dynamic devices (FTP, SFTP, NAS) created via simulator API, registered in EZ UI, and tested with same file operation matrix
- [x] **SIM-TEST-04**: Protocol x format matrix report generated with pass/fail per combination

### File-Simulator Integration

- [x] **SIM-01**: File-simulator docs/API understood and documented (REST endpoints, protocol configs)
- [x] **SIM-02**: DemoDataGenerator reads file-simulator config via API and creates matching EZ devices
- [x] **SIM-03**: DemoDataGenerator uploads files via multi-protocol using file-simulator endpoints

### Production Deployment

- [ ] **PROD-01**: CI/CD pipeline builds, tests, and deploys all services via Helm
- [x] **PROD-02**: All services healthy in production-like deployment
- [ ] **PROD-03**: Frontend footer displays correct version number injected by CI/CD build pipeline
- [x] **PROD-04**: Local production deployment mode — single-pod replicas for all services (ours + infrastructure) on dev PC
- [x] **PROD-05**: OCP resource configuration — proper resource requests/limits defined for every pod in release-package Helm charts
- [x] **PROD-06**: Release-package local validation — deploy release-package locally with single replicas to verify end-to-end functionality

### Documentation

- [x] **DOC-06**: Docusaurus content updated for v0.2.0 release (all docs current)
- [x] **DOC-07**: Docusaurus built and deployed as container in release-package alongside other services
- [x] **DOC-08**: Frontend help link opens running Docusaurus — analyze existing implementation, verify connectivity, fix gaps

### E2E Validation

- [x] **E2E-01**: Full file flow test (generate input -> ingest -> process -> output -> compare results)
- [x] **E2E-02**: Error/negative tests with intentional bad data verify filtering and error handling
- [x] **E2E-03**: Playwright UI verification of NAS devices, AdminServer, file protocols, all features
- [x] **E2E-04**: All existing E2E tests validated against file-simulator environment

### Release

- [x] **REL-01**: Tagged GitHub release v0.2.0 with CHANGELOG
- [x] **REL-02**: Offline Helm package for air-gapped OCP deployment (all images mirrored, tested)
- [x] **REL-03**: CI produces a versioned, timestamped deployment folder (`deployment-{VERSION}-{YYYYMMDD}-{HHMMSS}/`) uploaded as artifact — contains all image tars, Helm chart, values files, and install scripts; self-contained for offline transfer
- [x] **REL-04**: CI builds all application images from source on every run, loads them into the Minikube cluster via `minikube image load`, replacing any existing images
- [x] **REL-05**: CI runs `helm upgrade --install` with `values-local.yaml` after image load to deploy the full stack on the self-hosted runner cluster
- [x] **REL-06**: CI seeds the cluster with `DemoDataGenerator` after deployment, then runs a `@Sanity` Playwright test suite as the final verification step; CI fails if any sanity test fails

## v0.3 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Scaling & HA

- **HA-01**: Redis backplane for SignalR multi-pod scaling
- **HA-02**: Multi-replica deployment configuration for all services
- **HA-03**: Horizontal Pod Autoscaler (HPA) configuration

### Real-Time Monitoring Integration

- **MON-08**: K8s monitoring service returns real pod/service status (fix RBAC binding, verify service account)
- **MON-09**: Prometheus PromQL queries return real metrics (verify metric names, range queries, Prometheus connectivity)
- **MON-10**: Kafka AdminClient returns real queue depths and consumer lag (verify internal bootstrap connectivity)
- **MON-11**: Jaeger trace queries return real distributed traces (verify Jaeger API endpoint and response parsing)
- **MON-12**: PipelineEventConsumer receives real MassTransit events and pushes to SignalR (verify Kafka topic subscription)
- **MON-13**: System Monitoring page displays real data from SignalR instead of mock fallback (all mock generators removable)
- **MON-14**: Multi-user CRUD broadcast via SignalR + optimistic locking (Version field 409 Conflict) for DataSource and NAS device entities

### Advanced Features

- **ADV-01**: AI Assistant (DataSourceChatService) integration
- **ADV-02**: Advanced notification system beyond Prometheus/Grafana alerts
- **ADV-03**: Performance baselines and load testing (10,000+ records)

### Security

- **SEC-01**: Authentication/Authorization for production multi-tenant
- **SEC-02**: API rate limiting and abuse prevention

## Out of Scope

Explicitly excluded from v0.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI Assistant integration | Not critical for reliability — defer to v0.3 |
| Advanced notifications | Prometheus/Grafana alerting sufficient for v0.2 |
| Comprehensive unit tests | Focus on integration/E2E for microservices |
| Multi-tenant support | Single-tenant deployment for v0.2 |
| Authentication/Authorization | Trusted internal network for v0.2 |
| Multi-replica scaling | Dev environment limited — single-pod sufficient |
| Redis SignalR backplane | Not needed until multi-pod deployment |
| Custom SMB health check | TCP port check sufficient for v0.2, custom SMBLibrary check deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 11 | Complete |
| BUG-02 | Phase 11 | Complete |
| BUG-03 | Phase 11 | Complete |
| FEAT-01 | Phase 13 | Pending |
| FEAT-02 | Phase 13 | Pending |
| FEAT-03 | Phase 13 | Pending |
| NAS-08 | Phase 12 | Complete |
| NAS-09 | Phase 12 | Complete |
| NAS-10 | Phase 12 | Complete |
| NAS-11 | Phase 12 | Complete |
| OTEL-01 | Phase 14 | Complete |
| OTEL-02 | Phase 14 | Complete |
| OTEL-03 | Phase 14 | Complete |
| MON-05 | Phase 15 | Complete |
| MON-06 | Phase 15 | Complete |
| MON-07 | Phase 16 | Complete |
| SIM-TEST-01 | Phase 15.1 | Complete |
| SIM-TEST-02 | Phase 15.1 | Complete |
| SIM-TEST-03 | Phase 15.1 | Complete |
| SIM-TEST-04 | Phase 15.1 | Complete |
| SIM-01 | Phase 17 | Complete |
| SIM-02 | Phase 17 | Complete |
| SIM-03 | Phase 17 | Complete |
| PROD-01 | Phase 20 | Pending |
| PROD-02 | Phase 20 | Complete |
| PROD-03 | Phase 20 | Pending |
| PROD-04 | Phase 20 | Complete |
| PROD-05 | Phase 20 | Complete |
| PROD-06 | Phase 20 | Complete |
| DOC-06 | Phase 19 | Complete |
| DOC-07 | Phase 19 | Complete |
| DOC-08 | Phase 19 | Complete |
| E2E-01 | Phase 18 | Complete |
| E2E-02 | Phase 18 | Complete |
| E2E-03 | Phase 18 | Complete |
| E2E-04 | Phase 18 | Complete |
| REL-01 | Phase 21 | Complete |
| REL-02 | Phase 21 | Complete |
| REL-03 | Phase 21 | Complete |
| REL-04 | Phase 21 | Complete |
| REL-05 | Phase 21 | Complete |
| REL-06 | Phase 21 | Complete |
| MON-08 | Phase 22 | Complete |
| MON-09 | Phase 22 | Complete |
| MON-10 | Phase 22 | Complete |
| MON-11 | Phase 22 | Complete |
| MON-12 | Phase 22 | Complete |
| MON-13 | Phase 22 | Complete |
| MON-14 | Phase 22 | Complete |

**Coverage:**
- v0.2 requirements: 38 total, mapped: 38, unmapped: 0
- v0.3 requirements: 7 total, mapped: 7, unmapped: 0

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-03-19 after Phase 22 revision (added MON-14)*

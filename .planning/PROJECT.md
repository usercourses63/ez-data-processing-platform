# EZ Data Processing Platform

## What This Is

A production-grade, microservices-based data processing platform that ingests files from multiple sources (FTP, SFTP, S3, SMB, NFS/NAS, HTTP, Kafka), validates them against JSON schemas, and outputs to multiple destinations with comprehensive monitoring and Hebrew/RTL support. Built on .NET 10, React 19, Kubernetes, with Kafka, MongoDB, and full observability (Prometheus, Grafana, Jaeger, Elasticsearch). Includes NAS device management with dynamic K8s PV/PVC provisioning for external file access.

## Core Value

Files flow reliably from any source through validation to any destination, with complete visibility and traceability - no data loss, no silent failures, every record accounted for.

## Requirements

### Validated

<!-- Shipped and confirmed working -->

#### Core Processing Pipeline (pre-existing)
- ✓ **PIPE-01**: System discovers files from configured sources on schedule
- ✓ **PIPE-02**: System converts files (CSV, JSON, XML, Excel) to normalized format
- ✓ **PIPE-03**: System validates records against JSON schemas
- ✓ **PIPE-04**: System outputs valid records to multiple destinations
- ✓ **PIPE-05**: System captures invalid records with detailed error information

#### Data Source Management (pre-existing)
- ✓ **DS-01**: Users configure data sources with 7-tab UI
- ✓ **DS-02**: Users test connections before saving
- ✓ **DS-03**: System supports Cron-based scheduling with visual helper
- ✓ **DS-04**: System tracks data source processing statistics

#### Schema Management (pre-existing)
- ✓ **SCH-01..04**: Full schema management with visual builder, templates, regex helper

#### Invalid Records Management (pre-existing)
- ✓ **INV-01..04**: Full invalid records management with filters, editing, revalidation, export

#### Monitoring & Observability (pre-existing)
- ✓ **MON-01..04**: 20 business metrics, distributed tracing, log aggregation, alerts

#### Deployment & Infrastructure (pre-existing)
- ✓ **INFRA-01..05**: Kubernetes/Helm deployment, MongoDB, Kafka, Hazelcast, OCP-compatible

#### Internationalization (pre-existing)
- ✓ **I18N-01..03**: RTL layout, 200+ Hebrew translations, LTR technical fields

#### NAS/NFS Architecture — v0.1
- ✓ **NAS-01**: NAS device entity with connection configuration — v0.1
- ✓ **NAS-02**: PersistentVolume creation via .NET 10 Kubernetes API — v0.1
- ✓ **NAS-03**: PersistentVolumeClaim creation and binding — v0.1
- ✓ **NAS-04**: Volume mounting to pods at runtime via K8s API — v0.1
- ✓ **NAS-05**: NFS protocol acts as connector to NAS devices — v0.1
- ✓ **NAS-06**: AdminServer supports NAS device configuration in UI — v0.1
- ✓ **NAS-07**: NAS devices tested against file-simulator simulation — v0.1

#### Testing Foundation — v0.1
- ✓ **TEST-01**: Critical pipeline paths have automated integration tests — v0.1
- ✓ **TEST-02**: All 8 file protocols tested against file-simulator — v0.1
- ✓ **TEST-03**: All format conversions verified bidirectionally — v0.1
- ✓ **TEST-05**: Test suite runs in CI/CD pipeline as quality gate — v0.1
- ✓ **TEST-07**: Load testing validated (100-1000 files) — v0.1
- ✓ **TEST-08**: Test documentation generated — v0.1

#### CD Pipeline — v0.1
- ✓ **CD-01..11**: Full CI/CD pipeline with Docker builds, Helm charts, GitHub Actions, version injection, Docusaurus portal — v0.1

#### Documentation — v0.1
- ✓ **DOC-01..05**: All docs audited, archived, consolidated, GSD as single source of truth — v0.1

#### Frontend Workflow — v0.1
- ✓ **FE-01..07**: Component docs, Playwright E2E, API coordination, React 19 patterns, Docusaurus portal integration, Hebrew user guide — v0.1

### Active

<!-- Next milestone scope — to be defined by /gsd:new-milestone -->

*Pending — run `/gsd:new-milestone` to define requirements for next milestone.*

### Carried from v0.1 (review in next milestone)

- **TEST-04**: File-simulator integrated as primary test environment — PARTIAL (infrastructure ready, needs real integration)
- **TEST-06**: All existing E2E tests validated against file-simulator — PARTIAL (needs human execution)
- **FEAT-01**: v0.2.0 External File Access completed (docs + E2E tests)
- **FEAT-02**: AdminServer architecture fully integrated
- **FEAT-03**: Archive settings functional across all protocols
- **BUG-01**: Hebrew/RTL changes not fully working
- **BUG-02**: Unwanted English translations added
- **BUG-03**: NFS protocol in Connection/Output tab should be replaced by NAS devices from settings

### Out of Scope

- **Real-time dashboard** - Grafana provides monitoring
- **AI Assistant integration** - Deferred, not critical for reliability
- **Advanced Notifications** - Prometheus/Grafana alerting sufficient
- **Comprehensive unit tests** - Focus on integration/E2E
- **Multi-tenant support** - Single-tenant deployment
- **Authentication/Authorization** - Trusted internal network

## Context

### Current State
- **Version:** v0.1 milestone shipped (2026-02-11)
- **Architecture:** 9 microservices + React frontend on Kubernetes
- **Testing:** 32 protocol tests, 63 format tests, 17 pipeline tests, 5 load tests, Playwright E2E
- **CI/CD:** GitHub Actions pipeline with Docker builds, Helm charts, quality gates
- **Monitoring:** Full observability stack (Prometheus dual, Grafana, Jaeger, Elasticsearch)
- **Documentation:** Consolidated via GSD, Docusaurus portal at /docs
- **NAS/NFS:** Dynamic PV/PVC provisioning, NAS device management UI

### Known Issues
- Hebrew/RTL not fully working (v0.1 regression)
- Unwanted English translations added
- NFS→NAS protocol dropdown fix needed in Connection/Output tabs
- Many integration tests skip without file-simulator (by design)
- Performance baselines not yet established
- Docker build cache issues (requires `--no-cache` for certain rebuilds)
- Kafka dual listener required for localhost access (9092/9094)

### Technical Environment
- **Offline OCP Deployment:** Production runs in air-gapped OpenShift
- **File-Simulator:** External test environment at C:\Users\UserC\source\repos\file-simulator-suite
- **Development:** Minikube on Windows 11
- **Hebrew Support:** Full RTL layout required

## Constraints

- **Deployment:** Must work in offline OCP environment
- **Testing:** Must use file-simulator as primary test environment
- **Internationalization:** Must maintain Hebrew/RTL support
- **Architecture:** Must preserve microservices architecture (9 services + frontend)
- **OCP Security:** Non-root, restricted-v2 SCC compliance

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GSD as workflow engine | Systematic planning/execution for all work | ✓ Good — 10 phases, 35 plans executed |
| Archive ALL existing documentation | 270+ docs causing noise | ✓ Good — 402 files audited, 141 archived |
| Testing Foundation first | Can't build reliably without confidence | ✓ Good — 32 protocol + 85 format/pipeline tests |
| File-simulator as test environment | Realistic OCP-like testing | ⚠️ Revisit — infrastructure ready but not yet connected for real E2E |
| CI/CD pipeline (GitHub Actions) | Manual deployment too slow | ✓ Good — full pipeline with quality gates |
| Integration/E2E focus over unit tests | Microservices need interaction testing | ✓ Good — comprehensive E2E coverage |
| NAS device management via K8s API | Dynamic PV/PVC provisioning | ✓ Good — full lifecycle implemented |

---
*Last updated: 2026-02-11 after v0.1 milestone*

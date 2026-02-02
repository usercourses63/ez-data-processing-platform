# EZ Data Processing Platform

## What This Is

A production-grade, microservices-based data processing platform that ingests files from multiple sources (FTP, SFTP, S3, SMB, NFS, HTTP, Kafka), validates them against JSON schemas, and outputs to multiple destinations with comprehensive monitoring and Hebrew/RTL support. Built on .NET 10, React 19, Kubernetes, with Kafka, MongoDB, and full observability (Prometheus, Grafana, Jaeger, Elasticsearch).

## Core Value

Files flow reliably from any source through validation to any destination, with complete visibility and traceability - no data loss, no silent failures, every record accounted for.

## Requirements

### Validated

<!-- Shipped and confirmed working (from v0.1.1-rc3) -->

#### Core Processing Pipeline
- ✓ **PIPE-01**: System discovers files from configured sources on schedule - existing
- ✓ **PIPE-02**: System converts files (CSV, JSON, XML, Excel) to normalized format - existing
- ✓ **PIPE-03**: System validates records against JSON schemas - existing
- ✓ **PIPE-04**: System outputs valid records to multiple destinations - existing
- ✓ **PIPE-05**: System captures invalid records with detailed error information - existing

#### Data Source Management
- ✓ **DS-01**: Users configure data sources with 7-tab UI (connection, schedule, validation, schema, etc.) - existing
- ✓ **DS-02**: Users test connections before saving (SFTP, FTP, HTTP, Kafka) - existing
- ✓ **DS-03**: System supports Cron-based scheduling with visual helper - existing
- ✓ **DS-04**: System tracks data source processing statistics - existing

#### Schema Management
- ✓ **SCH-01**: Users create JSON schemas with visual builder + code editor - existing
- ✓ **SCH-02**: Users generate example data from schemas - existing
- ✓ **SCH-03**: Users use 6 schema templates for common patterns - existing
- ✓ **SCH-04**: Users get regex helper with Israeli patterns - existing

#### Invalid Records Management
- ✓ **INV-01**: Users view invalid records with filters (category, datasource, error type, time range) - existing
- ✓ **INV-02**: Users edit failed fields and revalidate records - existing
- ✓ **INV-03**: System automatically reprocesses corrected records through pipeline - existing
- ✓ **INV-04**: Users export invalid records to JSON (UTF-8 BOM) - existing

#### Monitoring & Observability
- ✓ **MON-01**: System exposes 20 business metrics (records processed, latency, errors, etc.) - existing
- ✓ **MON-02**: System provides distributed tracing across all services via Jaeger - existing
- ✓ **MON-03**: System aggregates logs from all services in Elasticsearch - existing
- ✓ **MON-04**: Users create metric alerts with PromQL expressions - existing

#### Deployment & Infrastructure
- ✓ **INFRA-01**: All 9 services deploy to Kubernetes with Helm - existing
- ✓ **INFRA-02**: System runs on MongoDB 3-node replica set - existing
- ✓ **INFRA-03**: System uses Kafka for inter-service messaging - existing
- ✓ **INFRA-04**: System uses Hazelcast for distributed caching (512MB, TTL-enabled) - existing
- ✓ **INFRA-05**: All deployments are OCP-compatible (security contexts, non-root, non-privileged ports) - existing

#### Internationalization
- ✓ **I18N-01**: UI supports full RTL layout for Hebrew - existing
- ✓ **I18N-02**: UI has 200+ Hebrew translations across all components - existing
- ✓ **I18N-03**: Technical fields (regex, PromQL, paths) remain LTR in RTL mode - existing

### Active

<!-- Current scope - building toward these -->

#### Testing Foundation (Milestone 1 - CRITICAL)
- [ ] **TEST-01**: Every critical pipeline path has automated integration tests
- [ ] **TEST-02**: All 8 file protocols (FTP, SFTP, S3, SMB, NFS, HTTP, Kafka, Local) tested against file-simulator
- [ ] **TEST-03**: All format conversions (CSV, JSON, XML, Excel) verified bidirectionally
- [ ] **TEST-04**: File-simulator integrated as primary test environment for all file I/O
- [ ] **TEST-05**: Test suite runs in CI/CD pipeline as quality gate
- [ ] **TEST-06**: All existing E2E tests (6/6) validated against file-simulator
- [ ] **TEST-07**: Load testing validated (100-1000 files) with file-simulator
- [ ] **TEST-08**: Test documentation generated and maintained by GSD

#### CD Pipeline Automation (Milestone 2)
- [ ] **CD-01**: One-command build process for all Docker images
- [ ] **CD-02**: Automated Helm chart packaging with version management
- [ ] **CD-03**: CI/CD pipeline (GitHub Actions) builds on every commit
- [ ] **CD-04**: Automated deployment to OCP offline environment
- [ ] **CD-05**: Deployment validation tests run automatically post-deploy
- [ ] **CD-06**: Rollback procedure automated and tested

#### Documentation Consolidation (Milestone 3)
- [ ] **DOC-01**: All 270+ existing docs audited and categorized
- [ ] **DOC-02**: Session logs archived to /docs/archive/sessions/
- [ ] **DOC-03**: Obsolete/redundant docs deleted
- [ ] **DOC-04**: GSD becomes single source of truth for all planning/execution docs
- [ ] **DOC-05**: Architecture/deployment/testing guides consolidated

#### Frontend Development Workflow (Milestone 4)
- [ ] **FE-01**: Frontend design tooling established (component library, design system)
- [ ] **FE-02**: Frontend testing strategy (component tests, E2E with Playwright)
- [ ] **FE-03**: Frontend/backend change coordination process
- [ ] **FE-04**: React 19 best practices and patterns documented

#### Feature Development (Milestone 5+)
- [ ] **FEAT-01**: v0.2.0 External File Access completed (docs + E2E tests)
- [ ] **FEAT-02**: AdminServer architecture fully integrated
- [ ] **FEAT-03**: Archive settings functional across all protocols

### Out of Scope

- **Real-time dashboard** - Grafana provides monitoring, no need for duplicate UI
- **AI Assistant integration** - Deferred to Phase 2, not critical for reliability
- **Advanced Notifications** - Alerting via Prometheus/Grafana sufficient for MVP
- **Comprehensive unit tests** - Focus on integration/E2E, unit tests only for critical logic
- **Multi-tenant support** - Single-tenant deployment for now
- **Authentication/Authorization** - Trusted internal network, add later if needed

## Context

### Current State
- **Version:** v0.1.1-rc3 in production (97% complete, Week 5 validation)
- **Architecture:** 9 microservices + React frontend on Kubernetes
- **Testing:** 6/6 E2E scenarios passing, 83/83 integration/unit tests passing
- **Monitoring:** Full observability stack (Prometheus dual, Grafana, Jaeger, Elasticsearch)
- **Documentation:** 270+ markdown files (many obsolete, causing noise)

### The Problem
System was developed piecemeal over several months with extensive session-based documentation. While features work, there's insufficient confidence in reliability:
- Tests exist but don't cover all critical paths systematically
- Documentation is fragmented and contains obsolete information
- Deployment process is manual and time-consuming
- No automated quality gates prevent regressions

### The Goal
Establish production-ready confidence through:
1. **Systematic testing** of every critical component against file-simulator
2. **Automated CI/CD pipeline** for consistent, repeatable deployments
3. **Consolidated documentation** managed by GSD workflow
4. **Proven reliability** - can deploy to OCP without fear

### Technical Environment
- **Offline OCP Deployment:** Production runs in air-gapped OpenShift environment
- **File-Simulator:** External test environment (C:\Users\UserC\source\repos\file-simulator-suite) for realistic protocol testing
- **Development:** Minikube on Windows 11 with cross-cluster communication
- **Hebrew Support:** Full RTL layout required for all UI components

### Known Issues
- Docker build cache issues (fixed in Session 13 - requires `--no-cache` rebuilds)
- Kafka dual listener required for localhost access (9092 internal, 9094 external)
- MongoDB directConnection bypass for replica set testing
- Hazelcast TTL configuration critical for cache cleanup (5 min TTL, 3 min idle)
- Port-forwarding script required (18 ports) - never use individual kubectl commands

## Constraints

- **Deployment:** Must work in offline OCP environment (no internet access in production)
- **Testing:** Must use file-simulator as primary test environment for all file I/O
- **Internationalization:** Must maintain Hebrew/RTL support across all features
- **Architecture:** Must preserve microservices architecture (9 services + frontend)
- **Quality:** Testing foundation is non-negotiable - reliability over speed
- **Documentation:** GSD-generated only from this point forward (archive existing 270+ docs)
- **OCP Security:** All deployments must comply with OCP security contexts (non-root, restricted-v2 SCC)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Transition from Task Orchestrator to GSD | Need systematic workflow for testing, CD, and documentation consolidation | — Pending |
| Archive ALL existing documentation | 270+ docs causing noise, GSD provides structured replacement | — Pending |
| Testing Foundation as Milestone 1 | Can't build features reliably without confidence in existing system | — Pending |
| File-simulator as primary test environment | Realistic OCP-like testing with all protocols (FTP, SFTP, S3, SMB, NFS) | — Pending |
| CI/CD pipeline automation (GitHub Actions) | Manual deployment too slow and error-prone for production OCP | — Pending |
| Integration/E2E focus over unit tests | Microservices architecture requires testing service interactions, not isolated units | — Pending |
| Fold v0.2.0 into testing milestone | v0.2.0 E2E tests align with broader testing initiative goals | — Pending |

---
*Last updated: 2026-02-02 after initialization*

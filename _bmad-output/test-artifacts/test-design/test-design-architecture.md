---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-17'
workflowType: 'testarch-test-design'
inputDocuments:
  - docs/data_processing_prd.md
  - docs/archive/architecture/exports/architecture-overview.md
  - docs/PROJECT_STANDARDS.md
  - _bmad-output/project-context.md
---

# Test Design for Architecture: EZ Platform — System-Level

**Purpose:** Architectural concerns, testability gaps, and NFR requirements. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-03-17
**Author:** Murat (TEA Master Test Architect)
**Status:** Architecture Review Pending
**Project:** EZ Platform v0.1.1-rc3
**PRD Reference:** docs/data_processing_prd.md
**Architecture Reference:** docs/archive/architecture/exports/architecture-overview.md

---

## Executive Summary

**Scope:** System-level test design covering 9 microservices (.NET 10.0), React 19 frontend, and Kubernetes infrastructure — validating the full data processing pipeline (file discovery → processing → validation → multi-destination output).

**Architecture:**
- 4-layer architecture: Presentation → API/Management → Data Processing Pipeline → Infrastructure
- Event-driven: RabbitMQ (internal MassTransit) + Kafka (external I/O)
- MongoDB + Hazelcast cache + Prometheus dual metrics

**Risk Summary:**
- **Total risks**: 10
- **High-priority (score >=6)**: 6 risks requiring immediate mitigation (2 BLOCKERS)
- **Test effort**: ~71 test scenarios across 13 suites

---

## Quick Guide

### BLOCKERS — Must Resolve Before Testing

1. **R-01: Full datasource creation flow untested** — Most complex UI workflow (7+ tabs, 20+ fields) has zero E2E coverage. Must create comprehensive test covering every tab and control. (Owner: QA)
2. **R-02: Pipeline only tested with CSV/100 records** — XML, Excel, JSON formats untested. Multi-format processing is a core product capability. (Owner: QA + Backend)

### HIGH PRIORITY — Must Validate

3. **R-03: No backend test projects** — Zero unit/integration tests for consumer logic, validation rules, format conversion. (Owner: Backend Dev)
4. **R-04: NAS lifecycle untested** — PV/PVC provisioning, mount, and use in datasource never tested end-to-end. (Owner: QA)
5. **R-05: Multi-destination output** — Only 2 of 4+ destination types tested. (Owner: QA)
6. **R-06: No test cleanup framework** — Tests leave orphaned data, poisoning subsequent runs. (Owner: QA)

### INFO ONLY — Solutions Provided

1. **Test strategy**: UI-first E2E testing (Playwright + Chrome Claude extension), full-feature-flow scenarios
2. **Tooling**: Playwright 1.49 (3 projects), file-simulator-suite for test servers
3. **Coverage**: 71 test scenarios prioritized P0-P3 across 13 suites (~1.5-2.5 weeks QA effort; see QA doc for gate criteria)

---

## Risk Assessment

**Total risks identified**: 10 (2 critical score=9, 4 high score=6, 2 medium score=4, 2 low score<=3)

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
|---------|----------|------------|---|---|-------|------------|-------|----------|
| **R-01** | **BUS** | Full datasource creation flow (all tabs/fields) untested | 3 | 3 | **9** | Create Suite 5: DS-001 to DS-020 | QA | Week 1-2 |
| **R-02** | **DATA** | Pipeline flow only tested CSV/100 records — XML, Excel, JSON untested | 3 | 3 | **9** | Create Suite 6: PL-001 to PL-008 | QA + Backend | Week 2-3 |
| **R-03** | **TECH** | No backend unit/integration test projects exist | 3 | 2 | **6** | Create .Tests projects for Validation, FileProcessor, Output | Backend Dev | Week 3-4 |
| **R-04** | **BUS** | NAS device lifecycle (PV/PVC/mount) untested end-to-end | 2 | 3 | **6** | Create Suite 3: NAS-001 to NAS-006 | QA | Week 1 |
| **R-05** | **BUS** | Output destinations only 2/4+ types tested | 2 | 3 | **6** | Create Suite 6: PL-008 multi-destination | QA | Week 2-3 |
| **R-06** | **TECH** | No systematic test data cleanup — orphaned resources | 3 | 2 | **6** | Create Suite 1: TI-001 cleanup framework | QA | Week 1 |

### Medium-Priority Risks (Score 4-5)

| Risk ID | Category | Description | P | I | Score | Mitigation |
|---------|----------|------------|---|---|-------|------------|
| R-07 | PERF | No load/stress testing — max 100 records tested | 2 | 2 | 4 | Plan after functional coverage |
| R-10 | BUS | Schema management UI has partial coverage | 2 | 2 | 4 | Include in Suite 7 |

### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description | P | I | Score | Action |
|---------|----------|------------|---|---|-------|--------|
| R-08 | SEC | OCP security context compliance untested | 1 | 3 | 3 | Verify via kubectl in pipeline tests |
| R-09 | OPS | Port forwarding fragility | 2 | 1 | 2 | Use NodePort where possible |

---

## Testability Concerns and Architectural Gaps

### ACTIONABLE CONCERNS

#### Blockers to Fast Feedback

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
|---------|--------|-------------------------------|-------|----------|
| **No test data seeding API** | Tests rely on UI for data creation — slow, fragile | REST endpoints for seeding datasources, servers, schemas, NAS devices OR direct MongoDB seeding utilities | Backend | Pre-testing |
| **Pipeline stage transitions invisible** | Internal MassTransit events can't be observed from frontend | API endpoint or metrics query to verify file progressed through discovery → processing → validation → output | Backend | Pre-testing |
| **No test cleanup endpoints** | Orphaned data from tests pollutes environment | DELETE endpoints for all entities OR test-scoped database isolation | Backend | Pre-testing |

#### Architectural Improvements Needed

1. **Hazelcast cache observability**
   - **Current problem**: No API to inspect cache contents; only visible via Prometheus metrics
   - **Required change**: Add debug/health endpoint or expose cache stats via existing health endpoint
   - **Impact if not fixed**: Cannot verify cache hit/miss behavior in tests
   - **Owner**: Backend
   - **Timeline**: Pre-testing

### Testability Assessment Summary — What Works Well

- Comprehensive REST API surface (14 controllers, `/api/v1/{resource}` pattern)
- Distributed tracing with CorrelationId propagation across all services
- 20 business metrics exposed via dual Prometheus instances
- Health checks on every service (MongoDB + Kafka + ES composed)
- File-simulator-suite provides dynamic test server provisioning (FTP, SFTP, NAS, S3, HTTP, Kafka)
- Playwright 1.49 framework with 3 configured projects and visual regression

### Accepted Trade-offs

- **Cross-cluster networking fragility** — File simulator on separate minikube profile requires hostAliases. Acceptable for dev; CI would need single-cluster mode.
- **No CI/CD pipeline** — Tests run manually. Acceptable for current phase; CI setup deferred to `bmad-tea-testarch-ci`.

---

## Risk Mitigation Plans (Score >=6)

### R-01: Full Datasource Creation Flow (Score: 9) — CRITICAL

**Mitigation Strategy:**
1. Create Suite 5 (DS-001 to DS-020) covering all 7+ tabs in datasource form
2. Each tab tested individually, then full save-and-verify
3. Use API seeding for prerequisite data (servers, categories, schemas)

**Owner:** QA
**Timeline:** Week 1-2
**Status:** Planned
**Verification:** All DS-* tests pass with 100% success rate
**Residual risk:** Low — all 7+ tabs covered; ongoing maintenance ~10% effort per form change

### R-02: Multi-Format Pipeline (Score: 9) — CRITICAL

**Mitigation Strategy:**
1. Create Suite 6 (PL-001 to PL-008) for CSV, XML, Excel, JSON pipelines
2. Test each format with distinct input servers (FTP, SFTP, NAS, HTTP, Kafka)
3. Include large file test (500+ records) for performance validation

**Owner:** QA + Backend
**Timeline:** Week 2-3
**Status:** Planned
**Verification:** All PL-* tests pass; each format produces correct output
**Residual risk:** Low — 4 formats covered; binary formats (Parquet, Avro) deferred as not in PRD scope

### R-03: No Backend Test Projects (Score: 6) — HIGH

**Mitigation Strategy:**
1. Create xUnit test projects: `ValidationService.Tests`, `FileProcessorService.Tests`, `OutputService.Tests`
2. Add Moq + FluentAssertions NuGet packages per project
3. Implement consumer logic tests, format conversion tests, and output handler tests

**Owner:** Backend Dev
**Timeline:** Week 3-4
**Status:** Planned
**Verification:** `dotnet test` passes for all new projects; minimum 20 tests per service
**Residual risk:** Medium — contract tests (Pact) and integration-level Kafka tests deferred; unit coverage alone does not guarantee end-to-end correctness

### R-04: NAS Device Lifecycle (Score: 6) — HIGH

**Mitigation Strategy:**
1. Create Suite 3 (NAS-001 to NAS-006) covering PV/PVC provisioning, mount, and deprovision
2. Use file-simulator NFS server (172.30.26.249) as test NAS target
3. Verify PVC binding, mount, file write/read, and cleanup in sequence

**Owner:** QA
**Timeline:** Week 1
**Status:** Planned
**Verification:** NAS-001 to NAS-006 all pass; PV/PVC lifecycle confirmed via `kubectl get pv,pvc`
**Residual risk:** Low — cross-cluster networking fragility accepted trade-off (documented in Accepted Trade-offs)

### R-05: Multi-Destination Output (Score: 6) — HIGH

**Mitigation Strategy:**
1. Extend Suite 6 (PL-008) to test Folder + Kafka + SFTP destinations simultaneously
2. Verify each destination independently and then in combination
3. Include destination toggle (enable/disable) verification

**Owner:** QA
**Timeline:** Week 2-3
**Status:** Planned
**Verification:** PL-008 passes with 3+ active destinations; each destination confirms file or message receipt
**Residual risk:** Medium — HTTP and S3 output destinations remain untested; deferred to future sprint when infrastructure is available

### R-06: Test Cleanup Framework (Score: 6) — HIGH

**Mitigation Strategy:**
1. Implement Playwright fixture with auto-cleanup (TI-001)
2. Track created resources in array during test
3. afterAll teardown deletes via REST API

**Owner:** QA
**Timeline:** Week 1 (prerequisite for all other suites)
**Status:** Planned
**Verification:** Tests leave zero orphaned data after execution
**Residual risk:** Low — fixture pattern ensures cleanup even on test failure; only manual test runs could leave orphaned data

---

## Assumptions and Dependencies

### Assumptions
1. All 9 microservices are deployed and healthy in `ez-platform` namespace
2. File-simulator-suite is running on `file-simulator` minikube profile (IP: 172.30.26.249)
3. Port forwarding active via `scripts/start-port-forwards.ps1`
4. MongoDB replica set initialized (`rs.initiate()` already run)

### Dependencies
1. **Backend seeding utilities** — Required before Suite 5 (datasource creation) begins
2. **Pipeline status observability** — Required before Suite 6 (pipeline flow) begins
3. **File-simulator connectivity** — Required for all protocol tests

---

**Next Steps for Architecture/Backend Team:**
1. Review Quick Guide blockers and assign owners
2. Implement test data seeding and cleanup endpoints
3. Add pipeline stage transition observability

**Next Steps for QA:**
1. Refer to companion QA doc (`test-design-qa.md`) for test scenarios
2. Begin Suite 1 (test infrastructure) immediately
3. Create Ant Design test utility helpers

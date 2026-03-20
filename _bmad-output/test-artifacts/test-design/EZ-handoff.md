---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - _bmad-output/test-artifacts/test-design/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design/test-design-qa.md
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-03-17'
projectName: 'EZ'
---

# TEA → BMAD Integration Handoff

## Purpose

This document bridges TEA's test design outputs with BMAD's epic/story decomposition workflow. It provides structured integration guidance so that quality requirements, risk assessments, and test strategies flow into implementation planning.

## TEA Artifacts Inventory

| Artifact | Path | BMAD Integration Point |
|----------|------|----------------------|
| Architecture Test Design | `_bmad-output/test-artifacts/test-design/test-design-architecture.md` | Epic quality requirements, testability blockers |
| QA Test Design | `_bmad-output/test-artifacts/test-design/test-design-qa.md` | Story acceptance criteria, test scenarios |
| Risk Assessment | (embedded in both documents) | Epic risk classification, story priority |
| Project Context | `_bmad-output/project-context.md` | 47 implementation rules for all agents |

## Epic-Level Integration Guidance

### Risk References

| Risk | Score | Epic Impact |
|------|-------|-------------|
| R-01 (Datasource creation untested) | 9 BLOCK | Epic: "Datasource Management" must include comprehensive E2E tests |
| R-02 (Pipeline multi-format untested) | 9 BLOCK | Epic: "Data Pipeline" must validate CSV, XML, Excel, JSON |
| R-04 (NAS lifecycle untested) | 6 MITIGATE | Epic: "Infrastructure Management" must include NAS provisioning E2E |
| R-05 (Multi-destination incomplete) | 6 MITIGATE | Epic: "Output Service" must test Folder + Kafka + SFTP + HTTP |
| R-06 (No test cleanup) | 6 MITIGATE | All epics depend on test infrastructure setup |

### Quality Gates

| Epic | Gate Criteria |
|------|--------------|
| Test Infrastructure | Suite 1 (TI-001 to TI-005) all passing — prerequisite for all other epics |
| Server Management | Suite 2 (SRV-001 to SRV-010) 100% pass — create, test, toggle, edit, delete for all server types |
| NAS Management | Suite 3 (NAS-001 to NAS-006) 100% pass — full lifecycle with file-simulator |
| Datasource Management | Suite 5 (DS-001 to DS-020) 100% pass — all tabs, all fields, save, verify |
| Data Pipeline | Suite 6 (PL-001 to PL-008) 100% pass — 4 formats, multi-destination, large file |

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

| Test Scenario | Recommended Story AC |
|--------------|---------------------|
| SRV-001 to SRV-006: Create all server types | "Given admin creates [type] server with valid config, When saved, Then server appears in list and connection test passes" |
| NAS-001 to NAS-003: NAS provisioning | "Given NAS device created with NFS config, When provisioned, Then PV is created, PVC is bound, and test connection succeeds" |
| DS-019: Save complete datasource | "Given all 7+ tabs are filled with valid data, When datasource is saved, Then success notification shows and datasource appears in list with all data correct" |
| PL-001: CSV pipeline flow | "Given datasource with FTP input and Folder output, When polling triggers, Then file is discovered, processed, validated, and output delivered" |
| PL-003: Invalid records | "Given CSV with invalid records, When pipeline runs, Then valid records output correctly and invalid records appear on Invalid Records page with error details" |

### Data-TestId Requirements

For UI testability, ensure these `data-testid` attributes exist:

- Datasource form: `name`, `description`, `supplier`, `category-select`, `file-type-select`
- ConnectionTab: `input-server-select`, `nas-device-select`, `file-path`
- OutputTab: `add-destination-btn`, `destination-type-select`, `destination-server-select`
- SchemaTab: `schema-editor`, `template-library-btn`, `regex-helper-btn`
- ScheduleTab: `cron-expression`, `cron-helper-btn`, `immediate-poll-toggle`
- Server modals: `server-name`, `server-type`, `server-host`, `server-port`, `test-connection-btn`
- NAS modals: `nas-name`, `nas-host`, `nas-export-path`, `provision-btn`, `test-connection-btn`

## Risk-to-Story Mapping

| Risk ID | Category | P×I | Recommended Story/Epic | Test Level |
|---------|----------|-----|----------------------|------------|
| R-01 | BUS | 3×3=9 | Datasource CRUD epic / "Create datasource with all tabs" story | E2E |
| R-02 | DATA | 3×3=9 | Pipeline epic / "Process CSV/XML/Excel/JSON files" stories | E2E |
| R-03 | TECH | 3×2=6 | Backend Testing epic / "Create test projects for critical services" | Unit+Integration |
| R-04 | BUS | 2×3=6 | Infrastructure epic / "NAS device full lifecycle" story | E2E |
| R-05 | BUS | 2×3=6 | Output epic / "Multi-destination output (3+ types)" story | E2E |
| R-06 | TECH | 3×2=6 | Test Infrastructure epic / "Implement test cleanup framework" story | E2E Fixture |

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design** (`bmad-tea-testarch-test-design`) → this handoff document (DONE)
2. **TEA Framework** (`bmad-tea-testarch-framework`) → validate/enhance Playwright setup
3. **TEA ATDD** (`bmad-tea-testarch-atdd`) → generate failing acceptance tests per story
4. **Implementation** → write tests, fix failures until 100% pass
5. **TEA Automate** (`bmad-tea-testarch-automate`) → expand test coverage
6. **TEA Test Review** (`bmad-tea-testarch-test-review`) → quality audit (0-100 score)
7. **TEA Trace** (`bmad-tea-testarch-trace`) → traceability matrix + ship/no-ship gate

## Phase Transition Quality Gates

| From Phase | To Phase | Gate Criteria |
|-----------|----------|--------------|
| Test Design | Framework Setup | All P0 risks have mitigation strategy |
| Framework Setup | ATDD | Test infrastructure (Suite 1) passing, Playwright helpers ready |
| ATDD | Implementation | Failing acceptance tests exist for P0/P1 scenarios |
| Implementation | Test Review | All P0 tests pass (100%), P1 >=95% |
| Test Review | Trace | Quality score >=70/100 |
| Trace | Production Release | Coverage >=80% of P0/P1 requirements |

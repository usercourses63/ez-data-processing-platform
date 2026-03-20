---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-17'
workflowType: 'testarch-test-design'
inputDocuments:
  - docs/data_processing_prd.md
  - docs/archive/architecture/exports/architecture-overview.md
  - _bmad-output/project-context.md
---

# Test Design for QA: EZ Platform — System-Level

**Purpose:** Test execution recipe. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-03-17
**Author:** Murat (TEA Master Test Architect)
**Status:** Draft
**Project:** EZ Platform v0.1.1-rc3

**Related:** See Architecture doc (`test-design-architecture.md`) for testability concerns and blockers.

---

## Executive Summary

**Scope:** UI-first comprehensive testing of 9 microservices + React frontend covering every feature, button, selection, and control — validated by real backend services.

**Risk Summary:**
- Total Risks: 10 (2 critical, 4 high, 2 medium, 2 low)
- Critical Categories: BUS (business logic), DATA (pipeline), TECH (test infrastructure)

**Coverage Summary:**
- P0 tests: ~31 (core infrastructure, server management, NAS lifecycle, datasource creation, CSV pipeline)
- P1 tests: ~26 (multi-format pipeline, schema, metrics, invalid records, datasource edit)
- P2 tests: ~12 (categories, monitoring, RTL/i18n)
- P3 tests: ~2 (help, AI assistant)
- **Total**: ~71 test scenarios across 13 suites

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Backend unit tests** | No .Tests.csproj projects exist; creating them is a backend concern (R-03) | Backend team to create test projects separately |
| **Load/stress testing** | No infrastructure for k6/load tools yet (R-07) | Deferred to `bmad-tea-testarch-nfr` workflow |
| **AI Assistant (Chat Service)** | Optional service, not core pipeline | P3 exploratory only |
| **CI/CD pipeline** | No CI exists | Deferred to `bmad-tea-testarch-ci` workflow |

---

## Dependencies & Test Blockers

### Backend Dependencies (Pre-Testing)

See Architecture doc "Quick Guide" for details.

1. **Test data seeding** — Backend must provide REST API or utility for creating datasources, servers, schemas, NAS devices programmatically (without UI). Blocks: Suite 5, 6.
2. **Pipeline status observability** — Need API or metric query to verify a file has progressed through all pipeline stages (discovery → processing → validation → output). Blocks: Suite 6.
3. **Cleanup endpoints** — DELETE endpoints must work reliably for all entities. Blocks: Suite 1 (cleanup framework).

### QA Infrastructure Setup

1. **Test cleanup fixture** (TI-001) — Playwright fixture tracking created resources with afterAll teardown
2. **Ant Design helpers** (TI-002, TI-003) — Tab click workaround, lazy form value restoration
3. **API seeding utilities** (TI-004) — Programmatic creation of test prerequisites
4. **Pipeline status poller** (TI-005) — Poll dashboard/metrics APIs for pipeline completion

**Seeding utility pattern:**

```typescript
import { test as base, expect } from '@playwright/test';

// API seeding fixture with auto-cleanup
export const test = base.extend<{ api: ApiHelper }>({
  api: async ({ request }, use) => {
    const created: Array<{ type: string; id: string }> = [];

    const api = {
      async createServer(data: CreateServerRequest) {
        const res = await request.post('/api/v1/servers', { data });
        expect(res.ok()).toBeTruthy();
        const server = await res.json();
        created.push({ type: 'server', id: server.ID });
        return server;
      },
      async createNasDevice(data: any) {
        const res = await request.post('/api/v1/nasdevices', { data });
        expect(res.ok()).toBeTruthy();
        const device = await res.json();
        created.push({ type: 'nas', id: device.ID });
        return device;
      },
      async createDatasource(data: any) {
        const res = await request.post('/api/v1/datasources', { data });
        expect(res.ok()).toBeTruthy();
        const ds = await res.json();
        created.push({ type: 'datasource', id: ds.ID });
        return ds;
      },
    };

    await use(api);

    // Auto-cleanup in reverse order
    for (const item of created.reverse()) {
      const endpoint = item.type === 'server' ? 'servers'
        : item.type === 'nas' ? 'nasdevices'
        : 'datasources';
      await request.delete(`/api/v1/${endpoint}/${item.id}`);
    }
  },
});
```

---

## Risk Assessment

**Full risk details in Architecture doc. Summary for QA planning:**

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|------------|-------|-----------------|
| **R-01** | BUS | Full datasource creation flow untested | **9** | Suite 5: DS-001 to DS-020 — all tabs, all fields |
| **R-02** | DATA | Pipeline only CSV/100 records tested | **9** | Suite 6: PL-001 to PL-008 — 4 formats, 500+ records |
| **R-04** | BUS | NAS lifecycle untested | **6** | Suite 3: NAS-001 to NAS-006 |
| **R-05** | BUS | Multi-destination output incomplete | **6** | Suite 6: PL-008 (Folder+Kafka+SFTP) |
| **R-06** | TECH | No test cleanup framework | **6** | Suite 1: TI-001 (cleanup fixture) |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|------------|-------|-----------------|
| R-07 | PERF | No load testing | 4 | Deferred to NFR assessment |
| R-10 | BUS | Schema management partial | 4 | Suite 7: SCH-001 to SCH-005 |
| R-08 | SEC | OCP compliance untested | 3 | kubectl assertions in pipeline tests |
| R-09 | OPS | Port forwarding fragility | 2 | Use NodePort alternatives |

---

## Entry Criteria

- [ ] All 9 microservices deployed and healthy (`/health` returns 200)
- [ ] File-simulator-suite running (FTP, SFTP, NAS, S3, HTTP servers available)
- [ ] MongoDB initialized with `rs.initiate()`, connection with `?directConnection=true`
- [ ] Port forwarding active (18 ports via `scripts/start-port-forwards.ps1`)
- [ ] Frontend accessible at `http://localhost:7000`
- [ ] Suite 1 (test infrastructure) completed — cleanup fixture, API seeding, Ant Design helpers

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>=95% or failures triaged)
- [ ] No open BLOCKER or CRITICAL bugs
- [ ] Coverage validated: all 7 datasource tabs, 4 file formats, 3+ output destinations tested
- [ ] Test cleanup verified: zero orphaned resources after full suite run

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = priority and risk level (what to focus on if time-constrained), NOT execution timing.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk | Notes |
|---------|------------|------------|------|-------|
| **TI-001** | Test cleanup framework | E2E Fixture | R-06 | Auto-cleanup of servers, NAS, datasources, schemas |
| **TI-002** | Ant Design tab click helper | E2E Utility | TC-6 | dispatchEvent workaround for tab switching |
| **TI-003** | Ant Design form mount helper | E2E Utility | TC-6 | Lazy tab value restoration |
| **TI-004** | API seeding utilities | E2E Fixture | TC-2 | seedServer, seedNasDevice, seedDatasource, seedSchema |
| **TI-005** | Pipeline status poller | E2E Utility | TC-3 | waitForPipelineComplete via metrics/dashboard API |
| **SRV-001** | Create FTP input server | E2E | R-01 | Admin → Servers → FTP → Save → Verify |
| **SRV-002** | Create SFTP input server | E2E | R-01 | + connection test |
| **SRV-003** | Create HTTP/WebDAV server | E2E | R-01 | URL, auth config |
| **SRV-004** | Create Kafka server (Both) | E2E | R-01 | Bootstrap, security, consumer group |
| **SRV-005** | Create S3 server | E2E | R-01 | Bucket, region, credentials |
| **SRV-006** | Create Folder output server | E2E | R-01 | BasePath configuration |
| **SRV-007** | Test server connection | E2E | R-01 | Verify Success for each server type |
| **SRV-008** | Toggle server active/inactive | E2E | R-01 | Status change verification |
| **SRV-009** | Edit server | E2E | R-01 | Modify → Save → verify |
| **SRV-010** | Delete server | E2E | R-01 | Remove → verify gone |
| **NAS-001** | Create NAS device (NFS) | E2E | R-04 | Host, export, mount options via file-simulator |
| **NAS-002** | Provision PV/PVC | E2E | R-04 | Verify PV created, PVC bound |
| **NAS-003** | Mount & verify connection | E2E | R-04 | Test Connection → write/read test file |
| **NAS-004** | Use NAS as datasource input | E2E | R-04 | ConnectionTab → select NAS → verify path |
| **NAS-005** | NAS device edit | E2E | R-04 | Modify mount options → Save |
| **NAS-006** | NAS device cleanup | E2E | R-04 | Deprovision PV/PVC → delete |
| **DS-019** | Save complete datasource (all tabs) | E2E | R-01 | Full creation with all 7+ tabs filled |
| **DS-020** | View datasource details | E2E | R-01 | Verify all detail tabs show correct data |
| **PL-001** | CSV pipeline: FTP → Folder | E2E | R-02 | Full pipeline: discover → process → validate → output |
| **PL-002** | CSV pipeline: NAS → Kafka | E2E | R-02 | NAS input, Kafka output verification |
| **PL-003** | CSV pipeline: invalid records | E2E | R-02 | Valid output + invalid records stored |

**Total P0:** ~26 tests

---

### P1 (High)

**Criteria:** Important features + Medium-high risk + Common workflows

| Test ID | Requirement | Test Level | Risk | Notes |
|---------|------------|------------|------|-------|
| **DS-001** | BasicInfoTab — all fields | E2E | R-01 | Name, description, supplier, category, file type |
| **DS-002** | ConnectionTab — input server | E2E | R-01 | Select FTP/SFTP/NAS, set path |
| **DS-003** | ConnectionTab — Kafka input | E2E | R-01 | Topic, consumer group |
| **DS-004** | OutputTab — Folder destination | E2E | R-01 | DestinationEditorModal |
| **DS-005** | OutputTab — Kafka destination | E2E | R-01 | Topic, partition key |
| **DS-006** | OutputTab — SFTP destination | E2E | R-01 | Server, remote path |
| **DS-007** | OutputTab — HTTP destination | E2E | R-01 | URL, method, headers |
| **DS-008** | OutputTab — multiple destinations | E2E | R-05 | 3+ destinations, toggle enabled |
| **DS-009** | SchemaTab — inline schema | E2E | R-01 | Fields, types, required, regex |
| **DS-010** | SchemaTab — template | E2E | R-01 | SchemaTemplateLibrary → apply |
| **DS-011** | SchemaTab — regex helper | E2E | R-01 | RegexHelperDialog |
| **DS-012** | ScheduleTab — cron | E2E | R-01 | CronHelperDialog |
| **DS-013** | ScheduleTab — immediate poll | E2E | R-01 | Poll on save |
| **DS-014** | FileSettingsTab — CSV | E2E | R-01 | Delimiter, encoding, header |
| **DS-015** | FileSettingsTab — archive | E2E | R-01 | Archive extraction settings |
| **DS-016** | ValidationTab | E2E | R-01 | Validation rules, thresholds |
| **DS-017** | MetricsTab | E2E | R-01 | Business metric definitions |
| **DS-018** | NotificationsTab | E2E | R-01 | Alert policies, channels |
| **PL-004** | XML pipeline: SFTP → Folder | E2E | R-02 | XML → JSON conversion |
| **PL-005** | Excel pipeline: HTTP → SFTP | E2E | R-02 | Excel format support |
| **PL-006** | JSON pipeline: Kafka → HTTP | E2E | R-02 | Kafka input, HTTP output |
| **PL-007** | Large file: 500+ records | E2E | R-02 | Performance target: <5s |
| **PL-008** | Multi-destination output | E2E | R-05 | Folder + Kafka + SFTP |
| **DSE-001** | Edit datasource — basic info | E2E | — | Modify name → Save |
| **DSE-002** | Edit datasource — change server | E2E | — | Switch input server |
| **DSE-003** | Edit datasource — add/remove output | E2E | — | Add/remove destinations |

**Total P1:** ~26 tests

---

### P2 (Medium)

**Criteria:** Secondary features + Low risk + Edge cases

| Test ID | Requirement | Test Level | Risk | Notes |
|---------|------------|------------|------|-------|
| **SCH-001** | Create schema from builder | E2E | R-10 | Visual builder |
| **SCH-002** | Edit schema in JSON editor | E2E | R-10 | Monaco editor |
| **SCH-003** | Schema template library | E2E | R-10 | Browse, preview, apply |
| **MET-001** | Create metric via wizard | E2E | — | Full wizard flow |
| **MET-002** | FormulaBuilder | E2E | — | Visual formula + PromQL |
| **MET-003** | AlertRuleBuilder | E2E | — | Expression, threshold |
| **INV-001** | View invalid records | E2E | — | Table, columns, pagination |
| **INV-002** | Filter by datasource | E2E | — | Filtered results |
| **CAT-001** | Create category | E2E | R-10 | Hebrew + English |
| **MON-001** | Dashboard loads | E2E | — | All widgets visible |
| **RTL-001** | Hebrew layout all pages | E2E Visual | — | RTL, no overflow |
| **RTL-002** | Language switch | E2E | — | Hebrew ↔ English |

**Total P2:** ~12 tests

---

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory

| Test ID | Requirement | Test Level | Notes |
|---------|------------|------------|-------|
| **HLP-001** | Help page loads | E2E | Content renders |
| **AI-001** | AI assistant | E2E | If service available |

**Total P3:** ~2 tests

---

## Execution Strategy

**Philosophy:** Run all functional tests on demand/PR. Defer only expensive long-running suites.

### On-Demand / PR: Playwright Tests (~15-20 min)

**All functional tests** (P0, P1, P2, P3):
- Suites 1-13, all 71 scenarios
- Parallelized across Playwright workers
- Sequential for pipeline tests (resource contention)

### Nightly: Long Pipeline Tests (~30 min)

- PL-007 (500+ record large file)
- Full visual regression suite (RTL-001 across all pages)
- Multi-format pipeline (PL-004 to PL-006) if not run in PR

### Weekly: Performance & Chaos

- Deferred to `bmad-tea-testarch-nfr` workflow
- Load testing, stress testing, chaos scenarios

---

## QA Effort Estimate

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | ~26 | ~3-5 days | Includes fixture setup and server/NAS lifecycle |
| P1 | ~26 | ~3-5 days | Datasource tabs, multi-format pipeline |
| P2 | ~12 | ~1-2 days | Schema, metrics, monitoring, RTL |
| P3 | ~2 | ~2-4 hours | Help, AI assistant |
| **Total** | **~71** | **~1.5-2.5 weeks** | **1 QA engineer, full-time** |

**Assumptions:**
- Includes test design, implementation, debugging
- Excludes ongoing maintenance (~10% effort)
- Assumes test infrastructure (Suite 1) completed first
- Playwright + Chrome Claude extension used for debugging

---

## Implementation Planning Handoff

**Recommended implementation order (dependency-aware):**

| Work Item | Owner | Dependencies |
|-----------|-------|-------------|
| Suite 1: Test infrastructure (TI-001 to TI-005) | QA | Backend seeding endpoints |
| Suite 2: Server management (SRV-001 to SRV-010) | QA | Suite 1, file-simulator running |
| Suite 3: NAS lifecycle (NAS-001 to NAS-006) | QA | Suite 1, file-simulator NFS |
| Suite 5: Datasource creation (DS-001 to DS-020) | QA | Suites 1, 2, 3 |
| Suite 6: Pipeline flow (PL-001 to PL-008) | QA | Suites 1, 2, 3, 5 |
| Suite 4: Categories (CAT-001 to CAT-004) | QA | Suite 1 |
| Suite 7: Schema management (SCH-001 to SCH-005) | QA | Suite 1 |
| Suite 8: Metrics & alerts (MET-001 to MET-006) | QA | Suite 1, 5 |
| Suite 9: Invalid records (INV-001 to INV-004) | QA | Suite 6 (needs pipeline data) |
| Suite 10: Monitoring (MON-001 to MON-005) | QA | Suite 6 (needs pipeline activity) |
| Suite 11: Datasource edit (DSE-001 to DSE-005) | QA | Suite 5 |
| Suite 12: RTL/i18n (RTL-001 to RTL-003) | QA | Any suite (visual) |
| Suite 13: Help & AI (HLP-001, AI-001) | QA | None |

---

## Interworking & Regression

| Service | Impact | Regression Scope | Validation |
|---------|--------|-----------------|------------|
| **DataSourceManagement** | Primary CRUD target | All existing datasource.spec.ts | Suite 5, 11 |
| **FileDiscovery** | Pipeline stage 1 | Existing protocol tests | Suite 6 PL-* |
| **FileProcessor** | Format conversion | archive-extraction.spec.ts | Suite 6 PL-004/005 |
| **Validation** | Schema enforcement | schema.spec.ts | Suite 6 PL-003 |
| **Output** | Multi-destination | Existing e2e-validation | Suite 6 PL-008 |
| **Scheduling** | Poll triggers | Existing pipeline-flow | Suite 5 DS-012/013 |
| **InvalidRecords** | Error capture | invalid-records.spec.ts | Suite 9 |
| **MetricsConfiguration** | Metric/alert CRUD | metrics.spec.ts, alerts.spec.ts | Suite 8 |
| **Frontend** | All UI interactions | All existing E2E specs | All suites |

---

## Appendix A: Code Examples & Tagging

**Playwright Tags for Selective Execution:**

```typescript
import { test, expect } from '@playwright/test';

// P0 critical — NAS lifecycle
test('@P0 @NAS create NAS device and verify PV/PVC binding', async ({ page, api }) => {
  const nas = await api.createNasDevice({
    Name: 'Test NAS',
    Host: '172.30.26.249',
    ExportPath: '/',
    MountOptions: 'nfsvers=4,nolock',
  });

  // Verify in UI
  await page.goto('/admin');
  // Click NAS tab using Ant Design helper
  await clickAntTab(page, 'nas-devices');
  await expect(page.getByText('Test NAS')).toBeVisible();

  // Provision
  await page.getByRole('button', { name: /provision/i }).click();
  await expect(page.getByText(/bound/i)).toBeVisible({ timeout: 60000 });
});

// P1 — datasource tab
test('@P1 @Datasource BasicInfoTab all fields', async ({ page }) => {
  await page.goto('/datasources/new');
  await page.fill('[data-testid="name"]', 'Test DS');
  await page.fill('[data-testid="description"]', 'Test description');
  // ... fill all fields
});
```

**Run specific tags:**

```bash
# P0 only
npx playwright test --grep @P0

# P0 + P1
npx playwright test --grep "@P0|@P1"

# NAS tests only
npx playwright test --grep @NAS

# Pipeline tests only
npx playwright test --grep @Pipeline
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `_bmad/tea/testarch/knowledge/risk-governance.md`
- **Test Levels Framework**: `_bmad/tea/testarch/knowledge/test-levels-framework.md`
- **Test Quality DoD**: `_bmad/tea/testarch/knowledge/test-quality.md` (no hard waits, <300 lines, <1.5 min)
- **Probability-Impact**: `_bmad/tea/testarch/knowledge/probability-impact.md`
- **Project Context**: `_bmad-output/project-context.md` (47 critical implementation rules)

---

**Generated by:** BMad TEA Agent (Murat)
**Workflow:** `bmad-testarch-test-design`

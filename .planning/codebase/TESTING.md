# Testing Patterns

**Analysis Date:** 2026-05-24

## Test Pyramid

EZ Platform uses an **E2E-first** strategy with the following weighting:

```
        ┌──────────────────┐
        │  E2E Tests (60%) │  ← Primary focus — 6 passing scenarios
        └──────────────────┘
             ┌────────────┐
             │ Integration│  ← Critical paths — 83 tests
             │ Tests (25%)│
             └────────────┘
                  ┌────┐
                  │Unit│  ← Critical logic — 25 tests
                  │15% │
                  └────┘
```

The ratio reflects deliberate strategy: backend behavior is exercised through real Kubernetes-deployed services rather than mocked at the controller boundary. Unit tests cover pure converters (CSV, JSON, XML, Excel) and other isolatable utilities.

## Test Frameworks

### Backend (.NET)

**Runner:**
- xUnit (referenced via `<PackageReference Include="xunit" />` + `xunit.runner.visualstudio`)
- Test SDK: `Microsoft.NET.Test.Sdk`
- Coverage: `coverlet.collector`
- Config: per-project `<IsTestProject>true</IsTestProject>` in `*.Tests.csproj`. See `src/Services/FileProcessorService.Tests/FileProcessorService.Tests.csproj`.

**Assertion library:**
- FluentAssertions (`result.Should().NotBeNull(); records!.Count.Should().Be(2);`)
- Reference: `src/Services/FileProcessorService.Tests/CsvToJsonConverterHeaderlessTests.cs:47-53`.

**Mocking:**
- Moq (`new Mock<ILogger<CsvToJsonConverter>>()` then `.Object`)

**Run commands:**
```bash
# Run a specific service's test project
cd src/Services/FileProcessorService.Tests
dotnet test

# Run all backend tests from solution root
dotnet test DataProcessingPlatform.sln

# With coverage
dotnet test --collect:"XPlat Code Coverage"
```

### Frontend (E2E)

**Runner:**
- Playwright `@playwright/test` `^1.49.0`
- Config: `src/Frontend/playwright.config.ts`
- Default base URL: `http://172.30.22.206:30080` (Minikube NodePort) — overridable via `BASE_URL` env var. Local port-forward base would be `http://localhost:7000`.

**Browsers:** chromium-only by default. Multi-browser projects (Firefox/WebKit) are not configured.

**Reporters:**
- `html` (saved, never auto-opened)
- `json` → `test-results/results.json`
- `list` (terminal)

**Run commands (from `src/Frontend/package.json:44-57`):**
```bash
cd src/Frontend
npm run test:e2e                  # Full E2E suite
npm run test:e2e:headed           # With visible browser
npm run test:e2e:ui               # Playwright UI mode
npm run test:e2e:report           # Open last HTML report
npm run test:e2e:p0               # Only @P0-tagged specs
npm run test:e2e:p1               # @P0 or @P1-tagged specs
npm run test:e2e:sanity           # Sanity gate suite (headless)
npm run test:e2e:sanity:headed    # Sanity gate, headed Chrome
npm run test:e2e:sanity:watch     # Sanity with slowMo: 2500ms for step-by-step
```

### Webapp-testing (Python Playwright)

**Runner:** Python `playwright.sync_api`, plain-Python scripts (no pytest framework).

**Purpose:** comprehensive UI verification with reconnaissance-first approach. Tools complement Playwright E2E — they exercise edge cases (tooltips, modal content, cancel flows, uniqueness, error handling, popconfirms).

**Location:** `src/Frontend/tests/webapp-testing/`

**Scripts:**
- `recon.py` — DOM discovery script; prints button structure, icon classes, modal contents
- `clone_comprehensive_test.py` — clone datasource feature: action buttons, tooltips, list-page clone, details-page clone, uniqueness, popconfirm
- `completeness_comprehensive_test.py` — datasource completeness checklist
- `import_comprehensive_test.py` — file-import workflows

**Run command:**
```bash
cd src/Frontend
python tests/webapp-testing/clone_comprehensive_test.py
python tests/webapp-testing/completeness_comprehensive_test.py
python tests/webapp-testing/import_comprehensive_test.py
```

**Pattern:** Each script launches headless chromium, runs reconnaissance first (`recon.py` style) to discover the DOM, then asserts behavior with a custom `report(name, passed, detail)` helper that accumulates results.

## Test File Organization

### Backend

**Location:** Sibling `*.Tests` project alongside the service:
```
src/Services/
├── DataSourceManagementService/
├── DataSourceManagementService.Tests/      # OptimisticLockingTests.cs (stubs)
├── FileProcessorService/
└── FileProcessorService.Tests/             # CsvToJsonConverterHeaderlessTests.cs
```

**Naming:**
- Test class: `[ClassUnderTest]Tests` (e.g. `OptimisticLockingTests`, `CsvToJsonConverterHeaderlessTests`)
- Test method: `Method_Scenario_ExpectedOutcome` (e.g. `Update_WithStaleVersion_Returns409Conflict`, `HeaderlessCsv_WithSchemaPropertyNames_ProducesSchemaFieldNames`)

**Currently only two backend test projects exist** (`DataSourceManagementService.Tests` and `FileProcessorService.Tests`); the other 7 services rely on E2E coverage. This is a recognized coverage gap (see CONCERNS).

### Frontend E2E

**Location:** `src/Frontend/tests/e2e/`

**Structure:**
```
tests/e2e/
├── sanity.spec.ts                   # SANITY-01..SANITY-21 deployment gate
├── p0-pipeline-flow.spec.ts         # @P0 critical paths
├── p0-datasource-creation.spec.ts
├── p0-nas-lifecycle.spec.ts
├── p0-server-management.spec.ts
├── p1-datasource-edit.spec.ts
├── p1-datasource-tabs.spec.ts
├── multi-user-live-sync.spec.ts     # SignalR sync
├── signalr-monitoring.spec.ts
├── v030-e2e-ftp-pipeline.spec.ts    # E2E-001..E2E-006 pipeline tests
├── v030-e2e-nas-pipeline.spec.ts
├── v030-selection-verification.spec.ts
├── *-api.spec.ts                    # API-only specs
├── *-ui.spec.ts                     # UI-driven specs
├── e2e-validation/                  # Sequential full-pipeline tests (180s timeout)
├── protocols/                       # Cross-cluster protocol tests (120s timeout, serial)
├── fixtures/                        # test-data.csv, test-data.json, test-data.xlsx, test-data.xml
├── helpers/                         # ez-api-client.ts, simulator-client.ts, ui-helpers.ts, test-data.ts, report-generator.ts, api-utils.ts
├── support/                         # index.ts barrel + helpers/fixtures
└── snapshots/                       # visual regression baselines
```

**Naming:**
- Files: `kebab-case.spec.ts`
- Tests: `<TEST-ID>: <description>` (e.g. `'SANITY-01: All service health endpoints respond'`, `'PL-001: create datasource with HTTP input server'`)
- Tags: `@Sanity`, `@P0`, `@P1`, `@Pipeline` (prefix in test name for `--grep` filtering)

## Playwright Configuration

**Reference:** `src/Frontend/playwright.config.ts`

**Global settings:**
- `fullyParallel: true` (workers may run tests in parallel)
- `workers: process.env.CI ? 4 : undefined`
- `retries: process.env.CI ? 2 : 0`
- `forbidOnly: !!process.env.CI` — fail build if `test.only` left in source
- `timeout: 60000` per test (default)
- `actionTimeout: 10000`, `navigationTimeout: 30000`
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'on-first-retry'`

**Visual regression:**
- Snapshot directory: `./tests/e2e/snapshots/`
- `toHaveScreenshot` allows `maxDiffPixelRatio: 0.3`, `threshold: 0.2`, `animations: 'disabled'`, `scale: 'device'`
- 30% pixel tolerance accounts for live data (timestamps) and RTL layout variance.

**Projects:**
- `chromium` — default Desktop Chrome
- `protocols` — cross-cluster protocol tests; `fullyParallel: false`, 120s timeout, 30s action timeout
- `e2e-validation` — full pipeline tests; `fullyParallel: false`, 180s timeout
- `sanity` — headed Chrome via `channel: 'chrome'`, NodePort base URL, 60s timeout, `headless: false`
- `sanity-watch` — `slowMo: 2500ms` for step-by-step observation

**Global hooks:**
- `globalSetup` / `globalTeardown` in `tests/e2e/protocols/global-setup`, gated to run only when `--project=protocols` or `PROTOCOL_TESTS=true`.

**webServer:** disabled by default (K8s port-forward expected on :7000). Set `RUN_WEBSERVER=true` to start `npm start` locally.

## Test Structure (E2E)

**Suite organization pattern:**

```typescript
import { test, expect, APIRequestContext, request, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://172.30.22.206:30080';
const DATASOURCE_API = process.env.DATASOURCE_API || `${BASE_URL}`;

let apiContext: APIRequestContext;

test.beforeAll(async () => {
  apiContext = await request.newContext({ ignoreHTTPSErrors: true });
});

test.afterAll(async () => {
  await apiContext.dispose();
});

// Sequential mode for stateful suites:
test.describe.configure({ mode: 'serial' });

test.describe('@P0 @Pipeline CSV Pipeline Flow', () => {
  test('PL-001: create datasource with HTTP input server', async ({ page, cleanup, request }) => {
    // ...
  });
});
```

Reference: `src/Frontend/tests/e2e/sanity.spec.ts:10-49`, `src/Frontend/tests/e2e/p0-pipeline-flow.spec.ts:9-37`.

**Shared helpers (extract to top of file when used 2+ times):**
- `extractId(body)` and `extractData(body)` — defensive accessors for `body?.Data?.ID || body?.ID || body?.id` (handles both PascalCase backend wrapper and camelCase responses).
- `antSelect(page, inputId, optionMatcher?, optionIndex?)` — opens Ant Design `<Select>` and clicks a dropdown option. Required because Playwright `.click()` doesn't trigger React state changes on Ant's custom controls.
- `antTabClick(page, tabKey)` — clicks an Ant Design tab via `document.querySelector('[id$="-tab-${key}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`. Native click doesn't fire React synthetic events in RTL mode.
- See `src/Frontend/tests/e2e/sanity.spec.ts:51-82`.

## Mocking

**Backend (unit):**
```csharp
var logger = new Mock<ILogger<CsvToJsonConverter>>();
_converter = new CsvToJsonConverter(logger.Object);
```
- Only mock pure dependencies (loggers, interfaces with no observable side effects).
- DO NOT mock MongoDB, MassTransit, or HTTP clients in unit tests — those are exercised in E2E.
- Reference: `src/Services/FileProcessorService.Tests/CsvToJsonConverterHeaderlessTests.cs:20-24`.

**Frontend:**
- E2E tests do not mock; they hit real backend APIs via `apiContext` and real UI in chromium.
- API specs use Playwright `APIRequestContext` directly to call `DATASOURCE_API`, bypassing the UI.
- For SignalR multi-user testing, two browser contexts are opened simultaneously to verify cross-session sync (`multi-user-live-sync.spec.ts`, `multi-user-sync.spec.ts`).

## Fixtures and Test Data

**Test data files (`src/Frontend/tests/e2e/fixtures/`):**
- `test-data.csv` — basic CSV
- `test-data.json` — JSON payload
- `test-data.xlsx` — Excel workbook
- `test-data.xml` — XML payload
- `generate-xlsx.js` — script to (re)generate the xlsx fixture

**Helper modules (`src/Frontend/tests/e2e/helpers/`):**
- `ez-api-client.ts` — typed wrappers for `/api/v1/Servers`, `/api/v1/NasDevices`, `/api/v1/FileOperations` with PascalCase request payloads (`AdminServerPayload`, `NasDeviceRole` enum, etc.). Reference: `tests/e2e/helpers/ez-api-client.ts:8-60`.
- `simulator-client.ts` — calls file-simulator service to seed pipeline test data
- `ui-helpers.ts` — shared UI navigation (RTL-aware clicks, etc.)
- `test-data.ts` — programmatic test data builders
- `report-generator.ts` — generates matrix HTML reports for protocol suite

**Unique naming convention:** Tests use `Date.now()` for entity name uniqueness:
```typescript
const dsName = `Sanity-UI-${Date.now()}`;
const dsName = `PL001 Pipeline ${Date.now()}`;
```

**Cleanup pattern:** Tests own their cleanup. Always `try { ... } finally { await apiContext.delete(...); }`. The `cleanup` fixture (provided in `tests/e2e/support`) tracks IDs and reaps them after the test.

## E2E Scenarios (6 Passing)

Pipeline-level acceptance scenarios validated end-to-end through Kubernetes-deployed services:

| ID | Scenario | Description |
|----|----------|-------------|
| **E2E-001** | Basic pipeline | FileDiscovery → Validation → Output happy path with CSV |
| **E2E-002** | Large file processing | 100+ records through the full pipeline |
| **E2E-003** | Invalid records handling | Schema violations routed to InvalidRecordsService |
| **E2E-004** | Multi-destination output | Folder + Kafka destinations from a single datasource |
| **E2E-005** | Scheduled polling | Quartz.NET job triggers FileDiscovery → pipeline |
| **E2E-006** | Error recovery & retry | MassTransit retry logic handles transient failures |

**Source files:**
- `src/Frontend/tests/e2e/v030-e2e-ftp-pipeline.spec.ts`
- `src/Frontend/tests/e2e/v030-e2e-nas-pipeline.spec.ts`
- `src/Frontend/tests/e2e/v030-selection-verification.spec.ts`
- `src/Frontend/tests/e2e/e2e-validation/` (sequential project, 180s/test)

## Sanity Suite (Deployment Gate)

**Purpose:** Fast (< 5 min), API-level checks for a freshly deployed + seeded cluster. Runs after `DemoDataGenerator` seeding in CI's `sanity-deploy` job.

**File:** `src/Frontend/tests/e2e/sanity.spec.ts` (821 lines, 21 tests)

**Tests:**
- SANITY-01: All 7 service health endpoints respond (3x retry, 5s backoff)
- SANITY-02: Seeded datasources visible
- SANITY-03: Create + delete datasource via UI (all 8 tabs) — uses Ant Design RTL workarounds
- SANITY-04: Seeded categories visible
- SANITY-05: Metrics endpoint responsive
- SANITY-06: Scheduling endpoint responsive
- SANITY-07: Frontend loads, title not empty (Hebrew or English)
- SANITY-08: Docs homepage opens
- SANITY-09: Hebrew user guide loads with Hebrew characters (regex `/[א-ת]/`)
- SANITY-10: Help button opens docs popup
- SANITY-11: NAS pipeline — create datasource with NAS device (skips if no provisioned NAS)
- SANITY-12: Revalidate-all endpoint
- SANITY-13: SchemaVersion increments on schema update
- SANITY-14: TTL field persists
- SANITY-15: Clone datasource (name prefix)
- SANITY-16: Clone preserves schema + output destinations
- SANITY-17: Create datasource with CSV-inferred schema
- SANITY-18: Archive datasource fields
- SANITY-19: Incomplete datasource flagging
- SANITY-20: All 10 menu pages load without error boundary or infinite spinner (headed Chrome)
- SANITY-21: All nginx proxy routes reach backend services (catches port-mismatch bugs like the 5006→5007 regression)

**Run gate:** `npm run test:e2e:sanity` must pass before deployments are considered acceptance-complete.

## Coverage

**Backend:**
- No enforced coverage threshold; `coverlet.collector` configured but no `[Collect Coverage]` enforced.
- View coverage: `dotnet test --collect:"XPlat Code Coverage"` then inspect `TestResults/*/coverage.cobertura.xml`.

**Frontend:**
- No unit test runner configured (`@testing-library/react` and `@testing-library/jest-dom` are devDeps but there is no `npm test` script and no `jest.config` / `vitest.config`).
- Coverage = E2E coverage; the sanity + P0 + P1 + pipeline suites are the de facto coverage metric.

## Test Types

**Unit tests (backend, ~15%):**
- Scope: pure functions, converters, formatters with no I/O.
- Examples: `CsvToJsonConverterHeaderlessTests` covering header / headerless / SchemaPropertyNames mapping.
- Approach: Arrange / Act / Assert with FluentAssertions and Moq for `ILogger<T>`.

**Integration tests (~25%):**
- Backend integration tests are largely stubbed pending `WebApplicationFactory` setup. See `OptimisticLockingTests.cs` (skipped: "Stub -- implement with WebApplicationFactory").
- Effective integration coverage today comes from API-level E2E specs (`*-api.spec.ts`) that hit deployed services directly.

**E2E tests (~60%):**
- Full Kubernetes-deployed pipeline tested via Playwright.
- API specs: `categories-api.spec.ts`, `datasource-api.spec.ts`, `file-operations-api.spec.ts`, `import-archive-api.spec.ts`, `scheduling-api.spec.ts`, `schema-api.spec.ts`.
- UI specs: `categories-ui.spec.ts`, `invalid-records-bulk-ui.spec.ts`, `scheduling-ui.spec.ts`, `schema-validation-ui.spec.ts`, etc.
- Visual regression: `rtl-visual.spec.ts` + Playwright `toHaveScreenshot()`.

## Common Patterns

**Async / await with Playwright:**
```typescript
test('SANITY-NN: description', async ({ page }) => {
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('selector')).toBeVisible();
});
```

**Defensive response parsing (handles backend Data wrapper):**
```typescript
const body = await response.json();
const items = Array.isArray(body)
  ? body
  : body?.Data?.Items ?? body?.data?.items ?? body?.data ?? body?.items ?? [];
```

**Rate-limit-aware cleanup (cluster has 10s retry-after):**
```typescript
try {
  // ... test work ...
} finally {
  await new Promise(r => setTimeout(r, 11000));  // wait past rate limit
  await apiContext.delete(`${DATASOURCE_API}/api/v1/DataSource/${dsId}?deletedBy=SanityTest`);
}
```

**Error testing in backend unit tests:**
```csharp
[Fact]
public async Task Update_WithStaleVersion_Returns409Conflict()
{
    // Arrange
    var stale = await CreateAndReadVersion();
    await BumpVersion();
    
    // Act
    var response = await PutWithVersion(stale);
    
    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.Conflict);
}
```

**Skipped test stubs (mark with reason):**
```csharp
[Fact(Skip = "Stub -- implement with WebApplicationFactory")]
public async Task SomeTest() { ... }
```
Reference: `src/Services/DataSourceManagementService.Tests/OptimisticLockingTests.cs:11`.

## `/gsd:add-tests` Workflow

Per `CLAUDE.md` Testing Requirements, every phase that touches frontend UI MUST run both testing tools before the phase is complete.

**Step 1: `/gsd:add-tests {phase}` — Unit + E2E test generation**
- Classifies modified files into TDD (unit) / E2E (Playwright) / Skip.
- Generates Vitest unit tests for pure functions (frontend has Vitest devDeps available; no config exists yet so generation is the trigger to add one).
- Generates Playwright E2E specs for UI behavior.
- Run with `--headed` flag during local validation: `npx playwright test --headed`.

**Step 2: `webapp-testing` skill — Comprehensive UI verification**
- Python Playwright scripts under `src/Frontend/tests/webapp-testing/`.
- Reconnaissance-first: `recon.py` discovers DOM, then targeted `*_comprehensive_test.py` scripts assert behavior.
- Exercises edge cases NOT covered by `/gsd:add-tests`:
  - Tooltip visibility on hover
  - Modal title + body content
  - Cancel flow (close modal without action)
  - Uniqueness (multiple clones of the same datasource)
  - Duplicate-name error handling
  - Form pre-fill verification after clone

**Tools complement each other:**
- `/gsd:add-tests` → unit tests + basic E2E flows
- `webapp-testing` → comprehensive UI verification with edge cases

Reference in planning: `.planning/phases/26-completeness-checklist/26-04-PLAN.md:465` — "Testing policy satisfied: both /gsd:add-tests and webapp-testing tools exercised".

## Known Test Gaps

**To be addressed in future releases (per CLAUDE.md):**

| Gap | Current State | Risk |
|-----|---------------|------|
| **File format coverage** | Only CSV fully E2E tested. XML, Excel, JSON converters exist but lack end-to-end pipeline tests. | XML/Excel/JSON regressions ship undetected. |
| **High-load testing** | Maximum tested: 100 records (E2E-002). No load tests at 1k, 10k, or 100k records. | Performance cliffs (memory, Hazelcast TTL, MongoDB query plans) not validated. |
| **Multi-destination scaling** | Only 2 destinations tested (E2E-004 Folder + Kafka). No tests at 4+ destinations. | Fan-out throughput, backpressure, partial-failure semantics unknown. |
| **Backend integration tests** | `OptimisticLockingTests` are stubs (`Skip = "Stub -- implement with WebApplicationFactory"`). No service has full `WebApplicationFactory` integration coverage. | 409 Conflict semantics, MassTransit retry policies, optimistic locking validated only at E2E layer. |
| **Frontend unit tests** | No Vitest/Jest runner configured despite `@testing-library/react` being installed. Pure helpers (`completenessUtils`, `humanizeCron`, schema validators) lack unit coverage. | Logic regressions in pure functions caught only through full Playwright runs. |
| **Backend service test coverage** | Only 2 of 9 services have a `.Tests` project (`DataSourceManagementService.Tests`, `FileProcessorService.Tests`). Validation, Output, Scheduling, FileDiscovery, InvalidRecords, MetricsConfiguration, DataSourceChat have no unit tests. | High-blast-radius changes in those services rely on E2E + manual validation. |

## Run-Order Considerations

- Sanity suite assumes seeded data. Run `cd tools/DemoDataGenerator && dotnet run` after a fresh deploy before invoking `npm run test:e2e:sanity`.
- Port forwards must be active for tests that hit non-NodePort backends (Validation 5003, FileProcessor 5008, Output 5009, InvalidRecords 5007). Run `scripts/start-port-forwards.ps1` first.
- Stateful suites (`p0-*`, `v030-*`, `multi-user-*`) declare `test.describe.configure({ mode: 'serial' })` so workers don't trample each other.
- Rate limiter on the cluster returns 429 with `retry-after: 10s`; cleanup loops wait 11s before `DELETE` calls.

---

*Testing analysis: 2026-05-24*

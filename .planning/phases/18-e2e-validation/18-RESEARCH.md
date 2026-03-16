# Phase 18: E2E Validation - Research

**Researched:** 2026-03-16
**Domain:** End-to-end testing, Playwright, .NET integration tests, pipeline validation
**Confidence:** HIGH

## Summary

Phase 18 is a pure testing/validation phase with no new features. The project already has substantial test infrastructure from Phases 15.1 and earlier: Playwright config with project-based separation, file-simulator client, EZ API client, UI helpers with RTL-safe Ant Design interactions, matrix report generator with file-based persistence, and backend integration test fixtures with Kafka/MongoDB/file-simulator support.

The work divides into four plans: (1) full pipeline flow E2E tests using DemoDataGenerator-seeded environment, (2) error/negative tests with static bad data fixtures, (3) Playwright UI tests in a new `e2e-validation` project, and (4) running all existing tests against the file-simulator environment and producing a validation report.

**Primary recommendation:** Reuse existing test helpers extensively. Add a new `e2e-validation` Playwright project with its own global setup/teardown. Adapt the MatrixReporter pattern for the E2E validation report. Keep backend and frontend test concerns separate but share the same DemoDataGenerator-seeded environment.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- DemoDataGenerator seeds the environment: run `--use-simulator --upload-files` to create servers, files, DataSources with schemas/schedules/output destinations
- Protocol coverage: FTP + SFTP + NAS only (Phase 15.1 already verified all 8 protocols)
- Output comparison: record count + field sampling (verify correct count, sample 3-5 fields match expected, no records lost) -- not exact byte-level match
- Pipeline completion detection: poll output destination every 2-5 seconds until expected file count appears, 60-second timeout
- Test runs against DemoDataGenerator-seeded environment in beforeAll, individual tests target specific DataSources
- Four categories of bad data: schema violations, malformed files, mixed valid/invalid records, wrong format for schema
- Verification via InvalidRecords API: query `/api/v1/invalid-records` to verify correct rejection count and error types
- Test data: pre-created static fixtures checked into test-data/ directory -- deterministic, reviewable, no runtime generation
- Four Playwright focus areas: real data workflows, DataSource pipeline trigger, System Monitoring live data, cross-feature workflows
- File-simulator required for all Phase 18 UI tests -- beforeAll verifies simulator health, fails fast if unavailable
- New Playwright project `e2e-validation` in playwright.config.ts with own testDir, sequential execution, longer timeouts
- Existing test validation strategy: run all + fix failures, 100% pass, zero skips for file-simulator reason
- Summary report: markdown matrix at `test-results/E2E-VALIDATION-REPORT.md`

### Claude's Discretion
- Exact test file organization within `tests/e2e/e2e-validation/` directory
- Test helper utilities and shared setup code structure
- Specific field sampling strategy for output comparison
- Timeout tuning for pipeline completion polling
- Bad data fixture file contents and naming conventions
- Report format details and categorization labels

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-01 | Full file flow test (generate -> ingest -> process -> output -> compare) | DemoDataGenerator seeding, pipeline polling pattern, output comparison via file-operations API, record count + field sampling |
| E2E-02 | Error/negative tests with intentional bad data verify filtering and error handling | InvalidRecords API at `/api/v1/invalid-records` with ErrorType/DataSourceId filters, static fixtures in test-data/, four bad data categories |
| E2E-03 | Playwright UI verification of NAS devices, AdminServer, file protocols, all features | Existing UI helpers (addServerViaUI, addNasDeviceViaUI, clickAntTab), new e2e-validation project, file-simulator prerequisite |
| E2E-04 | All existing E2E tests validated against file-simulator environment | 11 existing Playwright specs + backend integration tests, validation report using MatrixReporter pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | ^1.49.0 | E2E browser testing | Already installed, project uses it for all E2E |
| xunit + FluentAssertions | (per CPM) | Backend integration tests | Already in use for pipeline tests |
| DemoDataGenerator | N/A (internal tool) | Environment seeding | Phase 17 built `--use-simulator --upload-files` support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simulator-client.ts | N/A (internal) | File-simulator HTTP client | Health checks, server discovery |
| ez-api-client.ts | N/A (internal) | EZ backend API client | Server/NAS CRUD, file operations, connection testing |
| ui-helpers.ts | N/A (internal) | RTL-safe Ant Design interactions | All UI test automation |
| report-generator.ts | N/A (internal) | Matrix report generation | E2E validation report output |

### Alternatives Considered
None -- this phase uses only existing project infrastructure. No new external dependencies needed.

## Architecture Patterns

### Recommended Test Structure
```
src/Frontend/tests/e2e/
  e2e-validation/              # NEW: Phase 18 test directory
    global-setup.ts            # Health checks + DemoDataGenerator seeding
    global-teardown.ts         # Validation report generation
    pipeline-flow.spec.ts      # E2E-01: Full pipeline flow tests
    negative-tests.spec.ts     # E2E-02: Error/bad data tests
    ui-workflows.spec.ts       # E2E-03: UI workflow tests
    ui-monitoring.spec.ts      # E2E-03: SignalR/monitoring tests
    cross-feature.spec.ts      # E2E-03: Multi-page cross-feature flows
    helpers/
      pipeline-poller.ts       # Poll output destination for pipeline completion
      validation-reporter.ts   # E2E validation report generator (adapts MatrixReporter)
      bad-data-loader.ts       # Load static bad data fixtures from test-data/

test-data/
  e2e-validation/              # NEW: Static bad data fixtures
    schema-violations/
      wrong-types.csv          # String in numeric field, etc.
      missing-required.csv     # Missing required fields
      extra-fields.csv         # Unknown extra columns
    malformed/
      corrupted.csv            # Truncated/corrupted CSV
      invalid-json.json        # Malformed JSON syntax
      truncated.csv            # Incomplete file
    mixed/
      valid-invalid-mix.csv    # 70% valid + 30% invalid records
    wrong-format/
      json-for-csv.json        # JSON file sent to CSV-configured DataSource
```

### Pattern 1: Pipeline Completion Polling
**What:** Poll output destination via file-operations API until expected file/record count appears
**When to use:** E2E-01 full pipeline flow tests
**Example:**
```typescript
// Poll output destination for pipeline completion
async function waitForPipelineOutput(
  request: APIRequestContext,
  outputServerId: string,
  expectedFileCount: number,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 3000
): Promise<DiscoveredFile[]> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const files = await listFiles(request, outputServerId);
    if (files.length >= expectedFileCount) {
      return files;
    }
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Pipeline output timeout: expected ${expectedFileCount} files, got ${files.length}`);
}
```

### Pattern 2: InvalidRecords API Verification
**What:** Query the InvalidRecords service to verify error counts and types after processing bad data
**When to use:** E2E-02 negative tests
**Example:**
```typescript
// Verify invalid records were created with expected error types
async function verifyInvalidRecords(
  request: APIRequestContext,
  dataSourceId: string,
  expectedCount: number,
  expectedErrorTypes?: string[]
): Promise<void> {
  const response = await request.get(
    `http://localhost:5007/api/v1/invalid-records?DataSourceId=${dataSourceId}&PageSize=100`
  );
  const body = await response.json();
  expect(body.totalCount).toBe(expectedCount);
  if (expectedErrorTypes) {
    const actualTypes = body.data.map((r: any) => r.ErrorType);
    for (const expected of expectedErrorTypes) {
      expect(actualTypes).toContain(expected);
    }
  }
}
```

### Pattern 3: DemoDataGenerator Seeding in Global Setup
**What:** Run DemoDataGenerator with `--use-simulator --upload-files` as prerequisite before all tests
**When to use:** Global setup for e2e-validation project
**Example:**
```typescript
// In global-setup.ts
import { execSync } from 'child_process';

// Seed environment (idempotent -- DemoDataGenerator overwrites by design)
execSync(
  'dotnet run --project tools/DemoDataGenerator -- --use-simulator --upload-files --direct-connection',
  { timeout: 120000, stdio: 'inherit' }
);
```

### Pattern 4: E2E Validation Report Generation
**What:** Adapt MatrixReporter pattern for E2E validation summary report
**When to use:** Global teardown for e2e-validation project, and after backend test suite
**Example:**
```typescript
// Extend or adapt the MatrixReporter for E2E validation categories
interface E2ETestResult {
  suite: string;        // 'pipeline-flow' | 'negative' | 'ui-workflow' | 'existing'
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
  category?: string;    // 'protocol' | 'format' | 'ui' | 'backend'
}
```

### Anti-Patterns to Avoid
- **Runtime-generated bad data:** Decisions lock test data as static fixtures -- do not generate bad data at runtime
- **Skipping tests when file-simulator unavailable:** Phase 18 fails fast, not skip -- use `throw` not `test.skip()`
- **Byte-level output comparison:** Use record count + field sampling per decisions, not exact file content matching
- **Parallel execution of pipeline tests:** E2E-validation project runs sequentially to avoid resource contention on shared infrastructure

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File-simulator interaction | Custom HTTP client | `simulator-client.ts` | Already battle-tested in Phase 15.1 |
| EZ API calls | Direct fetch() calls | `ez-api-client.ts` | PascalCase handling, error logging, all endpoints |
| UI tab/form interactions | Raw Playwright selectors | `ui-helpers.ts` | RTL-safe click workarounds for Ant Design |
| Report generation | Custom markdown builder | Adapt `MatrixReporter` | File persistence, cross-worker state, proven pattern |
| S3 bucket setup | Custom code | `global-setup.ts` already has S3 bucket creation | AWS SigV4 signing already implemented |

**Key insight:** Phase 15.1 built comprehensive test infrastructure. Phase 18 should reuse everything and only add pipeline-specific polling and validation report logic.

## Common Pitfalls

### Pitfall 1: Ant Design Tab Click in RTL Mode
**What goes wrong:** Standard Playwright `.click()` on Ant Design tabs does not trigger React state change
**Why it happens:** RTL layout combined with Ant Design's internal event handling
**How to avoid:** Use `dispatchEvent(new MouseEvent('click', {bubbles: true}))` via `page.evaluate()` -- already implemented in `clickAntTab()` in ui-helpers.ts
**Warning signs:** Tab appears clicked (visual) but content panel does not change

### Pitfall 2: Pipeline Timing Non-Determinism
**What goes wrong:** Tests flake because pipeline processing time varies with system load
**Why it happens:** Multiple services (FileDiscovery -> FileProcessor -> Validation -> Output) with Kafka between each
**How to avoid:** Use polling with generous timeouts (60s per decision). Detect completion by output file presence, not time-based waiting. Allow 2-3 retries in CI.
**Warning signs:** Tests pass locally but fail intermittently

### Pitfall 3: Port-Forward Disruption
**What goes wrong:** Tests fail with ECONNREFUSED mid-suite
**Why it happens:** kubectl port-forward on Hyper-V is unreliable, breaks when pods restart (deployment rollout during provisioning)
**How to avoid:** Use NodePort access where possible (file-simulator at 30500, MongoDB at 31190). For EZ services that must use port-forward, add retry logic on connection errors
**Warning signs:** 6+ ECONNREFUSED errors across unrelated tests (Phase 15.1 saw this)

### Pitfall 4: Stale DemoDataGenerator State
**What goes wrong:** Re-running tests finds existing DataSources with different IDs than expected
**Why it happens:** DemoDataGenerator is overwrite-by-design but may leave orphaned entities from previous runs
**How to avoid:** Tests should query DataSources by name (not hardcoded IDs) after seeding. Use `beforeAll` to discover created entities.
**Warning signs:** Tests pass on clean environment but fail on re-run

### Pitfall 5: InvalidRecords Service Port
**What goes wrong:** Queries to InvalidRecords API fail
**Why it happens:** InvalidRecords runs on port 5007, not 5001. API route is `/api/v1/invalid-records` (with hyphen, not camelCase)
**How to avoid:** Use correct port 5007 and exact route `/api/v1/invalid-records`
**Warning signs:** 404 or connection refused when querying invalid records

### Pitfall 6: PascalCase API Payloads
**What goes wrong:** API calls return 400 or ignore fields
**Why it happens:** Backend uses `PropertyNamingPolicy = null` -- expects PascalCase property names
**How to avoid:** All API payloads must use PascalCase (`DataSourceId`, not `dataSourceId`). ez-api-client.ts already handles this for server/NAS endpoints; extend pattern for DataSource and InvalidRecords queries.
**Warning signs:** API returns success but data is empty or wrong

## Code Examples

### Existing API Endpoints Summary (verified from source)

| Service | Port | Route | Purpose |
|---------|------|-------|---------|
| DataSourceManagement | 5001 | `api/v1/datasource` | DataSource CRUD |
| DataSourceManagement | 5001 | `api/v1/servers` | AdminServer CRUD |
| DataSourceManagement | 5001 | `api/v1/nasdevices` | NAS device CRUD |
| DataSourceManagement | 5001 | `api/v1/file-operations/{serverId}/list\|read\|write` | File operations proxy |
| DataSourceManagement | 5001 | `api/v1/health-status` | Device health monitoring |
| InvalidRecords | 5007 | `api/v1/invalid-records` | Invalid record queries |
| InvalidRecords | 5007 | `api/v1/invalid-records` (GET with query params) | Filtered list: DataSourceId, ErrorType, Page, PageSize |

### InvalidRecordListRequest Query Parameters
```
?Page=1&PageSize=25&DataSourceId={id}&ErrorType={type}&StartDate={date}&EndDate={date}&Search={text}&Status={status}
```
ErrorType values: `schema`, `format`, `required`, `range`
Status values: `New`, `InProgress`, `Corrected`, `Ignored`

### InvalidRecordDto Response Fields
```typescript
interface InvalidRecordDto {
  Id: string;
  DataSourceId: string;
  DataSourceName: string;
  FileName: string;
  LineNumber?: number;
  CreatedAt: string;
  Errors: ValidationErrorDto[];
  OriginalData?: unknown;
  ErrorType: string;        // schema, format, required, range
  Severity: string;         // Error
  IsReviewed: boolean;
  ReviewedBy?: string;
  ReviewedAt?: string;
  ReviewNotes?: string;
  IsIgnored: boolean;
}
```

### Playwright Config Addition for e2e-validation Project
```typescript
// Add to projects array in playwright.config.ts
{
  name: 'e2e-validation',
  testDir: './tests/e2e/e2e-validation',
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  timeout: 180000,         // 3 min per test (pipeline processing)
  fullyParallel: false,    // Sequential to avoid resource contention
}
```

### Global Setup/Teardown Gating Pattern (from protocols project)
```typescript
// Gate execution to only run when e2e-validation project is selected
const isValidationRun =
  process.env.E2E_VALIDATION === 'true' ||
  process.argv.some(arg => arg.includes('e2e-validation'));
if (!isValidationRun) return;
```

### Output Comparison: Record Count + Field Sampling
```typescript
// Read output file, parse records, compare against input
async function compareOutputWithInput(
  request: APIRequestContext,
  outputServerId: string,
  outputFilePath: string,
  expectedRecordCount: number,
  sampleFields: string[],       // e.g. ['TransactionId', 'Amount', 'Currency']
  expectedSamples: Record<string, unknown>[]  // first 3-5 records expected values
): Promise<{ passed: boolean; details: string }> {
  const content = await readFile(request, outputServerId, outputFilePath);
  const records = parseCsv(content.toString('utf-8'));

  if (records.length !== expectedRecordCount) {
    return { passed: false, details: `Record count mismatch: expected ${expectedRecordCount}, got ${records.length}` };
  }

  for (let i = 0; i < expectedSamples.length; i++) {
    for (const field of sampleFields) {
      if (records[i][field] !== expectedSamples[i][field]) {
        return { passed: false, details: `Field mismatch at record ${i}, field ${field}` };
      }
    }
  }

  return { passed: true, details: `${records.length} records verified, ${sampleFields.length} fields sampled` };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `SkipIfFileSimulatorUnavailable()` in backend tests | Phase 18: all tests MUST pass with file-simulator available | Phase 18 | No more skips -- fix or document |
| Individual protocol spec files | Organized by test category (pipeline, negative, UI) | Phase 18 | Better test organization |
| Protocol-only matrix report | E2E validation report covering all test categories | Phase 18 | Comprehensive validation summary |

## Open Questions

1. **DemoDataGenerator Output Destination Configuration**
   - What we know: DemoDataGenerator creates DataSources with output destinations via `--use-simulator --upload-files`
   - What's unclear: Exact output destination type and location configured by DemoDataGenerator (folder? Kafka? Which server?)
   - Recommendation: Inspect DemoDataGenerator seeding output during plan implementation; test code should discover output destination from created DataSource entity rather than hardcoding

2. **Backend Integration Test Runner in Phase 18**
   - What we know: Backend tests use `SkipIfFileSimulatorUnavailable()` pattern; Phase 18 goal is 0 skips
   - What's unclear: Whether backend tests should run as separate `dotnet test` invocation or be wrapped into Playwright global setup
   - Recommendation: Run backend tests as separate step (`dotnet test` with FILE_SIMULATOR_IP env var set), capture results, include in validation report

3. **SignalR Real-Time Verification**
   - What we know: Phase 16 implemented SignalR broadcasting; Playwright can observe DOM updates
   - What's unclear: Whether to test WebSocket connection directly or just verify UI data updates
   - Recommendation: Verify via UI -- check that monitoring page shows live data after pipeline processing, no direct WebSocket testing needed

## Sources

### Primary (HIGH confidence)
- `src/Frontend/playwright.config.ts` -- current Playwright configuration and project structure
- `src/Frontend/tests/e2e/helpers/*.ts` -- all existing test helper modules (read in full)
- `src/Frontend/tests/e2e/protocols/global-setup.ts` -- global setup pattern with health checks
- `src/Services/InvalidRecordsService/Controllers/InvalidRecordController.cs` -- actual API route `/api/v1/invalid-records`
- `src/Services/InvalidRecordsService/Models/` -- request/response DTOs for InvalidRecords queries
- `tests/IntegrationTests/Pipeline/PipelineFlowTests.cs` -- existing backend pipeline test patterns
- `tests/IntegrationTests/TestConfiguration.cs` -- backend test config with ports and env vars

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- user-locked implementation choices
- MEMORY.md -- accumulated gotchas from previous phases (RTL, port-forward, PascalCase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already exist in the project, no new dependencies
- Architecture: HIGH -- patterns directly derived from existing Phase 15.1 test infrastructure
- Pitfalls: HIGH -- documented from actual project experience in MEMORY.md and prior phase work

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- testing infrastructure, no external dependency changes expected)

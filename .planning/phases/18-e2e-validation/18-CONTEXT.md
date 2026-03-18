# Phase 18: E2E Validation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive E2E test coverage including file-simulator environment: full pipeline flow tests (generate→ingest→process→output→compare), error/negative tests with bad data, Playwright UI tests for NAS devices, AdminServer, all features against real data, and validation of all existing tests against file-simulator. No new features — pure testing/validation phase.

</domain>

<decisions>
## Implementation Decisions

### Full pipeline flow tests (E2E-01)
- DemoDataGenerator seeds the environment: run `--use-simulator --upload-files` to create servers, files, DataSources with schemas/schedules/output destinations
- Protocol coverage: FTP + SFTP + NAS only (Phase 15.1 already verified all 8 protocols' file operations work)
- Output comparison: record count + field sampling (verify correct count, sample 3-5 fields match expected, no records lost) — not exact byte-level match
- Pipeline completion detection: poll output destination every 2-5 seconds until expected file count appears, 60-second timeout
- Test runs against DemoDataGenerator-seeded environment in beforeAll, individual tests target specific DataSources

### Error & negative tests (E2E-02)
- Four categories of bad data:
  1. Schema violations (wrong types, missing required fields, extra unknown fields)
  2. Malformed files (corrupted CSV, invalid JSON syntax, truncated files)
  3. Mixed valid/invalid records (70% valid + 30% invalid in same file)
  4. Wrong format for schema (JSON file to CSV-configured DataSource)
- Verification via InvalidRecords API: query `/api/v1/invalidrecords` to verify correct rejection count and error types (schema_violation, parse_error, etc.)
- Test data: pre-created static fixtures checked into test-data/ directory — deterministic, reviewable, no runtime generation

### Playwright UI coverage (E2E-03)
- Four focus areas:
  1. Real data workflows — run existing UI tests against file-simulator-seeded environment (real servers, NAS devices, DataSources)
  2. DataSource pipeline trigger — create DataSource via UI, trigger processing, verify records in output and invalid records pages
  3. System Monitoring live data — verify SignalR real-time data, device health indicators, pod status with real environment
  4. Cross-feature workflows — multi-page flows (create NAS → create DataSource using it → verify connection → check processing)
- File-simulator required for all Phase 18 UI tests — beforeAll verifies simulator health, fails fast if unavailable
- New Playwright project `e2e-validation` in playwright.config.ts with own testDir (`tests/e2e/e2e-validation/`), sequential execution, longer timeouts

### Existing test validation (E2E-04)
- Strategy: run all + fix failures — full backend integration suite + all Playwright projects with file-simulator available
- Pass criteria: 100% pass, zero skips for file-simulator reason — fix real bugs, update outdated assertions, document limitations
- Triage: fix bugs found, update expectations for intentional changes from Phase 11-17 work
- Summary report: markdown matrix report at `test-results/E2E-VALIDATION-REPORT.md` — test suite × pass/fail, protocol coverage, format coverage, totals (similar to Phase 15.1 protocol report)

### Claude's Discretion
- Exact test file organization within `tests/e2e/e2e-validation/` directory
- Test helper utilities and shared setup code structure
- Specific field sampling strategy for output comparison
- Timeout tuning for pipeline completion polling
- Bad data fixture file contents and naming conventions
- Report format details and categorization labels

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing test infrastructure
- `src/Frontend/playwright.config.ts` — Playwright config with projects (chromium, protocols), global setup/teardown
- `src/Frontend/tests/e2e/helpers/simulator-client.ts` — File-simulator HTTP client for tests
- `src/Frontend/tests/e2e/helpers/ez-api-client.ts` — EZ platform API client for tests
- `src/Frontend/tests/e2e/helpers/ui-helpers.ts` — Shared UI test helpers
- `src/Frontend/tests/e2e/helpers/test-data.ts` — Test data utilities
- `src/Frontend/tests/e2e/helpers/report-generator.ts` — Markdown report generation (Phase 15.1 pattern)
- `src/Frontend/tests/e2e/protocols/global-setup.ts` — Protocol test global setup pattern
- `src/Frontend/tests/e2e/protocols/global-teardown.ts` — Protocol test global teardown pattern

### Backend integration tests
- `tests/IntegrationTests/Pipeline/PipelineFlowTests.cs` — Existing pipeline flow tests with SkipIfFileSimulatorUnavailable
- `tests/IntegrationTests/Pipeline/FormatPipelineTests.cs` — Format conversion pipeline tests
- `tests/IntegrationTests/TestConfiguration.cs` — Test configuration with file-simulator availability check
- `tests/IntegrationTests/Fixtures/PipelineFixture.cs` — Pipeline test fixture setup

### Existing Playwright E2E specs (11 files)
- `src/Frontend/tests/e2e/datasource.spec.ts` — DataSource CRUD + connection testing
- `src/Frontend/tests/e2e/nas-devices.spec.ts` — NAS device management, provisioning, connection tab
- `src/Frontend/tests/e2e/admin-server.spec.ts` — AdminServer management
- `src/Frontend/tests/e2e/invalid-records.spec.ts` — Invalid records management
- `src/Frontend/tests/e2e/schema.spec.ts` — Schema management
- `src/Frontend/tests/e2e/metrics.spec.ts` — Metrics configuration
- `src/Frontend/tests/e2e/alerts.spec.ts` — Alert rules
- `src/Frontend/tests/e2e/archive-extraction.spec.ts` — Archive extraction
- `src/Frontend/tests/e2e/signalr-monitoring.spec.ts` — SignalR real-time monitoring
- `src/Frontend/tests/e2e/rtl-visual.spec.ts` — RTL visual regression
- `src/Frontend/tests/e2e/help-integration.spec.ts` — Help/Docusaurus integration

### Phase 17 context (file-simulator integration)
- `.planning/phases/17-file-simulator-integration/17-CONTEXT.md` — DemoDataGenerator seeding decisions, upload strategy
- `tools/DemoDataGenerator/Program.cs` — CLI entry with --use-simulator --upload-files flags
- `tools/DemoDataGenerator/Services/SimulatorSeederService.cs` — Simulator seeding orchestration

### Phase 15.1 context (protocol testing patterns)
- `.planning/phases/15.1-test-all-system-devices-nas-and-protocols-file-operations-against-simulator/15.1-CONTEXT.md` — Protocol test decisions, matrix report pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `simulator-client.ts`: HTTP client for file-simulator API (health, servers, create FTP/SFTP/NAS, delete)
- `ez-api-client.ts`: EZ platform API client for backend operations in tests
- `report-generator.ts`: Markdown matrix report generator (Phase 15.1 pattern — reuse for E2E validation report)
- `ui-helpers.ts`: Shared Playwright UI helpers (navigation, form filling, RTL handling)
- `PipelineFixture.cs`: Backend test fixture with MongoDB, Kafka, service connections
- DemoDataGenerator with `--use-simulator --upload-files`: seeds complete environment

### Established Patterns
- Playwright projects: separate config per test suite (chromium, protocols → add e2e-validation)
- Global setup/teardown: health checks in globalSetup, cleanup in globalTeardown
- File-simulator guard: `beforeAll` health check → fail fast if simulator unavailable (not skip)
- `SkipIfFileSimulatorUnavailable()` in backend tests — Phase 18 goal is to make these NOT skip
- Protocol test files: one spec per protocol, matrix reporting

### Integration Points
- `playwright.config.ts`: add new `e2e-validation` project entry
- `test-data/`: add bad data fixtures for negative tests
- `test-results/E2E-VALIDATION-REPORT.md`: validation summary output
- Backend `dotnet test` with file-simulator environment variables set
- DemoDataGenerator seeding as test environment prerequisite

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key outcomes:
1. Running DemoDataGenerator + pipeline produces verifiable output that tests can validate
2. Bad data fixtures are static, reviewable files in the repo
3. New `e2e-validation` Playwright project keeps Phase 18 tests separate from existing standalone tests
4. Final validation report makes it immediately clear what passes and what doesn't

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-e2e-validation*
*Context gathered: 2026-03-16*

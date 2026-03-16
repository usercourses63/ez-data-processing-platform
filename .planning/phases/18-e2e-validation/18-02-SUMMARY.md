---
phase: 18-e2e-validation
plan: 02
subsystem: testing
tags: [playwright, e2e, negative-testing, invalid-records, bad-data-fixtures]

requires:
  - phase: 18-e2e-validation-01
    provides: "E2E validation infrastructure (global-setup, validation-reporter, pipeline-poller)"
  - phase: 17-file-simulator-integration
    provides: "File-simulator integration, file-operations API, writeFile helper"
provides:
  - "8 static bad data fixtures across 4 error categories"
  - "bad-data-loader.ts utility for loading test fixtures by category"
  - "negative-tests.spec.ts with 5 E2E tests covering error handling"
affects: [18-e2e-validation-03, 18-e2e-validation-04]

tech-stack:
  added: []
  patterns: [bad-data-fixture-loading, negative-e2e-test-pattern]

key-files:
  created:
    - src/Frontend/tests/e2e/e2e-validation/helpers/bad-data-loader.ts
    - src/Frontend/tests/e2e/e2e-validation/negative-tests.spec.ts
    - test-data/e2e-validation/schema-violations/wrong-types.csv
    - test-data/e2e-validation/schema-violations/missing-required.csv
    - test-data/e2e-validation/schema-violations/extra-fields.csv
    - test-data/e2e-validation/malformed/corrupted.csv
    - test-data/e2e-validation/malformed/invalid-json.json
    - test-data/e2e-validation/malformed/truncated.csv
    - test-data/e2e-validation/mixed/valid-invalid-mix.csv
    - test-data/e2e-validation/wrong-format/json-for-csv.json
  modified:
    - .gitignore

key-decisions:
  - "Used actual DemoDataGenerator SimpleTransaction schema fields (transactionId, amount, date, status) instead of plan's placeholder fields"
  - "Fixture files already committed in 18-01 second commit -- Task 1 verified no-op"

patterns-established:
  - "Bad data loader: loadBadDataFixture(category, filename) returns Buffer for writeFile API"
  - "Negative test pattern: upload bad data via file-ops API, wait for pipeline, query InvalidRecords API on port 5007"

requirements-completed: [E2E-02]

duration: 4min
completed: 2026-03-16
---

# Phase 18 Plan 02: Negative Tests & Bad Data Fixtures Summary

**Static bad data fixtures (8 files, 4 categories) with Playwright negative tests uploading via file-ops API and verifying InvalidRecords rejection on port 5007**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T19:15:44Z
- **Completed:** 2026-03-16T19:19:36Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- 8 static bad data fixture files matching DemoDataGenerator SimpleTransaction schema
- bad-data-loader.ts utility with loadBadDataFixture() and listBadDataFixtures()
- negative-tests.spec.ts with 5 serial tests: schema violations, malformed, mixed, wrong format, ErrorType filter
- .gitignore exception for test-data/e2e-validation/ (static fixtures must be versioned)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create static bad data fixtures** - `733174f` (feat, already committed in 18-01 session)
2. **Task 2: Create bad-data-loader and negative-tests.spec.ts** - `c19aeb8` (feat)

## Files Created/Modified
- `test-data/e2e-validation/schema-violations/wrong-types.csv` - CSV with wrong data types for schema fields
- `test-data/e2e-validation/schema-violations/missing-required.csv` - CSV with empty required fields
- `test-data/e2e-validation/schema-violations/extra-fields.csv` - CSV with unexpected extra columns
- `test-data/e2e-validation/malformed/corrupted.csv` - Broken CSV structure (unmatched quotes, missing fields)
- `test-data/e2e-validation/malformed/invalid-json.json` - Intentionally invalid JSON syntax
- `test-data/e2e-validation/malformed/truncated.csv` - File cut off mid-record
- `test-data/e2e-validation/mixed/valid-invalid-mix.csv` - 10 records: 7 valid + 3 invalid (70/30 split)
- `test-data/e2e-validation/wrong-format/json-for-csv.json` - Valid JSON for CSV-configured DataSource
- `src/Frontend/tests/e2e/e2e-validation/helpers/bad-data-loader.ts` - Fixture loader by category
- `src/Frontend/tests/e2e/e2e-validation/negative-tests.spec.ts` - 5 negative E2E tests
- `.gitignore` - Added exception for test-data/e2e-validation/

## Decisions Made
- Used actual DemoDataGenerator SimpleTransaction schema fields (transactionId, amount, date, status) instead of plan's placeholder fields (TransactionId, Amount, Currency, Date, Description) to match real validation schemas
- Task 1 fixture files were already committed during 18-01 execution session; verified content matches and skipped redundant commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned fixture field names with actual DemoDataGenerator schema**
- **Found during:** Task 1 (fixture creation)
- **Issue:** Plan specified TransactionId/Amount/Currency/Date/Description but DemoDataGenerator SimpleTransaction schema uses transactionId/amount/date/status
- **Fix:** Used actual schema field names from AllGenerators.cs GenerateSimpleTransactionSchema()
- **Files modified:** All 8 fixture files
- **Verification:** Fields match schema: transactionId (string, pattern TXN-XXXXXXXX), amount (number), date (date), status (enum)

**2. [Rule 3 - Blocking] Added .gitignore exception for static test fixtures**
- **Found during:** Task 1 (fixture commit)
- **Issue:** test-data/ directory was gitignored, preventing fixture files from being tracked
- **Fix:** Changed `test-data/` to `test-data/*` with `!test-data/e2e-validation/` exception
- **Files modified:** .gitignore
- **Verification:** git add succeeds for fixture files

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. Schema field alignment ensures fixtures match actual validation. Gitignore fix enables version control of static test data.

## Issues Encountered
- Task 1 fixture files were already committed in a prior 18-01 session commit (733174f) -- content was identical, no new commit needed

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Negative tests ready for execution against running cluster
- Fixtures available for Plan 03 (UI workflow tests) and Plan 04 (cross-feature tests)
- InvalidRecords API dependency on port 5007 must be port-forwarded for test execution

---
*Phase: 18-e2e-validation*
*Completed: 2026-03-16*

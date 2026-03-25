# Phase 27: Import from File - Validation Architecture

**Generated from:** 27-RESEARCH.md Validation Architecture section
**Phase:** 27-import-from-file

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.49.0 |
| Config file | `src/Frontend/playwright.config.ts` |
| Quick run command | `cd src/Frontend && npx playwright test --grep "import" --headed` |
| Full suite command | `cd src/Frontend && npx playwright test --headed` |

## Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Test File | Automated Command |
|--------|----------|-----------|-----------|-------------------|
| IMPORT-01 | Upload CSV/JSON/XML triggers client-side parse | E2E | `tests/e2e/import-from-file.spec.ts` | `npx playwright test tests/e2e/import-from-file.spec.ts -x --headed` |
| IMPORT-02 | Schema inference produces correct types | E2E (unit-style) | `tests/e2e/import-schema-inference.spec.ts` | `npx playwright test tests/e2e/import-schema-inference.spec.ts -x --headed` |
| IMPORT-03 | Headerless CSV produces field_1, field_2 names | E2E | `tests/e2e/import-from-file.spec.ts --grep "headerless"` | `npx playwright test tests/e2e/import-from-file.spec.ts --grep "headerless" -x --headed` |
| IMPORT-04 | Smart constraints applied via schemaAutoSuggest | E2E (unit-style) | `tests/e2e/import-schema-inference.spec.ts --grep "constraints"` | `npx playwright test tests/e2e/import-schema-inference.spec.ts --grep "constraints" -x --headed` |
| IMPORT-05 | Preview table shows 5 rows, schema editable | E2E | `tests/e2e/import-from-file.spec.ts --grep "preview"` | `npx playwright test tests/e2e/import-from-file.spec.ts --grep "preview" -x --headed` |
| IMPORT-06 | CsvToJsonConverter headerless fix | Integration | `src/Services/FileProcessorService.Tests/CsvToJsonConverterHeaderlessTests.cs` | `cd src/Services/FileProcessorService.Tests && dotnet test --filter "CsvToJsonConverter"` |

## Sampling Rate

- **Per task commit:** `npx playwright test tests/e2e/import-from-file.spec.ts --headed`
- **Per wave merge:** `npx playwright test --headed`
- **Phase gate:** Full suite green before `/gsd:verify-work`

## Test Files Required

- [ ] `src/Frontend/tests/e2e/import-from-file.spec.ts` -- covers IMPORT-01, IMPORT-03, IMPORT-05
- [ ] `src/Frontend/tests/e2e/import-schema-inference.spec.ts` -- covers IMPORT-02, IMPORT-04
- [ ] `src/Services/FileProcessorService.Tests/CsvToJsonConverterHeaderlessTests.cs` -- covers IMPORT-06
- [ ] `src/Frontend/tests/webapp-testing/import_comprehensive_test.py` -- comprehensive edge cases

## Validation Checkpoints

1. **Wave 1 complete:** File analysis engine compiles, all analyzers produce correct ImportData
2. **Wave 2 complete:** Preview modal renders, form pre-fill works, all UI flows functional
3. **Wave 3 complete:** All E2E tests pass, backend integration test passes, deployed to K8s
4. **Phase gate:** Human verification of complete import flow end-to-end

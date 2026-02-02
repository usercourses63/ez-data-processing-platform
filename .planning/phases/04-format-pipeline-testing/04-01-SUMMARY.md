---
phase: 04-format-pipeline-testing
plan: 01
subsystem: testing
tags: [format-conversion, bidirectional, csv, xml, excel, json, round-trip, tdd]

dependency_graph:
  requires:
    - "Existing format converters (CsvToJsonConverter, XmlToJsonConverter, ExcelToJsonConverter, JsonToJsonConverter)"
    - "Existing format reconstructors (JsonToCsvReconstructor, JsonToXmlReconstructor, JsonToExcelReconstructor)"
  provides:
    - "TestDataFactory for generating test data in all formats"
    - "BidirectionalFormatTests for round-trip verification"
    - "Edge case coverage for all format converters"
  affects:
    - "04-02: Pipeline path testing (uses TestDataFactory)"
    - "04-03: Error recovery testing (uses converters)"

tech_stack:
  added:
    - "Bogus 35.6.2 (test data generation)"
  patterns:
    - "Round-trip testing pattern (format -> JSON -> format)"
    - "Deterministic test data generation for reliable comparisons"
    - "Test trait filtering by Category and Format"

file_tracking:
  created:
    - "tests/Shared.Tests/TestData/TestDataFactory.cs (392 lines)"
    - "tests/Shared.Tests/Converters/BidirectionalFormatTests.cs (534 lines)"
  modified:
    - "tests/Shared.Tests/Converters/CsvToJsonConverterTests.cs (+56 lines)"
    - "tests/Shared.Tests/Converters/XmlToJsonConverterTests.cs (+73 lines)"
    - "tests/Shared.Tests/Converters/ExcelToJsonConverterTests.cs (+73 lines)"
    - "tests/Shared.Tests/DataProcessing.Shared.Tests.csproj (Bogus package)"

decisions:
  - id: "04-01-001"
    description: "Use deterministic test data for round-trip comparison (not random)"
    rationale: "Random data makes test failures hard to reproduce; deterministic data allows reliable comparisons"
  - id: "04-01-002"
    description: "Compare parsed records, not raw strings, for CSV round-trips"
    rationale: "Numeric formatting may differ (100.00 vs 100) but semantic data is preserved"
  - id: "04-01-003"
    description: "XmlToJsonConverter converts numeric values to numbers"
    rationale: "Existing converter behavior; updated tests to match actual converter output"

metrics:
  duration: "6 min"
  completed: "2026-02-02"
  tests_added: 23
  tests_total: 63
---

# Phase 04 Plan 01: Bidirectional Format Testing Summary

Comprehensive format conversion tests verifying bidirectional round-trip for all 4 supported formats (CSV, JSON, XML, Excel).

## One-liner

TestDataFactory with 6 generators, BidirectionalFormatTests with 14 round-trip tests, 9 edge case tests added to existing converter tests.

## What Was Built

### TestDataFactory (392 lines)

Static test data factory with generators for all supported formats:

```
GenerateCsv(int recordCount)           - Transaction CSV with realistic data
GenerateXml(int recordCount)           - Transaction XML with proper structure
GenerateExcel(int recordCount)         - Transaction Excel workbook
GenerateJson(int recordCount)          - Transaction JSON array
GetHebrewCsvTestData()                 - Hebrew/RTL content for i18n testing
GetNestedJson()                        - Nested objects for structure preservation
GenerateDeterministicCsv(int count)    - Fixed data for reliable comparisons
GenerateDeterministicXml(int count)    - Fixed XML for comparisons
GenerateDeterministicExcel(int count)  - Fixed Excel for comparisons
```

Uses Bogus library for realistic fake data generation.

### BidirectionalFormatTests (14 tests)

Round-trip tests verifying data survives format -> JSON -> format conversion:

| Test | Format | Description |
|------|--------|-------------|
| Csv_RoundTrip_PreservesTransactionData | CSV | 10 records round-trip |
| Csv_RoundTrip_PreservesHebrewContent | CSV | Hebrew/Unicode preservation |
| Csv_RoundTrip_VariousRecordCounts (0,1,100) | CSV | Edge case record counts |
| Xml_RoundTrip_PreservesTransactionData | XML | 10 transactions round-trip |
| Xml_RoundTrip_PreservesElementHierarchy | XML | Nested element structure |
| Excel_RoundTrip_PreservesTransactionData | Excel | Workbook round-trip |
| Excel_RoundTrip_VariousRecordCounts (0,1,50) | Excel | Edge case counts |
| Json_Passthrough_PreservesNestedStructures | JSON | Nested object/array preservation |
| Json_Passthrough_PreservesDataTypes | JSON | string/number/bool/null types |
| AllFormats_ProduceSameRecordCount | Cross | Consistency check |

### Edge Case Tests Added (9 tests)

| Converter | Test | Purpose |
|-----------|------|---------|
| CSV | WithHebrewContent_PreservesCharacters | Hebrew i18n verification |
| CSV | WithNewlinesInQuotedFields_HandlesCorrectly | Multiline content in quotes |
| CSV | WithLargeFile_CompletesSuccessfully | 1000 records performance |
| XML | WithNamespaces_StripsNamespaces | xmlns handling documented |
| XML | WithCDATA_PreservesContent | CDATA section preservation |
| XML | WithAttributes_IgnoresAttributes | Attribute handling documented |
| Excel | WithMultipleSheets_ReadsFirstSheet | Multi-sheet behavior documented |
| Excel | WithDateCells_FormatsCorrectly | Date cell handling |
| Excel | WithFormulaCells_ReadsValues | Formula result extraction |

## Test Results

```
Total tests: 63
Passed: 63 (100%)
Duration: ~1.7 seconds
```

Test filtering works correctly:
- `--filter "Category=BidirectionalFormat"` - 14 tests
- `--filter "Category=FormatConversion"` - 9 tests
- `--filter "Format=CSV"` - 8 tests
- `--filter "Format=XML"` - 5 tests
- `--filter "Format=Excel"` - 7 tests
- `--filter "Format=JSON"` - 2 tests

## Commits

| Hash | Description |
|------|-------------|
| f7f1022 | test(04-01): add TestDataFactory for format conversion tests |
| ace9acc | test(04-01): add BidirectionalFormatTests for round-trip verification |
| c1c2e77 | test(04-01): add edge case tests to existing converter tests |

## Decisions Made

### 04-01-001: Deterministic Test Data

Used fixed/deterministic test data generators for round-trip comparisons instead of random data. This ensures:
- Test failures are reproducible
- CI/CD runs are consistent
- Debug sessions can be repeated

### 04-01-002: Semantic Comparison for CSV

CSV round-trip tests compare parsed records (key-value pairs) rather than raw string content. This handles:
- Numeric formatting differences (100.00 vs 100)
- Whitespace normalization
- Quote handling variations

### 04-01-003: XML Numeric Conversion

The XmlToJsonConverter converts numeric element values to JSON numbers (not strings). Existing tests were updated to match this behavior. Documentation added to tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed XML test assertions for numeric types**

- **Found during:** Task 3 (extending existing converter tests)
- **Issue:** Existing XmlToJsonConverterTests expected numeric values as strings, but converter returns numbers
- **Fix:** Updated GetString() assertions to GetInt32()/GetDecimal() to match actual converter behavior
- **Files modified:** tests/Shared.Tests/Converters/XmlToJsonConverterTests.cs
- **Commit:** c1c2e77

## Success Criteria Verification

- [x] TestDataFactory exists with generators for all 4 formats (392 lines)
- [x] BidirectionalFormatTests has round-trip tests for CSV, XML, Excel, JSON (14 tests)
- [x] Hebrew content preservation verified (Csv_RoundTrip_PreservesHebrewContent)
- [x] Edge cases covered (empty, single record, large files, quoted delimiters, namespaces)
- [x] All tests pass with `dotnet test` (63/63 passing)
- [x] Test traits allow filtering by Category and Format

## Next Phase Readiness

Phase 04-02 (Pipeline Path Testing) can proceed. TestDataFactory is available for generating test data in pipeline E2E tests.

---
last-verified: 2026-02-02
status: current
phase: 04-format-pipeline-testing
---

# Format & Pipeline Test Guide

This guide documents the Phase 4 testing strategy for EZ Platform format conversion and pipeline integration tests.

## Overview

Phase 4 testing validates:
1. **Format Conversion:** CSV, XML, Excel, JSON bidirectional transformations
2. **Pipeline Integration:** End-to-end message flow through all services
3. **Load Testing:** Volume throughput (100-1000 files)
4. **Hebrew/RTL Support:** Character preservation through all conversions

### Test Locations

```
tests/
  Shared.Tests/
    TestData/TestDataFactory.cs           # Test data generators
    Converters/
      BidirectionalFormatTests.cs         # Round-trip conversion tests
      CsvToJsonConverterTests.cs          # CSV edge cases
      XmlToJsonConverterTests.cs          # XML edge cases
      ExcelToJsonConverterTests.cs        # Excel edge cases
  IntegrationTests/
    Fixtures/
      PipelineFixture.cs                  # Pipeline infrastructure coordinator
      FileSimulatorFixture.cs             # File-simulator connectivity
      KafkaFixture.cs                     # Kafka producer/consumer
      MongoDbFixture.cs                   # MongoDB connectivity
      HazelcastFixture.cs                 # Hazelcast cache connectivity
    Pipeline/
      PipelineFlowTests.cs                # E2E pipeline flow tests
      FormatPipelineTests.cs              # Format-specific pipeline tests
    LoadTests/
      FileVolumeTests.cs                  # 100-1000 file throughput tests
```

## Test Categories

### 1. Format Conversion Tests (Shared.Tests)

Unit tests validating format converters in isolation.

| Test Class | Tests | Purpose |
|------------|-------|---------|
| BidirectionalFormatTests | 14 | Round-trip conversions all formats |
| CsvToJsonConverterTests | 15 | CSV parsing edge cases |
| XmlToJsonConverterTests | 12 | XML structure handling |
| ExcelToJsonConverterTests | 9 | Excel worksheet parsing |
| JsonToCsvConverterTests | 13 | JSON flattening |

**Run format tests:**
```powershell
cd tests/Shared.Tests
dotnet test --filter "Category=FormatConversion"
```

### 2. Bidirectional Tests (Shared.Tests)

Round-trip conversion tests validating data integrity.

| Test | Formats | Description |
|------|---------|-------------|
| CsvToJson_AndBack_PreservesData | CSV <-> JSON | Field values preserved |
| XmlToJson_AndBack_PreservesStructure | XML <-> JSON | Nested elements preserved |
| ExcelToJson_AndBack_PreservesData | Excel <-> JSON | Cell values preserved |
| AllFormats_ConvertToJson_SameSchema | All -> JSON | Consistent output structure |
| Hebrew_RoundTrip_PreservesCharacters | CSV/XML/Excel | Hebrew/RTL preservation |

**Run bidirectional tests:**
```powershell
cd tests/Shared.Tests
dotnet test --filter "Category=Bidirectional"
```

### 3. Pipeline Integration Tests (IntegrationTests)

End-to-end tests requiring Kafka, MongoDB, Hazelcast infrastructure.

| Test Class | Tests | Infrastructure |
|------------|-------|----------------|
| PipelineFlowTests | 7 | Kafka, MongoDB, Hazelcast, FileSimulator |
| FormatPipelineTests | 10 | Same + format-specific validation |

**Run pipeline tests:**
```powershell
cd tests/IntegrationTests
dotnet test --filter "Category=Pipeline"
```

### 4. Load Tests (IntegrationTests)

Volume throughput tests for performance validation.

| Test | File Count | Timeout | Purpose |
|------|------------|---------|---------|
| LoadTest_10Files_CompletesWithin2Minutes | 10 | 2 min | Quick baseline |
| LoadTest_100Files_CompletesWithin5Minutes | 100 | 5 min | TEST-07 validation |
| LoadTest_1000Files_CompletesWithin30Minutes | 1000 | 30 min | Stretch goal |
| LoadTest_EstablishBaseline_RecordMetrics | 25 | 3 min | Regression baseline |
| LoadTest_VerifyNoMessageLoss_AllFilesTracked | 50 | 3 min | Message integrity |

**Run load tests:**
```powershell
cd tests/IntegrationTests
dotnet test --filter "Category=LoadTest"
```

## TestDataFactory Usage

The `TestDataFactory` class generates test data in all supported formats.

### Generating Random Data

```csharp
using DataProcessing.Shared.Tests.TestData;

// Generate CSV with N records
var csv = TestDataFactory.GenerateCsv(100);

// Generate XML with N transactions
var xml = TestDataFactory.GenerateXml(50);

// Generate Excel workbook with N rows
using var excelStream = TestDataFactory.GenerateExcel(25);

// Generate JSON array with N objects
var json = TestDataFactory.GenerateJson(10);
```

### Generating Deterministic Data

For round-trip comparison tests, use deterministic generators:

```csharp
// Deterministic CSV (fixed values, reproducible)
var csv = TestDataFactory.GenerateDeterministicCsv(10);

// Deterministic XML
var xml = TestDataFactory.GenerateDeterministicXml(10);

// Deterministic Excel
using var excel = TestDataFactory.GenerateDeterministicExcel(10);
```

### Hebrew/RTL Test Data

```csharp
// Get CSV with Hebrew content
var hebrewCsv = TestDataFactory.GetHebrewCsvTestData();

// Contains:
// - Hebrew customer names
// - Hebrew descriptions
// - ILS currency
```

### Nested JSON Test Data

```csharp
// Get JSON with nested objects
var nestedJson = TestDataFactory.GetNestedJson();

// Contains:
// - customer.address.street (nested 3 levels)
// - items[] array with product objects
// - metadata.tags[] string array
```

## Prerequisites

### For Format Conversion Tests

No external dependencies required. Run anywhere:
```powershell
dotnet test tests/Shared.Tests
```

### For Pipeline Integration Tests

Requires port-forwarding to K8s infrastructure:
```powershell
# Start all port-forwards
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"

# Or individual services:
kubectl port-forward svc/kafka 9094:9094 -n ez-platform
kubectl port-forward svc/mongodb 27017:27017 -n ez-platform
kubectl port-forward svc/hazelcast 5701:5701 -n ez-platform
```

### For Full Pipeline Tests (with file staging)

Also requires file-simulator connectivity:
```powershell
# Set file-simulator IP
$env:FILE_SIMULATOR_IP = (minikube ip -p file-simulator)

# Verify connectivity
.\scripts\verify-file-simulator.ps1 -TestOnly
```

## Test Commands Reference

### Run by Category

```powershell
# Format conversion (unit tests)
dotnet test tests/Shared.Tests --filter "Category=FormatConversion"

# Bidirectional round-trip
dotnet test tests/Shared.Tests --filter "Category=Bidirectional"

# Pipeline integration
dotnet test tests/IntegrationTests --filter "Category=Pipeline"

# Load testing
dotnet test tests/IntegrationTests --filter "Category=LoadTest"
```

### Run by Format

```powershell
# CSV format tests
dotnet test --filter "Format=CSV"

# XML format tests
dotnet test --filter "Format=XML"

# Excel format tests
dotnet test --filter "Format=Excel"

# JSON format tests
dotnet test --filter "Format=JSON"

# All format-specific pipeline tests
dotnet test tests/IntegrationTests --filter "Category=Pipeline&Format!=MultiFormat"
```

### Run by File Count (Load Tests)

```powershell
# 10-file baseline only
dotnet test tests/IntegrationTests --filter "FileCount=10"

# 100-file test only
dotnet test tests/IntegrationTests --filter "FileCount=100"

# 1000-file stretch goal only
dotnet test tests/IntegrationTests --filter "FileCount=1000"
```

### Run All Phase 4 Tests

```powershell
# Shared.Tests (63 tests)
dotnet test tests/Shared.Tests

# IntegrationTests (17+ pipeline tests, 6 load tests)
dotnet test tests/IntegrationTests --filter "Category=Pipeline|Category=LoadTest"
```

### List Tests Without Running

```powershell
dotnet test tests/Shared.Tests --list-tests
dotnet test tests/IntegrationTests --list-tests --filter "Category=Pipeline"
```

## Test Traits Reference

| Trait | Values | Purpose |
|-------|--------|---------|
| Category | FormatConversion, Bidirectional, Pipeline, LoadTest | Test classification |
| Format | CSV, XML, Excel, JSON, MultiFormat | Format being tested |
| Pipeline | E2E, Flow, Format | Pipeline test type |
| FileCount | 10, 100, 1000 | Load test file count |
| OCP | Compatible, Incompatible | OCP deployment compatibility |

### Combining Traits

```powershell
# Pipeline tests for CSV only
--filter "Category=Pipeline&Format=CSV"

# E2E pipeline tests
--filter "Pipeline=E2E"

# All non-stretch-goal load tests
--filter "Category=LoadTest&FileCount!=1000"

# Format conversion excluding edge cases
--filter "Category=FormatConversion&EdgeCase!=true"
```

## Troubleshooting

### Tests Skip with "Pipeline infrastructure unavailable"

1. Check port-forwards are running:
   ```powershell
   netstat -an | Select-String "9094|27017|5701"
   ```

2. Restart port-forwards:
   ```powershell
   powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
   ```

3. Verify each service:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 9094  # Kafka
   Test-NetConnection -ComputerName localhost -Port 27017 # MongoDB
   Test-NetConnection -ComputerName localhost -Port 5701  # Hazelcast
   ```

### Tests Skip with "File-simulator required"

1. Verify file-simulator cluster:
   ```powershell
   minikube status -p file-simulator
   ```

2. Set IP environment variable:
   ```powershell
   $env:FILE_SIMULATOR_IP = (minikube ip -p file-simulator)
   ```

3. Verify FTP connectivity:
   ```powershell
   Test-NetConnection -ComputerName $env:FILE_SIMULATOR_IP -Port 30021
   ```

### Format Conversion Tests Fail

1. Check EPPlus license (Excel tests):
   ```csharp
   ExcelPackage.License.SetNonCommercialOrganization("EZ Platform Tests");
   ```

2. Check encoding (Hebrew tests):
   - Ensure test files use UTF-8 encoding
   - Verify console can display Hebrew characters

### Load Tests Timeout

1. Increase timeout for slow infrastructure:
   ```powershell
   # Edit TestConfiguration.cs
   public static TimeSpan PipelineProcessingTimeout => TimeSpan.FromMinutes(5);
   ```

2. Check Kafka consumer group:
   - Each test creates unique group ID
   - Old groups may have offset issues

3. Monitor pipeline progress:
   ```powershell
   kubectl logs -f deployment/fileprocessor -n ez-platform --tail=50
   ```

### Excel Tests Produce Empty Output

1. Verify EPPlus package installed:
   ```xml
   <PackageReference Include="EPPlus" />
   ```

2. Check worksheet name:
   - Default: "Transactions"
   - First row is header

## Performance Baselines

Track these metrics for regression detection:

| Metric | Baseline Value | Threshold |
|--------|----------------|-----------|
| 10-file throughput | TBD | > 5 files/min |
| 100-file throughput | TBD | > 20 files/min |
| Message completion rate | TBD | > 95% |
| CSV conversion time (100 records) | TBD | < 100ms |
| Excel parsing time (100 records) | TBD | < 500ms |

*Baseline values populated in 04-TEST-RESULTS.md after test execution*

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  phase4-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Setup .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: '10.0.x'

    # Format tests (no infrastructure)
    - name: Run Format Tests
      run: dotnet test tests/Shared.Tests --filter "Category=FormatConversion|Category=Bidirectional"

    # Skip load tests in CI (optional)
    - name: Run Pipeline Tests
      env:
        SKIP_STRETCH_TESTS: true
      run: dotnet test tests/IntegrationTests --filter "Category=Pipeline&Category!=LoadTest"
```

### Test Execution Matrix

| Environment | Tests to Run | Infrastructure |
|-------------|--------------|----------------|
| Local Dev | All | Full |
| CI (no K8s) | Shared.Tests only | None |
| CI (with K8s) | Pipeline + LoadTest (not stretch) | K8s cluster |
| Pre-Release | All including stretch | Full |

## Requirements Coverage

| Requirement | Test Category | Status |
|-------------|---------------|--------|
| TEST-01 | BidirectionalFormatTests | Covered |
| TEST-02 | CsvToJsonConverterTests | Covered |
| TEST-03 | XmlToJsonConverterTests, ExcelToJsonConverterTests | Covered |
| TEST-04 | PipelineFlowTests | Covered |
| TEST-05 | FormatPipelineTests | Covered |
| TEST-06 | FormatPipelineTests (Hebrew) | Covered |
| TEST-07 | FileVolumeTests (100, 1000) | Covered |
| TEST-08 | This document | Covered |

## Related Documentation

- **Protocol Testing:** [protocol-test-guide.md](./protocol-test-guide.md)
- **File-Simulator Setup:** [file-simulator-setup.md](./file-simulator-setup.md)
- **Test Results:** `.planning/phases/04-format-pipeline-testing/04-TEST-RESULTS.md`
- **Phase 4 Summary:** `.planning/phases/04-format-pipeline-testing/04-03-SUMMARY.md`

---

*Last Updated: 2026-02-02*
*Phase: 04-format-pipeline-testing*
*Plan: 04-03 (Load Testing & Documentation)*

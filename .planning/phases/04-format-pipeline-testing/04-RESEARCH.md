# Phase 4: Format & Pipeline Testing - Research

**Researched:** 2026-02-02
**Domain:** Format Converters, Pipeline Integration Testing, Load Testing, xUnit Patterns
**Confidence:** HIGH

## Summary

This research investigates how to implement comprehensive format conversion testing and pipeline integration tests for the EZ Platform. The goal is to verify all four format converters (CSV, JSON, XML, Excel) work correctly bidirectionally, and that the complete pipeline (FileDiscovery -> FileProcessor -> Validation -> Output) functions as an integrated system.

The EZ Platform already has well-implemented format converters (`CsvToJsonConverter`, `XmlToJsonConverter`, `ExcelToJsonConverter`, `JsonToJsonConverter`) and corresponding reconstructors (`JsonToCsvReconstructor`, `JsonToXmlReconstructor`, `JsonToExcelReconstructor`). Existing unit tests cover basic conversion scenarios, but lack bidirectional round-trip verification and edge case coverage. The pipeline uses Kafka messaging (via MassTransit) and Hazelcast caching to pass data between services.

**Primary recommendation:** Extend existing unit tests with bidirectional round-trip tests (Format -> JSON -> Format), create integration tests that verify the complete pipeline flow with actual Kafka messages and Hazelcast storage, and implement load testing using file-simulator to stage 100-1000 files for throughput validation.

## Standard Stack

The established libraries/tools for this testing domain:

### Core (Testing Framework)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xUnit | 2.9.0+ | Test framework | Already used, supports ICollectionFixture |
| FluentAssertions | 6.12.0+ | Assertion library | Already used, readable comparisons |
| Moq | 4.20.0+ | Mocking | Already used in unit tests |

### Format Conversion Libraries (Already in EZ Platform)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CsvHelper | 31.0.0+ | CSV read/write | Used in CsvToJsonConverter |
| EPPlus | 8.0.0+ | Excel read/write | Used in ExcelToJsonConverter (non-commercial license) |
| System.Text.Json | .NET 10 built-in | JSON serialization | Standard .NET JSON handling |
| System.Xml.Linq | .NET 10 built-in | XML read/write | Used in XmlToJsonConverter |

### Integration Testing Infrastructure (Already Implemented)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Confluent.Kafka | 2.3.0+ | Kafka client | Already used in KafkaFlowTests |
| Hazelcast.Net | 5.3.0+ | Hazelcast client | Already used for caching |
| MongoDB.Driver | 2.28.0+ | MongoDB client | Already used in MongoDbFixture |

### Load Testing
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bogus | 35.0.0+ | Test data generation | Standard for realistic test data |
| BenchmarkDotNet | 0.14.0+ | Performance benchmarking | Optional - for detailed perf analysis |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory round-trip tests | File-based tests | File-based adds I/O overhead; in-memory is faster for unit tests |
| Bogus for load test data | Manual test files | Manual files harder to scale; Bogus generates any volume |
| xUnit parallel | Sequential execution | Parallel is faster but needs isolation; use unique test IDs |

**Installation:**
```bash
# All packages already installed in test projects
# If adding Bogus for load testing:
dotnet add tests/IntegrationTests package Bogus
```

## Architecture Patterns

### Recommended Test Project Structure
```
tests/
├── Shared.Tests/                        # Existing unit tests
│   └── Converters/
│       ├── CsvToJsonConverterTests.cs        # Existing - extend with round-trip
│       ├── XmlToJsonConverterTests.cs        # Existing - extend with round-trip
│       ├── ExcelToJsonConverterTests.cs      # Existing - extend with round-trip
│       └── JsonToOriginalReconstructorTests.cs  # NEW - bidirectional tests
├── IntegrationTests/
│   ├── Fixtures/
│   │   ├── FileSimulatorFixture.cs          # Existing - file-simulator connectivity
│   │   ├── KafkaFixture.cs                  # Existing - Kafka connectivity
│   │   ├── HazelcastFixture.cs              # Existing - Hazelcast connectivity
│   │   └── PipelineFixture.cs               # NEW - full pipeline setup
│   ├── Pipeline/                            # NEW - Pipeline integration tests
│   │   ├── PipelineFlowTests.cs             # Discovery -> Processing -> Validation -> Output
│   │   ├── FormatPipelineTests.cs           # Format-specific pipeline tests
│   │   └── ErrorHandlingPipelineTests.cs    # Invalid records, error recovery
│   ├── LoadTests/                           # NEW - Load testing
│   │   ├── FileVolumeTests.cs               # 100-1000 file throughput
│   │   └── RecordVolumeTests.cs             # Large file processing
│   └── ServiceIntegration/
│       └── KafkaFlowTests.cs                # Existing - Kafka message tests
└── TestData/                                # NEW - Generated test data
    ├── TestDataFactory.cs                   # Test file generation helpers
    └── FormatTestDataGenerator.cs           # Format-specific test data
```

### Pattern 1: Bidirectional Round-Trip Test
**What:** Verify data survives Format -> JSON -> Format conversion without loss
**When to use:** All format converters and reconstructors
**Example:**
```csharp
// Source: Derived from existing converter test patterns
[Theory]
[Trait("Category", "FormatConversion")]
[Trait("Format", "CSV")]
[InlineData("simple-3-columns.csv")]
[InlineData("unicode-hebrew.csv")]
[InlineData("quoted-commas.csv")]
public async Task CsvRoundTrip_PreservesData(string testCaseName)
{
    // Arrange
    var originalCsv = TestDataFactory.GetCsvTestData(testCaseName);
    using var originalStream = new MemoryStream(Encoding.UTF8.GetBytes(originalCsv));

    // Act - Convert to JSON
    var json = await _csvConverter.ConvertToJsonAsync(originalStream);

    // Act - Reconstruct to CSV
    var reconstructedStream = await _csvReconstructor.ReconstructFromJsonAsync(json);
    using var reader = new StreamReader(reconstructedStream);
    var reconstructedCsv = await reader.ReadToEndAsync();

    // Assert - Compare data (not exact string, since formatting may differ)
    var originalRecords = ParseCsv(originalCsv);
    var reconstructedRecords = ParseCsv(reconstructedCsv);

    reconstructedRecords.Should().BeEquivalentTo(originalRecords);
}
```

### Pattern 2: Pipeline Integration Test with Kafka
**What:** Test complete message flow through all services via Kafka
**When to use:** Verifying discovery -> processing -> validation -> output chain
**Example:**
```csharp
// Source: Derived from existing KafkaFlowTests pattern
[Fact]
[Trait("Category", "Pipeline")]
[Trait("Pipeline", "E2E")]
public async Task Pipeline_CsvFile_FlowsThroughAllStages()
{
    SkipIfInfrastructureUnavailable();

    // Arrange - Stage test file in file-simulator
    var testFile = await StageTestFileAsync("pipeline-test.csv", TestDataFactory.GenerateCsv(10));
    var correlationId = Guid.NewGuid().ToString();

    // Subscribe to output topic
    using var outputConsumer = _kafka.CreateConsumer(TestConfiguration.KafkaTopics.RecordOutput);
    outputConsumer.Subscribe(TestConfiguration.KafkaTopics.RecordOutput);

    // Act - Publish FileDiscoveredEvent
    var discoveryEvent = new FileDiscoveredEvent
    {
        CorrelationId = correlationId,
        DataSourceId = _testDataSourceId,
        FileName = testFile.FileName,
        FilePath = testFile.FilePath
    };
    await _kafka.ProduceAsync(TestConfiguration.KafkaTopics.FileDiscovered, correlationId, discoveryEvent);

    // Assert - Wait for output
    var result = await WaitForMessageAsync(outputConsumer, correlationId, TimeSpan.FromMinutes(2));
    result.Should().NotBeNull();
    result.Message.Value.Should().Contain("TXN-"); // Transaction IDs present
}
```

### Pattern 3: Load Test with File-Simulator
**What:** Stage many files via file-simulator and verify processing throughput
**When to use:** Load testing 100-1000 file scenarios
**Example:**
```csharp
// Source: Derived from file-simulator integration patterns
[Fact]
[Trait("Category", "LoadTest")]
[Trait("FileCount", "100")]
public async Task LoadTest_100Files_ProcessesWithinTimeout()
{
    SkipIfFileSimulatorUnavailable();

    // Arrange - Generate and stage 100 test files
    var testFiles = new List<string>();
    for (int i = 0; i < 100; i++)
    {
        var content = TestDataFactory.GenerateCsv(50); // 50 records each
        var fileName = $"load-test-{i:D3}-{Guid.NewGuid():N}.csv";
        await StageFileViaFtpAsync(fileName, content);
        testFiles.Add(fileName);
    }

    // Act - Trigger file discovery
    var startTime = DateTime.UtcNow;
    await TriggerFileDiscoveryAsync(_testDataSourceId);

    // Assert - Wait for all files to be processed
    var processedCount = await WaitForProcessedCountAsync(100, TimeSpan.FromMinutes(5));
    var duration = DateTime.UtcNow - startTime;

    processedCount.Should().Be(100);
    duration.Should().BeLessThan(TimeSpan.FromMinutes(3)); // Target: 3 minutes for 100 files

    // Cleanup
    foreach (var file in testFiles)
    {
        await CleanupTestFileAsync(file);
    }
}
```

### Anti-Patterns to Avoid
- **Testing exact string output:** Format reconstruction may produce semantically equivalent but differently formatted output (e.g., different whitespace)
- **Shared test files:** Use unique file names per test (include GUID) to prevent interference
- **Hard-coded timeouts:** Use configurable timeouts from TestConfiguration
- **Ignoring encoding:** Always specify UTF-8 encoding explicitly; Hebrew content requires proper handling
- **Skipping edge cases:** Test empty files, single records, unicode characters, quoted delimiters

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test data generation | Manual CSV/XML strings | TestDataFactory + Bogus | Scales to any volume, realistic data |
| Kafka message waiting | Polling loops | ConsumeByKeyAsync helper | Already implemented in KafkaFlowTests |
| JSON comparison | String equality | FluentAssertions.BeEquivalentTo | Handles property order, whitespace |
| Excel file creation | OpenXML raw API | EPPlus ExcelPackage | Type handling, formatting built-in |
| File staging | kubectl cp | FtpConnector/S3Connector | Uses same connectors as production |

**Key insight:** The EZ Platform already has format converters, reconstructors, Kafka fixtures, and file-simulator connectivity. Tests should use these existing components rather than building parallel implementations.

## Common Pitfalls

### Pitfall 1: Excel License Mode in Tests
**What goes wrong:** EPPlus throws license exception in test environment
**Why it happens:** EPPlus 8+ requires license declaration; different test runners may fail
**How to avoid:**
1. Call `ExcelPackage.License.SetNonCommercialOrganization("EZ Platform Tests")` in test fixture
2. Already done in ExcelToJsonConverterTests - ensure consistent across new tests
**Warning signs:** "License exception" in Excel converter tests

### Pitfall 2: Type Coercion in Round-Trip Tests
**What goes wrong:** Numbers become strings after round-trip, causing comparison failures
**Why it happens:** CSV stores everything as strings; JSON parses numbers; reconstruction may stringify
**How to avoid:**
1. Compare semantic values, not string representations
2. Use `BeEquivalentTo` with type coercion options
3. Document expected type handling in test cases
**Warning signs:** `"100" != 100` assertion failures

### Pitfall 3: Kafka Consumer Group Conflicts in Pipeline Tests
**What goes wrong:** Pipeline tests miss messages or get duplicates
**Why it happens:** Multiple tests sharing consumer group commit offsets
**How to avoid:**
1. Use unique consumer group per test (already done in KafkaFixture)
2. Reset consumer position to beginning for each test
3. Use unique correlation IDs to filter messages
**Warning signs:** Flaky tests, "message not received" timeouts

### Pitfall 4: File-Simulator Sync Timing for Load Tests
**What goes wrong:** Staged test files not visible immediately
**Why it happens:** FTP/SFTP write and NFS mount sync have latency
**How to avoid:**
1. Wait for file visibility after staging (poll file exists)
2. For NFS, restart NAS pod after staging many files
3. Use FTP/S3 for faster staging (no NFS sync needed)
**Warning signs:** "File not found" errors immediately after staging

### Pitfall 5: XML Namespace Handling
**What goes wrong:** XML with namespaces fails conversion or reconstruction
**Why it happens:** XmlToJsonConverter strips namespaces; reconstruction doesn't restore them
**How to avoid:**
1. Test with and without namespaces
2. Document namespace handling behavior
3. Metadata contains `HasNamespace` flag - verify it's preserved
**Warning signs:** Round-trip tests fail only for namespaced XML

### Pitfall 6: Hebrew/Unicode in CSV
**What goes wrong:** Hebrew text corrupted after round-trip
**Why it happens:** Encoding mismatch; CsvHelper defaults may vary
**How to avoid:**
1. Explicitly specify UTF-8 encoding in all stream operations
2. Test Hebrew content specifically (already present in test-data)
3. Use `Encoding.UTF8` in MemoryStream creation
**Warning signs:** Hebrew characters become ??? or garbled

## Code Examples

Verified patterns from existing EZ Platform code and test patterns:

### TestDataFactory for Format Testing
```csharp
// Source: Derived from existing test patterns
// File: tests/IntegrationTests/TestData/TestDataFactory.cs

public static class TestDataFactory
{
    private static readonly Faker _faker = new();

    /// <summary>
    /// Generates CSV content with transaction data matching E2E-001 schema
    /// </summary>
    public static string GenerateCsv(int recordCount)
    {
        var sb = new StringBuilder();
        sb.AppendLine("TransactionId,CustomerId,CustomerName,TransactionDate,Amount,Currency,TransactionType,Status,Description");

        for (int i = 0; i < recordCount; i++)
        {
            var txnId = $"TXN-{DateTime.UtcNow:yyyyMMdd}-{i:D6}";
            var custId = $"CUST-{_faker.Random.Int(1000, 9999)}";
            var name = _faker.Name.FullName();
            var date = _faker.Date.Recent(30).ToString("yyyy-MM-dd HH:mm:ss");
            var amount = _faker.Finance.Amount(10, 10000).ToString("F2", CultureInfo.InvariantCulture);
            var currency = _faker.PickRandom(new[] { "USD", "EUR", "GBP", "ILS" });
            var type = _faker.PickRandom(new[] { "Purchase", "Refund", "Deposit", "Withdrawal" });
            var status = _faker.PickRandom(new[] { "Completed", "Pending", "Processing" });
            var desc = _faker.Lorem.Sentence().Replace(",", ";"); // Escape commas

            sb.AppendLine($"{txnId},{custId},{name},{date},{amount},{currency},{type},{status},\"{desc}\"");
        }

        return sb.ToString();
    }

    /// <summary>
    /// Generates XML content with transaction data
    /// </summary>
    public static string GenerateXml(int recordCount)
    {
        var xDoc = new XDocument(
            new XDeclaration("1.0", "UTF-8", null),
            new XElement("Transactions",
                Enumerable.Range(0, recordCount).Select(i =>
                    new XElement("Transaction",
                        new XElement("TransactionId", $"TXN-{DateTime.UtcNow:yyyyMMdd}-{i:D6}"),
                        new XElement("CustomerId", $"CUST-{_faker.Random.Int(1000, 9999)}"),
                        new XElement("Amount", _faker.Finance.Amount(10, 10000).ToString("F2", CultureInfo.InvariantCulture)),
                        new XElement("Currency", _faker.PickRandom(new[] { "USD", "EUR", "GBP", "ILS" })),
                        new XElement("Status", _faker.PickRandom(new[] { "Completed", "Pending", "Processing" }))
                    )
                )
            )
        );

        return xDoc.ToString();
    }

    /// <summary>
    /// Creates Excel stream with transaction data
    /// </summary>
    public static MemoryStream GenerateExcel(int recordCount)
    {
        var stream = new MemoryStream();
        using (var package = new ExcelPackage())
        {
            var worksheet = package.Workbook.Worksheets.Add("Transactions");

            // Headers
            worksheet.Cells[1, 1].Value = "TransactionId";
            worksheet.Cells[1, 2].Value = "CustomerId";
            worksheet.Cells[1, 3].Value = "Amount";
            worksheet.Cells[1, 4].Value = "Currency";
            worksheet.Cells[1, 5].Value = "Status";

            // Data
            for (int i = 0; i < recordCount; i++)
            {
                var row = i + 2;
                worksheet.Cells[row, 1].Value = $"TXN-{DateTime.UtcNow:yyyyMMdd}-{i:D6}";
                worksheet.Cells[row, 2].Value = $"CUST-{_faker.Random.Int(1000, 9999)}";
                worksheet.Cells[row, 3].Value = _faker.Finance.Amount(10, 10000);
                worksheet.Cells[row, 4].Value = _faker.PickRandom(new[] { "USD", "EUR", "GBP", "ILS" });
                worksheet.Cells[row, 5].Value = _faker.PickRandom(new[] { "Completed", "Pending" });
            }

            package.SaveAs(stream);
        }
        stream.Position = 0;
        return stream;
    }
}
```

### PipelineFixture for Integration Tests
```csharp
// Source: Derived from existing fixture patterns
// File: tests/IntegrationTests/Fixtures/PipelineFixture.cs

public class PipelineFixture : IAsyncLifetime
{
    private readonly KafkaFixture _kafka;
    private readonly FileSimulatorFixture _fileSimulator;
    private readonly MongoDbFixture _mongodb;

    public string TestDataSourceId { get; private set; } = string.Empty;
    public bool IsAvailable { get; private set; }

    public PipelineFixture(
        KafkaFixture kafka,
        FileSimulatorFixture fileSimulator,
        MongoDbFixture mongodb)
    {
        _kafka = kafka;
        _fileSimulator = fileSimulator;
        _mongodb = mongodb;
    }

    public async Task InitializeAsync()
    {
        // Check all dependencies
        var kafkaOk = await _kafka.IsKafkaAvailableAsync();
        var fsOk = _fileSimulator.IsAvailable;
        var mongoOk = await _mongodb.IsAvailableAsync();

        IsAvailable = kafkaOk && fsOk && mongoOk;

        if (IsAvailable)
        {
            // Create test data source for pipeline tests
            TestDataSourceId = await CreateTestDataSourceAsync();
        }

        Console.WriteLine($"PipelineFixture: Kafka={kafkaOk}, FileSimulator={fsOk}, MongoDB={mongoOk}");
    }

    public Task DisposeAsync()
    {
        // Cleanup test data source
        return Task.CompletedTask;
    }

    private async Task<string> CreateTestDataSourceAsync()
    {
        // Create minimal data source for testing
        // ... implementation using MongoDB API
        return "test-ds-pipeline-" + Guid.NewGuid().ToString("N")[..8];
    }
}
```

### Bidirectional Format Test Class
```csharp
// Source: Derived from existing converter tests
// File: tests/Shared.Tests/Converters/BidirectionalFormatTests.cs

public class BidirectionalFormatTests
{
    private readonly CsvToJsonConverter _csvConverter;
    private readonly JsonToCsvReconstructor _csvReconstructor;
    private readonly XmlToJsonConverter _xmlConverter;
    private readonly JsonToXmlReconstructor _xmlReconstructor;
    private readonly ExcelToJsonConverter _excelConverter;
    private readonly JsonToExcelReconstructor _excelReconstructor;

    public BidirectionalFormatTests()
    {
        // Setup with mock loggers (same pattern as existing tests)
        _csvConverter = new CsvToJsonConverter(Mock.Of<ILogger<CsvToJsonConverter>>());
        _csvReconstructor = new JsonToCsvReconstructor(Mock.Of<ILogger<JsonToCsvReconstructor>>());
        _xmlConverter = new XmlToJsonConverter(Mock.Of<ILogger<XmlToJsonConverter>>());
        _xmlReconstructor = new JsonToXmlReconstructor(Mock.Of<ILogger<JsonToXmlReconstructor>>());

        ExcelPackage.License.SetNonCommercialOrganization("EZ Platform Tests");
        _excelConverter = new ExcelToJsonConverter(Mock.Of<ILogger<ExcelToJsonConverter>>());
        _excelReconstructor = new JsonToExcelReconstructor(Mock.Of<ILogger<JsonToExcelReconstructor>>());
    }

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    public async Task Csv_RoundTrip_PreservesTransactionData()
    {
        // Arrange
        var original = TestDataFactory.GenerateCsv(10);
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(original));

        // Act
        var json = await _csvConverter.ConvertToJsonAsync(stream);
        var reconstructed = await _csvReconstructor.ReconstructFromJsonAsync(json);
        using var reader = new StreamReader(reconstructed);
        var result = await reader.ReadToEndAsync();

        // Assert - Parse both and compare records
        var originalRecords = CsvHelper.ParseRecords(original);
        var resultRecords = CsvHelper.ParseRecords(result);

        resultRecords.Should().HaveCount(originalRecords.Count);
        resultRecords.Should().BeEquivalentTo(originalRecords);
    }

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    public async Task Xml_RoundTrip_PreservesTransactionData()
    {
        // Arrange
        var original = TestDataFactory.GenerateXml(10);
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(original));

        // Act
        var json = await _xmlConverter.ConvertToJsonAsync(stream);
        var reconstructed = await _xmlReconstructor.ReconstructFromJsonAsync(json);
        using var reader = new StreamReader(reconstructed);
        var result = await reader.ReadToEndAsync();

        // Assert - Parse both XML and compare element content
        var originalDoc = XDocument.Parse(original);
        var resultDoc = XDocument.Parse(result);

        // Compare transaction count
        originalDoc.Descendants("Transaction").Count()
            .Should().Be(resultDoc.Descendants("Transaction").Count());
    }

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    public async Task Excel_RoundTrip_PreservesTransactionData()
    {
        // Arrange
        using var original = TestDataFactory.GenerateExcel(10);

        // Act
        var json = await _excelConverter.ConvertToJsonAsync(original);
        original.Position = 0; // Reset for metadata
        var metadata = await _excelConverter.ExtractMetadataAsync(original);
        var reconstructed = await _excelReconstructor.ReconstructFromJsonAsync(json, metadata);

        // Assert - Parse both Excel files and compare
        original.Position = 0;
        using var originalPkg = new ExcelPackage(original);
        using var resultPkg = new ExcelPackage(reconstructed);

        var originalRows = originalPkg.Workbook.Worksheets[0].Dimension?.Rows ?? 0;
        var resultRows = resultPkg.Workbook.Worksheets[0].Dimension?.Rows ?? 0;

        resultRows.Should().Be(originalRows);
    }
}
```

## Pipeline Flow Diagram

```
+------------------+     FileDiscoveredEvent      +------------------+
|                  |----------------------------->|                  |
| FileDiscovery    |                              | FileProcessor    |
| Service          |                              | Service          |
+------------------+                              +--------+---------+
                                                          |
                                                          | 1. Read file via ConnectorFactory
                                                          | 2. Detect format (CSV/XML/Excel/JSON)
                                                          | 3. Convert to JSON via IFormatConverter
                                                          | 4. Store JSON in Hazelcast
                                                          |
                                                          v
                                                  +------------------+
                                                  | Hazelcast        |
                                                  | file-content map |
                                                  +--------+---------+
                                                          |
                                                  ValidationRequestEvent
                                                          |
                                                          v
                                                  +------------------+
                                                  | Validation       |
                                                  | Service          |
                                                  +--------+---------+
                                                          |
                                    +---------------------+---------------------+
                                    |                                           |
                            Valid Records                              Invalid Records
                                    |                                           |
                                    v                                           v
                            +------------------+                        +------------------+
                            | Output           |                        | InvalidRecords   |
                            | Service          |                        | Service          |
                            +--------+---------+                        +------------------+
                                    |
                                    | 1. Fetch JSON from Hazelcast
                                    | 2. Reconstruct via IFormatReconstructor
                                    | 3. Write to destination (Folder/Kafka)
                                    |
                                    v
                            +------------------+
                            | Output           |
                            | Destinations     |
                            +------------------+
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unit tests only | Bidirectional round-trip | Phase 4 | Catches type coercion issues |
| Mock Kafka messages | Real Kafka integration | KafkaFlowTests (existing) | Full protocol fidelity |
| Manual test files | Generated via Bogus/Factory | Phase 4 | Scales to 1000+ files |
| Single format testing | All 4 formats in parallel | Phase 4 | Complete coverage |

**Deprecated/outdated:**
- **String equality for format comparison:** Use semantic comparison (parse and compare records)
- **Static test data files only:** Supplement with generated data for volume testing
- **Isolated converter tests:** Add pipeline integration tests

## Open Questions

Things that couldn't be fully resolved:

1. **Multi-Sheet Excel Workbooks**
   - What we know: ExcelToJsonConverter reads first worksheet only (line 31)
   - What's unclear: Is multi-sheet support required? Should other sheets be ignored or merged?
   - Recommendation: Document current behavior; defer multi-sheet to future enhancement if needed

2. **JSON Nested Structure Round-Trip**
   - What we know: Converters handle flat records well; nested structures may not round-trip
   - What's unclear: Should nested JSON survive conversion to flat formats (CSV)?
   - Recommendation: Test and document behavior; nested structures should remain JSON output format

3. **Load Test Baseline Performance**
   - What we know: Target is 100-1000 files; no current baseline
   - What's unclear: What's acceptable throughput? Files/minute target?
   - Recommendation: Establish baseline in first load test run; document for regression tracking

4. **Format Detection Ambiguity**
   - What we know: Format detected by file extension in FileDiscoveredEventConsumer
   - What's unclear: What happens if extension is wrong? (e.g., .csv containing XML)
   - Recommendation: Add content sniffing as fallback; document extension precedence

## Sources

### Primary (HIGH confidence)
- **EZ Platform Converters** (`src/Services/Shared/Converters/*.cs`) - All 4 converters and 3 reconstructors
- **EZ Platform Converter Tests** (`tests/Shared.Tests/Converters/*.cs`) - Existing test patterns
- **EZ Platform Integration Tests** (`tests/IntegrationTests/`) - KafkaFlowTests, fixtures
- **FileProcessor Consumer** (`src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs`) - Pipeline flow
- **Phase 3 Research** (`.planning/phases/03-protocol-test-coverage/03-RESEARCH.md`) - FileSimulatorFixture patterns

### Secondary (MEDIUM confidence)
- **Test data files** (`test-data/E2E-001/*.csv`, `test-data/E2E-003/*.xml`) - Existing test data formats
- **TestConfiguration** (`tests/IntegrationTests/TestConfiguration.cs`) - Kafka topics, timeouts

### Tertiary (LOW confidence)
- Web search for "xUnit bidirectional testing patterns" - General patterns only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in EZ Platform
- Architecture: HIGH - Based on existing test patterns and converter implementations
- Pitfalls: HIGH - Derived from existing code review and Phase 3 learnings

**Research date:** 2026-02-02
**Valid until:** 60 days (testing patterns stable; library versions may update)

---

## Requirements Mapping

| Requirement | Test Coverage | Confidence |
|-------------|--------------|------------|
| TEST-01: Critical pipeline paths | PipelineFlowTests covering discovery -> output | HIGH |
| TEST-03: CSV bidirectional | CsvToJsonConverter + JsonToCsvReconstructor round-trip | HIGH |
| TEST-03: JSON bidirectional | JsonToJsonConverter (passthrough) verification | HIGH |
| TEST-03: XML bidirectional | XmlToJsonConverter + JsonToXmlReconstructor round-trip | HIGH |
| TEST-03: Excel bidirectional | ExcelToJsonConverter + JsonToExcelReconstructor round-trip | HIGH |
| TEST-07: 100-file load test | FileVolumeTests with file-simulator staging | HIGH |
| TEST-07: 1000-file load test | FileVolumeTests scaled (optional stretch goal) | MEDIUM |
| TEST-08: Test documentation | RESEARCH.md + test documentation in .planning/ | HIGH |

## Recommended Plan Breakdown

Based on the research, Phase 4 should be divided into **3 plans**:

### Plan 04-01: Format Conversion Tests
**Scope:** Bidirectional round-trip tests for all 4 formats
**Tasks:**
1. Create TestDataFactory with CSV, XML, JSON, Excel generators
2. Add BidirectionalFormatTests with round-trip tests for each format
3. Extend existing converter tests with edge cases (unicode, empty, large)
4. Test metadata preservation through conversion cycle
5. Document format handling behaviors

**Estimated complexity:** Medium (extends existing tests)

### Plan 04-02: Pipeline Integration Tests
**Scope:** End-to-end pipeline tests through Kafka/Hazelcast
**Tasks:**
1. Create PipelineFixture for coordinated infrastructure
2. Create PipelineFlowTests covering full discovery -> output flow
3. Test each format through the complete pipeline
4. Test error handling and invalid record routing
5. Verify Hazelcast caching behavior

**Estimated complexity:** High (requires running infrastructure)

### Plan 04-03: Load Testing and Documentation
**Scope:** 100-1000 file throughput tests and documentation
**Tasks:**
1. Create FileVolumeTests with file-simulator staging
2. Implement 100-file load test with timing assertions
3. Document baseline performance metrics
4. Generate test documentation for .planning/
5. Create test execution guide

**Estimated complexity:** Medium (builds on previous plans)

## Test Categories and Traits

```csharp
// Recommended test traits for filtering
[Trait("Category", "FormatConversion")]   // All format converter tests
[Trait("Category", "BidirectionalFormat")] // Round-trip tests
[Trait("Category", "Pipeline")]           // Pipeline integration tests
[Trait("Category", "LoadTest")]           // Load/volume tests
[Trait("Format", "CSV")]                  // Format-specific
[Trait("Format", "XML")]
[Trait("Format", "Excel")]
[Trait("Format", "JSON")]
[Trait("Pipeline", "E2E")]                // Full pipeline tests
[Trait("FileCount", "100")]               // Load test file counts
[Trait("FileCount", "1000")]
```

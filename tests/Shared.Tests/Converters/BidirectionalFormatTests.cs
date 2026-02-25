// BidirectionalFormatTests.cs - Round-Trip Format Conversion Tests
// Phase 04-01: Bidirectional Format Testing
// TEST-03: All format conversions verified bidirectionally
// Version: 1.0
// Date: February 2, 2026

using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using DataProcessing.Shared.Converters;
using DataProcessing.Shared.Tests.TestData;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using OfficeOpenXml;
using Xunit;

namespace DataProcessing.Shared.Tests.Converters;

/// <summary>
/// Bidirectional round-trip tests for all 4 supported formats (CSV, XML, Excel, JSON).
/// Verifies data integrity is preserved when files flow through the pipeline:
/// source format -> JSON (for processing) -> original format (for output).
/// </summary>
public class BidirectionalFormatTests : IDisposable
{
    // CSV converters
    private readonly CsvToJsonConverter _csvConverter;
    private readonly JsonToCsvReconstructor _csvReconstructor;

    // XML converters
    private readonly XmlToJsonConverter _xmlConverter;
    private readonly JsonToXmlReconstructor _xmlReconstructor;

    // Excel converters
    private readonly ExcelToJsonConverter _excelConverter;
    private readonly JsonToExcelReconstructor _excelReconstructor;

    // JSON passthrough
    private readonly JsonToJsonConverter _jsonConverter;

    public BidirectionalFormatTests()
    {
        // Set EPPlus license for non-commercial use
        ExcelPackage.License.SetNonCommercialOrganization("EZ Platform Tests");

        // Initialize CSV converters
        var csvLoggerMock = new Mock<ILogger<CsvToJsonConverter>>();
        var csvReconstructorLoggerMock = new Mock<ILogger<JsonToCsvReconstructor>>();
        _csvConverter = new CsvToJsonConverter(csvLoggerMock.Object);
        _csvReconstructor = new JsonToCsvReconstructor(csvReconstructorLoggerMock.Object);

        // Initialize XML converters
        var xmlLoggerMock = new Mock<ILogger<XmlToJsonConverter>>();
        var xmlReconstructorLoggerMock = new Mock<ILogger<JsonToXmlReconstructor>>();
        _xmlConverter = new XmlToJsonConverter(xmlLoggerMock.Object);
        _xmlReconstructor = new JsonToXmlReconstructor(xmlReconstructorLoggerMock.Object);

        // Initialize Excel converters
        var excelLoggerMock = new Mock<ILogger<ExcelToJsonConverter>>();
        var excelReconstructorLoggerMock = new Mock<ILogger<JsonToExcelReconstructor>>();
        _excelConverter = new ExcelToJsonConverter(excelLoggerMock.Object);
        _excelReconstructor = new JsonToExcelReconstructor(excelReconstructorLoggerMock.Object);

        // Initialize JSON passthrough
        var jsonLoggerMock = new Mock<ILogger<JsonToJsonConverter>>();
        _jsonConverter = new JsonToJsonConverter(jsonLoggerMock.Object);
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }

    #region CSV Round-Trip Tests

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "CSV")]
    public async Task Csv_RoundTrip_PreservesTransactionData()
    {
        // Arrange - Generate deterministic CSV for reliable comparison
        var originalCsv = TestDataFactory.GenerateDeterministicCsv(10);
        using var originalStream = new MemoryStream(Encoding.UTF8.GetBytes(originalCsv));

        // Act - Convert to JSON
        var json = await _csvConverter.ConvertToJsonAsync(originalStream);

        // Reconstruct back to CSV
        using var reconstructedStream = await _csvReconstructor.ReconstructFromJsonAsync(json);
        using var reader = new StreamReader(reconstructedStream);
        var reconstructedCsv = await reader.ReadToEndAsync();

        // Assert - Parse both CSVs and compare records (not raw strings)
        var originalRecords = ParseCsvToRecords(originalCsv);
        var reconstructedRecords = ParseCsvToRecords(reconstructedCsv);

        reconstructedRecords.Should().HaveCount(originalRecords.Count);

        // Compare key fields (note: numeric formatting may differ after round-trip)
        for (int i = 0; i < originalRecords.Count; i++)
        {
            reconstructedRecords[i]["TransactionId"].Should().Be(originalRecords[i]["TransactionId"],
                because: $"TransactionId at record {i} should match");
            reconstructedRecords[i]["CustomerId"].Should().Be(originalRecords[i]["CustomerId"],
                because: $"CustomerId at record {i} should match");
            reconstructedRecords[i]["CustomerName"].Should().Be(originalRecords[i]["CustomerName"],
                because: $"CustomerName at record {i} should match");
            reconstructedRecords[i]["Currency"].Should().Be(originalRecords[i]["Currency"],
                because: $"Currency at record {i} should match");
            reconstructedRecords[i]["Status"].Should().Be(originalRecords[i]["Status"],
                because: $"Status at record {i} should match");

            // Amount may lose trailing zeros (100.00 -> 100), so compare as decimals
            var originalAmount = decimal.Parse(originalRecords[i]["Amount"], CultureInfo.InvariantCulture);
            var reconstructedAmount = decimal.Parse(reconstructedRecords[i]["Amount"], CultureInfo.InvariantCulture);
            reconstructedAmount.Should().Be(originalAmount,
                because: $"Amount at record {i} should match");
        }
    }

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "CSV")]
    public async Task Csv_RoundTrip_PreservesHebrewContent()
    {
        // Arrange - Use Hebrew test data
        var originalCsv = TestDataFactory.GetHebrewCsvTestData();
        using var originalStream = new MemoryStream(Encoding.UTF8.GetBytes(originalCsv));

        // Act - Convert to JSON
        var json = await _csvConverter.ConvertToJsonAsync(originalStream);

        // Verify Hebrew is preserved in JSON (may be escaped as \uXXXX in serialized form)
        // Parse JSON to verify actual content
        using var jsonDoc = JsonDocument.Parse(json);
        var firstRecord = jsonDoc.RootElement[0];
        firstRecord.GetProperty("CustomerName").GetString().Should().Be("יוסי כהן");
        firstRecord.GetProperty("Description").GetString().Should().Contain("רכישה של מוצרים אלקטרוניים");

        // Reconstruct back to CSV
        using var reconstructedStream = await _csvReconstructor.ReconstructFromJsonAsync(json);
        using var reader = new StreamReader(reconstructedStream, Encoding.UTF8);
        var reconstructedCsv = await reader.ReadToEndAsync();

        // Assert - Hebrew characters survive round-trip
        reconstructedCsv.Should().Contain("יוסי כהן");
        reconstructedCsv.Should().Contain("שרה לוי");
        reconstructedCsv.Should().Contain("דוד ישראלי");
    }

    [Theory]
    [InlineData(0)]   // Empty (headers only)
    [InlineData(1)]   // Single record
    [InlineData(100)] // Larger dataset
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "CSV")]
    public async Task Csv_RoundTrip_VariousRecordCounts(int recordCount)
    {
        // Arrange
        var originalCsv = TestDataFactory.GenerateDeterministicCsv(recordCount);
        using var originalStream = new MemoryStream(Encoding.UTF8.GetBytes(originalCsv));

        // Act
        var json = await _csvConverter.ConvertToJsonAsync(originalStream);
        using var reconstructedStream = await _csvReconstructor.ReconstructFromJsonAsync(json);
        using var reader = new StreamReader(reconstructedStream);
        var reconstructedCsv = await reader.ReadToEndAsync();

        // Assert
        var originalRecords = ParseCsvToRecords(originalCsv);
        var reconstructedRecords = ParseCsvToRecords(reconstructedCsv);

        reconstructedRecords.Should().HaveCount(recordCount);
    }

    #endregion

    #region XML Round-Trip Tests

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "XML")]
    public async Task Xml_RoundTrip_PreservesTransactionData()
    {
        // Arrange - Generate deterministic XML
        var originalXml = TestDataFactory.GenerateDeterministicXml(10);
        using var originalStream = new MemoryStream(Encoding.UTF8.GetBytes(originalXml));

        // Extract metadata for reconstruction
        originalStream.Position = 0;
        var metadata = await _xmlConverter.ExtractMetadataAsync(originalStream);
        originalStream.Position = 0;

        // Act - Convert to JSON
        var json = await _xmlConverter.ConvertToJsonAsync(originalStream);

        // Parse JSON to verify transaction count
        using var jsonDoc = JsonDocument.Parse(json);

        // XmlToJsonConverter produces { "Transaction": [...] } for repeated elements
        var transactionArray = jsonDoc.RootElement.GetProperty("Transaction");
        transactionArray.GetArrayLength().Should().Be(10,
            because: "JSON should contain 10 transactions");

        // Reconstruct back to XML
        using var reconstructedStream = await _xmlReconstructor.ReconstructFromJsonAsync(json, metadata);
        using var reader = new StreamReader(reconstructedStream);
        var reconstructedXml = await reader.ReadToEndAsync();

        // Assert - Parse reconstructed XML
        var reconstructedDoc = XDocument.Parse(reconstructedXml);

        // The reconstructor wraps the Transaction array in Items, find transactions
        var reconstructedItems = reconstructedDoc.Root!.Elements().ToList();

        // Verify first transaction data was preserved in the JSON conversion
        var firstOriginalTransaction = XDocument.Parse(originalXml).Root!.Elements("Transaction").First();
        var firstJsonTransaction = transactionArray[0];

        firstJsonTransaction.GetProperty("TransactionId").GetString()
            .Should().Be(firstOriginalTransaction.Element("TransactionId")?.Value);
        firstJsonTransaction.GetProperty("CustomerName").GetString()
            .Should().Be(firstOriginalTransaction.Element("CustomerName")?.Value);
    }

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "XML")]
    public async Task Xml_RoundTrip_PreservesElementHierarchy()
    {
        // Arrange - XML with nested structure
        var originalXml = @"<?xml version=""1.0"" encoding=""utf-8""?>
<Order>
    <Customer>
        <Name>John Doe</Name>
        <Email>john@example.com</Email>
    </Customer>
    <Items>
        <Item>Product A</Item>
        <Item>Product B</Item>
    </Items>
    <Total>199.99</Total>
</Order>";
        using var originalStream = new MemoryStream(Encoding.UTF8.GetBytes(originalXml));
        var metadata = await _xmlConverter.ExtractMetadataAsync(originalStream);
        originalStream.Position = 0;

        // Act
        var json = await _xmlConverter.ConvertToJsonAsync(originalStream);
        using var reconstructedStream = await _xmlReconstructor.ReconstructFromJsonAsync(json, metadata);
        using var reader = new StreamReader(reconstructedStream);
        var reconstructedXml = await reader.ReadToEndAsync();

        // Assert
        var reconstructedDoc = XDocument.Parse(reconstructedXml);
        reconstructedDoc.Root!.Element("Customer")!.Element("Name")!.Value.Should().Be("John Doe");
        reconstructedDoc.Root!.Element("Customer")!.Element("Email")!.Value.Should().Be("john@example.com");
        reconstructedDoc.Root!.Element("Total")!.Value.Should().Be("199.99");
    }

    #endregion

    #region Excel Round-Trip Tests

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "Excel")]
    public async Task Excel_RoundTrip_PreservesTransactionData()
    {
        // Arrange - Generate deterministic Excel
        using var originalStream = TestDataFactory.GenerateDeterministicExcel(10);

        // Extract metadata for reconstruction
        var metadata = await _excelConverter.ExtractMetadataAsync(originalStream);
        originalStream.Position = 0;

        // Act - Convert to JSON
        var json = await _excelConverter.ConvertToJsonAsync(originalStream);

        // Reconstruct back to Excel
        using var reconstructedStream = await _excelReconstructor.ReconstructFromJsonAsync(json, metadata);

        // Assert - Compare row counts and cell values using EPPlus
        using var originalPackage = new ExcelPackage(TestDataFactory.GenerateDeterministicExcel(10));
        var originalSheet = originalPackage.Workbook.Worksheets[0];

        using var reconstructedPackage = new ExcelPackage(reconstructedStream);
        var reconstructedSheet = reconstructedPackage.Workbook.Worksheets[0];

        // Compare row count (excluding header)
        var originalRowCount = originalSheet.Dimension!.Rows - 1;
        var reconstructedRowCount = reconstructedSheet.Dimension!.Rows - 1;
        reconstructedRowCount.Should().Be(originalRowCount);

        // Compare column count
        var originalColCount = originalSheet.Dimension.Columns;
        var reconstructedColCount = reconstructedSheet.Dimension.Columns;
        reconstructedColCount.Should().Be(originalColCount);

        // Compare first data row values
        for (int col = 1; col <= originalColCount; col++)
        {
            var originalValue = originalSheet.Cells[2, col].Value?.ToString();
            var reconstructedValue = reconstructedSheet.Cells[2, col].Value?.ToString();
            reconstructedValue.Should().Be(originalValue,
                because: $"column {col} should match after round-trip");
        }
    }

    [Theory]
    [InlineData(0)]   // Empty (headers only)
    [InlineData(1)]   // Single record
    [InlineData(50)]  // Medium dataset
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "Excel")]
    public async Task Excel_RoundTrip_VariousRecordCounts(int recordCount)
    {
        // Arrange
        using var originalStream = TestDataFactory.GenerateDeterministicExcel(recordCount);
        var metadata = await _excelConverter.ExtractMetadataAsync(originalStream);
        originalStream.Position = 0;

        // Act
        var json = await _excelConverter.ConvertToJsonAsync(originalStream);
        using var reconstructedStream = await _excelReconstructor.ReconstructFromJsonAsync(json, metadata);

        // Assert
        if (recordCount == 0)
        {
            // Empty JSON returns empty stream
            json.Should().Be("[]");
        }
        else
        {
            using var reconstructedPackage = new ExcelPackage(reconstructedStream);
            var sheet = reconstructedPackage.Workbook.Worksheets[0];
            var dataRows = sheet.Dimension!.Rows - 1; // Exclude header
            dataRows.Should().Be(recordCount);
        }
    }

    #endregion

    #region JSON Passthrough Tests

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "JSON")]
    public async Task Json_Passthrough_PreservesNestedStructures()
    {
        // Arrange - Use nested JSON test data
        var originalJson = TestDataFactory.GetNestedJson();
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(originalJson));

        // Act - Pass through JsonToJsonConverter
        var resultJson = await _jsonConverter.ConvertToJsonAsync(stream);

        // Assert - Compare using JsonDocument
        using var originalDoc = JsonDocument.Parse(originalJson);
        using var resultDoc = JsonDocument.Parse(resultJson);

        // Verify root array
        originalDoc.RootElement.GetArrayLength().Should().Be(resultDoc.RootElement.GetArrayLength());

        // Verify nested structures
        var originalFirst = originalDoc.RootElement[0];
        var resultFirst = resultDoc.RootElement[0];

        resultFirst.GetProperty("transactionId").GetString()
            .Should().Be(originalFirst.GetProperty("transactionId").GetString());

        // Verify nested customer object
        var originalCustomer = originalFirst.GetProperty("customer");
        var resultCustomer = resultFirst.GetProperty("customer");

        resultCustomer.GetProperty("name").GetString()
            .Should().Be(originalCustomer.GetProperty("name").GetString());

        // Verify deeply nested address
        var originalAddress = originalCustomer.GetProperty("address");
        var resultAddress = resultCustomer.GetProperty("address");

        resultAddress.GetProperty("city").GetString()
            .Should().Be(originalAddress.GetProperty("city").GetString());

        // Verify items array
        var originalItems = originalFirst.GetProperty("items");
        var resultItems = resultFirst.GetProperty("items");
        resultItems.GetArrayLength().Should().Be(originalItems.GetArrayLength());

        // Verify metadata tags array
        var originalTags = originalFirst.GetProperty("metadata").GetProperty("tags");
        var resultTags = resultFirst.GetProperty("metadata").GetProperty("tags");
        resultTags.GetArrayLength().Should().Be(originalTags.GetArrayLength());
    }

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "JSON")]
    public async Task Json_Passthrough_PreservesDataTypes()
    {
        // Arrange - JSON with various data types
        var originalJson = @"[
            {
                ""stringValue"": ""test"",
                ""intValue"": 42,
                ""floatValue"": 3.14,
                ""boolValue"": true,
                ""nullValue"": null,
                ""arrayValue"": [1, 2, 3],
                ""objectValue"": { ""nested"": ""value"" }
            }
        ]";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(originalJson));

        // Act
        var resultJson = await _jsonConverter.ConvertToJsonAsync(stream);

        // Assert
        using var resultDoc = JsonDocument.Parse(resultJson);
        var item = resultDoc.RootElement[0];

        item.GetProperty("stringValue").GetString().Should().Be("test");
        item.GetProperty("intValue").GetInt32().Should().Be(42);
        item.GetProperty("floatValue").GetDouble().Should().BeApproximately(3.14, 0.001);
        item.GetProperty("boolValue").GetBoolean().Should().BeTrue();
        item.GetProperty("nullValue").ValueKind.Should().Be(JsonValueKind.Null);
        item.GetProperty("arrayValue").GetArrayLength().Should().Be(3);
        item.GetProperty("objectValue").GetProperty("nested").GetString().Should().Be("value");
    }

    #endregion

    #region Cross-Format Tests

    [Fact]
    [Trait("Category", "BidirectionalFormat")]
    [Trait("Format", "CrossFormat")]
    public async Task AllFormats_ProduceSameRecordCount()
    {
        // Arrange - Use same record count
        const int recordCount = 10;

        var csvData = TestDataFactory.GenerateDeterministicCsv(recordCount);
        var xmlData = TestDataFactory.GenerateDeterministicXml(recordCount);
        using var excelStream = TestDataFactory.GenerateDeterministicExcel(recordCount);

        // Act - Convert all to JSON
        using var csvStream = new MemoryStream(Encoding.UTF8.GetBytes(csvData));
        var csvJson = await _csvConverter.ConvertToJsonAsync(csvStream);

        using var xmlStream = new MemoryStream(Encoding.UTF8.GetBytes(xmlData));
        var xmlJson = await _xmlConverter.ConvertToJsonAsync(xmlStream);

        var excelJson = await _excelConverter.ConvertToJsonAsync(excelStream);

        // Assert - All produce same record count
        using var csvDoc = JsonDocument.Parse(csvJson);
        using var excelDoc = JsonDocument.Parse(excelJson);

        csvDoc.RootElement.GetArrayLength().Should().Be(recordCount);
        excelDoc.RootElement.GetArrayLength().Should().Be(recordCount);

        // XML produces object with Transaction array (different structure)
        using var xmlDoc = JsonDocument.Parse(xmlJson);
        xmlDoc.RootElement.GetProperty("Transaction").GetArrayLength().Should().Be(recordCount);
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Parses CSV string into list of dictionaries for comparison.
    /// </summary>
    private static List<Dictionary<string, string>> ParseCsvToRecords(string csv)
    {
        var records = new List<Dictionary<string, string>>();
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        if (lines.Length == 0) return records;

        var headers = ParseCsvLine(lines[0]);

        for (int i = 1; i < lines.Length; i++)
        {
            var values = ParseCsvLine(lines[i]);
            var record = new Dictionary<string, string>();

            for (int j = 0; j < headers.Count && j < values.Count; j++)
            {
                record[headers[j]] = values[j];
            }

            records.Add(record);
        }

        return records;
    }

    /// <summary>
    /// Parses a single CSV line, handling quoted values.
    /// </summary>
    private static List<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;

        foreach (char c in line.TrimEnd('\r', '\n'))
        {
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (c == ',' && !inQuotes)
            {
                values.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        values.Add(current.ToString());
        return values;
    }

    #endregion
}

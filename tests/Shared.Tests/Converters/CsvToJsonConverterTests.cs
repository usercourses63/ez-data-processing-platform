// CsvToJsonConverterTests.cs - Unit Tests for CsvToJsonConverter
// UNIT-003: CSV Format Converter Tests
// Version: 1.1
// Date: February 2, 2026

using System.Text;
using DataProcessing.Shared.Converters;
using DataProcessing.Shared.Tests.TestData;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text.Json;
using Xunit;

namespace DataProcessing.Shared.Tests.Converters;

/// <summary>
/// Unit tests for CsvToJsonConverter
/// Tests CSV parsing, type conversion, header handling,
/// and edge cases like empty files and malformed data.
/// </summary>
public class CsvToJsonConverterTests
{
    private readonly Mock<ILogger<CsvToJsonConverter>> _mockLogger;
    private readonly CsvToJsonConverter _converter;

    public CsvToJsonConverterTests()
    {
        _mockLogger = new Mock<ILogger<CsvToJsonConverter>>();
        _converter = new CsvToJsonConverter(_mockLogger.Object);
    }

    #region SourceFormat Tests

    [Fact]
    public void SourceFormat_ReturnsCsv()
    {
        // Assert
        _converter.SourceFormat.Should().Be("csv");
    }

    #endregion

    #region ConvertToJsonAsync Basic Tests

    [Fact]
    public async Task ConvertToJsonAsync_WithValidCsv_ReturnsJsonArray()
    {
        // Arrange
        var csv = "Name,Age,Active\nJohn,30,true\nJane,25,false";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        result.Should().NotBeNullOrEmpty();
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(2);
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithNumericValues_ConvertsToNumbers()
    {
        // Arrange
        var csv = "Id,Amount,Rate\n1,100,3.14\n2,200,2.71";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Id").GetInt32().Should().Be(1);
        firstRecord.GetProperty("Amount").GetInt32().Should().Be(100);
        firstRecord.GetProperty("Rate").GetDouble().Should().BeApproximately(3.14, 0.01);
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithBooleanValues_ConvertsToBooleans()
    {
        // Arrange
        var csv = "Name,Active,Verified\nJohn,true,True\nJane,false,False";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Active").GetBoolean().Should().BeTrue();
        firstRecord.GetProperty("Verified").GetBoolean().Should().BeTrue();

        var secondRecord = jsonArray[1];
        secondRecord.GetProperty("Active").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithStringValues_KeepsAsStrings()
    {
        // Arrange
        var csv = "Name,Email,Description\nJohn,john@test.com,A test user\nJane,jane@test.com,Another user";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Name").GetString().Should().Be("John");
        firstRecord.GetProperty("Email").GetString().Should().Be("john@test.com");
    }

    #endregion

    #region Edge Cases

    [Fact]
    public async Task ConvertToJsonAsync_WithEmptyValues_HandlesGracefully()
    {
        // Arrange
        var csv = "Name,Age,City\nJohn,,New York\n,25,";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();
        jsonArray.Should().HaveCount(2);
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithSingleRecord_ReturnsArrayWithOneElement()
    {
        // Arrange
        var csv = "Name,Age\nJohn,30";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(1);
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithHeaderOnly_ReturnsEmptyArray()
    {
        // Arrange
        var csv = "Name,Age,City";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().BeEmpty();
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithQuotedValues_HandlesCorrectly()
    {
        // Arrange
        var csv = "Name,Description\nJohn,\"A description, with comma\"\nJane,\"Another \"\"quoted\"\" value\"";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Description").GetString().Should().Be("A description, with comma");
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithSpecialCharacters_PreservesContent()
    {
        // Arrange
        var csv = "Name,Symbol\nAlpha,α\nBeta,β";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Symbol").GetString().Should().Be("α");
    }

    #endregion

    #region IsValidFormatAsync Tests

    [Fact]
    public async Task IsValidFormatAsync_WithValidCsv_ReturnsTrue()
    {
        // Arrange
        var csv = "Name,Age,City\nJohn,30,NYC";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.IsValidFormatAsync(stream);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsValidFormatAsync_WithNoCommas_ReturnsFalse()
    {
        // Arrange
        var csv = "This is not a CSV file";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.IsValidFormatAsync(stream);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsValidFormatAsync_WithEmptyStream_ReturnsFalse()
    {
        // Arrange
        using var stream = CreateStream("");

        // Act
        var result = await _converter.IsValidFormatAsync(stream);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region ExtractMetadataAsync Tests

    [Fact]
    public async Task ExtractMetadataAsync_ReturnsCorrectMetadata()
    {
        // Arrange
        var csv = "Name,Age,City\nJohn,30,NYC";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ExtractMetadataAsync(stream);

        // Assert
        result.Should().ContainKey("Delimiter");
        result["Delimiter"].Should().Be(",");
        result.Should().ContainKey("HasHeader");
        result["HasHeader"].Should().Be(true);
        result.Should().ContainKey("Headers");
        result["Headers"].ToString().Should().Contain("Name");
    }

    #endregion

    #region Transaction Data Tests (Realistic E2E Scenario)

    [Fact]
    public async Task ConvertToJsonAsync_WithTransactionData_ParsesCorrectly()
    {
        // Arrange - simulating E2E-001 test data format
        var csv = @"TransactionId,CustomerId,CustomerName,TransactionDate,Amount,Currency,TransactionType,Status,Description
TXN-20251201-000001,CUST-1001,John Smith,2025-12-01 10:30:00,1500.50,USD,Purchase,Completed,Monthly subscription
TXN-20251201-000002,CUST-1002,Jane Doe,2025-12-01 11:45:00,250.00,EUR,Refund,Pending,Product return";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(2);

        var firstTxn = jsonArray![0];
        firstTxn.GetProperty("TransactionId").GetString().Should().Be("TXN-20251201-000001");
        firstTxn.GetProperty("CustomerId").GetString().Should().Be("CUST-1001");
        firstTxn.GetProperty("Amount").GetDouble().Should().BeApproximately(1500.50, 0.01);
        firstTxn.GetProperty("Currency").GetString().Should().Be("USD");
        firstTxn.GetProperty("Status").GetString().Should().Be("Completed");
    }

    #endregion

    #region Edge Case Tests (Phase 04-01)

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithHebrewContent_PreservesCharacters()
    {
        // Arrange - CSV with Hebrew customer names and descriptions
        var csv = "Name,Description\nיוסי כהן,תיאור בעברית\nשרה לוי,עוד תיאור";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - Parse JSON to verify Hebrew characters are preserved
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();
        jsonArray.Should().HaveCount(2);

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Name").GetString().Should().Be("יוסי כהן");
        firstRecord.GetProperty("Description").GetString().Should().Be("תיאור בעברית");

        var secondRecord = jsonArray[1];
        secondRecord.GetProperty("Name").GetString().Should().Be("שרה לוי");
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithNewlinesInQuotedFields_HandlesCorrectly()
    {
        // Arrange - CSV with multiline content in quoted fields
        var csv = "Name,Description\nJohn,\"This is a\nmultiline\ndescription\"\nJane,\"Single line\"";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();
        jsonArray.Should().HaveCount(2);

        var firstRecord = jsonArray![0];
        var description = firstRecord.GetProperty("Description").GetString();
        description.Should().Contain("\n", because: "newlines should be preserved in quoted fields");
        description.Should().Contain("multiline");
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithLargeFile_CompletesSuccessfully()
    {
        // Arrange - Generate 1000 records via TestDataFactory
        var csv = TestDataFactory.GenerateCsv(1000);
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - Verify conversion completes and record count matches
        result.Should().NotBeNullOrEmpty();
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();
        jsonArray.Should().HaveCount(1000, because: "all 1000 records should be converted");
    }

    #endregion

    #region Schema-Aware Type Coercion Tests (TASK A / bug #1)

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithStringTypedSchema_KeepsNumericColumnsAsStrings()
    {
        // Arrange - numeric data, but the schema types every field as "string"
        // (the default when fields are hand-added in the Schema tab). Reproduces the
        // ValidRecords=0 bug: numbers must stay strings to validate against a string schema.
        var csv = "id,name,amount\n501,Widget,1500\n502,Gadget,250";
        using var stream = CreateStream(csv);
        var metadata = new Dictionary<string, object>
        {
            ["SchemaFieldTypes"] = new Dictionary<string, string>
            {
                ["id"] = "string",
                ["name"] = "string",
                ["amount"] = "string"
            }
        };

        // Act
        var result = await _converter.ConvertToJsonAsync(stream, metadata);

        // Assert - all values are JSON strings, not numbers
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(2);

        var first = jsonArray![0];
        first.GetProperty("id").ValueKind.Should().Be(JsonValueKind.String);
        first.GetProperty("id").GetString().Should().Be("501");
        first.GetProperty("amount").ValueKind.Should().Be(JsonValueKind.String);
        first.GetProperty("amount").GetString().Should().Be("1500");
        first.GetProperty("name").GetString().Should().Be("Widget");
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithNumericTypedSchema_CoercesToNumbers()
    {
        // Arrange - schema declares numeric/integer types, raw text should be parsed
        var csv = "id,amount,active\n501,1500.50,true";
        using var stream = CreateStream(csv);
        var metadata = new Dictionary<string, object>
        {
            ["SchemaFieldTypes"] = new Dictionary<string, string>
            {
                ["id"] = "integer",
                ["amount"] = "number",
                ["active"] = "boolean"
            }
        };

        // Act
        var result = await _converter.ConvertToJsonAsync(stream, metadata);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        var first = jsonArray![0];
        first.GetProperty("id").GetInt32().Should().Be(501);
        first.GetProperty("amount").GetDouble().Should().BeApproximately(1500.50, 0.01);
        first.GetProperty("active").GetBoolean().Should().BeTrue();
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithSchemaFieldTypes_IsCaseInsensitiveOnHeaders()
    {
        // Arrange - CSV header casing differs from schema property casing
        var csv = "Id,Amount\n501,1500";
        using var stream = CreateStream(csv);
        var metadata = new Dictionary<string, object>
        {
            ["SchemaFieldTypes"] = new Dictionary<string, string>
            {
                ["id"] = "string",
                ["amount"] = "string"
            }
        };

        // Act
        var result = await _converter.ConvertToJsonAsync(stream, metadata);

        // Assert - matched case-insensitively, kept as strings
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        var first = jsonArray![0];
        first.GetProperty("Id").ValueKind.Should().Be(JsonValueKind.String);
        first.GetProperty("Amount").ValueKind.Should().Be(JsonValueKind.String);
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithoutSchemaFieldTypes_FallsBackToInference()
    {
        // Arrange - no SchemaFieldTypes metadata: legacy content inference still applies
        var csv = "id,amount,name\n501,1500,Widget";
        using var stream = CreateStream(csv);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - numbers inferred (unchanged legacy behavior)
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        var first = jsonArray![0];
        first.GetProperty("id").GetInt32().Should().Be(501);
        first.GetProperty("amount").GetInt32().Should().Be(1500);
        first.GetProperty("name").GetString().Should().Be("Widget");
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "CSV")]
    public async Task ConvertToJsonAsync_WithPartialSchemaFieldTypes_InfersUndeclaredFields()
    {
        // Arrange - only "id" declared (string); "amount" has no declared type
        var csv = "id,amount\n501,1500";
        using var stream = CreateStream(csv);
        var metadata = new Dictionary<string, object>
        {
            ["SchemaFieldTypes"] = new Dictionary<string, string>
            {
                ["id"] = "string"
            }
        };

        // Act
        var result = await _converter.ConvertToJsonAsync(stream, metadata);

        // Assert - id kept string, amount inferred to number
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        var first = jsonArray![0];
        first.GetProperty("id").ValueKind.Should().Be(JsonValueKind.String);
        first.GetProperty("amount").GetInt32().Should().Be(1500);
    }

    #endregion

    #region Helper Methods

    private static MemoryStream CreateStream(string content)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(content));
    }

    #endregion
}

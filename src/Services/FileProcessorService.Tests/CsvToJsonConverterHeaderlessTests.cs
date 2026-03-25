using System.Text;
using System.Text.Json;
using DataProcessing.Shared.Converters;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace FileProcessorService.Tests;

/// <summary>
/// Integration tests for CsvToJsonConverter headerless CSV handling (IMPORT-06).
/// Verifies that headerless CSV files use SchemaPropertyNames from metadata
/// instead of generic Column1, Column2, ... names.
/// </summary>
public class CsvToJsonConverterHeaderlessTests
{
    private readonly CsvToJsonConverter _converter;

    public CsvToJsonConverterHeaderlessTests()
    {
        var logger = new Mock<ILogger<CsvToJsonConverter>>();
        _converter = new CsvToJsonConverter(logger.Object);
    }

    private static MemoryStream CreateStream(string content)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(content));
    }

    [Fact]
    public async Task HeadedCsv_WithMetadata_ProducesNormalOutput_BackwardCompat()
    {
        // Arrange: CSV with headers and HasHeader=true metadata
        var csv = "name,age,email\nAlice,30,alice@example.com\nBob,25,bob@test.com";
        using var stream = CreateStream(csv);
        var metadata = new Dictionary<string, object>
        {
            ["HasHeader"] = true
        };

        // Act
        var json = await _converter.ConvertToJsonAsync(stream, metadata);
        var records = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);

        // Assert: field names from CSV header row
        records.Should().NotBeNull();
        records!.Count.Should().Be(2);
        records[0].Should().ContainKey("name");
        records[0].Should().ContainKey("age");
        records[0].Should().ContainKey("email");
        records[0]["name"].GetString().Should().Be("Alice");
    }

    [Fact]
    public async Task HeaderlessCsv_WithSchemaPropertyNames_ProducesSchemaFieldNames()
    {
        // Arrange: CSV WITHOUT headers, metadata includes SchemaPropertyNames
        var csv = "Alice,30,alice@example.com\nBob,25,bob@test.com";
        using var stream = CreateStream(csv);
        var metadata = new Dictionary<string, object>
        {
            ["HasHeader"] = false,
            ["SchemaPropertyNames"] = new string[] { "name", "age", "email" }
        };

        // Act
        var json = await _converter.ConvertToJsonAsync(stream, metadata);
        var records = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);

        // Assert: field names from SchemaPropertyNames, NOT Column1/Column2/Column3
        records.Should().NotBeNull();
        records!.Count.Should().Be(2);

        records[0].Should().ContainKey("name");
        records[0].Should().ContainKey("age");
        records[0].Should().ContainKey("email");
        records[0].Should().NotContainKey("Column1");
        records[0].Should().NotContainKey("Column2");
        records[0].Should().NotContainKey("Column3");

        // Verify values mapped correctly (1st column -> name, 2nd -> age, 3rd -> email)
        records[0]["name"].GetString().Should().Be("Alice");
        records[0]["age"].GetInt32().Should().Be(30);
        records[0]["email"].GetString().Should().Be("alice@example.com");

        // Second record too
        records[1]["name"].GetString().Should().Be("Bob");
        records[1]["age"].GetInt32().Should().Be(25);
    }

    [Fact]
    public async Task HeaderlessCsv_WithoutSchemaPropertyNames_FallsBackToColumnN()
    {
        // Arrange: CSV WITHOUT headers, no SchemaPropertyNames in metadata
        var csv = "Alice,30,alice@example.com";
        using var stream = CreateStream(csv);
        var metadata = new Dictionary<string, object>
        {
            ["HasHeader"] = false
        };

        // Act
        var json = await _converter.ConvertToJsonAsync(stream, metadata);
        var records = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);

        // Assert: falls back to Column1, Column2, Column3
        records.Should().NotBeNull();
        records!.Count.Should().Be(1);
        records[0].Should().ContainKey("Column1");
        records[0].Should().ContainKey("Column2");
        records[0].Should().ContainKey("Column3");
        records[0]["Column1"].GetString().Should().Be("Alice");
    }

    [Fact]
    public async Task NullMetadata_DefaultsToHasHeaderTrue_BackwardCompat()
    {
        // Arrange: CSV with headers, NO metadata (null) -> should default to HasHeader=true
        var csv = "name,age\nAlice,30\nBob,25";
        using var stream = CreateStream(csv);

        // Act: pass null metadata
        var json = await _converter.ConvertToJsonAsync(stream, null);
        var records = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);

        // Assert: uses first row as headers (backward compatibility)
        records.Should().NotBeNull();
        records!.Count.Should().Be(2);
        records[0].Should().ContainKey("name");
        records[0].Should().ContainKey("age");
        records[0]["name"].GetString().Should().Be("Alice");
        records[0]["age"].GetInt32().Should().Be(30);
    }
}

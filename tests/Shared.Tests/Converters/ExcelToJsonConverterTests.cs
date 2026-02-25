// ExcelToJsonConverterTests.cs - Unit Tests for ExcelToJsonConverter
// UNIT-005: Excel Format Converter Tests
// Version: 1.1
// Date: February 2, 2026

using DataProcessing.Shared.Converters;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using OfficeOpenXml;
using System.Text.Json;
using Xunit;

namespace DataProcessing.Shared.Tests.Converters;

/// <summary>
/// Unit tests for ExcelToJsonConverter
/// Tests Excel parsing, data type handling, multiple sheets,
/// and edge cases like empty files.
/// </summary>
public class ExcelToJsonConverterTests : IDisposable
{
    private readonly Mock<ILogger<ExcelToJsonConverter>> _mockLogger;
    private readonly ExcelToJsonConverter _converter;

    public ExcelToJsonConverterTests()
    {
        // Set EPPlus license for testing (NonCommercial) - EPPlus 8 API
        ExcelPackage.License.SetNonCommercialOrganization("EZ Platform Tests");

        _mockLogger = new Mock<ILogger<ExcelToJsonConverter>>();
        _converter = new ExcelToJsonConverter(_mockLogger.Object);
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }

    #region SourceFormat Tests

    [Fact]
    public void SourceFormat_ReturnsExcel()
    {
        // Assert
        _converter.SourceFormat.Should().Be("excel");
    }

    #endregion

    #region ConvertToJsonAsync Basic Tests

    [Fact]
    public async Task ConvertToJsonAsync_WithSimpleExcel_ReturnsJsonArray()
    {
        // Arrange
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Name";
            worksheet.Cells[1, 2].Value = "Age";
            worksheet.Cells[2, 1].Value = "John";
            worksheet.Cells[2, 2].Value = 30;
            worksheet.Cells[3, 1].Value = "Jane";
            worksheet.Cells[3, 2].Value = 25;
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        result.Should().NotBeNullOrEmpty();
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(2);
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithNumericValues_PreservesTypes()
    {
        // Arrange
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Id";
            worksheet.Cells[1, 2].Value = "Amount";
            worksheet.Cells[1, 3].Value = "Rate";
            worksheet.Cells[2, 1].Value = 1;
            worksheet.Cells[2, 2].Value = 100.50;
            worksheet.Cells[2, 3].Value = 3.14159;
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Id").GetDouble().Should().Be(1);
        firstRecord.GetProperty("Amount").GetDouble().Should().BeApproximately(100.50, 0.01);
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithDateValues_HandlesCorrectly()
    {
        // Arrange
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Name";
            worksheet.Cells[1, 2].Value = "Date";
            worksheet.Cells[2, 1].Value = "Event 1";
            worksheet.Cells[2, 2].Value = new DateTime(2025, 12, 1);
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        result.Should().NotBeNullOrEmpty();
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(1);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public async Task ConvertToJsonAsync_WithEmptyWorksheet_ReturnsEmptyArray()
    {
        // Arrange
        using var stream = CreateExcelStream(_ => { }); // Empty worksheet

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        result.Should().Be("[]");
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithHeaderOnly_ReturnsEmptyArray()
    {
        // Arrange
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Name";
            worksheet.Cells[1, 2].Value = "Age";
            // No data rows
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().BeEmpty();
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithEmptyCells_HandlesGracefully()
    {
        // Arrange
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Name";
            worksheet.Cells[1, 2].Value = "Age";
            worksheet.Cells[1, 3].Value = "City";
            worksheet.Cells[2, 1].Value = "John";
            // Age is empty
            worksheet.Cells[2, 3].Value = "NYC";
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(1);

        var record = jsonArray![0];
        record.GetProperty("Name").GetString().Should().Be("John");
        record.GetProperty("City").GetString().Should().Be("NYC");
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithSpecialCharacters_PreservesContent()
    {
        // Arrange
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Description";
            worksheet.Cells[2, 1].Value = "Price: $100 & <Special>";
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray![0].GetProperty("Description").GetString()
            .Should().Contain("$100").And.Contain("<Special>");
    }

    #endregion

    #region IsValidFormatAsync Tests

    [Fact]
    public async Task IsValidFormatAsync_WithValidExcel_ReturnsTrue()
    {
        // Arrange
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Test";
        });

        // Act
        var result = await _converter.IsValidFormatAsync(stream);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsValidFormatAsync_WithInvalidData_ReturnsFalse()
    {
        // Arrange
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("Not an Excel file"));

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
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Name = "TestSheet";
            worksheet.Cells[1, 1].Value = "Col1";
            worksheet.Cells[1, 2].Value = "Col2";
            worksheet.Cells[2, 1].Value = "Data1";
            worksheet.Cells[2, 2].Value = "Data2";
            worksheet.Cells[3, 1].Value = "Data3";
            worksheet.Cells[3, 2].Value = "Data4";
        });

        // Act
        var result = await _converter.ExtractMetadataAsync(stream);

        // Assert
        result.Should().ContainKey("SheetCount");
        result.Should().ContainKey("SheetName");
        result.Should().ContainKey("RowCount");
        result.Should().ContainKey("ColumnCount");
        result["SheetName"].Should().Be("TestSheet");
        result["RowCount"].Should().Be(3);
        result["ColumnCount"].Should().Be(2);
    }

    #endregion

    #region Transaction Data Tests (Realistic E2E Scenario)

    [Fact]
    public async Task ConvertToJsonAsync_WithTransactionData_ParsesCorrectly()
    {
        // Arrange - simulating E2E-003 Excel test data format
        using var stream = CreateExcelStream(worksheet =>
        {
            // Headers
            worksheet.Cells[1, 1].Value = "TransactionId";
            worksheet.Cells[1, 2].Value = "CustomerId";
            worksheet.Cells[1, 3].Value = "CustomerName";
            worksheet.Cells[1, 4].Value = "Amount";
            worksheet.Cells[1, 5].Value = "Currency";
            worksheet.Cells[1, 6].Value = "Status";

            // Data row 1
            worksheet.Cells[2, 1].Value = "TXN-20251201-000001";
            worksheet.Cells[2, 2].Value = "CUST-1001";
            worksheet.Cells[2, 3].Value = "John Smith";
            worksheet.Cells[2, 4].Value = 1500.50;
            worksheet.Cells[2, 5].Value = "USD";
            worksheet.Cells[2, 6].Value = "Completed";

            // Data row 2
            worksheet.Cells[3, 1].Value = "TXN-20251201-000002";
            worksheet.Cells[3, 2].Value = "CUST-1002";
            worksheet.Cells[3, 3].Value = "Jane Doe";
            worksheet.Cells[3, 4].Value = 250.00;
            worksheet.Cells[3, 5].Value = "EUR";
            worksheet.Cells[3, 6].Value = "Pending";
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().HaveCount(2);

        var firstTxn = jsonArray![0];
        firstTxn.GetProperty("TransactionId").GetString().Should().Be("TXN-20251201-000001");
        firstTxn.GetProperty("CustomerName").GetString().Should().Be("John Smith");
        firstTxn.GetProperty("Amount").GetDouble().Should().BeApproximately(1500.50, 0.01);
        firstTxn.GetProperty("Status").GetString().Should().Be("Completed");
    }

    #endregion

    #region Edge Case Tests (Phase 04-01)

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "Excel")]
    public async Task ConvertToJsonAsync_WithMultipleSheets_ReadsFirstSheet()
    {
        // Arrange - Create Excel with 2 sheets
        var stream = new MemoryStream();
        using (var package = new ExcelPackage())
        {
            // First sheet with data
            var sheet1 = package.Workbook.Worksheets.Add("FirstSheet");
            sheet1.Cells[1, 1].Value = "Name";
            sheet1.Cells[2, 1].Value = "John";
            sheet1.Cells[3, 1].Value = "Jane";

            // Second sheet with different data
            var sheet2 = package.Workbook.Worksheets.Add("SecondSheet");
            sheet2.Cells[1, 1].Value = "Product";
            sheet2.Cells[2, 1].Value = "Widget";

            package.SaveAs(stream);
        }
        stream.Position = 0;

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - Only first sheet is converted (documented multi-sheet behavior)
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();
        jsonArray.Should().HaveCount(2, because: "first sheet has 2 data rows");

        var firstRecord = jsonArray![0];
        firstRecord.GetProperty("Name").GetString().Should().Be("John",
            because: "first sheet data should be read");
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "Excel")]
    public async Task ConvertToJsonAsync_WithDateCells_FormatsCorrectly()
    {
        // Arrange - Excel with date format cells
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "EventName";
            worksheet.Cells[1, 2].Value = "EventDate";

            worksheet.Cells[2, 1].Value = "Conference";
            worksheet.Cells[2, 2].Value = new DateTime(2026, 6, 15, 10, 30, 0);
            worksheet.Cells[2, 2].Style.Numberformat.Format = "yyyy-MM-dd HH:mm:ss";

            worksheet.Cells[3, 1].Value = "Meeting";
            worksheet.Cells[3, 2].Value = new DateTime(2026, 7, 20, 14, 0, 0);
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();
        jsonArray.Should().HaveCount(2);

        // Date values are converted to their underlying representation
        var firstEvent = jsonArray![0];
        firstEvent.GetProperty("EventName").GetString().Should().Be("Conference");
        // Date is returned as DateTime object value
        firstEvent.TryGetProperty("EventDate", out var dateProperty).Should().BeTrue();
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "Excel")]
    public async Task ConvertToJsonAsync_WithFormulaCells_ReadsValues()
    {
        // Arrange - Cells containing formulas
        using var stream = CreateExcelStream(worksheet =>
        {
            worksheet.Cells[1, 1].Value = "Quantity";
            worksheet.Cells[1, 2].Value = "Price";
            worksheet.Cells[1, 3].Value = "Total";

            worksheet.Cells[2, 1].Value = 10;
            worksheet.Cells[2, 2].Value = 5.50;
            worksheet.Cells[2, 3].Formula = "A2*B2"; // Formula
            worksheet.Calculate(); // Calculate formulas

            worksheet.Cells[3, 1].Value = 5;
            worksheet.Cells[3, 2].Value = 12.00;
            worksheet.Cells[3, 3].Formula = "A3*B3";
            worksheet.Calculate();
        });

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - Formula results (not formulas) are in JSON
        var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(result);
        jsonArray.Should().NotBeNull();
        jsonArray.Should().HaveCount(2);

        var firstRow = jsonArray![0];
        firstRow.GetProperty("Quantity").GetDouble().Should().Be(10);
        firstRow.GetProperty("Price").GetDouble().Should().BeApproximately(5.50, 0.01);
        // Total should be calculated value (10 * 5.50 = 55)
        firstRow.GetProperty("Total").GetDouble().Should().BeApproximately(55.0, 0.01);

        var secondRow = jsonArray[1];
        // Total should be 5 * 12 = 60
        secondRow.GetProperty("Total").GetDouble().Should().BeApproximately(60.0, 0.01);
    }

    #endregion

    #region Helper Methods

    private static MemoryStream CreateExcelStream(Action<ExcelWorksheet> populateWorksheet)
    {
        var stream = new MemoryStream();
        using (var package = new ExcelPackage())
        {
            var worksheet = package.Workbook.Worksheets.Add("Sheet1");
            populateWorksheet(worksheet);
            package.SaveAs(stream);
        }
        stream.Position = 0;
        return stream;
    }

    #endregion
}

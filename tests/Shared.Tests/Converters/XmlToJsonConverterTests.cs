// XmlToJsonConverterTests.cs - Unit Tests for XmlToJsonConverter
// UNIT-004: XML Format Converter Tests
// Version: 1.1
// Date: February 2, 2026

using System.Text;
using DataProcessing.Shared.Converters;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text.Json;
using Xunit;

namespace DataProcessing.Shared.Tests.Converters;

/// <summary>
/// Unit tests for XmlToJsonConverter
/// Tests XML parsing, nested elements, arrays,
/// and edge cases like empty elements and invalid XML.
/// </summary>
public class XmlToJsonConverterTests
{
    private readonly Mock<ILogger<XmlToJsonConverter>> _mockLogger;
    private readonly XmlToJsonConverter _converter;

    public XmlToJsonConverterTests()
    {
        _mockLogger = new Mock<ILogger<XmlToJsonConverter>>();
        _converter = new XmlToJsonConverter(_mockLogger.Object);
    }

    #region SourceFormat Tests

    [Fact]
    public void SourceFormat_ReturnsXml()
    {
        // Assert
        _converter.SourceFormat.Should().Be("xml");
    }

    #endregion

    #region ConvertToJsonAsync Basic Tests

    [Fact]
    public async Task ConvertToJsonAsync_WithSimpleXml_ReturnsJsonObject()
    {
        // Arrange
        var xml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<Person>
    <Name>John</Name>
    <Age>30</Age>
</Person>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        result.Should().NotBeNullOrEmpty();
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        jsonObj.GetProperty("Name").GetString().Should().Be("John");
        // XmlToJsonConverter converts numeric values to numbers
        jsonObj.GetProperty("Age").GetInt32().Should().Be(30);
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithNestedElements_HandlesHierarchy()
    {
        // Arrange
        var xml = @"<?xml version=""1.0""?>
<Order>
    <Customer>
        <Name>John</Name>
        <Email>john@test.com</Email>
    </Customer>
    <Total>100.50</Total>
</Order>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        var customer = jsonObj.GetProperty("Customer");
        customer.GetProperty("Name").GetString().Should().Be("John");
        customer.GetProperty("Email").GetString().Should().Be("john@test.com");
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithRepeatingElements_CreatesArray()
    {
        // Arrange
        var xml = @"<?xml version=""1.0""?>
<Orders>
    <Item>First</Item>
    <Item>Second</Item>
    <Item>Third</Item>
</Orders>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        var items = jsonObj.GetProperty("Item");
        items.ValueKind.Should().Be(JsonValueKind.Array);
        items.GetArrayLength().Should().Be(3);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public async Task ConvertToJsonAsync_WithEmptyElement_ReturnsEmptyString()
    {
        // Arrange
        var xml = @"<?xml version=""1.0""?>
<Data>
    <Value></Value>
</Data>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        jsonObj.GetProperty("Value").GetString().Should().BeEmpty();
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithSpecialCharacters_PreservesContent()
    {
        // Arrange
        var xml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<Data>
    <Text>&lt;script&gt;alert(1)&lt;/script&gt;</Text>
    <Symbol>€</Symbol>
</Data>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        jsonObj.GetProperty("Text").GetString().Should().Contain("<script>");
        jsonObj.GetProperty("Symbol").GetString().Should().Be("€");
    }

    [Fact]
    public async Task ConvertToJsonAsync_WithMixedContent_ExtractsValues()
    {
        // Arrange
        var xml = @"<?xml version=""1.0""?>
<Data>
    <SingleValue>One</SingleValue>
    <MultiValue>A</MultiValue>
    <MultiValue>B</MultiValue>
</Data>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        jsonObj.GetProperty("SingleValue").GetString().Should().Be("One");
        jsonObj.GetProperty("MultiValue").GetArrayLength().Should().Be(2);
    }

    #endregion

    #region IsValidFormatAsync Tests

    [Fact]
    public async Task IsValidFormatAsync_WithValidXml_ReturnsTrue()
    {
        // Arrange
        var xml = @"<?xml version=""1.0""?><Root><Item>Test</Item></Root>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.IsValidFormatAsync(stream);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsValidFormatAsync_WithInvalidXml_ReturnsFalse()
    {
        // Arrange
        var xml = "This is not XML <broken>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.IsValidFormatAsync(stream);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsValidFormatAsync_WithMalformedXml_ReturnsFalse()
    {
        // Arrange
        var xml = "<Root><Unclosed>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.IsValidFormatAsync(stream);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region ExtractMetadataAsync Tests

    [Fact]
    public async Task ExtractMetadataAsync_ReturnsRootElement()
    {
        // Arrange
        var xml = @"<?xml version=""1.0""?><Transactions><Txn>1</Txn></Transactions>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ExtractMetadataAsync(stream);

        // Assert
        result.Should().ContainKey("RootElement");
        result["RootElement"].Should().Be("Transactions");
    }

    [Fact]
    public async Task ExtractMetadataAsync_DetectsNamespace()
    {
        // Arrange
        var xml = @"<?xml version=""1.0""?><Root xmlns=""http://example.com""><Item>Test</Item></Root>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ExtractMetadataAsync(stream);

        // Assert
        result.Should().ContainKey("HasNamespace");
        result["HasNamespace"].Should().Be(true);
    }

    #endregion

    #region Transaction Data Tests (Realistic E2E Scenario)

    [Fact]
    public async Task ConvertToJsonAsync_WithTransactionXml_ParsesCorrectly()
    {
        // Arrange - simulating E2E-003 XML test data format
        var xml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<Transactions>
    <Transaction>
        <TransactionId>TXN-20251201-000001</TransactionId>
        <CustomerId>CUST-1001</CustomerId>
        <CustomerName>John Smith</CustomerName>
        <Amount>1500.50</Amount>
        <Currency>USD</Currency>
        <Status>Completed</Status>
    </Transaction>
    <Transaction>
        <TransactionId>TXN-20251201-000002</TransactionId>
        <CustomerId>CUST-1002</CustomerId>
        <CustomerName>Jane Doe</CustomerName>
        <Amount>250.00</Amount>
        <Currency>EUR</Currency>
        <Status>Pending</Status>
    </Transaction>
</Transactions>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        var transactions = jsonObj.GetProperty("Transaction");
        transactions.GetArrayLength().Should().Be(2);

        var firstTxn = transactions[0];
        firstTxn.GetProperty("TransactionId").GetString().Should().Be("TXN-20251201-000001");
        // Amount is converted to decimal by XmlToJsonConverter
        firstTxn.GetProperty("Amount").GetDecimal().Should().Be(1500.50m);
    }

    #endregion

    #region Edge Case Tests (Phase 04-01)

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "XML")]
    public async Task ConvertToJsonAsync_WithNamespaces_StripsNamespaces()
    {
        // Arrange - XML with xmlns declarations
        var xml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<Root xmlns=""http://example.com/schema"" xmlns:custom=""http://example.com/custom"">
    <Item>Value1</Item>
    <custom:Item>Value2</custom:Item>
</Root>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - Namespaces are stripped during conversion (local names preserved)
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        jsonObj.Should().NotBeNull();

        // Items should be accessible by local name (namespace stripped)
        jsonObj.GetProperty("Item").ValueKind.Should().Be(JsonValueKind.Array,
            because: "both namespaced and non-namespaced Item elements should be combined");
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "XML")]
    public async Task ConvertToJsonAsync_WithCDATA_PreservesContent()
    {
        // Arrange - XML with CDATA sections
        var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
            "<Data>" +
            "<Script><![CDATA[function test() { return x < 10 && y > 5; }]]></Script>" +
            "<Content><![CDATA[Special chars: <>&]]></Content>" +
            "</Data>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - CDATA content is preserved in JSON
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        jsonObj.Should().NotBeNull();

        var scriptContent = jsonObj.GetProperty("Script").GetString();
        scriptContent.Should().Contain("function test()");
        scriptContent.Should().Contain("x < 10");

        var content = jsonObj.GetProperty("Content").GetString();
        content.Should().Contain("<>&");
    }

    [Fact]
    [Trait("Category", "FormatConversion")]
    [Trait("Format", "XML")]
    public async Task ConvertToJsonAsync_WithAttributes_IgnoresAttributes()
    {
        // Arrange - XML with attributes on elements
        // Note: Current implementation ignores attributes, converting only element content
        var xml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<Product id=""123"" category=""electronics"">
    <Name lang=""en"">Widget</Name>
    <Price currency=""USD"">99.99</Price>
</Product>";
        using var stream = CreateStream(xml);

        // Act
        var result = await _converter.ConvertToJsonAsync(stream);

        // Assert - Element content is preserved (attributes are ignored by design)
        var jsonObj = JsonSerializer.Deserialize<JsonElement>(result);
        jsonObj.Should().NotBeNull();

        // Document behavior: XmlToJsonConverter extracts element values only
        // Attributes (id, category, lang, currency) are not in output
        jsonObj.GetProperty("Name").GetString().Should().Be("Widget");
        // Price is converted to decimal type by XmlToJsonConverter
        jsonObj.GetProperty("Price").GetDecimal().Should().Be(99.99m);
    }

    #endregion

    #region Helper Methods

    private static MemoryStream CreateStream(string content)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(content));
    }

    #endregion
}

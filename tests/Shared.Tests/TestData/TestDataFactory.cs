// TestDataFactory.cs - Test Data Generators for Format Conversion Tests
// Phase 04-01: Bidirectional Format Testing
// Version: 1.0
// Date: February 2, 2026

using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Bogus;
using OfficeOpenXml;

namespace DataProcessing.Shared.Tests.TestData;

/// <summary>
/// Factory for generating test data in various formats (CSV, XML, Excel, JSON).
/// Used for bidirectional round-trip format conversion testing.
/// </summary>
public static class TestDataFactory
{
    private static readonly Faker _faker = new("en");

    /// <summary>
    /// Generates a CSV string with transaction data.
    /// Headers: TransactionId,CustomerId,CustomerName,TransactionDate,Amount,Currency,TransactionType,Status,Description
    /// </summary>
    /// <param name="recordCount">Number of data records (excluding header)</param>
    /// <returns>CSV string with header and data rows</returns>
    public static string GenerateCsv(int recordCount)
    {
        var sb = new StringBuilder();

        // Header row
        sb.AppendLine("TransactionId,CustomerId,CustomerName,TransactionDate,Amount,Currency,TransactionType,Status,Description");

        // Data rows
        for (int i = 0; i < recordCount; i++)
        {
            var transactionId = $"TXN-{DateTime.UtcNow:yyyyMMdd}-{i + 1:D6}";
            var customerId = $"CUST-{_faker.Random.Number(1000, 9999)}";
            var customerName = _faker.Name.FullName();
            var transactionDate = _faker.Date.Past(1).ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            var amount = _faker.Finance.Amount(10, 10000).ToString("F2", CultureInfo.InvariantCulture);
            var currency = _faker.PickRandom("USD", "EUR", "GBP", "ILS");
            var transactionType = _faker.PickRandom("Purchase", "Refund", "Transfer", "Payment");
            var status = _faker.PickRandom("Completed", "Pending", "Failed", "Processing");

            // Escape description with quotes if it contains commas
            var rawDescription = _faker.Lorem.Sentence(5);
            var description = rawDescription.Contains(',') ? $"\"{rawDescription}\"" : rawDescription;

            sb.AppendLine($"{transactionId},{customerId},{customerName},{transactionDate},{amount},{currency},{transactionType},{status},{description}");
        }

        return sb.ToString();
    }

    /// <summary>
    /// Generates an XML string with transaction data.
    /// Structure: Root element Transactions with Transaction child elements.
    /// </summary>
    /// <param name="recordCount">Number of Transaction elements</param>
    /// <returns>XML string with UTF-8 encoding declaration</returns>
    public static string GenerateXml(int recordCount)
    {
        var transactions = new XElement("Transactions");

        for (int i = 0; i < recordCount; i++)
        {
            var transaction = new XElement("Transaction",
                new XElement("TransactionId", $"TXN-{DateTime.UtcNow:yyyyMMdd}-{i + 1:D6}"),
                new XElement("CustomerId", $"CUST-{_faker.Random.Number(1000, 9999)}"),
                new XElement("CustomerName", _faker.Name.FullName()),
                new XElement("TransactionDate", _faker.Date.Past(1).ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)),
                new XElement("Amount", _faker.Finance.Amount(10, 10000).ToString("F2", CultureInfo.InvariantCulture)),
                new XElement("Currency", _faker.PickRandom("USD", "EUR", "GBP", "ILS")),
                new XElement("TransactionType", _faker.PickRandom("Purchase", "Refund", "Transfer", "Payment")),
                new XElement("Status", _faker.PickRandom("Completed", "Pending", "Failed", "Processing")),
                new XElement("Description", _faker.Lorem.Sentence(5))
            );

            transactions.Add(transaction);
        }

        var xDoc = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            transactions
        );

        using var sw = new StringWriter();
        xDoc.Save(sw);
        return sw.ToString();
    }

    /// <summary>
    /// Generates an Excel workbook with transaction data.
    /// Single worksheet "Transactions" with headers in row 1, data starting row 2.
    /// </summary>
    /// <param name="recordCount">Number of data rows (excluding header)</param>
    /// <returns>MemoryStream containing the Excel file</returns>
    public static MemoryStream GenerateExcel(int recordCount)
    {
        // Set EPPlus license for non-commercial use
        ExcelPackage.License.SetNonCommercialOrganization("EZ Platform Tests");

        var stream = new MemoryStream();
        using (var package = new ExcelPackage())
        {
            var worksheet = package.Workbook.Worksheets.Add("Transactions");

            // Headers in row 1
            var headers = new[] { "TransactionId", "CustomerId", "CustomerName", "TransactionDate", "Amount", "Currency", "TransactionType", "Status", "Description" };
            for (int col = 0; col < headers.Length; col++)
            {
                worksheet.Cells[1, col + 1].Value = headers[col];
            }

            // Data rows starting at row 2
            for (int row = 0; row < recordCount; row++)
            {
                worksheet.Cells[row + 2, 1].Value = $"TXN-{DateTime.UtcNow:yyyyMMdd}-{row + 1:D6}";
                worksheet.Cells[row + 2, 2].Value = $"CUST-{_faker.Random.Number(1000, 9999)}";
                worksheet.Cells[row + 2, 3].Value = _faker.Name.FullName();
                worksheet.Cells[row + 2, 4].Value = _faker.Date.Past(1).ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
                worksheet.Cells[row + 2, 5].Value = _faker.Finance.Amount(10, 10000);
                worksheet.Cells[row + 2, 6].Value = _faker.PickRandom("USD", "EUR", "GBP", "ILS");
                worksheet.Cells[row + 2, 7].Value = _faker.PickRandom("Purchase", "Refund", "Transfer", "Payment");
                worksheet.Cells[row + 2, 8].Value = _faker.PickRandom("Completed", "Pending", "Failed", "Processing");
                worksheet.Cells[row + 2, 9].Value = _faker.Lorem.Sentence(5);
            }

            package.SaveAs(stream);
        }

        stream.Position = 0;
        return stream;
    }

    /// <summary>
    /// Generates a JSON string with an array of transaction objects.
    /// Field names match the CSV headers for consistency.
    /// </summary>
    /// <param name="recordCount">Number of transaction objects in the array</param>
    /// <returns>JSON array string</returns>
    public static string GenerateJson(int recordCount)
    {
        var transactions = new List<Dictionary<string, object>>();

        for (int i = 0; i < recordCount; i++)
        {
            var transaction = new Dictionary<string, object>
            {
                ["TransactionId"] = $"TXN-{DateTime.UtcNow:yyyyMMdd}-{i + 1:D6}",
                ["CustomerId"] = $"CUST-{_faker.Random.Number(1000, 9999)}",
                ["CustomerName"] = _faker.Name.FullName(),
                ["TransactionDate"] = _faker.Date.Past(1).ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                ["Amount"] = Math.Round(_faker.Finance.Amount(10, 10000), 2),
                ["Currency"] = _faker.PickRandom("USD", "EUR", "GBP", "ILS"),
                ["TransactionType"] = _faker.PickRandom("Purchase", "Refund", "Transfer", "Payment"),
                ["Status"] = _faker.PickRandom("Completed", "Pending", "Failed", "Processing"),
                ["Description"] = _faker.Lorem.Sentence(5)
            };

            transactions.Add(transaction);
        }

        return JsonSerializer.Serialize(transactions);
    }

    /// <summary>
    /// Returns a CSV string with Hebrew content for RTL testing.
    /// Tests Hebrew customer names and descriptions.
    /// </summary>
    /// <returns>CSV string with Hebrew content</returns>
    public static string GetHebrewCsvTestData()
    {
        var sb = new StringBuilder();

        sb.AppendLine("TransactionId,CustomerId,CustomerName,TransactionDate,Amount,Currency,TransactionType,Status,Description");
        sb.AppendLine("TXN-20260201-000001,CUST-1001,יוסי כהן,2026-01-15 10:30:00,1500.50,ILS,Purchase,Completed,\"רכישה של מוצרים אלקטרוניים\"");
        sb.AppendLine("TXN-20260201-000002,CUST-1002,שרה לוי,2026-01-16 14:45:00,250.00,ILS,Refund,Pending,\"החזר עבור מוצר פגום\"");
        sb.AppendLine("TXN-20260201-000003,CUST-1003,דוד ישראלי,2026-01-17 09:00:00,3200.75,ILS,Transfer,Completed,\"העברה בנקאית לחשבון עסקי\"");

        return sb.ToString();
    }

    /// <summary>
    /// Returns a JSON string with nested object structures.
    /// Tests nested object handling during format conversions.
    /// </summary>
    /// <returns>JSON array with nested objects</returns>
    public static string GetNestedJson()
    {
        var transactions = new[]
        {
            new Dictionary<string, object>
            {
                ["transactionId"] = "TXN-NESTED-001",
                ["customer"] = new Dictionary<string, object>
                {
                    ["id"] = "CUST-5001",
                    ["name"] = "John Doe",
                    ["email"] = "john.doe@example.com",
                    ["address"] = new Dictionary<string, object>
                    {
                        ["street"] = "123 Main St",
                        ["city"] = "New York",
                        ["country"] = "USA",
                        ["postalCode"] = "10001"
                    }
                },
                ["items"] = new[]
                {
                    new Dictionary<string, object>
                    {
                        ["productId"] = "PROD-001",
                        ["name"] = "Widget A",
                        ["quantity"] = 2,
                        ["price"] = 49.99
                    },
                    new Dictionary<string, object>
                    {
                        ["productId"] = "PROD-002",
                        ["name"] = "Widget B",
                        ["quantity"] = 1,
                        ["price"] = 99.99
                    }
                },
                ["total"] = 199.97,
                ["metadata"] = new Dictionary<string, object>
                {
                    ["source"] = "web",
                    ["referrer"] = "google",
                    ["tags"] = new[] { "premium", "recurring", "verified" }
                }
            },
            new Dictionary<string, object>
            {
                ["transactionId"] = "TXN-NESTED-002",
                ["customer"] = new Dictionary<string, object>
                {
                    ["id"] = "CUST-5002",
                    ["name"] = "Jane Smith",
                    ["email"] = "jane.smith@example.com",
                    ["address"] = new Dictionary<string, object>
                    {
                        ["street"] = "456 Oak Ave",
                        ["city"] = "Los Angeles",
                        ["country"] = "USA",
                        ["postalCode"] = "90001"
                    }
                },
                ["items"] = new[]
                {
                    new Dictionary<string, object>
                    {
                        ["productId"] = "PROD-003",
                        ["name"] = "Gadget X",
                        ["quantity"] = 3,
                        ["price"] = 29.99
                    }
                },
                ["total"] = 89.97,
                ["metadata"] = new Dictionary<string, object>
                {
                    ["source"] = "mobile",
                    ["referrer"] = "direct",
                    ["tags"] = new[] { "new-customer" }
                }
            }
        };

        return JsonSerializer.Serialize(transactions);
    }

    /// <summary>
    /// Generates deterministic CSV data for comparison tests.
    /// Uses fixed values instead of random data.
    /// </summary>
    /// <param name="recordCount">Number of records</param>
    /// <returns>CSV string with deterministic data</returns>
    public static string GenerateDeterministicCsv(int recordCount)
    {
        var sb = new StringBuilder();

        sb.AppendLine("TransactionId,CustomerId,CustomerName,TransactionDate,Amount,Currency,TransactionType,Status,Description");

        for (int i = 0; i < recordCount; i++)
        {
            var transactionId = $"TXN-FIXED-{i + 1:D6}";
            var customerId = $"CUST-{1000 + i}";
            var customerName = $"Customer {i + 1}";
            var transactionDate = $"2026-01-{(i % 28) + 1:D2} 10:00:00";
            var amount = (100.00 + (i * 10.50)).ToString("F2", CultureInfo.InvariantCulture);
            var currencies = new[] { "USD", "EUR", "GBP", "ILS" };
            var currency = currencies[i % 4];
            var types = new[] { "Purchase", "Refund", "Transfer", "Payment" };
            var transactionType = types[i % 4];
            var statuses = new[] { "Completed", "Pending", "Failed", "Processing" };
            var status = statuses[i % 4];
            var description = $"Transaction description for record {i + 1}";

            sb.AppendLine($"{transactionId},{customerId},{customerName},{transactionDate},{amount},{currency},{transactionType},{status},{description}");
        }

        return sb.ToString();
    }

    /// <summary>
    /// Generates deterministic XML data for comparison tests.
    /// </summary>
    /// <param name="recordCount">Number of records</param>
    /// <returns>XML string with deterministic data</returns>
    public static string GenerateDeterministicXml(int recordCount)
    {
        var transactions = new XElement("Transactions");

        for (int i = 0; i < recordCount; i++)
        {
            var currencies = new[] { "USD", "EUR", "GBP", "ILS" };
            var types = new[] { "Purchase", "Refund", "Transfer", "Payment" };
            var statuses = new[] { "Completed", "Pending", "Failed", "Processing" };

            var transaction = new XElement("Transaction",
                new XElement("TransactionId", $"TXN-FIXED-{i + 1:D6}"),
                new XElement("CustomerId", $"CUST-{1000 + i}"),
                new XElement("CustomerName", $"Customer {i + 1}"),
                new XElement("TransactionDate", $"2026-01-{(i % 28) + 1:D2} 10:00:00"),
                new XElement("Amount", (100.00 + (i * 10.50)).ToString("F2", CultureInfo.InvariantCulture)),
                new XElement("Currency", currencies[i % 4]),
                new XElement("TransactionType", types[i % 4]),
                new XElement("Status", statuses[i % 4]),
                new XElement("Description", $"Transaction description for record {i + 1}")
            );

            transactions.Add(transaction);
        }

        var xDoc = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            transactions
        );

        using var sw = new StringWriter();
        xDoc.Save(sw);
        return sw.ToString();
    }

    /// <summary>
    /// Generates deterministic Excel data for comparison tests.
    /// </summary>
    /// <param name="recordCount">Number of records</param>
    /// <returns>MemoryStream containing Excel file</returns>
    public static MemoryStream GenerateDeterministicExcel(int recordCount)
    {
        ExcelPackage.License.SetNonCommercialOrganization("EZ Platform Tests");

        var stream = new MemoryStream();
        using (var package = new ExcelPackage())
        {
            var worksheet = package.Workbook.Worksheets.Add("Transactions");

            var headers = new[] { "TransactionId", "CustomerId", "CustomerName", "TransactionDate", "Amount", "Currency", "TransactionType", "Status", "Description" };
            for (int col = 0; col < headers.Length; col++)
            {
                worksheet.Cells[1, col + 1].Value = headers[col];
            }

            var currencies = new[] { "USD", "EUR", "GBP", "ILS" };
            var types = new[] { "Purchase", "Refund", "Transfer", "Payment" };
            var statuses = new[] { "Completed", "Pending", "Failed", "Processing" };

            for (int row = 0; row < recordCount; row++)
            {
                worksheet.Cells[row + 2, 1].Value = $"TXN-FIXED-{row + 1:D6}";
                worksheet.Cells[row + 2, 2].Value = $"CUST-{1000 + row}";
                worksheet.Cells[row + 2, 3].Value = $"Customer {row + 1}";
                worksheet.Cells[row + 2, 4].Value = $"2026-01-{(row % 28) + 1:D2} 10:00:00";
                worksheet.Cells[row + 2, 5].Value = 100.00 + (row * 10.50);
                worksheet.Cells[row + 2, 6].Value = currencies[row % 4];
                worksheet.Cells[row + 2, 7].Value = types[row % 4];
                worksheet.Cells[row + 2, 8].Value = statuses[row % 4];
                worksheet.Cells[row + 2, 9].Value = $"Transaction description for record {row + 1}";
            }

            package.SaveAs(stream);
        }

        stream.Position = 0;
        return stream;
    }
}

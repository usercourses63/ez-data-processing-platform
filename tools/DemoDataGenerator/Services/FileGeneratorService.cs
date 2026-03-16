using System.Text;
using System.Text.Json;

namespace DemoDataGenerator.Services;

/// <summary>
/// Generates CSV and JSON file content for demo data seeding.
/// Supports 4 schema types matching the AllGenerators schema definitions.
/// Content is deterministic when using a seeded Random instance.
/// </summary>
public class FileGeneratorService
{
    private readonly Random _random;

    private static readonly string[] TransactionStatuses = ["ממתין", "אושר", "נדחה"];
    private static readonly string[] ProductCategories = ["אלקטרוניקה", "ביגוד", "מזון"];
    private static readonly string[] Departments = ["הנדסה", "מכירות", "כספים", "משאבי אנוש"];

    public FileGeneratorService(Random random)
    {
        _random = random;
    }

    /// <summary>
    /// Generates CSV content with header row + data rows matching the specified schema.
    /// </summary>
    /// <param name="schemaIndex">Schema type (0=SimpleTransaction, 1=UserProfile, 2=ProductCatalog, 3=EmployeeRecord)</param>
    /// <param name="recordCount">Number of data rows to generate</param>
    /// <returns>UTF-8 encoded CSV content</returns>
    public byte[] GenerateCsvContent(int schemaIndex, int recordCount)
    {
        var sb = new StringBuilder();

        switch (schemaIndex)
        {
            case 1: // UserProfile
                sb.AppendLine("userId,email,fullName,birthDate");
                for (int i = 0; i < recordCount; i++)
                {
                    var userId = Guid.NewGuid();
                    var birthDate = RandomDate(1970, 2000);
                    sb.AppendLine($"{userId},user{i}@example.com,User {i},{birthDate:yyyy-MM-dd}");
                }
                break;

            case 2: // ProductCatalog
                sb.AppendLine("productId,name,price,category,stock");
                for (int i = 0; i < recordCount; i++)
                {
                    var productId = $"PROD-{_random.Next(100000, 999999)}";
                    var price = Math.Round(_random.NextDouble() * 9998.99 + 1, 2);
                    var category = ProductCategories[_random.Next(ProductCategories.Length)];
                    var stock = _random.Next(0, 1001);
                    sb.AppendLine($"{productId},{EscapeCsv($"Product {i}")},{price},{EscapeCsv(category)},{stock}");
                }
                break;

            case 3: // EmployeeRecord
                sb.AppendLine("employeeId,name,department,salary,hireDate");
                for (int i = 0; i < recordCount; i++)
                {
                    var employeeId = $"EMP-{_random.Next(10000, 99999)}";
                    var department = Departments[_random.Next(Departments.Length)];
                    var salary = _random.Next(5000, 50001);
                    var hireDate = RandomDate(2015, 2025);
                    sb.AppendLine($"{employeeId},{EscapeCsv($"Employee {i}")},{EscapeCsv(department)},{salary},{hireDate:yyyy-MM-dd}");
                }
                break;

            default: // Schema 0: SimpleTransaction (also default for unknown indices)
                sb.AppendLine("transactionId,amount,date,status");
                for (int i = 0; i < recordCount; i++)
                {
                    var txnId = $"TXN-{_random.Next(10000000, 99999999)}";
                    var amount = Math.Round(_random.NextDouble() * 100000, 2);
                    var date = RandomDate(DateTime.UtcNow.Year - 1, DateTime.UtcNow.Year);
                    var status = TransactionStatuses[_random.Next(TransactionStatuses.Length)];
                    sb.AppendLine($"{txnId},{amount},{date:yyyy-MM-dd},{EscapeCsv(status)}");
                }
                break;
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    /// <summary>
    /// Generates JSON content as an array of objects matching the specified schema.
    /// </summary>
    /// <param name="schemaIndex">Schema type (0=SimpleTransaction, 1=UserProfile, 2=ProductCatalog, 3=EmployeeRecord)</param>
    /// <param name="recordCount">Number of objects to generate</param>
    /// <returns>UTF-8 encoded JSON content</returns>
    public byte[] GenerateJsonContent(int schemaIndex, int recordCount)
    {
        var records = new List<Dictionary<string, object>>();

        for (int i = 0; i < recordCount; i++)
        {
            var record = schemaIndex switch
            {
                1 => new Dictionary<string, object>
                {
                    ["userId"] = Guid.NewGuid().ToString(),
                    ["email"] = $"user{i}@example.com",
                    ["fullName"] = $"User {i}",
                    ["birthDate"] = RandomDate(1970, 2000).ToString("yyyy-MM-dd")
                },
                2 => new Dictionary<string, object>
                {
                    ["productId"] = $"PROD-{_random.Next(100000, 999999)}",
                    ["name"] = $"Product {i}",
                    ["price"] = Math.Round(_random.NextDouble() * 9998.99 + 1, 2),
                    ["category"] = ProductCategories[_random.Next(ProductCategories.Length)],
                    ["stock"] = _random.Next(0, 1001)
                },
                3 => new Dictionary<string, object>
                {
                    ["employeeId"] = $"EMP-{_random.Next(10000, 99999)}",
                    ["name"] = $"Employee {i}",
                    ["department"] = Departments[_random.Next(Departments.Length)],
                    ["salary"] = _random.Next(5000, 50001),
                    ["hireDate"] = RandomDate(2015, 2025).ToString("yyyy-MM-dd")
                },
                _ => new Dictionary<string, object>
                {
                    ["transactionId"] = $"TXN-{_random.Next(10000000, 99999999)}",
                    ["amount"] = Math.Round(_random.NextDouble() * 100000, 2),
                    ["date"] = RandomDate(DateTime.UtcNow.Year - 1, DateTime.UtcNow.Year).ToString("yyyy-MM-dd"),
                    ["status"] = TransactionStatuses[_random.Next(TransactionStatuses.Length)]
                }
            };
            records.Add(record);
        }

        return JsonSerializer.SerializeToUtf8Bytes(records, new JsonSerializerOptions { WriteIndented = true });
    }

    /// <summary>
    /// Returns the appropriate file extension for the format.
    /// </summary>
    /// <param name="isJson">True for JSON, false for CSV</param>
    /// <returns>File extension including the dot</returns>
    public string GetFileExtension(bool isJson) => isJson ? ".json" : ".csv";

    /// <summary>
    /// Returns a manifest of files to generate per server — a mix of CSV and JSON,
    /// with varying record counts and schema types.
    /// </summary>
    /// <param name="filesPerServer">Number of file specs to return (default 4)</param>
    /// <returns>Array of (schemaIndex, recordCount, isJson) tuples</returns>
    public (int schemaIndex, int recordCount, bool isJson)[] GetFileManifest(int filesPerServer = 4)
    {
        return filesPerServer switch
        {
            >= 4 => [
                (0, 10, false),   // SimpleTransaction CSV, 10 rows
                (0, 100, false),  // SimpleTransaction CSV, 100 rows
                (1, 10, true),    // UserProfile JSON, 10 records
                (1, 100, true),   // UserProfile JSON, 100 records
                .. Enumerable.Range(4, filesPerServer - 4)
                    .Select(i => (i % 4, i % 2 == 0 ? 10 : 100, i % 2 == 1))
                    .ToArray()
            ],
            3 => [(0, 10, false), (1, 10, true), (2, 100, false)],
            2 => [(0, 10, false), (1, 10, true)],
            1 => [(0, 10, false)],
            _ => []
        };
    }

    private DateTime RandomDate(int startYear, int endYear)
    {
        var start = new DateTime(startYear, 1, 1);
        var end = new DateTime(endYear, 12, 31);
        var range = (end - start).Days;
        return start.AddDays(_random.Next(range));
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}

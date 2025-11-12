using Microsoft.Extensions.Logging;
using OfficeOpenXml;
using System.Text.Json;

namespace DataProcessing.Shared.Converters;

/// <summary>
/// Converts Excel format (.xlsx) to JSON
/// </summary>
public class ExcelToJsonConverter : IFormatConverter
{
    private readonly ILogger<ExcelToJsonConverter> _logger;

    public string SourceFormat => "excel";

    public ExcelToJsonConverter(ILogger<ExcelToJsonConverter> logger)
    {
        _logger = logger;
        // EPPlus license will be configured in application startup
    }

    public Task<string> ConvertToJsonAsync(
        Stream sourceStream,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var package = new ExcelPackage(sourceStream);
            var worksheet = package.Workbook.Worksheets[0];
            
            var records = new List<Dictionary<string, object>>();
            var rowCount = worksheet.Dimension?.Rows ?? 0;
            var colCount = worksheet.Dimension?.Columns ?? 0;
            
            if (rowCount == 0) return Task.FromResult("[]");
            
            // Read headers from first row
            var headers = new List<string>();
            for (int col = 1; col <= colCount; col++)
            {
                headers.Add(worksheet.Cells[1, col].Value?.ToString() ?? $"Column{col}");
            }
            
            // Read data rows
            for (int row = 2; row <= rowCount; row++)
            {
                var record = new Dictionary<string, object>();
                for (int col = 1; col <= colCount; col++)
                {
                    record[headers[col - 1]] = worksheet.Cells[row, col].Value ?? "";
                }
                records.Add(record);
            }
            
            return Task.FromResult(JsonSerializer.Serialize(records));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error converting Excel to JSON");
            throw;
        }
    }

    public Task<bool> IsValidFormatAsync(Stream stream, CancellationToken cancellationToken = default)
    {
        try
        {
            using var package = new ExcelPackage(stream);
            return Task.FromResult(package.Workbook.Worksheets.Count > 0);
        }
        catch
        {
            stream.Position = 0;
            return Task.FromResult(false);
        }
    }

    public Task<Dictionary<string, object>> ExtractMetadataAsync(
        Stream sourceStream,
        CancellationToken cancellationToken = default)
    {
        using var package = new ExcelPackage(sourceStream);
        var worksheet = package.Workbook.Worksheets[0];
        
        return Task.FromResult(new Dictionary<string, object>
        {
            ["SheetCount"] = package.Workbook.Worksheets.Count,
            ["SheetName"] = worksheet.Name,
            ["RowCount"] = worksheet.Dimension?.Rows ?? 0,
            ["ColumnCount"] = worksheet.Dimension?.Columns ?? 0,
            ["HasHeader"] = true
        });
    }
}

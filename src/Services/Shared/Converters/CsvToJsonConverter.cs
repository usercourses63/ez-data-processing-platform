using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.Extensions.Logging;
using System.Dynamic;
using System.Globalization;
using System.Text.Json;

namespace DataProcessing.Shared.Converters;

/// <summary>
/// Converts CSV format to JSON
/// </summary>
public class CsvToJsonConverter : IFormatConverter
{
    private readonly ILogger<CsvToJsonConverter> _logger;

    public string SourceFormat => "csv";

    public CsvToJsonConverter(ILogger<CsvToJsonConverter> logger)
    {
        _logger = logger;
    }

    public Task<string> ConvertToJsonAsync(
        Stream sourceStream,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                HasHeaderRecord = true,
                MissingFieldFound = null,
                BadDataFound = null
            };

            using var reader = new StreamReader(sourceStream);
            using var csv = new CsvReader(reader, config);
            
            var records = csv.GetRecords<dynamic>().ToList();
            return Task.FromResult(JsonSerializer.Serialize(records));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error converting CSV to JSON");
            throw;
        }
    }

    public async Task<bool> IsValidFormatAsync(Stream stream, CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new StreamReader(stream, leaveOpen: true);
            var firstLine = await reader.ReadLineAsync(cancellationToken);
            stream.Position = 0;
            return !string.IsNullOrEmpty(firstLine) && firstLine.Contains(',');
        }
        catch
        {
            stream.Position = 0;
            return false;
        }
    }

    public async Task<Dictionary<string, object>> ExtractMetadataAsync(
        Stream sourceStream,
        CancellationToken cancellationToken = default)
    {
        using var reader = new StreamReader(sourceStream, leaveOpen: true);
        var firstLine = await reader.ReadLineAsync(cancellationToken);
        sourceStream.Position = 0;
        
        return new Dictionary<string, object>
        {
            ["Delimiter"] = ",",
            ["HasHeader"] = true,
            ["Encoding"] = "UTF-8",
            ["Headers"] = firstLine ?? ""
        };
    }
}

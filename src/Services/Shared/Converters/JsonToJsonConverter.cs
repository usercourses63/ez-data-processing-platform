using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace DataProcessing.Shared.Converters;

/// <summary>
/// Passthrough converter for JSON format - validates and returns as-is
/// </summary>
public class JsonToJsonConverter : IFormatConverter
{
    private readonly ILogger<JsonToJsonConverter> _logger;

    public string SourceFormat => "json";

    public JsonToJsonConverter(ILogger<JsonToJsonConverter> logger)
    {
        _logger = logger;
    }

    public async Task<string> ConvertToJsonAsync(
        Stream sourceStream,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new StreamReader(sourceStream);
            var jsonContent = await reader.ReadToEndAsync(cancellationToken);
            
            // Validate JSON structure
            JsonDocument.Parse(jsonContent);
            
            return jsonContent;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Invalid JSON format");
            throw;
        }
    }

    public async Task<bool> IsValidFormatAsync(Stream stream, CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new StreamReader(stream, leaveOpen: true);
            var content = await reader.ReadToEndAsync(cancellationToken);
            stream.Position = 0;
            
            JsonDocument.Parse(content);
            return true;
        }
        catch
        {
            stream.Position = 0;
            return false;
        }
    }

    public Task<Dictionary<string, object>> ExtractMetadataAsync(
        Stream sourceStream,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new Dictionary<string, object>
        {
            ["Encoding"] = "UTF-8",
            ["Format"] = "json"
        });
    }
}

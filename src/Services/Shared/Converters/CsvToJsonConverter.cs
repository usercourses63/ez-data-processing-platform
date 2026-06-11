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
            // Read HasHeader from metadata (default true for backward compatibility)
            var hasHeader = true;
            if (metadata?.TryGetValue("HasHeader", out var hasHeaderObj) == true)
            {
                hasHeader = Convert.ToBoolean(hasHeaderObj);
            }

            // Read SchemaPropertyNames from metadata when headerless
            string[]? schemaPropertyNames = null;
            if (!hasHeader && metadata?.TryGetValue("SchemaPropertyNames", out var namesObj) == true)
            {
                schemaPropertyNames = namesObj as string[];
                if (schemaPropertyNames == null && namesObj is JsonElement jsonElement)
                {
                    schemaPropertyNames = jsonElement.EnumerateArray()
                        .Select(e => e.GetString() ?? "")
                        .ToArray();
                }
            }

            // Read SchemaFieldTypes for schema-aware type coercion (TASK A / bug #1).
            // When the datasource schema declares a field as "string", the raw CSV text is
            // kept verbatim instead of being auto-inferred to a number/boolean, so numeric
            // data validates cleanly against a string-typed schema.
            IReadOnlyDictionary<string, string>? schemaFieldTypes = null;
            if (metadata?.TryGetValue("SchemaFieldTypes", out var typesObj) == true)
            {
                schemaFieldTypes = ParseSchemaFieldTypes(typesObj);
            }

            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                HasHeaderRecord = hasHeader,
                MissingFieldFound = null,
                BadDataFound = null
            };

            using var reader = new StreamReader(sourceStream);
            using var csv = new CsvReader(reader, config);

            List<Dictionary<string, object>> convertedRecords;

            if (hasHeader)
            {
                // Existing behavior: use CsvHelper's dynamic record parsing with headers
                var records = csv.GetRecords<dynamic>().ToList();
                convertedRecords = records
                    .Select(record => ConvertTypes((IDictionary<string, object>)record, schemaFieldTypes))
                    .ToList();
            }
            else
            {
                // Headerless CSV: read fields by position and map to schema property names
                convertedRecords = new List<Dictionary<string, object>>();
                while (csv.Read())
                {
                    var record = new Dictionary<string, object>();
                    for (var i = 0; i < csv.Parser.Count; i++)
                    {
                        var key = schemaPropertyNames != null && i < schemaPropertyNames.Length
                            ? schemaPropertyNames[i]
                            : $"Column{i + 1}";
                        record[key] = csv.GetField(i) ?? "";
                    }
                    convertedRecords.Add(ConvertTypes(record, schemaFieldTypes));
                }
            }

            return Task.FromResult(JsonSerializer.Serialize(convertedRecords));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error converting CSV to JSON");
            throw;
        }
    }

    /// <summary>
    /// Converts string values to appropriate JSON types.
    /// When <paramref name="schemaFieldTypes"/> declares a type for a field, the value is
    /// coerced to that declared type (a "string" field is kept verbatim, so numeric text does
    /// not silently become a JSON number that fails validation against a string schema).
    /// Fields with no declared type fall back to content-based inference (legacy behavior).
    /// </summary>
    private Dictionary<string, object> ConvertTypes(
        IDictionary<string, object> record,
        IReadOnlyDictionary<string, string>? schemaFieldTypes)
    {
        var converted = new Dictionary<string, object>();

        foreach (var kvp in record)
        {
            var value = kvp.Value?.ToString() ?? "";

            if (schemaFieldTypes != null && schemaFieldTypes.TryGetValue(kvp.Key, out var declaredType))
            {
                converted[kvp.Key] = CoerceToDeclaredType(value, declaredType);
            }
            else
            {
                converted[kvp.Key] = InferType(value);
            }
        }

        return converted;
    }

    /// <summary>
    /// Coerces a raw CSV value to the JSON type declared in the datasource schema.
    /// If the value cannot be coerced to a numeric/boolean declared type, the raw string is
    /// returned so JSON Schema validation surfaces the genuine type mismatch instead of this
    /// converter masking it.
    /// </summary>
    private static object CoerceToDeclaredType(string value, string declaredType)
    {
        switch (declaredType?.ToLowerInvariant())
        {
            case "string":
                // Keep verbatim — never auto-promote string-typed columns to numbers/booleans.
                return value;

            case "integer":
                if (long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var longValue))
                {
                    // Prefer Int32 when it fits, matching legacy output for typical ids/counts.
                    return longValue is >= int.MinValue and <= int.MaxValue ? (int)longValue : longValue;
                }
                // Not a clean integer — fall through to number so validation can flag it.
                if (double.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var intAsNum))
                {
                    return intAsNum;
                }
                return value;

            case "number":
                if (double.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var numValue))
                {
                    return numValue;
                }
                return value;

            case "boolean":
                if (bool.TryParse(value, out var boolValue))
                {
                    return boolValue;
                }
                return value;

            default:
                // Unknown/array/object/null declared types: fall back to content inference.
                return InferType(value);
        }
    }

    /// <summary>
    /// Legacy content-based type inference used when the schema does not declare a field's type.
    /// </summary>
    private static object InferType(string value)
    {
        // Try to convert to number (int or decimal)
        if (double.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var numValue))
        {
            // Use decimal for values with decimal points, int for whole numbers
            if (value.Contains('.') || value.Contains(','))
            {
                return numValue;
            }
            if (int.TryParse(value, out var intValue))
            {
                return intValue;
            }
            return numValue;
        }
        // Try to convert to boolean
        if (bool.TryParse(value, out var boolValue))
        {
            return boolValue;
        }
        // Keep as string
        return value;
    }

    /// <summary>
    /// Parses the SchemaFieldTypes conversion-metadata entry (a field-name → JSON-type map) into a
    /// case-insensitive lookup. Accepts either a live dictionary (in-process call) or a JSON object.
    /// </summary>
    private static IReadOnlyDictionary<string, string>? ParseSchemaFieldTypes(object? typesObj)
    {
        if (typesObj == null)
        {
            return null;
        }

        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        switch (typesObj)
        {
            case IReadOnlyDictionary<string, string> readOnly:
                foreach (var kvp in readOnly)
                {
                    map[kvp.Key] = kvp.Value;
                }
                break;

            case IDictionary<string, string> dict:
                foreach (var kvp in dict)
                {
                    map[kvp.Key] = kvp.Value;
                }
                break;

            case JsonElement json when json.ValueKind == JsonValueKind.Object:
                foreach (var prop in json.EnumerateObject())
                {
                    if (prop.Value.ValueKind == JsonValueKind.String)
                    {
                        map[prop.Name] = prop.Value.GetString() ?? "";
                    }
                }
                break;

            default:
                return null;
        }

        return map.Count > 0 ? map : null;
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

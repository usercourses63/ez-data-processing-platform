using MongoDB.Bson;
using System.Text.Json;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Converts a request's <c>TypeSpecificConfig</c> (a <see cref="Dictionary{TKey,TValue}"/> that may
/// contain <see cref="JsonElement"/> values from System.Text.Json deserialization) into a
/// <see cref="BsonDocument"/> for persistence.
///
/// Centralized so the exact PascalCase S3 key contract (<c>AccessKey</c>, <c>SecretKey</c>,
/// <c>Bucket</c>, <c>Region</c>, <c>ForcePathStyle</c>, <c>UseHttp</c>, optional
/// <c>SessionToken</c>/<c>Endpoint</c>) round-trips unchanged and is unit-testable (Phase 34,
/// Pitfall 2 — no camelCase drift). The keys are passed through verbatim; no key renaming occurs.
/// </summary>
public static class ServerConfigConverter
{
    /// <summary>
    /// Converts a <c>Dictionary&lt;string, object&gt;</c> to a <see cref="BsonDocument"/>,
    /// preserving keys verbatim. Returns <c>null</c> when <paramref name="dict"/> is null.
    /// </summary>
    public static BsonDocument? ConvertToBsonDocument(Dictionary<string, object>? dict)
    {
        if (dict == null) return null;

        var doc = new BsonDocument();
        foreach (var kvp in dict)
        {
            doc[kvp.Key] = ConvertToBsonValue(kvp.Value);
        }
        return doc;
    }

    /// <summary>
    /// Converts a single value (boxed primitive or <see cref="JsonElement"/>) to a <see cref="BsonValue"/>.
    /// </summary>
    public static BsonValue ConvertToBsonValue(object? value)
    {
        if (value == null) return BsonNull.Value;

        if (value is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.String => new BsonString(je.GetString()!),
                JsonValueKind.Number when je.TryGetInt32(out var i) => new BsonInt32(i),
                JsonValueKind.Number when je.TryGetInt64(out var l) => new BsonInt64(l),
                JsonValueKind.Number => new BsonDouble(je.GetDouble()),
                JsonValueKind.True => new BsonBoolean(true),
                JsonValueKind.False => new BsonBoolean(false),
                JsonValueKind.Null => BsonNull.Value,
                JsonValueKind.Object => BsonDocument.Parse(je.GetRawText()),
                JsonValueKind.Array => new BsonArray(je.EnumerateArray().Select(e => ConvertToBsonValue(e))),
                _ => new BsonString(je.GetRawText()),
            };
        }

        return value switch
        {
            string s => new BsonString(s),
            int i => new BsonInt32(i),
            long l => new BsonInt64(l),
            double d => new BsonDouble(d),
            bool b => new BsonBoolean(b),
            _ => new BsonString(value.ToString() ?? string.Empty),
        };
    }
}

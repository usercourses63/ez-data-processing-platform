// KokoSchema.cs - Phase 36-01 fixture
// Verbatim copy of the LIVE `koko` data-source JSON Schema (_id 6a280d5cba225ef3a6bc07a6),
// captured this session via GET http://localhost:5001/api/v1/datasource (see 36-RESEARCH.md, B3).
// Used by the Corvus contract tests to validate against the exact schema shape that ships today.

namespace DataProcessing.Validation.Tests.Fixtures;

/// <summary>
/// Reference JSON Schema fixtures for the Phase 36 validation bug-fix tests.
/// The <see cref="Json"/> constant is the live <c>koko</c> schema verbatim: it requires a field
/// named <c>tararich</c> (transliteration of תאריך = "date") with <c>additionalProperties:false</c>,
/// which is the structural shape behind B3 (header <c>date</c> ≠ schema field <c>tararich</c>).
/// </summary>
public static class KokoSchema
{
    /// <summary>
    /// The live koko schema, verbatim. Object with id(integer), name(string,minLength:2),
    /// amount(number,minimum:0), tararich(string); required [id,name,amount,tararich];
    /// additionalProperties:false.
    /// </summary>
    public const string Json = """
    {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "name": { "type": "string", "minLength": 2 },
        "amount": { "type": "number", "minimum": 0 },
        "tararich": { "type": "string" }
      },
      "required": ["id", "name", "amount", "tararich"],
      "additionalProperties": false
    }
    """;
}

// CorvusOptionalFieldTests.cs - Phase 36-01, Bug B1 (RED / contract)
//
// Pins the B1 mechanism at the REAL Corvus.Json.Validator layer (the same entry point
// ValidationService.cs uses: JsonSchema.FromText(...).Validate(record, ValidationLevel.Detailed)).
// These are NOT a Newtonsoft re-implementation — they exercise the production validator.
//
// B1: an OPTIONAL field with no value must NOT raise a required / "missing data" error.
//   (1) BROKEN shape   — the defect generated today: optional field forced into required[]
//       + additionalProperties:false → an absent value yields a `required` failure.
//   (2) TARGET shape    — the contract the 36-05 frontend schema-gen fix MUST emit:
//       optional field is NOT in required[] and is empty-tolerant → absent AND present-empty
//       both validate as valid.
//
// No production code is modified. Method names carry the `B1` token so `--filter B1` selects them.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Corvus.Json;
using Corvus.Json.Validator;
using FluentAssertions;
using Xunit;

namespace DataProcessing.Validation.Tests.Services;

/// <summary>
/// Corvus contract tests for B1 (optional field, empty/absent must validate).
/// </summary>
public class CorvusOptionalFieldTests
{
    /// <summary>
    /// Runs the real Corvus validator over <paramref name="recordJson"/> using
    /// <paramref name="schemaText"/>, mirroring ValidationService.ValidateRecordsAsync.
    /// </summary>
    private static (bool IsValid, List<string> Errors) Validate(string schemaText, string recordJson)
    {
        // Corvus caches compiled validators by canonical URI. Derive the URI from a hash of the
        // schema text so distinct schemas never collide in the cache (identical text shares one
        // entry, different text gets its own) — mirrors ValidationService's unique per-source URI.
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(schemaText)));
        var schema = JsonSchema.FromText(schemaText, $"urn:phase36:b1:{hash}");
        using var doc = JsonDocument.Parse(recordJson);
        var context = schema.Validate(doc.RootElement, ValidationLevel.Detailed);

        var errors = new List<string>();
        if (!context.IsValid)
        {
            foreach (var result in context.Results)
            {
                errors.Add(result.ToString() ?? string.Empty);
            }
        }

        return (context.IsValid, errors);
    }

    // ----- (1) BROKEN shape: the "missing data" mechanism B1 must eliminate -----

    [Fact]
    public void B1_BrokenShape_OptionalFieldForcedRequired_AbsentValue_IsInvalidWithRequiredError()
    {
        // Schema as generated TODAY: `note` is (wrongly) in required[] and additionalProperties:false.
        const string brokenSchema = """
        {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "note": { "type": "string" }
          },
          "required": ["id", "note"],
          "additionalProperties": false
        }
        """;

        // Record where the optional column is genuinely absent.
        var (isValid, errors) = Validate(brokenSchema, """{ "id": 1 }""");

        isValid.Should().BeFalse(
            "the current generated schema forces an optional field into required[], so an absent value fails");
        string.Join(" | ", errors).ToLowerInvariant()
            .Should().MatchRegex("required")
            .And.Contain("note",
                "Corvus reports a `required` failure naming the `note` property — the B1 'missing data' verdict");
    }

    // ----- (2) TARGET shape: the contract the 36-05 fix must satisfy -----

    [Fact]
    public void B1_TargetShape_OptionalField_AbsentValue_IsValid()
    {
        // `note` NOT in required[] and modeled empty-tolerant (type: ["string","null"]).
        var (isValid, errors) = Validate(TargetOptionalSchema, """{ "id": 1 }""");

        isValid.Should().BeTrue(
            "an optional field that is absent must validate — this is the B1 target contract");
        errors.Should().BeEmpty();
    }

    [Fact]
    public void B1_TargetShape_OptionalField_PresentButEmptyString_IsValid()
    {
        // CsvToJsonConverter emits "" for an empty cell (present-but-empty, not absent).
        var (isValid, errors) = Validate(TargetOptionalSchema, """{ "id": 1, "note": "" }""");

        isValid.Should().BeTrue(
            "a present-but-empty optional value (CSV empty cell -> \"\") must validate — B1 target contract");
        errors.Should().BeEmpty();
    }

    [Fact]
    public void B1_TargetShape_OptionalField_PopulatedValue_IsValid()
    {
        // A populated optional value must keep passing — the fix only relaxes empty/absent.
        var (isValid, _) = Validate(TargetOptionalSchema, """{ "id": 1, "note": "hello" }""");

        isValid.Should().BeTrue("a populated optional value must remain valid");
    }

    /// <summary>
    /// The empty-tolerant TARGET shape for an optional field: only the genuinely-required
    /// field (id) is in required[]; the optional `note` accepts string OR null and has no
    /// emptiness constraint, so absent / "" / populated all validate.
    /// </summary>
    private const string TargetOptionalSchema = """
    {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "note": { "type": ["string", "null"] }
      },
      "required": ["id"],
      "additionalProperties": false
    }
    """;
}

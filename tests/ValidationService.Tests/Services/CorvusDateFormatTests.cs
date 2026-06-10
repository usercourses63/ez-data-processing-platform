// CorvusDateFormatTests.cs - Phase 36-01, Bug B2 (RED / contract)
//
// Pins the B2 mechanism at the REAL Corvus.Json.Validator layer (same entry point as
// ValidationService.cs: JsonSchema.FromText(...).Validate(record, ValidationLevel.Detailed)).
//
// B2: the auto date-format check must not fire on an EMPTY value when the field is OPTIONAL.
//   - Proves assumption A1: Corvus ASSERTS `format:date` (annotation is not the only behavior),
//     so an empty string "" fails the format check today.
//   - Populated valid dates must keep passing; invalid date strings must keep failing — the bug
//     is ONLY empty+optional.
//   - TARGET shape: an empty-tolerant optional date (anyOf empty-string OR format:date) makes
//     "" valid while a genuinely malformed date stays invalid — the contract 36-05 must emit.
//
// No production code is modified. Method names carry the `B2` token so `--filter B2` selects them.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Corvus.Json;
using Corvus.Json.Validator;
using FluentAssertions;
using Xunit;

namespace DataProcessing.Validation.Tests.Services;

/// <summary>
/// Corvus contract tests for B2 (optional date, empty value must validate; populated still checked).
/// </summary>
public class CorvusDateFormatTests
{
    /// <summary>
    /// Runs the real Corvus validator over <paramref name="recordJson"/> using
    /// <paramref name="schemaText"/>. The canonical URI is derived from a hash of the schema
    /// text so distinct schemas never collide in Corvus's compiled-validator cache.
    /// </summary>
    private static (bool IsValid, List<string> Errors) Validate(string schemaText, string recordJson)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(schemaText)));
        var schema = JsonSchema.FromText(schemaText, $"urn:phase36:b2:{hash}");
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

    // ----- (1) BROKEN shape: unconditional format:date asserts on empty (proves A1) -----

    /// <summary>
    /// The shape generated TODAY by schemaAutoSuggest: a field named `date` gets format:'date'
    /// with no allowance for empty/optional. required:[] keeps the field optional by presence,
    /// but the format assertion still fires on the present-but-empty "" value.
    /// </summary>
    private const string BrokenDateSchema = """
    {
      "type": "object",
      "properties": {
        "date": { "type": "string", "format": "date" }
      },
      "required": []
    }
    """;

    [Fact]
    public void B2_BrokenShape_FormatDate_EmptyString_IsInvalid_ProvesA1()
    {
        // Assumption A1: Corvus asserts `format` (not annotation-only) so "" fails format:date.
        var (isValid, errors) = Validate(BrokenDateSchema, """{ "date": "" }""");

        isValid.Should().BeFalse(
            "A1: Corvus ASSERTS format:date, so an empty string fails — this is the B2 mechanism");
        string.Join(" | ", errors).ToLowerInvariant()
            .Should().Contain("date",
                "the failure references the date/format keyword (matches InvalidRecordService's parser)");
    }

    [Fact]
    public void B2_BrokenShape_FormatDate_PopulatedValidDate_IsValid()
    {
        // Auto date-format is EXPECTED behavior for populated dates — must keep passing.
        var (isValid, _) = Validate(BrokenDateSchema, """{ "date": "2026-06-10" }""");

        isValid.Should().BeTrue("a populated ISO date must remain valid — the bug is only empty+optional");
    }

    [Fact]
    public void B2_BrokenShape_FormatDate_MalformedDate_IsInvalid()
    {
        // A genuinely malformed date must still fail — the fix must not disable date checking.
        var (isValid, _) = Validate(BrokenDateSchema, """{ "date": "not-a-date" }""");

        isValid.Should().BeFalse("a malformed date string must remain invalid");
    }

    // ----- (2) TARGET shape: empty-tolerant optional date (the 36-05 contract) -----

    /// <summary>
    /// Empty-tolerant optional date: accept either an empty string OR a well-formed date.
    /// "" validates; a populated valid date validates; a malformed date still fails.
    /// </summary>
    private const string TargetDateSchema = """
    {
      "type": "object",
      "properties": {
        "date": {
          "anyOf": [
            { "type": "string", "maxLength": 0 },
            { "type": "string", "format": "date" }
          ]
        }
      },
      "required": []
    }
    """;

    [Fact]
    public void B2_TargetShape_OptionalDate_EmptyString_IsValid()
    {
        var (isValid, errors) = Validate(TargetDateSchema, """{ "date": "" }""");

        isValid.Should().BeTrue("an empty optional date must validate — the B2 target contract");
        errors.Should().BeEmpty();
    }

    [Fact]
    public void B2_TargetShape_OptionalDate_PopulatedValidDate_IsValid()
    {
        var (isValid, _) = Validate(TargetDateSchema, """{ "date": "2026-06-10" }""");

        isValid.Should().BeTrue("a populated valid date must still validate under the target shape");
    }

    [Fact]
    public void B2_TargetShape_OptionalDate_MalformedDate_IsInvalid()
    {
        var (isValid, _) = Validate(TargetDateSchema, """{ "date": "not-a-date" }""");

        isValid.Should().BeFalse(
            "the empty-tolerant shape must still reject a malformed date — relaxing empty must not disable format");
    }
}

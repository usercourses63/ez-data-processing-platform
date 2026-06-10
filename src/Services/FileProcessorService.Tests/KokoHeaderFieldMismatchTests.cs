// KokoHeaderFieldMismatchTests.cs - Phase 36-03, Bug B3 (RED repro)
//
// Reproduces the CONFIRMED B3 structural root cause over the VERBATIM MinIO koko CSV bytes
// (Fixtures/koko-mvp-deploy-111138.csv: header `id,name,amount,date` + 3 rows) and the live
// koko JSON Schema (required:[id,name,amount,tararich], additionalProperties:false).
//
// Mechanism: the file HAS a header row, so CsvToJsonConverter (headed path,
// CsvToJsonConverter.cs:73-80) keys every record by the CSV's OWN header names
// (id,name,amount,date). SchemaPropertyNames is applied ONLY when headerless
// (FileDiscoveredEventConsumer.cs:497-504), so no header<->schema reconciliation happens.
// Each record becomes {id,name,amount,date}; validated against the koko schema this yields,
// per row, BOTH:
//   (1) `required` property `tararich` not present  -> B3's "tararich false-invalid"
//   (2) `date` is an unexpected property under additionalProperties:false
//
// These assertions pin the CURRENT broken behavior over the real bytes. NO production code is
// modified here. The 36-06 fix (rename schema field / header reconciliation) FLIPS this repro:
// after the fix the SAME bytes must convert to a `tararich`-bearing record and validate with
// 0 failures, at which point 36-06 updates these assertions to IsValid==true / contains tararich.
//
// Method names carry the `B3` token so `dotnet test --filter B3` selects them.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Corvus.Json;
using Corvus.Json.Validator;
using DataProcessing.Shared.Converters;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace FileProcessorService.Tests;

/// <summary>
/// B3 integration repro: headed koko CSV keyed by header <c>date</c> never maps to the schema's
/// required <c>tararich</c> field, so every row is invalid (required-missing + additionalProperties).
/// </summary>
public class KokoHeaderFieldMismatchTests
{
    // Verbatim copy of the LIVE koko schema (_id 6a280d5cba225ef3a6bc07a6), captured via
    // GET http://localhost:5001/api/v1/datasource (see 36-RESEARCH.md, B3). Copied literally so
    // this test project takes no dependency on ValidationService.Tests' KokoSchema fixture.
    private const string KokoSchemaJson = """
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

    private static readonly string FixturePath =
        Path.Combine(AppContext.BaseDirectory, "Fixtures", "koko-mvp-deploy-111138.csv");

    private static CsvToJsonConverter CreateConverter()
    {
        var logger = new Mock<ILogger<CsvToJsonConverter>>();
        return new CsvToJsonConverter(logger.Object);
    }

    /// <summary>
    /// Converts the verbatim koko fixture through the HEADED path (HasHeader:true), exactly as the
    /// pipeline does for this file, and returns the parsed records.
    /// </summary>
    private static async Task<List<Dictionary<string, JsonElement>>> ConvertFixtureAsync()
    {
        File.Exists(FixturePath).Should().BeTrue(
            $"the verbatim koko fixture must be copied to the test output at {FixturePath}");

        await using var stream = File.OpenRead(FixturePath);
        var metadata = new Dictionary<string, object> { ["HasHeader"] = true };

        var converter = CreateConverter();
        var json = await converter.ConvertToJsonAsync(stream, metadata);

        var records = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);
        records.Should().NotBeNull();
        return records!;
    }

    /// <summary>
    /// Runs the real Corvus validator (the same JsonSchema.FromText(...).Validate(..., Detailed)
    /// entry point ValidationService.cs uses) over a single record, returning validity + error text.
    /// </summary>
    private static (bool IsValid, List<string> Errors) Validate(string schemaText, string recordJson)
    {
        // Corvus caches compiled validators by canonical URI; derive a per-schema URI from a hash of
        // the text so distinct schemas never collide in the in-process cache.
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(schemaText)));
        var schema = JsonSchema.FromText(schemaText, $"urn:phase36:b3:{hash}");
        using var doc = JsonDocument.Parse(recordJson);
        var context = schema.Validate(doc.RootElement, ValidationLevel.Detailed);

        var errors = new List<string>();
        if (!context.IsValid)
        {
            foreach (var result in context.Results)
            {
                if (!result.Valid)
                {
                    errors.Add(result.ToString() ?? string.Empty);
                }
            }
        }

        return (context.IsValid, errors);
    }

    // ----- (1) Conversion proof: headed CSV keys by header `date`, never `tararich` -----

    [Fact]
    public async Task B3_HeadedKokoCsv_ConverterKeysByHeader_ProducesDateNotTararich()
    {
        var records = await ConvertFixtureAsync();

        records.Should().HaveCount(3, "the koko fixture has 3 data rows under its header");

        records.Should().AllSatisfy(record =>
        {
            record.Should().ContainKey("date",
                "headed CSV keys records by the file's OWN header (id,name,amount,date)");
            record.Should().NotContainKey("tararich",
                "SchemaPropertyNames is applied only when headerless, so the schema field name is never mapped");
        });
    }

    // ----- (2) Validation proof: every row invalid (required `tararich` + additional `date`) -----

    [Fact]
    public async Task B3_HeadedKokoCsv_AgainstKokoSchema_EachRowInvalid_RequiredTararichAndAdditionalDate()
    {
        var records = await ConvertFixtureAsync();

        foreach (var record in records)
        {
            var recordJson = JsonSerializer.Serialize(record);
            var (isValid, errors) = Validate(KokoSchemaJson, recordJson);

            isValid.Should().BeFalse(
                "the header `date` never satisfies the schema's required `tararich`, so the row is invalid (B3)");

            var combined = string.Join(" | ", errors).ToLowerInvariant();

            // Failure (1): required `tararich` missing — B3's "tararich false-invalid".
            combined.Should().Contain("required",
                "Corvus must report the missing required property as a `required` failure");
            combined.Should().Contain("tararich",
                "the required-missing failure must name `tararich` — the column exists, but as `date`");

            // Failure (2): `date` rejected by additionalProperties:false.
            combined.Should().Contain("date",
                "the unexpected `date` property must be flagged under additionalProperties:false");
            combined.Should().Contain("additionalproperties",
                "Corvus must report the unexpected `date` column as an additionalProperties violation");
        }
    }
}

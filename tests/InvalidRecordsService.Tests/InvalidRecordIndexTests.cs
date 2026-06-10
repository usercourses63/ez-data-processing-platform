// InvalidRecordIndexTests.cs — Phase 36-02, B4 LATENCY repro (missing Mongo indexes)
//
// CONTEXT (RESEARCH B4 Latency cause #2): there are NO MongoDB indexes on
// DataProcessingInvalidRecord — the entity declares none and InvalidRecordsService/Program.cs
// creates none. Every filter (DataSourceId / ErrorType) and the CreatedAt sort is therefore a
// full collection scan, compounding the in-memory full-load in GetPagedAsync.
//
// This test ENCODES the index contract that the 36-07 fix must satisfy. MongoDB.Entities exposes
// index creation fluently (DB.Index<T>().Key(x => x.Field, ...).CreateAsync()), typically wired in
// Program.cs / a startup init, so the contract is asserted by source-scanning the service for those
// registrations (there is no [Index] attribute API in MongoDB.Entities to reflect over).
//
// It is RED today: none of the four required index key sets are declared. After 36-07 adds the
// index registrations this flips green. The test stays fully offline-runnable (pure source scan,
// no live cluster); if the repository source cannot be located it SKIPS rather than false-passing.

using FluentAssertions;
using Xunit;

namespace InvalidRecordsService.Tests.Repositories;

[Trait("Area", "InvalidRecords")]
[Trait("Bug", "B4")]
[Trait("Concern", "Index")]
public class InvalidRecordIndexTests
{
    // The four index key sets the InvalidRecords latency fix must declare on
    // DataProcessingInvalidRecord (RESEARCH B4: filter keys + the common filter+sort compound).
    private static readonly (string Name, string[] Keys)[] RequiredIndexes =
    {
        ("DataSourceId",                 new[] { "DataSourceId" }),
        ("CreatedAt",                    new[] { "CreatedAt" }),
        ("ErrorType",                    new[] { "ErrorType" }),
        ("IsIgnored+IsDeleted+CreatedAt", new[] { "IsIgnored", "IsDeleted", "CreatedAt" }),
    };

    [SkippableFact]
    [Trait("Priority", "P1")]
    public void RequiredMongoIndexes_ForInvalidRecords_AreDeclared()
    {
        var source = ReadInvalidRecordsServiceSourceOrSkip();

        var missing = RequiredIndexes
            .Where(idx => !DeclaresIndex(source, idx.Keys))
            .Select(idx => idx.Name)
            .ToList();

        missing.Should().BeEmpty(
            "B4 latency (RESEARCH cause #2) requires Mongo indexes on DataProcessingInvalidRecord; " +
            "36-07 must register DB.Index<DataProcessingInvalidRecord>().Key(...) for each of the four " +
            "key sets {DataSourceId},{CreatedAt},{ErrorType},{IsIgnored,IsDeleted,CreatedAt}. " +
            "These are absent today (RED before the fix). Missing: " + string.Join(", ", missing));
    }

    /// <summary>
    /// An index for the given key set is considered declared when the service source contains a
    /// MongoDB.Entities index registration for the entity AND every key field appears inside a
    /// .Key(...) call. (Tolerant of lambda variable naming.)
    /// </summary>
    private static bool DeclaresIndex(string source, string[] keyFields)
    {
        if (!source.Contains("DB.Index<DataProcessingInvalidRecord>", StringComparison.OrdinalIgnoreCase))
            return false;

        // Every field of the key set must be referenced inside a `.Key( ... <Field> ... )` segment.
        return keyFields.All(field =>
            System.Text.RegularExpressions.Regex.IsMatch(
                source,
                $@"\.Key\([^)]*\b{System.Text.RegularExpressions.Regex.Escape(field)}\b"));
    }

    private static string ReadInvalidRecordsServiceSourceOrSkip()
    {
        var root = FindRepoRoot();
        Skip.If(root is null, "Could not locate repo root (DataProcessingPlatform.sln) to source-scan for indexes.");

        var serviceDir = Path.Combine(root!, "src", "Services", "InvalidRecordsService");
        Skip.IfNot(Directory.Exists(serviceDir), $"InvalidRecordsService source not found at {serviceDir}.");

        // Concatenate all service .cs (Program.cs + repositories + any index-init files) plus the
        // shared entity, so the fix may declare indexes via attributes/startup in any of them.
        var sources = new List<string>();
        foreach (var file in Directory.EnumerateFiles(serviceDir, "*.cs", SearchOption.AllDirectories))
        {
            if (file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") ||
                file.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
                continue;
            sources.Add(File.ReadAllText(file));
        }

        var entityFile = Path.Combine(root!, "src", "Services", "Shared", "Entities", "DataProcessingInvalidRecord.cs");
        if (File.Exists(entityFile))
            sources.Add(File.ReadAllText(entityFile));

        return string.Join("\n", sources);
    }

    private static string? FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "DataProcessingPlatform.sln")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return null;
    }
}

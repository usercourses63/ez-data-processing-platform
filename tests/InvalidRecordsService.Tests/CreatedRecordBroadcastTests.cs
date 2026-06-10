// CreatedRecordBroadcastTests.cs — Phase 36-02, B4 MISSING-ROWS repro (no EntityChanged on create)
//
// CONTEXT (RESEARCH B4 missing-rows cause #1): when the validation pipeline creates invalid records
// it writes them via `invalidRecords.SaveAsync()` (ValidationService.cs:302-308) WITHOUT broadcasting
// a SignalR `EntityChanged`. InvalidRecordsHub (Hubs/InvalidRecordsHub.cs) only implements
// OnConnectedAsync and broadcasts nothing. Yet the page subscribes for
// `entity-changed` where entityType==='InvalidRecord' (InvalidRecordsManagement.tsx:351-362), so
// freshly produced invalid records never appear until a manual reload. Per CLAUDE.md the
// `EntityChanged` broadcast is MANDATORY on all CRUD — the validation write path violates it.
//
// This encodes the broadcast contract the 36-08 fix must satisfy: creating an invalid record must
// emit EntityChanged with EntityType=="InvalidRecord" and Action=="created" (whether broadcast
// directly from the validation write path or relayed via a consumer into InvalidRecordsHub).
//
// The production seam does NOT exist yet, so — per the plan — we DO NOT compile-link against a
// missing member. Instead the RED test SOURCE-SCANS the candidate write/relay paths for the
// EntityChanged emission; it fails today and flips green once 36-08 wires the seam. A second Fact
// documents the exact payload contract and always runs.

using FluentAssertions;
using Xunit;

namespace InvalidRecordsService.Tests.Hubs;

[Trait("Area", "InvalidRecords")]
[Trait("Bug", "B4")]
[Trait("Concern", "Broadcast")]
public class CreatedRecordBroadcastTests
{
    private const string ExpectedEntityType = "InvalidRecord";
    private const string ExpectedAction = "created";
    private const string SignalRMethod = "EntityChanged";

    /// <summary>
    /// Documents the exact SignalR payload contract the frontend listens for
    /// (InvalidRecordsManagement.tsx: entityType==='InvalidRecord'). Always runs.
    /// </summary>
    [Fact]
    [Trait("Priority", "P2")]
    public void BroadcastContract_OnInvalidRecordCreate_NamesEntityTypeInvalidRecordAndActionCreated()
    {
        SignalRMethod.Should().Be("EntityChanged", "CLAUDE.md mandates the EntityChanged SignalR method on CRUD");
        ExpectedEntityType.Should().Be("InvalidRecord", "the frontend filters entity-changed on entityType==='InvalidRecord'");
        ExpectedAction.Should().Be("created", "a newly produced invalid record is a 'created' action");
    }

    /// <summary>
    /// RED until 36-08: asserts a broadcast seam exists that emits EntityChanged with
    /// EntityType=InvalidRecord / Action=created when the pipeline creates invalid records. The seam
    /// may live in the validation write path or in an InvalidRecordsService relay/consumer into the
    /// hub — both locations are scanned. Absent today, so this fails (B4 missing-rows is unfixed).
    /// </summary>
    [SkippableFact]
    [Trait("Priority", "P1")]
    public void InvalidRecordCreate_MustBroadcastEntityChanged_RedUntil_36_08()
    {
        var source = ReadBroadcastCandidateSourcesOrSkip();

        var hasEntityChanged = source.Contains(SignalRMethod, StringComparison.Ordinal);
        var namesInvalidRecordEntity = System.Text.RegularExpressions.Regex.IsMatch(
            source, $@"EntityType\s*=\s*""{ExpectedEntityType}""");
        var namesCreatedAction = System.Text.RegularExpressions.Regex.IsMatch(
            source, $@"Action\s*=\s*""{ExpectedAction}""");

        var hasBroadcastSeam = hasEntityChanged && namesInvalidRecordEntity && namesCreatedAction;

        hasBroadcastSeam.Should().BeTrue(
            "B4 missing-rows (RESEARCH cause #1) + the CLAUDE.md CRUD mandate require that creating an " +
            "invalid record broadcasts SignalR EntityChanged{EntityType=\"InvalidRecord\",Action=\"created\"} " +
            "(from the validation write path or an InvalidRecordsService relay into InvalidRecordsHub). " +
            "No such seam exists today — RED before 36-08. " +
            $"(EntityChanged present={hasEntityChanged}, EntityType=InvalidRecord present={namesInvalidRecordEntity}, " +
            $"Action=created present={namesCreatedAction}.)");
    }

    /// <summary>
    /// Reads the candidate write/relay sources: the whole InvalidRecordsService tree (hub + any future
    /// relay consumer/broadcaster) plus the ValidationService write path file. Skips if sources can't
    /// be located rather than false-passing.
    /// </summary>
    private static string ReadBroadcastCandidateSourcesOrSkip()
    {
        var root = FindRepoRoot();
        Skip.If(root is null, "Could not locate repo root (DataProcessingPlatform.sln) to source-scan for the broadcast seam.");

        var sources = new List<string>();

        var invalidRecordsDir = Path.Combine(root!, "src", "Services", "InvalidRecordsService");
        if (Directory.Exists(invalidRecordsDir))
        {
            foreach (var file in Directory.EnumerateFiles(invalidRecordsDir, "*.cs", SearchOption.AllDirectories))
            {
                if (file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") ||
                    file.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
                    continue;
                sources.Add(File.ReadAllText(file));
            }
        }

        var validationWritePath = Path.Combine(
            root!, "src", "Services", "ValidationService", "Services", "ValidationService.cs");
        if (File.Exists(validationWritePath))
            sources.Add(File.ReadAllText(validationWritePath));

        Skip.If(sources.Count == 0, "No candidate broadcast sources found to scan.");

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

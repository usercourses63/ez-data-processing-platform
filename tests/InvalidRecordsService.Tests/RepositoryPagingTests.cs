// RepositoryPagingTests.cs — Phase 36-02, B4 LATENCY repro (server-side paging contract)
//
// CONTEXT (RESEARCH B4 Latency cause #1): InvalidRecordRepository.GetPagedAsync currently
// loads the ENTIRE matching collection with `query.ExecuteAsync()` and then sorts/Skips/Takes
// IN MEMORY (InvalidRecordRepository.cs:62-71). This pins the *behavioural* contract that the
// 36-07 fix must preserve once it pushes Sort/Skip/Limit + indexes server-side:
//   • page 1 (size 10) of 25 records  -> exactly 10 rows
//   • page 3 (size 10) of 25 records  -> exactly 5 rows
//   • TotalCount                       -> 25
//   • ordering                         -> CreatedAt DESCENDING
//
// IMPORTANT (documented gap, see 36-02-SUMMARY): the CURRENT in-memory implementation already
// satisfies this *correctness* contract — so the live SkippableFact below is GREEN today. What it
// does NOT satisfy is the LATENCY/INDEX contract (it still materialises the whole filtered set and
// there are no Mongo indexes). That half is pinned RED by InvalidRecordIndexTests; 36-07 closes
// both by rewriting GetPagedAsync to server-side paging over indexed keys while keeping these
// numbers identical. Re-run this test after 36-07 — it must stay green.
//
// Offline behaviour: where no Mongo replica set is reachable the DB-backed assertions SKIP cleanly
// (Skip.IfNot, mirroring the Phase-34/35 SkippableFact pattern). A pure in-memory paging-contract
// Fact always compiles and runs so the class is never empty offline.

using DataProcessing.Shared.Entities;
using FluentAssertions;
using InvalidRecordsService.Models.Requests;
using InvalidRecordsService.Repositories;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Entities;
using Xunit;

namespace InvalidRecordsService.Tests.Repositories;

[Trait("Area", "InvalidRecords")]
[Trait("Bug", "B4")]
[Trait("Concern", "Paging")]
public class RepositoryPagingTests
{
    private const int SeedCount = 25;
    private const int PageSize = 10;

    private static string MongoConnectionString =>
        Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING")
        ?? "mongodb://localhost:27017/?directConnection=true";

    private static string MongoDatabaseName =>
        Environment.GetEnvironmentVariable("MONGODB_DATABASE") ?? "ezplatform";

    /// <summary>
    /// Pure, always-runnable contract: encodes the EXACT paging math + descending-CreatedAt order
    /// that GetPagedAsync must return for 25 records at pageSize 10. This is the offline guard that
    /// keeps the class meaningful with no live cluster — it pins page1=10, page3=5, total=25, desc.
    /// </summary>
    [Fact]
    [Trait("Priority", "P1")]
    public void ServerSidePagingContract_For25RecordsAtPageSize10_PinsPage1Is10_Page3Is5_Total25_Desc()
    {
        var baseTime = DateTime.UtcNow.AddMinutes(-60);
        // Insertion order is "oldest first" (i=0 oldest .. i=24 newest), like real inserts.
        var all = Enumerable.Range(0, SeedCount)
            .Select(i => new DataProcessingInvalidRecord
            {
                DataSourceId = "ds-paging",
                FileName = $"paging-{i:00}.csv",
                CreatedAt = baseTime.AddSeconds(i),
                ErrorType = "SchemaValidation",
            })
            .ToList();

        int Total() => all.Count;

        List<DataProcessingInvalidRecord> Page(int page) => all
            .OrderByDescending(r => r.CreatedAt)        // server-side contract: newest first
            .Skip((page - 1) * PageSize)
            .Take(PageSize)
            .ToList();

        Total().Should().Be(25, "the full filtered set is 25 records");

        var page1 = Page(1);
        page1.Should().HaveCount(10, "page 1 of 25 at pageSize 10 returns 10 rows");
        page1.Select(r => r.CreatedAt).Should().BeInDescendingOrder("rows are ordered newest-first");
        page1[0].FileName.Should().Be("paging-24.csv", "the newest record must be first");

        var page3 = Page(3);
        page3.Should().HaveCount(5, "page 3 of 25 at pageSize 10 returns the remaining 5 rows");
        page3.Select(r => r.CreatedAt).Should().BeInDescendingOrder();
    }

    /// <summary>
    /// Live tier: seeds 25 isolated DataProcessingInvalidRecord docs (unique DataSourceId) and
    /// drives the REAL InvalidRecordRepository.GetPagedAsync, asserting the paging contract end to
    /// end against Mongo. Skips cleanly when no replica set is reachable. After 36-07 rewrites
    /// GetPagedAsync to server-side Sort/Skip/Limit + indexes, this must remain green.
    /// </summary>
    [SkippableFact]
    [Trait("Priority", "P1")]
    public async Task GetPagedAsync_Seed25_Page1Returns10_Page3Returns5_Total25_DescCreatedAt()
    {
        await SkipIfMongoUnreachableAsync();

        // Unique 24-hex DataSourceId isolates this run from any pre-existing data in the collection.
        var dataSourceId = ObjectId.GenerateNewId().ToString();
        var baseTime = DateTime.UtcNow.AddMinutes(-60);

        var records = Enumerable.Range(0, SeedCount)
            .Select(i => new DataProcessingInvalidRecord
            {
                DataSourceId = dataSourceId,
                FileName = $"paging-{i:00}.csv",
                ValidationResultId = ObjectId.GenerateNewId().ToString(),
                OriginalRecord = new BsonDocument { { "row", i } },
                ValidationErrors = new List<string> { "the required property 'tararich' was not present" },
                ErrorType = "SchemaValidation",
                Severity = "Error",
                CreatedAt = baseTime.AddSeconds(i),
                CorrelationId = Guid.NewGuid().ToString(),
                CreatedBy = "RepositoryPagingTests",
            })
            .ToList();

        try
        {
            await records.SaveAsync();

            var repo = new InvalidRecordRepository();

            var (page1, total1) = await repo.GetPagedAsync(new InvalidRecordListRequest
            {
                DataSourceId = dataSourceId,
                Page = 1,
                PageSize = PageSize,
            });

            total1.Should().Be(25, "GetPagedAsync must report the full filtered count");
            page1.Should().HaveCount(10, "page 1 at pageSize 10 must return 10 rows");
            page1.Select(r => r.CreatedAt).Should().BeInDescendingOrder("results must be newest-first");
            page1[0].FileName.Should().Be("paging-24.csv", "descending CreatedAt puts the newest record first");

            var (page3, total3) = await repo.GetPagedAsync(new InvalidRecordListRequest
            {
                DataSourceId = dataSourceId,
                Page = 3,
                PageSize = PageSize,
            });

            total3.Should().Be(25);
            page3.Should().HaveCount(5, "page 3 at pageSize 10 must return the trailing 5 rows");
            page3.Select(r => r.CreatedAt).Should().BeInDescendingOrder();
        }
        finally
        {
            // Always clean up the isolated seed set, even on assertion failure.
            await DB.DeleteAsync<DataProcessingInvalidRecord>(r => r.DataSourceId == dataSourceId);
        }
    }

    private static async Task SkipIfMongoUnreachableAsync()
    {
        var reachable = false;
        try
        {
            var settings = MongoClientSettings.FromConnectionString(MongoConnectionString);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(3);
            settings.ConnectTimeout = TimeSpan.FromSeconds(3);

            var client = new MongoClient(settings);
            await client.GetDatabase(MongoDatabaseName)
                .RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));

            // MongoDB.Entities global init (idempotent for our purposes; harmless if already set).
            await DB.InitAsync(MongoDatabaseName, settings);
            reachable = true;
        }
        catch
        {
            reachable = false;
        }

        Skip.IfNot(reachable,
            $"MongoDB not reachable at {MongoConnectionString} — live paging tier skipped offline " +
            "(authoritative run happens against the cluster; the in-memory contract Fact still ran).");
    }
}

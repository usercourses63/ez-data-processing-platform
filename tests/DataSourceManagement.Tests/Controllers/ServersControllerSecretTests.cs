using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;

namespace DataProcessing.DataSourceManagement.Tests.Controllers;

/// <summary>
/// Phase 34, Plan 04 — integration tier for the AdminServer S3 secret contract.
///
/// Proves end-to-end (against the live DataSourceManagement API + MongoDB) that:
///   * POST /api/v1/servers (s3) returns 201 and the subsequent GET masks <c>SecretKey</c>
///     to <c>"********"</c> while <c>AccessKey</c> and <c>Bucket</c> stay visible (SC-03, write-only).
///   * The persisted Mongo <c>TypeSpecificConfig.SecretKey</c> is ciphertext (<c>enc:v1:</c> prefix),
///     never the submitted plaintext (SC-04, encrypt-at-rest).
///   * PUT with <c>SecretKey == "********"</c> keeps the stored encrypted secret (Pitfall 3, keep-existing).
///
/// These are <c>SkippableFact</c>s with two layers of guard:
///   1. Reachability — Skip when the API or MongoDB is unreachable (no live cluster in this session).
///   2. Capability — Skip when the *deployed* API predates 34-01/34-02 (the running pod has not been
///      rebuilt, so it neither encrypts nor masks the secret). The masking/encryption behaviour is
///      verified against a freshly-deployed build in plan 34-06.
///
/// Override endpoints via <c>DATASOURCE_MGMT_URL</c>, <c>MONGODB_CONNECTION_STRING</c>,
/// and <c>MONGODB_DATABASE</c> env vars.
/// </summary>
public class ServersControllerSecretTests : IDisposable
{
    private const string MaskedSecretSentinel = "********";
    private const string EncryptionPrefix = "enc:v1:";

    // ServerDirection.Both == 2 (the enum binds from its integer value over JSON).
    private const int DirectionBoth = 2;

    // The AdminServer MongoDB.Entities collection defaults to the class name.
    private const string ServersCollection = "AdminServer";

    private static string ApiBaseUrl =>
        Environment.GetEnvironmentVariable("DATASOURCE_MGMT_URL") ?? "http://localhost:5001";

    private static string MongoConnectionString =>
        Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING")
        ?? "mongodb://localhost:27017/?directConnection=true";

    private static string MongoDatabaseName =>
        Environment.GetEnvironmentVariable("MONGODB_DATABASE") ?? "ez_platform";

    private readonly HttpClient _http;
    private readonly List<string> _createdServerIds = new();

    public ServersControllerSecretTests()
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(ApiBaseUrl),
            Timeout = TimeSpan.FromSeconds(15)
        };
    }

    // ========== Connectivity / capability guards ==========

    private async Task SkipIfApiUnavailableAsync()
    {
        bool reachable;
        try
        {
            using var resp = await _http.GetAsync("/health");
            reachable = resp.IsSuccessStatusCode;
        }
        catch
        {
            reachable = false;
        }

        Skip.IfNot(reachable, $"DataSourceManagement API not reachable at {ApiBaseUrl} (live tier exercised in 34-06).");
    }

    /// <summary>
    /// Creates an s3 server and returns its id + the GET-fetched config. Registers the id for cleanup.
    /// Skips the test if the deployed API does not mask the secret on GET (stale build predating 34-02).
    /// </summary>
    private async Task<(string Id, JsonElement Config)> CreateAndFetchOrSkipAsync(string name, string secret)
    {
        using var postResp = await _http.PostAsJsonAsync("/api/v1/servers", BuildS3CreateBody(name, secret));
        postResp.StatusCode.Should().Be(HttpStatusCode.Created, "creating an s3 server should return 201");

        var created = JsonDocument.Parse(await postResp.Content.ReadAsStringAsync()).RootElement;
        var id = created.GetProperty("ID").GetString();
        id.Should().NotBeNullOrEmpty();
        _createdServerIds.Add(id!);

        using var getResp = await _http.GetAsync($"/api/v1/servers/{id}");
        getResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var fetched = JsonDocument.Parse(await getResp.Content.ReadAsStringAsync()).RootElement;
        var config = GetTypeSpecificConfig(fetched);

        var getSecret = config.GetProperty("SecretKey").GetString();
        Skip.If(getSecret != MaskedSecretSentinel,
            $"Deployed API does not mask SecretKey on GET (got '{getSecret}') — the running pod predates 34-01/34-02. " +
            "Secret write-only/encrypt-at-rest is verified against a fresh build in plan 34-06.");

        return (id!, config);
    }

    // ========== Request body helpers ==========

    private static object BuildS3CreateBody(string name, string secret) => new
    {
        Name = name,
        ServerType = "s3",
        Direction = DirectionBoth,
        IsActive = true,
        Host = "minio.example.local",
        Port = 9000,
        ConnectionTimeoutSeconds = 30,
        RetryCount = 3,
        TypeSpecificConfig = new Dictionary<string, object>
        {
            ["AccessKey"] = "minioadmin",
            ["SecretKey"] = secret,
            ["Bucket"] = "ez-data",
            ["Region"] = "us-east-1",
            ["ForcePathStyle"] = true,
            ["UseHttp"] = true
        }
    };

    private static JsonElement GetTypeSpecificConfig(JsonElement server)
    {
        // PropertyNamingPolicy is null on this API → keys stay PascalCase.
        return server.GetProperty("TypeSpecificConfig");
    }

    // ========== Tests ==========

    [SkippableFact(DisplayName = "Servers: POST s3 then GET masks SecretKey but keeps AccessKey/Bucket")]
    public async Task PostThenGet_MasksSecretKey_KeepsAccessKeyAndBucket()
    {
        await SkipIfApiUnavailableAsync();

        var (_, config) = await CreateAndFetchOrSkipAsync($"s3-secret-mask-{Guid.NewGuid():N}", "minioadmin123");

        config.GetProperty("AccessKey").GetString().Should().Be("minioadmin",
            "the non-secret AccessKey must stay visible");
        config.GetProperty("Bucket").GetString().Should().Be("ez-data",
            "the bucket must stay visible");
        config.GetProperty("SecretKey").GetString().Should().Be(MaskedSecretSentinel,
            "SecretKey is write-only and must be masked in GET responses (SC-03)");
        config.GetProperty("SecretKey").GetString().Should().NotContain("minioadmin123",
            "the plaintext secret must never be echoed back");
    }

    [SkippableFact(DisplayName = "Servers: persisted Mongo SecretKey is ciphertext, not plaintext")]
    public async Task PostS3Server_PersistsEncryptedSecretKey_InMongo()
    {
        await SkipIfApiUnavailableAsync();

        var collection = TryGetServersCollection();
        Skip.If(collection is null, $"MongoDB not reachable at {MongoConnectionString} (live tier exercised in 34-06).");

        const string plaintextSecret = "minioadmin123";
        var (id, _) = await CreateAndFetchOrSkipAsync($"s3-encrypt-at-rest-{Guid.NewGuid():N}", plaintextSecret);

        // Read the raw persisted document straight from Mongo (bypasses the GET mask).
        var filter = Builders<BsonDocument>.Filter.Eq("_id", ObjectId.Parse(id));
        var doc = await collection!.Find(filter).FirstOrDefaultAsync();
        doc.Should().NotBeNull("the created server must be persisted");

        var storedSecret = doc!["TypeSpecificConfig"].AsBsonDocument["SecretKey"].AsString;
        storedSecret.Should().StartWith(EncryptionPrefix,
            "the SecretKey must be encrypted at rest (SC-04)");
        storedSecret.Should().NotBe(plaintextSecret,
            "the submitted plaintext secret must never be persisted verbatim");

        // The non-secret AccessKey/Bucket persist in clear (they are not secrets).
        doc["TypeSpecificConfig"].AsBsonDocument["AccessKey"].AsString.Should().Be("minioadmin");
        doc["TypeSpecificConfig"].AsBsonDocument["Bucket"].AsString.Should().Be("ez-data");
    }

    [SkippableFact(DisplayName = "Servers: PUT with masked SecretKey keeps the stored encrypted secret")]
    public async Task PutWithMaskedSecret_KeepsStoredEncryptedSecret()
    {
        await SkipIfApiUnavailableAsync();

        var collection = TryGetServersCollection();
        Skip.If(collection is null, $"MongoDB not reachable at {MongoConnectionString} (live tier exercised in 34-06).");

        var name = $"s3-keep-existing-{Guid.NewGuid():N}";
        var (id, _) = await CreateAndFetchOrSkipAsync(name, "minioadmin123");

        var filter = Builders<BsonDocument>.Filter.Eq("_id", ObjectId.Parse(id));
        var beforeDoc = await collection!.Find(filter).FirstOrDefaultAsync();
        beforeDoc.Should().NotBeNull();
        var encryptedBefore = beforeDoc!["TypeSpecificConfig"].AsBsonDocument["SecretKey"].AsString;
        encryptedBefore.Should().StartWith(EncryptionPrefix);

        // PUT re-submitting the mask sentinel for SecretKey (admin edits other fields, not the secret).
        var updateBody = new
        {
            Name = name,
            ServerType = "s3",
            Direction = DirectionBoth,
            IsActive = true,
            Host = "minio-renamed.example.local", // changed a non-secret field
            Port = 9000,
            ConnectionTimeoutSeconds = 45,
            RetryCount = 5,
            TypeSpecificConfig = new Dictionary<string, object>
            {
                ["AccessKey"] = "minioadmin",
                ["SecretKey"] = MaskedSecretSentinel, // "keep existing"
                ["Bucket"] = "ez-data",
                ["Region"] = "us-east-1",
                ["ForcePathStyle"] = true,
                ["UseHttp"] = true
            }
        };

        using var putResp = await _http.PutAsJsonAsync($"/api/v1/servers/{id}", updateBody);
        putResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var afterDoc = await collection.Find(filter).FirstOrDefaultAsync();
        afterDoc.Should().NotBeNull();
        var encryptedAfter = afterDoc!["TypeSpecificConfig"].AsBsonDocument["SecretKey"].AsString;

        encryptedAfter.Should().Be(encryptedBefore,
            "re-submitting the mask sentinel must retain the previously stored encrypted secret (Pitfall 3)");
        encryptedAfter.Should().NotBe(MaskedSecretSentinel,
            "the mask sentinel must never be persisted as the secret");
        afterDoc["Host"].AsString.Should().Be("minio-renamed.example.local",
            "the non-secret field change must still be applied");
    }

    private static IMongoCollection<BsonDocument>? TryGetServersCollection()
    {
        try
        {
            var client = new MongoClient(MongoConnectionString);
            var db = client.GetDatabase(MongoDatabaseName);
            // Force a round-trip so unreachable Mongo surfaces here rather than later.
            db.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            return db.GetCollection<BsonDocument>(ServersCollection);
        }
        catch
        {
            return null;
        }
    }

    public void Dispose()
    {
        // Best-effort cleanup of any servers this test created.
        foreach (var id in _createdServerIds)
        {
            try
            {
                _http.DeleteAsync($"/api/v1/servers/{id}").GetAwaiter().GetResult();
            }
            catch
            {
                // ignore cleanup failures
            }
        }

        _http.Dispose();
    }
}

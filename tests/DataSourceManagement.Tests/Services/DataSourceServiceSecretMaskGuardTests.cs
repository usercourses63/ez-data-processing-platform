using System.Diagnostics.Metrics;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Repositories;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Services;
using FluentAssertions;
using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Moq;
using Xunit;

namespace DataProcessing.DataSourceManagement.Tests.Services;

/// <summary>
/// Regression tests for the secret-mask guard in <see cref="DataSourceService"/>'s S3 credential
/// bridges (both the INPUT bridge <c>PopulateFileServerConnectionAsync</c> and the OUTPUT-destination
/// bridge).
///
/// Root cause guarded against: the GET API returns a stored secret as the masked sentinel
/// <c>********</c>. If that masked value ever reaches a bridge, the bridge must NOT persist it as the
/// real credential — doing so silently breaks the FileDiscovery/connector S3 auth with
/// <c>SignatureDoesNotMatch</c> while the UI "test connection" (which uses the server creds via a
/// different path / GetBucketLocation, always signed us-east-1) keeps passing. The guard treats the
/// mask (and empty) as "keep the existing secret", mirroring
/// <c>ServerService.UpdateServerAsync</c>.
///
/// Pure unit tests: repository echoes back the persisted entity (so the post-bridge result is
/// observable); a REAL <see cref="ServerCredentialProtector"/> exercises the decrypt path so a
/// genuinely-encrypted secret still bridges (the guard must not break the happy path).
/// </summary>
public class DataSourceServiceSecretMaskGuardTests
{
    private const string CorrelationId = "test-corr-id";
    private const string MaskSentinel = "********"; // ServersController.MaskedSecretSentinel (internal)

    private readonly Mock<IDataSourceRepository> _repository = new();
    private readonly Mock<IPublishEndpoint> _publishEndpoint = new();
    private readonly Mock<INasDeviceService> _nasDeviceService = new();
    private readonly Mock<IServerService> _serverService = new();
    private readonly ServerCredentialProtector _protector;

    public DataSourceServiceSecretMaskGuardTests()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [ServerCredentialProtector.ConfigKey] = "unit-test-field-encryption-key"
            })
            .Build();
        _protector = new ServerCredentialProtector(
            configuration, NullLogger<ServerCredentialProtector>.Instance);

        _repository
            .Setup(r => r.CreateAsync(It.IsAny<DataProcessingDataSource>(), It.IsAny<string>()))
            .ReturnsAsync((DataProcessingDataSource ds, string _) => ds);
    }

    private DataSourceService CreateSut() => new(
        _repository.Object,
        NullLogger<DataSourceService>.Instance,
        new BusinessMetrics(new Meter("DataSourceServiceSecretMaskGuardTests")),
        _publishEndpoint.Object,
        _nasDeviceService.Object,
        _serverService.Object,
        _protector);

    /// <param name="secretKeyValue">stored verbatim — pass the literal mask to simulate a corrupted/masked server secret.</param>
    private AdminServer BuildS3Server(string id, string secretKeyValue) => new()
    {
        ID = id,
        Name = "MinIO Server",
        ServerType = "s3",
        Host = "minio.file-simulator",
        Port = 30900,
        IsActive = true,
        TypeSpecificConfig = new BsonDocument
        {
            { "AccessKey", "minioadmin" },
            { "SecretKey", secretKeyValue },
            { "Bucket", "ez-phase34-input" },
            { "Region", "us-east-1" },
            { "ForcePathStyle", true },
            { "UseHttp", true }
        }
    };

    private static string? StoredSecret(DataProcessingDataSource ds)
        => ds.AdditionalConfiguration != null && ds.AdditionalConfiguration.Contains("secretKey")
            ? ds.AdditionalConfiguration["secretKey"].AsString
            : null;

    private static CreateDataSourceRequest BuildRequestWithInputServer(string inputServerId) => new()
    {
        Name = "S3 Input DS",
        SupplierName = "ACME",
        Category = "Sales",
        ConfigurationSettings = $"{{\"connectionConfig\":{{\"inputServerId\":\"{inputServerId}\"}}}}"
    };

    [Fact]
    public async Task InputBridge_MaskedServerSecret_IsNotPersistedAsEmbeddedSecret()
    {
        const string serverId = "srv-in-mask";
        // Server secret resolves to the mask sentinel (not a valid protected blob).
        _serverService
            .Setup(s => s.GetServerByIdAsync(serverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildS3Server(serverId, MaskSentinel));

        var sut = CreateSut();
        var result = await sut.CreateAsync(BuildRequestWithInputServer(serverId), CorrelationId);

        result.IsSuccess.Should().BeTrue();
        StoredSecret(result.Data!).Should().NotBe(
            MaskSentinel,
            "the masked sentinel must never be persisted into AdditionalConfiguration.secretKey " +
            "(that is the bug that broke discovery S3 auth)");
    }

    [Fact]
    public async Task InputBridge_RealEncryptedServerSecret_IsBridgedDecrypted()
    {
        const string serverId = "srv-in-real";
        const string plaintext = "minioadmin123";
        _serverService
            .Setup(s => s.GetServerByIdAsync(serverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildS3Server(serverId, _protector.Protect(plaintext)));

        var sut = CreateSut();
        var result = await sut.CreateAsync(BuildRequestWithInputServer(serverId), CorrelationId);

        result.IsSuccess.Should().BeTrue();
        StoredSecret(result.Data!).Should().Be(
            plaintext, "a genuine encrypted server secret must still bridge decrypted (guard must not break the happy path)");
    }

    [Fact]
    public async Task OutputBridge_MaskedServerSecret_IsNotPersistedAsS3Secret()
    {
        const string serverId = "srv-out-mask";
        _serverService
            .Setup(s => s.GetServerByIdAsync(serverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildS3Server(serverId, MaskSentinel));

        var request = new CreateDataSourceRequest
        {
            Name = "S3 Output DS",
            SupplierName = "ACME",
            Category = "Sales",
            Output = new OutputConfiguration
            {
                Destinations = new List<OutputDestination>
                {
                    new()
                    {
                        Id = "dest-s3",
                        Name = "MinIO Output",
                        Type = "s3",
                        Enabled = true,
                        OutputServerId = serverId,
                        S3Config = new S3OutputConfig { Bucket = "ez-phase34-output" }
                    }
                }
            }
        };

        var sut = CreateSut();
        var result = await sut.CreateAsync(request, CorrelationId);

        result.IsSuccess.Should().BeTrue();
        var s3 = result.Data!.Output.Destinations[0].S3Config;
        s3.Should().NotBeNull();
        s3!.SecretAccessKey.Should().NotBe(
            MaskSentinel, "the masked sentinel must never be persisted as the output S3 secret");
    }
}

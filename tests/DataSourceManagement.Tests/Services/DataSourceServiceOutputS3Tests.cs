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
/// Phase 35, Plan 02, Task 2 — backend bridge for the S3 OUTPUT destination (G5 closure proof).
///
/// Proves that <see cref="DataSourceService.CreateAsync"/> bridges an S3 output destination's
/// selected <c>OutputServerId</c> (an S3 AdminServer) into a complete, write-ready
/// <c>Output.Destinations[].S3Config</c>:
///   * Bucket = the destination's own bucket if the frontend supplied one, else the server's bucket.
///   * Endpoint = <c>http://{host}:{port}</c> from the server + UseHttp; UsePathStyle = true.
///   * AccessKeyId = server AccessKey; SecretAccessKey = DECRYPTED server SecretKey.
///   * Region stays null/empty (G6 must not regress).
///   * Non-S3 (kafka) destinations are left untouched (no S3Config injected).
///
/// These are pure unit tests: the repository is mocked to echo back the entity it is asked to
/// persist (so the post-bridge entity is observable), and a REAL <see cref="ServerCredentialProtector"/>
/// encrypts the server SecretKey at rest so the decrypt path is genuinely exercised.
/// </summary>
public class DataSourceServiceOutputS3Tests
{
    private const string CorrelationId = "test-corr-id";

    private readonly Mock<IDataSourceRepository> _repository = new();
    private readonly Mock<IPublishEndpoint> _publishEndpoint = new();
    private readonly Mock<INasDeviceService> _nasDeviceService = new();
    private readonly Mock<IServerService> _serverService = new();
    private readonly ServerCredentialProtector _protector;

    public DataSourceServiceOutputS3Tests()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [ServerCredentialProtector.ConfigKey] = "unit-test-field-encryption-key"
            })
            .Build();
        _protector = new ServerCredentialProtector(
            configuration, NullLogger<ServerCredentialProtector>.Instance);

        // Repository echoes back the entity it is asked to persist so the bridged
        // Output.Destinations[].S3Config is observable on the returned data source.
        _repository
            .Setup(r => r.CreateAsync(It.IsAny<DataProcessingDataSource>(), It.IsAny<string>()))
            .ReturnsAsync((DataProcessingDataSource ds, string _) => ds);
    }

    private DataSourceService CreateSut() => new(
        _repository.Object,
        NullLogger<DataSourceService>.Instance,
        new BusinessMetrics(new Meter("DataSourceServiceOutputS3Tests")),
        _publishEndpoint.Object,
        _nasDeviceService.Object,
        _serverService.Object,
        _protector);

    private AdminServer BuildS3Server(string id, string plaintextSecret, bool includeBucket = true)
    {
        var config = new BsonDocument
        {
            { "AccessKey", "minio-access" },
            // SecretKey is stored encrypted at rest, exactly as the controller persists it.
            { "SecretKey", _protector.Protect(plaintextSecret) },
            { "Region", "us-east-1" }, // present on the server but MUST be omitted on the output config
            { "ForcePathStyle", true },
            { "UseHttp", true }
        };
        if (includeBucket)
            config.Add("Bucket", "server-default-bucket");

        return new AdminServer
        {
            ID = id,
            Name = "MinIO Output Server",
            ServerType = "s3",
            Host = "minio.file-simulator",
            Port = 30900,
            IsActive = true,
            TypeSpecificConfig = config
        };
    }

    private static CreateDataSourceRequest BuildRequestWithS3Destination(
        string outputServerId, S3OutputConfig? s3Config)
    {
        return new CreateDataSourceRequest
        {
            Name = "S3 Output DS",
            SupplierName = "ACME",
            Category = "Sales",
            Output = new OutputConfiguration
            {
                Destinations = new List<OutputDestination>
                {
                    new OutputDestination
                    {
                        Id = "dest-s3",
                        Name = "MinIO Output",
                        Type = "s3",
                        Enabled = true,
                        OutputServerId = outputServerId,
                        S3Config = s3Config
                    }
                }
            }
        };
    }

    [Fact]
    public async Task CreateAsync_S3Destination_BridgesServerCredsEndpointAndDecryptedSecret()
    {
        const string serverId = "srv-s3-1";
        const string plaintextSecret = "super-secret-minio-key";
        _serverService
            .Setup(s => s.GetServerByIdAsync(serverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildS3Server(serverId, plaintextSecret));

        // Frontend supplied its own bucket/keyPrefix (the admin-typed Bucket / Prefix).
        var request = BuildRequestWithS3Destination(serverId, new S3OutputConfig
        {
            Bucket = "ez-phase34-output",
            KeyPrefix = "processed",
            UsePathStyle = true
        });

        var sut = CreateSut();
        var result = await sut.CreateAsync(request, CorrelationId);

        result.IsSuccess.Should().BeTrue();
        var s3 = result.Data!.Output.Destinations[0].S3Config;
        s3.Should().NotBeNull();
        s3!.Bucket.Should().Be("ez-phase34-output", "the admin-typed bucket must be preserved");
        s3.KeyPrefix.Should().Be("processed");
        s3.Endpoint.Should().Be("http://minio.file-simulator:30900");
        s3.UsePathStyle.Should().BeTrue();
        s3.AccessKeyId.Should().Be("minio-access");
        s3.SecretAccessKey.Should().Be(plaintextSecret, "the at-rest secret must be decrypted for the write");
    }

    [Fact]
    public async Task CreateAsync_S3Destination_OmitsRegion()
    {
        const string serverId = "srv-s3-2";
        _serverService
            .Setup(s => s.GetServerByIdAsync(serverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildS3Server(serverId, "secret"));

        var request = BuildRequestWithS3Destination(serverId, new S3OutputConfig
        {
            Bucket = "ez-phase34-output"
        });

        var sut = CreateSut();
        var result = await sut.CreateAsync(request, CorrelationId);

        result.IsSuccess.Should().BeTrue();
        var s3 = result.Data!.Output.Destinations[0].S3Config;
        s3.Should().NotBeNull();
        // G6: Region MUST be omitted even though the server carries one, so the AWS SDK keeps the
        // custom MinIO endpoint instead of rewriting the host.
        string.IsNullOrEmpty(s3!.Region).Should().BeTrue("region must be omitted per G6");
    }

    [Fact]
    public async Task CreateAsync_S3Destination_FallsBackToServerBucketWhenFrontendOmitsIt()
    {
        const string serverId = "srv-s3-3";
        _serverService
            .Setup(s => s.GetServerByIdAsync(serverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildS3Server(serverId, "secret"));

        // Frontend supplied a destination with NO s3Config at all.
        var request = BuildRequestWithS3Destination(serverId, s3Config: null);

        var sut = CreateSut();
        var result = await sut.CreateAsync(request, CorrelationId);

        result.IsSuccess.Should().BeTrue();
        var s3 = result.Data!.Output.Destinations[0].S3Config;
        s3.Should().NotBeNull();
        s3!.Bucket.Should().Be("server-default-bucket", "falls back to the server bucket when the frontend omits it");
    }

    [Fact]
    public async Task CreateAsync_NonS3Destination_IsLeftUntouched()
    {
        var request = new CreateDataSourceRequest
        {
            Name = "Kafka Output DS",
            SupplierName = "ACME",
            Category = "Sales",
            Output = new OutputConfiguration
            {
                Destinations = new List<OutputDestination>
                {
                    new OutputDestination
                    {
                        Id = "dest-kafka",
                        Name = "Kafka Out",
                        Type = "kafka",
                        Enabled = true,
                        OutputServerId = "srv-kafka",
                        KafkaConfig = new KafkaOutputConfig { Topic = "processed-data" }
                    }
                }
            }
        };

        var sut = CreateSut();
        var result = await sut.CreateAsync(request, CorrelationId);

        result.IsSuccess.Should().BeTrue();
        var dest = result.Data!.Output.Destinations[0];
        dest.S3Config.Should().BeNull("a non-S3 destination must not get an S3Config injected");
        // The server resolver must never be consulted for a non-S3 destination.
        _serverService.Verify(
            s => s.GetServerByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}

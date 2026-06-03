// S3ConnectorTests.cs - S3/MinIO Connector Integration Tests
// EZ Platform Integration Tests
// Version: 1.0
// Date: February 2, 2026

using System.Text;
using DataProcessing.IntegrationTests.Fixtures;
using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Xunit;
using Xunit.Abstractions;

namespace DataProcessing.IntegrationTests.Connectors;

/// <summary>
/// Integration tests for S3Connector against file-simulator MinIO server
/// Tests connection, read/write, and file listing operations
/// </summary>
[Collection("Integration")]
[Trait("Category", "Protocol")]
[Trait("Protocol", "S3")]
[Trait("Dependency", "FileSimulator")]
[Trait("OCP", "Compatible")]
public class S3ConnectorTests : IClassFixture<FileSimulatorFixture>
{
    private readonly FileSimulatorFixture _fixture;
    private readonly ITestOutputHelper _output;
    private readonly S3Connector _connector;
    private readonly string _testRunId;

    // Default bucket name from file-simulator
    private const string DefaultBucket = "ez-data";

    public S3ConnectorTests(FileSimulatorFixture fixture, ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;
        _connector = new S3Connector(NullLogger<S3Connector>.Instance);
        _testRunId = Guid.NewGuid().ToString("N")[..8];
    }

    // ========== Helper Methods ==========

    private void SkipIfFileSimulatorUnavailable()
    {
        Skip.If(!_fixture.IsAvailable, "File-simulator not available");
    }

    private string GenerateTestFileName(string ext = ".csv")
    {
        return $"test-{_testRunId}-{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
    }

    private byte[] GenerateTestContent(int rows = 10)
    {
        var sb = new StringBuilder();
        sb.AppendLine("id,name,amount,date");
        for (int i = 1; i <= rows; i++)
        {
            sb.AppendLine($"{i},Item-{i},{i * 100.50:F2},{DateTime.UtcNow:yyyy-MM-dd}");
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private AdminServer CreateAdminServer()
    {
        return new AdminServer
        {
            Name = "file-simulator-s3",
            ServerType = "s3",
            Host = _fixture.FileSimulatorIp,
            Port = _fixture.S3Port,
            BasePath = DefaultBucket, // Bucket name
            ConnectionTimeoutSeconds = 30,
            TypeSpecificConfig = new BsonDocument
            {
                ["Bucket"] = DefaultBucket,
                ["Region"] = "us-east-1",
                ["ForcePathStyle"] = true,
                ["UseHttp"] = true
            }
        };
    }

    private ServerCredentials CreateCredentials()
    {
        var (accessKey, secretKey) = FileSimulatorFixture.Credentials.S3;
        return new ServerCredentials
        {
            AccessKey = accessKey,
            SecretKey = secretKey
        };
    }

    // ========== Test Methods ==========

    [SkippableFact(DisplayName = "S3: Test connection returns success")]
    public async Task S3Connector_TestConnection_ReturnsSuccess()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        _output.WriteLine($"Testing S3 connection to {server.Host}:{server.Port}");
        _output.WriteLine($"Bucket: {DefaultBucket}");

        // Act
        var result = await _connector.TestConnectionAsync(server, credentials);

        // Assert
        result.IsSuccess.Should().BeTrue("S3 connection should succeed");
        result.ConnectionTimeMs.Should().BeLessThan(5000, "Connection should complete within 5 seconds");
        result.ServerInfo.Should().NotBeNullOrEmpty("Server info should be returned");

        _output.WriteLine($"Connection successful in {result.ConnectionTimeMs}ms");
        _output.WriteLine($"Server info: {result.ServerInfo}");
    }

    [SkippableFact(DisplayName = "S3: Write and read file round-trips successfully")]
    public async Task S3Connector_WriteAndReadFile_RoundTripsSuccessfully()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();
        var fileName = GenerateTestFileName();
        var content = GenerateTestContent(5);
        var filePath = $"output/{fileName}";

        _output.WriteLine($"Writing test file: {filePath}");
        _output.WriteLine($"Content size: {content.Length} bytes");

        // Act - Write
        await _connector.WriteFileAsync(server, credentials, filePath, content);
        _output.WriteLine("File written successfully");

        // Act - Read
        var readContent = await _connector.ReadFileAsync(server, credentials, filePath);

        // Assert
        readContent.Should().BeEquivalentTo(content, "Read content should match written content");

        _output.WriteLine($"File read successfully: {readContent.Length} bytes");
        _output.WriteLine($"Content matches: {readContent.Length == content.Length}");
    }

    [SkippableFact(DisplayName = "S3: List files returns matching files")]
    public async Task S3Connector_ListFiles_ReturnsMatchingFiles()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        // First, write a test file to ensure we have something to list
        var fileName = GenerateTestFileName();
        var content = GenerateTestContent(3);
        var filePath = $"test-list/{fileName}";

        await _connector.WriteFileAsync(server, credentials, filePath, content);
        _output.WriteLine($"Created test file: {filePath}");

        // Act - List all files in test-list prefix
        var allFiles = await _connector.ListFilesAsync(server, credentials, "test-list/", "*.*");

        // Assert
        allFiles.Should().NotBeNull("File list should not be null");
        allFiles.Should().Contain(f => f.FileName == fileName, "Should contain the file we just wrote");

        _output.WriteLine($"Found {allFiles.Count} files in test-list/");
        foreach (var file in allFiles.Take(10))
        {
            _output.WriteLine($"  - {file.FileName} ({file.SizeBytes} bytes)");
        }

        // Act - List CSV files only
        var csvFiles = await _connector.ListFilesAsync(server, credentials, "test-list/", "*.csv");

        _output.WriteLine($"Found {csvFiles.Count} CSV files");
        csvFiles.Should().OnlyContain(f => f.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase),
            "CSV filter should only return CSV files");
    }

    // ========== Phase 34: credential regression + end-to-end (SC-05/SC-06) ==========

    /// <summary>
    /// Empty-credentials regression (SC-05): when the AdminServer's <c>TypeSpecificConfig</c> carries
    /// no <c>AccessKey</c>/<c>SecretKey</c>, <see cref="ServerCredentials.FromBsonDocument"/> yields no
    /// S3 auth and <see cref="S3Connector.TestConnectionAsync(AdminServer, ServerCredentials?, System.Threading.CancellationToken)"/>
    /// returns <c>IsSuccess == false</c>. This documents the original bug: missing keys silently fell
    /// through to the AWS SDK "IAM credentials is missing" path against a MinIO server that demands them.
    /// Guarded by the file-simulator so the failure is an authentication failure (not connectivity).
    /// </summary>
    [SkippableFact(DisplayName = "S3: empty credentials fail to connect (IAM-missing regression)")]
    [Trait("Scenario", "EmptyCredentialsRegression")]
    public async Task S3Connector_EmptyCredentials_TestConnectionFails()
    {
        SkipIfFileSimulatorUnavailable();

        // Arrange — server with NO AccessKey/SecretKey in TypeSpecificConfig.
        var server = CreateAdminServer();
        var emptyConfigCredentials = ServerCredentials.FromBsonDocument(server.TypeSpecificConfig!);
        emptyConfigCredentials.HasS3Auth.Should().BeFalse(
            "the config has no AccessKey/SecretKey, so no S3 auth should be derived");

        _output.WriteLine($"Testing S3 connection with empty credentials to {server.Host}:{server.Port}");

        // Act
        var result = await _connector.TestConnectionAsync(server, emptyConfigCredentials);

        // Assert — the IAM-missing path must NOT silently succeed.
        result.IsSuccess.Should().BeFalse(
            "with no access/secret key the connector must fail rather than fall through to the IAM path");

        _output.WriteLine($"Connection correctly failed: {result.ErrorMessage}");
    }

    /// <summary>
    /// End-to-end (SC-05/SC-06): build <see cref="ServerCredentials"/> from the PascalCase
    /// <c>TypeSpecificConfig</c> via <see cref="ServerCredentials.FromBsonDocument"/> — exactly the
    /// establish-path the production code takes — and authenticate to the file-simulator MinIO.
    /// Proves real keys reach the connector and the live request succeeds.
    /// </summary>
    [SkippableFact(DisplayName = "S3 (S3EndToEnd): credentials from TypeSpecificConfig authenticate to MinIO")]
    [Trait("Category", "S3EndToEnd")]
    public async Task S3Connector_CredentialsFromTypeSpecificConfig_AuthenticatesToMinIO()
    {
        SkipIfFileSimulatorUnavailable();

        // Arrange — populate TypeSpecificConfig with the PascalCase S3 key contract
        // (Pitfall 2) and derive credentials the same way the production establish-path does.
        var (accessKey, secretKey) = FileSimulatorFixture.Credentials.S3;
        var server = CreateAdminServer();
        server.TypeSpecificConfig!["AccessKey"] = accessKey;
        server.TypeSpecificConfig["SecretKey"] = secretKey;

        var credentials = ServerCredentials.FromBsonDocument(server.TypeSpecificConfig);
        credentials.HasS3Auth.Should().BeTrue("FromBsonDocument must read the PascalCase keys");
        credentials.AccessKey.Should().Be(accessKey);
        credentials.SecretKey.Should().Be(secretKey);

        _output.WriteLine($"End-to-end S3 auth to {server.Host}:{server.Port}, bucket {DefaultBucket}");
        _output.WriteLine($"Credentials (redacted): {credentials}");

        // Act
        var result = await _connector.TestConnectionAsync(server, credentials);

        // Assert — real keys from TypeSpecificConfig must authenticate.
        result.IsSuccess.Should().BeTrue(
            "credentials derived from TypeSpecificConfig must authenticate to MinIO (SC-05/SC-06)");
        result.ServerInfo.Should().NotBeNullOrEmpty();

        _output.WriteLine($"End-to-end connection successful in {result.ConnectionTimeMs}ms: {result.ServerInfo}");
    }
}

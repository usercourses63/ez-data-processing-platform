// SftpConnectorTests.cs - SFTP Connector Integration Tests
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
using Polly;
using Polly.Registry;
using Xunit;
using Xunit.Abstractions;

namespace DataProcessing.IntegrationTests.Connectors;

/// <summary>
/// Integration tests for SftpConnector against file-simulator SFTP server
/// Tests connection, read/write, and file listing operations
/// </summary>
[Collection("Integration")]
[Trait("Category", "Protocol")]
[Trait("Protocol", "SFTP")]
[Trait("Dependency", "FileSimulator")]
public class SftpConnectorTests : IClassFixture<FileSimulatorFixture>
{
    private readonly FileSimulatorFixture _fixture;
    private readonly ITestOutputHelper _output;
    private readonly SftpConnector _connector;
    private readonly string _testRunId;

    public SftpConnectorTests(FileSimulatorFixture fixture, ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;
        var registry = new ResiliencePipelineRegistry<string>();
        registry.TryAddBuilder<object>("external-connector", (builder, _) => { });
        _connector = new SftpConnector(NullLogger<SftpConnector>.Instance, registry);
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
            Name = "file-simulator-sftp",
            ServerType = "sftp",
            Host = _fixture.FileSimulatorIp,
            Port = _fixture.SftpPort,
            BasePath = "/home/sftpuser",
            ConnectionTimeoutSeconds = 30
        };
    }

    private ServerCredentials CreateCredentials()
    {
        var (user, pass) = FileSimulatorFixture.Credentials.Sftp;
        return new ServerCredentials
        {
            Username = user,
            Password = pass
        };
    }

    // ========== Test Methods ==========

    [SkippableFact(DisplayName = "SFTP: Test connection returns success")]
    public async Task SftpConnector_TestConnection_ReturnsSuccess()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        _output.WriteLine($"Testing SFTP connection to {server.Host}:{server.Port}");

        // Act
        var result = await _connector.TestConnectionAsync(server, credentials);

        // Assert
        result.IsSuccess.Should().BeTrue("SFTP connection should succeed");
        result.ConnectionTimeMs.Should().BeLessThan(10000, "Connection should complete within 10 seconds");
        result.ServerInfo.Should().NotBeNullOrEmpty("Server info should be returned");

        _output.WriteLine($"Connection successful in {result.ConnectionTimeMs}ms");
        _output.WriteLine($"Server info: {result.ServerInfo}");
    }

    [SkippableFact(DisplayName = "SFTP: Write and read file round-trips successfully")]
    public async Task SftpConnector_WriteAndReadFile_RoundTripsSuccessfully()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();
        var fileName = GenerateTestFileName();
        var content = GenerateTestContent(5);
        var filePath = $"/home/sftpuser/output/{fileName}";

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

    [SkippableFact(DisplayName = "SFTP: List files returns matching files")]
    public async Task SftpConnector_ListFiles_ReturnsMatchingFiles()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        _output.WriteLine($"Listing files on SFTP server at {server.Host}:{server.Port}");

        // Act - List all files in home directory
        var allFiles = await _connector.ListFilesAsync(server, credentials, "/home/sftpuser", "*.*");

        // Assert
        allFiles.Should().NotBeNull("File list should not be null");

        _output.WriteLine($"Found {allFiles.Count} files");
        foreach (var file in allFiles.Take(10))
        {
            _output.WriteLine($"  - {file.FileName} ({file.SizeBytes} bytes)");
        }

        // Act - List CSV files only
        var csvFiles = await _connector.ListFilesAsync(server, credentials, "/home/sftpuser", "*.csv");

        _output.WriteLine($"Found {csvFiles.Count} CSV files");
        csvFiles.Should().OnlyContain(f => f.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase),
            "CSV filter should only return CSV files");
    }
}

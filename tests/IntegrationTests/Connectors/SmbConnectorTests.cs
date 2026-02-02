// SmbConnectorTests.cs - SMB Connector Integration Tests
// EZ Platform Integration Tests
// Version: 1.0
// Date: February 2, 2026

using System.Net.Sockets;
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
/// Integration tests for SmbConnector against file-simulator SMB/Samba server.
/// Note: SMB requires port 445, which cannot be exposed via NodePort.
/// These tests require `minikube tunnel -p file-simulator` to be running.
/// Tests will skip gracefully if the tunnel is not available.
/// </summary>
[Collection("Integration")]
[Trait("Category", "Protocol")]
[Trait("Protocol", "SMB")]
[Trait("Dependency", "FileSimulator")]
[Trait("Dependency", "Tunnel")]
[Trait("OCP", "Compatible")]
public class SmbConnectorTests : IClassFixture<FileSimulatorFixture>
{
    private readonly FileSimulatorFixture _fixture;
    private readonly ITestOutputHelper _output;
    private readonly SmbConnector _connector;
    private readonly string _testRunId;

    // SMB uses port 445 (cannot use NodePort)
    private const int SmbPort = 445;

    // Default share name from file-simulator
    private const string DefaultShare = "files";

    public SmbConnectorTests(FileSimulatorFixture fixture, ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;
        _connector = new SmbConnector(NullLogger<SmbConnector>.Instance);
        _testRunId = Guid.NewGuid().ToString("N")[..8];
    }

    // ========== Helper Methods ==========

    /// <summary>
    /// Skips test if file-simulator is not available
    /// </summary>
    private void SkipIfFileSimulatorUnavailable()
    {
        Skip.If(!_fixture.IsAvailable, "File-simulator not available");
    }

    /// <summary>
    /// Skips test if minikube tunnel is not running.
    /// SMB requires port 445, which cannot be exposed via NodePort.
    /// </summary>
    private void SkipIfTunnelNotAvailable()
    {
        SkipIfFileSimulatorUnavailable();

        // SMB requires direct port 445, which needs minikube tunnel
        using var client = new TcpClient();
        try
        {
            var connectTask = client.ConnectAsync(_fixture.FileSimulatorIp, SmbPort);
            if (!connectTask.Wait(2000))
            {
                Skip.If(true, "SMB requires minikube tunnel. Run: minikube tunnel -p file-simulator");
            }
            if (!client.Connected)
            {
                Skip.If(true, "SMB requires minikube tunnel. Run: minikube tunnel -p file-simulator");
            }
        }
        catch
        {
            Skip.If(true, "SMB requires minikube tunnel. Run: minikube tunnel -p file-simulator");
        }
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
            Name = "file-simulator-smb",
            ServerType = "smb",
            Host = _fixture.FileSimulatorIp,
            Port = SmbPort,
            BasePath = DefaultShare, // Share name
            ConnectionTimeoutSeconds = 30,
            TypeSpecificConfig = new BsonDocument
            {
                ["ShareName"] = DefaultShare,
                ["Domain"] = ""
            }
        };
    }

    private ServerCredentials CreateCredentials()
    {
        var (user, pass) = FileSimulatorFixture.Credentials.Smb;
        return new ServerCredentials
        {
            Username = user,
            Password = pass
        };
    }

    // ========== Test Methods ==========

    [SkippableFact(DisplayName = "SMB: Test connection returns success")]
    public async Task SmbConnector_TestConnection_ReturnsSuccess()
    {
        // Skip if file-simulator or tunnel not available
        SkipIfTunnelNotAvailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        _output.WriteLine($"Testing SMB connection to {server.Host}:{SmbPort}");
        _output.WriteLine($"Share: {DefaultShare}");

        // Act
        var result = await _connector.TestConnectionAsync(server, credentials);

        // Assert
        result.IsSuccess.Should().BeTrue("SMB connection should succeed");
        result.ConnectionTimeMs.Should().BeLessThan(5000, "Connection should complete within 5 seconds");
        result.ServerInfo.Should().NotBeNullOrEmpty("Server info should be returned");

        _output.WriteLine($"Connection successful in {result.ConnectionTimeMs}ms");
        _output.WriteLine($"Server info: {result.ServerInfo}");
    }

    [SkippableFact(DisplayName = "SMB: Write and read file round-trips successfully")]
    public async Task SmbConnector_WriteAndReadFile_RoundTripsSuccessfully()
    {
        // Skip if file-simulator or tunnel not available
        SkipIfTunnelNotAvailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();
        var fileName = GenerateTestFileName();
        var content = GenerateTestContent(5);
        var filePath = $"output\\{fileName}";

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

    [SkippableFact(DisplayName = "SMB: List files returns matching files")]
    public async Task SmbConnector_ListFiles_ReturnsMatchingFiles()
    {
        // Skip if file-simulator or tunnel not available
        SkipIfTunnelNotAvailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        _output.WriteLine($"Listing files on SMB share {server.Host}\\{DefaultShare}");

        // Act - List all files in root
        var allFiles = await _connector.ListFilesAsync(server, credentials, "", "*.*");

        // Assert
        allFiles.Should().NotBeNull("File list should not be null");

        _output.WriteLine($"Found {allFiles.Count} files");
        foreach (var file in allFiles.Take(10))
        {
            _output.WriteLine($"  - {file.FileName} ({file.SizeBytes} bytes)");
        }

        // Act - List CSV files only
        var csvFiles = await _connector.ListFilesAsync(server, credentials, "", "*.csv");

        _output.WriteLine($"Found {csvFiles.Count} CSV files");
        csvFiles.Should().OnlyContain(f => f.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase),
            "CSV filter should only return CSV files");
    }
}

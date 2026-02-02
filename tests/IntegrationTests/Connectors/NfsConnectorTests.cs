// NfsConnectorTests.cs - NFS Connector Integration Tests
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
using Xunit;
using Xunit.Abstractions;

namespace DataProcessing.IntegrationTests.Connectors;

/// <summary>
/// NFS connector integration tests.
///
/// IMPORTANT: NFS connector accesses files via Kubernetes PVC mounts.
/// These mounts only exist inside pods, not on the local dev machine.
///
/// Test execution context:
/// - LOCAL (default): Tests verify connector logic but skip actual NFS operations
/// - IN-POD: Set NFS_MOUNT_PATH env var to enable full NFS tests
///
/// To run full NFS tests inside a K8s pod:
/// 1. Deploy test pod with PVC mount (see docs/testing/nfs-test-pod.yaml)
/// 2. Set NFS_MOUNT_PATH=/mnt/nas-input-1
/// 3. Run: dotnet test --filter "Protocol=NFS"
///
/// NFS connector uses standard filesystem API on mounted PVC paths.
/// Mount path convention: /mnt/{nas-device-name}
/// Example: NAS device "input-1" mounts to /mnt/input-1
/// </summary>
[Collection("Integration")]
[Trait("Category", "Protocol")]
[Trait("Protocol", "NFS")]
[Trait("Dependency", "K8sPod")]
public class NfsConnectorTests : IClassFixture<FileSimulatorFixture>
{
    private readonly FileSimulatorFixture _fixture;
    private readonly ITestOutputHelper _output;
    private readonly NfsConnector _connector;
    private readonly string? _nfsMountPath;
    private readonly string _testRunId;

    public NfsConnectorTests(FileSimulatorFixture fixture, ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;
        _connector = new NfsConnector(NullLogger<NfsConnector>.Instance);
        _nfsMountPath = Environment.GetEnvironmentVariable("NFS_MOUNT_PATH");
        _testRunId = Guid.NewGuid().ToString("N")[..8];
    }

    // ========== Skip Helper ==========

    private void SkipIfNfsMountNotAvailable()
    {
        var skipReason = string.IsNullOrEmpty(_nfsMountPath)
            ? "NFS_MOUNT_PATH environment variable not set. " +
              "Set this variable or run inside K8s pod with NAS PVC mount."
            : !Directory.Exists(_nfsMountPath)
                ? $"NFS mount path does not exist: {_nfsMountPath}. " +
                  "Ensure PVC is mounted and accessible."
                : null;

        if (skipReason != null)
        {
            _output.WriteLine($"Skipping: {skipReason}");
            Skip.If(true, skipReason);
        }
    }

    // ========== Helper Methods ==========

    private string GenerateTestFileName(string ext = ".csv")
    {
        return $"nfs-test-{_testRunId}-{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
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

    private AdminServer CreateAdminServer(string? basePath = null)
    {
        return new AdminServer
        {
            Name = "nfs-test-server",
            ServerType = "nfs",
            Host = "localhost", // NFS mount is local filesystem in pod
            BasePath = basePath ?? _nfsMountPath ?? "/mnt/nas-input-1",
            ConnectionTimeoutSeconds = 30
        };
    }

    // ========== Logical Tests (No Mount Required) ==========

    [Fact(DisplayName = "NFS: Connector type returns 'nfs'")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    public void NfsConnector_ConnectorType_ReturnsNfs()
    {
        // Act
        var connectorType = _connector.ConnectorType;

        // Assert
        connectorType.Should().Be("nfs", "NFS connector should identify as 'nfs' type");

        _output.WriteLine($"Connector type: {connectorType}");
    }

    [SkippableFact(DisplayName = "NFS: Test connection fails gracefully for non-existent path")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    public async Task NfsConnector_TestConnection_FailsGracefully_WhenMountNotExists()
    {
        // Arrange
        var nonExistentPath = "/mnt/non-existent-nas-device-12345";
        var server = CreateAdminServer(nonExistentPath);

        _output.WriteLine($"Testing NFS connection to non-existent path: {nonExistentPath}");

        // Act
        var result = await _connector.TestConnectionAsync(server, null);

        // Assert
        result.IsSuccess.Should().BeFalse("Connection to non-existent mount should fail");
        result.ErrorMessage.Should().Contain("does not exist",
            "Error message should indicate mount doesn't exist");

        _output.WriteLine($"Connection failed as expected: {result.ErrorMessage}");
    }

    // ========== Mount-Dependent Tests (K8s Pod Context) ==========

    [SkippableFact(DisplayName = "NFS: Test connection returns success when mount accessible")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    [Trait("Dependency", "K8sPod")]
    public async Task NfsConnector_TestConnection_ReturnsSuccess_WhenMountAccessible()
    {
        // Skip if NFS mount not available
        SkipIfNfsMountNotAvailable();

        // Arrange
        var server = CreateAdminServer();

        _output.WriteLine($"Testing NFS connection to mount: {server.BasePath}");

        // Act
        var result = await _connector.TestConnectionAsync(server, null);

        // Assert
        result.IsSuccess.Should().BeTrue("NFS connection should succeed when mount is accessible");
        result.ConnectionTimeMs.Should().BeLessThan(5000, "Connection should complete within 5 seconds");

        _output.WriteLine($"Connection successful in {result.ConnectionTimeMs}ms");
        _output.WriteLine($"Server info: {result.ServerInfo}");
    }

    [SkippableFact(DisplayName = "NFS: List files returns files when mount has data")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    [Trait("Dependency", "K8sPod")]
    public async Task NfsConnector_ListFiles_ReturnsFiles_WhenMountHasData()
    {
        // Skip if NFS mount not available
        SkipIfNfsMountNotAvailable();

        // Arrange
        var server = CreateAdminServer();

        _output.WriteLine($"Listing files in NFS mount: {server.BasePath}");

        // Act
        var files = await _connector.ListFilesAsync(server, null, null, "*.*");

        // Assert
        files.Should().NotBeNull("File list should not be null");

        _output.WriteLine($"Found {files.Count} files in NFS mount");
        foreach (var file in files.Take(10))
        {
            _output.WriteLine($"  - {file.FileName} ({file.SizeBytes} bytes, {file.LastModifiedUtc:u})");
        }

        if (files.Count > 10)
        {
            _output.WriteLine($"  ... and {files.Count - 10} more files");
        }
    }

    [SkippableFact(DisplayName = "NFS: Write and read file round-trips successfully")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    [Trait("Dependency", "K8sPod")]
    public async Task NfsConnector_WriteAndReadFile_RoundTrips_WhenMountWritable()
    {
        // Skip if NFS mount not available
        SkipIfNfsMountNotAvailable();

        // Arrange
        var server = CreateAdminServer();
        var fileName = GenerateTestFileName();
        var content = GenerateTestContent(5);
        var filePath = fileName; // Relative to mount path

        _output.WriteLine($"Testing write/read on NFS mount: {server.BasePath}");
        _output.WriteLine($"File name: {fileName}");
        _output.WriteLine($"Content size: {content.Length} bytes");

        string? fullPath = null;

        try
        {
            // Act - Write
            await _connector.WriteFileAsync(server, null, filePath, content);
            _output.WriteLine("File written successfully");

            fullPath = Path.Combine(server.BasePath ?? "/", filePath);

            // Act - Read
            var readContent = await _connector.ReadFileAsync(server, null, filePath);

            // Assert
            readContent.Should().BeEquivalentTo(content, "Read content should match written content");

            _output.WriteLine($"File read successfully: {readContent.Length} bytes");
            _output.WriteLine("Content round-trip verified successfully");
        }
        finally
        {
            // Cleanup - delete test file
            if (!string.IsNullOrEmpty(fullPath) && File.Exists(fullPath))
            {
                try
                {
                    File.Delete(fullPath);
                    _output.WriteLine($"Cleaned up test file: {fullPath}");
                }
                catch (Exception ex)
                {
                    _output.WriteLine($"Warning: Could not delete test file: {ex.Message}");
                }
            }
        }
    }

    [SkippableFact(DisplayName = "NFS: List files filters by pattern")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    [Trait("Dependency", "K8sPod")]
    public async Task NfsConnector_ListFiles_FiltersByPattern()
    {
        // Skip if NFS mount not available
        SkipIfNfsMountNotAvailable();

        // Arrange
        var server = CreateAdminServer();

        // First write test files with different extensions
        var csvContent = GenerateTestContent(3);
        var jsonContent = Encoding.UTF8.GetBytes("{\"test\": \"data\"}");
        var csvFileName = $"filter-test-{_testRunId}.csv";
        var jsonFileName = $"filter-test-{_testRunId}.json";

        string? csvFullPath = null;
        string? jsonFullPath = null;

        try
        {
            await _connector.WriteFileAsync(server, null, csvFileName, csvContent);
            await _connector.WriteFileAsync(server, null, jsonFileName, jsonContent);

            csvFullPath = Path.Combine(server.BasePath ?? "/", csvFileName);
            jsonFullPath = Path.Combine(server.BasePath ?? "/", jsonFileName);

            _output.WriteLine($"Created test files: {csvFileName}, {jsonFileName}");

            // Act - List CSV files only
            var csvFiles = await _connector.ListFilesAsync(server, null, null, "*.csv");

            // Assert
            csvFiles.Should().Contain(f => f.FileName == csvFileName,
                "Should find the CSV file we created");
            csvFiles.Should().NotContain(f => f.FileName == jsonFileName,
                "CSV filter should not return JSON files");

            _output.WriteLine($"CSV filter returned {csvFiles.Count} files");

            // Act - List JSON files only
            var jsonFiles = await _connector.ListFilesAsync(server, null, null, "*.json");

            // Assert
            jsonFiles.Should().Contain(f => f.FileName == jsonFileName,
                "Should find the JSON file we created");
            jsonFiles.Should().NotContain(f => f.FileName == csvFileName,
                "JSON filter should not return CSV files");

            _output.WriteLine($"JSON filter returned {jsonFiles.Count} files");
        }
        finally
        {
            // Cleanup
            if (!string.IsNullOrEmpty(csvFullPath) && File.Exists(csvFullPath))
            {
                try { File.Delete(csvFullPath); } catch { }
            }
            if (!string.IsNullOrEmpty(jsonFullPath) && File.Exists(jsonFullPath))
            {
                try { File.Delete(jsonFullPath); } catch { }
            }
            _output.WriteLine("Cleaned up test files");
        }
    }
}

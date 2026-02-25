// LocalFileConnectorTests.cs - Local File Connector Integration Tests
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
/// Local file connector integration tests.
///
/// IMPORTANT: These tests are marked OCP-INCOMPATIBLE because:
/// 1. OCP pods run with readOnlyRootFilesystem: true
/// 2. Local paths like C:\ or /tmp don't exist in container context
/// 3. Local connector is for development/testing only, not production
///
/// These tests serve as:
/// - Reference implementation showing connector test patterns
/// - Local development validation
/// - Documentation of LocalFileConnector behavior
///
/// In OCP deployments, use NFS connector via NAS devices for file access.
/// </summary>
[Collection("Integration")]
[Trait("Category", "Protocol")]
[Trait("Protocol", "Local")]
[Trait("OCP", "Incompatible")]
public class LocalFileConnectorTests : IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly LocalFileConnector _connector;
    private readonly string _testDirectory;
    private readonly string _testRunId;

    public LocalFileConnectorTests(ITestOutputHelper output)
    {
        _output = output;
        _connector = new LocalFileConnector(NullLogger<LocalFileConnector>.Instance);
        _testRunId = Guid.NewGuid().ToString("N")[..8];
        _testDirectory = Path.Combine(Path.GetTempPath(), $"ez-local-test-{_testRunId}");
        Directory.CreateDirectory(_testDirectory);
        _output.WriteLine($"Test directory: {_testDirectory}");
    }

    /// <summary>
    /// Cleanup test directory after all tests complete
    /// </summary>
    public void Dispose()
    {
        if (Directory.Exists(_testDirectory))
        {
            try
            {
                Directory.Delete(_testDirectory, recursive: true);
                _output.WriteLine($"Cleaned up test directory: {_testDirectory}");
            }
            catch (Exception ex)
            {
                _output.WriteLine($"Warning: Could not delete test directory: {ex.Message}");
            }
        }
    }

    // ========== Helper Methods ==========

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

    private AdminServer CreateAdminServer(string basePath)
    {
        return new AdminServer
        {
            Name = "local-test",
            ServerType = "local",
            Host = "localhost",
            BasePath = basePath,
            ConnectionTimeoutSeconds = 5
        };
    }

    // ========== Test Methods ==========

    [Fact(DisplayName = "Local: ConnectorType returns 'local'")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Local")]
    public void LocalConnector_ConnectorType_ReturnsLocal()
    {
        // Assert
        _connector.ConnectorType.Should().Be("local", "Connector type should be 'local'");
        _output.WriteLine($"ConnectorType: {_connector.ConnectorType}");
    }

    [Fact(DisplayName = "Local: Test connection returns success when directory exists")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Local")]
    public async Task LocalConnector_TestConnection_ReturnsSuccess_WhenDirectoryExists()
    {
        // Arrange
        var server = CreateAdminServer(_testDirectory);
        _output.WriteLine($"Testing connection to existing directory: {_testDirectory}");

        // Act
        var result = await _connector.TestConnectionAsync(server, null);

        // Assert
        result.IsSuccess.Should().BeTrue("Connection should succeed for existing directory");
        result.ConnectionTimeMs.Should().BeLessThan(1000, "Connection should be fast for local filesystem");
        result.ServerInfo.Should().Contain(_testDirectory, "Server info should contain the path");

        _output.WriteLine($"Connection successful in {result.ConnectionTimeMs}ms");
        _output.WriteLine($"Server info: {result.ServerInfo}");
    }

    [Fact(DisplayName = "Local: Test connection fails when directory does not exist")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Local")]
    public async Task LocalConnector_TestConnection_Fails_WhenDirectoryNotExists()
    {
        // Arrange
        var nonExistentPath = Path.Combine(Path.GetTempPath(), $"ez-nonexistent-{Guid.NewGuid():N}");
        var server = CreateAdminServer(nonExistentPath);
        _output.WriteLine($"Testing connection to non-existent directory: {nonExistentPath}");

        // Act
        var result = await _connector.TestConnectionAsync(server, null);

        // Assert
        result.IsSuccess.Should().BeFalse("Connection should fail for non-existent directory");
        result.ErrorMessage.Should().Contain("does not exist", "Error should indicate directory doesn't exist");

        _output.WriteLine($"Connection failed as expected: {result.ErrorMessage}");
    }

    [Fact(DisplayName = "Local: Write and read file round-trips successfully")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Local")]
    public async Task LocalConnector_WriteAndReadFile_RoundTripsSuccessfully()
    {
        // Arrange
        var server = CreateAdminServer(_testDirectory);
        var fileName = GenerateTestFileName();
        var filePath = fileName; // Relative to BasePath
        var content = GenerateTestContent(5);

        _output.WriteLine($"Writing test file: {filePath}");
        _output.WriteLine($"Content size: {content.Length} bytes");

        // Act - Write
        await _connector.WriteFileAsync(server, null, filePath, content);
        _output.WriteLine("File written successfully");

        // Act - Read
        var readContent = await _connector.ReadFileAsync(server, null, filePath);

        // Assert
        readContent.Should().BeEquivalentTo(content, "Read content should match written content");

        _output.WriteLine($"File read successfully: {readContent.Length} bytes");
        _output.WriteLine($"Content matches: {readContent.Length == content.Length}");
    }

    [Fact(DisplayName = "Local: List files returns matching files")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Local")]
    public async Task LocalConnector_ListFiles_ReturnsMatchingFiles()
    {
        // Arrange
        var server = CreateAdminServer(_testDirectory);

        // Create test files
        var testFile1 = Path.Combine(_testDirectory, "test1.csv");
        var testFile2 = Path.Combine(_testDirectory, "test2.csv");
        var testFile3 = Path.Combine(_testDirectory, "test3.json");

        await File.WriteAllTextAsync(testFile1, "id,name\n1,Test1");
        await File.WriteAllTextAsync(testFile2, "id,name\n2,Test2");
        await File.WriteAllTextAsync(testFile3, "{\"id\": 3, \"name\": \"Test3\"}");

        _output.WriteLine($"Created 3 test files: test1.csv, test2.csv, test3.json");

        // Act - List all files
        var allFiles = await _connector.ListFilesAsync(server, null, "", "*.*");

        // Assert - All files
        allFiles.Should().HaveCount(3, "Should find all 3 test files");
        _output.WriteLine($"Found {allFiles.Count} total files");

        foreach (var file in allFiles)
        {
            _output.WriteLine($"  - {file.FileName} ({file.SizeBytes} bytes)");
        }

        // Act - List CSV files only
        var csvFiles = await _connector.ListFilesAsync(server, null, "", "*.csv");

        // Assert - CSV filter
        csvFiles.Should().HaveCount(2, "Should find exactly 2 CSV files");
        csvFiles.Should().OnlyContain(f => f.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase),
            "CSV filter should only return CSV files");

        _output.WriteLine($"Found {csvFiles.Count} CSV files (filtered)");
    }

    [Fact(DisplayName = "Local: List files in subdirectory")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Local")]
    public async Task LocalConnector_ListFiles_WorksWithSubdirectory()
    {
        // Arrange
        var server = CreateAdminServer(_testDirectory);
        var subdirName = "subdir";
        var subdirPath = Path.Combine(_testDirectory, subdirName);
        Directory.CreateDirectory(subdirPath);

        // Create test files in subdirectory
        await File.WriteAllTextAsync(Path.Combine(subdirPath, "sub1.csv"), "id,name\n1,Sub1");
        await File.WriteAllTextAsync(Path.Combine(subdirPath, "sub2.csv"), "id,name\n2,Sub2");

        _output.WriteLine($"Created subdirectory: {subdirPath} with 2 files");

        // Act - List files in subdirectory
        var files = await _connector.ListFilesAsync(server, null, subdirName, "*.csv");

        // Assert
        files.Should().HaveCount(2, "Should find 2 CSV files in subdirectory");

        _output.WriteLine($"Found {files.Count} files in subdirectory");
        foreach (var file in files)
        {
            _output.WriteLine($"  - {file.FileName} ({file.SizeBytes} bytes)");
        }
    }
}

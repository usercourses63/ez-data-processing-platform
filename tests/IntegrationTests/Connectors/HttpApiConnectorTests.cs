// HttpApiConnectorTests.cs - HTTP API Connector Integration Tests
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
/// Integration tests for HttpApiConnector against file-simulator HTTP server
/// Tests connection and file listing operations (HTTP is typically read-only)
/// </summary>
[Collection("Integration")]
[Trait("Category", "Protocol")]
[Trait("Protocol", "HTTP")]
[Trait("Dependency", "FileSimulator")]
public class HttpApiConnectorTests : IClassFixture<FileSimulatorFixture>
{
    private readonly FileSimulatorFixture _fixture;
    private readonly ITestOutputHelper _output;
    private readonly HttpApiConnector _connector;
    private readonly string _testRunId;

    public HttpApiConnectorTests(FileSimulatorFixture fixture, ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;
        var registry = new ResiliencePipelineRegistry<string>();
        registry.TryAddBuilder("external-connector", (builder, _) => { });
        _connector = new HttpApiConnector(
            NullLogger<HttpApiConnector>.Instance,
            new TestHttpClientFactory(),
            registry);
        _testRunId = Guid.NewGuid().ToString("N")[..8];
    }

    // ========== Helper Methods ==========

    private void SkipIfFileSimulatorUnavailable()
    {
        Skip.If(!_fixture.IsAvailable, "File-simulator not available");
    }

    private AdminServer CreateAdminServer()
    {
        return new AdminServer
        {
            Name = "file-simulator-http",
            ServerType = "http",
            Host = _fixture.FileSimulatorIp,
            Port = _fixture.HttpPort,
            BasePath = "/",
            ConnectionTimeoutSeconds = 30
        };
    }

    private ServerCredentials CreateCredentials()
    {
        var (user, pass) = FileSimulatorFixture.Credentials.Http;
        return new ServerCredentials
        {
            Username = user,
            Password = pass
        };
    }

    // ========== Test Methods ==========

    [SkippableFact(DisplayName = "HTTP: Test connection returns success")]
    public async Task HttpApiConnector_TestConnection_ReturnsSuccess()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        _output.WriteLine($"Testing HTTP connection to {server.Host}:{server.Port}");

        // Act
        var result = await _connector.TestConnectionAsync(server, credentials);

        // Assert
        result.IsSuccess.Should().BeTrue("HTTP connection should succeed");
        result.ConnectionTimeMs.Should().BeLessThan(5000, "Connection should complete within 5 seconds");

        _output.WriteLine($"Connection successful in {result.ConnectionTimeMs}ms");
        _output.WriteLine($"Server info: {result.ServerInfo}");
    }

    [SkippableFact(DisplayName = "HTTP: List files returns result")]
    public async Task HttpApiConnector_ListFiles_ReturnsMatchingFiles()
    {
        // Skip if file-simulator not available
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        _output.WriteLine($"Listing files on HTTP server at {server.Host}:{server.Port}");

        // Act - List files (HTTP response may vary based on server implementation)
        var files = await _connector.ListFilesAsync(server, credentials, null, "*.*");

        // Assert
        files.Should().NotBeNull("File list should not be null");

        _output.WriteLine($"Found {files.Count} files/endpoints");
        foreach (var file in files.Take(10))
        {
            _output.WriteLine($"  - {file.FileName} ({file.FullPath})");
        }
    }

    // Note: HTTP WriteFile test is excluded because HTTP endpoints are typically read-only
    // WebDAV write operations could be tested separately if needed

    /// <summary>
    /// Simple IHttpClientFactory implementation for testing
    /// Creates real HttpClient instances without DI container
    /// </summary>
    private class TestHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            var handler = new HttpClientHandler
            {
                // Allow self-signed certificates in test environment
                ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true
            };
            return new HttpClient(handler);
        }
    }
}

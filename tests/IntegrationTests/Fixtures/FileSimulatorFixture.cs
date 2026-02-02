// FileSimulatorFixture.cs - File-Simulator Integration Test Fixture
// EZ Platform Integration Tests
// Version: 1.0
// Date: February 2, 2026

using System.Net.Sockets;
using Xunit;

namespace DataProcessing.IntegrationTests.Fixtures;

/// <summary>
/// Manages file-simulator connectivity for protocol integration tests.
/// Provides endpoints, credentials, and connectivity verification.
/// </summary>
public class FileSimulatorFixture : IAsyncLifetime
{
    // ========== Connection State ==========

    /// <summary>
    /// IP address of the file-simulator Minikube instance
    /// </summary>
    public string FileSimulatorIp { get; private set; } = string.Empty;

    /// <summary>
    /// Whether the file-simulator is reachable
    /// </summary>
    public bool IsAvailable { get; private set; }

    // ========== Protocol Endpoints (NodePorts) ==========

    /// <summary>
    /// FTP server port (vsftpd)
    /// </summary>
    public int FtpPort => 30021;

    /// <summary>
    /// SFTP server port (OpenSSH)
    /// </summary>
    public int SftpPort => 30022;

    /// <summary>
    /// S3/MinIO server port
    /// </summary>
    public int S3Port => 30900;

    /// <summary>
    /// HTTP file server port
    /// </summary>
    public int HttpPort => 30088;

    /// <summary>
    /// WebDAV server port
    /// </summary>
    public int WebDavPort => 30089;

    // ========== Credentials ==========

    /// <summary>
    /// Protocol credentials for file-simulator services
    /// </summary>
    public static class Credentials
    {
        /// <summary>
        /// FTP credentials (vsftpd)
        /// </summary>
        public static readonly (string User, string Password) Ftp = ("ftpuser", "ftppass123");

        /// <summary>
        /// SFTP credentials (OpenSSH)
        /// </summary>
        public static readonly (string User, string Password) Sftp = ("sftpuser", "sftppass123");

        /// <summary>
        /// S3/MinIO credentials
        /// </summary>
        public static readonly (string AccessKey, string SecretKey) S3 = ("minioadmin", "minioadmin123");

        /// <summary>
        /// HTTP Basic Auth credentials
        /// </summary>
        public static readonly (string User, string Password) Http = ("httpuser", "httppass123");
    }

    // ========== Lifecycle ==========

    /// <summary>
    /// Initializes the fixture by resolving file-simulator IP and testing connectivity
    /// </summary>
    public async Task InitializeAsync()
    {
        // 1. Try environment variable first
        FileSimulatorIp = Environment.GetEnvironmentVariable("FILE_SIMULATOR_IP") ?? "";

        // 2. Fall back to TestConfiguration or default
        if (string.IsNullOrEmpty(FileSimulatorIp))
        {
            FileSimulatorIp = TestConfiguration.FileSimulator.DefaultIp;
        }

        // 3. Verify connectivity using FTP port as health check
        IsAvailable = await TestTcpConnectivityAsync(FileSimulatorIp, FtpPort);

        Console.WriteLine($"FileSimulatorFixture: IP={FileSimulatorIp}, Available={IsAvailable}");
    }

    /// <summary>
    /// Cleanup (no resources to release)
    /// </summary>
    public Task DisposeAsync() => Task.CompletedTask;

    // ========== Connectivity Helpers ==========

    /// <summary>
    /// Tests TCP connectivity to a host:port with timeout
    /// </summary>
    private static async Task<bool> TestTcpConnectivityAsync(string host, int port, int timeoutMs = 3000)
    {
        if (string.IsNullOrEmpty(host))
            return false;

        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(host, port);
            var completed = await Task.WhenAny(connectTask, Task.Delay(timeoutMs));
            return completed == connectTask && client.Connected;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Tests connectivity to a specific protocol
    /// </summary>
    public async Task<bool> IsProtocolAvailableAsync(string protocol)
    {
        if (!IsAvailable)
            return false;

        var port = protocol.ToLowerInvariant() switch
        {
            "ftp" => FtpPort,
            "sftp" => SftpPort,
            "s3" => S3Port,
            "http" => HttpPort,
            "webdav" => WebDavPort,
            _ => 0
        };

        return port > 0 && await TestTcpConnectivityAsync(FileSimulatorIp, port);
    }
}

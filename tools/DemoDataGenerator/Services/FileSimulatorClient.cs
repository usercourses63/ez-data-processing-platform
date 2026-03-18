using System.Net.Http.Json;
using System.Text.Json;
using DemoDataGenerator.Models;

namespace DemoDataGenerator.Services;

/// <summary>
/// HTTP client for the file-simulator Control API.
/// Provides typed methods for discovering servers and retrieving connection info.
/// </summary>
/// <remarks>
/// File-Simulator Control API Reference:
///   GET  /health                          - Health check (200 = healthy)
///   GET  /api/servers                     - List all managed servers (static + dynamic)
///   GET  /api/connection-info?format=json  - External connection details for all servers
///   POST /api/servers/ftp                 - Create dynamic FTP server { name, username, password }
///   POST /api/servers/sftp                - Create dynamic SFTP server { name, username, password }
///   POST /api/servers/nas                 - Create dynamic NAS/NFS server { name, directory }
///
/// Static servers (always available): minio (S3), webdav (HTTP), static-ftp, static-sftp, main-nfs
/// Dynamic servers: created on demand via POST endpoints, removed on simulator restart
///
/// Base URL configured via --simulator-url flag or appsettings.json FileSimulator:ControlApiUrl
/// Default: http://file-simulator.local:30500
///
/// Response format: All endpoints return JSON. Server lists return arrays of SimulatorServer objects.
/// Connection-info returns SimulatorConnectionInfo with hostname, servers array, and default credentials.
/// </remarks>
public class FileSimulatorClient
{
    private readonly HttpClient _http;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public FileSimulatorClient(HttpClient http)
    {
        _http = http;
    }

    /// <summary>
    /// Checks if the file-simulator Control API is reachable and healthy.
    /// </summary>
    /// <remarks>
    /// GET /health
    /// Returns 200 OK if the simulator is running. Any non-success status or connection
    /// failure returns false. Does not throw on network errors.
    /// </remarks>
    /// <param name="ct">Cancellation token</param>
    /// <returns>True if the simulator is healthy, false otherwise</returns>
    public async Task<bool> EnsureHealthyAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _http.GetAsync("/health", ct);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }

    /// <summary>
    /// Discovers all servers managed by the file-simulator (static + dynamic).
    /// </summary>
    /// <remarks>
    /// GET /api/servers
    /// Returns a JSON array of SimulatorServer objects, each with: Name, Protocol, NodePort,
    /// PodStatus, PodReady, IsDynamic, Credentials, Directory (NAS only).
    /// Includes both static servers (always present) and dynamically created servers.
    /// </remarks>
    /// <param name="ct">Cancellation token</param>
    /// <returns>List of all managed servers</returns>
    public async Task<List<SimulatorServer>> GetServersAsync(CancellationToken ct = default)
    {
        var response = await _http.GetAsync("/api/servers", ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<List<SimulatorServer>>(json, _jsonOptions) ?? [];
    }

    /// <summary>
    /// Retrieves external connection details for all servers from the file-simulator.
    /// </summary>
    /// <remarks>
    /// GET /api/connection-info?format=json
    /// Returns SimulatorConnectionInfo containing: Hostname (Minikube IP), Servers array
    /// (each with external Host/Port for NodePort access, ConnectionString, Credentials),
    /// DefaultCredentials dictionary, and Endpoints map.
    /// Use this to resolve external-facing host:port for each server.
    /// </remarks>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Connection info with external host/port details for all servers</returns>
    public async Task<SimulatorConnectionInfo> GetConnectionInfoAsync(CancellationToken ct = default)
    {
        var response = await _http.GetAsync("/api/connection-info?format=json", ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<SimulatorConnectionInfo>(json, _jsonOptions)
            ?? throw new InvalidOperationException("Empty response from simulator");
    }

    /// <summary>
    /// Creates a dynamic NAS/NFS server in the file-simulator.
    /// </summary>
    /// <remarks>
    /// POST /api/servers/nas
    /// Request body: { "name": string, "directory": string }
    /// The directory becomes the NFS export path. NFSv4 with pseudo-root (fsid=0)
    /// means the export path is always "/" from the client perspective.
    /// The created server is removed when the simulator restarts.
    /// </remarks>
    /// <param name="name">Server display name</param>
    /// <param name="directory">NFS export directory on the simulator</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>The created SimulatorServer with NodePort and connection details</returns>
    public async Task<SimulatorServer> CreateNasServerAsync(string name, string directory, CancellationToken ct = default)
    {
        var request = new { name, directory };
        var response = await _http.PostAsJsonAsync("/api/servers/nas", request, ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<SimulatorServer>(json, _jsonOptions)
            ?? throw new InvalidOperationException("Failed to create NAS server");
    }

    /// <summary>
    /// Creates a dynamic FTP server in the file-simulator.
    /// </summary>
    /// <remarks>
    /// POST /api/servers/ftp
    /// Request body: { "name": string, "username": string, "password": string }
    /// Creates an FTP server with passive mode support. BasePath is typically "/" or "/input".
    /// The created server is removed when the simulator restarts.
    /// </remarks>
    /// <param name="name">Server display name</param>
    /// <param name="username">FTP username for authentication</param>
    /// <param name="password">FTP password for authentication</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>The created SimulatorServer with NodePort and credentials</returns>
    public async Task<SimulatorServer> CreateFtpServerAsync(string name, string username, string password, CancellationToken ct = default)
    {
        var request = new { name, username, password };
        var response = await _http.PostAsJsonAsync("/api/servers/ftp", request, ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<SimulatorServer>(json, _jsonOptions)
            ?? throw new InvalidOperationException("Failed to create FTP server");
    }

    /// <summary>
    /// Creates a dynamic SFTP server in the file-simulator.
    /// </summary>
    /// <remarks>
    /// POST /api/servers/sftp
    /// Request body: { "name": string, "username": string, "password": string }
    /// SFTP servers use ChrootDirectory: "/" is read-only, "/data" is writable.
    /// BasePath should be "/data" for file uploads. The created server is removed
    /// when the simulator restarts.
    /// </remarks>
    /// <param name="name">Server display name</param>
    /// <param name="username">SFTP username for authentication</param>
    /// <param name="password">SFTP password for authentication</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>The created SimulatorServer with NodePort and credentials</returns>
    public async Task<SimulatorServer> CreateSftpServerAsync(string name, string username, string password, CancellationToken ct = default)
    {
        var request = new { name, username, password };
        var response = await _http.PostAsJsonAsync("/api/servers/sftp", request, ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<SimulatorServer>(json, _jsonOptions)
            ?? throw new InvalidOperationException("Failed to create SFTP server");
    }
}

using System.Net.Http.Json;
using System.Text.Json;
using DemoDataGenerator.Models;

namespace DemoDataGenerator.Services;

/// <summary>
/// HTTP client for the file-simulator Control API.
/// Provides typed methods for discovering servers and retrieving connection info.
/// </summary>
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
    /// Checks if the file-simulator Control API is reachable and healthy
    /// </summary>
    public async Task<bool> EnsureHealthyAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _http.GetAsync("/api/health", ct);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }

    /// <summary>
    /// Discovers all servers managed by the file-simulator
    /// GET /api/servers
    /// </summary>
    public async Task<List<SimulatorServer>> GetServersAsync(CancellationToken ct = default)
    {
        var response = await _http.GetAsync("/api/servers", ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<List<SimulatorServer>>(json, _jsonOptions) ?? [];
    }

    /// <summary>
    /// Retrieves connection info for all protocols from the file-simulator
    /// GET /api/connection-info?format=json
    /// </summary>
    public async Task<SimulatorConnectionInfo> GetConnectionInfoAsync(CancellationToken ct = default)
    {
        var response = await _http.GetAsync("/api/connection-info?format=json", ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<SimulatorConnectionInfo>(json, _jsonOptions)
            ?? throw new InvalidOperationException("Empty response from simulator");
    }

    /// <summary>
    /// Creates a dynamic NAS server in the file-simulator
    /// POST /api/servers/nas
    /// </summary>
    public async Task<SimulatorServer> CreateNasServerAsync(string name, string directory, CancellationToken ct = default)
    {
        var request = new { name, directory };
        var response = await _http.PostAsJsonAsync("/api/servers/nas", request, ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<SimulatorServer>(json, _jsonOptions)
            ?? throw new InvalidOperationException("Failed to create NAS server");
    }
}

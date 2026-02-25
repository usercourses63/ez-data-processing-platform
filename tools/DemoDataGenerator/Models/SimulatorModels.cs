namespace DemoDataGenerator.Models;

/// <summary>
/// Represents a server instance reported by the file-simulator Control API.
/// Matches the actual /api/servers JSON response shape.
/// </summary>
public record SimulatorServer
{
    public string Name { get; init; } = "";
    public string PodName { get; init; } = "";
    public string Protocol { get; init; } = "";
    public string ServiceName { get; init; } = "";
    public string ClusterIp { get; init; } = "";
    public int Port { get; init; }
    public int NodePort { get; init; }
    public string PodStatus { get; init; } = "";
    public bool PodReady { get; init; }
    public string DiscoveredAt { get; init; } = "";
    public bool IsDynamic { get; init; }
    public string ManagedBy { get; init; } = "";
    public string Directory { get; init; } = "";
    public SimulatorCredentials? Credentials { get; init; }
}

/// <summary>
/// Credentials for a file-simulator server
/// </summary>
public record SimulatorCredentials
{
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
    public string Note { get; init; } = "";
}

/// <summary>
/// Connection information returned by /api/connection-info?format=json.
/// Contains a flat servers array (not protocol-specific sub-objects).
/// </summary>
public record SimulatorConnectionInfo
{
    public string Hostname { get; init; } = "";
    public string GeneratedAt { get; init; } = "";
    public List<ConnectionInfoServer> Servers { get; init; } = [];
    public Dictionary<string, SimulatorCredentials>? DefaultCredentials { get; init; }
    public Dictionary<string, string>? Endpoints { get; init; }
}

/// <summary>
/// A server entry from the connection-info servers array.
/// Each entry has the external host/port for NodePort access.
/// </summary>
public record ConnectionInfoServer
{
    public string Name { get; init; } = "";
    public string Protocol { get; init; } = "";
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public string ClusterIp { get; init; } = "";
    public int ClusterPort { get; init; }
    public string ServiceName { get; init; } = "";
    public bool IsDynamic { get; init; }
    public string Status { get; init; } = "";
    public string? Directory { get; init; }
    public string ConnectionString { get; init; } = "";
    public SimulatorCredentials? Credentials { get; init; }
}

using DataProcessing.Shared.Entities;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service interface for managing admin servers (input/output file servers)
/// </summary>
public interface IServerService
{
    /// <summary>
    /// Get all servers
    /// </summary>
    /// <param name="includeInactive">Whether to include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of servers</returns>
    Task<List<AdminServer>> GetAllServersAsync(bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get servers by direction (input, output, or both)
    /// </summary>
    /// <param name="direction">Server direction filter</param>
    /// <param name="includeInactive">Whether to include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of servers</returns>
    Task<List<AdminServer>> GetServersByDirectionAsync(ServerDirection direction, bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get input servers (servers with Direction = Input or Both)
    /// </summary>
    /// <param name="includeInactive">Whether to include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of input servers</returns>
    Task<List<AdminServer>> GetInputServersAsync(bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get output servers (servers with Direction = Output or Both)
    /// </summary>
    /// <param name="includeInactive">Whether to include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of output servers</returns>
    Task<List<AdminServer>> GetOutputServersAsync(bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a server by ID
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Server or null if not found</returns>
    Task<AdminServer?> GetServerByIdAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get servers by type
    /// </summary>
    /// <param name="serverType">Server type (ftp, sftp, s3, etc.)</param>
    /// <param name="includeInactive">Whether to include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of servers</returns>
    Task<List<AdminServer>> GetServersByTypeAsync(string serverType, bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Create a new server
    /// </summary>
    /// <param name="server">Server to create</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created server</returns>
    Task<AdminServer> CreateServerAsync(AdminServer server, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update an existing server
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="server">Updated server data</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated server or null if not found</returns>
    Task<AdminServer?> UpdateServerAsync(string id, AdminServer server, CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a server (soft delete if in use, hard delete if not)
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if deleted, false if not found</returns>
    Task<bool> DeleteServerAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Test connection to a server
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Connection test result</returns>
    Task<ServerConnectionTestResult> TestConnectionAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Toggle server active status
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="isActive">New active status</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated server or null if not found</returns>
    Task<AdminServer?> ToggleServerActiveAsync(string id, bool isActive, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get count of datasources using a specific server
    /// </summary>
    /// <param name="serverId">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Number of datasources using this server</returns>
    Task<long> GetDataSourceCountByServerAsync(string serverId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get available server types with their direction support
    /// </summary>
    /// <returns>List of server type definitions</returns>
    List<ServerTypeDefinition> GetAvailableServerTypes();
}

/// <summary>
/// Result of a connection test for admin servers
/// </summary>
public class ServerConnectionTestResult
{
    /// <summary>
    /// Whether the connection was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Error message if connection failed
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Time taken to establish connection in milliseconds
    /// </summary>
    public long ConnectionTimeMs { get; set; }

    /// <summary>
    /// Timestamp of the test
    /// </summary>
    public DateTime TestedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Additional details about the connection
    /// </summary>
    public Dictionary<string, string>? Details { get; set; }
}

/// <summary>
/// Definition of a server type and its capabilities
/// </summary>
public class ServerTypeDefinition
{
    /// <summary>
    /// Server type identifier (ftp, sftp, s3, etc.)
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Display name
    /// </summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Display name in Hebrew
    /// </summary>
    public string DisplayNameHe { get; set; } = string.Empty;

    /// <summary>
    /// Whether this type can be used for input
    /// </summary>
    public bool SupportsInput { get; set; }

    /// <summary>
    /// Whether this type can be used for output
    /// </summary>
    public bool SupportsOutput { get; set; }

    /// <summary>
    /// Default port for this server type
    /// </summary>
    public int? DefaultPort { get; set; }

    /// <summary>
    /// Required fields for this server type
    /// </summary>
    public List<string> RequiredFields { get; set; } = new();
}

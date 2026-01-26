using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Factory for creating data source connectors based on server type
/// Resolves the appropriate connector implementation for AdminServer configuration
/// </summary>
public interface IConnectorFactory
{
    /// <summary>
    /// Gets a connector for the specified server
    /// </summary>
    /// <param name="server">Admin server configuration</param>
    /// <returns>Appropriate connector for the server type</returns>
    /// <exception cref="ArgumentException">When server type is not supported</exception>
    IDataSourceConnector GetConnector(AdminServer server);

    /// <summary>
    /// Gets a connector for the specified server type
    /// </summary>
    /// <param name="serverType">Server type identifier (ftp, sftp, s3, etc.)</param>
    /// <returns>Appropriate connector for the server type</returns>
    /// <exception cref="ArgumentException">When server type is not supported</exception>
    IDataSourceConnector GetConnector(string serverType);

    /// <summary>
    /// Checks if a connector is available for the specified server type
    /// </summary>
    /// <param name="serverType">Server type identifier</param>
    /// <returns>True if connector exists for this type</returns>
    bool HasConnector(string serverType);

    /// <summary>
    /// Gets all supported server types
    /// </summary>
    /// <returns>List of supported server type identifiers</returns>
    IReadOnlyList<string> GetSupportedServerTypes();
}

/// <summary>
/// Extended connector interface for connectors that support AdminServer configuration
/// </summary>
public interface IServerConnector : IDataSourceConnector
{
    /// <summary>
    /// Tests connection to the server using AdminServer configuration
    /// </summary>
    /// <param name="server">Admin server configuration</param>
    /// <param name="credentials">Resolved credentials</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Connection test result</returns>
    Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists files from the server
    /// </summary>
    /// <param name="server">Admin server configuration</param>
    /// <param name="credentials">Resolved credentials</param>
    /// <param name="path">Relative path from base</param>
    /// <param name="pattern">File pattern to match</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of discovered files</returns>
    Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads file content from the server
    /// </summary>
    /// <param name="server">Admin server configuration</param>
    /// <param name="credentials">Resolved credentials</param>
    /// <param name="filePath">Full path to the file</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>File content as bytes</returns>
    Task<byte[]> ReadFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Writes file content to the server (for output destinations)
    /// </summary>
    /// <param name="server">Admin server configuration</param>
    /// <param name="credentials">Resolved credentials</param>
    /// <param name="filePath">Destination path</param>
    /// <param name="content">File content</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task WriteFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of a connection test
/// </summary>
public class ConnectionTestResult
{
    /// <summary>
    /// Whether the connection was successful
    /// </summary>
    public bool IsSuccess { get; set; }

    /// <summary>
    /// Error message if connection failed
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Time taken to establish connection in milliseconds
    /// </summary>
    public long ConnectionTimeMs { get; set; }

    /// <summary>
    /// Server version or banner (if available)
    /// </summary>
    public string? ServerInfo { get; set; }

    /// <summary>
    /// Additional details about the connection
    /// </summary>
    public Dictionary<string, string> Details { get; set; } = new();

    /// <summary>
    /// Creates a successful result
    /// </summary>
    public static ConnectionTestResult Success(long connectionTimeMs = 0, string? serverInfo = null) => new()
    {
        IsSuccess = true,
        ConnectionTimeMs = connectionTimeMs,
        ServerInfo = serverInfo
    };

    /// <summary>
    /// Creates a failed result
    /// </summary>
    public static ConnectionTestResult Failure(string errorMessage) => new()
    {
        IsSuccess = false,
        ErrorMessage = errorMessage
    };
}

/// <summary>
/// Represents a file discovered during listing
/// </summary>
public class DiscoveredFile
{
    /// <summary>
    /// Full path to the file on the server
    /// </summary>
    public string FullPath { get; set; } = string.Empty;

    /// <summary>
    /// File name without directory
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// File size in bytes
    /// </summary>
    public long SizeBytes { get; set; }

    /// <summary>
    /// Last modified timestamp (UTC)
    /// </summary>
    public DateTime LastModifiedUtc { get; set; }

    /// <summary>
    /// Whether this is a directory
    /// </summary>
    public bool IsDirectory { get; set; }

    /// <summary>
    /// Content type / MIME type (if detectable)
    /// </summary>
    public string? ContentType { get; set; }

    /// <summary>
    /// Whether the file appears to be an archive
    /// </summary>
    public bool IsArchive { get; set; }

    /// <summary>
    /// Detected archive type (if IsArchive is true)
    /// </summary>
    public string? ArchiveType { get; set; }
}

using DataProcessing.Shared.Connectors;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service interface for file operations (list, read, write) on registered admin servers.
/// Proxies to IServerConnector methods via the ConnectorFactory.
/// </summary>
public interface IFileOperationsService
{
    /// <summary>
    /// List files on a server
    /// </summary>
    /// <param name="serverId">Admin server ID</param>
    /// <param name="path">Relative path from server base (optional)</param>
    /// <param name="pattern">File pattern to match</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of discovered files</returns>
    Task<List<DiscoveredFile>> ListFilesAsync(string serverId, string? path, string pattern, CancellationToken cancellationToken = default);

    /// <summary>
    /// Read a file from a server
    /// </summary>
    /// <param name="serverId">Admin server ID</param>
    /// <param name="filePath">Full path to the file on the server</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>File content as bytes</returns>
    Task<byte[]> ReadFileAsync(string serverId, string filePath, CancellationToken cancellationToken = default);

    /// <summary>
    /// Write a file to a server
    /// </summary>
    /// <param name="serverId">Admin server ID</param>
    /// <param name="filePath">Destination path on the server</param>
    /// <param name="content">File content as bytes</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task WriteFileAsync(string serverId, string filePath, byte[] content, CancellationToken cancellationToken = default);
}

using DataProcessing.Shared.Entities;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Interface for data source connectors that retrieve files from various sources
/// </summary>
public interface IDataSourceConnector
{
    /// <summary>
    /// Gets the connector type identifier (e.g., "local", "ftp", "sftp", "kafka", "http")
    /// </summary>
    string ConnectorType { get; }

    /// <summary>
    /// Reads a file from the data source and returns it as a stream
    /// </summary>
    /// <param name="dataSource">Data source configuration</param>
    /// <param name="filePath">Path to the specific file to read</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Stream containing the file content</returns>
    Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource, 
        string filePath, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists files from the data source matching the specified pattern
    /// </summary>
    /// <param name="dataSource">Data source configuration</param>
    /// <param name="pattern">File pattern to match (e.g., "*.json", "*.xml")</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of file paths matching the pattern</returns>
    Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource, 
        string pattern, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Tests the connection to the data source
    /// </summary>
    /// <param name="dataSource">Data source configuration</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if connection is successful, false otherwise</returns>
    Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets metadata about a specific file (size, last modified date, etc.)
    /// </summary>
    /// <param name="dataSource">Data source configuration</param>
    /// <param name="filePath">Path to the file</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>File metadata information</returns>
    Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource, 
        string filePath, 
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Metadata information about a file
/// </summary>
public class FileMetadata
{
    public string FilePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DateTime LastModifiedUtc { get; set; }
    public DateTime? CreatedUtc { get; set; }
    public string? ContentType { get; set; }
    public Dictionary<string, string> AdditionalProperties { get; set; } = new();
}

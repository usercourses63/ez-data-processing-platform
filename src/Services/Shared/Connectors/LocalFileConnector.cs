using DataProcessing.Shared.Entities;
using Microsoft.Extensions.Logging;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading files from local or network file systems
/// </summary>
public class LocalFileConnector : IDataSourceConnector
{
    private readonly ILogger<LocalFileConnector> _logger;

    public string ConnectorType => "local";

    public LocalFileConnector(ILogger<LocalFileConnector> logger)
    {
        _logger = logger;
    }

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Reading file: {FilePath}", filePath);
            
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"File not found: {filePath}");
            }

            // Read file into memory stream to avoid file locking issues
            var memoryStream = new MemoryStream();
            using (var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                await fileStream.CopyToAsync(memoryStream, cancellationToken);
            }
            
            memoryStream.Position = 0;
            return memoryStream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading file: {FilePath}", filePath);
            throw;
        }
    }

    public Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var basePath = dataSource.FilePath;
            _logger.LogInformation("Listing files in: {BasePath} with pattern: {Pattern}", basePath, pattern);

            if (!Directory.Exists(basePath))
            {
                _logger.LogWarning("Directory not found: {BasePath}", basePath);
                return Task.FromResult(new List<string>());
            }

            var files = Directory.GetFiles(basePath, pattern, SearchOption.TopDirectoryOnly)
                .ToList();

            _logger.LogInformation("Found {Count} files matching pattern", files.Count);
            return Task.FromResult(files);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing files in: {BasePath}", dataSource.FilePath);
            throw;
        }
    }

    public Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var basePath = dataSource.FilePath;
            _logger.LogInformation("Testing connection to: {BasePath}", basePath);

            var exists = Directory.Exists(basePath);
            if (!exists)
            {
                _logger.LogWarning("Directory does not exist: {BasePath}", basePath);
                return Task.FromResult(false);
            }

            // Try to enumerate files to test read permissions
            Directory.EnumerateFiles(basePath).Take(1).ToList();
            
            _logger.LogInformation("Connection test successful for: {BasePath}", basePath);
            return Task.FromResult(true);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogError(ex, "Access denied to directory: {BasePath}", dataSource.FilePath);
            return Task.FromResult(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing connection to: {BasePath}", dataSource.FilePath);
            return Task.FromResult(false);
        }
    }

    public Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"File not found: {filePath}");
            }

            var fileInfo = new FileInfo(filePath);
            var metadata = new FileMetadata
            {
                FilePath = filePath,
                FileName = Path.GetFileName(filePath),
                FileSizeBytes = fileInfo.Length,
                LastModifiedUtc = fileInfo.LastWriteTimeUtc,
                CreatedUtc = fileInfo.CreationTimeUtc,
                ContentType = GetContentType(fileInfo.Extension)
            };

            return Task.FromResult(metadata);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metadata for file: {FilePath}", filePath);
            throw;
        }
    }

    private static string GetContentType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".csv" => "text/csv",
            ".txt" => "text/plain",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls" => "application/vnd.ms-excel",
            _ => "application/octet-stream"
        };
    }
}

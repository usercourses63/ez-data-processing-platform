#pragma warning disable CS1998 // Async methods without await — synchronous file operations implementing async interface
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading files from local or network file systems
/// Also used for NFS via Kubernetes PersistentVolume mounts
/// v0.2.0: Implements IServerConnector for AdminServer support
/// </summary>
public class LocalFileConnector : IDataSourceConnector, IServerConnector
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

            // Use DirectoryInfo.EnumerateFiles instead of Directory.GetFiles
            // This is more compatible with network/FUSE filesystems and doesn't block
            var directoryInfo = new DirectoryInfo(basePath);
            var files = directoryInfo.EnumerateFiles(pattern, SearchOption.TopDirectoryOnly)
                .Select(f => f.FullName)
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

    #region IServerConnector Implementation (AdminServer support for NFS)

    public async Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var basePath = server.BasePath ?? "/";

        try
        {
            _logger.LogInformation("Testing Local/NFS connection: {BasePath}", basePath);

            if (!Directory.Exists(basePath))
            {
                stopwatch.Stop();
                return ConnectionTestResult.Failure($"Directory does not exist: {basePath}");
            }

            // Test read permissions by attempting to enumerate files
            Directory.EnumerateFiles(basePath).Take(1).ToList();

            stopwatch.Stop();
            return ConnectionTestResult.Success(
                stopwatch.ElapsedMilliseconds,
                $"Local/NFS path accessible: {basePath}");
        }
        catch (UnauthorizedAccessException ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Access denied to directory: {BasePath}", basePath);
            return ConnectionTestResult.Failure($"Access denied: {ex.Message}");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Connection test failed: {BasePath}", basePath);
            return ConnectionTestResult.Failure($"Error: {ex.Message}");
        }
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        // Strip leading separators from path to prevent Path.Combine from treating it as rooted
        // (Path.Combine("base", "/sub") returns "/sub" in .NET, discarding the base)
        var relativePath = (path ?? "").TrimStart('/', '\\');
        var basePath = string.IsNullOrEmpty(relativePath)
            ? server.BasePath ?? "/"
            : Path.Combine(server.BasePath ?? "/", relativePath);

        _logger.LogInformation("Listing files in: {BasePath} with pattern: {Pattern}", basePath, pattern);

        if (!Directory.Exists(basePath))
        {
            _logger.LogWarning("Directory not found: {BasePath}", basePath);
            return new List<DiscoveredFile>();
        }

        try
        {
            var directoryInfo = new DirectoryInfo(basePath);
            var files = directoryInfo.EnumerateFiles(pattern, SearchOption.TopDirectoryOnly)
                .Select(f => new DiscoveredFile
                {
                    FullPath = f.FullName,
                    FileName = f.Name,
                    SizeBytes = f.Length,
                    LastModifiedUtc = f.LastWriteTimeUtc,
                    IsDirectory = false,
                    ContentType = GetContentType(f.Extension),
                    IsArchive = IsArchiveExtension(f.Extension),
                    ArchiveType = GetArchiveType(f.Extension)
                })
                .ToList();

            _logger.LogInformation("Found {Count} files matching pattern", files.Count);
            return await Task.FromResult(files);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing files in: {BasePath}", basePath);
            throw;
        }
    }

    public async Task<byte[]> ReadFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        // Construct full path: combine server.BasePath with filePath
        var fullPath = Path.IsPathRooted(filePath)
            ? filePath
            : Path.Combine(server.BasePath ?? "/", filePath);

        _logger.LogInformation("Reading file from Local/NFS: {FilePath}", fullPath);

        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"File not found: {fullPath}");
        }

        return await File.ReadAllBytesAsync(fullPath, cancellationToken);
    }

    public async Task WriteFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        // Construct full path
        var fullPath = Path.IsPathRooted(filePath)
            ? filePath
            : Path.Combine(server.BasePath ?? "/", filePath);

        _logger.LogInformation("Writing file to Local/NFS: {FilePath} ({SizeBytes} bytes)", fullPath, content.Length);

        // Ensure directory exists
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
            _logger.LogDebug("Created directory: {Directory}", directory);
        }

        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);
        _logger.LogInformation("File written successfully: {FilePath}", fullPath);
    }

    private static bool IsArchiveExtension(string extension)
    {
        var ext = extension.ToLowerInvariant();
        return ext is ".zip" or ".tar" or ".gz" or ".tgz" or ".tar.gz" or ".rar" or ".7z";
    }

    private static string? GetArchiveType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".zip" => "zip",
            ".tar" => "tar",
            ".gz" or ".tgz" or ".tar.gz" => "tar.gz",
            ".rar" => "rar",
            ".7z" => "7z",
            _ => null
        };
    }

    #endregion
}

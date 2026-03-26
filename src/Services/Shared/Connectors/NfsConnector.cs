#pragma warning disable CS1998 // Async methods without await — synchronous NFS operations implementing async interface
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading files from NFS via Kubernetes PersistentVolume mounts.
/// NFS shares are mounted to pod filesystem via PVC; this connector accesses those mounts.
///
/// Mount path convention: /mnt/{nas-device-name}
/// Example: NAS device "input-1" mounts to /mnt/input-1
///
/// Key difference from LocalFileConnector:
/// - ConnectorType is "nfs" for explicit NFS identification
/// - Log messages include NFS context for debugging mount issues
/// - Handles mount-not-ready scenarios gracefully
///
/// v0.2.0: Part of NAS/NFS Architecture (Phase 2)
/// </summary>
public class NfsConnector : IDataSourceConnector, IServerConnector
{
    private readonly ILogger<NfsConnector> _logger;

    public string ConnectorType => "nfs";

    public NfsConnector(ILogger<NfsConnector> logger)
    {
        _logger = logger;
    }

    #region IDataSourceConnector Implementation

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Construct full path from mount path + file path
            var fullPath = Path.IsPathRooted(filePath)
                ? filePath
                : Path.Combine(dataSource.FilePath, filePath);

            _logger.LogInformation("NFS: Reading file from mount: {FilePath}", fullPath);

            if (!File.Exists(fullPath))
            {
                _logger.LogWarning("NFS: File not found at mount path: {FilePath}. " +
                    "Verify NFS mount is active and PVC is bound.", fullPath);
                throw new FileNotFoundException($"NFS file not found: {fullPath}");
            }

            // Read file into memory stream to avoid file locking issues on NFS
            var memoryStream = new MemoryStream();
            using (var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                await fileStream.CopyToAsync(memoryStream, cancellationToken);
            }

            memoryStream.Position = 0;
            _logger.LogDebug("NFS: Successfully read {Bytes} bytes from {FilePath}", memoryStream.Length, fullPath);
            return memoryStream;
        }
        catch (FileNotFoundException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "NFS: Error reading file from mount: {FilePath}", filePath);
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
            _logger.LogInformation("NFS: Listing files in mount: {BasePath} with pattern: {Pattern}", basePath, pattern);

            if (!Directory.Exists(basePath))
            {
                _logger.LogWarning("NFS: Mount directory not found: {BasePath}. " +
                    "NFS mount may not be ready or PVC may not be bound.", basePath);
                return Task.FromResult(new List<string>());
            }

            // Use DirectoryInfo.EnumerateFiles - better for network/FUSE filesystems
            // This doesn't block and handles NFS latency gracefully
            var directoryInfo = new DirectoryInfo(basePath);
            var files = directoryInfo.EnumerateFiles(pattern, SearchOption.TopDirectoryOnly)
                .Select(f => f.FullName)
                .ToList();

            _logger.LogInformation("NFS: Found {Count} files matching pattern in mount", files.Count);
            return Task.FromResult(files);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "NFS: Error listing files in mount: {BasePath}", dataSource.FilePath);
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
            _logger.LogInformation("NFS: Testing connection to mount: {BasePath}", basePath);

            var exists = Directory.Exists(basePath);
            if (!exists)
            {
                _logger.LogWarning("NFS: Mount directory does not exist: {BasePath}. " +
                    "Ensure NAS device PVC is created and mounted.", basePath);
                return Task.FromResult(false);
            }

            // Try to enumerate files to test read permissions on NFS mount
            Directory.EnumerateFiles(basePath).Take(1).ToList();

            _logger.LogInformation("NFS: Connection test successful for mount: {BasePath}", basePath);
            return Task.FromResult(true);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogError(ex, "NFS: Access denied to mount directory: {BasePath}. " +
                "Check NFS export permissions.", dataSource.FilePath);
            return Task.FromResult(false);
        }
        catch (IOException ex)
        {
            _logger.LogError(ex, "NFS: I/O error accessing mount: {BasePath}. " +
                "NFS server may be unreachable.", dataSource.FilePath);
            return Task.FromResult(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "NFS: Error testing connection to mount: {BasePath}", dataSource.FilePath);
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
            var fullPath = Path.IsPathRooted(filePath)
                ? filePath
                : Path.Combine(dataSource.FilePath, filePath);

            if (!File.Exists(fullPath))
            {
                _logger.LogWarning("NFS: File not found for metadata: {FilePath}", fullPath);
                throw new FileNotFoundException($"NFS file not found: {fullPath}");
            }

            var fileInfo = new FileInfo(fullPath);
            var metadata = new FileMetadata
            {
                FilePath = fullPath,
                FileName = Path.GetFileName(fullPath),
                FileSizeBytes = fileInfo.Length,
                LastModifiedUtc = fileInfo.LastWriteTimeUtc,
                CreatedUtc = fileInfo.CreationTimeUtc,
                ContentType = GetContentType(fileInfo.Extension)
            };

            return Task.FromResult(metadata);
        }
        catch (FileNotFoundException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "NFS: Error getting metadata for file: {FilePath}", filePath);
            throw;
        }
    }

    #endregion

    #region IServerConnector Implementation (AdminServer support for NAS)

    public async Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var basePath = server.BasePath ?? "/";

        try
        {
            _logger.LogInformation("NFS: Testing connection to NAS mount: {BasePath}", basePath);

            if (!Directory.Exists(basePath))
            {
                stopwatch.Stop();
                _logger.LogWarning("NFS: NAS mount directory does not exist: {BasePath}. " +
                    "Ensure PV/PVC are created and pod has mounted the volume.", basePath);
                return ConnectionTestResult.Failure($"NFS mount directory does not exist: {basePath}");
            }

            // Test read permissions by attempting to enumerate files
            Directory.EnumerateFiles(basePath).Take(1).ToList();

            stopwatch.Stop();
            _logger.LogInformation("NFS: Connection test successful for NAS mount: {BasePath} ({ElapsedMs}ms)",
                basePath, stopwatch.ElapsedMilliseconds);

            return ConnectionTestResult.Success(
                stopwatch.ElapsedMilliseconds,
                $"NFS mount accessible: {basePath}");
        }
        catch (UnauthorizedAccessException ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "NFS: Access denied to NAS mount: {BasePath}", basePath);
            return ConnectionTestResult.Failure($"Access denied to NFS mount: {ex.Message}");
        }
        catch (IOException ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "NFS: I/O error accessing NAS mount: {BasePath}", basePath);
            return ConnectionTestResult.Failure($"NFS I/O error: {ex.Message}");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "NFS: Connection test failed for NAS mount: {BasePath}", basePath);
            return ConnectionTestResult.Failure($"NFS error: {ex.Message}");
        }
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        var basePath = Path.Combine(server.BasePath ?? "/", path ?? "");

        _logger.LogInformation("NFS: Listing files in NAS mount: {BasePath} with pattern: {Pattern}", basePath, pattern);

        if (!Directory.Exists(basePath))
        {
            _logger.LogWarning("NFS: NAS mount directory not found: {BasePath}. " +
                "NFS mount may not be ready.", basePath);
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

            _logger.LogInformation("NFS: Found {Count} files matching pattern in NAS mount", files.Count);
            return await Task.FromResult(files);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "NFS: Error listing files in NAS mount: {BasePath}", basePath);
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

        _logger.LogInformation("NFS: Reading file from NAS mount: {FilePath}", fullPath);

        if (!File.Exists(fullPath))
        {
            _logger.LogWarning("NFS: File not found at NAS mount: {FilePath}", fullPath);
            throw new FileNotFoundException($"NFS file not found: {fullPath}");
        }

        var content = await File.ReadAllBytesAsync(fullPath, cancellationToken);
        _logger.LogDebug("NFS: Successfully read {Bytes} bytes from NAS mount: {FilePath}", content.Length, fullPath);
        return content;
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

        _logger.LogInformation("NFS: Writing file to NAS mount: {FilePath} ({SizeBytes} bytes)", fullPath, content.Length);

        // Ensure directory exists
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
            _logger.LogDebug("NFS: Created directory on NAS mount: {Directory}", directory);
        }

        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);
        _logger.LogInformation("NFS: File written successfully to NAS mount: {FilePath}", fullPath);
    }

    #endregion

    #region Helper Methods

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

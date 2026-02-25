using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using FluentFTP;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using System.Diagnostics;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading files from FTP servers
/// Supports both passive and active FTP modes
/// Implements both legacy DataProcessingDataSource and new AdminServer patterns
/// </summary>
public class FtpConnector : IDataSourceConnector, IServerConnector
{
    private readonly ILogger<FtpConnector> _logger;

    public string ConnectorType => "ftp";

    public FtpConnector(ILogger<FtpConnector> logger)
    {
        _logger = logger;
    }

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        using var client = await CreateFtpClientAsync(dataSource, cancellationToken);
        
        try
        {
            _logger.LogInformation("Reading file from FTP: {FilePath}", filePath);

            // Download file to memory stream
            var memoryStream = new MemoryStream();
            await client.DownloadStream(memoryStream, filePath, token: cancellationToken);
            
            memoryStream.Position = 0;
            return memoryStream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading file from FTP: {FilePath}", filePath);
            throw;
        }
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        using var client = await CreateFtpClientAsync(dataSource, cancellationToken);
        
        try
        {
            var remotePath = dataSource.FilePath;
            _logger.LogInformation("Listing files from FTP: {RemotePath} with pattern: {Pattern}", remotePath, pattern);

            // Get list of files matching pattern
            var items = await client.GetListing(remotePath, cancellationToken);
            
            var files = items
                .Where(item => item.Type == FtpObjectType.File)
                .Where(item => MatchesPattern(item.Name, pattern))
                .Select(item => item.FullName)
                .ToList();

            _logger.LogInformation("Found {Count} files matching pattern on FTP", files.Count);
            return files;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing files from FTP: {RemotePath}", dataSource.FilePath);
            throw;
        }
    }

    public async Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Testing FTP connection to: {Server}", GetFtpConfig(dataSource).Server);
            
            using var client = await CreateFtpClientAsync(dataSource, cancellationToken);
            
            // Try to get server features to verify connection
            await client.GetWorkingDirectory(cancellationToken);
            
            _logger.LogInformation("FTP connection test successful");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FTP connection test failed");
            return false;
        }
    }

    public async Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        using var client = await CreateFtpClientAsync(dataSource, cancellationToken);
        
        try
        {
            var fileInfo = await client.GetObjectInfo(filePath, token: cancellationToken);
            
            if (fileInfo == null || fileInfo.Type != FtpObjectType.File)
            {
                throw new FileNotFoundException($"File not found: {filePath}");
            }

            var metadata = new FileMetadata
            {
                FilePath = filePath,
                FileName = Path.GetFileName(filePath),
                FileSizeBytes = fileInfo.Size,
                LastModifiedUtc = fileInfo.Modified.ToUniversalTime(),
                CreatedUtc = fileInfo.Created != DateTime.MinValue 
                    ? fileInfo.Created.ToUniversalTime() 
                    : null,
                ContentType = GetContentType(Path.GetExtension(filePath))
            };

            metadata.AdditionalProperties["FtpPermissions"] = fileInfo.RawPermissions ?? "";
            metadata.AdditionalProperties["FtpOwner"] = fileInfo.OwnerPermissions.ToString();

            return metadata;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metadata for FTP file: {FilePath}", filePath);
            throw;
        }
    }

    private async Task<AsyncFtpClient> CreateFtpClientAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken)
    {
        var config = GetFtpConfig(dataSource);
        
        var client = new AsyncFtpClient(
            config.Server,
            config.Username,
            config.Password,
            config.Port);

        // Configure client based on settings
        client.Config.DataConnectionType = config.UsePassiveMode 
            ? FtpDataConnectionType.AutoPassive 
            : FtpDataConnectionType.AutoActive;
        
        client.Config.EncryptionMode = config.UseSsl 
            ? FtpEncryptionMode.Explicit 
            : FtpEncryptionMode.None;

        await client.Connect(cancellationToken);
        return client;
    }

    private FtpConfiguration GetFtpConfig(DataProcessingDataSource dataSource)
    {
        var config = new FtpConfiguration
        {
            Server = dataSource.FilePath // Base path contains server
        };

        // Parse additional configuration from BsonDocument
        if (dataSource.AdditionalConfiguration != null)
        {
            if (dataSource.AdditionalConfiguration.Contains("FtpServer"))
                config.Server = dataSource.AdditionalConfiguration["FtpServer"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("FtpPort"))
                config.Port = dataSource.AdditionalConfiguration["FtpPort"].AsInt32;
            
            if (dataSource.AdditionalConfiguration.Contains("FtpUsername"))
                config.Username = dataSource.AdditionalConfiguration["FtpUsername"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("FtpPassword"))
                config.Password = dataSource.AdditionalConfiguration["FtpPassword"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("FtpUsePassiveMode"))
                config.UsePassiveMode = dataSource.AdditionalConfiguration["FtpUsePassiveMode"].AsBoolean;
            
            if (dataSource.AdditionalConfiguration.Contains("FtpUseSsl"))
                config.UseSsl = dataSource.AdditionalConfiguration["FtpUseSsl"].AsBoolean;
        }

        return config;
    }

    private static bool MatchesPattern(string fileName, string pattern)
    {
        if (pattern == "*.*" || pattern == "*")
            return true;

        // Simple wildcard matching
        var regex = "^" + System.Text.RegularExpressions.Regex.Escape(pattern)
            .Replace("\\*", ".*")
            .Replace("\\?", ".") + "$";
        
        return System.Text.RegularExpressions.Regex.IsMatch(fileName, regex, 
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
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

    private class FtpConfiguration
    {
        public string Server { get; set; } = string.Empty;
        public int Port { get; set; } = 21;
        public string Username { get; set; } = "anonymous";
        public string Password { get; set; } = "";
        public bool UsePassiveMode { get; set; } = true;
        public bool UseSsl { get; set; } = false;
    }

    #region IServerConnector Implementation (New - AdminServer)

    public async Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogInformation("Testing FTP connection to: {Server}:{Port}",
                server.Host, server.Port ?? 21);

            using var client = await CreateFtpClientFromServerAsync(server, credentials, cancellationToken);

            var workingDir = await client.GetWorkingDirectory(cancellationToken);
            stopwatch.Stop();

            return ConnectionTestResult.Success(
                stopwatch.ElapsedMilliseconds,
                $"FTP Server, Working Directory: {workingDir}");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "FTP connection test failed: {Server}", server.Host);
            return ConnectionTestResult.Failure($"FTP Error: {ex.Message}");
        }
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        using var client = await CreateFtpClientFromServerAsync(server, credentials, cancellationToken);

        try
        {
            var remotePath = CombinePath(server.BasePath, path);
            _logger.LogInformation("Listing FTP files: {RemotePath} with pattern: {Pattern}",
                remotePath, pattern);

            var items = await client.GetListing(remotePath, cancellationToken);

            var files = new List<DiscoveredFile>();
            foreach (var item in items)
            {
                if (item.Type == FtpObjectType.Directory)
                    continue;

                if (!MatchesPattern(item.Name, pattern))
                    continue;

                var extension = Path.GetExtension(item.Name).ToLowerInvariant();
                var isArchive = IsArchiveExtension(extension);

                files.Add(new DiscoveredFile
                {
                    FullPath = item.FullName,
                    FileName = item.Name,
                    SizeBytes = item.Size,
                    LastModifiedUtc = item.Modified.ToUniversalTime(),
                    IsDirectory = false,
                    ContentType = GetContentType(extension),
                    IsArchive = isArchive,
                    ArchiveType = isArchive ? GetArchiveType(extension) : null
                });
            }

            _logger.LogInformation("Found {Count} files matching pattern on FTP", files.Count);
            return files;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing FTP files: {Server}", server.Host);
            throw new InvalidOperationException($"Failed to list FTP files: {ex.Message}", ex);
        }
    }

    public async Task<byte[]> ReadFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        using var client = await CreateFtpClientFromServerAsync(server, credentials, cancellationToken);

        try
        {
            _logger.LogInformation("Reading file from FTP: {FilePath}", filePath);

            using var memoryStream = new MemoryStream();
            await client.DownloadStream(memoryStream, filePath, token: cancellationToken);

            return memoryStream.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading FTP file: {FilePath}", filePath);
            throw new InvalidOperationException($"Failed to read FTP file: {ex.Message}", ex);
        }
    }

    public async Task WriteFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        using var client = await CreateFtpClientFromServerAsync(server, credentials, cancellationToken);

        try
        {
            _logger.LogInformation("Writing file to FTP: {FilePath} ({Size} bytes)",
                filePath, content.Length);

            using var stream = new MemoryStream(content);
            var status = await client.UploadStream(stream, filePath, FtpRemoteExists.Overwrite,
                createRemoteDir: true, token: cancellationToken);

            if (status != FtpStatus.Success)
            {
                throw new InvalidOperationException($"FTP upload failed with status: {status}");
            }

            _logger.LogInformation("Successfully wrote file to FTP: {FilePath}", filePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error writing FTP file: {FilePath}", filePath);
            throw new InvalidOperationException($"Failed to write FTP file: {ex.Message}", ex);
        }
    }

    private async Task<AsyncFtpClient> CreateFtpClientFromServerAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken)
    {
        var host = server.Host ?? throw new InvalidOperationException("FTP server host is required");
        var port = server.Port ?? 21;

        var client = new AsyncFtpClient(
            host,
            credentials?.Username ?? "anonymous",
            credentials?.Password ?? "",
            port);

        // Configure from TypeSpecificConfig
        var typeConfig = server.TypeSpecificConfig ?? new BsonDocument();
        var usePassiveMode = typeConfig.GetValue("passiveMode", true).AsBoolean;
        var useSsl = typeConfig.GetValue("useSsl", false).AsBoolean;

        client.Config.DataConnectionType = usePassiveMode
            ? FtpDataConnectionType.AutoPassive
            : FtpDataConnectionType.AutoActive;

        client.Config.EncryptionMode = useSsl
            ? FtpEncryptionMode.Explicit
            : FtpEncryptionMode.None;

        client.Config.ConnectTimeout = server.ConnectionTimeoutSeconds * 1000;

        await client.Connect(cancellationToken);
        return client;
    }

    private static string CombinePath(string? basePath, string? relativePath)
    {
        if (string.IsNullOrEmpty(basePath) && string.IsNullOrEmpty(relativePath))
            return "/";

        if (string.IsNullOrEmpty(basePath))
            return relativePath!.StartsWith('/') ? relativePath : "/" + relativePath;

        if (string.IsNullOrEmpty(relativePath))
            return basePath;

        return basePath.TrimEnd('/') + "/" + relativePath.TrimStart('/');
    }

    private static bool IsArchiveExtension(string extension)
    {
        return extension switch
        {
            ".zip" or ".tar" or ".gz" or ".tgz" or ".rar" or ".7z" or ".bz2" => true,
            _ => false
        };
    }

    private static string? GetArchiveType(string extension)
    {
        return extension switch
        {
            ".zip" => "zip",
            ".tar" => "tar",
            ".gz" or ".tgz" => "tar.gz",
            ".rar" => "rar",
            ".7z" => "7z",
            ".bz2" => "bz2",
            _ => null
        };
    }

    #endregion
}

using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Renci.SshNet;
using System.Diagnostics;
using System.Text;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading files from SFTP (SSH File Transfer Protocol) servers
/// Supports password and private key authentication
/// Implements both legacy DataProcessingDataSource and new AdminServer patterns
/// </summary>
public class SftpConnector : IDataSourceConnector, IServerConnector
{
    private readonly ILogger<SftpConnector> _logger;

    public string ConnectorType => "sftp";

    public SftpConnector(ILogger<SftpConnector> logger)
    {
        _logger = logger;
    }

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateSftpClient(dataSource);
        
        try
        {
            await Task.Run(() => client.Connect(), cancellationToken);
            _logger.LogInformation("Reading file from SFTP: {FilePath}", filePath);

            var memoryStream = new MemoryStream();
            client.DownloadFile(filePath, memoryStream);
            
            memoryStream.Position = 0;
            return memoryStream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading file from SFTP: {FilePath}", filePath);
            throw;
        }
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateSftpClient(dataSource);
        
        try
        {
            await Task.Run(() => client.Connect(), cancellationToken);
            var remotePath = dataSource.FilePath;
            _logger.LogInformation("Listing files from SFTP: {RemotePath} with pattern: {Pattern}", remotePath, pattern);

            var files = client.ListDirectory(remotePath)
                .Where(f => f.IsRegularFile)
                .Where(f => MatchesPattern(f.Name, pattern))
                .Select(f => f.FullName)
                .ToList();

            _logger.LogInformation("Found {Count} files matching pattern on SFTP", files.Count);
            return files;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing files from SFTP: {RemotePath}", dataSource.FilePath);
            throw;
        }
    }

    public async Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateSftpClient(dataSource);
        
        try
        {
            _logger.LogInformation("Testing SFTP connection to: {Server}", GetSftpConfig(dataSource).Server);
            await Task.Run(() => client.Connect(), cancellationToken);
            client.Disconnect();
            
            _logger.LogInformation("SFTP connection test successful");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SFTP connection test failed");
            return false;
        }
    }

    public async Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateSftpClient(dataSource);
        
        try
        {
            await Task.Run(() => client.Connect(), cancellationToken);
            var fileInfo = client.Get(filePath);
            
            if (!fileInfo.IsRegularFile)
            {
                throw new FileNotFoundException($"File not found: {filePath}");
            }

            var metadata = new FileMetadata
            {
                FilePath = filePath,
                FileName = fileInfo.Name,
                FileSizeBytes = fileInfo.Length,
                LastModifiedUtc = fileInfo.LastWriteTimeUtc,
                CreatedUtc = null,
                ContentType = GetContentType(Path.GetExtension(filePath))
            };

            metadata.AdditionalProperties["SftpPermissions"] = fileInfo.OwnerCanRead.ToString();
            metadata.AdditionalProperties["SftpUserId"] = fileInfo.UserId.ToString();

            return metadata;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metadata for SFTP file: {FilePath}", filePath);
            throw;
        }
    }

    private SftpClient CreateSftpClient(DataProcessingDataSource dataSource)
    {
        var config = GetSftpConfig(dataSource);
        
        var connectionInfo = new ConnectionInfo(
            config.Server,
            config.Port,
            config.Username,
            new PasswordAuthenticationMethod(config.Username, config.Password));

        return new SftpClient(connectionInfo);
    }

    private SftpConfiguration GetSftpConfig(DataProcessingDataSource dataSource)
    {
        var config = new SftpConfiguration
        {
            Server = dataSource.FilePath
        };

        if (dataSource.AdditionalConfiguration != null)
        {
            if (dataSource.AdditionalConfiguration.Contains("SftpServer"))
                config.Server = dataSource.AdditionalConfiguration["SftpServer"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("SftpPort"))
                config.Port = dataSource.AdditionalConfiguration["SftpPort"].AsInt32;
            
            if (dataSource.AdditionalConfiguration.Contains("SftpUsername"))
                config.Username = dataSource.AdditionalConfiguration["SftpUsername"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("SftpPassword"))
                config.Password = dataSource.AdditionalConfiguration["SftpPassword"].AsString;
        }

        return config;
    }

    private static bool MatchesPattern(string fileName, string pattern)
    {
        if (pattern == "*.*" || pattern == "*")
            return true;

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

    private class SftpConfiguration
    {
        public string Server { get; set; } = string.Empty;
        public int Port { get; set; } = 22;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
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
            _logger.LogInformation("Testing SFTP connection to: {Server}:{Port}",
                server.Host, server.Port ?? 22);

            using var client = CreateSftpClientFromServer(server, credentials);
            await Task.Run(() => client.Connect(), cancellationToken);

            var workingDir = client.WorkingDirectory;
            client.Disconnect();
            stopwatch.Stop();

            return ConnectionTestResult.Success(
                stopwatch.ElapsedMilliseconds,
                $"SFTP Server, Working Directory: {workingDir}");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "SFTP connection test failed: {Server}", server.Host);
            return ConnectionTestResult.Failure($"SFTP Error: {ex.Message}");
        }
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateSftpClientFromServer(server, credentials);

        try
        {
            await Task.Run(() => client.Connect(), cancellationToken);
            var remotePath = CombinePath(server.BasePath, path);
            _logger.LogInformation("Listing SFTP files: {RemotePath} with pattern: {Pattern}",
                remotePath, pattern);

            var items = client.ListDirectory(remotePath);

            var files = new List<DiscoveredFile>();
            foreach (var item in items)
            {
                if (!item.IsRegularFile)
                    continue;

                if (!MatchesPattern(item.Name, pattern))
                    continue;

                var extension = Path.GetExtension(item.Name).ToLowerInvariant();
                var isArchive = IsArchiveExtension(extension);

                files.Add(new DiscoveredFile
                {
                    FullPath = item.FullName,
                    FileName = item.Name,
                    SizeBytes = item.Length,
                    LastModifiedUtc = item.LastWriteTimeUtc,
                    IsDirectory = false,
                    ContentType = GetContentType(extension),
                    IsArchive = isArchive,
                    ArchiveType = isArchive ? GetArchiveType(extension) : null
                });
            }

            _logger.LogInformation("Found {Count} files matching pattern on SFTP", files.Count);
            return files;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing SFTP files: {Server}", server.Host);
            throw new InvalidOperationException($"Failed to list SFTP files: {ex.Message}", ex);
        }
    }

    public async Task<byte[]> ReadFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateSftpClientFromServer(server, credentials);

        try
        {
            await Task.Run(() => client.Connect(), cancellationToken);
            var fullPath = CombinePath(server.BasePath, filePath);
            _logger.LogInformation("Reading file from SFTP: {FilePath} (resolved: {FullPath})", filePath, fullPath);

            using var memoryStream = new MemoryStream();
            client.DownloadFile(fullPath, memoryStream);

            return memoryStream.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading SFTP file: {FilePath}", filePath);
            throw new InvalidOperationException($"Failed to read SFTP file: {ex.Message}", ex);
        }
    }

    public async Task WriteFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateSftpClientFromServer(server, credentials);

        try
        {
            await Task.Run(() => client.Connect(), cancellationToken);
            var fullPath = CombinePath(server.BasePath, filePath);
            _logger.LogInformation("Writing file to SFTP: {FilePath} (resolved: {FullPath}, {Size} bytes)",
                filePath, fullPath, content.Length);

            // Ensure directory exists
            var directory = Path.GetDirectoryName(fullPath)?.Replace('\\', '/');
            if (!string.IsNullOrEmpty(directory) && !client.Exists(directory))
            {
                CreateDirectoryRecursively(client, directory);
            }

            // Delete existing file if it exists (to emulate overwrite)
            if (client.Exists(fullPath))
            {
                client.DeleteFile(fullPath);
            }

            using var stream = new MemoryStream(content);
            client.UploadFile(stream, fullPath);

            _logger.LogInformation("Successfully wrote file to SFTP: {FilePath}", filePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error writing SFTP file: {FilePath}", filePath);
            throw new InvalidOperationException($"Failed to write SFTP file: {ex.Message}", ex);
        }
    }

    private SftpClient CreateSftpClientFromServer(AdminServer server, ServerCredentials? credentials)
    {
        var host = server.Host ?? throw new InvalidOperationException("SFTP server host is required");
        var port = server.Port ?? 22;
        var username = credentials?.Username ?? throw new InvalidOperationException("SFTP username is required");

        var typeConfig = server.TypeSpecificConfig ?? new BsonDocument();
        var useKeyAuth = typeConfig.GetValue("useKeyAuth", false).AsBoolean;

        ConnectionInfo connectionInfo;

        if (useKeyAuth && !string.IsNullOrEmpty(credentials?.PrivateKey))
        {
            // Private key authentication
            var keyStream = new MemoryStream(Encoding.UTF8.GetBytes(credentials.PrivateKey));
            PrivateKeyFile keyFile;

            if (!string.IsNullOrEmpty(credentials.PrivateKeyPassphrase))
            {
                keyFile = new PrivateKeyFile(keyStream, credentials.PrivateKeyPassphrase);
            }
            else
            {
                keyFile = new PrivateKeyFile(keyStream);
            }

            connectionInfo = new ConnectionInfo(
                host,
                port,
                username,
                new PrivateKeyAuthenticationMethod(username, keyFile));

            _logger.LogDebug("Using private key authentication for SFTP");
        }
        else
        {
            // Password authentication
            var password = credentials?.Password ?? string.Empty;
            connectionInfo = new ConnectionInfo(
                host,
                port,
                username,
                new PasswordAuthenticationMethod(username, password));

            _logger.LogDebug("Using password authentication for SFTP");
        }

        connectionInfo.Timeout = TimeSpan.FromSeconds(server.ConnectionTimeoutSeconds);

        return new SftpClient(connectionInfo);
    }

    private void CreateDirectoryRecursively(SftpClient client, string path)
    {
        var parts = path.Split('/').Where(p => !string.IsNullOrEmpty(p)).ToArray();
        var currentPath = "";

        foreach (var part in parts)
        {
            currentPath = currentPath + "/" + part;
            if (!client.Exists(currentPath))
            {
                client.CreateDirectory(currentPath);
            }
        }
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

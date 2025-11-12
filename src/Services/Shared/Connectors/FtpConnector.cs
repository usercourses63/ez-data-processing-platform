using DataProcessing.Shared.Entities;
using FluentFTP;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading files from FTP servers
/// Supports both passive and active FTP modes
/// </summary>
public class FtpConnector : IDataSourceConnector
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
}

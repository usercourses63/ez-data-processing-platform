using DataProcessing.Shared.Entities;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Renci.SshNet;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading files from SFTP (SSH File Transfer Protocol) servers
/// </summary>
public class SftpConnector : IDataSourceConnector
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
}

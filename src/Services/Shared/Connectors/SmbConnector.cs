using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using Microsoft.Extensions.Logging;
using SMBLibrary;
using SMBLibrary.Client;
using System.Diagnostics;
using System.Net;
using System.Text.RegularExpressions;
using SmbFileAttributes = SMBLibrary.FileAttributes;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading/writing files via SMB protocol.
/// Uses SMBLibrary for SMB 2/3 support.
/// Note: SMB requires port 445; NodePort mapping doesn't work.
/// Use minikube tunnel for testing against file-simulator.
/// </summary>
public class SmbConnector : IDataSourceConnector, IServerConnector
{
    private readonly ILogger<SmbConnector> _logger;

    public string ConnectorType => "smb";

    public SmbConnector(ILogger<SmbConnector> logger)
    {
        _logger = logger;
    }

    #region IDataSourceConnector Implementation (Legacy - DataProcessingDataSource)

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        var config = GetSmbConfig(dataSource);
        var content = await ReadFileInternalAsync(config, filePath, cancellationToken);
        return new MemoryStream(content);
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        var config = GetSmbConfig(dataSource);
        var files = await ListFilesInternalAsync(config, dataSource.FilePath, pattern, cancellationToken);
        return files.Select(f => f.FullPath).ToList();
    }

    public async Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var config = GetSmbConfig(dataSource);
            await TestConnectionInternalAsync(config, cancellationToken);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        var config = GetSmbConfig(dataSource);
        var files = await ListFilesInternalAsync(config, Path.GetDirectoryName(filePath),
            Path.GetFileName(filePath), cancellationToken);

        var file = files.FirstOrDefault();
        if (file == null)
        {
            throw new FileNotFoundException($"File not found: {filePath}");
        }

        return new FileMetadata
        {
            FilePath = filePath,
            FileName = file.FileName,
            FileSizeBytes = file.SizeBytes,
            LastModifiedUtc = file.LastModifiedUtc,
            ContentType = file.ContentType
        };
    }

    #endregion

    #region IServerConnector Implementation (New - AdminServer)

    public async Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            var config = GetSmbConfigFromServer(server, credentials);
            await TestConnectionInternalAsync(config, cancellationToken);
            stopwatch.Stop();

            return ConnectionTestResult.Success(
                stopwatch.ElapsedMilliseconds,
                $"SMB Server connected, Share: {config.ShareName}");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "SMB connection test failed: {Server}", server.Host);
            return ConnectionTestResult.Failure($"SMB Error: {ex.Message}");
        }
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        var config = GetSmbConfigFromServer(server, credentials);
        var remotePath = CombinePath(server.BasePath, path);
        return await ListFilesInternalAsync(config, remotePath, pattern, cancellationToken);
    }

    public async Task<byte[]> ReadFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        var config = GetSmbConfigFromServer(server, credentials);
        return await ReadFileInternalAsync(config, filePath, cancellationToken);
    }

    public async Task WriteFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        var config = GetSmbConfigFromServer(server, credentials);
        await WriteFileInternalAsync(config, filePath, content, cancellationToken);
    }

    #endregion

    #region Internal Operations

    private async Task TestConnectionInternalAsync(SmbConfig config, CancellationToken cancellationToken)
    {
        // Resolve hostname to IP address if needed (outside the Task.Run for proper async/await)
        var ipAddress = await ResolveHostAsync(config.Host);

        await Task.Run(() =>
        {
            var client = new SMB2Client();

            try
            {
                _logger.LogInformation("Testing SMB connection to: {Host} (port 445 required)",
                    config.Host);

                // Note: SMBLibrary DirectTCPTransport always uses port 445 - custom ports not supported
                bool connected = client.Connect(
                    ipAddress,
                    SMBTransportType.DirectTCPTransport);

                if (!connected)
                {
                    throw new InvalidOperationException($"Failed to connect to SMB server at {config.Host}:445 (SMB requires port 445)");
                }

                var status = client.Login(
                    config.Domain,
                    config.Username,
                    config.Password);

                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Disconnect();
                    throw new UnauthorizedAccessException($"SMB login failed with status: {status}");
                }

                // Try to access the share
                var shares = client.ListShares(out status);
                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Logoff();
                    client.Disconnect();
                    throw new InvalidOperationException($"Failed to list shares: {status}");
                }

                if (!string.IsNullOrEmpty(config.ShareName))
                {
                    ISMBFileStore fileStore = client.TreeConnect(config.ShareName, out status);
                    if (status != NTStatus.STATUS_SUCCESS)
                    {
                        client.Logoff();
                        client.Disconnect();
                        throw new InvalidOperationException($"Failed to connect to share '{config.ShareName}': {status}");
                    }
                    fileStore.Disconnect();
                }

                client.Logoff();
                client.Disconnect();

                _logger.LogInformation("SMB connection test successful");
            }
            catch
            {
                client.Disconnect();
                throw;
            }
        }, cancellationToken);
    }

    private async Task<List<DiscoveredFile>> ListFilesInternalAsync(
        SmbConfig config,
        string? path,
        string pattern,
        CancellationToken cancellationToken)
    {
        // Resolve hostname to IP address before starting the synchronous operation
        var ipAddress = await ResolveHostAsync(config.Host);

        return await Task.Run(() =>
        {
            var files = new List<DiscoveredFile>();
            var client = new SMB2Client();

            try
            {
                // Note: SMBLibrary DirectTCPTransport always uses port 445
                bool connected = client.Connect(
                    ipAddress,
                    SMBTransportType.DirectTCPTransport);

                if (!connected)
                {
                    throw new InvalidOperationException($"Failed to connect to SMB server at {config.Host}:445");
                }

                var status = client.Login(config.Domain, config.Username, config.Password);
                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Disconnect();
                    throw new UnauthorizedAccessException($"SMB login failed: {status}");
                }

                ISMBFileStore fileStore = client.TreeConnect(config.ShareName, out status);
                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Logoff();
                    client.Disconnect();
                    throw new InvalidOperationException($"Failed to connect to share: {status}");
                }

                try
                {
                    var searchPath = NormalizeSmbPath(path ?? "");
                    if (!string.IsNullOrEmpty(searchPath) && !searchPath.EndsWith("\\"))
                    {
                        searchPath += "\\";
                    }
                    searchPath += "*";

                    _logger.LogInformation("Listing SMB files: {Share}/{Path} with pattern: {Pattern}",
                        config.ShareName, path, pattern);

                    status = fileStore.CreateFile(
                        out object directoryHandle,
                        out FileStatus fileStatus,
                        searchPath.TrimEnd('*').TrimEnd('\\'),
                        AccessMask.GENERIC_READ,
                        SmbFileAttributes.Directory,
                        ShareAccess.Read | ShareAccess.Write,
                        CreateDisposition.FILE_OPEN,
                        CreateOptions.FILE_DIRECTORY_FILE,
                        null);

                    if (status == NTStatus.STATUS_SUCCESS)
                    {
                        List<QueryDirectoryFileInformation> fileList;
                        status = fileStore.QueryDirectory(
                            out fileList,
                            directoryHandle,
                            "*",
                            FileInformationClass.FileDirectoryInformation);

                        if (status == NTStatus.STATUS_SUCCESS || status == NTStatus.STATUS_NO_MORE_FILES)
                        {
                            foreach (var fileInfo in fileList)
                            {
                                if (fileInfo is FileDirectoryInformation info)
                                {
                                    // Skip . and .. directories
                                    if (info.FileName == "." || info.FileName == "..")
                                        continue;

                                    var isDirectory = (info.FileAttributes & SmbFileAttributes.Directory) != 0;

                                    // Skip directories
                                    if (isDirectory)
                                        continue;

                                    // Apply pattern filter
                                    if (!MatchesPattern(info.FileName, pattern))
                                        continue;

                                    var basePath = string.IsNullOrEmpty(path) ? "" : path.TrimEnd('\\', '/');
                                    var fullPath = string.IsNullOrEmpty(basePath)
                                        ? info.FileName
                                        : $"{basePath}\\{info.FileName}";

                                    var extension = Path.GetExtension(info.FileName).ToLowerInvariant();
                                    var isArchive = IsArchiveExtension(extension);

                                    files.Add(new DiscoveredFile
                                    {
                                        FullPath = fullPath,
                                        FileName = info.FileName,
                                        SizeBytes = info.AllocationSize,
                                        LastModifiedUtc = info.LastWriteTime.ToUniversalTime(),
                                        IsDirectory = false,
                                        ContentType = GetContentType(extension),
                                        IsArchive = isArchive,
                                        ArchiveType = isArchive ? GetArchiveType(extension) : null
                                    });
                                }
                            }
                        }

                        fileStore.CloseFile(directoryHandle);
                    }

                    _logger.LogInformation("Found {Count} files matching pattern on SMB share", files.Count);
                }
                finally
                {
                    fileStore.Disconnect();
                    client.Logoff();
                    client.Disconnect();
                }
            }
            catch
            {
                client.Disconnect();
                throw;
            }

            return files;
        }, cancellationToken);
    }

    private async Task<byte[]> ReadFileInternalAsync(
        SmbConfig config,
        string filePath,
        CancellationToken cancellationToken)
    {
        // Resolve hostname to IP address before starting the synchronous operation
        var ipAddress = await ResolveHostAsync(config.Host);

        return await Task.Run(() =>
        {
            var client = new SMB2Client();

            try
            {
                // Note: SMBLibrary DirectTCPTransport always uses port 445
                bool connected = client.Connect(
                    ipAddress,
                    SMBTransportType.DirectTCPTransport);

                if (!connected)
                {
                    throw new InvalidOperationException($"Failed to connect to SMB server at {config.Host}:445");
                }

                var status = client.Login(config.Domain, config.Username, config.Password);
                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Disconnect();
                    throw new UnauthorizedAccessException($"SMB login failed: {status}");
                }

                ISMBFileStore fileStore = client.TreeConnect(config.ShareName, out status);
                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Logoff();
                    client.Disconnect();
                    throw new InvalidOperationException($"Failed to connect to share: {status}");
                }

                try
                {
                    var smbPath = NormalizeSmbPath(filePath);
                    _logger.LogInformation("Reading file from SMB: {Share}/{Path}", config.ShareName, smbPath);

                    status = fileStore.CreateFile(
                        out object fileHandle,
                        out FileStatus fileStatus,
                        smbPath,
                        AccessMask.GENERIC_READ | AccessMask.SYNCHRONIZE,
                        SmbFileAttributes.Normal,
                        ShareAccess.Read,
                        CreateDisposition.FILE_OPEN,
                        CreateOptions.FILE_NON_DIRECTORY_FILE | CreateOptions.FILE_SYNCHRONOUS_IO_ALERT,
                        null);

                    if (status != NTStatus.STATUS_SUCCESS)
                    {
                        throw new FileNotFoundException($"Failed to open file '{filePath}': {status}");
                    }

                    try
                    {
                        using var memoryStream = new MemoryStream();
                        long offset = 0;
                        const int maxReadSize = 65536; // 64KB chunks

                        while (true)
                        {
                            status = fileStore.ReadFile(
                                out byte[] data,
                                fileHandle,
                                offset,
                                maxReadSize);

                            if (status != NTStatus.STATUS_SUCCESS && status != NTStatus.STATUS_END_OF_FILE)
                            {
                                throw new IOException($"Failed to read file: {status}");
                            }

                            if (data.Length == 0)
                                break;

                            memoryStream.Write(data, 0, data.Length);
                            offset += data.Length;

                            if (status == NTStatus.STATUS_END_OF_FILE || data.Length < maxReadSize)
                                break;
                        }

                        _logger.LogInformation("Read {Size} bytes from SMB file", memoryStream.Length);
                        return memoryStream.ToArray();
                    }
                    finally
                    {
                        fileStore.CloseFile(fileHandle);
                    }
                }
                finally
                {
                    fileStore.Disconnect();
                    client.Logoff();
                    client.Disconnect();
                }
            }
            catch
            {
                client.Disconnect();
                throw;
            }
        }, cancellationToken);
    }

    private async Task WriteFileInternalAsync(
        SmbConfig config,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken)
    {
        // Resolve hostname to IP address before starting the synchronous operation
        var ipAddress = await ResolveHostAsync(config.Host);

        await Task.Run(() =>
        {
            var client = new SMB2Client();

            try
            {
                // Note: SMBLibrary DirectTCPTransport always uses port 445
                bool connected = client.Connect(
                    ipAddress,
                    SMBTransportType.DirectTCPTransport);

                if (!connected)
                {
                    throw new InvalidOperationException($"Failed to connect to SMB server at {config.Host}:445");
                }

                var status = client.Login(config.Domain, config.Username, config.Password);
                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Disconnect();
                    throw new UnauthorizedAccessException($"SMB login failed: {status}");
                }

                ISMBFileStore fileStore = client.TreeConnect(config.ShareName, out status);
                if (status != NTStatus.STATUS_SUCCESS)
                {
                    client.Logoff();
                    client.Disconnect();
                    throw new InvalidOperationException($"Failed to connect to share: {status}");
                }

                try
                {
                    var smbPath = NormalizeSmbPath(filePath);
                    _logger.LogInformation("Writing file to SMB: {Share}/{Path} ({Size} bytes)",
                        config.ShareName, smbPath, content.Length);

                    // Create directory if needed
                    var directory = Path.GetDirectoryName(smbPath);
                    if (!string.IsNullOrEmpty(directory))
                    {
                        CreateDirectoryIfNeeded(fileStore, directory);
                    }

                    status = fileStore.CreateFile(
                        out object fileHandle,
                        out FileStatus fileStatus,
                        smbPath,
                        AccessMask.GENERIC_WRITE | AccessMask.SYNCHRONIZE,
                        SmbFileAttributes.Normal,
                        ShareAccess.None,
                        CreateDisposition.FILE_OVERWRITE_IF,
                        CreateOptions.FILE_NON_DIRECTORY_FILE | CreateOptions.FILE_SYNCHRONOUS_IO_ALERT,
                        null);

                    if (status != NTStatus.STATUS_SUCCESS)
                    {
                        throw new IOException($"Failed to create/open file '{filePath}': {status}");
                    }

                    try
                    {
                        int offset = 0;
                        const int maxWriteSize = 65536; // 64KB chunks

                        while (offset < content.Length)
                        {
                            int writeLength = Math.Min(maxWriteSize, content.Length - offset);
                            byte[] chunk = new byte[writeLength];
                            Array.Copy(content, offset, chunk, 0, writeLength);

                            status = fileStore.WriteFile(out int numberOfBytesWritten, fileHandle, offset, chunk);
                            if (status != NTStatus.STATUS_SUCCESS)
                            {
                                throw new IOException($"Failed to write to file: {status}");
                            }

                            offset += numberOfBytesWritten;
                        }

                        _logger.LogInformation("Successfully wrote {Size} bytes to SMB file", content.Length);
                    }
                    finally
                    {
                        fileStore.CloseFile(fileHandle);
                    }
                }
                finally
                {
                    fileStore.Disconnect();
                    client.Logoff();
                    client.Disconnect();
                }
            }
            catch
            {
                client.Disconnect();
                throw;
            }
        }, cancellationToken);
    }

    private void CreateDirectoryIfNeeded(ISMBFileStore fileStore, string directoryPath)
    {
        var status = fileStore.CreateFile(
            out object dirHandle,
            out FileStatus fileStatus,
            directoryPath,
            AccessMask.GENERIC_READ,
            SmbFileAttributes.Directory,
            ShareAccess.Read | ShareAccess.Write,
            CreateDisposition.FILE_OPEN_IF,
            CreateOptions.FILE_DIRECTORY_FILE,
            null);

        if (status == NTStatus.STATUS_SUCCESS)
        {
            fileStore.CloseFile(dirHandle);
        }
        // Ignore errors - directory might already exist or parent might need creation
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Resolves a hostname to an IP address. If the input is already an IP address, returns it directly.
    /// </summary>
    private async Task<IPAddress> ResolveHostAsync(string hostOrIp)
    {
        // First, try to parse as an IP address
        if (IPAddress.TryParse(hostOrIp, out var ipAddress))
        {
            return ipAddress;
        }

        // It's a hostname, resolve it via DNS
        try
        {
            _logger.LogDebug("Resolving hostname {Host} to IP address", hostOrIp);
            var addresses = await Dns.GetHostAddressesAsync(hostOrIp);

            if (addresses.Length == 0)
            {
                throw new InvalidOperationException($"Failed to resolve hostname '{hostOrIp}' to an IP address");
            }

            // Prefer IPv4 addresses for SMB compatibility
            var preferredAddress = addresses.FirstOrDefault(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                                   ?? addresses[0];

            _logger.LogDebug("Resolved {Host} to {IpAddress}", hostOrIp, preferredAddress);
            return preferredAddress;
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException($"Failed to resolve hostname '{hostOrIp}': {ex.Message}", ex);
        }
    }

    private SmbConfig GetSmbConfig(DataProcessingDataSource dataSource)
    {
        var config = new SmbConfig();
        var additionalConfig = dataSource.AdditionalConfiguration;

        if (additionalConfig != null)
        {
            if (additionalConfig.Contains("SmbServer") || additionalConfig.Contains("Host"))
                config.Host = (additionalConfig.GetValue("SmbServer", additionalConfig.GetValue("Host", ""))).AsString;
            if (additionalConfig.Contains("SmbPort") || additionalConfig.Contains("Port"))
                config.Port = (additionalConfig.GetValue("SmbPort", additionalConfig.GetValue("Port", 445))).AsInt32;
            if (additionalConfig.Contains("SmbUsername") || additionalConfig.Contains("Username"))
                config.Username = (additionalConfig.GetValue("SmbUsername", additionalConfig.GetValue("Username", ""))).AsString;
            if (additionalConfig.Contains("SmbPassword") || additionalConfig.Contains("Password"))
                config.Password = (additionalConfig.GetValue("SmbPassword", additionalConfig.GetValue("Password", ""))).AsString;
            if (additionalConfig.Contains("SmbDomain") || additionalConfig.Contains("Domain"))
                config.Domain = (additionalConfig.GetValue("SmbDomain", additionalConfig.GetValue("Domain", ""))).AsString;
            if (additionalConfig.Contains("SmbShare") || additionalConfig.Contains("ShareName"))
                config.ShareName = (additionalConfig.GetValue("SmbShare", additionalConfig.GetValue("ShareName", ""))).AsString;
        }

        return config;
    }

    private SmbConfig GetSmbConfigFromServer(AdminServer server, ServerCredentials? credentials)
    {
        var typeConfig = server.TypeSpecificConfig ?? new MongoDB.Bson.BsonDocument();

        // Share name is typically stored in BasePath for SMB
        var shareName = server.BasePath?.Trim('/').Trim('\\').Split('/', '\\').FirstOrDefault() ?? "files";
        if (typeConfig.Contains("ShareName"))
        {
            shareName = typeConfig.GetValue("ShareName").AsString;
        }

        return new SmbConfig
        {
            Host = server.Host ?? throw new InvalidOperationException("SMB server host is required"),
            Port = server.Port ?? 445,
            Username = credentials?.Username ?? typeConfig.GetValue("Username", "guest").AsString,
            Password = credentials?.Password ?? typeConfig.GetValue("Password", "").AsString,
            Domain = typeConfig.GetValue("Domain", "").AsString,
            ShareName = shareName
        };
    }

    private static string NormalizeSmbPath(string path)
    {
        if (string.IsNullOrEmpty(path))
            return "";

        // Convert forward slashes to backslashes
        path = path.Replace('/', '\\');
        // Remove leading backslash
        return path.TrimStart('\\');
    }

    private static string CombinePath(string? basePath, string? relativePath)
    {
        if (string.IsNullOrEmpty(basePath) && string.IsNullOrEmpty(relativePath))
            return "";

        if (string.IsNullOrEmpty(basePath))
            return relativePath ?? "";

        if (string.IsNullOrEmpty(relativePath))
            return basePath;

        return basePath.TrimEnd('\\', '/') + "\\" + relativePath.TrimStart('\\', '/');
    }

    private static bool MatchesPattern(string fileName, string pattern)
    {
        if (string.IsNullOrEmpty(pattern) || pattern == "*" || pattern == "*.*")
            return true;

        var regexPattern = "^" + Regex.Escape(pattern)
            .Replace("\\*", ".*")
            .Replace("\\?", ".") + "$";

        return Regex.IsMatch(fileName, regexPattern, RegexOptions.IgnoreCase);
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
            ".zip" => "application/zip",
            ".gz" or ".tgz" => "application/gzip",
            ".tar" => "application/x-tar",
            ".rar" => "application/vnd.rar",
            ".7z" => "application/x-7z-compressed",
            _ => "application/octet-stream"
        };
    }

    #endregion

    #region Configuration Class

    private class SmbConfig
    {
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; } = 445;
        public string Username { get; set; } = "guest";
        public string Password { get; set; } = string.Empty;
        public string Domain { get; set; } = string.Empty;
        public string ShareName { get; set; } = "files";
    }

    #endregion
}

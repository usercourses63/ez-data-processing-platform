// FtpOutputHandler.cs - FTP/FTPS Output Handler
// v0.2.0: External File Access Support
// Date: January 26, 2026

using System.Diagnostics;
using System.Text;
using FluentFTP;
using DataProcessing.Shared.Entities;
using DataProcessing.Output.Models;

namespace DataProcessing.Output.Handlers;

/// <summary>
/// Handles output to FTP/FTPS servers
/// </summary>
public class FtpOutputHandler : IOutputHandler
{
    private readonly ILogger<FtpOutputHandler> _logger;

    public FtpOutputHandler(ILogger<FtpOutputHandler> logger)
    {
        _logger = logger;
    }

    public bool CanHandle(string destinationType) => destinationType == "ftp";

    public async Task<OutputResult> WriteAsync(
        OutputDestination destination,
        string content,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            if (destination.FtpConfig == null)
            {
                throw new ArgumentException("FtpConfig is required for FTP destination type");
            }

            var config = destination.FtpConfig;

            _logger.LogInformation(
                "Writing to FTP: {Host}:{Port}{Path}, file={FileName}, destination={Destination}",
                config.Host, config.Port, config.RemotePath, fileName, destination.Name);

            // Build remote path
            var remotePath = BuildRemotePath(config, fileName, destination.Name);

            // Create FTP client
            using var client = CreateFtpClient(config);
            await client.Connect(cancellationToken);

            try
            {
                // Ensure directory exists
                var directory = Path.GetDirectoryName(remotePath)?.Replace('\\', '/');
                if (!string.IsNullOrEmpty(directory) && !await client.DirectoryExists(directory, cancellationToken))
                {
                    await client.CreateDirectory(directory, true, cancellationToken);
                    _logger.LogDebug("Created FTP directory: {Path}", directory);
                }

                // Upload file
                var contentBytes = Encoding.UTF8.GetBytes(content);
                using var stream = new MemoryStream(contentBytes);

                var status = await client.UploadStream(stream, remotePath, FtpRemoteExists.Overwrite, true, null, cancellationToken);

                if (status == FtpStatus.Success)
                {
                    _logger.LogInformation(
                        "Successfully wrote to FTP: {Host}:{Port}{Path}, size={Size} bytes",
                        config.Host, config.Port, remotePath, content.Length);

                    stopwatch.Stop();

                    return OutputResult.Successful(
                        destination.Name,
                        "ftp",
                        content.Length,
                        stopwatch.Elapsed);
                }
                else
                {
                    throw new Exception($"FTP upload failed with status: {status}");
                }
            }
            finally
            {
                await client.Disconnect(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            _logger.LogError(
                ex,
                "Failed to write to FTP destination {Destination}, host={Host}:{Port}",
                destination.Name,
                destination.FtpConfig?.Host,
                destination.FtpConfig?.Port);

            return OutputResult.Failure(
                destination.Name,
                "ftp",
                ex.Message);
        }
    }

    private AsyncFtpClient CreateFtpClient(FtpOutputConfig config)
    {
        var client = new AsyncFtpClient(config.Host, config.Username, config.Password, config.Port);

        // Configure connection settings
        client.Config.ConnectTimeout = 30000; // 30 seconds
        client.Config.ReadTimeout = 60000; // 60 seconds
        client.Config.DataConnectionConnectTimeout = 30000;
        client.Config.DataConnectionReadTimeout = 60000;

        // Configure passive mode
        if (config.UsePassiveMode)
        {
            client.Config.DataConnectionType = FtpDataConnectionType.AutoPassive;
        }
        else
        {
            client.Config.DataConnectionType = FtpDataConnectionType.AutoActive;
        }

        // Configure SSL/TLS
        if (config.UseSsl)
        {
            client.Config.EncryptionMode = FtpEncryptionMode.Explicit;
            client.Config.ValidateAnyCertificate = true; // For development; should be false in production
        }

        return client;
    }

    private string BuildRemotePath(FtpOutputConfig config, string fileName, string datasourceName)
    {
        var basePath = config.RemotePath.TrimEnd('/');

        // Apply filename pattern if configured
        var outputFileName = fileName;
        if (!string.IsNullOrEmpty(config.FileNamePattern))
        {
            outputFileName = ReplaceFileNamePlaceholders(config.FileNamePattern, fileName, datasourceName);
        }

        return $"{basePath}/{outputFileName}";
    }

    private string ReplaceFileNamePlaceholders(string pattern, string fileName, string datasourceName)
    {
        var now = DateTime.UtcNow;
        var ext = Path.GetExtension(fileName);
        var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);

        return pattern
            .Replace("{filename}", nameWithoutExt)
            .Replace("{ext}", ext.TrimStart('.'))
            .Replace("{date}", now.ToString("yyyyMMdd"))
            .Replace("{timestamp}", now.ToString("yyyyMMddHHmmss"))
            .Replace("{datasource}", datasourceName);
    }
}

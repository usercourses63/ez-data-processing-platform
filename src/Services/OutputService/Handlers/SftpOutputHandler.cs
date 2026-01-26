// SftpOutputHandler.cs - SFTP Output Handler
// v0.2.0: External File Access Support
// Date: January 26, 2026

using System.Diagnostics;
using System.Text;
using DataProcessing.Shared.Entities;
using DataProcessing.Output.Models;
using Renci.SshNet;

namespace DataProcessing.Output.Handlers;

/// <summary>
/// Handles output to SFTP servers
/// </summary>
public class SftpOutputHandler : IOutputHandler
{
    private readonly ILogger<SftpOutputHandler> _logger;

    public SftpOutputHandler(ILogger<SftpOutputHandler> logger)
    {
        _logger = logger;
    }

    public bool CanHandle(string destinationType) => destinationType == "sftp";

    public async Task<OutputResult> WriteAsync(
        OutputDestination destination,
        string content,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            if (destination.SftpConfig == null)
            {
                throw new ArgumentException("SftpConfig is required for SFTP destination type");
            }

            var config = destination.SftpConfig;

            _logger.LogInformation(
                "Writing to SFTP: {Host}:{Port}{Path}, file={FileName}, destination={Destination}",
                config.Host, config.Port, config.RemotePath, fileName, destination.Name);

            // Build remote path
            var remotePath = BuildRemotePath(config.RemotePath, fileName);

            // Create connection
            using var client = CreateSftpClient(config);
            await Task.Run(() => client.Connect(), cancellationToken);

            try
            {
                // Ensure directory exists
                var directory = Path.GetDirectoryName(remotePath)?.Replace('\\', '/');
                if (!string.IsNullOrEmpty(directory))
                {
                    CreateDirectoryRecursive(client, directory);
                }

                // Upload file (3rd param true = can overwrite)
                var contentBytes = Encoding.UTF8.GetBytes(content);
                using var stream = new MemoryStream(contentBytes);
                await Task.Run(() => client.UploadFile(stream, remotePath, true), cancellationToken);

                _logger.LogInformation(
                    "Successfully wrote to SFTP: {Host}:{Port}{Path}, size={Size} bytes",
                    config.Host, config.Port, remotePath, content.Length);

                stopwatch.Stop();

                return OutputResult.Successful(
                    destination.Name,
                    "sftp",
                    content.Length,
                    stopwatch.Elapsed);
            }
            finally
            {
                if (client.IsConnected)
                {
                    client.Disconnect();
                }
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            _logger.LogError(
                ex,
                "Failed to write to SFTP destination {Destination}, host={Host}:{Port}",
                destination.Name,
                destination.SftpConfig?.Host,
                destination.SftpConfig?.Port);

            return OutputResult.Failure(
                destination.Name,
                "sftp",
                ex.Message);
        }
    }

    private SftpClient CreateSftpClient(SftpOutputConfig config)
    {
        var connectionInfo = new Renci.SshNet.ConnectionInfo(
            config.Host,
            config.Port,
            config.Username,
            new PasswordAuthenticationMethod(config.Username, config.Password));

        return new SftpClient(connectionInfo);
    }

    private string BuildRemotePath(string basePath, string fileName)
    {
        var path = basePath.TrimEnd('/');
        return $"{path}/{fileName}";
    }

    private void CreateDirectoryRecursive(SftpClient client, string path)
    {
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var currentPath = "";

        foreach (var part in parts)
        {
            currentPath = $"{currentPath}/{part}";

            try
            {
                if (!client.Exists(currentPath))
                {
                    client.CreateDirectory(currentPath);
                    _logger.LogDebug("Created SFTP directory: {Path}", currentPath);
                }
            }
            catch (Exception ex)
            {
                // Directory might already exist, log and continue
                _logger.LogDebug(ex, "Could not create directory {Path}, may already exist", currentPath);
            }
        }
    }
}

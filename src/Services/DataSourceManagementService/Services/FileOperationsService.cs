using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Services;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service that proxies file operations (list, read, write) to IServerConnector
/// implementations via the ConnectorFactory. Resolves server by ID, gets the
/// appropriate connector, and delegates the call.
/// </summary>
public class FileOperationsService : IFileOperationsService
{
    private readonly IServerService _serverService;
    private readonly IConnectorFactory _connectorFactory;
    private readonly ICredentialResolver? _credentialResolver;
    private readonly ServerCredentialProtector? _credentialProtector;
    private readonly ILogger<FileOperationsService> _logger;

    public FileOperationsService(
        IServerService serverService,
        IConnectorFactory connectorFactory,
        ILogger<FileOperationsService> logger,
        ICredentialResolver? credentialResolver = null,
        ServerCredentialProtector? credentialProtector = null)
    {
        _serverService = serverService;
        _connectorFactory = connectorFactory;
        _logger = logger;
        _credentialResolver = credentialResolver;
        _credentialProtector = credentialProtector;
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(string serverId, string? path, string pattern, CancellationToken cancellationToken = default)
    {
        var (server, serverConnector, credentials) = await ResolveServerConnectorAsync(serverId, cancellationToken);

        _logger.LogInformation("Listing files on server {ServerName} ({ServerType}), path={Path}, pattern={Pattern}",
            server.Name, server.ServerType, path, pattern);

        var files = await serverConnector.ListFilesAsync(server, credentials, path, pattern, cancellationToken);

        _logger.LogInformation("Listed {Count} files on server {ServerName}", files.Count, server.Name);
        return files;
    }

    public async Task<byte[]> ReadFileAsync(string serverId, string filePath, CancellationToken cancellationToken = default)
    {
        var (server, serverConnector, credentials) = await ResolveServerConnectorAsync(serverId, cancellationToken);

        _logger.LogInformation("Reading file {FilePath} from server {ServerName} ({ServerType})",
            filePath, server.Name, server.ServerType);

        var content = await serverConnector.ReadFileAsync(server, credentials, filePath, cancellationToken);

        _logger.LogInformation("Read {Bytes} bytes from {FilePath} on server {ServerName}",
            content.Length, filePath, server.Name);
        return content;
    }

    public async Task WriteFileAsync(string serverId, string filePath, byte[] content, CancellationToken cancellationToken = default)
    {
        var (server, serverConnector, credentials) = await ResolveServerConnectorAsync(serverId, cancellationToken);

        _logger.LogInformation("Writing {Bytes} bytes to {FilePath} on server {ServerName} ({ServerType})",
            content.Length, filePath, server.Name, server.ServerType);

        await serverConnector.WriteFileAsync(server, credentials, filePath, content, cancellationToken);

        _logger.LogInformation("Successfully wrote {FilePath} on server {ServerName}",
            filePath, server.Name);
    }

    /// <summary>
    /// Resolves the AdminServer, IServerConnector, and credentials for a given server ID.
    /// Throws KeyNotFoundException if server not found, InvalidOperationException if connector
    /// does not support IServerConnector (e.g., Kafka).
    /// </summary>
    private async Task<(DataProcessing.Shared.Entities.AdminServer Server, IServerConnector Connector, ServerCredentials? Credentials)>
        ResolveServerConnectorAsync(string serverId, CancellationToken cancellationToken)
    {
        // 1. Look up server by ID
        var server = await _serverService.GetServerByIdAsync(serverId, cancellationToken);
        if (server == null)
        {
            throw new KeyNotFoundException($"Server not found: {serverId}");
        }

        // 2. Get connector for this server type
        var connector = _connectorFactory.GetConnector(server.ServerType);

        // 3. Verify it supports IServerConnector (file operations)
        if (connector is not IServerConnector serverConnector)
        {
            throw new InvalidOperationException(
                $"Server type '{server.ServerType}' does not support file operations. " +
                $"Only server types implementing IServerConnector can perform list/read/write operations.");
        }

        // 4. Resolve credentials
        ServerCredentials? credentials = null;

        // Try K8s secret first
        if (_credentialResolver != null && !string.IsNullOrEmpty(server.CredentialSecretRef))
        {
            try
            {
                credentials = await _credentialResolver.ResolveAsync(server.CredentialSecretRef, cancellationToken);
                _logger.LogDebug("Resolved credentials from secret: {SecretRef}", server.CredentialSecretRef);
            }
            catch (Exception credEx)
            {
                _logger.LogWarning(credEx, "Failed to resolve credentials from secret: {SecretRef}, will use TypeSpecificConfig",
                    server.CredentialSecretRef);
            }
        }

        // Fallback: extract credentials from TypeSpecificConfig.
        // Decrypt the at-rest SecretKey (Phase 34, SC-05) on a clone so the encrypted
        // value reaches the connector as plaintext without mutating the tracked entity.
        if (credentials == null && server.TypeSpecificConfig != null)
        {
            var configForCreds = server.TypeSpecificConfig.DeepClone().AsBsonDocument;
            if (_credentialProtector != null)
            {
                ServerCredentialProtector.DecryptSecretInPlace(configForCreds, _credentialProtector);
            }
            credentials = ServerCredentials.FromBsonDocument(configForCreds);
            _logger.LogDebug("Using credentials from TypeSpecificConfig for server {ServerName} (secret decrypted on read)", server.Name);
        }

        return (server, serverConnector, credentials);
    }
}

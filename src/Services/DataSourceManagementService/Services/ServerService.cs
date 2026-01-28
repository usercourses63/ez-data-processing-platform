using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using MongoDB.Entities;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service for managing admin servers (input/output file servers)
/// </summary>
public class ServerService : IServerService
{
    private readonly ILogger<ServerService> _logger;
    private readonly IConnectorFactory _connectorFactory;
    private readonly ICredentialResolver? _credentialResolver;

    private static readonly List<ServerTypeDefinition> _serverTypes = new()
    {
        new() { Type = "local", DisplayName = "Local Folder", DisplayNameHe = "תיקייה מקומית", SupportsInput = true, SupportsOutput = true, RequiredFields = new() { "BasePath" } },
        new() { Type = "ftp", DisplayName = "FTP", DisplayNameHe = "FTP", SupportsInput = true, SupportsOutput = true, DefaultPort = 21, RequiredFields = new() { "Host", "Port" } },
        new() { Type = "sftp", DisplayName = "SFTP", DisplayNameHe = "SFTP", SupportsInput = true, SupportsOutput = true, DefaultPort = 22, RequiredFields = new() { "Host", "Port" } },
        new() { Type = "s3", DisplayName = "S3/MinIO", DisplayNameHe = "S3/MinIO", SupportsInput = true, SupportsOutput = true, RequiredFields = new() { "Host" } },
        new() { Type = "http", DisplayName = "HTTP/WebDAV", DisplayNameHe = "HTTP/WebDAV", SupportsInput = true, SupportsOutput = true, DefaultPort = 443, RequiredFields = new() { "Host" } },
        new() { Type = "nfs", DisplayName = "NFS", DisplayNameHe = "NFS", SupportsInput = true, SupportsOutput = true, RequiredFields = new() { "BasePath" } },
        new() { Type = "kafka", DisplayName = "Kafka", DisplayNameHe = "Kafka", SupportsInput = true, SupportsOutput = true, DefaultPort = 9092, RequiredFields = new() { "KafkaConfig.BootstrapServers" } },
        new() { Type = "folder", DisplayName = "Output Folder", DisplayNameHe = "תיקיית פלט", SupportsInput = false, SupportsOutput = true, RequiredFields = new() { "BasePath" } }
    };

    public ServerService(
        ILogger<ServerService> logger,
        IConnectorFactory connectorFactory,
        ICredentialResolver? credentialResolver = null)
    {
        _logger = logger;
        _connectorFactory = connectorFactory;
        _credentialResolver = credentialResolver;
    }

    public async Task<List<AdminServer>> GetAllServersAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving all servers. IncludeInactive: {IncludeInactive}", includeInactive);

            var query = DB.Find<AdminServer, AdminServer>();

            if (!includeInactive)
            {
                query = query.Match(s => s.IsActive == true);
            }

            var servers = await query
                .Sort(s => s.Name, MongoDB.Entities.Order.Ascending)
                .ExecuteAsync(cancellationToken);

            _logger.LogInformation("Retrieved {Count} servers", servers.Count);
            return servers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתים");
            throw;
        }
    }

    public async Task<List<AdminServer>> GetServersByDirectionAsync(ServerDirection direction, bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving servers by direction: {Direction}", direction);

            var query = DB.Find<AdminServer, AdminServer>()
                .Match(s => s.Direction == direction || s.Direction == ServerDirection.Both);

            if (!includeInactive)
            {
                query = query.Match(s => s.IsActive == true);
            }

            var servers = await query
                .Sort(s => s.Name, MongoDB.Entities.Order.Ascending)
                .ExecuteAsync(cancellationToken);

            _logger.LogInformation("Retrieved {Count} servers for direction {Direction}", servers.Count, direction);
            return servers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתים לפי כיוון: {Direction}", direction);
            throw;
        }
    }

    public async Task<List<AdminServer>> GetInputServersAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving input servers");

            var query = DB.Find<AdminServer, AdminServer>()
                .Match(s => s.Direction == ServerDirection.Input || s.Direction == ServerDirection.Both);

            if (!includeInactive)
            {
                query = query.Match(s => s.IsActive == true);
            }

            var servers = await query
                .Sort(s => s.Name, MongoDB.Entities.Order.Ascending)
                .ExecuteAsync(cancellationToken);

            _logger.LogInformation("Retrieved {Count} input servers", servers.Count);
            return servers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתי קלט");
            throw;
        }
    }

    public async Task<List<AdminServer>> GetOutputServersAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving output servers");

            var query = DB.Find<AdminServer, AdminServer>()
                .Match(s => s.Direction == ServerDirection.Output || s.Direction == ServerDirection.Both);

            if (!includeInactive)
            {
                query = query.Match(s => s.IsActive == true);
            }

            var servers = await query
                .Sort(s => s.Name, MongoDB.Entities.Order.Ascending)
                .ExecuteAsync(cancellationToken);

            _logger.LogInformation("Retrieved {Count} output servers", servers.Count);
            return servers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתי פלט");
            throw;
        }
    }

    public async Task<AdminServer?> GetServerByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving server by ID: {ServerId}", id);
            return await DB.Find<AdminServer, AdminServer>().OneAsync(id, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרת: {ServerId}", id);
            throw;
        }
    }

    public async Task<List<AdminServer>> GetServersByTypeAsync(string serverType, bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving servers by type: {ServerType}", serverType);

            var query = DB.Find<AdminServer, AdminServer>()
                .Match(s => s.ServerType == serverType);

            if (!includeInactive)
            {
                query = query.Match(s => s.IsActive == true);
            }

            var servers = await query
                .Sort(s => s.Name, MongoDB.Entities.Order.Ascending)
                .ExecuteAsync(cancellationToken);

            _logger.LogInformation("Retrieved {Count} servers of type {ServerType}", servers.Count, serverType);
            return servers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתים לפי סוג: {ServerType}", serverType);
            throw;
        }
    }

    public async Task<AdminServer> CreateServerAsync(AdminServer server, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Creating new server: {ServerName} ({ServerType})", server.Name, server.ServerType);

            server.CreatedAt = DateTime.UtcNow;
            server.UpdatedAt = DateTime.UtcNow;

            await server.SaveAsync(cancellation: cancellationToken);

            _logger.LogInformation("שרת נוצר בהצלחה: {ServerId}", server.ID);
            return server;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה ביצירת שרת: {ServerName}", server.Name);
            throw;
        }
    }

    public async Task<AdminServer?> UpdateServerAsync(string id, AdminServer server, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Updating server: {ServerId}", id);

            var existing = await GetServerByIdAsync(id, cancellationToken);
            if (existing == null)
            {
                _logger.LogWarning("שרת לא נמצא: {ServerId}", id);
                return null;
            }

            existing.Name = server.Name;
            existing.Description = server.Description;
            existing.ServerType = server.ServerType;
            existing.Direction = server.Direction;
            existing.IsActive = server.IsActive;
            existing.Host = server.Host;
            existing.Port = server.Port;
            existing.BasePath = server.BasePath;
            existing.CredentialSecretRef = server.CredentialSecretRef;
            existing.KafkaConfig = server.KafkaConfig;
            existing.TypeSpecificConfig = server.TypeSpecificConfig;
            existing.ConnectionTimeoutSeconds = server.ConnectionTimeoutSeconds;
            existing.RetryCount = server.RetryCount;
            existing.UpdatedAt = DateTime.UtcNow;

            await existing.SaveAsync(cancellation: cancellationToken);

            _logger.LogInformation("שרת עודכן בהצלחה: {ServerId}", id);
            return existing;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בעדכון שרת: {ServerId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteServerAsync(string id, CancellationToken cancellationToken = default)
    {
        try
        {
            var server = await GetServerByIdAsync(id, cancellationToken);
            if (server == null)
            {
                _logger.LogWarning("שרת לא נמצא למחיקה: {ServerId}", id);
                return false;
            }

            // Check if any datasources are using this server
            var usageCount = await GetDataSourceCountByServerAsync(id, cancellationToken);

            if (usageCount > 0)
            {
                // Soft delete: mark as inactive if in use
                _logger.LogInformation("שרת '{ServerName}' בשימוש על ידי {Count} datasources - מבצע soft delete",
                    server.Name, usageCount);

                server.IsActive = false;
                server.UpdatedAt = DateTime.UtcNow;
                await server.SaveAsync(cancellation: cancellationToken);

                _logger.LogInformation("✅ שרת סומן כלא פעיל (soft delete): {ServerId}", id);
            }
            else
            {
                // Hard delete: permanently remove if not in use
                _logger.LogInformation("שרת '{ServerName}' אינו בשימוש - מבצע hard delete", server.Name);

                var result = await DB.DeleteAsync<AdminServer>(id);

                if (result.DeletedCount > 0)
                {
                    _logger.LogInformation("✅ שרת נמחק לצמיתות (hard delete): {ServerId}", id);
                }
                else
                {
                    _logger.LogWarning("⚠️ לא הצלחנו למחוק שרת: {ServerId}", id);
                    return false;
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ שגיאה במחיקת שרת: {ServerId}", id);
            throw;
        }
    }

    public async Task<ServerConnectionTestResult> TestConnectionAsync(string id, CancellationToken cancellationToken = default)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var result = new ServerConnectionTestResult();

        try
        {
            var server = await GetServerByIdAsync(id, cancellationToken);
            if (server == null)
            {
                return new ServerConnectionTestResult
                {
                    Success = false,
                    ErrorMessage = $"שרת לא נמצא: {id}",
                    TestedAt = DateTime.UtcNow
                };
            }

            _logger.LogInformation("Testing connection to server: {ServerName} ({ServerType})", server.Name, server.ServerType);

            // Resolve credentials for the server
            ServerCredentials? credentials = null;
            if (_credentialResolver != null && !string.IsNullOrEmpty(server.CredentialSecretRef))
            {
                try
                {
                    credentials = await _credentialResolver.ResolveAsync(server.CredentialSecretRef, cancellationToken);
                    _logger.LogDebug("Resolved credentials from secret: {SecretRef}", server.CredentialSecretRef);
                }
                catch (Exception credEx)
                {
                    _logger.LogWarning(credEx, "Failed to resolve credentials from secret: {SecretRef}, will use TypeSpecificConfig", server.CredentialSecretRef);
                }
            }

            // Fallback: Extract credentials from TypeSpecificConfig if available
            if (credentials == null && server.TypeSpecificConfig != null)
            {
                credentials = ServerCredentials.FromBsonDocument(server.TypeSpecificConfig);
                _logger.LogDebug("Using credentials from TypeSpecificConfig");
            }

            // Get the appropriate connector
            var connector = _connectorFactory.GetConnector(server.ServerType);
            bool testSuccess = false;
            string? errorMessage = null;

            // Check if connector supports IServerConnector (AdminServer-based testing)
            if (connector is IServerConnector serverConnector)
            {
                // Use the AdminServer-aware test method with resolved credentials
                var connectorResult = await serverConnector.TestConnectionAsync(server, credentials, cancellationToken);
                testSuccess = connectorResult.IsSuccess;
                errorMessage = connectorResult.ErrorMessage;
                result.Details = connectorResult.Details;
            }
            else
            {
                // Fall back to basic datasource test (create a temporary datasource from server config)
                var tempDataSource = CreateTempDataSourceFromServer(server);
                testSuccess = await connector.TestConnectionAsync(tempDataSource, cancellationToken);
                if (!testSuccess)
                {
                    errorMessage = "Connection test failed";
                }
            }

            stopwatch.Stop();

            result.Success = testSuccess;
            result.ConnectionTimeMs = stopwatch.ElapsedMilliseconds;
            result.TestedAt = DateTime.UtcNow;
            result.ErrorMessage = errorMessage;

            // Update server with test results
            server.SetConnectionTestResult(testSuccess, errorMessage);
            await server.SaveAsync(cancellation: cancellationToken);

            _logger.LogInformation("Connection test for {ServerName}: {Result} ({TimeMs}ms)",
                server.Name, testSuccess ? "Success" : "Failed", stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "שגיאה בבדיקת חיבור לשרת: {ServerId}", id);

            result.Success = false;
            result.ErrorMessage = ex.Message;
            result.ConnectionTimeMs = stopwatch.ElapsedMilliseconds;

            // Try to update server with failed test results
            try
            {
                var server = await GetServerByIdAsync(id, cancellationToken);
                if (server != null)
                {
                    server.SetConnectionTestResult(false, ex.Message);
                    await server.SaveAsync(cancellation: cancellationToken);
                }
            }
            catch
            {
                // Ignore errors when updating server
            }

            return result;
        }
    }

    public async Task<AdminServer?> ToggleServerActiveAsync(string id, bool isActive, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Toggling server active status: {ServerId} -> {IsActive}", id, isActive);

            var server = await GetServerByIdAsync(id, cancellationToken);
            if (server == null)
            {
                _logger.LogWarning("שרת לא נמצא: {ServerId}", id);
                return null;
            }

            server.IsActive = isActive;
            server.UpdatedAt = DateTime.UtcNow;
            await server.SaveAsync(cancellation: cancellationToken);

            _logger.LogInformation("סטטוס שרת עודכן בהצלחה: {ServerId}", id);
            return server;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בשינוי סטטוס שרת: {ServerId}", id);
            throw;
        }
    }

    public async Task<long> GetDataSourceCountByServerAsync(string serverId, CancellationToken cancellationToken = default)
    {
        try
        {
            var count = await DB.CountAsync<DataProcessingDataSource>(
                ds => ds.FileServerId == serverId);

            _logger.LogInformation("מספר datasources המשתמשים בשרת '{ServerId}': {Count}", serverId, count);
            return count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בספירת datasources לשרת: {ServerId}", serverId);
            throw;
        }
    }

    public List<ServerTypeDefinition> GetAvailableServerTypes()
    {
        return _serverTypes;
    }

    /// <summary>
    /// Creates a temporary DataSource from AdminServer for connector compatibility
    /// </summary>
    private static DataProcessingDataSource CreateTempDataSourceFromServer(AdminServer server)
    {
        return new DataProcessingDataSource
        {
            Name = $"_test_{server.Name}",
            FilePath = server.BasePath ?? "/",
            FilePattern = "*",
            // Map server config to datasource additional configuration
            AdditionalConfiguration = server.TypeSpecificConfig
        };
    }
}

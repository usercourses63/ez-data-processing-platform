using DataProcessing.Shared.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Factory implementation for creating data source connectors
/// Uses DI to resolve connector instances based on server type
/// </summary>
public class ConnectorFactory : IConnectorFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ConnectorFactory> _logger;
    private readonly Dictionary<string, Type> _connectorTypes;

    /// <summary>
    /// Supported server types and their corresponding connector types
    /// </summary>
    private static readonly Dictionary<string, Type> DefaultConnectorTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["local"] = typeof(LocalFileConnector),
        ["folder"] = typeof(LocalFileConnector),  // Alias for local
        ["nfs"] = typeof(LocalFileConnector),     // NFS uses local filesystem (mounted PV)
        ["ftp"] = typeof(FtpConnector),
        ["sftp"] = typeof(SftpConnector),
        ["http"] = typeof(HttpApiConnector),
        ["https"] = typeof(HttpApiConnector),
        ["kafka"] = typeof(KafkaConnector),
        ["s3"] = typeof(S3Connector),
        ["s3compat"] = typeof(S3Connector),        // Alias for S3-compatible (MinIO, etc.)
    };

    public ConnectorFactory(
        IServiceProvider serviceProvider,
        ILogger<ConnectorFactory> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _connectorTypes = new Dictionary<string, Type>(DefaultConnectorTypes, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Registers a connector type for a server type
    /// Useful for adding S3 or other connectors at runtime
    /// </summary>
    public void RegisterConnector(string serverType, Type connectorType)
    {
        if (!typeof(IDataSourceConnector).IsAssignableFrom(connectorType))
        {
            throw new ArgumentException(
                $"Type {connectorType.Name} does not implement IDataSourceConnector",
                nameof(connectorType));
        }

        _connectorTypes[serverType.ToLowerInvariant()] = connectorType;
        _logger.LogInformation("Registered connector {ConnectorType} for server type {ServerType}",
            connectorType.Name, serverType);
    }

    public IDataSourceConnector GetConnector(AdminServer server)
    {
        ArgumentNullException.ThrowIfNull(server);

        if (string.IsNullOrWhiteSpace(server.ServerType))
        {
            throw new ArgumentException("Server type is required", nameof(server));
        }

        return GetConnector(server.ServerType);
    }

    public IDataSourceConnector GetConnector(string serverType)
    {
        if (string.IsNullOrWhiteSpace(serverType))
        {
            throw new ArgumentException("Server type is required", nameof(serverType));
        }

        var normalizedType = serverType.ToLowerInvariant();

        if (!_connectorTypes.TryGetValue(normalizedType, out var connectorType))
        {
            var supported = string.Join(", ", _connectorTypes.Keys);
            throw new ArgumentException(
                $"Unknown server type: '{serverType}'. Supported types: {supported}",
                nameof(serverType));
        }

        try
        {
            var connector = (IDataSourceConnector)_serviceProvider.GetRequiredService(connectorType);
            _logger.LogDebug("Created connector {ConnectorType} for server type {ServerType}",
                connector.GetType().Name, serverType);
            return connector;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create connector for server type {ServerType}", serverType);
            throw new InvalidOperationException(
                $"Failed to create connector for server type '{serverType}'. " +
                $"Ensure {connectorType.Name} is registered in DI.", ex);
        }
    }

    public bool HasConnector(string serverType)
    {
        if (string.IsNullOrWhiteSpace(serverType))
            return false;

        return _connectorTypes.ContainsKey(serverType.ToLowerInvariant());
    }

    public IReadOnlyList<string> GetSupportedServerTypes()
    {
        return _connectorTypes.Keys.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }
}

/// <summary>
/// Extension methods for registering connector factory in DI
/// </summary>
public static class ConnectorFactoryExtensions
{
    /// <summary>
    /// Adds the connector factory and all built-in connectors to the service collection
    /// </summary>
    public static IServiceCollection AddConnectorFactory(this IServiceCollection services)
    {
        // Register the factory
        services.AddSingleton<IConnectorFactory, ConnectorFactory>();

        // Register named HttpClient for HttpApiConnector to use via factory
        services.AddHttpClient(nameof(HttpApiConnector))
            .ConfigureHttpClient(client =>
            {
                client.Timeout = TimeSpan.FromSeconds(30);
            });

        // Register all connectors as Singleton
        services.AddSingleton<LocalFileConnector>();
        services.AddSingleton<FtpConnector>();
        services.AddSingleton<SftpConnector>();
        services.AddSingleton<HttpApiConnector>();  // Uses IHttpClientFactory internally
        services.AddSingleton<KafkaConnector>();
        services.AddSingleton<S3Connector>();

        return services;
    }

    /// <summary>
    /// Adds a custom connector to the service collection and registers it with the factory
    /// </summary>
    /// <typeparam name="TConnector">Connector implementation type</typeparam>
    /// <param name="services">Service collection</param>
    /// <param name="serverType">Server type identifier</param>
    public static IServiceCollection AddConnector<TConnector>(
        this IServiceCollection services,
        string serverType)
        where TConnector : class, IDataSourceConnector
    {
        services.AddSingleton<TConnector>();

        // Register with factory after it's built
        services.PostConfigure<ConnectorFactoryOptions>(options =>
        {
            options.AdditionalConnectors[serverType] = typeof(TConnector);
        });

        return services;
    }
}

/// <summary>
/// Options for configuring additional connectors
/// </summary>
public class ConnectorFactoryOptions
{
    /// <summary>
    /// Additional connectors to register (server type -> connector type)
    /// </summary>
    public Dictionary<string, Type> AdditionalConnectors { get; } = new(StringComparer.OrdinalIgnoreCase);
}

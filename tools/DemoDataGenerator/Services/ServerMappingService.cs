using DataProcessing.Shared.Entities;
using DemoDataGenerator.Models;
using MongoDB.Bson;

namespace DemoDataGenerator.Services;

/// <summary>
/// Maps file-simulator server instances to EZ platform entities (AdminServer, NasDevice).
/// Translates protocol-specific connection info into entity-compatible configurations.
/// </summary>
public class ServerMappingService
{
    /// <summary>
    /// Maps a simulator server to an AdminServer entity with protocol-specific configuration
    /// </summary>
    public AdminServer MapToAdminServer(SimulatorServer server, SimulatorConnectionInfo connInfo)
    {
        var serverType = NormalizeProtocol(server.Protocol);
        var direction = ParseDirection(server.Name);

        var adminServer = new AdminServer
        {
            Name = server.Name,
            Description = $"Auto-discovered from file-simulator ({server.Protocol}:{server.Port})",
            ServerType = serverType,
            Direction = direction,
            IsActive = server.IsHealthy,
            Host = GetHost(serverType, connInfo, server),
            Port = GetPort(serverType, connInfo, server),
            BasePath = GetBasePath(serverType, direction),
            CredentialSecretRef = GetCredentialSecretRef(serverType),
            TypeSpecificConfig = GetTypeSpecificConfig(serverType, connInfo, server),
            KafkaConfig = GetKafkaConfig(serverType, connInfo),
            ConnectionTimeoutSeconds = 30,
            RetryCount = 3,
            LastConnectionTest = DateTime.UtcNow,
            LastConnectionSuccess = server.IsHealthy,
            CreatedBy = "SimulatorSeeder",
            CorrelationId = Guid.NewGuid().ToString()
        };

        return adminServer;
    }

    /// <summary>
    /// Maps a simulator NAS/NFS server to a NasDevice entity
    /// </summary>
    public NasDevice MapToNasDevice(SimulatorServer server, SimulatorConnectionInfo connInfo)
    {
        var nasInfo = FindNasInfo(server, connInfo);
        var role = ParseNasRole(server.Name);

        var nasDevice = new NasDevice
        {
            Name = server.Name,
            Description = $"Auto-discovered NAS from file-simulator ({server.Protocol})",
            Host = nasInfo?.Host ?? server.Host,
            Port = nasInfo?.Port ?? server.Port,
            ExportPath = nasInfo?.Path ?? "/data",
            Role = role,
            StorageCapacity = "10Gi",
            AccessMode = "ReadWriteMany",
            ReclaimPolicy = "Retain",
            MountOptions = new List<string> { "nfsvers=3", "tcp", "hard", "intr" },
            IsPvCreated = false,
            IsPvcBound = false,
            IsActive = server.IsHealthy,
            CreatedBy = "SimulatorSeeder",
            CorrelationId = Guid.NewGuid().ToString()
        };

        return nasDevice;
    }

    private static string NormalizeProtocol(string protocol)
    {
        return protocol.ToUpperInvariant() switch
        {
            "FTP" => "ftp",
            "SFTP" => "sftp",
            "HTTP" or "WEBDAV" => "http",
            "KAFKA" => "kafka",
            "S3" or "MINIO" => "s3",
            "NFS" or "NAS" => "nfs",
            _ => protocol.ToLowerInvariant()
        };
    }

    private static ServerDirection ParseDirection(string serverName)
    {
        var lower = serverName.ToLowerInvariant();
        if (lower.Contains("input")) return ServerDirection.Input;
        if (lower.Contains("output")) return ServerDirection.Output;
        return ServerDirection.Both;
    }

    private static NasDeviceRole ParseNasRole(string serverName)
    {
        var lower = serverName.ToLowerInvariant();
        if (lower.Contains("input")) return NasDeviceRole.Input;
        if (lower.Contains("output")) return NasDeviceRole.Output;
        if (lower.Contains("backup")) return NasDeviceRole.Backup;
        return NasDeviceRole.Both;
    }

    private static string? GetHost(string serverType, SimulatorConnectionInfo connInfo, SimulatorServer server)
    {
        return serverType switch
        {
            "ftp" => connInfo.Ftp?.Host ?? server.Host,
            "sftp" => connInfo.Sftp?.Host ?? server.Host,
            "http" => connInfo.Http?.Host ?? server.Host,
            "s3" => connInfo.S3?.Endpoint ?? server.Host,
            "kafka" => connInfo.Kafka?.BootstrapServers ?? server.Host,
            _ => server.Host
        };
    }

    private static int? GetPort(string serverType, SimulatorConnectionInfo connInfo, SimulatorServer server)
    {
        return serverType switch
        {
            "ftp" => connInfo.Ftp?.Port ?? server.Port,
            "sftp" => connInfo.Sftp?.Port ?? server.Port,
            "http" => connInfo.Http?.Port ?? server.Port,
            "kafka" => connInfo.Kafka?.Port ?? server.Port,
            _ => server.Port
        };
    }

    private static string? GetBasePath(string serverType, ServerDirection direction)
    {
        if (serverType == "s3" || serverType == "kafka") return null;

        return direction switch
        {
            ServerDirection.Input => "/input",
            ServerDirection.Output => "/output",
            _ => "/"
        };
    }

    private static string? GetCredentialSecretRef(string serverType)
    {
        return serverType switch
        {
            "ftp" => "ez-platform/file-simulator-ftp-creds",
            "sftp" => "ez-platform/file-simulator-sftp-creds",
            "http" => "ez-platform/file-simulator-http-creds",
            "s3" => "ez-platform/file-simulator-s3-creds",
            "nfs" => null,
            "kafka" => null,
            _ => null
        };
    }

    private static BsonDocument? GetTypeSpecificConfig(string serverType, SimulatorConnectionInfo connInfo, SimulatorServer server)
    {
        return serverType switch
        {
            "ftp" => new BsonDocument
            {
                { "Username", connInfo.Ftp?.Username ?? "ftpuser" },
                { "Password", connInfo.Ftp?.Password ?? "ftppass123" },
                { "PassiveMode", true },
                { "UseSsl", false }
            },
            "sftp" => new BsonDocument
            {
                { "Username", connInfo.Sftp?.Username ?? "sftpuser" },
                { "Password", connInfo.Sftp?.Password ?? "sftppass123" },
                { "UseKeyAuth", false }
            },
            "s3" => new BsonDocument
            {
                { "Endpoint", connInfo.S3?.Endpoint ?? $"http://{server.Host}:{server.Port}" },
                { "AccessKey", connInfo.S3?.AccessKey ?? "minioadmin" },
                { "SecretKey", connInfo.S3?.SecretKey ?? "minioadmin123" },
                { "Region", connInfo.S3?.Region ?? "us-east-1" },
                { "ForcePathStyle", true },
                { "UseHttp", true },
                { "Bucket", connInfo.S3?.InputBucket ?? "input" }
            },
            "http" => new BsonDocument
            {
                { "Username", connInfo.Http?.Username ?? "httpuser" },
                { "Password", connInfo.Http?.Password ?? "httppass123" },
                { "AuthType", "basic" }
            },
            _ => null
        };
    }

    private static KafkaServerConfig? GetKafkaConfig(string serverType, SimulatorConnectionInfo connInfo)
    {
        if (serverType != "kafka") return null;

        return new KafkaServerConfig
        {
            BootstrapServers = connInfo.Kafka?.BootstrapServers ?? "kafka:9092",
            SecurityProtocol = "PLAINTEXT",
            DefaultConsumerGroup = "dataprocessing-group",
            AcksRequired = 1
        };
    }

    private static SimulatorNasInfo? FindNasInfo(SimulatorServer server, SimulatorConnectionInfo connInfo)
    {
        if (connInfo.Nas == null || connInfo.Nas.Count == 0) return null;

        // Try matching by server name
        var match = connInfo.Nas.FirstOrDefault(n =>
            server.Name.Contains(n.Name, StringComparison.OrdinalIgnoreCase) ||
            n.Name.Contains(server.Name, StringComparison.OrdinalIgnoreCase));

        // Fall back to first NAS info if no name match
        return match ?? connInfo.Nas.FirstOrDefault();
    }
}

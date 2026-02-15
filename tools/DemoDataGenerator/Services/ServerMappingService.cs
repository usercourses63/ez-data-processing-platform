using DataProcessing.Shared.Entities;
using DemoDataGenerator.Models;
using MongoDB.Bson;

namespace DemoDataGenerator.Services;

/// <summary>
/// Maps file-simulator server instances to EZ platform entities (AdminServer, NasDevice).
/// Uses connection-info servers array for host/port resolution (NodePort access).
/// </summary>
public class ServerMappingService
{
    /// <summary>
    /// Maps a simulator server to an AdminServer entity with protocol-specific configuration
    /// </summary>
    public AdminServer MapToAdminServer(SimulatorServer server, SimulatorConnectionInfo connInfo,
        ServerDirection? directionOverride = null)
    {
        var serverType = NormalizeProtocol(server.Protocol);
        var direction = directionOverride ?? ParseDirection(server.Name);
        var connServer = FindConnectionServer(server.Name, connInfo);

        var adminServer = new AdminServer
        {
            Name = server.Name,
            Description = $"Auto-discovered from file-simulator ({server.Protocol}:{server.NodePort})",
            ServerType = serverType,
            Direction = direction,
            IsActive = true, // Dynamic servers may not have pods ready yet; mark active for seeding
            Host = connServer?.Host ?? connInfo.Hostname ?? "file-simulator.local",
            Port = connServer?.Port ?? server.NodePort,
            BasePath = GetBasePath(serverType, direction),
            CredentialSecretRef = GetCredentialSecretRef(serverType),
            TypeSpecificConfig = GetTypeSpecificConfig(serverType, server, connServer),
            KafkaConfig = GetKafkaConfig(serverType, connServer),
            ConnectionTimeoutSeconds = 30,
            RetryCount = 3,
            LastConnectionTest = DateTime.UtcNow,
            LastConnectionSuccess = true,
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
        var connServer = FindConnectionServer(server.Name, connInfo);
        var role = ParseNasRole(server.Name);
        var exportPath = ParseExportPath(server.Directory, connServer);

        var nasDevice = new NasDevice
        {
            Name = server.Name,
            Description = $"Auto-discovered NAS from file-simulator ({server.Protocol})",
            Host = connServer?.Host ?? connInfo.Hostname ?? "file-simulator.local",
            Port = connServer?.Port ?? server.NodePort,
            ExportPath = exportPath,
            Role = role,
            StorageCapacity = "10Gi",
            AccessMode = "ReadWriteMany",
            ReclaimPolicy = "Retain",
            MountOptions = new List<string> { "nfsvers=3", "tcp", "hard", "intr" },
            IsPvCreated = false,
            IsPvcBound = false,
            IsActive = true,
            CreatedBy = "SimulatorSeeder",
            CorrelationId = Guid.NewGuid().ToString()
        };

        return nasDevice;
    }

    /// <summary>
    /// Find a matching server entry in the connection-info servers array
    /// </summary>
    private static ConnectionInfoServer? FindConnectionServer(string serverName, SimulatorConnectionInfo connInfo)
    {
        if (connInfo.Servers == null || connInfo.Servers.Count == 0) return null;

        return connInfo.Servers.FirstOrDefault(s =>
            s.Name.Equals(serverName, StringComparison.OrdinalIgnoreCase));
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

    private static string ParseExportPath(string? directory, ConnectionInfoServer? connServer)
    {
        // Derive suffix from directory field (e.g., C:\simulator-data\input → /input)
        var suffix = "";
        if (!string.IsNullOrEmpty(directory))
        {
            if (directory.Contains("\\input") || directory.Contains("/input")) suffix = "/input";
            else if (directory.Contains("\\output") || directory.Contains("/output")) suffix = "/output";
            else if (directory.Contains("\\backup") || directory.Contains("/backup")) suffix = "/backup";
        }

        // Try to extract base path from connectionString (format: "host:port:/path")
        if (connServer?.ConnectionString != null)
        {
            var parts = connServer.ConnectionString.Split(':');
            if (parts.Length >= 3)
            {
                var basePath = parts[^1]; // Last segment after last ':'
                if (basePath.StartsWith("/")) return basePath + suffix;
            }
        }

        // Fall back to directory-based path
        return "/data" + suffix;
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

    private static BsonDocument? GetTypeSpecificConfig(string serverType, SimulatorServer server, ConnectionInfoServer? connServer)
    {
        var creds = connServer?.Credentials ?? server.Credentials;

        return serverType switch
        {
            "ftp" => new BsonDocument
            {
                { "Username", creds?.Username ?? "ftpuser" },
                { "Password", creds?.Password ?? "ftppass123" },
                { "PassiveMode", true },
                { "UseSsl", false }
            },
            "sftp" => new BsonDocument
            {
                { "Username", creds?.Username ?? "sftpuser" },
                { "Password", creds?.Password ?? "sftppass123" },
                { "UseKeyAuth", false }
            },
            "s3" => new BsonDocument
            {
                { "Endpoint", connServer?.ConnectionString ?? $"http://{connServer?.Host ?? "file-simulator.local"}:{connServer?.Port ?? server.NodePort}" },
                { "AccessKey", creds?.Username ?? "minioadmin" },
                { "SecretKey", creds?.Password ?? "minioadmin123" },
                { "Region", "us-east-1" },
                { "ForcePathStyle", true },
                { "UseHttp", true },
                { "Bucket", "input" }
            },
            "http" => new BsonDocument
            {
                { "Username", creds?.Username ?? "httpuser" },
                { "Password", creds?.Password ?? "httppass123" },
                { "AuthType", "basic" }
            },
            _ => null
        };
    }

    private static KafkaServerConfig? GetKafkaConfig(string serverType, ConnectionInfoServer? connServer)
    {
        if (serverType != "kafka") return null;

        var host = connServer?.Host ?? "file-simulator.local";
        var port = connServer?.Port ?? 30092;

        return new KafkaServerConfig
        {
            BootstrapServers = $"{host}:{port}",
            SecurityProtocol = "PLAINTEXT",
            DefaultConsumerGroup = "dataprocessing-group",
            AcksRequired = 1
        };
    }
}

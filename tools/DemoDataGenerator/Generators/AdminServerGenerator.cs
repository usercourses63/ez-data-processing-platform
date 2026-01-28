using DataProcessing.Shared.Entities;
using MongoDB.Bson;
using MongoDB.Entities;

namespace DemoDataGenerator.Generators;

/// <summary>
/// Generates AdminServer entities for demo data
/// v0.2.0: External File Access Support
/// </summary>
public class AdminServerGenerator
{
    private readonly Random _random;
    private readonly string _fileSimulatorHost;

    public AdminServerGenerator(Random random, string fileSimulatorHost = "file-simulator.local")
    {
        _random = random;
        _fileSimulatorHost = fileSimulatorHost;
    }

    public async Task<List<AdminServer>> GenerateAsync()
    {
        Console.WriteLine("[2/10] 🖥️  Generating Admin Servers...");
        var servers = new List<AdminServer>();

        // Define server configurations using external file-simulator (file-simulator.local)
        // v0.2.0: Real endpoints for production-like testing
        // Uses stable hostname that resolves automatically via DNS/mDNS (no IP detection needed)
        // Decision 3B: Extended 10 servers (demonstrates multi-server capability)
        var serverConfigs = new (string Name, string NameEn, string Description, string ServerType, ServerDirection Direction, string? Host, int? Port, string? BasePath, KafkaServerConfig? KafkaConfig)[]
        {
            // 1. FTP Input - file-simulator
            (
                Name: "file-simulator FTP קלט",
                NameEn: "file-simulator FTP Input",
                Description: "שרת FTP חיצוני לקליטת קבצים (file-simulator:30021)",
                ServerType: "ftp",
                Direction: ServerDirection.Input,
                Host: _fileSimulatorHost,
                Port: 30021,
                BasePath: "/input",
                KafkaConfig: null
            ),
            // 2. FTP Output - file-simulator (same endpoint, different direction)
            (
                Name: "file-simulator FTP פלט",
                NameEn: "file-simulator FTP Output",
                Description: "שרת FTP חיצוני לכתיבת קבצים מעובדים (file-simulator:30021)",
                ServerType: "ftp",
                Direction: ServerDirection.Output,
                Host: _fileSimulatorHost,
                Port: 30021,
                BasePath: "/output",
                KafkaConfig: null
            ),
            // 3. SFTP Input - file-simulator
            (
                Name: "file-simulator SFTP קלט",
                NameEn: "file-simulator SFTP Input",
                Description: "שרת SFTP מאובטח לקליטת קבצים רגישים (file-simulator:30022)",
                ServerType: "sftp",
                Direction: ServerDirection.Input,
                Host: _fileSimulatorHost,
                Port: 30022,
                BasePath: "/data/input",
                KafkaConfig: null
            ),
            // 4. SFTP Output - file-simulator
            (
                Name: "file-simulator SFTP פלט",
                NameEn: "file-simulator SFTP Output",
                Description: "שרת SFTP מאובטח לכתיבת קבצים מעובדים (file-simulator:30022)",
                ServerType: "sftp",
                Direction: ServerDirection.Output,
                Host: _fileSimulatorHost,
                Port: 30022,
                BasePath: "/data/output",
                KafkaConfig: null
            ),
            // 5. S3 Data Lake - file-simulator MinIO (bucket: input)
            (
                Name: "file-simulator S3 אגם נתונים",
                NameEn: "file-simulator S3 Data Lake",
                Description: "אחסון S3 לנתונים גולמיים - bucket: input (file-simulator MinIO:30900)",
                ServerType: "s3",
                Direction: ServerDirection.Both,
                Host: _fileSimulatorHost,
                Port: 30900,
                BasePath: null,
                KafkaConfig: null
            ),
            // 6. S3 Archive - file-simulator MinIO (bucket: output)
            (
                Name: "file-simulator S3 ארכיון",
                NameEn: "file-simulator S3 Archive",
                Description: "אחסון S3 לקבצים מעובדים - bucket: output (file-simulator MinIO:30900)",
                ServerType: "s3",
                Direction: ServerDirection.Both,
                Host: _fileSimulatorHost,
                Port: 30900,
                BasePath: null,
                KafkaConfig: null
            ),
            // 7. HTTP Input - file-simulator
            (
                Name: "file-simulator HTTP קלט",
                NameEn: "file-simulator HTTP Input",
                Description: "שרת HTTP/WebDAV לקליטת קבצים דרך REST API (file-simulator:30088)",
                ServerType: "http",
                Direction: ServerDirection.Input,
                Host: _fileSimulatorHost,
                Port: 30088,
                BasePath: "/input",
                KafkaConfig: null
            ),
            // 8. Internal Kafka - EZ Platform (unchanged - internal)
            (
                Name: "EZ Platform Kafka",
                NameEn: "EZ Platform Kafka",
                Description: "אשכול Kafka פנימי לזרימת אירועים בזמן אמת (kafka:9092)",
                ServerType: "kafka",
                Direction: ServerDirection.Both,
                Host: "kafka",
                Port: 9092,
                BasePath: null,
                KafkaConfig: new KafkaServerConfig
                {
                    BootstrapServers = "kafka:9092",
                    SecurityProtocol = "PLAINTEXT",
                    DefaultConsumerGroup = "dataprocessing-group",
                    AcksRequired = 1
                }
            ),
            // 9. NFS Input - file-simulator (mounted as PV)
            (
                Name: "file-simulator NFS קלט",
                NameEn: "file-simulator NFS Input",
                Description: "שרת NFS חיצוני לקליטת קבצים - מוגדר דרך PV (file-simulator.local:32149)",
                ServerType: "nfs",
                Direction: ServerDirection.Input,
                Host: _fileSimulatorHost,
                Port: 32149,
                BasePath: "/mnt/nfs-data/input",
                KafkaConfig: null
            ),
            // 10. NFS Output - file-simulator (mounted as PV)
            (
                Name: "file-simulator NFS פלט",
                NameEn: "file-simulator NFS Output",
                Description: "שרת NFS חיצוני לכתיבת קבצים - מוגדר דרך PV (file-simulator.local:32149)",
                ServerType: "nfs",
                Direction: ServerDirection.Output,
                Host: _fileSimulatorHost,
                Port: 32149,
                BasePath: "/mnt/nfs-data/output",
                KafkaConfig: null
            )
        };

        foreach (var config in serverConfigs)
        {
            var server = new AdminServer
            {
                Name = config.Name,
                Description = config.Description,
                ServerType = config.ServerType,
                Direction = config.Direction,
                IsActive = true,
                Host = config.Host,
                Port = config.Port,
                BasePath = config.BasePath,
                KafkaConfig = config.KafkaConfig,
                CredentialSecretRef = config.ServerType switch
                {
                    "ftp" => "ez-platform/file-simulator-ftp-creds",
                    "sftp" => "ez-platform/file-simulator-sftp-creds",
                    "http" => "ez-platform/file-simulator-http-creds",
                    "s3" => "ez-platform/file-simulator-s3-creds",
                    "nfs" => null, // NFS is anonymous in file-simulator
                    "kafka" => null, // PLAINTEXT doesn't need credentials
                    _ => null
                },
                ConnectionTimeoutSeconds = _random.Next(15, 61),
                RetryCount = _random.Next(2, 6),
                LastConnectionTest = DateTime.UtcNow.AddMinutes(-_random.Next(5, 120)),
                LastConnectionSuccess = true,
                TypeSpecificConfig = config.ServerType switch
                {
                    "ftp" => new BsonDocument
                    {
                        { "Username", "ftpuser" },
                        { "Password", "ftppass123" },
                        { "PassiveMode", true },
                        { "UseSsl", false }
                    },
                    "sftp" => new BsonDocument
                    {
                        { "Username", "sftpuser" },
                        { "Password", "sftppass123" },
                        { "UseKeyAuth", false }
                    },
                    "s3" => new BsonDocument
                    {
                        { "Endpoint", $"http://{config.Host}:{config.Port}" },
                        { "AccessKey", "minioadmin" },
                        { "SecretKey", "minioadmin123" },
                        { "Region", "us-east-1" },
                        { "ForcePathStyle", true },
                        { "UseHttp", true },
                        { "Bucket", config.BasePath == null || config.Description.Contains("Data Lake") ? "input" : "output" }
                    },
                    "http" => new BsonDocument
                    {
                        { "Username", "httpuser" },
                        { "Password", "httppass123" },
                        { "AuthType", "basic" }
                    },
                    _ => null
                },
                CreatedBy = "DemoGenerator",
                CorrelationId = Guid.NewGuid().ToString()
            };

            await server.SaveAsync();
            servers.Add(server);
            Console.WriteLine($"  ✓ Created: {server.Name} ({server.ServerType}, {server.Direction})");
        }

        Console.WriteLine($"  ✅ Generated {servers.Count} admin servers\n");
        return servers;
    }

    /// <summary>
    /// Gets a server by type for assigning to datasources
    /// </summary>
    public static AdminServer? GetServerByType(List<AdminServer> servers, string connectionType)
    {
        var serverType = connectionType.ToLower() switch
        {
            "local" => "local",
            "ftp" => "ftp",
            "sftp" => "sftp",
            "http" => "http",
            "kafka" => "kafka",
            "s3" => "s3",
            "nfs" => "nfs",
            "folder" => "folder",
            _ => "local"
        };

        return servers.FirstOrDefault(s =>
            s.ServerType.Equals(serverType, StringComparison.OrdinalIgnoreCase) &&
            s.CanBeInput);
    }
}

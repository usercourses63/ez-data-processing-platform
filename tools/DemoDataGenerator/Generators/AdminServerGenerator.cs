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

    public AdminServerGenerator(Random random)
    {
        _random = random;
    }

    public async Task<List<AdminServer>> GenerateAsync()
    {
        Console.WriteLine("[2/10] 🖥️  Generating Admin Servers...");
        var servers = new List<AdminServer>();

        // Define server configurations matching the connection types used in datasources
        var serverConfigs = new (string Name, string NameEn, string Description, string ServerType, ServerDirection Direction, string? Host, int? Port, string? BasePath, KafkaServerConfig? KafkaConfig)[]
        {
            // Local file server (development)
            (
                Name: "שרת קבצים מקומי",
                NameEn: "Local File Server",
                Description: "שרת קבצים מקומי לפיתוח - גישה ישירה לקבצים",
                ServerType: "local",
                Direction: ServerDirection.Both,
                Host: null,
                Port: null,
                BasePath: "/data/input",
                KafkaConfig: null
            ),
            // FTP server
            (
                Name: "שרת FTP ראשי",
                NameEn: "Main FTP Server",
                Description: "שרת FTP לקליטת קבצים מספקים חיצוניים",
                ServerType: "ftp",
                Direction: ServerDirection.Both,
                Host: "files.example.com",
                Port: 21,
                BasePath: "/incoming",
                KafkaConfig: null
            ),
            // SFTP server
            (
                Name: "שרת SFTP מאובטח",
                NameEn: "Secure SFTP Server",
                Description: "שרת SFTP מאובטח להעברת קבצים רגישים",
                ServerType: "sftp",
                Direction: ServerDirection.Both,
                Host: "secure.example.com",
                Port: 22,
                BasePath: "/data",
                KafkaConfig: null
            ),
            // HTTP API server
            (
                Name: "שרת API חיצוני",
                NameEn: "External API Server",
                Description: "שרת HTTP API לקליטת נתונים מממשקי REST",
                ServerType: "http",
                Direction: ServerDirection.Input,
                Host: "api.example.com",
                Port: 443,
                BasePath: "/files",
                KafkaConfig: null
            ),
            // Kafka cluster
            (
                Name: "אשכול Kafka ראשי",
                NameEn: "Main Kafka Cluster",
                Description: "אשכול Kafka לזרימת אירועים בזמן אמת",
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
            // S3/MinIO server
            (
                Name: "אחסון S3 (MinIO)",
                NameEn: "S3 Storage (MinIO)",
                Description: "שרת MinIO תואם S3 לאחסון קבצים מבוזר",
                ServerType: "s3",
                Direction: ServerDirection.Both,
                Host: "minio.ez-platform.svc.cluster.local",
                Port: 9000,
                BasePath: null,
                KafkaConfig: null
            ),
            // NFS server
            (
                Name: "שרת NFS משותף",
                NameEn: "Shared NFS Server",
                Description: "שרת NFS לגישה משותפת לקבצים בין שירותים",
                ServerType: "nfs",
                Direction: ServerDirection.Both,
                Host: null,
                Port: null,
                BasePath: "/exports/data",
                KafkaConfig: null
            ),
            // Output folder
            (
                Name: "תיקיית פלט מקומית",
                NameEn: "Local Output Folder",
                Description: "תיקיית פלט לכתיבת קבצים מעובדים",
                ServerType: "folder",
                Direction: ServerDirection.Output,
                Host: null,
                Port: null,
                BasePath: "/data/output",
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
                    "ftp" => "ez-platform/ftp-credentials",
                    "sftp" => "ez-platform/sftp-credentials",
                    "http" => "ez-platform/api-credentials",
                    "s3" => "ez-platform/s3-credentials",
                    "kafka" => null, // PLAINTEXT doesn't need credentials
                    _ => null
                },
                ConnectionTimeoutSeconds = _random.Next(15, 61),
                RetryCount = _random.Next(2, 6),
                LastConnectionTest = DateTime.UtcNow.AddMinutes(-_random.Next(5, 120)),
                LastConnectionSuccess = true,
                TypeSpecificConfig = config.ServerType switch
                {
                    "ftp" => new BsonDocument { { "passiveMode", true }, { "useSsl", false } },
                    "sftp" => new BsonDocument { { "useKeyAuth", false } },
                    "s3" => new BsonDocument { { "region", "us-east-1" }, { "usePathStyle", true }, { "bucket", "ez-data" } },
                    "http" => new BsonDocument { { "authType", "bearer" }, { "method", "GET" } },
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

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.ComponentModel.DataAnnotations;

namespace DataProcessing.Shared.Entities;

/// <summary>
/// Represents a configured server for file access (input/output)
/// Admins configure servers in System Settings; users select from dropdown when creating datasources
/// </summary>
public class AdminServer : DataProcessingBaseEntity
{
    /// <summary>
    /// Display name for the server (e.g., "Production Kafka Cluster", "S3 Data Lake")
    /// </summary>
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the server purpose
    /// </summary>
    [StringLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Server type: ftp, sftp, s3, nfs, http, kafka, folder
    /// </summary>
    [Required]
    [StringLength(20)]
    public string ServerType { get; set; } = string.Empty;

    /// <summary>
    /// Whether this server can be used for input, output, or both
    /// </summary>
    [BsonRepresentation(BsonType.String)]
    public ServerDirection Direction { get; set; } = ServerDirection.Both;

    /// <summary>
    /// Whether the server is active and available for selection
    /// </summary>
    public bool IsActive { get; set; } = true;

    // ========== Common Connection Fields ==========

    /// <summary>
    /// Server hostname or IP address (FTP, SFTP, HTTP, Kafka)
    /// For S3: endpoint URL
    /// </summary>
    [StringLength(255)]
    public string? Host { get; set; }

    /// <summary>
    /// Server port (FTP: 21, SFTP: 22, HTTP: 80/443, Kafka: 9092)
    /// </summary>
    public int? Port { get; set; }

    /// <summary>
    /// Base path for file operations
    /// For NFS/Folder: mount path
    /// For S3: not used (bucket is in TypeSpecificConfig)
    /// </summary>
    [StringLength(500)]
    public string? BasePath { get; set; }

    // ========== Security ==========

    /// <summary>
    /// Reference to Kubernetes Secret containing credentials
    /// Format: "namespace/secret-name" or just "secret-name" for same namespace
    /// Credentials are NOT stored in database
    /// </summary>
    [StringLength(255)]
    public string? CredentialSecretRef { get; set; }

    // ========== Kafka-Specific Configuration ==========

    /// <summary>
    /// Kafka-specific configuration (when ServerType == "kafka")
    /// </summary>
    public KafkaServerConfig? KafkaConfig { get; set; }

    // ========== Type-Specific Configuration ==========

    /// <summary>
    /// Additional type-specific configuration stored as BSON
    /// FTP: { "passiveMode": true, "useSsl": true }
    /// S3: { "region": "us-east-1", "usePathStyle": true, "bucket": "data-lake" }
    /// HTTP: { "authType": "bearer", "headers": { "X-API-Key": "..." } }
    /// SFTP: { "useKeyAuth": true }
    /// </summary>
    public BsonDocument? TypeSpecificConfig { get; set; }

    // ========== Connection Settings ==========

    /// <summary>
    /// Connection timeout in seconds
    /// </summary>
    public int ConnectionTimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Number of retry attempts for failed operations
    /// </summary>
    public int RetryCount { get; set; } = 3;

    // ========== Usage Tracking ==========

    /// <summary>
    /// Last time connection was tested
    /// </summary>
    public DateTime? LastConnectionTest { get; set; }

    /// <summary>
    /// Result of last connection test
    /// </summary>
    public bool? LastConnectionSuccess { get; set; }

    /// <summary>
    /// Error message from last failed connection test
    /// </summary>
    [StringLength(1000)]
    public string? LastConnectionError { get; set; }

    // ========== Helper Methods ==========

    /// <summary>
    /// Checks if this server can be used as an input source
    /// </summary>
    public bool CanBeInput => Direction == ServerDirection.Input || Direction == ServerDirection.Both;

    /// <summary>
    /// Checks if this server can be used as an output destination
    /// </summary>
    public bool CanBeOutput => Direction == ServerDirection.Output || Direction == ServerDirection.Both;

    /// <summary>
    /// Updates connection test results
    /// </summary>
    public void SetConnectionTestResult(bool success, string? errorMessage = null)
    {
        LastConnectionTest = DateTime.UtcNow;
        LastConnectionSuccess = success;
        LastConnectionError = success ? null : errorMessage;
        MarkAsModified();
    }
}

/// <summary>
/// Defines whether a server can be used for input, output, or both
/// </summary>
public enum ServerDirection
{
    /// <summary>
    /// Server can only be used as an input source for file discovery
    /// </summary>
    Input,

    /// <summary>
    /// Server can only be used as an output destination for processed data
    /// </summary>
    Output,

    /// <summary>
    /// Server can be used for both input and output
    /// </summary>
    Both
}

/// <summary>
/// Kafka-specific server configuration
/// Admin configures connection; users configure topics when creating datasources
/// </summary>
public class KafkaServerConfig
{
    /// <summary>
    /// Kafka bootstrap servers (e.g., "kafka:9092,kafka2:9092")
    /// </summary>
    [Required]
    [StringLength(500)]
    public string BootstrapServers { get; set; } = string.Empty;

    /// <summary>
    /// Security protocol: PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL
    /// </summary>
    [Required]
    [StringLength(20)]
    public string SecurityProtocol { get; set; } = "PLAINTEXT";

    /// <summary>
    /// SASL mechanism: PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
    /// Required when SecurityProtocol contains SASL
    /// </summary>
    [StringLength(20)]
    public string? SaslMechanism { get; set; }

    /// <summary>
    /// Whether SSL/TLS is enabled
    /// </summary>
    public bool EnableSsl { get; set; }

    /// <summary>
    /// Path to CA certificate for SSL verification
    /// </summary>
    [StringLength(500)]
    public string? SslCaLocation { get; set; }

    /// <summary>
    /// Required acknowledgments for producer: 0, 1, or -1 (all)
    /// </summary>
    public int AcksRequired { get; set; } = 1;

    /// <summary>
    /// Default consumer group prefix (user can override per datasource)
    /// </summary>
    [StringLength(100)]
    public string? DefaultConsumerGroup { get; set; }

    /// <summary>
    /// Additional Kafka client configuration
    /// </summary>
    public Dictionary<string, string>? AdditionalConfig { get; set; }
}

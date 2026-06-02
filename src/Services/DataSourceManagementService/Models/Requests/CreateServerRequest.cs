using System.ComponentModel.DataAnnotations;
using DataProcessing.Shared.Entities;
using MongoDB.Bson;

namespace DataProcessing.DataSourceManagement.Models.Requests;

/// <summary>
/// Request model for creating a new admin server
/// </summary>
public class CreateServerRequest
{
    /// <summary>
    /// Display name for the server (e.g., "Production Kafka Cluster")
    /// </summary>
    [Required(ErrorMessage = "שם השרת נדרש")]
    [StringLength(100, ErrorMessage = "שם השרת לא יכול להיות ארוך מ-100 תווים")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the server purpose
    /// </summary>
    [StringLength(500, ErrorMessage = "תיאור לא יכול להיות ארוך מ-500 תווים")]
    public string? Description { get; set; }

    /// <summary>
    /// Server type: ftp, sftp, s3, nfs, http, kafka, folder
    /// </summary>
    [Required(ErrorMessage = "סוג השרת נדרש")]
    [StringLength(20, ErrorMessage = "סוג השרת לא יכול להיות ארוך מ-20 תווים")]
    public string ServerType { get; set; } = string.Empty;

    /// <summary>
    /// Whether this server can be used for input, output, or both
    /// </summary>
    public ServerDirection Direction { get; set; } = ServerDirection.Both;

    /// <summary>
    /// Whether the server is active (defaults to true)
    /// </summary>
    public bool IsActive { get; set; } = true;

    // ========== Common Connection Fields ==========

    /// <summary>
    /// Server hostname or IP address
    /// </summary>
    [StringLength(255, ErrorMessage = "כתובת השרת לא יכולה להיות ארוכה מ-255 תווים")]
    public string? Host { get; set; }

    /// <summary>
    /// Server port
    /// </summary>
    public int? Port { get; set; }

    /// <summary>
    /// Base path for file operations
    /// </summary>
    [StringLength(500, ErrorMessage = "נתיב הבסיס לא יכול להיות ארוך מ-500 תווים")]
    public string? BasePath { get; set; }

    // ========== Security ==========

    /// <summary>
    /// Reference to Kubernetes Secret containing credentials
    /// </summary>
    [StringLength(255)]
    public string? CredentialSecretRef { get; set; }

    // ========== Kafka-Specific ==========

    /// <summary>
    /// Kafka-specific configuration (when ServerType == "kafka")
    /// </summary>
    public KafkaServerConfigRequest? KafkaConfig { get; set; }

    // ========== Type-Specific Configuration ==========

    /// <summary>
    /// Additional type-specific configuration. Keys are persisted verbatim into
    /// <c>AdminServer.TypeSpecificConfig</c> and read by
    /// <c>ServerCredentials.FromBsonDocument</c> at connection-establish time, so the casing
    /// must match exactly.
    ///
    /// <para>S3 / MinIO contract (PascalCase — Phase 34):</para>
    /// <list type="bullet">
    ///   <item><c>AccessKey</c> — S3 access key id.</item>
    ///   <item><c>SecretKey</c> — S3 secret access key. <b>Write-only</b>: encrypted at rest
    ///   and never echoed back in plaintext on read.</item>
    ///   <item><c>Bucket</c> — target bucket name.</item>
    ///   <item><c>Region</c> — AWS region (e.g. <c>us-east-1</c>).</item>
    ///   <item><c>ForcePathStyle</c> — <c>true</c> for MinIO / raw-IP endpoints.</item>
    ///   <item><c>UseHttp</c> — <c>true</c> for http-only endpoints.</item>
    ///   <item><c>SessionToken</c> (optional) — temporary-credential session token.</item>
    ///   <item><c>Endpoint</c> (optional) — explicit S3 endpoint URL.</item>
    /// </list>
    /// </summary>
    public Dictionary<string, object>? TypeSpecificConfig { get; set; }

    // ========== Connection Settings ==========

    /// <summary>
    /// Connection timeout in seconds
    /// </summary>
    public int ConnectionTimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Number of retry attempts
    /// </summary>
    public int RetryCount { get; set; } = 3;
}

/// <summary>
/// Kafka server configuration for requests
/// </summary>
public class KafkaServerConfigRequest
{
    /// <summary>
    /// Kafka bootstrap servers
    /// </summary>
    [Required(ErrorMessage = "Bootstrap servers נדרש")]
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
    /// </summary>
    [StringLength(20)]
    public string? SaslMechanism { get; set; }

    /// <summary>
    /// Whether SSL/TLS is enabled
    /// </summary>
    public bool EnableSsl { get; set; }

    /// <summary>
    /// Path to CA certificate
    /// </summary>
    [StringLength(500)]
    public string? SslCaLocation { get; set; }

    /// <summary>
    /// Required acknowledgments for producer
    /// </summary>
    public int AcksRequired { get; set; } = 1;

    /// <summary>
    /// Default consumer group prefix
    /// </summary>
    [StringLength(100)]
    public string? DefaultConsumerGroup { get; set; }

    /// <summary>
    /// Additional Kafka client configuration
    /// </summary>
    public Dictionary<string, string>? AdditionalConfig { get; set; }
}

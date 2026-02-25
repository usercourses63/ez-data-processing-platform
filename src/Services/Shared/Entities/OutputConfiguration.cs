// OutputConfiguration.cs - Multi-Destination Output Support
// Task-16: Enhanced Output Configuration Entity Model
// Version: 1.0
// Date: November 12, 2025

using MongoDB.Entities;

namespace DataProcessing.Shared.Entities;

/// <summary>
/// Output configuration supporting multiple destinations per datasource
/// </summary>
public class OutputConfiguration
{
    /// <summary>
    /// List of output destinations (Kafka topics, folders, SFTP, HTTP endpoints)
    /// Can configure 1-N destinations of mixed types
    /// </summary>
    public List<OutputDestination> Destinations { get; set; } = new();
    
    /// <summary>
    /// Global default: Include invalid records in output
    /// Can be overridden per destination
    /// </summary>
    public bool IncludeInvalidRecords { get; set; } = false;
    
    /// <summary>
    /// Global default output format: "original", "json", "csv", "xml"
    /// Can be overridden per destination
    /// </summary>
    public string DefaultOutputFormat { get; set; } = "original";
}

/// <summary>
/// Single output destination configuration
/// </summary>
public class OutputDestination
{
    /// <summary>
    /// Unique identifier for this destination
    /// </summary>
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    /// <summary>
    /// User-friendly name (e.g., "Real-Time Analytics", "Daily Archive")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Description or notes about this destination
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Destination type: "kafka", "folder", "sftp", "http"
    /// Determines which config object is used
    /// </summary>
    public string Type { get; set; } = "kafka";
    
    /// <summary>
    /// Whether this destination is enabled
    /// Allows disabling without deleting configuration
    /// </summary>
    public bool Enabled { get; set; } = true;
    
    /// <summary>
    /// Override global output format for this destination
    /// If null, uses OutputConfiguration.DefaultOutputFormat
    /// </summary>
    public string? OutputFormat { get; set; }
    
    /// <summary>
    /// Override global include invalid records setting
    /// If null, uses OutputConfiguration.IncludeInvalidRecords
    /// </summary>
    public bool? IncludeInvalidRecords { get; set; }
    
    // Type-specific configurations (only one should be populated based on Type)
    
    /// <summary>
    /// Kafka-specific configuration (when Type = "kafka")
    /// </summary>
    public KafkaOutputConfig? KafkaConfig { get; set; }
    
    /// <summary>
    /// Folder-specific configuration (when Type = "folder")
    /// </summary>
    public FolderOutputConfig? FolderConfig { get; set; }
    
    /// <summary>
    /// SFTP-specific configuration (when Type = "sftp") - FUTURE
    /// </summary>
    public SftpOutputConfig? SftpConfig { get; set; }
    
    /// <summary>
    /// HTTP API configuration (when Type = "http") - FUTURE
    /// </summary>
    public HttpOutputConfig? HttpConfig { get; set; }

    /// <summary>
    /// S3/MinIO-specific configuration (when Type = "s3")
    /// Added in v0.2.0 for file protocol support
    /// </summary>
    public S3OutputConfig? S3Config { get; set; }

    /// <summary>
    /// FTP-specific configuration (when Type = "ftp")
    /// Added in v0.2.0 for file protocol support
    /// </summary>
    public FtpOutputConfig? FtpConfig { get; set; }

    /// <summary>
    /// Reference to AdminServer for server-based destinations (v0.2.0)
    /// If set, uses credentials from the server configuration
    /// </summary>
    public string? OutputServerId { get; set; }
}

/// <summary>
/// Kafka output configuration
/// </summary>
public class KafkaOutputConfig
{
    /// <summary>
    /// Kafka broker server address (optional)
    /// If null, uses the default broker from configuration
    /// Example: "localhost:9092" or "broker1:9092,broker2:9092"
    /// </summary>
    public string? BrokerServer { get; set; }

    /// <summary>
    /// Kafka topic name (required)
    /// </summary>
    public string Topic { get; set; } = string.Empty;

    /// <summary>
    /// Kafka message key pattern (optional)
    /// Supports placeholders: {filename}, {datasource}, {timestamp}, {recordId}
    /// Example: "{datasource}_{filename}"
    /// </summary>
    public string? MessageKey { get; set; }

    /// <summary>
    /// Custom Kafka headers (optional)
    /// Example: { "source": "banking-system", "environment": "production" }
    /// </summary>
    public Dictionary<string, string>? Headers { get; set; }

    /// <summary>
    /// Kafka partition key (optional)
    /// If null, Kafka will use default partitioning
    /// </summary>
    public int? PartitionKey { get; set; }

    // Authentication Configuration

    /// <summary>
    /// Security protocol for Kafka connection
    /// Values: "PLAINTEXT", "SASL_SSL", "SASL_PLAINTEXT"
    /// Default: PLAINTEXT (no encryption)
    /// </summary>
    public string? SecurityProtocol { get; set; }

    /// <summary>
    /// SASL mechanism for authentication
    /// Values: "PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512"
    /// Only used when SecurityProtocol is SASL_*
    /// </summary>
    public string? SaslMechanism { get; set; }

    /// <summary>
    /// Username for SASL authentication
    /// Required when using SASL security protocol
    /// </summary>
    public string? Username { get; set; }

    /// <summary>
    /// Password for SASL authentication
    /// Required when using SASL security protocol
    /// Note: Consider encryption at rest for sensitive data
    /// </summary>
    public string? Password { get; set; }
}

/// <summary>
/// Local folder output configuration
/// </summary>
public class FolderOutputConfig
{
    /// <summary>
    /// Local folder path (required)
    /// Example: "C:\DataProcessing\Archive\Banking"
    /// </summary>
    public string Path { get; set; } = string.Empty;
    
    /// <summary>
    /// Filename pattern (optional)
    /// Supports placeholders: {filename}, {date}, {timestamp}, {datasource}, {ext}
    /// Example: "{filename}_{date}_valid.{ext}"
    /// If null, uses original filename
    /// </summary>
    public string? FileNamePattern { get; set; }
    
    /// <summary>
    /// Create subfolders based on pattern
    /// </summary>
    public bool CreateSubfolders { get; set; } = false;
    
    /// <summary>
    /// Subfolder pattern (used if CreateSubfolders = true)
    /// Supports placeholders: {year}, {month}, {day}, {datasource}, {date}
    /// Example: "{year}/{month}/{day}" creates "2025/11/12/"
    /// </summary>
    public string? SubfolderPattern { get; set; }
    
    /// <summary>
    /// Whether to overwrite existing files
    /// If false and file exists, appends timestamp to filename
    /// </summary>
    public bool OverwriteExisting { get; set; } = false;
}

/// <summary>
/// SFTP output configuration (FUTURE)
/// </summary>
public class SftpOutputConfig
{
    /// <summary>
    /// SFTP server hostname or IP
    /// </summary>
    public string Host { get; set; } = string.Empty;
    
    /// <summary>
    /// SFTP server port (default: 22)
    /// </summary>
    public int Port { get; set; } = 22;
    
    /// <summary>
    /// SFTP username
    /// </summary>
    public string Username { get; set; } = string.Empty;
    
    /// <summary>
    /// SFTP password (consider encryption in production)
    /// </summary>
    public string Password { get; set; } = string.Empty;
    
    /// <summary>
    /// Remote path on SFTP server
    /// Example: "/data/incoming/validated"
    /// </summary>
    public string RemotePath { get; set; } = string.Empty;
}

/// <summary>
/// HTTP API output configuration (FUTURE)
/// </summary>
public class HttpOutputConfig
{
    /// <summary>
    /// HTTP endpoint URL
    /// Example: "https://api.example.com/data/ingest"
    /// </summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>
    /// HTTP method (GET, POST, PUT, PATCH)
    /// </summary>
    public string Method { get; set; } = "POST";

    /// <summary>
    /// Custom HTTP headers (optional)
    /// Example: { "Content-Type": "application/json", "X-API-Key": "..." }
    /// </summary>
    public Dictionary<string, string>? Headers { get; set; }

    /// <summary>
    /// Bearer token for authentication (optional)
    /// If provided, adds "Authorization: Bearer {token}" header
    /// </summary>
    public string? AuthToken { get; set; }
}

/// <summary>
/// S3/MinIO output configuration (v0.2.0)
/// </summary>
public class S3OutputConfig
{
    /// <summary>
    /// S3 endpoint URL
    /// For AWS: Use region-specific endpoint or omit for default
    /// For MinIO: "http://minio:9000"
    /// </summary>
    public string? Endpoint { get; set; }

    /// <summary>
    /// S3 bucket name (required)
    /// </summary>
    public string Bucket { get; set; } = string.Empty;

    /// <summary>
    /// Key prefix (folder path) in the bucket
    /// Example: "validated-data/banking/"
    /// </summary>
    public string? KeyPrefix { get; set; }

    /// <summary>
    /// AWS region (e.g., "us-east-1")
    /// Required for AWS S3, optional for MinIO
    /// </summary>
    public string? Region { get; set; }

    /// <summary>
    /// Access key ID (if not using server credentials)
    /// </summary>
    public string? AccessKeyId { get; set; }

    /// <summary>
    /// Secret access key (if not using server credentials)
    /// </summary>
    public string? SecretAccessKey { get; set; }

    /// <summary>
    /// Use path-style URLs (required for MinIO, optional for AWS)
    /// </summary>
    public bool UsePathStyle { get; set; } = true;

    /// <summary>
    /// Key naming pattern
    /// Supports placeholders: {filename}, {date}, {timestamp}, {datasource}, {ext}
    /// Example: "{datasource}/{date}/{filename}.{ext}"
    /// </summary>
    public string? KeyPattern { get; set; }
}

/// <summary>
/// FTP output configuration (v0.2.0)
/// </summary>
public class FtpOutputConfig
{
    /// <summary>
    /// FTP server hostname or IP
    /// </summary>
    public string Host { get; set; } = string.Empty;

    /// <summary>
    /// FTP server port (default: 21)
    /// </summary>
    public int Port { get; set; } = 21;

    /// <summary>
    /// FTP username
    /// </summary>
    public string? Username { get; set; }

    /// <summary>
    /// FTP password
    /// </summary>
    public string? Password { get; set; }

    /// <summary>
    /// Remote path on FTP server
    /// Example: "/data/incoming/validated"
    /// </summary>
    public string RemotePath { get; set; } = string.Empty;

    /// <summary>
    /// Use passive mode for FTP connections
    /// </summary>
    public bool UsePassiveMode { get; set; } = true;

    /// <summary>
    /// Enable SSL/TLS for secure FTP (FTPS)
    /// </summary>
    public bool UseSsl { get; set; } = false;

    /// <summary>
    /// Filename pattern (optional)
    /// Supports placeholders: {filename}, {date}, {timestamp}, {datasource}, {ext}
    /// </summary>
    public string? FileNamePattern { get; set; }
}

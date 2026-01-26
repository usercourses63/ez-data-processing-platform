using System.ComponentModel.DataAnnotations;
using DataProcessing.Shared.Entities;

namespace DataProcessing.DataSourceManagement.Models.Requests;

/// <summary>
/// Request model for updating an existing admin server
/// </summary>
public class UpdateServerRequest
{
    /// <summary>
    /// Display name for the server
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
    /// Whether the server is active
    /// </summary>
    public bool IsActive { get; set; } = true;

    // ========== Common Connection Fields ==========

    /// <summary>
    /// Server hostname or IP address
    /// </summary>
    [StringLength(255)]
    public string? Host { get; set; }

    /// <summary>
    /// Server port
    /// </summary>
    public int? Port { get; set; }

    /// <summary>
    /// Base path for file operations
    /// </summary>
    [StringLength(500)]
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
    /// Additional type-specific configuration
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

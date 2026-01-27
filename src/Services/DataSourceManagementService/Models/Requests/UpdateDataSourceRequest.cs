using System.ComponentModel.DataAnnotations;

namespace DataProcessing.DataSourceManagement.Models.Requests;

/// <summary>
/// Request model for updating an existing data source
/// </summary>
public class UpdateDataSourceRequest
{
    /// <summary>
    /// ID of the data source to update
    /// </summary>
    [Required(ErrorMessage = "מזהה מקור הנתונים נדרש")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Updated name of the data source
    /// </summary>
    [Required(ErrorMessage = "שם מקור הנתונים נדרש")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "שם מקור הנתונים חייב להיות בין 2 ל-100 תווים")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated name of the data supplier
    /// </summary>
    [Required(ErrorMessage = "שם ספק הנתונים נדרש")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "שם ספק הנתונים חייב להיות בין 2 ל-100 תווים")]
    public string SupplierName { get; set; } = string.Empty;

    /// <summary>
    /// Updated category or type of data source
    /// </summary>
    [Required(ErrorMessage = "קטגוריה נדרשת")]
    [StringLength(50, ErrorMessage = "קטגוריה לא יכולה להיות ארוכה מ-50 תווים")]
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Updated description of the data source
    /// </summary>
    [StringLength(500, ErrorMessage = "תיאור לא יכול להיות ארוך מ-500 תווים")]
    public string? Description { get; set; }

    /// <summary>
    /// Updated connection string or path to data source (optional - FilePath is used if not provided)
    /// </summary>
    [StringLength(1000, ErrorMessage = "נתיב החיבור לא יכול להיות ארוך מ-1000 תווים")]
    public string? ConnectionString { get; set; }

    /// <summary>
    /// Updated active status
    /// </summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Updated configuration settings in JSON format
    /// </summary>
    public string? ConfigurationSettings { get; set; }

    /// <summary>
    /// Updated validation rules in JSON format
    /// </summary>
    public string? ValidationRules { get; set; }

    /// <summary>
    /// Updated metadata in JSON format
    /// </summary>
    public string? Metadata { get; set; }

    /// <summary>
    /// Updated file format or pattern (for file-based sources)
    /// </summary>
    [StringLength(100, ErrorMessage = "פורמט הקובץ לא יכול להיות ארוך מ-100 תווים")]
    public string? FileFormat { get; set; }

    /// <summary>
    /// Updated retention period for processed data
    /// </summary>
    public int? RetentionDays { get; set; }

    /// <summary>
    /// File path or directory to monitor for new files
    /// </summary>
    [StringLength(500, ErrorMessage = "נתיב הקובץ לא יכול להיות ארוך מ-500 תווים")]
    public string? FilePath { get; set; }

    /// <summary>
    /// Updated polling interval for checking new files (format: HH:MM:SS)
    /// </summary>
    public string? PollingRate { get; set; }

    /// <summary>
    /// Quartz cron expression for scheduling (6-field format with seconds support)
    /// Format: second minute hour day month dayOfWeek
    /// Example: "*/30 * * * * *" = every 30 seconds, "0 */15 * * * *" = every 15 minutes
    /// </summary>
    [StringLength(100, ErrorMessage = "ביטוי Cron לא יכול להיות ארוך מ-100 תווים")]
    public string? CronExpression { get; set; }

    /// <summary>
    /// Schedule frequency (Manual, Hourly, Daily, Weekly, Every5Minutes, etc.)
    /// </summary>
    [StringLength(50, ErrorMessage = "תדירות התזמון לא יכולה להיות ארוכה מ-50 תווים")]
    public string? ScheduleFrequency { get; set; }

    /// <summary>
    /// Whether scheduling is enabled for this data source
    /// </summary>
    public bool? ScheduleEnabled { get; set; }

    /// <summary>
    /// Updated JSON schema document for validating file content
    /// </summary>
    public object? JsonSchema { get; set; }

    /// <summary>
    /// Updated file pattern or filter for selecting files (e.g., "*.json", "*.xml")
    /// </summary>
    [StringLength(50, ErrorMessage = "תבנית הקובץ לא יכולה להיות ארוכה מ-50 תווים")]
    public string? FilePattern { get; set; }

    /// <summary>
    /// Updated schema version (for schema evolution tracking)
    /// </summary>
    public int? SchemaVersion { get; set; }

    /// <summary>
    /// Output configuration with destinations (folder, Kafka, SFTP, HTTP)
    /// </summary>
    public DataProcessing.Shared.Entities.OutputConfiguration? Output { get; set; }

    /// <summary>
    /// Archive processing settings (v0.2.0)
    /// Configures how archive files (ZIP, TAR.GZ, RAR, 7Z) should be handled
    /// </summary>
    public DataProcessing.Shared.Services.ArchiveSettings? ArchiveSettings { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace DataProcessing.Shared.Messages;

/// <summary>
/// Event published when a new file is discovered by the file discovery service
/// Published by: FileDiscoveryService
/// Consumed by: FileProcessorService
/// </summary>
public class FileDiscoveredEvent : IDataProcessingMessage
{
    /// <summary>
    /// Unique correlation ID for tracing requests across services
    /// </summary>
    [Required]
    public string CorrelationId { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the message was created
    /// </summary>
    [Required]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Name of the service that published this message
    /// </summary>
    [Required]
    public string PublishedBy { get; set; } = "FileDiscoveryService";

    /// <summary>
    /// Version of the message schema for compatibility tracking
    /// </summary>
    public int MessageVersion { get; set; } = 1;

    /// <summary>
    /// ID of the data source this file belongs to
    /// </summary>
    [Required]
    [StringLength(24)]
    public string DataSourceId { get; set; } = string.Empty;

    /// <summary>
    /// Name of the discovered file
    /// </summary>
    [Required]
    [StringLength(500)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// Full path to the discovered file
    /// </summary>
    [Required]
    [StringLength(2000)]
    public string FilePath { get; set; } = string.Empty;

    /// <summary>
    /// Size of the file in bytes
    /// </summary>
    [Required]
    public long FileSizeBytes { get; set; }

    /// <summary>
    /// UTC timestamp when the file was discovered
    /// </summary>
    [Required]
    public DateTime DiscoveredAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Sequence number for ordering files within a batch
    /// Used to maintain processing order when multiple files are discovered
    /// </summary>
    [Required]
    public int SequenceNumber { get; set; }

    /// <summary>
    /// Unique identifier for the batch of files discovered in a single poll
    /// Used for correlation and batch tracking across multiple files
    /// </summary>
    [Required]
    public Guid PollBatchId { get; set; }

    // ========== Archive Support Fields (v0.2.0) ==========

    /// <summary>
    /// Indicates if this file was extracted from an archive
    /// When true, ArchivePath and PathInArchive will be populated
    /// </summary>
    public bool IsFromArchive { get; set; }

    /// <summary>
    /// Full path to the source archive file (when IsFromArchive is true)
    /// </summary>
    [StringLength(2000)]
    public string? ArchivePath { get; set; }

    /// <summary>
    /// Path of this file within the archive (when IsFromArchive is true)
    /// </summary>
    [StringLength(2000)]
    public string? PathInArchive { get; set; }

    /// <summary>
    /// Hazelcast cache key for the archive content
    /// Format: "archive:{guid}" - used to retrieve archive for extraction
    /// </summary>
    [StringLength(100)]
    public string? ArchiveCacheKey { get; set; }

    /// <summary>
    /// Unique identifier grouping all files from the same archive
    /// Used to track processing progress across archive contents
    /// </summary>
    public Guid? ArchiveBatchId { get; set; }

    /// <summary>
    /// Total number of files discovered in the source archive
    /// Used for progress tracking
    /// </summary>
    public int? TotalFilesInArchive { get; set; }

    /// <summary>
    /// Index of this file within the archive (0-based)
    /// Used for progress tracking and ordering
    /// </summary>
    public int? FileIndexInArchive { get; set; }

    // ========== Server Reference Fields (v0.2.0) ==========

    /// <summary>
    /// ID of the AdminServer used for file access (when using new architecture)
    /// </summary>
    [StringLength(24)]
    public string? ServerId { get; set; }

    /// <summary>
    /// Server type identifier (ftp, sftp, s3, etc.)
    /// </summary>
    [StringLength(20)]
    public string? ServerType { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace DataProcessing.Shared.Entities;

/// <summary>
/// Stores the result of a single health check for a NAS device or AdminServer.
/// Records are automatically expired after 7 days via MongoDB TTL index on CheckedAt.
/// v0.2.0: Device Health Monitoring (MON-05, MON-06)
/// </summary>
public class DeviceHealthCheckResult : DataProcessingBaseEntity
{
    /// <summary>
    /// The ID of the device that was checked (NasDevice.ID or AdminServer.ID)
    /// </summary>
    [Required]
    [StringLength(50)]
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>
    /// Display name of the device
    /// </summary>
    [Required]
    [StringLength(100)]
    public string DeviceName { get; set; } = string.Empty;

    /// <summary>
    /// Type of device: "NasDevice" or "AdminServer"
    /// </summary>
    [Required]
    [StringLength(20)]
    public string DeviceType { get; set; } = string.Empty;

    /// <summary>
    /// Health status: "Healthy", "Degraded", or "Down"
    /// </summary>
    [Required]
    [StringLength(20)]
    public string Status { get; set; } = "Healthy";

    /// <summary>
    /// Round-trip latency in milliseconds
    /// </summary>
    public long LatencyMs { get; set; }

    /// <summary>
    /// Whether the health check succeeded
    /// </summary>
    public bool IsSuccess { get; set; }

    /// <summary>
    /// Error message if the health check failed
    /// </summary>
    [StringLength(1000)]
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// UTC timestamp when the check was performed.
    /// MongoDB TTL index expires documents based on this field (7-day retention).
    /// </summary>
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
}

namespace DataProcessing.DataSourceManagement.Models.Responses;

/// <summary>
/// Aggregated health status response for all monitored devices.
/// Returned by GET /api/v1/health-status.
/// v0.2.0: Device Health Monitoring (MON-05, MON-06)
/// </summary>
public class DeviceHealthStatusResponse
{
    /// <summary>
    /// Total number of devices (active + disabled)
    /// </summary>
    public int TotalDevices { get; set; }

    /// <summary>
    /// Number of devices with Healthy status
    /// </summary>
    public int HealthyCount { get; set; }

    /// <summary>
    /// Number of devices with Degraded status
    /// </summary>
    public int DegradedCount { get; set; }

    /// <summary>
    /// Number of devices with Down status
    /// </summary>
    public int DownCount { get; set; }

    /// <summary>
    /// Number of disabled/unprovisioned devices
    /// </summary>
    public int DisabledCount { get; set; }

    /// <summary>
    /// Health info for all NAS devices
    /// </summary>
    public List<DeviceHealthInfo> NasDevices { get; set; } = new();

    /// <summary>
    /// Health info for all AdminServers
    /// </summary>
    public List<DeviceHealthInfo> AdminServers { get; set; } = new();
}

/// <summary>
/// Health information for a single device (NAS or AdminServer)
/// </summary>
public class DeviceHealthInfo
{
    /// <summary>
    /// Device ID (MongoDB entity ID)
    /// </summary>
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>
    /// Display name of the device
    /// </summary>
    public string DeviceName { get; set; } = string.Empty;

    /// <summary>
    /// Device type: "NasDevice" or "AdminServer"
    /// </summary>
    public string DeviceType { get; set; } = string.Empty;

    /// <summary>
    /// Sub-type for AdminServers (e.g., "ftp", "sftp", "kafka")
    /// Null for NAS devices
    /// </summary>
    public string? DeviceSubType { get; set; }

    /// <summary>
    /// Role in the pipeline: "Input", "Output", "Both", "Backup"
    /// </summary>
    public string Role { get; set; } = string.Empty;

    /// <summary>
    /// Current health status: "Healthy", "Degraded", "Down", or "Disabled"
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Last measured latency in milliseconds (null if no check yet or disabled)
    /// </summary>
    public long? LatencyMs { get; set; }

    /// <summary>
    /// Timestamp of the most recent health check
    /// </summary>
    public DateTime? LastCheckTime { get; set; }

    /// <summary>
    /// Error message from the last failed check (null if healthy)
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Uptime percentage over the last 24 hours (0-100, 1 decimal)
    /// </summary>
    public double UptimePercentage24h { get; set; }

    /// <summary>
    /// Whether the device is active/provisioned
    /// </summary>
    public bool IsActive { get; set; }
}

using DataProcessing.DataSourceManagement.Models.Responses;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service interface for device health monitoring.
/// Orchestrates health checks for NAS devices and AdminServers,
/// persists results, and provides aggregated health status.
/// v0.2.0: Device Health Monitoring (MON-05, MON-06)
/// </summary>
public interface IDeviceHealthService
{
    /// <summary>
    /// Run health checks for all active NAS devices and AdminServers.
    /// Results are persisted to MongoDB for history/uptime tracking.
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    Task RunHealthChecksAsync(CancellationToken ct = default);

    /// <summary>
    /// Get aggregated health status for all devices.
    /// Includes latest check result, uptime percentage, and device metadata.
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Aggregated health status response</returns>
    Task<DeviceHealthStatusResponse> GetHealthStatusAsync(CancellationToken ct = default);
}

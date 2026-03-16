using DataProcessing.DataSourceManagement.Models;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service for querying Prometheus and Jaeger HTTP APIs for dashboard metrics,
/// active alerts, and recent traces.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public interface IPrometheusQueryService
{
    /// <summary>
    /// Get aggregated dashboard metrics including KPIs and time-series history.
    /// </summary>
    Task<DashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken ct);

    /// <summary>
    /// Get active alerts from Prometheus alertmanager.
    /// </summary>
    Task<List<AlertDto>> GetActiveAlertsAsync(CancellationToken ct);

    /// <summary>
    /// Get recent distributed traces from Jaeger.
    /// </summary>
    Task<List<TraceDto>> GetRecentTracesAsync(CancellationToken ct);
}

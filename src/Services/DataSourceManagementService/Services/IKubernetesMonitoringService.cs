using DataProcessing.DataSourceManagement.Models;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service for querying Kubernetes API for pod, service, and cluster status.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public interface IKubernetesMonitoringService
{
    /// <summary>
    /// Get status of all pods in the ez-platform namespace.
    /// </summary>
    Task<List<PodStatusDto>> GetPodStatusesAsync(CancellationToken ct);

    /// <summary>
    /// Get status of all EZ Platform services by checking endpoints readiness.
    /// </summary>
    Task<List<ServiceStatusDto>> GetServiceStatusesAsync(CancellationToken ct);

    /// <summary>
    /// Get cluster-level information (version, node count, pod counts).
    /// </summary>
    Task<ClusterInfoDto> GetClusterInfoAsync(CancellationToken ct);
}

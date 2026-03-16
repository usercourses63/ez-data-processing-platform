using DataProcessing.DataSourceManagement.Models;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service for querying Kafka topic metadata and consumer lag.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public interface IKafkaMonitoringService
{
    /// <summary>
    /// Get status of all known Kafka topics including partition count and consumer lag.
    /// </summary>
    Task<List<QueueStatusDto>> GetQueueStatusesAsync(CancellationToken ct);
}

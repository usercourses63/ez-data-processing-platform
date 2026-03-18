namespace DataProcessing.DataSourceManagement.Models;

/// <summary>
/// DTOs for all SignalR monitoring event types.
/// All properties use PascalCase to match backend PropertyNamingPolicy = null.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>

/// <summary>
/// Initial state snapshot sent to newly connected clients.
/// Contains all 7 data fields as a single payload.
/// </summary>
public class MonitoringInitialState
{
    public List<ServiceStatusDto> Services { get; set; } = new();
    public List<PodStatusDto> Pods { get; set; } = new();
    public DashboardMetricsDto Metrics { get; set; } = new();
    public List<QueueStatusDto> Queues { get; set; } = new();
    public List<AlertDto> Alerts { get; set; } = new();
    public List<TraceDto> Traces { get; set; } = new();
    public List<PipelineEventDto> PipelineEvents { get; set; } = new();
    public object? DeviceHealth { get; set; }
    public ClusterInfoDto ClusterInfo { get; set; } = new();
}

/// <summary>
/// Status of an EZ Platform microservice.
/// </summary>
public class ServiceStatusDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Status { get; set; } = "unknown"; // healthy, warning, error, unknown
    public int Port { get; set; }
    public double Cpu { get; set; }
    public double Memory { get; set; }
    public double Throughput { get; set; }
    public double ErrorRate { get; set; }
    public double Latency { get; set; }
    public string Uptime { get; set; } = string.Empty;
    public int Restarts { get; set; }
    public int? QueueDepth { get; set; }
}

/// <summary>
/// Status of a Kubernetes pod in the ez-platform namespace.
/// </summary>
public class PodStatusDto
{
    public string Name { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string Status { get; set; } = "Unknown"; // Running, Pending, Failed, Succeeded, Unknown
    public int Restarts { get; set; }
    public string Cpu { get; set; } = string.Empty; // e.g. "50m"
    public string Memory { get; set; } = string.Empty; // e.g. "128Mi"
    public string Age { get; set; } = string.Empty;
    public string Node { get; set; } = string.Empty;
}

/// <summary>
/// Dashboard-level aggregated metrics from Prometheus.
/// </summary>
public class DashboardMetricsDto
{
    public double TotalThroughput { get; set; }
    public double SuccessRate { get; set; }
    public double AvgLatency { get; set; }
    public int ActiveJobs { get; set; }
    public int QueueDepth { get; set; }
    public double ErrorRate { get; set; }
    public List<MetricDataPointDto> ThroughputHistory { get; set; } = new();
    public List<MetricDataPointDto> LatencyHistory { get; set; } = new();
    public List<MetricDataPointDto> ErrorHistory { get; set; } = new();
}

/// <summary>
/// Single data point in a time-series metric.
/// </summary>
public class MetricDataPointDto
{
    public DateTime Timestamp { get; set; }
    public double Value { get; set; }
}

/// <summary>
/// Pipeline event pushed in real-time from MassTransit consumers.
/// </summary>
public class PipelineEventDto
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Service { get; set; } = string.Empty;
    public string Level { get; set; } = "info"; // info, warn, error
    public string Message { get; set; } = string.Empty;
    public string CorrelationId { get; set; } = string.Empty;
}

/// <summary>
/// Status of a Kafka topic / message queue.
/// </summary>
public class QueueStatusDto
{
    public string Name { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public long Depth { get; set; }
    public double Rate { get; set; }
    public int Consumers { get; set; }
    public string Status { get; set; } = "healthy"; // healthy, warning, error
}

/// <summary>
/// Active alert from Prometheus alertmanager or custom rules.
/// </summary>
public class AlertDto
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Type { get; set; } = "info"; // warning, error, info
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Service { get; set; } = string.Empty;
}

/// <summary>
/// Recent distributed trace summary.
/// </summary>
public class TraceDto
{
    public string TraceId { get; set; } = string.Empty;
    public double TotalDuration { get; set; }
    public List<TraceSpanDto> Spans { get; set; } = new();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Single span within a distributed trace.
/// </summary>
public class TraceSpanDto
{
    public string Service { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public double Start { get; set; }
    public double Duration { get; set; }
}

/// <summary>
/// Kubernetes cluster information.
/// </summary>
public class ClusterInfoDto
{
    public string ClusterName { get; set; } = "ez-platform";
    public string Namespace { get; set; } = "ez-platform";
    public string Version { get; set; } = "unknown";
    public int NodeCount { get; set; }
    public int TotalPods { get; set; }
    public int HealthyPods { get; set; }
}

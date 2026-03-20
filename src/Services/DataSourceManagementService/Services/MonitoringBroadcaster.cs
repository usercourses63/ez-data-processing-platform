using Microsoft.AspNetCore.SignalR;
using DataProcessing.DataSourceManagement.Hubs;
using DataProcessing.DataSourceManagement.Models;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// BackgroundService that periodically collects monitoring data from K8s, Prometheus, Kafka,
/// and device health services, then broadcasts updates to all connected SignalR clients.
/// Dual-speed broadcast: 5s for device health, 30s for infrastructure metrics.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public class MonitoringBroadcaster : BackgroundService
{
    private readonly IHubContext<MonitoringHub> _hubContext;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MonitoringBroadcaster> _logger;
    private readonly IConfiguration _configuration;

    private readonly TimeSpan _healthInterval = TimeSpan.FromSeconds(5);
    private readonly TimeSpan _infraInterval = TimeSpan.FromSeconds(30);

    private MonitoringInitialState? _latestState;
    private readonly object _stateLock = new();

    private readonly List<PipelineEventDto> _recentPipelineEvents = new();
    private readonly object _eventsLock = new();
    private const int MaxPipelineEvents = 50;

    public MonitoringBroadcaster(
        IHubContext<MonitoringHub> hubContext,
        IServiceProvider serviceProvider,
        ILogger<MonitoringBroadcaster> logger,
        IConfiguration configuration)
    {
        _hubContext = hubContext;
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Get the latest cached state for initial client snapshots.
    /// </summary>
    public MonitoringInitialState? GetLatestState()
    {
        lock (_stateLock)
        {
            return _latestState;
        }
    }

    /// <summary>
    /// Add a pipeline event from MassTransit consumer and broadcast immediately.
    /// Maintains a rolling buffer of the most recent 50 events.
    /// </summary>
    public async void AddPipelineEvent(PipelineEventDto evt)
    {
        lock (_eventsLock)
        {
            _recentPipelineEvents.Insert(0, evt);
            if (_recentPipelineEvents.Count > MaxPipelineEvents)
                _recentPipelineEvents.RemoveRange(MaxPipelineEvents, _recentPipelineEvents.Count - MaxPipelineEvents);
        }

        try
        {
            await _hubContext.Clients.All.SendAsync("PipelineEventUpdate", evt);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast pipeline event");
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "MonitoringBroadcaster started (health: {Health}s, infra: {Infra}s)",
            _healthInterval.TotalSeconds, _infraInterval.TotalSeconds);

        await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken); // let services initialize

        var healthTask = RunHealthBroadcastLoop(stoppingToken);
        var infraTask = RunInfrastructureBroadcastLoop(stoppingToken);
        await Task.WhenAll(healthTask, infraTask);
    }

    private async Task RunHealthBroadcastLoop(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var healthService = scope.ServiceProvider.GetRequiredService<IDeviceHealthService>();
                var healthData = await healthService.GetHealthStatusAsync(stoppingToken);

                await _hubContext.Clients.All.SendAsync("DeviceHealthUpdate", healthData, stoppingToken);

                lock (_stateLock)
                {
                    _latestState ??= new MonitoringInitialState();
                    _latestState.DeviceHealth = healthData;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error during health broadcast");
            }

            await Task.Delay(_healthInterval, stoppingToken);
        }
    }

    /// <summary>
    /// Fetch data from a monitoring service with isolated error handling.
    /// Returns fallback value on failure so other broadcasts continue.
    /// </summary>
    private async Task<T> SafeFetchAsync<T>(string name, Func<Task<T>> fetch, T fallback)
    {
        try
        {
            return await fetch();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to fetch {Source} — using empty fallback", name);
            return fallback;
        }
    }

    private async Task RunInfrastructureBroadcastLoop(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var k8sService = scope.ServiceProvider.GetRequiredService<IKubernetesMonitoringService>();
                var promService = scope.ServiceProvider.GetRequiredService<IPrometheusQueryService>();
                var kafkaService = scope.ServiceProvider.GetRequiredService<IKafkaMonitoringService>();

                // Fetch all data independently — each service failure is isolated
                // so e.g. Kafka DNS failure doesn't block K8s/Prometheus broadcasts
                var services = await SafeFetchAsync("K8s services", () => k8sService.GetServiceStatusesAsync(stoppingToken), new List<ServiceStatusDto>());
                var pods = await SafeFetchAsync("K8s pods", () => k8sService.GetPodStatusesAsync(stoppingToken), new List<PodStatusDto>());
                var clusterInfo = await SafeFetchAsync<ClusterInfoDto?>("cluster info", async () => await k8sService.GetClusterInfoAsync(stoppingToken), null);
                var metrics = await SafeFetchAsync<DashboardMetricsDto?>("Prometheus metrics", async () => await promService.GetDashboardMetricsAsync(stoppingToken), null);
                var alerts = await SafeFetchAsync("Prometheus alerts", () => promService.GetActiveAlertsAsync(stoppingToken), new List<AlertDto>());
                var traces = await SafeFetchAsync("Jaeger traces", () => promService.GetRecentTracesAsync(stoppingToken), new List<TraceDto>());
                var queues = await SafeFetchAsync("Kafka queues", () => kafkaService.GetQueueStatusesAsync(stoppingToken), new List<QueueStatusDto>());

                // Broadcast 6 event types
                await _hubContext.Clients.All.SendAsync("ServiceStatusUpdate", services, stoppingToken);
                await _hubContext.Clients.All.SendAsync("PodStatusUpdate", pods, stoppingToken);
                await _hubContext.Clients.All.SendAsync("QueueStatusUpdate", queues, stoppingToken);
                await _hubContext.Clients.All.SendAsync("MetricsUpdate", metrics, stoppingToken);
                await _hubContext.Clients.All.SendAsync("AlertUpdate", alerts, stoppingToken);
                await _hubContext.Clients.All.SendAsync("TraceUpdate", traces, stoppingToken);

                // Update cached state
                List<PipelineEventDto> eventsCopy;
                lock (_eventsLock)
                {
                    eventsCopy = new List<PipelineEventDto>(_recentPipelineEvents);
                }

                lock (_stateLock)
                {
                    _latestState ??= new MonitoringInitialState();
                    _latestState.Services = services;
                    _latestState.Pods = pods;
                    if (clusterInfo != null) _latestState.ClusterInfo = clusterInfo;
                    if (metrics != null) _latestState.Metrics = metrics;
                    _latestState.Alerts = alerts;
                    _latestState.Traces = traces;
                    _latestState.Queues = queues;
                    _latestState.PipelineEvents = eventsCopy;
                }

                _logger.LogDebug(
                    "Infrastructure broadcast: {Services} services, {Pods} pods, {Queues} queues",
                    services.Count, pods.Count, queues.Count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error during infrastructure broadcast");
            }

            await Task.Delay(_infraInterval, stoppingToken);
        }
    }
}

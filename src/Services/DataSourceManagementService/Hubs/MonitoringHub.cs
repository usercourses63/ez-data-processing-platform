using Microsoft.AspNetCore.SignalR;

namespace DataProcessing.DataSourceManagement.Hubs;

/// <summary>
/// SignalR hub for real-time monitoring updates.
/// Clients connect to receive periodic status broadcasts for services, pods, metrics, etc.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public class MonitoringHub : Hub
{
    private readonly ILogger<MonitoringHub> _logger;

    public MonitoringHub(ILogger<MonitoringHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Monitoring client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
            _logger.LogWarning(exception, "Monitoring client disconnected with error: {ConnectionId}", Context.ConnectionId);
        else
            _logger.LogInformation("Monitoring client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}

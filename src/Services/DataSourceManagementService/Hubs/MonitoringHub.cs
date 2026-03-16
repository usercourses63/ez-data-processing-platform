using Microsoft.AspNetCore.SignalR;
using DataProcessing.DataSourceManagement.Services;

namespace DataProcessing.DataSourceManagement.Hubs;

/// <summary>
/// SignalR hub for real-time monitoring updates.
/// Clients connect to receive periodic status broadcasts for services, pods, metrics, etc.
/// Sends initial state snapshot to newly connected clients.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public class MonitoringHub : Hub
{
    private readonly ILogger<MonitoringHub> _logger;
    private readonly MonitoringBroadcaster _broadcaster;

    public MonitoringHub(ILogger<MonitoringHub> logger, MonitoringBroadcaster broadcaster)
    {
        _logger = logger;
        _broadcaster = broadcaster;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Monitoring client connected: {ConnectionId}", Context.ConnectionId);

        // Send initial state snapshot to the newly connected client
        var state = _broadcaster.GetLatestState();
        if (state != null)
            await Clients.Caller.SendAsync("InitialState", state);

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

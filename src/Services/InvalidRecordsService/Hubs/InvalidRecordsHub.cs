using Microsoft.AspNetCore.SignalR;

namespace InvalidRecordsService.Hubs;

/// <summary>
/// SignalR hub for real-time invalid records notifications.
/// Broadcasts revalidation progress and completion events (per D-05, D-06).
/// </summary>
public class InvalidRecordsHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }
}

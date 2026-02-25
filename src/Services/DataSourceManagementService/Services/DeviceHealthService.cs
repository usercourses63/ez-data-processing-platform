using System.Collections.Concurrent;
using System.Diagnostics;
using DataProcessing.DataSourceManagement.Models.Responses;
using DataProcessing.Shared.Entities;
using MongoDB.Entities;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Orchestrates health checks for NAS devices and AdminServers.
/// Tracks consecutive failures for status transitions (Healthy -> Degraded -> Down).
/// Also implements IHostedService for an initial health check on startup.
/// v0.2.0: Device Health Monitoring (MON-05, MON-06)
/// </summary>
public class DeviceHealthService : IDeviceHealthService, IHostedService
{
    private readonly INasDeviceService _nasDeviceService;
    private readonly IServerService _serverService;
    private readonly ILogger<DeviceHealthService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private static readonly ActivitySource ActivitySource = new("DataProcessing.DataSourceManagement");

    /// <summary>
    /// Tracks consecutive failures per device ID.
    /// 0 failures = Healthy, 1-2 = Degraded, 3+ = Down.
    /// On success, device is removed (auto-recover to Healthy).
    /// </summary>
    private static readonly ConcurrentDictionary<string, int> _consecutiveFailures = new();

    public DeviceHealthService(
        INasDeviceService nasDeviceService,
        IServerService serverService,
        ILogger<DeviceHealthService> logger,
        IServiceProvider serviceProvider)
    {
        _nasDeviceService = nasDeviceService;
        _serverService = serverService;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    /// <summary>
    /// IHostedService: Run an initial health check round 5 seconds after startup
    /// </summary>
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("DeviceHealthService starting - scheduling initial health check in 5 seconds");

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);

                // Create a scope for the initial check since this is a singleton hosted service
                using var scope = _serviceProvider.CreateScope();
                var nasService = scope.ServiceProvider.GetRequiredService<INasDeviceService>();
                var serverService = scope.ServiceProvider.GetRequiredService<IServerService>();

                // Run initial health checks using scoped services
                await RunHealthChecksInternalAsync(nasService, serverService, cancellationToken);

                _logger.LogInformation("Initial health check round completed");
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Initial health check cancelled during shutdown");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during initial health check round");
            }
        }, cancellationToken);
    }

    /// <summary>
    /// IHostedService: No-op for shutdown
    /// </summary>
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <inheritdoc />
    public async Task RunHealthChecksAsync(CancellationToken ct = default)
    {
        await RunHealthChecksInternalAsync(_nasDeviceService, _serverService, ct);
    }

    private async Task RunHealthChecksInternalAsync(
        INasDeviceService nasService,
        IServerService serverService,
        CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("RunHealthChecks");
        var sw = Stopwatch.StartNew();

        try
        {
            // Fetch all devices (include inactive to mark them correctly)
            var nasDevices = await nasService.GetAllNasDevicesAsync(includeDeleted: false, ct: ct);
            var adminServers = await serverService.GetAllServersAsync(includeInactive: true, cancellationToken: ct);

            var tasks = new List<Task>();

            // Schedule NAS device checks
            foreach (var device in nasDevices)
            {
                // Skip inactive, deleted, or unprovisioned NAS devices
                if (!device.IsActive || device.IsDeleted || !device.IsProvisioned)
                    continue;

                tasks.Add(CheckNasDeviceAsync(nasService, device, ct));
            }

            // Schedule AdminServer checks
            foreach (var server in adminServers)
            {
                // Skip inactive or deleted AdminServers
                if (!server.IsActive || server.IsDeleted)
                    continue;

                tasks.Add(CheckAdminServerAsync(serverService, server, ct));
            }

            await Task.WhenAll(tasks);

            sw.Stop();
            _logger.LogInformation(
                "Health check round completed: {CheckCount} devices checked in {DurationMs}ms",
                tasks.Count, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during health check round");
            throw;
        }
    }

    private async Task CheckNasDeviceAsync(INasDeviceService nasService, NasDevice device, CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("CheckNasDevice");
        activity?.SetTag("device-id", device.ID);
        activity?.SetTag("device-name", device.Name);

        var stopwatch = Stopwatch.StartNew();
        bool isSuccess = false;
        string? errorMessage = null;

        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

            var result = await nasService.TestConnectionAsync(device.ID, timeoutCts.Token);
            stopwatch.Stop();

            isSuccess = result.Success;
            errorMessage = result.ErrorMessage;
        }
        catch (OperationCanceledException)
        {
            stopwatch.Stop();
            errorMessage = "Health check timed out (5s)";
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            errorMessage = ex.Message;
        }

        var latencyMs = stopwatch.ElapsedMilliseconds;
        var status = DetermineStatus(device.ID, isSuccess, latencyMs, 2000);

        var checkResult = new DeviceHealthCheckResult
        {
            DeviceId = device.ID,
            DeviceName = device.Name,
            DeviceType = "NasDevice",
            Status = status,
            LatencyMs = latencyMs,
            IsSuccess = isSuccess,
            ErrorMessage = errorMessage,
            CheckedAt = DateTime.UtcNow,
            CorrelationId = Guid.NewGuid().ToString()
        };

        await DB.SaveAsync(checkResult);

        _logger.LogInformation(
            "Health check for {DeviceName}: {Status} ({LatencyMs}ms)",
            device.Name, status, latencyMs);
    }

    private async Task CheckAdminServerAsync(IServerService serverService, AdminServer server, CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("CheckAdminServer");
        activity?.SetTag("device-id", server.ID);
        activity?.SetTag("device-name", server.Name);
        activity?.SetTag("server-type", server.ServerType);

        var stopwatch = Stopwatch.StartNew();
        bool isSuccess = false;
        string? errorMessage = null;

        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

            var result = await serverService.TestConnectionAsync(server.ID, timeoutCts.Token);
            stopwatch.Stop();

            isSuccess = result.Success;
            errorMessage = result.ErrorMessage;
        }
        catch (OperationCanceledException)
        {
            stopwatch.Stop();
            errorMessage = "Health check timed out (5s)";
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            errorMessage = ex.Message;
        }

        var latencyMs = stopwatch.ElapsedMilliseconds;
        var status = DetermineStatus(server.ID, isSuccess, latencyMs, 5000);

        var checkResult = new DeviceHealthCheckResult
        {
            DeviceId = server.ID,
            DeviceName = server.Name,
            DeviceType = "AdminServer",
            Status = status,
            LatencyMs = latencyMs,
            IsSuccess = isSuccess,
            ErrorMessage = errorMessage,
            CheckedAt = DateTime.UtcNow,
            CorrelationId = Guid.NewGuid().ToString()
        };

        await DB.SaveAsync(checkResult);

        _logger.LogInformation(
            "Health check for {DeviceName}: {Status} ({LatencyMs}ms)",
            server.Name, status, latencyMs);
    }

    /// <summary>
    /// Determine device status based on consecutive failures and latency.
    /// Returns the worse of failure-based and latency-based statuses.
    /// </summary>
    private string DetermineStatus(string deviceId, bool isSuccess, long latencyMs, long degradedThresholdMs)
    {
        // Update consecutive failure counter
        if (isSuccess)
        {
            _consecutiveFailures.TryRemove(deviceId, out _);
        }
        else
        {
            _consecutiveFailures.AddOrUpdate(deviceId, 1, (_, count) => count + 1);
        }

        // Failure-based status
        var failureCount = _consecutiveFailures.GetValueOrDefault(deviceId, 0);
        string failureStatus = failureCount switch
        {
            0 => "Healthy",
            1 or 2 => "Degraded",
            _ => "Down"
        };

        // Latency-based status (only if check succeeded)
        string latencyStatus = "Healthy";
        if (isSuccess && latencyMs > degradedThresholdMs)
        {
            latencyStatus = "Degraded";
        }

        // Return the worse status
        return GetWorseStatus(failureStatus, latencyStatus);
    }

    private static string GetWorseStatus(string a, string b)
    {
        int Rank(string s) => s switch
        {
            "Down" => 2,
            "Degraded" => 1,
            _ => 0
        };
        return Rank(a) >= Rank(b) ? a : b;
    }

    /// <inheritdoc />
    public async Task<DeviceHealthStatusResponse> GetHealthStatusAsync(CancellationToken ct = default)
    {
        using var activity = ActivitySource.StartActivity("GetHealthStatus");

        // Fetch all devices for metadata
        var nasDevices = await _nasDeviceService.GetAllNasDevicesAsync(includeDeleted: false, ct: ct);
        var adminServers = await _serverService.GetAllServersAsync(includeInactive: true, cancellationToken: ct);

        // Get latest check result per device
        var allResults = await DB.Find<DeviceHealthCheckResult>()
            .Sort(r => r.CheckedAt, MongoDB.Entities.Order.Descending)
            .ExecuteAsync(ct);

        // Group by DeviceId, take latest per device
        var latestByDevice = allResults
            .GroupBy(r => r.DeviceId)
            .ToDictionary(g => g.Key, g => g.First());

        var response = new DeviceHealthStatusResponse();
        var nasInfos = new List<DeviceHealthInfo>();
        var serverInfos = new List<DeviceHealthInfo>();

        // Build NAS device health info
        foreach (var device in nasDevices)
        {
            var isActive = device.IsActive && !device.IsDeleted && device.IsProvisioned;
            var info = new DeviceHealthInfo
            {
                DeviceId = device.ID,
                DeviceName = device.Name,
                DeviceType = "NasDevice",
                DeviceSubType = null,
                Role = device.Role.ToString(),
                IsActive = isActive
            };

            if (!isActive)
            {
                info.Status = "Disabled";
            }
            else if (latestByDevice.TryGetValue(device.ID, out var latest))
            {
                info.Status = latest.Status;
                info.LatencyMs = latest.LatencyMs;
                info.LastCheckTime = latest.CheckedAt;
                info.ErrorMessage = latest.ErrorMessage;
            }
            else
            {
                info.Status = "Healthy"; // No check yet, assume healthy
            }

            info.UptimePercentage24h = await CalculateUptimePercentageAsync(device.ID, TimeSpan.FromHours(24), ct);
            nasInfos.Add(info);
        }

        // Build AdminServer health info
        foreach (var server in adminServers)
        {
            if (server.IsDeleted) continue;

            var isActive = server.IsActive;
            var info = new DeviceHealthInfo
            {
                DeviceId = server.ID,
                DeviceName = server.Name,
                DeviceType = "AdminServer",
                DeviceSubType = server.ServerType,
                Role = server.Direction.ToString(),
                IsActive = isActive
            };

            if (!isActive)
            {
                info.Status = "Disabled";
            }
            else if (latestByDevice.TryGetValue(server.ID, out var latest))
            {
                info.Status = latest.Status;
                info.LatencyMs = latest.LatencyMs;
                info.LastCheckTime = latest.CheckedAt;
                info.ErrorMessage = latest.ErrorMessage;
            }
            else
            {
                info.Status = "Healthy"; // No check yet, assume healthy
            }

            info.UptimePercentage24h = await CalculateUptimePercentageAsync(server.ID, TimeSpan.FromHours(24), ct);
            serverInfos.Add(info);
        }

        // Compute summary counts from all devices
        var allDevices = nasInfos.Concat(serverInfos).ToList();
        response.TotalDevices = allDevices.Count;
        response.HealthyCount = allDevices.Count(d => d.Status == "Healthy");
        response.DegradedCount = allDevices.Count(d => d.Status == "Degraded");
        response.DownCount = allDevices.Count(d => d.Status == "Down");
        response.DisabledCount = allDevices.Count(d => d.Status == "Disabled");
        response.NasDevices = nasInfos;
        response.AdminServers = serverInfos;

        return response;
    }

    /// <summary>
    /// Calculate uptime percentage for a device over the specified time window.
    /// Returns successCount / totalCount * 100, rounded to 1 decimal place.
    /// Returns 0 if no checks exist in the window.
    /// </summary>
    private async Task<double> CalculateUptimePercentageAsync(string deviceId, TimeSpan window, CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - window;

        var checks = await DB.Find<DeviceHealthCheckResult>()
            .Match(r => r.DeviceId == deviceId && r.CheckedAt >= cutoff)
            .ExecuteAsync(ct);

        if (checks.Count == 0)
            return 0;

        var successCount = checks.Count(c => c.IsSuccess);
        return Math.Round((double)successCount / checks.Count * 100, 1);
    }
}

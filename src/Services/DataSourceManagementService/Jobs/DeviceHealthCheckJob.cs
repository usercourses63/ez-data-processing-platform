using System.Diagnostics;
using Quartz;
using DataProcessing.DataSourceManagement.Services;

namespace DataProcessing.DataSourceManagement.Jobs;

/// <summary>
/// Quartz.NET scheduled job that runs device health checks every 30 seconds.
/// Delegates to IDeviceHealthService for the actual check logic.
/// v0.2.0: Device Health Monitoring (MON-05, MON-06)
/// </summary>
[DisallowConcurrentExecution]
public class DeviceHealthCheckJob : IJob
{
    private readonly IDeviceHealthService _healthService;
    private readonly ILogger<DeviceHealthCheckJob> _logger;
    private static readonly ActivitySource ActivitySource = new("DataProcessing.DataSourceManagement");

    public DeviceHealthCheckJob(
        IDeviceHealthService healthService,
        ILogger<DeviceHealthCheckJob> logger)
    {
        _healthService = healthService;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        using var activity = ActivitySource.StartActivity("DeviceHealthCheck");
        activity?.SetTag("job-key", context.JobDetail.Key.ToString());

        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogInformation("Starting device health check job");

            await _healthService.RunHealthChecksAsync(context.CancellationToken);

            stopwatch.Stop();
            _logger.LogInformation(
                "Device health check job completed in {DurationMs}ms",
                stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Error during device health check job after {DurationMs}ms",
                stopwatch.ElapsedMilliseconds);
            throw;
        }
    }
}

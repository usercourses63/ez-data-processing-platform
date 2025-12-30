using System.Diagnostics;
using MongoDB.Entities;
using Quartz;
using Quartz.Impl.Matchers;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Utilities;
using DataProcessing.Scheduling.Jobs;

namespace DataProcessing.Scheduling.Services;

/// <summary>
/// Service for managing Quartz.NET scheduling operations for data source polling
/// </summary>
public class SchedulingManager : ISchedulingManager
{
    private readonly IScheduler _scheduler;
    private readonly ILogger<SchedulingManager> _logger;
    private readonly BusinessMetrics _metrics;
    private static readonly ActivitySource ActivitySource = new("DataProcessing.Scheduling");

    // Constants for job and trigger naming
    private const string JobGroupName = "DataSourcePolling";
    private const string TriggerGroupName = "DataSourcePollingTriggers";
    private const string GlobalPollingJobName = "GlobalDataSourcePolling";

    public SchedulingManager(
        IScheduler scheduler,
        ILogger<SchedulingManager> logger,
        BusinessMetrics metrics)
    {
        _scheduler = scheduler;
        _logger = logger;
        _metrics = metrics;
    }

    public async Task<bool> ScheduleDataSourcePollingAsync(DataProcessingDataSource dataSource, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("ScheduleDataSourcePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSource.ID);
        activity?.SetTag("data-source-name", dataSource.Name);

        try
        {
            _logger.LogInformation("Scheduling polling for data source {DataSourceName} with interval {PollingInterval}. CorrelationId: {CorrelationId}",
                dataSource.Name, dataSource.PollingRate, correlationId);

            // Validate polling interval
            if (!await ValidateScheduleConfigurationAsync(dataSource.PollingRate))
            {
                _logger.LogWarning("Invalid polling interval {PollingInterval} for data source {DataSourceName}. CorrelationId: {CorrelationId}",
                    dataSource.PollingRate, dataSource.Name, correlationId);
                return false;
            }

            var jobKey = CreateJobKey(dataSource.ID);
            var triggerKey = CreateTriggerKey(dataSource.ID);

            // Remove existing job if present
            if (await _scheduler.CheckExists(jobKey))
            {
                _logger.LogDebug("Removing existing schedule for data source {DataSourceName}. CorrelationId: {CorrelationId}",
                    dataSource.Name, correlationId);
                await _scheduler.DeleteJob(jobKey);
            }

            // Create new job with data source-specific configuration
            var job = JobBuilder.Create<DataSourcePollingJob>()
                .WithIdentity(jobKey)
                .WithDescription($"Polling job for data source: {dataSource.Name}")
                .UsingJobData("dataSourceId", dataSource.ID)
                .UsingJobData("dataSourceName", dataSource.Name)
                .UsingJobData("supplierName", dataSource.SupplierName)
                .UsingJobData("createdAt", DateTime.UtcNow.ToString("O"))
                .Build();

            // Create trigger with cron expression (supports seconds resolution)
            // Get Unix cron from datasource and convert to Quartz.NET format
            var unixCron = dataSource.GetEffectiveCronExpression();
            var quartzCron = CronExpressionConverter.ConvertUnixToQuartz(unixCron);

            _logger.LogDebug("Converted cron expression: {UnixCron} → {QuartzCron}. CorrelationId: {CorrelationId}",
                unixCron, quartzCron, correlationId);

            // Validate Quartz.NET cron
            if (!ValidateCronExpression(quartzCron))
            {
                _logger.LogError("Invalid Quartz cron expression after conversion: {QuartzCron}. CorrelationId: {CorrelationId}",
                    quartzCron, correlationId);
                return false;
            }

            var trigger = TriggerBuilder.Create()
                .WithIdentity(triggerKey)
                .WithDescription($"Trigger for data source: {dataSource.Name} - Cron: {quartzCron}")
                .StartNow()
                .WithCronSchedule(quartzCron)
                .Build();

            // Schedule the job
            await _scheduler.ScheduleJob(job, trigger);

            // Persist schedule to MongoDB (store Quartz.NET format)
            var scheduledDataSource = new DataProcessing.Shared.Entities.ScheduledDataSource
            {
                DataSourceId = dataSource.ID,
                DataSourceName = dataSource.Name,
                SupplierName = dataSource.SupplierName,
                PollingInterval = dataSource.PollingRate,
                CronExpression = quartzCron,  // Store Quartz.NET format (scheduler-specific)
                IsActive = true,
                IsPaused = false,
                QuartzJobKey = jobKey.ToString(),
                QuartzTriggerKey = triggerKey.ToString(),
                NextExecutionTime = trigger.GetNextFireTimeUtc()?.UtcDateTime,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CorrelationId = correlationId
            };

            await scheduledDataSource.SaveAsync();

            // Update metrics
            _metrics.RecordMessageSent("schedule_created", "scheduling", "success");

            _logger.LogInformation("Successfully scheduled polling for data source {DataSourceName}. Next execution: {NextExecution}. CorrelationId: {CorrelationId}",
                dataSource.Name, trigger.GetNextFireTimeUtc(), correlationId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to schedule polling for data source {DataSourceName}. CorrelationId: {CorrelationId}",
                dataSource.Name, correlationId);

            _metrics.RecordMessageSent("schedule_created", "scheduling", "failed");
            return false;
        }
    }

    public async Task<bool> UnscheduleDataSourcePollingAsync(string dataSourceId, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("UnscheduleDataSourcePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            _logger.LogInformation("Unscheduling polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            var jobKey = CreateJobKey(dataSourceId);
            var result = await _scheduler.DeleteJob(jobKey);

            // Delete persisted schedule from MongoDB
            var deleteResult = await DB.DeleteAsync<DataProcessing.Shared.Entities.ScheduledDataSource>(
                s => s.DataSourceId == dataSourceId);
            var deleteCount = deleteResult.DeletedCount;

            if (result)
            {
                _metrics.RecordMessageSent("schedule_deleted", "scheduling", "success");
                _logger.LogInformation("Successfully unscheduled polling for data source {DataSourceId}. Deleted {Count} persisted schedule(s). CorrelationId: {CorrelationId}",
                    dataSourceId, deleteCount, correlationId);
            }
            else
            {
                _logger.LogWarning("No Quartz schedule found to unschedule for data source {DataSourceId}, but deleted {Count} persisted schedule(s). CorrelationId: {CorrelationId}",
                    dataSourceId, deleteCount, correlationId);
            }

            return result || deleteCount > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to unschedule polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            _metrics.RecordMessageSent("schedule_deleted", "scheduling", "failed");
            return false;
        }
    }

    public async Task<bool> UpdatePollingIntervalAsync(string dataSourceId, TimeSpan newInterval, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("UpdatePollingInterval");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);
        activity?.SetTag("new-interval", newInterval.ToString());

        try
        {
            _logger.LogInformation("Updating polling interval for data source {DataSourceId} to {NewInterval}. CorrelationId: {CorrelationId}",
                dataSourceId, newInterval, correlationId);

            // Validate new interval
            if (!await ValidateScheduleConfigurationAsync(newInterval))
            {
                _logger.LogWarning("Invalid polling interval {NewInterval} for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                    newInterval, dataSourceId, correlationId);
                return false;
            }

            var triggerKey = CreateTriggerKey(dataSourceId);

            // Get existing trigger
            var existingTrigger = await _scheduler.GetTrigger(triggerKey);
            if (existingTrigger == null)
            {
                _logger.LogWarning("No existing trigger found for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                    dataSourceId, correlationId);
                return false;
            }

            // Create new trigger with updated interval
            var newTrigger = existingTrigger.GetTriggerBuilder()
                .WithSimpleSchedule(x => x
                    .WithInterval(newInterval)
                    .RepeatForever())
                .Build();

            // Reschedule with new trigger
            await _scheduler.RescheduleJob(triggerKey, newTrigger);

            _metrics.RecordMessageSent("schedule_updated", "scheduling", "success");

            _logger.LogInformation("Successfully updated polling interval for data source {DataSourceId}. Next execution: {NextExecution}. CorrelationId: {CorrelationId}",
                dataSourceId, newTrigger.GetNextFireTimeUtc(), correlationId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update polling interval for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            _metrics.RecordMessageSent("schedule_updated", "scheduling", "failed");
            return false;
        }
    }

    public async Task<bool> PauseDataSourcePollingAsync(string dataSourceId, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("PauseDataSourcePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            _logger.LogInformation("Pausing polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            var jobKey = CreateJobKey(dataSourceId);
            await _scheduler.PauseJob(jobKey);

            _metrics.RecordMessageSent("schedule_paused", "scheduling", "success");

            _logger.LogInformation("Successfully paused polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to pause polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            _metrics.RecordMessageSent("schedule_paused", "scheduling", "failed");
            return false;
        }
    }

    public async Task<bool> ResumeDataSourcePollingAsync(string dataSourceId, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("ResumeDataSourcePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            _logger.LogInformation("Resuming polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            var jobKey = CreateJobKey(dataSourceId);
            await _scheduler.ResumeJob(jobKey);

            _metrics.RecordMessageSent("schedule_resumed", "scheduling", "success");

            _logger.LogInformation("Successfully resumed polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resume polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            _metrics.RecordMessageSent("schedule_resumed", "scheduling", "failed");
            return false;
        }
    }

    public async Task<ScheduleStatus?> GetScheduleStatusAsync(string dataSourceId)
    {
        using var activity = ActivitySource.StartActivity("GetScheduleStatus");
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            var jobKey = CreateJobKey(dataSourceId);
            var triggerKey = CreateTriggerKey(dataSourceId);

            var jobDetail = await _scheduler.GetJobDetail(jobKey);
            var trigger = await _scheduler.GetTrigger(triggerKey);

            if (jobDetail == null || trigger == null)
            {
                return null;
            }

            var triggerState = await _scheduler.GetTriggerState(triggerKey);
            var dataSource = await GetDataSourceAsync(dataSourceId);

            return new ScheduleStatus
            {
                DataSourceId = dataSourceId,
                DataSourceName = dataSource?.Name ?? "Unknown",
                PollingInterval = trigger is ISimpleTrigger simpleTrigger 
                    ? simpleTrigger.RepeatInterval 
                    : TimeSpan.Zero,
                LastExecution = trigger.GetPreviousFireTimeUtc()?.DateTime,
                NextExecution = trigger.GetNextFireTimeUtc()?.DateTime,
                IsActive = triggerState == TriggerState.Normal,
                IsPaused = triggerState == TriggerState.Paused,
                ExecutionCount = trigger.GetPreviousFireTimeUtc() != null ? 1 : 0 // Simplified
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get schedule status for data source {DataSourceId}", dataSourceId);
            return null;
        }
    }

    public async Task<List<ScheduleInfo>> GetAllSchedulesAsync()
    {
        using var activity = ActivitySource.StartActivity("GetAllSchedules");

        try
        {
            var schedules = new List<ScheduleInfo>();
            var jobKeys = await _scheduler.GetJobKeys(GroupMatcher<JobKey>.GroupEquals(JobGroupName));

            foreach (var jobKey in jobKeys)
            {
                try
                {
                    var jobDetail = await _scheduler.GetJobDetail(jobKey);
                    var triggers = await _scheduler.GetTriggersOfJob(jobKey);
                    var trigger = triggers.FirstOrDefault();

                    if (jobDetail == null || trigger == null) continue;

                    var triggerState = await _scheduler.GetTriggerState(trigger.Key);
                    var dataSourceId = jobDetail.JobDataMap.GetString("dataSourceId") ?? "";
                    var dataSource = await GetDataSourceAsync(dataSourceId);

                    schedules.Add(new ScheduleInfo
                    {
                        DataSourceId = dataSourceId,
                        DataSourceName = jobDetail.JobDataMap.GetString("dataSourceName") ?? "Unknown",
                        SupplierName = jobDetail.JobDataMap.GetString("supplierName") ?? "Unknown",
                        PollingInterval = trigger is ISimpleTrigger simpleTrigger 
                            ? simpleTrigger.RepeatInterval 
                            : TimeSpan.Zero,
                        LastExecution = trigger.GetPreviousFireTimeUtc()?.DateTime,
                        NextExecution = trigger.GetNextFireTimeUtc()?.DateTime,
                        IsActive = triggerState == TriggerState.Normal,
                        IsPaused = triggerState == TriggerState.Paused,
                        JobKey = jobKey.ToString(),
                        TriggerKey = trigger.Key.ToString(),
                        CreatedAt = DateTime.TryParse(jobDetail.JobDataMap.GetString("createdAt"), out var createdAt) 
                            ? createdAt : DateTime.MinValue,
                        UpdatedAt = dataSource?.UpdatedAt ?? DateTime.MinValue
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get schedule info for job {JobKey}", jobKey);
                }
            }

            return schedules;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get all schedules");
            return new List<ScheduleInfo>();
        }
    }

    public async Task<bool> TriggerImmediatePollingAsync(string dataSourceId, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("TriggerImmediatePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            _logger.LogInformation("Triggering immediate polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            var jobKey = CreateJobKey(dataSourceId);
            
            // Check if job exists
            if (!await _scheduler.CheckExists(jobKey))
            {
                _logger.LogWarning("No scheduled job found for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                    dataSourceId, correlationId);
                return false;
            }

            // Trigger job immediately
            var jobDataMap = new JobDataMap();
            jobDataMap.Put("manualTrigger", "success");
            jobDataMap.Put("correlationId", correlationId);
            
            await _scheduler.TriggerJob(jobKey, jobDataMap);

            _metrics.RecordMessageSent("manual_trigger", "scheduling", "success");

            _logger.LogInformation("Successfully triggered immediate polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to trigger immediate polling for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            _metrics.RecordMessageSent("manual_trigger", "scheduling", "failed");
            return false;
        }
    }

    public async Task<bool> ValidateScheduleConfigurationAsync(TimeSpan pollingInterval)
    {
        // Validate polling interval constraints
        var minInterval = TimeSpan.FromSeconds(1);  // Minimum 1 second (was 1 minute)
        var maxInterval = TimeSpan.FromDays(1);     // Maximum 1 day

        if (pollingInterval < minInterval)
        {
            _logger.LogWarning("Polling interval {PollingInterval} is less than minimum allowed {MinInterval}",
                pollingInterval, minInterval);
            return false;
        }

        if (pollingInterval > maxInterval)
        {
            _logger.LogWarning("Polling interval {PollingInterval} exceeds maximum allowed {MaxInterval}",
                pollingInterval, maxInterval);
            return false;
        }

        return await Task.FromResult(true);
    }

    /// <summary>
    /// Validates a cron expression (6-field Quartz format with seconds)
    /// </summary>
    public bool ValidateCronExpression(string cronExpression)
    {
        if (string.IsNullOrWhiteSpace(cronExpression))
            return false;

        try
        {
            // Try to create a cron trigger to validate the expression
            var trigger = TriggerBuilder.Create()
                .WithCronSchedule(cronExpression)
                .Build();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Invalid cron expression: {CronExpression}", cronExpression);
            return false;
        }
    }

    private static JobKey CreateJobKey(string dataSourceId)
    {
        return new JobKey($"polling-{dataSourceId}", JobGroupName);
    }

    private static TriggerKey CreateTriggerKey(string dataSourceId)
    {
        return new TriggerKey($"trigger-{dataSourceId}", TriggerGroupName);
    }

    private async Task<DataProcessingDataSource?> GetDataSourceAsync(string dataSourceId)
    {
        try
        {
            return await DB.Find<DataProcessingDataSource>()
                .Match(ds => ds.ID == dataSourceId)
                .ExecuteSingleAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get data source {DataSourceId} from database", dataSourceId);
            return null;
        }
    }
}

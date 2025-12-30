using System.Diagnostics;
using MassTransit;
using MongoDB.Entities;
using Quartz;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Messages;
using DataProcessing.Shared.Monitoring;

namespace DataProcessing.Scheduling.Jobs;

/// <summary>
/// Quartz.NET job that polls data sources and publishes file polling events
/// </summary>
[DisallowConcurrentExecution]
public class DataSourcePollingJob : IJob
{
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<DataSourcePollingJob> _logger;
    private readonly BusinessMetrics _metrics;
    private static readonly ActivitySource ActivitySource = new("DataProcessing.Scheduling");

    public DataSourcePollingJob(
        IPublishEndpoint publishEndpoint,
        ILogger<DataSourcePollingJob> logger,
        BusinessMetrics metrics)
    {
        _publishEndpoint = publishEndpoint;
        _logger = logger;
        _metrics = metrics;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var correlationId = Guid.NewGuid().ToString();
        using var activity = ActivitySource.StartActivity("DataSourcePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("job-key", context.JobDetail.Key.ToString());

        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogInformation("Starting scheduled data source polling execution. CorrelationId: {CorrelationId}, JobKey: {JobKey}",
                correlationId, context.JobDetail.Key);

            // Get specific data source ID if provided in job data
            var dataSourceId = context.JobDetail.JobDataMap.GetString("dataSourceId");
            
            var dataSources = string.IsNullOrEmpty(dataSourceId)
                ? await GetAllActiveDataSourcesAsync()
                : await GetSpecificDataSourceAsync(dataSourceId);

            if (!dataSources.Any())
            {
            _logger.LogInformation("No active data sources found for polling. CorrelationId: {CorrelationId}", correlationId);
                return;
            }

            _logger.LogInformation("Found {DataSourceCount} active data sources to poll. CorrelationId: {CorrelationId}",
                dataSources.Count, correlationId);

            var pollingTasks = dataSources.Select(dataSource => 
                PublishPollingEventAsync(dataSource, correlationId));

            await Task.WhenAll(pollingTasks);

            // Update success metrics
            foreach (var ds in dataSources)
            {
                _metrics.RecordFileProcessed(ds.Name, "Scheduling", "polling", true);
            }

            _logger.LogInformation("Successfully completed data source polling for {Count} sources in {Duration}ms. CorrelationId: {CorrelationId}",
                dataSources.Count, stopwatch.ElapsedMilliseconds, correlationId);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            _logger.LogError(ex, "Error during scheduled data source polling execution. CorrelationId: {CorrelationId}", correlationId);
            
            // Update error metrics (no specific datasource for global polling failure)
            _metrics.RecordFileProcessed("all", "Scheduling", "polling", false);

            // Re-throw to let Quartz handle retry logic
            throw;
        }
        finally
        {
            stopwatch.Stop();

            _metrics.RecordProcessingDuration(
                stopwatch.Elapsed.TotalSeconds,
                "all",
                "Scheduling",
                "polling");
        }
    }

    private async Task<List<DataProcessingDataSource>> GetAllActiveDataSourcesAsync()
    {
        using var activity = ActivitySource.StartActivity("GetAllActiveDataSources");
        
        return await DB.Find<DataProcessingDataSource>()
            .Match(ds => ds.IsActive && !ds.IsDeleted)
            .ExecuteAsync();
    }

    private async Task<List<DataProcessingDataSource>> GetSpecificDataSourceAsync(string dataSourceId)
    {
        using var activity = ActivitySource.StartActivity("GetSpecificDataSource");
        activity?.SetTag("data-source-id", dataSourceId);

        var dataSource = await DB.Find<DataProcessingDataSource>()
            .Match(ds => ds.ID == dataSourceId && ds.IsActive && !ds.IsDeleted)
            .ExecuteSingleAsync();

        return dataSource != null ? new List<DataProcessingDataSource> { dataSource } : new List<DataProcessingDataSource>();
    }

    private async Task PublishPollingEventAsync(DataProcessingDataSource dataSource, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("PublishPollingEvent");
        activity?.SetTag("data-source-id", dataSource.ID);
        activity?.SetTag("data-source-name", dataSource.Name);
        activity?.SetTag("correlation-id", correlationId);

        try
        {
            // Try to acquire processing lock (prevents reentrancy)
            if (!dataSource.TryAcquireProcessingLock(correlationId))
            {
                _logger.LogWarning(
                    "Skipping poll for {DataSourceName} - already processing (started: {StartTime}, correlationId: {ProcId})",
                    dataSource.Name, 
                    dataSource.ProcessingStartedAt, 
                    dataSource.ProcessingCorrelationId);
                
                activity?.SetTag("skipped", "true");
                activity?.SetTag("reason", "already_processing");
                return;
            }

            // Save lock to MongoDB
            await dataSource.SaveAsync();

            var pollingEvent = new FilePollingEvent
            {
                CorrelationId = correlationId,
                Timestamp = DateTime.UtcNow,
                DataSourceId = dataSource.ID,
                FilePath = dataSource.FilePath,
                DataSourceName = dataSource.Name,
                SupplierName = dataSource.SupplierName
            };

            await _publishEndpoint.Publish(pollingEvent);

            // Update data source last polling time
            await UpdateLastPollingTimeAsync(dataSource.ID);

            _logger.LogInformation(
                "Published file polling event for {DataSourceName}. Lock acquired. CorrelationId: {CorrelationId}",
                dataSource.Name, correlationId);
            
            activity?.SetTag("lock_acquired", "true");
        }
        catch (Exception ex)
        {
            // Release lock on failure
            try
            {
                dataSource.ReleaseProcessingLock("publish_failure");
                await dataSource.SaveAsync();
            }
            catch (Exception lockEx)
            {
                _logger.LogWarning(lockEx, "Failed to release lock after publish failure for {DataSourceName}", 
                    dataSource.Name);
            }

            _logger.LogError(ex, "Failed to publish polling event for data source {DataSourceName}. CorrelationId: {CorrelationId}",
                dataSource.Name, correlationId);
            
            _metrics.RecordFileProcessed(dataSource.Name, "Scheduling", "polling", false);
            
            throw;
        }
    }

    private async Task UpdateLastPollingTimeAsync(string dataSourceId)
    {
        try
        {
            await DB.Update<DataProcessingDataSource>()
                .Match(ds => ds.ID == dataSourceId)
                .Modify(ds => ds.LastProcessedAt, DateTime.UtcNow)
                .Modify(ds => ds.UpdatedAt, DateTime.UtcNow)
                .ExecuteAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to update last polling time for data source {DataSourceId}", dataSourceId);
        }
    }
}

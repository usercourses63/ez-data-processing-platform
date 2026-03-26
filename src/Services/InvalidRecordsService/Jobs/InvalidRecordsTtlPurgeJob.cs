using System.Diagnostics;
using MongoDB.Entities;
using Quartz;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;

namespace InvalidRecordsService.Jobs;

/// <summary>
/// Daily Quartz.NET job that purges expired invalid records based on TTL.
/// Uses per-datasource TTL if configured, otherwise falls back to global default.
/// Per D-16: Hard delete via background job running daily.
/// </summary>
[DisallowConcurrentExecution]
public class InvalidRecordsTtlPurgeJob : IJob
{
    private readonly ILogger<InvalidRecordsTtlPurgeJob> _logger;
    private readonly IConfiguration _configuration;
    private static readonly ActivitySource ActivitySource = new("DataProcessing.InvalidRecords");

    public InvalidRecordsTtlPurgeJob(
        ILogger<InvalidRecordsTtlPurgeJob> logger,
        IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var correlationId = Guid.NewGuid().ToString();
        using var activity = ActivitySource.StartActivity("InvalidRecordsTtlPurge");
        activity?.SetTag("correlation-id", correlationId);

        try
        {
            // Global default from ConfigMap (per D-14)
            var globalTtlDays = _configuration.GetValue<int>("InvalidRecords:TtlDays", 4);
            _logger.LogInformation(
                "Starting TTL purge job. Global TTL: {TtlDays} days. CorrelationId: {CorrelationId}",
                globalTtlDays, correlationId);

            // Get all datasources to check per-datasource overrides
            var dataSources = await DB.Find<DataProcessingDataSource>()
                .Match(ds => !ds.IsDeleted)
                .ExecuteAsync();

            var totalDeleted = 0L;

            foreach (var ds in dataSources)
            {
                var ttlDays = ds.InvalidRecordsTtlDays ?? globalTtlDays;
                var cutoffDate = DateTime.UtcNow.AddDays(-ttlDays);

                // Hard delete expired records for this datasource
                var deleteResult = await DB.DeleteAsync<DataProcessingInvalidRecord>(r =>
                    r.DataSourceId == ds.ID &&
                    r.CreatedAt < cutoffDate);

                if (deleteResult.DeletedCount > 0)
                {
                    totalDeleted += deleteResult.DeletedCount;
                    _logger.LogInformation(
                        "Purged {Count} expired invalid records for datasource {DataSourceId} (TTL: {TtlDays} days)",
                        deleteResult.DeletedCount, ds.ID, ttlDays);
                }
            }

            _logger.LogInformation(
                "TTL purge job completed. Total records purged: {TotalDeleted}. CorrelationId: {CorrelationId}",
                totalDeleted, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "TTL purge job failed. CorrelationId: {CorrelationId}", correlationId);
            throw; // Let Quartz handle retry
        }
    }
}

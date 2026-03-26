using DataProcessing.Shared.Messages;
using InvalidRecordsService.Hubs;
using InvalidRecordsService.Models.Responses;
using InvalidRecordsService.Repositories;
using MassTransit;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Bson;
using System.Text;

namespace InvalidRecordsService.Services;

/// <summary>
/// Handles bulk revalidation of invalid records when a datasource schema changes.
/// Publishes ValidationRequestEvents in batches with rate limiting for large datasets.
/// Broadcasts progress and completion events via SignalR (per D-05, D-06).
/// </summary>
public class RevalidationService : IRevalidationService
{
    private readonly IInvalidRecordRepository _repository;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IHubContext<InvalidRecordsHub> _hubContext;
    private readonly ILogger<RevalidationService> _logger;

    private const int batchSize = 100;
    private const int delayMs = 1000;

    public RevalidationService(
        IInvalidRecordRepository repository,
        IPublishEndpoint publishEndpoint,
        IHubContext<InvalidRecordsHub> hubContext,
        ILogger<RevalidationService> logger)
    {
        _repository = repository;
        _publishEndpoint = publishEndpoint;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<BulkRevalidationResult> BulkRevalidateByDataSourceAsync(string dataSourceId, string triggeredBy)
    {
        var result = new BulkRevalidationResult();

        _logger.LogInformation("Starting bulk revalidation for datasource {DataSourceId}, triggered by {TriggeredBy}",
            string.IsNullOrEmpty(dataSourceId) ? "ALL" : dataSourceId, triggeredBy);

        // Query records: if dataSourceId is empty/null, get ALL active records across all datasources
        var records = string.IsNullOrEmpty(dataSourceId)
            ? await _repository.GetAllActiveAsync()
            : await _repository.GetActiveByDataSourceAsync(dataSourceId);
        result.TotalRecords = records.Count;

        if (records.Count == 0)
        {
            _logger.LogInformation("No active invalid records found for datasource {DataSourceId}, skipping revalidation",
                string.IsNullOrEmpty(dataSourceId) ? "ALL" : dataSourceId);
            return result;
        }

        _logger.LogInformation("Found {Count} active invalid records for datasource {DataSourceId}, processing in batches of {BatchSize}",
            records.Count, string.IsNullOrEmpty(dataSourceId) ? "ALL" : dataSourceId, batchSize);

        // Broadcast revalidation started event via SignalR (per D-05)
        await _hubContext.Clients.All.SendAsync("RevalidationStarted", new
        {
            DataSourceId = dataSourceId,
            TotalRecords = records.Count,
            Timestamp = DateTime.UtcNow
        });

        // Process in batches of 100
        var batches = records.Chunk(batchSize);
        var batchIndex = 0;

        foreach (var batch in batches)
        {
            batchIndex++;
            _logger.LogInformation("Processing batch {BatchIndex} ({BatchCount} records) for datasource {DataSourceId}",
                batchIndex, batch.Length, string.IsNullOrEmpty(dataSourceId) ? "ALL" : dataSourceId);

            foreach (var record in batch)
            {
                try
                {
                    // Get original record data as JSON string
                    var json = record.OriginalRecord.ToString();
                    var fileContent = Encoding.UTF8.GetBytes(json);

                    var validationRequest = new ValidationRequestEvent
                    {
                        CorrelationId = Guid.NewGuid().ToString(),
                        Timestamp = DateTime.UtcNow,
                        PublishedBy = $"InvalidRecordsService-BulkRevalidation-{triggeredBy}",
                        DataSourceId = record.DataSourceId,
                        FileName = $"{record.FileName}_REVALIDATED_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString("N")[..8]}",
                        FileContent = fileContent,
                        FileContentType = "application/json",
                        FileSizeBytes = fileContent.Length,
                        HazelcastKey = string.Empty,
                        OriginalFormat = "JSON",
                        FormatMetadata = new Dictionary<string, object>(),
                        IsReprocess = true,
                        OriginalInvalidRecordId = record.ID
                    };

                    await _publishEndpoint.Publish(validationRequest);
                    result.Published++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    result.Errors.Add($"Record {record.ID}: {ex.Message}");
                    _logger.LogWarning(ex, "Failed to publish revalidation request for record {RecordId} in datasource {DataSourceId}",
                        record.ID, record.DataSourceId);
                }
            }

            // Broadcast progress after each batch via SignalR
            await _hubContext.Clients.All.SendAsync("RevalidationProgress", new
            {
                DataSourceId = dataSourceId,
                Processed = result.Published,
                Total = records.Count,
                Timestamp = DateTime.UtcNow
            });

            // Rate limiting: delay between batches only if >1000 total records (per D-02)
            if (records.Count > 1000)
            {
                _logger.LogDebug("Rate limiting: delaying {DelayMs}ms between batches for datasource {DataSourceId} with {TotalRecords} records",
                    delayMs, string.IsNullOrEmpty(dataSourceId) ? "ALL" : dataSourceId, records.Count);
                await Task.Delay(delayMs);
            }
        }

        _logger.LogInformation("Bulk revalidation for datasource {DataSourceId}: {Published}/{TotalRecords} published, {Failed} failed, {Skipped} skipped",
            string.IsNullOrEmpty(dataSourceId) ? "ALL" : dataSourceId, result.Published, result.TotalRecords, result.Failed, result.Skipped);

        // Broadcast completion event via SignalR (per D-05 toast message format)
        await _hubContext.Clients.All.SendAsync("RevalidationCompleted", new
        {
            DataSourceId = dataSourceId,
            TotalRecords = records.Count,
            Published = result.Published,
            Failed = result.Failed,
            Message = $"{result.Published} מתוך {records.Count} רשומות נשלחו לאימות מחדש",
            MessageEnglish = $"{result.Published} of {records.Count} records sent for revalidation",
            Timestamp = DateTime.UtcNow
        });

        // Broadcast EntityChanged for stats dashboard refresh (per D-06)
        await _hubContext.Clients.All.SendAsync("EntityChanged", new
        {
            EntityType = "InvalidRecord",
            Action = "bulk-revalidated",
            DataSourceId = dataSourceId,
            Count = result.Published
        });

        return result;
    }
}

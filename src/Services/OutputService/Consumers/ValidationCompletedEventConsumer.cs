// ValidationCompletedEventConsumer.cs - Validation Completed Event Consumer
// Task-20: Multi-Destination Output Service
// Version: 1.0
// Date: December 1, 2025

using System.Diagnostics;
using Hazelcast;
using MassTransit;
using MongoDB.Entities;
using Newtonsoft.Json.Linq;
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Messages;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Output.Handlers;
using DataProcessing.Output.Services;
using DataProcessing.Output.Models;

namespace DataProcessing.Output.Consumers;

/// <summary>
/// Consumes ValidationCompletedEvent and writes valid records to configured output destinations
/// Supports multi-destination output with per-destination format control
/// </summary>
public class ValidationCompletedEventConsumer : IConsumer<ValidationCompletedEvent>
{
    private readonly ILogger<ValidationCompletedEventConsumer> _logger;
    private readonly IResilientHazelcastClient _hazelcastClient;
    private readonly IEnumerable<IOutputHandler> _outputHandlers;
    private readonly FormatReconstructorService _formatReconstructor;
    private readonly IConfiguration _configuration;
    private readonly BusinessMetrics _businessMetrics;

    public ValidationCompletedEventConsumer(
        ILogger<ValidationCompletedEventConsumer> logger,
        IResilientHazelcastClient hazelcastClient,
        IEnumerable<IOutputHandler> outputHandlers,
        FormatReconstructorService formatReconstructor,
        IConfiguration configuration,
        BusinessMetrics businessMetrics)
    {
        _logger = logger;
        _hazelcastClient = hazelcastClient;
        _outputHandlers = outputHandlers;
        _formatReconstructor = formatReconstructor;
        _configuration = configuration;
        _businessMetrics = businessMetrics;
    }

    public async Task Consume(ConsumeContext<ValidationCompletedEvent> context)
    {
        var message = context.Message;
        var stopwatch = Stopwatch.StartNew();
        var dataSourceName = message.DataSourceId;

        _logger.LogInformation(
            "Processing ValidationCompletedEvent: DataSourceId={DataSourceId}, FileName={FileName}, " +
            "ValidationStatus={Status}, ValidRecords={ValidCount}, InvalidRecords={InvalidCount}",
            message.DataSourceId,
            message.FileName,
            message.ValidationStatus,
            message.ValidRecords,
            message.InvalidRecords);

        try
        {
            // Skip if validation completely failed (no valid records)
            // Accept: Success, Completed, PartialFailure (has some valid records)
            if (message.ValidationStatus != "Success" &&
                message.ValidationStatus != "Completed" &&
                message.ValidationStatus != "PartialFailure")
            {
                _logger.LogWarning(
                    "Skipping output for failed validation: {FileName}, Status={Status}",
                    message.FileName,
                    message.ValidationStatus);
                return;
            }

            // Skip if no valid records
            if (message.ValidRecords == 0)
            {
                _logger.LogInformation(
                    "No valid records to output for file: {FileName}",
                    message.FileName);
                return;
            }

            // Retrieve datasource
            var dataSource = await DB.Find<DataProcessingDataSource>()
                .OneAsync(message.DataSourceId);

            if (dataSource == null)
            {
                throw new Exception($"DataSource not found: {message.DataSourceId}");
            }

            // Use datasource name for better metric labeling
            dataSourceName = dataSource.Name ?? message.DataSourceId;

            // Create business context for enhanced metric labels
            var businessContext = BusinessMetrics.BusinessContext.FromDataSource(
                category: dataSource.Category,
                supplierName: dataSource.SupplierName,
                filePattern: dataSource.FilePattern,
                scheduleFrequency: dataSource.ScheduleFrequency);

            // Check if output is configured
            if (dataSource.Output == null || dataSource.Output.Destinations == null || !dataSource.Output.Destinations.Any())
            {
                _logger.LogWarning(
                    "No output destinations configured for datasource: {DataSourceId}",
                    message.DataSourceId);
                return;
            }

            // Retrieve valid records from Hazelcast
            var validRecords = await RetrieveValidRecordsFromHazelcastAsync(
                message.HazelcastValidRecordsKey);

            if (validRecords == null || !validRecords.Any())
            {
                _logger.LogWarning(
                    "No valid records found in Hazelcast for key: {Key}",
                    message.HazelcastValidRecordsKey);
                return;
            }

            // Get format metadata from datasource configuration (AdditionalConfiguration)
            var formatMetadata = new Dictionary<string, object>();

            if (dataSource.AdditionalConfiguration != null && dataSource.AdditionalConfiguration.Contains("FormatMetadata"))
            {
                var metadataDoc = dataSource.AdditionalConfiguration["FormatMetadata"].AsBsonDocument;
                foreach (var element in metadataDoc.Elements)
                {
                    formatMetadata[element.Name] = element.Value.ToString() ?? string.Empty;
                }
            }

            // Process each enabled destination
            var enabledDestinations = dataSource.Output.Destinations
                .Where(d => d.Enabled)
                .ToList();

            _logger.LogInformation(
                "Processing {Count} enabled destinations for datasource: {DataSourceId}",
                enabledDestinations.Count,
                message.DataSourceId);

            var results = new List<OutputResult>();

            foreach (var destination in enabledDestinations)
            {
                try
                {
                    var result = await ProcessDestinationAsync(
                        destination,
                        dataSource,
                        validRecords,
                        message.FileName,
                        formatMetadata);

                    results.Add(result);

                    _logger.LogInformation(
                        "Destination {Name} ({Type}): {Status}",
                        destination.Name,
                        destination.Type,
                        result.Success ? "Success" : $"Failed - {result.ErrorMessage}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Failed to process destination {Name} ({Type})",
                        destination.Name,
                        destination.Type);

                    results.Add(OutputResult.Failure(
                        destination.Name,
                        destination.Type,
                        ex.Message));
                }
            }

            // Cleanup Hazelcast cache (only valid records key - original content already cleaned by ValidationService)
            await CleanupHazelcastAsync(message.HazelcastValidRecordsKey);

            // Log summary
            var successCount = results.Count(r => r.Success);
            var failureCount = results.Count(r => !r.Success);

            stopwatch.Stop();

            _logger.LogInformation(
                "Completed output processing: File={FileName}, " +
                "Destinations={Total}, Success={Success}, Failed={Failed}, Duration={Duration}ms",
                message.FileName,
                results.Count,
                successCount,
                failureCount,
                stopwatch.ElapsedMilliseconds);

            // Record business metrics with business context
            _businessMetrics.RecordProcessedRecords(message.ValidRecords, dataSourceName, "OutputService", businessContext, "output_success");
            _businessMetrics.RecordProcessingDuration(stopwatch.Elapsed.TotalSeconds, dataSourceName, "OutputService", "output_processing", businessContext, "output");

            // Record per-destination metrics
            foreach (var result in results)
            {
                var status = result.Success ? "destination_success" : "destination_failure";
                _businessMetrics.RecordProcessedRecords(
                    result.Success ? message.ValidRecords : 0,
                    dataSourceName,
                    "OutputService",
                    businessContext,
                    status);
            }

            // TODO: Publish OutputCompletedEvent for monitoring
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            // Record failed output processing (use empty businessContext since it may not be available)
            _businessMetrics.RecordProcessedRecords(0, dataSourceName, "OutputService", new BusinessMetrics.BusinessContext(), "output_failure");
            _businessMetrics.RecordProcessingDuration(stopwatch.Elapsed.TotalSeconds, dataSourceName, "OutputService", "output_processing", new BusinessMetrics.BusinessContext(), "output");

            _logger.LogError(
                ex,
                "Failed to process ValidationCompletedEvent: DataSourceId={DataSourceId}, FileName={FileName}, Duration={Duration}ms",
                message.DataSourceId,
                message.FileName,
                stopwatch.ElapsedMilliseconds);

            throw;
        }
    }

    /// <summary>
    /// Process a single output destination
    /// </summary>
    private async Task<OutputResult> ProcessDestinationAsync(
        OutputDestination destination,
        DataProcessingDataSource dataSource,
        List<JObject> validRecords,
        string fileName,
        Dictionary<string, object> formatMetadata)
    {
        // Determine output format (destination override or global default)
        var outputFormat = destination.OutputFormat ?? dataSource.Output.DefaultOutputFormat ?? "json";

        // Reconstruct content in desired format
        var content = await _formatReconstructor.ReconstructAsync(
            validRecords,
            outputFormat,
            formatMetadata);

        // Find appropriate handler.
        // G11 (Phase 35): destination.Type is persisted in the frontend protocol-Select's case
        // ('S3', 'Kafka', 'FTP', ...), but every IOutputHandler.CanHandle compares against a
        // lowercase literal ("s3", "kafka", ...). Without normalization "S3" != "s3" so no handler
        // was found and the validated records were silently dropped (no MinIO output object).
        // Normalize to lower-invariant so dispatch is case-insensitive for all destination types.
        var normalizedType = destination.Type?.ToLowerInvariant() ?? string.Empty;
        var handler = _outputHandlers.FirstOrDefault(h => h.CanHandle(normalizedType));

        if (handler == null)
        {
            throw new Exception($"No handler found for destination type: {destination.Type}");
        }

        // Write to destination with retry logic
        var retryAttempts = _configuration.GetValue<int>("Output:RetryAttempts", 3);
        var retryDelayMs = _configuration.GetValue<int>("Output:RetryDelayMs", 1000);

        OutputResult? result = null;
        Exception? lastException = null;

        for (int attempt = 1; attempt <= retryAttempts; attempt++)
        {
            try
            {
                result = await handler.WriteAsync(
                    destination,
                    content,
                    fileName);

                if (result.Success)
                {
                    return result;
                }

                lastException = new Exception(result.ErrorMessage ?? "Unknown error");

                if (attempt < retryAttempts)
                {
                    _logger.LogWarning(
                        "Output attempt {Attempt}/{Total} failed for destination {Name}: {Error}",
                        attempt,
                        retryAttempts,
                        destination.Name,
                        result.ErrorMessage);

                    await Task.Delay(retryDelayMs * attempt);
                }
            }
            catch (Exception ex)
            {
                lastException = ex;

                if (attempt < retryAttempts)
                {
                    _logger.LogWarning(
                        ex,
                        "Output attempt {Attempt}/{Total} threw exception for destination {Name}",
                        attempt,
                        retryAttempts,
                        destination.Name);

                    await Task.Delay(retryDelayMs * attempt);
                }
            }
        }

        // All retries failed
        throw lastException ?? new Exception("All retry attempts failed");
    }

    /// <summary>
    /// Retrieve valid records from Hazelcast cache with automatic retry and reconnection
    /// </summary>
    private async Task<List<JObject>?> RetrieveValidRecordsFromHazelcastAsync(string? hazelcastKey)
    {
        if (string.IsNullOrEmpty(hazelcastKey))
        {
            _logger.LogWarning("No Hazelcast key provided for valid records");
            return null;
        }

        try
        {
            // Use resilient client with built-in retry and circuit breaker
            var jsonContent = await _hazelcastClient.GetAsync<string, string>("valid-records", hazelcastKey);

            if (string.IsNullOrEmpty(jsonContent))
            {
                _logger.LogWarning("Content not found in Hazelcast for key: {Key}", hazelcastKey);
                return null;
            }

            // Parse JSON array
            var jsonArray = JArray.Parse(jsonContent);
            _logger.LogDebug("Retrieved {Count} valid records from Hazelcast for key: {Key}",
                jsonArray.Count, hazelcastKey);
            return jsonArray.Select(token => (JObject)token).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to retrieve valid records from Hazelcast after retries: {Key}",
                hazelcastKey);
            throw;
        }
    }

    /// <summary>
    /// Cleanup cached content from Hazelcast with resilient operations
    /// </summary>
    private async Task CleanupHazelcastAsync(string? validRecordsKey)
    {
        try
        {
            // Remove valid records using resilient client
            if (!string.IsNullOrEmpty(validRecordsKey))
            {
                await _hazelcastClient.DeleteAsync<string, string>("valid-records", validRecordsKey);
                _logger.LogDebug("Removed valid records from Hazelcast: {Key}", validRecordsKey);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to cleanup Hazelcast cache: ValidRecordsKey={ValidRecordsKey}",
                validRecordsKey);
            // Don't throw - cleanup failure shouldn't block the pipeline
        }
    }
}

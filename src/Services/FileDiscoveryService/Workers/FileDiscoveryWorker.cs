using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Messages;
using DataProcessing.Shared.Services;
using DataProcessing.Shared.Utilities;
using MassTransit;
using MongoDB.Entities;
using Quartz;

namespace DataProcessing.FileDiscovery.Workers;

/// <summary>
/// Quartz job that discovers new files from configured data sources
/// Runs periodically to check all active datasources for new files
/// Uses ConnectorFactory to select appropriate connector based on server type (v0.2.0)
/// </summary>
[DisallowConcurrentExecution]
public class FileDiscoveryWorker : IJob
{
    private readonly ILogger<FileDiscoveryWorker> _logger;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly IFileHashService _fileHashService;
    private readonly IConnectorFactory _connectorFactory;

    public FileDiscoveryWorker(
        ILogger<FileDiscoveryWorker> logger,
        IPublishEndpoint publishEndpoint,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        IFileHashService fileHashService,
        IConnectorFactory connectorFactory)
    {
        _logger = logger;
        _publishEndpoint = publishEndpoint;
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _fileHashService = fileHashService;
        _connectorFactory = connectorFactory;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var correlationId = Guid.NewGuid().ToString();
        _logger.LogInformation("[{CorrelationId}] FileDiscoveryWorker: Starting file discovery cycle", correlationId);

        try
        {
            // Query all active datasources
            var datasources = await DB.Find<DataProcessingDataSource>()
                .Match(ds => ds.IsActive)
                .ExecuteAsync();

            _logger.LogInformation("[{CorrelationId}] Found {Count} active datasources to check", 
                correlationId, datasources.Count);

            var discoveredCount = 0;

            foreach (var datasource in datasources)
            {
                try
                {
                    // Check if it's time to poll this datasource based on its cron expression
                    var cronExpression = datasource.GetEffectiveCronExpression();
                    
                    if (ShouldPollDatasource(datasource, cronExpression))
                    {
                        _logger.LogDebug("[{CorrelationId}] Checking datasource: {DataSourceName} ({DataSourceId})", 
                            correlationId, datasource.Name, datasource.ID);

                        var files = await DiscoverFilesAsync(datasource, correlationId);
                        
                        if (files.Any())
                        {
                            _logger.LogInformation(
                                "[{CorrelationId}] Discovered {FileCount} file(s) from datasource {DataSourceName}",
                                correlationId, files.Count, datasource.Name);

                            // Publish FileDiscoveredEvent for each file
                            foreach (var file in files)
                            {
                                await PublishFileDiscoveredEventAsync(datasource, file, correlationId);
                                discoveredCount++;
                            }

                            // Update last processed timestamp
                            datasource.LastProcessedAt = DateTime.UtcNow;
                            await datasource.SaveAsync();
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, 
                        "[{CorrelationId}] Error discovering files from datasource {DataSourceName} ({DataSourceId})", 
                        correlationId, datasource.Name, datasource.ID);
                }
            }

            _logger.LogInformation(
                "[{CorrelationId}] FileDiscoveryWorker: Completed. Discovered {TotalFiles} file(s) from {DataSourceCount} datasource(s)",
                correlationId, discoveredCount, datasources.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{CorrelationId}] FileDiscoveryWorker: Fatal error during discovery cycle", correlationId);
        }
    }

    /// <summary>
    /// Determines if a datasource should be polled based on its cron schedule
    /// </summary>
    private bool ShouldPollDatasource(DataProcessingDataSource datasource, string cronExpression)
    {
        // If LastProcessedAt is null, poll immediately
        if (!datasource.LastProcessedAt.HasValue)
            return true;

        // Simple time-based check: if more time has passed than the minimum interval
        // For production, you'd parse the cron expression and check next run time
        var timeSinceLastPoll = DateTime.UtcNow - datasource.LastProcessedAt.Value;
        var pollingRate = datasource.PollingRate;

        // Poll if enough time has passed
        return timeSinceLastPoll >= pollingRate;
    }

    /// <summary>
    /// Discovers files from a datasource using the appropriate connector
    /// Uses ConnectorFactory to select connector based on server type (v0.2.0)
    /// Uses Hazelcast distributed cache for deduplication
    /// </summary>
    private async Task<List<FileMetadata>> DiscoverFilesAsync(
        DataProcessingDataSource datasource,
        string correlationId)
    {
        // Get the appropriate connector using ConnectorFactory (v0.2.0)
        var serverType = DetectServerType(datasource);
        var connector = _connectorFactory.GetConnector(serverType);

        _logger.LogDebug(
            "[{CorrelationId}] Using {ConnectorType} for datasource {DataSourceName}",
            correlationId, connector.ConnectorType, datasource.Name);

        // Get deduplication TTL from configuration (default: 24 hours)
        var ttlHours = _configuration.GetValue("FileDiscovery:DeduplicationTTLHours", 24);
        var ttl = TimeSpan.FromHours(ttlHours);

        try
        {
            // List files using the connector
            var filePaths = await connector.ListFilesAsync(
                datasource,
                datasource.FilePattern);

            _logger.LogDebug(
                "[{CorrelationId}] Connector found {FileCount} file(s) from {Path}",
                correlationId, filePaths.Count, datasource.FilePath);

            // Get metadata for each file and apply deduplication via Hazelcast
            var newFiles = new List<FileMetadata>();
            var duplicateCount = 0;

            foreach (var filePath in filePaths)
            {
                try
                {
                    var metadata = await connector.GetFileMetadataAsync(datasource, filePath);

                    // Calculate file hash for deduplication
                    var fileHash = FileHashCalculator.CalculateHash(metadata);

                    // Check if file already processed using distributed Hazelcast cache
                    if (await _fileHashService.IsFileAlreadyProcessedAsync(datasource.ID!, fileHash))
                    {
                        _logger.LogDebug(
                            "[{CorrelationId}] Skipping already processed file: {FileName} (hash: {Hash})",
                            correlationId, metadata.FileName, fileHash.Substring(0, 8) + "...");
                        duplicateCount++;
                        continue;
                    }

                    // Add to Hazelcast with TTL (automatic expiration, no cleanup needed)
                    await _fileHashService.AddProcessedFileHashAsync(
                        datasource.ID!,
                        fileHash,
                        new ProcessedFileHashInfo
                        {
                            FileName = metadata.FileName,
                            FilePath = metadata.FilePath,
                            FileSizeBytes = metadata.FileSizeBytes,
                            LastModifiedUtc = metadata.LastModifiedUtc,
                            ProcessedAt = DateTime.UtcNow,
                            CorrelationId = correlationId
                        },
                        ttl);

                    newFiles.Add(metadata);

                    _logger.LogDebug(
                        "[{CorrelationId}] File queued for processing: {FileName} (hash: {Hash}, TTL: {TTL}h)",
                        correlationId, metadata.FileName, fileHash.Substring(0, 8) + "...", ttlHours);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "[{CorrelationId}] Failed to get metadata for file {FilePath}",
                        correlationId, filePath);
                }
            }

            // Get active hash count from Hazelcast for logging
            var activeHashCount = await _fileHashService.GetActiveFileHashCountAsync(datasource.ID!);

            _logger.LogInformation(
                "[{CorrelationId}] Deduplication results: {NewFiles} new file(s), {Duplicates} duplicate(s) skipped, {ActiveHashes} active hash(es) in Hazelcast",
                correlationId, newFiles.Count, duplicateCount, activeHashCount);

            return newFiles;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Error using connector to discover files from {Path}",
                correlationId, datasource.FilePath);
            return new List<FileMetadata>();
        }
    }

    /// <summary>
    /// Publishes a FileDiscoveredEvent for downstream processing
    /// </summary>
    private async Task PublishFileDiscoveredEventAsync(
        DataProcessingDataSource datasource,
        FileMetadata file,
        string correlationId)
    {
        var pollBatchId = Guid.NewGuid(); // Each discovery cycle gets a batch ID
        var serverType = DetectServerType(datasource);

        var @event = new FileDiscoveredEvent
        {
            CorrelationId = correlationId,
            DataSourceId = datasource.ID!,
            FilePath = file.FilePath,
            FileName = file.FileName,
            FileSizeBytes = file.FileSizeBytes,
            DiscoveredAt = DateTime.UtcNow,
            SequenceNumber = 1, // Will be improved in production to track actual sequence
            PollBatchId = pollBatchId,

            // Server reference fields (v0.2.0)
            ServerId = datasource.FileServerId,
            ServerType = serverType
        };

        await _publishEndpoint.Publish(@event);

        _logger.LogInformation(
            "[{CorrelationId}] Published FileDiscoveredEvent for file {FileName} from datasource {DataSourceName}",
            correlationId, file.FileName, datasource.Name);
    }

    /// <summary>
    /// Detects server type from datasource configuration
    /// Checks FileServerId first, then falls back to path-based detection
    /// </summary>
    private static string DetectServerType(DataProcessingDataSource datasource)
    {
        // Check if datasource has a server reference (v0.2.0 architecture)
        if (!string.IsNullOrEmpty(datasource.FileServerId))
        {
            // Check AdditionalConfiguration for server type hint
            if (datasource.AdditionalConfiguration?.Contains("ServerType") == true)
            {
                return datasource.AdditionalConfiguration["ServerType"].AsString;
            }
        }

        // Fall back to path-based detection (legacy support)
        var path = datasource.FilePath?.ToLowerInvariant() ?? "";

        if (path.StartsWith("ftp://"))
            return "ftp";
        if (path.StartsWith("sftp://") || path.StartsWith("ssh://"))
            return "sftp";
        if (path.StartsWith("s3://") || path.Contains(".s3.") || path.Contains("minio"))
            return "s3";
        if (path.StartsWith("http://") || path.StartsWith("https://"))
            return "http";

        // Default to local file system
        return "local";
    }
}

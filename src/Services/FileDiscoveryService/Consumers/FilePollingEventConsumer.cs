using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Messages;
using DataProcessing.Shared.Services;
using DataProcessing.Shared.Utilities;
using MassTransit;
using MongoDB.Entities;

namespace DataProcessing.FileDiscovery.Consumers;

/// <summary>
/// Consumes FilePollingEvent messages from SchedulingService
/// Discovers files from the specified datasource and publishes FileDiscoveredEvent for each
/// Supports archive detection and content listing (v0.2.0)
/// </summary>
public class FilePollingEventConsumer : IConsumer<FilePollingEvent>
{
    private readonly ILogger<FilePollingEventConsumer> _logger;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly IFileHashService _fileHashService;
    private readonly IConnectorFactory _connectorFactory;
    private readonly IArchiveService _archiveService;
    private readonly IArchiveCacheService _archiveCacheService;

    public FilePollingEventConsumer(
        ILogger<FilePollingEventConsumer> logger,
        IPublishEndpoint publishEndpoint,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        IFileHashService fileHashService,
        IConnectorFactory connectorFactory,
        IArchiveService archiveService,
        IArchiveCacheService archiveCacheService)
    {
        _logger = logger;
        _publishEndpoint = publishEndpoint;
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _fileHashService = fileHashService;
        _connectorFactory = connectorFactory;
        _archiveService = archiveService;
        _archiveCacheService = archiveCacheService;
    }

    public async Task Consume(ConsumeContext<FilePollingEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation(
            "[{CorrelationId}] FilePollingEventConsumer: Received polling request for datasource {DataSourceId} ({DataSourceName})",
            message.CorrelationId, message.DataSourceId, message.DataSourceName);

        try
        {
            // Get datasource from MongoDB
            var datasource = await DB.Find<DataProcessingDataSource>()
                .OneAsync(message.DataSourceId);

            if (datasource == null)
            {
                _logger.LogWarning(
                    "[{CorrelationId}] Datasource {DataSourceId} not found",
                    message.CorrelationId, message.DataSourceId);
                return;
            }

            // Discover files using connector
            var files = await DiscoverFilesAsync(datasource, message.CorrelationId);

            if (!files.Any())
            {
                _logger.LogInformation(
                    "[{CorrelationId}] No files discovered from datasource {DataSourceName}, releasing lock",
                    message.CorrelationId, datasource.Name);

                // Release lock even when no files found
                datasource.LastProcessedAt = DateTime.UtcNow;
                datasource.ReleaseProcessingLock("completed_no_files");
                await datasource.SaveAsync();

                _logger.LogInformation(
                    "[{CorrelationId}] Lock released for datasource {DataSourceName} (no files found)",
                    message.CorrelationId, datasource.Name);

                return;
            }

            _logger.LogInformation(
                "[{CorrelationId}] Discovered {FileCount} file(s) from datasource {DataSourceName}",
                message.CorrelationId, files.Count, datasource.Name);

            // Publish FileDiscoveredEvent for each file
            var pollBatchId = Guid.NewGuid();
            var sequenceNumber = 0;

            // Get connector for reading file content (needed for archive processing)
            var serverType = DetectServerType(datasource);
            var connector = _connectorFactory.GetConnector(serverType);

            // Get deduplication TTL for post-publish hash marking
            var ttlHours = _configuration.GetValue("FileDiscovery:DeduplicationTTLHours", 24);
            var ttl = TimeSpan.FromHours(ttlHours);

            for (int i = 0; i < files.Count; i++)
            {
                var file = files[i];

                // Check if file is an archive and datasource has archive settings enabled
                if (datasource.ArchiveSettings?.IsArchiveSource == true &&
                    _archiveService.IsArchive(file.FileName))
                {
                    // Process archive: list contents and publish events for each entry
                    var archiveEventsPublished = await ProcessArchiveFileAsync(
                        datasource,
                        connector,
                        file,
                        message.CorrelationId,
                        pollBatchId,
                        sequenceNumber);

                    sequenceNumber += archiveEventsPublished;
                }
                else
                {
                    // Regular file: publish single event
                    await PublishFileDiscoveredEventAsync(
                        datasource,
                        file,
                        message.CorrelationId,
                        pollBatchId,
                        sequenceNumber);

                    sequenceNumber++;
                }

                // Mark file as processed in Hazelcast AFTER successful publish
                // This prevents stale hashes blocking retries if publish fails
                var fileHash = FileHashCalculator.CalculateHash(file);
                await _fileHashService.AddProcessedFileHashAsync(
                    datasource.ID!,
                    fileHash,
                    new ProcessedFileHashInfo
                    {
                        FileName = file.FileName,
                        FilePath = file.FilePath,
                        FileSizeBytes = file.FileSizeBytes,
                        LastModifiedUtc = file.LastModifiedUtc,
                        ProcessedAt = DateTime.UtcNow,
                        CorrelationId = message.CorrelationId
                    },
                    ttl);
            }

            // Update last processed timestamp and release lock
            datasource.LastProcessedAt = DateTime.UtcNow;
            datasource.ReleaseProcessingLock("completed");
            await datasource.SaveAsync();

            _logger.LogInformation(
                "[{CorrelationId}] Published {EventCount} FileDiscoveredEvent(s) for datasource {DataSourceName}. Lock released.",
                message.CorrelationId, files.Count, datasource.Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Error processing FilePollingEvent for datasource {DataSourceId}",
                message.CorrelationId, message.DataSourceId);

            // Release lock on error
            try
            {
                var datasource = await DB.Find<DataProcessingDataSource>()
                    .OneAsync(message.DataSourceId);
                if (datasource != null)
                {
                    datasource.ReleaseProcessingLock("error");
                    await datasource.SaveAsync();
                }
            }
            catch (Exception lockEx)
            {
                _logger.LogWarning(lockEx,
                    "[{CorrelationId}] Failed to release lock after error for datasource {DataSourceId}",
                    message.CorrelationId, message.DataSourceId);
            }

            throw; // Let MassTransit handle retry logic
        }
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

        // Get deduplication TTL hours from configuration for logging (default: 24 hours)
        var ttlHours = _configuration.GetValue("FileDiscovery:DeduplicationTTLHours", 24);

        try
        {
            // List files matching the pattern
            var filePaths = await connector.ListFilesAsync(datasource, datasource.FilePattern);

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

                    // NOTE: Hash is NOT added here — it is added AFTER successful publish
                    // in Consume() to prevent stale hashes blocking retries on publish failure

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
                "[{CorrelationId}] Error discovering files from {Path}",
                correlationId, datasource.FilePath);
            return new List<FileMetadata>();
        }
    }

    /// <summary>
    /// Detects server type from datasource configuration
    /// Checks FileServerId first, then falls back to path-based detection
    /// </summary>
    private string DetectServerType(DataProcessingDataSource datasource)
    {
        // Check if datasource has a server reference (v0.2.0 architecture)
        if (!string.IsNullOrEmpty(datasource.FileServerId))
        {
            // Look up server type from AdminServer (async in future)
            // For now, check AdditionalConfiguration for server type hint
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

    /// <summary>
    /// Publishes a FileDiscoveredEvent for downstream processing
    /// </summary>
    private async Task PublishFileDiscoveredEventAsync(
        DataProcessingDataSource datasource,
        FileMetadata file,
        string correlationId,
        Guid pollBatchId,
        int sequenceNumber,
        ArchiveContext? archiveContext = null)
    {
        var fileEvent = new FileDiscoveredEvent
        {
            CorrelationId = correlationId,
            DataSourceId = datasource.ID!,
            FilePath = file.FilePath,
            FileName = file.FileName,
            FileSizeBytes = file.FileSizeBytes,
            DiscoveredAt = DateTime.UtcNow,
            SequenceNumber = sequenceNumber,
            PollBatchId = pollBatchId,

            // Archive fields (v0.2.0)
            IsFromArchive = archiveContext != null,
            ArchivePath = archiveContext?.ArchivePath,
            PathInArchive = archiveContext?.PathInArchive,
            ArchiveCacheKey = archiveContext?.ArchiveCacheKey,
            ArchiveBatchId = archiveContext?.ArchiveBatchId,
            TotalFilesInArchive = archiveContext?.TotalFilesInArchive,
            FileIndexInArchive = archiveContext?.FileIndexInArchive,

            // Server reference fields (v0.2.0)
            ServerId = datasource.FileServerId,
            ServerType = DetectServerType(datasource)
        };

        await _publishEndpoint.Publish(fileEvent);

        if (archiveContext != null)
        {
            _logger.LogDebug(
                "[{CorrelationId}] Published FileDiscoveredEvent for archive entry {FileName} ({Index}/{Total})",
                correlationId, file.FileName, archiveContext.FileIndexInArchive + 1, archiveContext.TotalFilesInArchive);
        }
        else
        {
            _logger.LogDebug(
                "[{CorrelationId}] Published FileDiscoveredEvent for file {FileName} (sequence {SequenceNumber})",
                correlationId, file.FileName, sequenceNumber);
        }
    }

    /// <summary>
    /// Processes an archive file: downloads content, lists entries, and publishes events
    /// Implements size-tiered caching strategy for archive content
    /// </summary>
    private async Task<int> ProcessArchiveFileAsync(
        DataProcessingDataSource datasource,
        IDataSourceConnector connector,
        FileMetadata archiveFile,
        string correlationId,
        Guid pollBatchId,
        int startSequenceNumber)
    {
        _logger.LogInformation(
            "[{CorrelationId}] Processing archive file: {FileName} ({Size:N0} bytes)",
            correlationId, archiveFile.FileName, archiveFile.FileSizeBytes);

        try
        {
            // Download archive content
            using var archiveStream = await connector.ReadFileAsync(datasource, archiveFile.FilePath);
            using var memoryStream = new MemoryStream();
            await archiveStream.CopyToAsync(memoryStream);
            var archiveContent = memoryStream.ToArray();

            // Get archive type
            var archiveType = _archiveService.GetArchiveType(archiveFile.FileName, archiveContent);
            if (archiveType == null)
            {
                _logger.LogWarning(
                    "[{CorrelationId}] Could not detect archive type for {FileName}",
                    correlationId, archiveFile.FileName);
                return 0;
            }

            // List archive contents with security settings
            var securitySettings = datasource.ArchiveSettings?.SecuritySettings ?? ArchiveSecuritySettings.Default;
            var password = datasource.ArchiveSettings?.ArchivePassword;
            var extractionPattern = datasource.ArchiveSettings?.ExtractionPattern ?? "*";

            var entries = await _archiveService.ListContentsAsync(
                archiveContent, archiveType, password, securitySettings);

            // Filter entries by extraction pattern
            var matchingEntries = entries
                .Where(e => !e.IsDirectory && MatchesPattern(e.Path, extractionPattern))
                .ToList();

            if (matchingEntries.Count == 0)
            {
                _logger.LogInformation(
                    "[{CorrelationId}] No files matching pattern '{Pattern}' in archive {FileName}",
                    correlationId, extractionPattern, archiveFile.FileName);
                return 0;
            }

            _logger.LogInformation(
                "[{CorrelationId}] Found {Count} files matching pattern in archive {FileName}",
                correlationId, matchingEntries.Count, archiveFile.FileName);

            // Cache archive content using size-tiered strategy
            string? archiveCacheKey = null;
            if (_archiveCacheService.ShouldCache(archiveContent.Length))
            {
                archiveCacheKey = _archiveCacheService.GenerateCacheKey();
                await _archiveCacheService.CacheArchiveAsync(archiveCacheKey, archiveContent);

                _logger.LogInformation(
                    "[{CorrelationId}] Cached archive {FileName} with key {CacheKey}",
                    correlationId, archiveFile.FileName, archiveCacheKey);
            }
            else
            {
                _logger.LogInformation(
                    "[{CorrelationId}] Archive {FileName} too large to cache ({Size:N0} bytes)",
                    correlationId, archiveFile.FileName, archiveContent.Length);
            }

            // Create archive batch ID for tracking all files from this archive
            var archiveBatchId = Guid.NewGuid();

            // Publish FileDiscoveredEvent for each matching entry
            for (int i = 0; i < matchingEntries.Count; i++)
            {
                var entry = matchingEntries[i];

                var fileMetadata = new FileMetadata
                {
                    FilePath = entry.Path,
                    FileName = entry.FileName,
                    FileSizeBytes = entry.UncompressedSize,
                    LastModifiedUtc = entry.LastModified ?? DateTime.UtcNow,
                    ContentType = GetContentType(Path.GetExtension(entry.FileName))
                };

                var archiveContext = new ArchiveContext
                {
                    ArchivePath = archiveFile.FilePath,
                    PathInArchive = entry.Path,
                    ArchiveCacheKey = archiveCacheKey,
                    ArchiveBatchId = archiveBatchId,
                    TotalFilesInArchive = matchingEntries.Count,
                    FileIndexInArchive = i
                };

                await PublishFileDiscoveredEventAsync(
                    datasource,
                    fileMetadata,
                    correlationId,
                    pollBatchId,
                    startSequenceNumber + i,
                    archiveContext);
            }

            return matchingEntries.Count;
        }
        catch (ArchiveSecurityException ex)
        {
            _logger.LogError(
                "[{CorrelationId}] Archive security violation for {FileName}: {ViolationType} - {Message}",
                correlationId, archiveFile.FileName, ex.ViolationType, ex.Message);
            return 0;
        }
        catch (ArchivePasswordException ex)
        {
            _logger.LogError(
                "[{CorrelationId}] Archive password error for {FileName}: {Message}",
                correlationId, archiveFile.FileName, ex.Message);
            return 0;
        }
        catch (ArchiveException ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Archive processing error for {FileName}",
                correlationId, archiveFile.FileName);
            return 0;
        }
    }

    /// <summary>
    /// Matches a path against a glob pattern
    /// </summary>
    private static bool MatchesPattern(string path, string pattern)
    {
        if (string.IsNullOrEmpty(pattern) || pattern == "*" || pattern == "*.*")
            return true;

        // Convert glob pattern to regex
        var regexPattern = "^" + System.Text.RegularExpressions.Regex.Escape(pattern)
            .Replace("\\*\\*", ".*")
            .Replace("\\*", "[^/]*")
            .Replace("\\?", ".")
            + "$";

        return System.Text.RegularExpressions.Regex.IsMatch(
            path, regexPattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    /// <summary>
    /// Gets content type from file extension
    /// </summary>
    private static string GetContentType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".csv" => "text/csv",
            ".txt" => "text/plain",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls" => "application/vnd.ms-excel",
            _ => "application/octet-stream"
        };
    }

    /// <summary>
    /// Context for archive entries being published
    /// </summary>
    private class ArchiveContext
    {
        public string ArchivePath { get; init; } = string.Empty;
        public string PathInArchive { get; init; } = string.Empty;
        public string? ArchiveCacheKey { get; init; }
        public Guid ArchiveBatchId { get; init; }
        public int TotalFilesInArchive { get; init; }
        public int FileIndexInArchive { get; init; }
    }
}

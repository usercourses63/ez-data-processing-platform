using System.Diagnostics;
using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Converters;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Messages;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Services;
using Hazelcast;
using MassTransit;
using MongoDB.Entities;

namespace DataProcessing.FileProcessor.Consumers;

/// <summary>
/// Consumes FileDiscoveredEvent messages from FileDiscoveryService
/// Reads file content, converts to JSON, stores in Hazelcast, and publishes ValidationRequestEvent
/// </summary>
public class FileDiscoveredEventConsumer : IConsumer<FileDiscoveredEvent>
{
    private readonly ILogger<FileDiscoveredEventConsumer> _logger;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IHazelcastClient _hazelcastClient;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly BusinessMetrics _businessMetrics;
    private readonly IConnectorFactory _connectorFactory;
    private readonly IArchiveService _archiveService;
    private readonly IArchiveCacheService _archiveCacheService;

    public FileDiscoveredEventConsumer(
        ILogger<FileDiscoveredEventConsumer> logger,
        IPublishEndpoint publishEndpoint,
        IHazelcastClient hazelcastClient,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        BusinessMetrics businessMetrics,
        IConnectorFactory connectorFactory,
        IArchiveService archiveService,
        IArchiveCacheService archiveCacheService)
    {
        _logger = logger;
        _publishEndpoint = publishEndpoint;
        _hazelcastClient = hazelcastClient;
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _businessMetrics = businessMetrics;
        _connectorFactory = connectorFactory;
        _archiveService = archiveService;
        _archiveCacheService = archiveCacheService;
    }

    public async Task Consume(ConsumeContext<FileDiscoveredEvent> context)
    {
        var message = context.Message;
        var stopwatch = Stopwatch.StartNew();
        var dataSourceName = message.DataSourceId;
        var fileType = Path.GetExtension(message.FileName).TrimStart('.').ToLowerInvariant();

        _logger.LogInformation(
            "[{CorrelationId}] FileDiscoveredEventConsumer: Processing file {FileName} from datasource {DataSourceId}",
            message.CorrelationId, message.FileName, message.DataSourceId);

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
                _businessMetrics.RecordFileProcessed(dataSourceName, fileType, false);
                return;
            }

            // Use datasource name for better metric labeling
            dataSourceName = datasource.Name ?? message.DataSourceId;

            // Create business context for enhanced metric labels
            var businessContext = BusinessMetrics.BusinessContext.FromDataSource(
                category: datasource.Category,
                supplierName: datasource.SupplierName,
                filePattern: datasource.FilePattern,
                scheduleFrequency: datasource.ScheduleFrequency);

            // Read file content - use binary mode for Excel, text mode for others
            string jsonContent;
            string originalFormat;
            Dictionary<string, object> metadata;
            int contentLength;

            // Log if processing from archive (v0.2.0)
            if (message.IsFromArchive)
            {
                _logger.LogInformation(
                    "[{CorrelationId}] Processing file from archive: {PathInArchive} (archive: {ArchivePath}, batch: {ArchiveBatchId}, {FileIndex}/{TotalFiles})",
                    message.CorrelationId, message.PathInArchive, message.ArchivePath,
                    message.ArchiveBatchId, message.FileIndexInArchive, message.TotalFilesInArchive);
            }

            if (IsBinaryFormat(message.FileName))
            {
                // Binary file (Excel) - read as bytes to preserve binary integrity
                var fileContentBytes = await ReadFileContentAsBytesAsync(datasource, message.FilePath, message.CorrelationId, message);
                if (fileContentBytes.Length == 0)
                {
                    _logger.LogWarning(
                        "[{CorrelationId}] Binary file {FileName} is empty or could not be read",
                        message.CorrelationId, message.FileName);
                    _businessMetrics.RecordFileProcessed(dataSourceName, "FileProcessor", fileType, false, businessContext);
                    return;
                }
                contentLength = fileContentBytes.Length;

                // Record file size with business context
                _businessMetrics.RecordFileSize(contentLength, dataSourceName, "FileProcessor", fileType);
                _businessMetrics.RecordBytesProcessed(contentLength, dataSourceName, "FileProcessor", businessContext, fileType, "processing");

                // Convert binary content to JSON
                (jsonContent, originalFormat, metadata) = await ConvertToJsonFromBytesAsync(
                    fileContentBytes,
                    message.FileName,
                    message.CorrelationId);
            }
            else
            {
                // Text file (CSV, XML, JSON) - read as string
                var fileContent = await ReadFileContentAsync(datasource, message.FilePath, message.CorrelationId, message);
                if (string.IsNullOrEmpty(fileContent))
                {
                    _logger.LogWarning(
                        "[{CorrelationId}] File {FileName} is empty or could not be read",
                        message.CorrelationId, message.FileName);
                    _businessMetrics.RecordFileProcessed(dataSourceName, "FileProcessor", fileType, false, businessContext);
                    return;
                }
                contentLength = fileContent.Length;

                // Record file size with business context
                _businessMetrics.RecordFileSize(contentLength, dataSourceName, "FileProcessor", fileType);
                _businessMetrics.RecordBytesProcessed(contentLength, dataSourceName, "FileProcessor", businessContext, fileType, "processing");

                // Convert text content to JSON
                (jsonContent, originalFormat, metadata) = await ConvertToJsonAsync(
                    fileContent,
                    message.FileName,
                    message.CorrelationId);
            }

            if (string.IsNullOrEmpty(jsonContent))
            {
                _logger.LogError(
                    "[{CorrelationId}] Failed to convert file {FileName} to JSON",
                    message.CorrelationId, message.FileName);
                _businessMetrics.RecordFileProcessed(dataSourceName, "FileProcessor", fileType, false, businessContext);
                return;
            }

            // Store in Hazelcast
            var hazelcastKey = await StoreInHazelcastAsync(
                jsonContent,
                message.CorrelationId);

            _logger.LogInformation(
                "[{CorrelationId}] File {FileName} converted to JSON ({Format}) and cached in Hazelcast with key {HazelcastKey}",
                message.CorrelationId, message.FileName, originalFormat, hazelcastKey);

            // Publish ValidationRequestEvent
            await PublishValidationRequestAsync(
                datasource,
                message,
                hazelcastKey,
                originalFormat,
                metadata);

            _logger.LogInformation(
                "[{CorrelationId}] Published ValidationRequestEvent for file {FileName}",
                message.CorrelationId, message.FileName);

            // Record successful file processing with business context
            stopwatch.Stop();
            _businessMetrics.RecordFileProcessed(dataSourceName, "FileProcessor", fileType, true, businessContext);
            _businessMetrics.RecordProcessingDuration(stopwatch.Elapsed.TotalSeconds, dataSourceName, "FileProcessor", "file_processing", businessContext, "processing");
            _businessMetrics.RecordJobCompleted("file_processing", dataSourceName, "FileProcessor", businessContext);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _businessMetrics.RecordFileProcessed(dataSourceName, fileType, false);
            _businessMetrics.RecordProcessingDuration(stopwatch.Elapsed.TotalSeconds, dataSourceName, "file_processing");

            _logger.LogError(ex,
                "[{CorrelationId}] Error processing file {FileName} from datasource {DataSourceId}",
                message.CorrelationId, message.FileName, message.DataSourceId);
            throw; // Let MassTransit handle retry logic
        }
    }

    /// <summary>
    /// Checks if a file format is binary (requires byte-level handling)
    /// </summary>
    private static bool IsBinaryFormat(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension is ".xlsx" or ".xls";
    }

    /// <summary>
    /// Reads file content as text using the appropriate connector
    /// Supports both direct file access and archive extraction (v0.2.0)
    /// </summary>
    private async Task<string> ReadFileContentAsync(
        DataProcessingDataSource datasource,
        string filePath,
        string correlationId,
        FileDiscoveredEvent? message = null)
    {
        try
        {
            // Check if this file is from an archive (v0.2.0)
            if (message?.IsFromArchive == true && !string.IsNullOrEmpty(message.PathInArchive))
            {
                _logger.LogDebug(
                    "[{CorrelationId}] Reading file from archive: {PathInArchive} (cache key: {CacheKey})",
                    correlationId, message.PathInArchive, message.ArchiveCacheKey);

                var bytes = await ExtractFileFromArchiveAsync(datasource, message, correlationId);
                if (bytes.Length == 0)
                    return string.Empty;

                var content = System.Text.Encoding.UTF8.GetString(bytes);
                _logger.LogDebug(
                    "[{CorrelationId}] Extracted {Bytes} bytes from archive for {PathInArchive}",
                    correlationId, content.Length, message.PathInArchive);

                return content;
            }

            // Standard file reading using ConnectorFactory
            var serverType = DetectServerType(datasource);
            var connector = _connectorFactory.GetConnector(serverType);

            using var stream = await connector.ReadFileAsync(datasource, filePath);
            using var reader = new StreamReader(stream);
            var fileContent = await reader.ReadToEndAsync();

            _logger.LogDebug(
                "[{CorrelationId}] Read {Bytes} bytes from file {FilePath} using {ConnectorType}",
                correlationId, fileContent.Length, filePath, connector.ConnectorType);

            return fileContent;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Error reading file {FilePath}",
                correlationId, filePath);
            return string.Empty;
        }
    }

    /// <summary>
    /// Reads file content as binary bytes using the appropriate connector
    /// Used for binary formats like Excel (.xlsx, .xls) that cannot be read as text
    /// Supports both direct file access and archive extraction (v0.2.0)
    /// </summary>
    private async Task<byte[]> ReadFileContentAsBytesAsync(
        DataProcessingDataSource datasource,
        string filePath,
        string correlationId,
        FileDiscoveredEvent? message = null)
    {
        try
        {
            // Check if this file is from an archive (v0.2.0)
            if (message?.IsFromArchive == true && !string.IsNullOrEmpty(message.PathInArchive))
            {
                _logger.LogDebug(
                    "[{CorrelationId}] Reading binary file from archive: {PathInArchive} (cache key: {CacheKey})",
                    correlationId, message.PathInArchive, message.ArchiveCacheKey);

                var bytes = await ExtractFileFromArchiveAsync(datasource, message, correlationId);
                _logger.LogDebug(
                    "[{CorrelationId}] Extracted {Bytes} bytes (binary) from archive for {PathInArchive}",
                    correlationId, bytes.Length, message.PathInArchive);

                return bytes;
            }

            // Standard file reading using ConnectorFactory
            var serverType = DetectServerType(datasource);
            var connector = _connectorFactory.GetConnector(serverType);

            using var stream = await connector.ReadFileAsync(datasource, filePath);
            using var memoryStream = new MemoryStream();
            await stream.CopyToAsync(memoryStream);
            var content = memoryStream.ToArray();

            _logger.LogDebug(
                "[{CorrelationId}] Read {Bytes} bytes (binary) from file {FilePath} using {ConnectorType}",
                correlationId, content.Length, filePath, connector.ConnectorType);

            return content;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Error reading binary file {FilePath}",
                correlationId, filePath);
            return Array.Empty<byte>();
        }
    }

    /// <summary>
    /// Extracts a file from a cached archive
    /// First attempts to retrieve from Hazelcast cache, then re-downloads if needed (v0.2.0)
    /// </summary>
    private async Task<byte[]> ExtractFileFromArchiveAsync(
        DataProcessingDataSource datasource,
        FileDiscoveredEvent message,
        string correlationId)
    {
        byte[]? archiveContent = null;

        // Step 1: Try to get archive from cache
        if (!string.IsNullOrEmpty(message.ArchiveCacheKey))
        {
            archiveContent = await _archiveCacheService.GetArchiveAsync(message.ArchiveCacheKey);
            if (archiveContent != null)
            {
                _logger.LogDebug(
                    "[{CorrelationId}] Retrieved archive from cache: {CacheKey} ({Bytes} bytes)",
                    correlationId, message.ArchiveCacheKey, archiveContent.Length);
            }
        }

        // Step 2: If not in cache, re-download the archive
        if (archiveContent == null && !string.IsNullOrEmpty(message.ArchivePath))
        {
            _logger.LogInformation(
                "[{CorrelationId}] Archive not in cache, re-downloading: {ArchivePath}",
                correlationId, message.ArchivePath);

            var serverType = DetectServerType(datasource);
            var connector = _connectorFactory.GetConnector(serverType);

            using var stream = await connector.ReadFileAsync(datasource, message.ArchivePath);
            using var memoryStream = new MemoryStream();
            await stream.CopyToAsync(memoryStream);
            archiveContent = memoryStream.ToArray();

            // Cache for future extractions from same archive
            if (archiveContent.Length > 0 && !string.IsNullOrEmpty(message.ArchiveCacheKey))
            {
                await _archiveCacheService.CacheArchiveAsync(message.ArchiveCacheKey, archiveContent);
                _logger.LogDebug(
                    "[{CorrelationId}] Re-cached archive: {CacheKey} ({Bytes} bytes)",
                    correlationId, message.ArchiveCacheKey, archiveContent.Length);
            }
        }

        if (archiveContent == null || archiveContent.Length == 0)
        {
            _logger.LogError(
                "[{CorrelationId}] Failed to retrieve archive content for extraction",
                correlationId);
            return Array.Empty<byte>();
        }

        // Step 3: Extract the specific file from the archive
        try
        {
            var archiveSettings = datasource.ArchiveSettings;
            var securitySettings = archiveSettings?.SecuritySettings ?? ArchiveSecuritySettings.Default;
            var password = archiveSettings?.ArchivePassword;

            var extractedContent = await _archiveService.ExtractFileAsync(
                archiveContent,
                message.PathInArchive!,
                archiveType: null, // Auto-detect
                password: password,
                settings: securitySettings);

            _logger.LogInformation(
                "[{CorrelationId}] Successfully extracted {PathInArchive} ({Bytes} bytes) from archive",
                correlationId, message.PathInArchive, extractedContent.Length);

            return extractedContent;
        }
        catch (ArchiveEntryNotFoundException ex)
        {
            _logger.LogError(
                "[{CorrelationId}] Entry not found in archive: {EntryPath}",
                correlationId, ex.EntryPath);
            return Array.Empty<byte>();
        }
        catch (ArchiveSecurityException ex)
        {
            _logger.LogError(
                "[{CorrelationId}] Archive security violation during extraction: {ViolationType} - {Message}",
                correlationId, ex.ViolationType, ex.Message);
            return Array.Empty<byte>();
        }
        catch (ArchiveException ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Error extracting file from archive: {PathInArchive}",
                correlationId, message.PathInArchive);
            return Array.Empty<byte>();
        }
    }

    /// <summary>
    /// Detects server type from datasource configuration (v0.2.0)
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

    /// <summary>
    /// Converts file content to JSON using appropriate format converter (text-based files)
    /// </summary>
    private async Task<(string jsonContent, string originalFormat, Dictionary<string, object> metadata)> ConvertToJsonAsync(
        string fileContent,
        string fileName,
        string correlationId)
    {
        // Convert text content to bytes for the stream-based converter
        var contentBytes = System.Text.Encoding.UTF8.GetBytes(fileContent);
        return await ConvertToJsonFromBytesAsync(contentBytes, fileName, correlationId);
    }

    /// <summary>
    /// Converts binary file content to JSON using appropriate format converter
    /// Used for binary formats like Excel that must preserve exact byte representation
    /// </summary>
    private async Task<(string jsonContent, string originalFormat, Dictionary<string, object> metadata)> ConvertToJsonFromBytesAsync(
        byte[] contentBytes,
        string fileName,
        string correlationId)
    {
        using var scope = _scopeFactory.CreateScope();

        try
        {
            // Detect format from file extension
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            var originalFormat = extension switch
            {
                ".csv" => "csv",
                ".xml" => "xml",
                ".xlsx" or ".xls" => "excel",
                ".json" => "json",
                _ => "unknown"
            };

            IFormatConverter? converter = extension switch
            {
                ".csv" => scope.ServiceProvider.GetRequiredService<CsvToJsonConverter>(),
                ".xml" => scope.ServiceProvider.GetRequiredService<XmlToJsonConverter>(),
                ".xlsx" or ".xls" => scope.ServiceProvider.GetRequiredService<ExcelToJsonConverter>(),
                ".json" => scope.ServiceProvider.GetRequiredService<JsonToJsonConverter>(),
                _ => null
            };

            if (converter == null)
            {
                _logger.LogWarning(
                    "[{CorrelationId}] Unsupported file format: {Extension}",
                    correlationId, extension);
                return (string.Empty, originalFormat, new Dictionary<string, object>());
            }

            // Convert content to JSON using the binary bytes directly
            using (var stream = new MemoryStream(contentBytes))
            {
                var jsonContent = await converter.ConvertToJsonAsync(stream);

                // Extract metadata using a fresh stream (converter may have disposed the first one)
                using var metadataStream = new MemoryStream(contentBytes);
                var metadata = await converter.ExtractMetadataAsync(metadataStream);

                _logger.LogDebug(
                    "[{CorrelationId}] Converted {Format} file to JSON ({JsonLength} characters)",
                    correlationId, originalFormat, jsonContent.Length);

                return (jsonContent, originalFormat, metadata);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Error converting file {FileName} to JSON",
                correlationId, fileName);
            return (string.Empty, "unknown", new Dictionary<string, object>());
        }
    }

    /// <summary>
    /// Stores JSON content in Hazelcast with TTL
    /// </summary>
    private async Task<string> StoreInHazelcastAsync(
        string jsonContent,
        string correlationId)
    {
        try
        {
            var cacheKey = $"file:{Guid.NewGuid()}";
            var ttlHours = _configuration.GetValue("Hazelcast:CacheTTLHours", 1);
            
            var fileContentMap = await _hazelcastClient.GetMapAsync<string, string>("file-content");
            await fileContentMap.SetAsync(cacheKey, jsonContent, TimeSpan.FromHours(ttlHours));

            _logger.LogDebug(
                "[{CorrelationId}] Stored {Bytes} bytes in Hazelcast with key {CacheKey} (TTL: {TTLHours}h)",
                correlationId, jsonContent.Length, cacheKey, ttlHours);

            return cacheKey;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[{CorrelationId}] Error storing content in Hazelcast",
                correlationId);
            throw;
        }
    }

    /// <summary>
    /// Publishes ValidationRequestEvent for the ValidationService
    /// </summary>
    private async Task PublishValidationRequestAsync(
        DataProcessingDataSource datasource,
        FileDiscoveredEvent fileEvent,
        string hazelcastKey,
        string originalFormat,
        Dictionary<string, object> metadata)
    {
        var validationEvent = new ValidationRequestEvent
        {
            CorrelationId = fileEvent.CorrelationId,
            PublishedBy = "FileProcessorService",
            DataSourceId = datasource.ID!,
            FileName = fileEvent.FileName,
            HazelcastKey = hazelcastKey,
            OriginalFormat = originalFormat,
            FormatMetadata = metadata
        };

        await _publishEndpoint.Publish(validationEvent);

        _logger.LogDebug(
            "[{CorrelationId}] Published ValidationRequestEvent with Hazelcast key {HazelcastKey}",
            fileEvent.CorrelationId, hazelcastKey);
    }
}

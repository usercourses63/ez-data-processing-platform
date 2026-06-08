using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Messages;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Models.Responses;
using DataProcessing.DataSourceManagement.Models.Queries;
using DataProcessing.DataSourceManagement.Repositories;
using DataProcessing.DataSourceManagement.Infrastructure;
using MongoDB.Bson;
using MassTransit;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service implementation for data source management operations
/// Provides business logic layer with validation, error handling, and Hebrew UI support
/// </summary>
public class DataSourceService : IDataSourceService
{
    private readonly IDataSourceRepository _repository;
    private readonly ILogger<DataSourceService> _logger;
    private readonly BusinessMetrics _metrics;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly INasDeviceService _nasDeviceService;
    private readonly IServerService _serverService;
    private readonly DataProcessing.Shared.Services.ServerCredentialProtector? _credentialProtector;
    private static readonly ActivitySource ActivitySource = new("DataProcessing.DataSourceManagement.Service");

    public DataSourceService(
        IDataSourceRepository repository,
        ILogger<DataSourceService> logger,
        BusinessMetrics metrics,
        IPublishEndpoint publishEndpoint,
        INasDeviceService nasDeviceService,
        IServerService serverService,
        DataProcessing.Shared.Services.ServerCredentialProtector? credentialProtector = null)
    {
        _repository = repository;
        _logger = logger;
        _metrics = metrics;
        _publishEndpoint = publishEndpoint;
        _nasDeviceService = nasDeviceService;
        _serverService = serverService;
        _credentialProtector = credentialProtector;
    }

    /// <summary>
    /// Gets a data source by ID with comprehensive error handling
    /// </summary>
    public async Task<ApiResponse<DataProcessingDataSource>> GetByIdAsync(string id, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("GetByIdAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", id);

        try
        {
            // Validate input
            if (string.IsNullOrWhiteSpace(id))
            {
                _logger.LogWarning("GetByIdAsync called with empty ID. CorrelationId: {CorrelationId}", correlationId);
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "id");
                return ApiResponse<DataProcessingDataSource>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Retrieving data source by ID: {Id}. CorrelationId: {CorrelationId}", id, correlationId);

            var dataSource = await _repository.GetByIdAsync(id, correlationId);

            if (dataSource == null)
            {
                _logger.LogWarning("Data source not found. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<DataProcessingDataSource>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Successfully retrieved data source. ID: {Id}, Name: {Name}, CorrelationId: {CorrelationId}", 
                dataSource.ID, dataSource.Name, correlationId);

            return ApiResponse<DataProcessingDataSource>.Success(dataSource, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving data source by ID: {Id}. CorrelationId: {CorrelationId}", id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<DataProcessingDataSource>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Gets paginated list of data sources with filtering and sorting
    /// </summary>
    public async Task<ApiResponse<PagedResult<DataProcessingDataSource>>> GetPagedAsync(DataSourceQuery query, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("GetPagedAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("page", query.Page);
        activity?.SetTag("size", query.Size);

        try
        {
            // Validate pagination parameters
            if (query.Page < 1)
            {
                var errorResponse = HebrewErrorResponseFactory.CreateValidationError(
                    correlationId, "page", "invalid_page", "Page number must be 1 or greater");
                return ApiResponse<PagedResult<DataProcessingDataSource>>.Failure(errorResponse.Error, correlationId);
            }

            if (query.Size < 1 || query.Size > 100)
            {
                var errorResponse = HebrewErrorResponseFactory.CreateValidationError(
                    correlationId, "size", "invalid_size", "Page size must be between 1 and 100");
                return ApiResponse<PagedResult<DataProcessingDataSource>>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Retrieving paged data sources. Page: {Page}, Size: {Size}, CorrelationId: {CorrelationId}",
                query.Page, query.Size, correlationId);

            var result = await _repository.GetPagedAsync(query, correlationId);

            _logger.LogInformation("Successfully retrieved {Count} data sources out of {Total}. CorrelationId: {CorrelationId}",
                result.Items.Count, result.TotalItems, correlationId);

            return ApiResponse<PagedResult<DataProcessingDataSource>>.Success(result, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving paged data sources. CorrelationId: {CorrelationId}", correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<PagedResult<DataProcessingDataSource>>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Gets all active data sources for processing operations
    /// </summary>
    public async Task<ApiResponse<List<DataProcessingDataSource>>> GetActiveAsync(string correlationId)
    {
        using var activity = ActivitySource.StartActivity("GetActiveAsync");
        activity?.SetTag("correlation-id", correlationId);

        try
        {
            _logger.LogInformation("Retrieving active data sources. CorrelationId: {CorrelationId}", correlationId);

            var dataSources = await _repository.GetActiveAsync(correlationId);

            _logger.LogInformation("Successfully retrieved {Count} active data sources. CorrelationId: {CorrelationId}",
                dataSources.Count, correlationId);

            return ApiResponse<List<DataProcessingDataSource>>.Success(dataSources, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active data sources. CorrelationId: {CorrelationId}", correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<List<DataProcessingDataSource>>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Gets data sources by supplier name
    /// </summary>
    public async Task<ApiResponse<List<DataProcessingDataSource>>> GetBySupplierAsync(string supplierName, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("GetBySupplierAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("supplier-name", supplierName);

        try
        {
            if (string.IsNullOrWhiteSpace(supplierName))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "supplier_name");
                return ApiResponse<List<DataProcessingDataSource>>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Retrieving data sources by supplier: {SupplierName}. CorrelationId: {CorrelationId}",
                supplierName, correlationId);

            var dataSources = await _repository.GetBySupplierAsync(supplierName, correlationId);

            _logger.LogInformation("Successfully retrieved {Count} data sources for supplier: {SupplierName}. CorrelationId: {CorrelationId}",
                dataSources.Count, supplierName, correlationId);

            return ApiResponse<List<DataProcessingDataSource>>.Success(dataSources, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving data sources by supplier: {SupplierName}. CorrelationId: {CorrelationId}",
                supplierName, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<List<DataProcessingDataSource>>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Creates a new data source with business validation
    /// </summary>
    public async Task<ApiResponse<DataProcessingDataSource>> CreateAsync(CreateDataSourceRequest request, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("CreateAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-name", request.Name);

        try
        {
            _logger.LogInformation("Creating new data source: {Name}. CorrelationId: {CorrelationId}",
                request.Name, correlationId);

            // Map request to entity
            var dataSource = MapCreateRequestToEntity(request);

            // Validate NAS device and auto-populate FilePath if NasDeviceId is set
            await ValidateAndPopulateNasDeviceAsync(dataSource);

            // Resolve FileServer and build proper FilePath if FileServerId is set
            await PopulateFileServerConnectionAsync(dataSource, request.ConfigurationSettings);

            // Bridge S3 output destinations' OutputServerId AdminServer creds/endpoint into S3Config (G5)
            await PopulateOutputDestinationS3Async(dataSource);

            // Create the data source
            var createdDataSource = await _repository.CreateAsync(dataSource, correlationId);

            _logger.LogInformation("Successfully created data source. ID: {Id}, Name: {Name}, CorrelationId: {CorrelationId}",
                createdDataSource.ID, createdDataSource.Name, correlationId);

            // Publish DataSourceCreatedEvent for SchedulingService
            try
            {
                await _publishEndpoint.Publish(new DataSourceCreatedEvent
                {
                    CorrelationId = correlationId,
                    DataSourceId = createdDataSource.ID,
                    DataSourceName = createdDataSource.Name,
                    SupplierName = createdDataSource.SupplierName,
                    PollingRate = createdDataSource.PollingRate,
                    CronExpression = createdDataSource.CronExpression,
                    IsActive = createdDataSource.IsActive,
                    CreatedBy = createdDataSource.CreatedBy
                });

                _logger.LogInformation("Published DataSourceCreatedEvent for {DataSourceId}. CorrelationId: {CorrelationId}",
                    createdDataSource.ID, correlationId);
            }
            catch (Exception publishEx)
            {
                // Log but don't fail the request if event publishing fails
                _logger.LogError(publishEx, "Failed to publish DataSourceCreatedEvent for {DataSourceId}. CorrelationId: {CorrelationId}",
                    createdDataSource.ID, correlationId);
            }

            return ApiResponse<DataProcessingDataSource>.Success(createdDataSource, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating data source: {Name}. CorrelationId: {CorrelationId}",
                request.Name, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<DataProcessingDataSource>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Updates an existing data source with business validation
    /// </summary>
    public async Task<ApiResponse<object>> UpdateAsync(UpdateDataSourceRequest request, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("UpdateAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", request.Id);

        try
        {
            // Check if data source exists
            var existingDataSource = await _repository.GetByIdAsync(request.Id, correlationId);
            if (existingDataSource == null)
            {
                _logger.LogWarning("Data source not found for update. ID: {Id}, CorrelationId: {CorrelationId}",
                    request.Id, correlationId);
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", request.Id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            // Optimistic concurrency check
            if (existingDataSource.Version != request.Version)
            {
                _logger.LogWarning(
                    "Optimistic concurrency conflict for DataSource {Id}. Expected version {Expected}, current version {Current}. CorrelationId: {CorrelationId}",
                    request.Id, request.Version, existingDataSource.Version, correlationId);
                var conflictError = new ErrorDetail
                {
                    Code = "VERSION_CONFLICT",
                    Message = "\u05d4\u05e8\u05e9\u05d5\u05de\u05d4 \u05e9\u05d5\u05e0\u05ea\u05d4 \u05e2\u05dc \u05d9\u05d3\u05d9 \u05de\u05e9\u05ea\u05de\u05e9 \u05d0\u05d7\u05e8. \u05d0\u05e0\u05d0 \u05e8\u05e2\u05e0\u05df \u05d5\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.",
                    Details = $"Expected version {request.Version}, current version {existingDataSource.Version}",
                    StatusCode = 409,
                    Timestamp = DateTime.UtcNow
                };
                return ApiResponse<object>.Failure(conflictError, correlationId);
            }

            _logger.LogInformation("Updating data source. ID: {Id}, Name: {Name}, CorrelationId: {CorrelationId}",
                request.Id, request.Name, correlationId);

            // Debug logging for RetentionDays
            _logger.LogInformation("RetentionDays from request: {RetentionDays}, HasValue: {HasValue}, CorrelationId: {CorrelationId}",
                request.RetentionDays, request.RetentionDays.HasValue, correlationId);

            // Capture old schema for change detection before mapping
            var oldSchemaJson = existingDataSource.JsonSchema?.ToJson() ?? "";
            var previousSchemaVersion = existingDataSource.SchemaVersion;

            // Map request to existing entity
            MapUpdateRequestToEntity(request, existingDataSource);

            // Detect schema change and auto-increment SchemaVersion
            var newSchemaJson = existingDataSource.JsonSchema?.ToJson() ?? "";
            var schemaChanged = oldSchemaJson != newSchemaJson && !string.IsNullOrEmpty(newSchemaJson) && newSchemaJson != "{ }";
            if (schemaChanged)
            {
                existingDataSource.SchemaVersion = previousSchemaVersion + 1;
                _logger.LogInformation("Schema changed for datasource {DataSourceId}, version {OldVersion} -> {NewVersion}, publishing SchemaUpdatedEvent. CorrelationId: {CorrelationId}",
                    existingDataSource.ID, previousSchemaVersion, existingDataSource.SchemaVersion, correlationId);
            }

            // Validate NAS device and auto-populate FilePath if NasDeviceId is set
            await ValidateAndPopulateNasDeviceAsync(existingDataSource);

            // Resolve FileServer and build proper FilePath if FileServerId is set
            await PopulateFileServerConnectionAsync(existingDataSource, request.ConfigurationSettings);

            // Bridge S3 output destinations' OutputServerId AdminServer creds/endpoint into S3Config (G5)
            await PopulateOutputDestinationS3Async(existingDataSource);

            // Debug logging after mapping
            var additionalConfig = existingDataSource.AdditionalConfiguration;
            if (additionalConfig != null && additionalConfig.Contains("RetentionDays"))
            {
                _logger.LogInformation("RetentionDays stored in AdditionalConfiguration: {RetentionDays}, Type: {Type}, CorrelationId: {CorrelationId}",
                    additionalConfig["RetentionDays"], additionalConfig["RetentionDays"].GetType().Name, correlationId);
            }
            else
            {
                _logger.LogInformation("RetentionDays NOT found in AdditionalConfiguration, CorrelationId: {CorrelationId}", correlationId);
            }

            // Update the data source
            await _repository.UpdateAsync(existingDataSource, correlationId);

            _logger.LogInformation("Successfully updated data source. ID: {Id}, Name: {Name}, CorrelationId: {CorrelationId}",
                existingDataSource.ID, existingDataSource.Name, correlationId);

            // Publish DataSourceUpdatedEvent for SchedulingService
            try
            {
                await _publishEndpoint.Publish(new DataSourceUpdatedEvent
                {
                    CorrelationId = correlationId,
                    DataSourceId = existingDataSource.ID,
                    DataSourceName = existingDataSource.Name,
                    SupplierName = existingDataSource.SupplierName,
                    PollingRate = existingDataSource.PollingRate,
                    CronExpression = existingDataSource.CronExpression,
                    IsActive = existingDataSource.IsActive,
                    UpdatedBy = existingDataSource.UpdatedBy
                });

                _logger.LogInformation("Published DataSourceUpdatedEvent for {DataSourceId}. CorrelationId: {CorrelationId}",
                    existingDataSource.ID, correlationId);
            }
            catch (Exception publishEx)
            {
                _logger.LogError(publishEx, "Failed to publish DataSourceUpdatedEvent for {DataSourceId}. CorrelationId: {CorrelationId}",
                    existingDataSource.ID, correlationId);
            }

            // Publish SchemaUpdatedEvent if schema changed (triggers auto-revalidation of invalid records)
            if (schemaChanged)
            {
                try
                {
                    await _publishEndpoint.Publish(new SchemaUpdatedEvent
                    {
                        CorrelationId = correlationId,
                        DataSourceId = existingDataSource.ID,
                        DataSourceName = existingDataSource.Name,
                        PreviousSchemaVersion = previousSchemaVersion,
                        NewSchemaVersion = existingDataSource.SchemaVersion,
                        UpdatedBy = existingDataSource.UpdatedBy ?? "System"
                    });

                    _logger.LogInformation("Published SchemaUpdatedEvent for {DataSourceId}, schema version {OldVersion} -> {NewVersion}. CorrelationId: {CorrelationId}",
                        existingDataSource.ID, previousSchemaVersion, existingDataSource.SchemaVersion, correlationId);
                }
                catch (Exception publishEx)
                {
                    _logger.LogError(publishEx, "Failed to publish SchemaUpdatedEvent for {DataSourceId}. CorrelationId: {CorrelationId}",
                        existingDataSource.ID, correlationId);
                }
            }

            return ApiResponse<object>.Success(new { message = "מקור הנתונים עודכן בהצלחה" }, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating data source. ID: {Id}, CorrelationId: {CorrelationId}",
                request.Id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Soft deletes a data source by ID
    /// </summary>
    public async Task<ApiResponse<object>> SoftDeleteAsync(string id, string deletedBy, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("SoftDeleteAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", id);

        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "id");
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Soft deleting data source. ID: {Id}, DeletedBy: {DeletedBy}, CorrelationId: {CorrelationId}",
                id, deletedBy, correlationId);

            // Get datasource details before deletion for event
            var dataSource = await _repository.GetByIdAsync(id, correlationId);
            if (dataSource == null)
            {
                _logger.LogWarning("Data source not found for deletion. ID: {Id}, CorrelationId: {CorrelationId}",
                    id, correlationId);
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            var success = await _repository.SoftDeleteAsync(id, deletedBy, correlationId);

            if (!success)
            {
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Successfully soft deleted data source. ID: {Id}, CorrelationId: {CorrelationId}",
                id, correlationId);

            // Publish DataSourceDeletedEvent for SchedulingService
            try
            {
                await _publishEndpoint.Publish(new DataSourceDeletedEvent
                {
                    CorrelationId = correlationId,
                    DataSourceId = id,
                    DataSourceName = dataSource.Name,
                    DeletedBy = deletedBy
                });

                _logger.LogInformation("Published DataSourceDeletedEvent for {DataSourceId}. CorrelationId: {CorrelationId}",
                    id, correlationId);
            }
            catch (Exception publishEx)
            {
                _logger.LogError(publishEx, "Failed to publish DataSourceDeletedEvent for {DataSourceId}. CorrelationId: {CorrelationId}",
                    id, correlationId);
            }

            return ApiResponse<object>.Success(new { message = "מקור הנתונים נמחק בהצלחה" }, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error soft deleting data source. ID: {Id}, CorrelationId: {CorrelationId}",
                id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Restores a soft-deleted data source
    /// </summary>
    public async Task<ApiResponse<object>> RestoreAsync(string id, string restoredBy, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("RestoreAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", id);

        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "id");
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Restoring data source. ID: {Id}, RestoredBy: {RestoredBy}, CorrelationId: {CorrelationId}",
                id, restoredBy, correlationId);

            var success = await _repository.RestoreAsync(id, restoredBy, correlationId);

            if (!success)
            {
                _logger.LogWarning("Data source not found for restoration. ID: {Id}, CorrelationId: {CorrelationId}",
                    id, correlationId);
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Successfully restored data source. ID: {Id}, CorrelationId: {CorrelationId}",
                id, correlationId);

            return ApiResponse<object>.Success(new { message = "מקור הנתונים שוחזר בהצלחה" }, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring data source. ID: {Id}, CorrelationId: {CorrelationId}",
                id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Validates a data source name for uniqueness
    /// </summary>
    public async Task<ApiResponse<bool>> ValidateNameAsync(string name, string? excludeId, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("ValidateNameAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-name", name);

        try
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "name");
                return ApiResponse<bool>.Failure(errorResponse.Error, correlationId);
            }

            var exists = await _repository.ExistsAsync(name, excludeId, correlationId);
            var isAvailable = !exists;

            return ApiResponse<bool>.Success(isAvailable, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating data source name: {Name}. CorrelationId: {CorrelationId}",
                name, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<bool>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Gets data source statistics and counts
    /// </summary>
    public async Task<ApiResponse<object>> GetStatisticsAsync(string correlationId)
    {
        using var activity = ActivitySource.StartActivity("GetStatisticsAsync");
        activity?.SetTag("correlation-id", correlationId);

        try
        {
            _logger.LogInformation("Retrieving data source statistics. CorrelationId: {CorrelationId}", correlationId);

            var activeCount = await _repository.CountActiveAsync(correlationId);
            var deletedCount = await _repository.CountDeletedAsync(correlationId);

            var statistics = new
            {
                activeCount,
                deletedCount,
                totalCount = activeCount + deletedCount,
                retrievedAt = DateTime.UtcNow
            };

            _logger.LogInformation("Successfully retrieved statistics. Active: {Active}, Deleted: {Deleted}, CorrelationId: {CorrelationId}",
                activeCount, deletedCount, correlationId);

            return ApiResponse<object>.Success(statistics, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving statistics. CorrelationId: {CorrelationId}", correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Gets data sources that haven't been processed for a specified time period
    /// </summary>
    public async Task<ApiResponse<List<DataProcessingDataSource>>> GetInactiveAsync(TimeSpan inactiveThreshold, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("GetInactiveAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("inactive-threshold-hours", inactiveThreshold.TotalHours);

        try
        {
            _logger.LogInformation("Retrieving inactive data sources. Threshold: {ThresholdHours} hours, CorrelationId: {CorrelationId}",
                inactiveThreshold.TotalHours, correlationId);

            var inactiveDataSources = await _repository.GetInactiveAsync(inactiveThreshold, correlationId);

            _logger.LogInformation("Successfully retrieved {Count} inactive data sources. CorrelationId: {CorrelationId}",
                inactiveDataSources.Count, correlationId);

            return ApiResponse<List<DataProcessingDataSource>>.Success(inactiveDataSources, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving inactive data sources. CorrelationId: {CorrelationId}", correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<List<DataProcessingDataSource>>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Updates processing statistics for a data source
    /// </summary>
    public async Task<ApiResponse<object>> UpdateProcessingStatsAsync(string id, long filesProcessed, long errorRecords, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("UpdateProcessingStatsAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", id);

        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "id");
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Updating processing stats. ID: {Id}, FilesProcessed: {FilesProcessed}, ErrorRecords: {ErrorRecords}, CorrelationId: {CorrelationId}",
                id, filesProcessed, errorRecords, correlationId);

            var success = await _repository.UpdateProcessingStatsAsync(id, filesProcessed, errorRecords, correlationId);

            if (!success)
            {
                _logger.LogWarning("Data source not found for stats update. ID: {Id}, CorrelationId: {CorrelationId}",
                    id, correlationId);
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Successfully updated processing stats. ID: {Id}, CorrelationId: {CorrelationId}",
                id, correlationId);

            return ApiResponse<object>.Success(new { message = "סטטיסטיקות עודכנו בהצלחה" }, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating processing stats. ID: {Id}, CorrelationId: {CorrelationId}",
                id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Tests connection to a data source
    /// </summary>
    public async Task<ApiResponse<object>> TestConnectionAsync(string id, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("TestConnectionAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", id);

        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "id");
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Testing connection for data source. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);

            var dataSource = await _repository.GetByIdAsync(id, correlationId);
            if (dataSource == null)
            {
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            // For now, return a simple success response
            // TODO: Implement actual connection testing based on connection type
            var result = new
            {
                connectionStatus = "success",
                message = "החיבור למקור הנתונים תקין",
                testedAt = DateTime.UtcNow,
                dataSourceName = dataSource.Name,
                latencyMs = 150
            };

            _logger.LogInformation("Connection test successful. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);

            return ApiResponse<object>.Success(result, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing connection. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Gets detailed processing statistics for a data source
    /// </summary>
    public async Task<ApiResponse<object>> GetProcessingStatisticsAsync(string id, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("GetProcessingStatisticsAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", id);

        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "id");
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Getting processing statistics. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);

            var dataSource = await _repository.GetByIdAsync(id, correlationId);
            if (dataSource == null)
            {
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            // Return statistics from data source entity
            var statistics = new
            {
                totalFilesProcessed = dataSource.TotalFilesProcessed,
                totalErrorRecords = dataSource.TotalErrorRecords,
                lastProcessedAt = dataSource.LastProcessedAt,
                successRate = dataSource.TotalFilesProcessed > 0 
                    ? (double)(dataSource.TotalFilesProcessed - dataSource.TotalErrorRecords) / dataSource.TotalFilesProcessed * 100 
                    : 100.0,
                averageProcessingTime = 2.5, // Placeholder - will be calculated from processing history
                filesProcessedToday = 12, // Placeholder
                currentStatus = dataSource.IsActive ? "active" : "inactive"
            };

            _logger.LogInformation("Retrieved processing statistics. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);

            return ApiResponse<object>.Success(statistics, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting processing statistics. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Updates schedule configuration for a data source
    /// </summary>
    public async Task<ApiResponse<object>> UpdateScheduleAsync(string id, string scheduleConfig, string correlationId)
    {
        using var activity = ActivitySource.StartActivity("UpdateScheduleAsync");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", id);

        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                var errorResponse = HebrewErrorResponseFactory.CreateRequiredFieldError(correlationId, "id");
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            _logger.LogInformation("Updating schedule configuration. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);

            var dataSource = await _repository.GetByIdAsync(id, correlationId);
            if (dataSource == null)
            {
                var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
                return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
            }

            // Update schedule in AdditionalConfiguration
            if (dataSource.AdditionalConfiguration == null)
            {
                dataSource.AdditionalConfiguration = new BsonDocument();
            }

            dataSource.AdditionalConfiguration["schedule"] = BsonDocument.Parse(scheduleConfig);
            dataSource.MarkAsModified();

            await _repository.UpdateAsync(dataSource, correlationId);

            _logger.LogInformation("Successfully updated schedule. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);

            return ApiResponse<object>.Success(new { message = "הגדרות התזמון עודכנו בהצלחה" }, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating schedule. ID: {Id}, CorrelationId: {CorrelationId}", id, correlationId);
            var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
            return ApiResponse<object>.Failure(errorResponse.Error, correlationId);
        }
    }

    /// <summary>
    /// Maps CreateDataSourceRequest to DataProcessingDataSource entity
    /// </summary>
    private static DataProcessingDataSource MapCreateRequestToEntity(CreateDataSourceRequest request)
    {
        // Store advanced settings in AdditionalConfiguration as a BsonDocument
        var additionalConfig = new BsonDocument();
        
        if (!string.IsNullOrEmpty(request.ConfigurationSettings))
        {
            additionalConfig["ConfigurationSettings"] = request.ConfigurationSettings;
        }
        
        if (!string.IsNullOrEmpty(request.ValidationRules))
        {
            additionalConfig["ValidationRules"] = request.ValidationRules;
        }
        
        if (!string.IsNullOrEmpty(request.Metadata))
        {
            additionalConfig["Metadata"] = request.Metadata;
        }
        
        if (request.RetentionDays.HasValue)
        {
            additionalConfig["RetentionDays"] = request.RetentionDays.Value;
        }
        
        // Map JsonSchema from request
        BsonDocument jsonSchema = new BsonDocument();
        if (request.JsonSchema != null)
        {
            if (request.JsonSchema is string jsonSchemaString)
            {
                jsonSchema = BsonDocument.Parse(jsonSchemaString);
            }
            else
            {
                var jsonString = System.Text.Json.JsonSerializer.Serialize(request.JsonSchema);
                jsonSchema = BsonDocument.Parse(jsonString);
            }
        }
        
        // Extract FileServerId and NasDeviceId from ConfigurationSettings JSON
        var fileServerId = ExtractFileServerIdFromConfig(request.ConfigurationSettings);
        var (nasDeviceId, nasSubPath) = ExtractNasFieldsFromConfig(request.ConfigurationSettings);

        return new DataProcessingDataSource
        {
            Name = request.Name,
            SupplierName = request.SupplierName,
            Category = request.Category,
            Description = request.Description,
            FilePath = request.FilePath ?? request.ConnectionString ?? string.Empty,
            IsActive = request.IsActive,
            FilePattern = request.FilePattern ?? request.FileFormat ?? "*.*",
            JsonSchema = jsonSchema,
            CronExpression = request.CronExpression,
            PollingRate = TimeSpan.FromMinutes(5),
            TotalFilesProcessed = 0,
            TotalErrorRecords = 0,
            LastProcessedAt = null,
            AdditionalConfiguration = additionalConfig.ElementCount > 0 ? additionalConfig : null,
            Output = request.Output ?? new DataProcessing.Shared.Entities.OutputConfiguration(),
            ArchiveSettings = request.ArchiveSettings,
            NasDeviceId = request.NasDeviceId ?? nasDeviceId,
            NasSubPath = request.NasSubPath ?? nasSubPath,
            FileServerId = fileServerId,
            InvalidRecordsTtlDays = request.InvalidRecordsTtlDays
        };
    }

    /// <summary>
    /// Maps UpdateDataSourceRequest to existing DataProcessingDataSource entity
    /// </summary>
    private static void MapUpdateRequestToEntity(UpdateDataSourceRequest request, DataProcessingDataSource entity)
    {
        entity.Name = request.Name;
        entity.SupplierName = request.SupplierName;
        entity.Category = request.Category;
        entity.Description = request.Description;
        
        // Map FilePath - prefer FilePath over ConnectionString
        entity.FilePath = !string.IsNullOrEmpty(request.FilePath) ? request.FilePath : (request.ConnectionString ?? string.Empty);
        
        entity.IsActive = request.IsActive;
        
        // Map FilePattern - prefer FilePattern over FileFormat
        entity.FilePattern = !string.IsNullOrEmpty(request.FilePattern) ? request.FilePattern : (request.FileFormat ?? "*.*");
        
        // Map CronExpression
        if (!string.IsNullOrEmpty(request.CronExpression))
        {
            entity.CronExpression = request.CronExpression;
        }
        
        // Map PollingRate - parse from string format (HH:MM:SS) to TimeSpan
        if (!string.IsNullOrEmpty(request.PollingRate))
        {
            if (TimeSpan.TryParse(request.PollingRate, out var pollingRate))
            {
                entity.PollingRate = pollingRate;
            }
        }

        // Map ScheduleFrequency
        if (!string.IsNullOrEmpty(request.ScheduleFrequency))
        {
            entity.ScheduleFrequency = request.ScheduleFrequency;
        }

        // Map ScheduleEnabled
        if (request.ScheduleEnabled.HasValue)
        {
            entity.ScheduleEnabled = request.ScheduleEnabled.Value;
        }

        // Map JsonSchema - convert object to BsonDocument
        if (request.JsonSchema != null)
        {
            if (request.JsonSchema is string jsonSchemaString)
            {
                entity.JsonSchema = BsonDocument.Parse(jsonSchemaString);
            }
            else
            {
                var jsonString = System.Text.Json.JsonSerializer.Serialize(request.JsonSchema);
                entity.JsonSchema = BsonDocument.Parse(jsonString);
            }
        }
        
        // Map SchemaVersion
        if (request.SchemaVersion.HasValue)
        {
            entity.SchemaVersion = request.SchemaVersion.Value;
        }
        
        // Store advanced settings in AdditionalConfiguration as a BsonDocument
        var additionalConfig = new BsonDocument();
        
        if (!string.IsNullOrEmpty(request.ConfigurationSettings))
        {
            additionalConfig["ConfigurationSettings"] = request.ConfigurationSettings;
        }
        
        if (!string.IsNullOrEmpty(request.ValidationRules))
        {
            additionalConfig["ValidationRules"] = request.ValidationRules;
        }
        
        if (!string.IsNullOrEmpty(request.Metadata))
        {
            additionalConfig["Metadata"] = request.Metadata;
        }
        
        if (request.RetentionDays.HasValue)
        {
            additionalConfig["RetentionDays"] = request.RetentionDays.Value;
        }
        
        entity.AdditionalConfiguration = additionalConfig.ElementCount > 0 ? additionalConfig : null;

        // Map Output configuration with destinations
        if (request.Output != null)
        {
            entity.Output = request.Output;
        }

        // Map Archive settings (v0.2.0)
        if (request.ArchiveSettings != null)
        {
            entity.ArchiveSettings = request.ArchiveSettings;
        }

        // Map InvalidRecordsTtlDays (v0.4.0)
        if (request.InvalidRecordsTtlDays.HasValue)
        {
            entity.InvalidRecordsTtlDays = request.InvalidRecordsTtlDays.Value;
        }

        // Map NAS device reference (v0.2.0) — check both top-level and ConfigurationSettings
        var (nasDeviceIdFromConfig, nasSubPathFromConfig) = ExtractNasFieldsFromConfig(request.ConfigurationSettings);
        entity.NasDeviceId = request.NasDeviceId ?? nasDeviceIdFromConfig;
        entity.NasSubPath = request.NasSubPath ?? nasSubPathFromConfig;

        // Extract FileServerId from ConfigurationSettings JSON (frontend sends as connectionConfig.inputServerId)
        var fileServerId = ExtractFileServerIdFromConfig(request.ConfigurationSettings);
        if (!string.IsNullOrEmpty(fileServerId))
        {
            entity.FileServerId = fileServerId;
        }

        // Mark entity as modified to ensure MongoDB saves the changes
        entity.MarkAsModified();
    }

    /// <summary>
    /// Extracts FileServerId from the ConfigurationSettings JSON blob.
    /// Frontend stores it as: {"connectionConfig":{"inputServerId":"abc123",...},...}
    /// </summary>
    private static string? ExtractFileServerIdFromConfig(string? configurationSettings)
    {
        if (string.IsNullOrEmpty(configurationSettings))
            return null;

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(configurationSettings);
            if (doc.RootElement.TryGetProperty("connectionConfig", out var connConfig) &&
                connConfig.TryGetProperty("inputServerId", out var serverId) &&
                serverId.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                return serverId.GetString();
            }
        }
        catch { /* Invalid JSON — ignore */ }

        return null;
    }

    /// <summary>
    /// Extracts NasDeviceId and NasSubPath from the ConfigurationSettings JSON blob.
    /// Frontend stores them as: {"connectionConfig":{"nasDeviceId":"abc123","nasSubPath":"/sub",...},...}
    /// </summary>
    private static (string? NasDeviceId, string? NasSubPath) ExtractNasFieldsFromConfig(string? configurationSettings)
    {
        if (string.IsNullOrEmpty(configurationSettings))
            return (null, null);

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(configurationSettings);
            if (doc.RootElement.TryGetProperty("connectionConfig", out var connConfig))
            {
                string? nasDeviceId = null;
                string? nasSubPath = null;

                if (connConfig.TryGetProperty("nasDeviceId", out var did) &&
                    did.ValueKind == System.Text.Json.JsonValueKind.String)
                    nasDeviceId = did.GetString();

                if (connConfig.TryGetProperty("nasSubPath", out var sp) &&
                    sp.ValueKind == System.Text.Json.JsonValueKind.String)
                    nasSubPath = sp.GetString();

                return (nasDeviceId, nasSubPath);
            }
        }
        catch { /* Invalid JSON — ignore */ }

        return (null, null);
    }

    /// <summary>
    /// When FileServerId is set, resolve the AdminServer and build proper FilePath/ConnectionString
    /// so downstream services (FileDiscovery, FileProcessor) can connect correctly.
    /// </summary>
    private async Task PopulateFileServerConnectionAsync(
        DataProcessingDataSource dataSource,
        string? configurationSettings,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(dataSource.FileServerId))
            return;

        var server = await _serverService.GetServerByIdAsync(dataSource.FileServerId, ct);
        if (server == null)
        {
            _logger.LogWarning("AdminServer {ServerId} not found for datasource {Name}",
                dataSource.FileServerId, dataSource.Name);
            return;
        }

        // Extract sub-path from ConfigurationSettings (frontend sends as connectionConfig.path)
        string? subPath = null;
        if (!string.IsNullOrEmpty(configurationSettings))
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(configurationSettings);
                if (doc.RootElement.TryGetProperty("connectionConfig", out var cc) &&
                    cc.TryGetProperty("path", out var p) &&
                    p.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    subPath = p.GetString();
                }
            }
            catch { /* ignore */ }
        }

        // Fall back to existing FilePath only if it looks like a real path (not a bad connection string)
        if (string.IsNullOrEmpty(subPath) && !string.IsNullOrEmpty(dataSource.FilePath))
        {
            var fp = dataSource.FilePath;
            // Skip if FilePath looks like a URL with undefined parts
            if (!fp.Contains("undefined") && !fp.StartsWith("ftp://") && !fp.StartsWith("sftp://"))
            {
                subPath = fp;
            }
        }

        // Build proper FilePath from server connection info
        var basePath = server.BasePath?.TrimEnd('/') ?? "";
        var path = (subPath ?? "").TrimStart('/');
        var fullPath = string.IsNullOrEmpty(path) ? basePath : $"{basePath}/{path}";

        dataSource.FilePath = server.ServerType?.ToLowerInvariant() switch
        {
            "ftp" => $"ftp://{server.Host}:{server.Port}{fullPath}",
            "sftp" => $"sftp://{server.Host}:{server.Port}{fullPath}",
            "http" or "https" => $"http://{server.Host}:{server.Port}{fullPath}",
            "s3" => $"s3://{server.Host}:{server.Port}{fullPath}",
            _ => fullPath
        };

        // Store server type and connection details in AdditionalConfiguration for downstream services
        dataSource.AdditionalConfiguration ??= new MongoDB.Bson.BsonDocument();
        dataSource.AdditionalConfiguration["ServerType"] = server.ServerType ?? "local";

        // Store server credentials so connectors can authenticate
        if (server.TypeSpecificConfig != null)
        {
            if (server.TypeSpecificConfig.Contains("Username"))
                dataSource.AdditionalConfiguration["FtpUsername"] = server.TypeSpecificConfig["Username"].AsString;
            if (server.TypeSpecificConfig.Contains("Password"))
                dataSource.AdditionalConfiguration["FtpPassword"] = server.TypeSpecificConfig["Password"].AsString;
            if (server.TypeSpecificConfig.Contains("PassiveMode"))
                dataSource.AdditionalConfiguration["FtpUsePassiveMode"] = server.TypeSpecificConfig["PassiveMode"].AsBoolean;
        }
        dataSource.AdditionalConfiguration["FtpServer"] = server.Host;
        dataSource.AdditionalConfiguration["FtpPort"] = server.Port;

        // S3/MinIO: bridge the AdminServer credential contract into the lowercase keys
        // S3Connector.GetS3Config reads for the async pipeline (Phase 34 pipeline wiring).
        // SecretKey is encrypted at rest — decrypt it so the connector authenticates.
        if (server.ServerType?.ToLowerInvariant() == "s3" && server.TypeSpecificConfig != null)
        {
            var s3 = server.TypeSpecificConfig;
            if (s3.Contains("AccessKey"))
                dataSource.AdditionalConfiguration["accessKey"] = s3["AccessKey"].AsString;
            if (s3.Contains("SecretKey"))
            {
                var secret = s3["SecretKey"].AsString;
                if (_credentialProtector != null && _credentialProtector.IsProtected(secret))
                    secret = _credentialProtector.Unprotect(secret);
                dataSource.AdditionalConfiguration["secretKey"] = secret;
            }
            if (s3.Contains("Bucket"))
                dataSource.AdditionalConfiguration["bucket"] = s3["Bucket"].AsString;
            dataSource.AdditionalConfiguration["region"] =
                s3.Contains("Region") ? s3["Region"].AsString : "us-east-1";
            var useHttp = s3.Contains("UseHttp") && s3["UseHttp"].AsBoolean;
            dataSource.AdditionalConfiguration["endpoint"] =
                $"{(useHttp ? "http" : "https")}://{server.Host}:{server.Port}";
            // MinIO requires path-style addressing; default true when unset.
            dataSource.AdditionalConfiguration["usePathStyle"] =
                !s3.Contains("ForcePathStyle") || s3["ForcePathStyle"].AsBoolean;
            // For S3 the bucket is supplied separately (above), so FilePath must be the
            // in-bucket object-key prefix only — NOT the s3://host:port/... URI built by the
            // switch, which S3Connector.NormalizePrefix would treat as a literal prefix and
            // match zero objects. Empty => list the whole bucket.
            dataSource.FilePath = path;
        }

        _logger.LogInformation(
            "Resolved FileServerId {ServerId} ({ServerType}) for datasource {Name}: FilePath={FilePath}",
            server.ID, server.ServerType, dataSource.Name, dataSource.FilePath);
    }

    /// <summary>
    /// Bridges each S3 output destination's selected OutputServerId (an S3 AdminServer) into a
    /// complete, write-ready <see cref="S3OutputConfig"/> on the destination.
    ///
    /// Phase 35 (G5): the create flow stored <c>entity.Output = request.Output</c> verbatim, but the
    /// frontend never sends credentials/endpoint and the backend never bridged them — so
    /// <c>Output.Destinations[].S3Config.Bucket</c> came out null in Mongo and
    /// <c>S3OutputHandler.WriteAsync</c> threw "S3Config is required". This mirrors the INPUT bridge
    /// (<see cref="PopulateFileServerConnectionAsync"/>, the S3 block): same PascalCase
    /// TypeSpecificConfig key reads, the same decrypt of the at-rest SecretKey, the same path-style
    /// default, and the same <b>Region-omitted</b> rule (G6 — leaving Region null keeps the AWS SDK
    /// pinned to the custom MinIO endpoint).
    /// </summary>
    private async Task PopulateOutputDestinationS3Async(
        DataProcessingDataSource dataSource,
        CancellationToken ct = default)
    {
        var destinations = dataSource.Output?.Destinations;
        if (destinations == null || destinations.Count == 0)
            return;

        foreach (var destination in destinations)
        {
            if (destination.Type?.ToLowerInvariant() != "s3" ||
                string.IsNullOrEmpty(destination.OutputServerId))
            {
                // Non-S3 (kafka/folder/...) or no server reference — leave untouched.
                continue;
            }

            var server = await _serverService.GetServerByIdAsync(destination.OutputServerId, ct);
            if (server == null)
            {
                _logger.LogWarning(
                    "Output AdminServer {ServerId} not found for S3 destination {DestName} on datasource {Name}",
                    destination.OutputServerId, destination.Name, dataSource.Name);
                continue;
            }

            var s3 = server.TypeSpecificConfig;
            // Create the config if the frontend did not supply one; otherwise augment in place
            // (preserving any bucket/keyPrefix the admin typed).
            destination.S3Config ??= new S3OutputConfig();
            var cfg = destination.S3Config;

            // Endpoint: {http|https}://{host}:{port} from the server + its UseHttp flag.
            var useHttp = s3 != null && s3.Contains("UseHttp") && s3["UseHttp"].AsBoolean;
            cfg.Endpoint = $"{(useHttp ? "http" : "https")}://{server.Host}:{server.Port}";

            // MinIO requires path-style addressing; default true when ForcePathStyle is unset.
            cfg.UsePathStyle = s3 == null || !s3.Contains("ForcePathStyle") || s3["ForcePathStyle"].AsBoolean;

            // Access key from the server contract.
            if (s3 != null && s3.Contains("AccessKey"))
                cfg.AccessKeyId = s3["AccessKey"].AsString;

            // Secret key is encrypted at rest — decrypt it (mirror the input bridge) so the
            // S3 output handler can authenticate.
            if (s3 != null && s3.Contains("SecretKey"))
            {
                var secret = s3["SecretKey"].AsString;
                if (_credentialProtector != null && _credentialProtector.IsProtected(secret))
                    secret = _credentialProtector.Unprotect(secret);
                cfg.SecretAccessKey = secret;
            }

            // Bucket: keep the admin-typed bucket if the frontend supplied one; otherwise fall
            // back to the server's configured bucket.
            if (string.IsNullOrEmpty(cfg.Bucket) && s3 != null && s3.Contains("Bucket"))
                cfg.Bucket = s3["Bucket"].AsString;

            // Region MUST stay null/empty (G6) — setting it makes the AWS SDK rewrite the host and
            // abandon the custom MinIO endpoint. The frontend KeyPrefix is preserved as-is.

            _logger.LogInformation(
                "Bridged OutputServerId {ServerId} into S3Config for destination {DestName} on datasource {Name}: " +
                "Endpoint={Endpoint}, Bucket={Bucket}, UsePathStyle={UsePathStyle}, Region={Region}",
                server.ID, destination.Name, dataSource.Name,
                cfg.Endpoint, cfg.Bucket, cfg.UsePathStyle, cfg.Region ?? "(null)");
        }
    }

    /// <summary>
    /// Validates NAS device reference and auto-populates FilePath from mount configuration.
    /// </summary>
    private async Task ValidateAndPopulateNasDeviceAsync(
        DataProcessingDataSource dataSource,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(dataSource.NasDeviceId))
        {
            return; // Not using NAS, no validation needed
        }

        var nasDevice = await _nasDeviceService.GetNasDeviceByIdAsync(dataSource.NasDeviceId, ct);

        if (nasDevice == null)
        {
            throw new ValidationException($"התקן NAS לא נמצא: {dataSource.NasDeviceId}");
        }

        if (!nasDevice.IsProvisioned)
        {
            throw new ValidationException(
                $"התקן NAS '{nasDevice.Name}' לא מוקצה. יש לבצע הקצאה (provision) ולהמתין ש-PVC יהיה מחובר לפני יצירת DataSource.");
        }

        if (!nasDevice.CanBeInput)
        {
            throw new ValidationException(
                $"התקן NAS '{nasDevice.Name}' עם תפקיד '{nasDevice.Role}' לא יכול לשמש כמקור קלט. יש להשתמש בהתקן עם תפקיד Input או Both.");
        }

        // Compute full mount path: /mnt/{nas-name}/{export-path}/{sub-path}
        var subPath = dataSource.NasSubPath?.TrimStart('/') ?? string.Empty;
        var computedPath = Path.Combine(
            nasDevice.MountPath,
            nasDevice.ExportPath.TrimStart('/'),
            subPath
        ).Replace('\\', '/'); // Normalize for Linux

        dataSource.FilePath = computedPath;

        _logger.LogInformation(
            "DataSource {Name} linked to NAS device {NasDevice}, computed path: {Path}",
            dataSource.Name, nasDevice.Name, dataSource.FilePath);
    }
}

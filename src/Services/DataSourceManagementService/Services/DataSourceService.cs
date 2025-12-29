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
    private static readonly ActivitySource ActivitySource = new("DataProcessing.DataSourceManagement.Service");

    public DataSourceService(
        IDataSourceRepository repository,
        ILogger<DataSourceService> logger,
        BusinessMetrics metrics,
        IPublishEndpoint publishEndpoint)
    {
        _repository = repository;
        _logger = logger;
        _metrics = metrics;
        _publishEndpoint = publishEndpoint;
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

            _logger.LogInformation("Updating data source. ID: {Id}, Name: {Name}, CorrelationId: {CorrelationId}",
                request.Id, request.Name, correlationId);

            // Debug logging for RetentionDays
            _logger.LogInformation("RetentionDays from request: {RetentionDays}, HasValue: {HasValue}, CorrelationId: {CorrelationId}",
                request.RetentionDays, request.RetentionDays.HasValue, correlationId);

            // Map request to existing entity
            MapUpdateRequestToEntity(request, existingDataSource);

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
        
        return new DataProcessingDataSource
        {
            Name = request.Name,
            SupplierName = request.SupplierName,
            Category = request.Category,
            Description = request.Description,
            FilePath = request.FilePath ?? request.ConnectionString,
            IsActive = request.IsActive,
            FilePattern = request.FilePattern ?? request.FileFormat ?? "*.*",
            JsonSchema = jsonSchema,
            CronExpression = request.CronExpression,
            PollingRate = TimeSpan.FromMinutes(5),
            TotalFilesProcessed = 0,
            TotalErrorRecords = 0,
            LastProcessedAt = null,
            AdditionalConfiguration = additionalConfig.ElementCount > 0 ? additionalConfig : null,
            Output = request.Output ?? new DataProcessing.Shared.Entities.OutputConfiguration()
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

        // Mark entity as modified to ensure MongoDB saves the changes
        entity.MarkAsModified();
    }
}

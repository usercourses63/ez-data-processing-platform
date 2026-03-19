using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.ComponentModel.DataAnnotations;
using DataProcessing.Shared.Entities;
using DataProcessing.DataSourceManagement.Hubs;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Models.Responses;
using DataProcessing.DataSourceManagement.Models.Queries;
using DataProcessing.DataSourceManagement.Services;

namespace DataProcessing.DataSourceManagement.Controllers;

/// <summary>
/// REST API controller for data source management operations
/// Provides endpoints for CRUD operations, validation, statistics, and connection testing
/// Supports Hebrew UI with RTL layout and comprehensive error handling
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
[Consumes("application/json")]
public class DataSourceController : ControllerBase
{
    private readonly IDataSourceService _dataSourceService;
    private readonly IHubContext<MonitoringHub> _hubContext;
    private readonly ILogger<DataSourceController> _logger;

    /// <summary>
    /// Constructor for DataSourceController
    /// </summary>
    /// <param name="dataSourceService">Data source service for business logic</param>
    /// <param name="hubContext">SignalR hub context for real-time broadcasts</param>
    /// <param name="logger">Logger for request tracking</param>
    public DataSourceController(
        IDataSourceService dataSourceService,
        IHubContext<MonitoringHub> hubContext,
        ILogger<DataSourceController> logger)
    {
        _dataSourceService = dataSourceService;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Gets a data source by ID
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <returns>Data source details or error response</returns>
    /// <response code="200">Data source found and returned successfully</response>
    /// <response code="400">Invalid ID format or missing ID</response>
    /// <response code="404">Data source not found</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<DataProcessingDataSource>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> GetById([Required] string id)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource/{Id} - CorrelationId: {CorrelationId}", id, correlationId);

        var result = await _dataSourceService.GetByIdAsync(id, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Gets paginated list of data sources with optional filtering and sorting
    /// </summary>
    /// <param name="page">Page number (1-based, default: 1)</param>
    /// <param name="size">Page size (1-100, default: 25)</param>
    /// <param name="search">Search term for name, supplier, or category</param>
    /// <param name="supplier">Filter by supplier name</param>
    /// <param name="category">Filter by category</param>
    /// <param name="isActive">Filter by active status</param>
    /// <param name="sortBy">Sort field (name, supplier, category, createdAt)</param>
    /// <param name="sortDirection">Sort direction (asc, desc)</param>
    /// <returns>Paginated list of data sources</returns>
    /// <response code="200">Data sources retrieved successfully</response>
    /// <response code="400">Invalid query parameters</response>
    /// <response code="500">Internal server error</response>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<DataProcessingDataSource>>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> GetPaged(
        [FromQuery, Range(1, int.MaxValue)] int page = 1,
        [FromQuery, Range(1, 100)] int size = 25,
        [FromQuery] string? search = null,
        [FromQuery] string? supplier = null,
        [FromQuery] string? category = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] string? sortBy = "name",
        [FromQuery] string? sortDirection = "asc")
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource - Page: {Page}, Size: {Size}, Search: {Search}, CorrelationId: {CorrelationId}", 
            page, size, search, correlationId);

        var query = new DataSourceQuery
        {
            Page = page,
            Size = size,
            SearchText = search,
            SupplierName = supplier,
            Category = category,
            IsActive = isActive,
            SortBy = ParseSortField(sortBy ?? "name"),
            SortDirection = Enum.TryParse<Models.Queries.SortDirection>(sortDirection, true, out var direction) 
                ? direction 
                : Models.Queries.SortDirection.Ascending
        };

        var result = await _dataSourceService.GetPagedAsync(query, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Gets all active data sources for processing operations
    /// </summary>
    /// <returns>List of active data sources</returns>
    /// <response code="200">Active data sources retrieved successfully</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("active")]
    [ProducesResponseType(typeof(ApiResponse<List<DataProcessingDataSource>>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> GetActive()
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource/active - CorrelationId: {CorrelationId}", correlationId);

        var result = await _dataSourceService.GetActiveAsync(correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Gets data sources by supplier name
    /// </summary>
    /// <param name="supplierName">Supplier name to filter by</param>
    /// <returns>List of data sources for the specified supplier</returns>
    /// <response code="200">Data sources retrieved successfully</response>
    /// <response code="400">Invalid supplier name</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("supplier/{supplierName}")]
    [ProducesResponseType(typeof(ApiResponse<List<DataProcessingDataSource>>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> GetBySupplier([Required] string supplierName)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource/supplier/{SupplierName} - CorrelationId: {CorrelationId}", 
            supplierName, correlationId);

        var result = await _dataSourceService.GetBySupplierAsync(supplierName, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Creates a new data source
    /// </summary>
    /// <param name="request">Data source creation request</param>
    /// <returns>Created data source details</returns>
    /// <response code="201">Data source created successfully</response>
    /// <response code="400">Invalid request data or validation errors</response>
    /// <response code="409">Data source name already exists</response>
    /// <response code="500">Internal server error</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<DataProcessingDataSource>), 201)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 409)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> Create([FromBody, Required] CreateDataSourceRequest request)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("POST /api/v1/datasource - Name: {Name}, CorrelationId: {CorrelationId}", 
            request.Name, correlationId);

        if (!ModelState.IsValid)
        {
            return BadRequest(CreateValidationErrorResponse(correlationId));
        }

        var result = await _dataSourceService.CreateAsync(request, correlationId);

        if (result.IsSuccess)
        {
            await _hubContext.Clients.All.SendAsync("EntityChanged", new
            {
                EntityType = "DataSource",
                EntityId = result.Data!.ID,
                Action = "created",
                Version = result.Data.Version
            });
            return CreatedAtAction(nameof(GetById), new { id = result.Data!.ID }, result);
        }

        return StatusCode(result.Error!.StatusCode,
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Updates an existing data source
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <param name="request">Data source update request</param>
    /// <returns>Success confirmation</returns>
    /// <response code="200">Data source updated successfully</response>
    /// <response code="400">Invalid request data or validation errors</response>
    /// <response code="404">Data source not found</response>
    /// <response code="409">Data source name already exists</response>
    /// <response code="500">Internal server error</response>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 409)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> Update([Required] string id, [FromBody, Required] UpdateDataSourceRequest request)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("PUT /api/v1/datasource/{Id} - Name: {Name}, CorrelationId: {CorrelationId}", 
            id, request.Name, correlationId);

        if (!ModelState.IsValid)
        {
            return BadRequest(CreateValidationErrorResponse(correlationId));
        }

        // Ensure ID consistency
        request.Id = id;

        var result = await _dataSourceService.UpdateAsync(request, correlationId);

        if (result.IsSuccess)
        {
            await _hubContext.Clients.All.SendAsync("EntityChanged", new
            {
                EntityType = "DataSource",
                EntityId = id,
                Action = "updated",
                Version = result.Data
            });
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode,
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Soft deletes a data source (marks as deleted but keeps data)
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <param name="deletedBy">User or system performing the deletion</param>
    /// <returns>Success confirmation</returns>
    /// <response code="200">Data source deleted successfully</response>
    /// <response code="400">Invalid ID or missing deletedBy parameter</response>
    /// <response code="404">Data source not found</response>
    /// <response code="500">Internal server error</response>
    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> Delete([Required] string id, [FromQuery, Required] string deletedBy)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("DELETE /api/v1/datasource/{Id} - DeletedBy: {DeletedBy}, CorrelationId: {CorrelationId}", 
            id, deletedBy, correlationId);

        var result = await _dataSourceService.SoftDeleteAsync(id, deletedBy, correlationId);

        if (result.IsSuccess)
        {
            await _hubContext.Clients.All.SendAsync("EntityChanged", new
            {
                EntityType = "DataSource",
                EntityId = id,
                Action = "deleted",
                Version = 0
            });
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode,
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Restores a previously soft-deleted data source
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <param name="restoredBy">User or system performing the restoration</param>
    /// <returns>Success confirmation</returns>
    /// <response code="200">Data source restored successfully</response>
    /// <response code="400">Invalid ID or missing restoredBy parameter</response>
    /// <response code="404">Data source not found</response>
    /// <response code="500">Internal server error</response>
    [HttpPost("{id}/restore")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> Restore([Required] string id, [FromQuery, Required] string restoredBy)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("POST /api/v1/datasource/{Id}/restore - RestoredBy: {RestoredBy}, CorrelationId: {CorrelationId}", 
            id, restoredBy, correlationId);

        var result = await _dataSourceService.RestoreAsync(id, restoredBy, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Validates if a data source name is available (not already used)
    /// </summary>
    /// <param name="name">Data source name to validate</param>
    /// <param name="excludeId">ID to exclude from validation (for updates)</param>
    /// <returns>Validation result</returns>
    /// <response code="200">Validation result returned successfully</response>
    /// <response code="400">Invalid name parameter</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("validate-name")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> ValidateName([FromQuery, Required] string name, [FromQuery] string? excludeId = null)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource/validate-name - Name: {Name}, ExcludeId: {ExcludeId}, CorrelationId: {CorrelationId}", 
            name, excludeId, correlationId);

        var result = await _dataSourceService.ValidateNameAsync(name, excludeId, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Gets data source statistics and counts
    /// </summary>
    /// <returns>Statistics including active count, deleted count, and total count</returns>
    /// <response code="200">Statistics retrieved successfully</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("statistics")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> GetStatistics()
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource/statistics - CorrelationId: {CorrelationId}", correlationId);

        var result = await _dataSourceService.GetStatisticsAsync(correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Gets data sources that haven't been processed for a specified time period
    /// </summary>
    /// <param name="hours">Hours threshold for inactive data sources (default: 24)</param>
    /// <returns>List of inactive data sources</returns>
    /// <response code="200">Inactive data sources retrieved successfully</response>
    /// <response code="400">Invalid hours parameter</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("inactive")]
    [ProducesResponseType(typeof(ApiResponse<List<DataProcessingDataSource>>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> GetInactive([FromQuery, Range(1, 8760)] int hours = 24)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource/inactive - Hours: {Hours}, CorrelationId: {CorrelationId}", 
            hours, correlationId);

        var inactiveThreshold = TimeSpan.FromHours(hours);
        var result = await _dataSourceService.GetInactiveAsync(inactiveThreshold, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Updates processing statistics for a data source
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <param name="filesProcessed">Number of files processed</param>
    /// <param name="errorRecords">Number of error records</param>
    /// <returns>Success confirmation</returns>
    /// <response code="200">Statistics updated successfully</response>
    /// <response code="400">Invalid parameters</response>
    /// <response code="404">Data source not found</response>
    /// <response code="500">Internal server error</response>
    [HttpPost("{id}/stats")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> UpdateProcessingStats(
        [Required] string id, 
        [FromQuery, Range(0, long.MaxValue)] long filesProcessed = 0, 
        [FromQuery, Range(0, long.MaxValue)] long errorRecords = 0)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("POST /api/v1/datasource/{Id}/stats - Files: {Files}, Errors: {Errors}, CorrelationId: {CorrelationId}", 
            id, filesProcessed, errorRecords, correlationId);

        var result = await _dataSourceService.UpdateProcessingStatsAsync(id, filesProcessed, errorRecords, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Tests connection to a data source
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <returns>Connection test result</returns>
    /// <response code="200">Connection test completed successfully</response>
    /// <response code="400">Invalid ID parameter</response>
    /// <response code="404">Data source not found</response>
    /// <response code="500">Internal server error or connection failure</response>
    [HttpPost("{id}/test-connection")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> TestConnection([Required] string id)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("POST /api/v1/datasource/{Id}/test-connection - CorrelationId: {CorrelationId}", 
            id, correlationId);

        var result = await _dataSourceService.TestConnectionAsync(id, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Gets detailed processing statistics for a data source
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <returns>Detailed processing statistics</returns>
    /// <response code="200">Statistics retrieved successfully</response>
    /// <response code="400">Invalid ID parameter</response>
    /// <response code="404">Data source not found</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("{id}/statistics")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> GetProcessingStatistics([Required] string id)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("GET /api/v1/datasource/{Id}/statistics - CorrelationId: {CorrelationId}", 
            id, correlationId);

        var result = await _dataSourceService.GetProcessingStatisticsAsync(id, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Updates schedule configuration for a data source
    /// </summary>
    /// <param name="id">Data source ID</param>
    /// <param name="scheduleConfig">Schedule configuration JSON</param>
    /// <returns>Success confirmation</returns>
    /// <response code="200">Schedule updated successfully</response>
    /// <response code="400">Invalid parameters or JSON format</response>
    /// <response code="404">Data source not found</response>
    /// <response code="500">Internal server error</response>
    [HttpPut("{id}/schedule")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 404)]
    [ProducesResponseType(typeof(ErrorResponse), 500)]
    public async Task<IActionResult> UpdateSchedule([Required] string id, [FromBody, Required] string scheduleConfig)
    {
        var correlationId = GetCorrelationId();
        
        _logger.LogInformation("PUT /api/v1/datasource/{Id}/schedule - CorrelationId: {CorrelationId}", 
            id, correlationId);

        var result = await _dataSourceService.UpdateScheduleAsync(id, scheduleConfig, correlationId);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return StatusCode(result.Error!.StatusCode, 
            ErrorResponse.Create(correlationId, result.Error));
    }

    /// <summary>
    /// Gets correlation ID from request headers or generates a new one
    /// </summary>
    /// <returns>Correlation ID for request tracking</returns>
    private string GetCorrelationId()
    {
        return HttpContext.Request.Headers.TryGetValue("X-Correlation-ID", out var correlationId) 
            ? correlationId.ToString() 
            : Guid.NewGuid().ToString();
    }

    /// <summary>
    /// Parses string sort field to DataSourceSortField enum
    /// </summary>
    /// <param name="sortField">String representation of sort field</param>
    /// <returns>DataSourceSortField enum value</returns>
    private static DataSourceSortField ParseSortField(string sortField)
    {
        return sortField?.ToLowerInvariant() switch
        {
            "name" => DataSourceSortField.Name,
            "supplier" or "suppliername" => DataSourceSortField.SupplierName,
            "category" => DataSourceSortField.Category,
            "createdat" or "created" => DataSourceSortField.CreatedAt,
            "updatedat" or "updated" => DataSourceSortField.UpdatedAt,
            "lastprocessedat" or "lastprocessed" => DataSourceSortField.LastProcessedAt,
            "totalfilesprocessed" or "filesprocessed" => DataSourceSortField.TotalFilesProcessed,
            "totalerrorrecords" or "errorrecords" => DataSourceSortField.TotalErrorRecords,
            _ => DataSourceSortField.Name
        };
    }

    /// <summary>
    /// Creates a validation error response from ModelState
    /// </summary>
    /// <param name="correlationId">Request correlation ID</param>
    /// <returns>Error response with validation details</returns>
    private ErrorResponse CreateValidationErrorResponse(string correlationId)
    {
        var errors = ModelState
            .Where(x => x.Value?.Errors.Count > 0)
            .Select(x => new 
            {
                Field = x.Key,
                Errors = x.Value!.Errors.Select(e => e.ErrorMessage).ToArray()
            })
            .ToList();

        var errorDetail = new ErrorDetail
        {
            Code = "VALIDATION_FAILED",
            Message = "שגיאות בולידציה בבקשה", // Hebrew: Validation errors in request
            Details = $"Validation failed for {errors.Count} field(s): {string.Join(", ", errors.Select(e => e.Field))}",
            StatusCode = 400,
            Timestamp = DateTime.UtcNow
        };

        return ErrorResponse.Create(correlationId, errorDetail);
    }
}

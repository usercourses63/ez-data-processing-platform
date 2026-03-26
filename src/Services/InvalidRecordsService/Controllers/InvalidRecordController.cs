using Microsoft.AspNetCore.Mvc;
using InvalidRecordsService.Models.Requests;
using InvalidRecordsService.Services;

namespace InvalidRecordsService.Controllers;

[ApiController]
[Route("api/v1/invalid-records")]
[Produces("application/json")]
[Consumes("application/json")]
public class InvalidRecordController : ControllerBase
{
    private readonly IInvalidRecordService _service;
    private readonly ICorrectionService _correctionService;
    private readonly IRevalidationService _revalidationService;
    private readonly ILogger<InvalidRecordController> _logger;

    public InvalidRecordController(
        IInvalidRecordService service,
        ICorrectionService correctionService,
        IRevalidationService revalidationService,
        ILogger<InvalidRecordController> logger)
    {
        _service = service;
        _correctionService = correctionService;
        _revalidationService = revalidationService;
        _logger = logger;
    }

    /// <summary>
    /// Get paginated list of invalid records with filtering
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetInvalidRecords([FromQuery] InvalidRecordListRequest request)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "GET /api/v1/invalid-records - Page: {Page}, Size: {PageSize}, DataSource: {DataSourceId}, CorrelationId: {CorrelationId}",
            request.Page, request.PageSize, request.DataSourceId, correlationId);
        
        try
        {
            var result = await _service.GetListAsync(request);
            
            return Ok(new
            {
                isSuccess = true,
                data = result.Items,
                totalCount = result.TotalCount,
                page = result.Page,
                pageSize = result.PageSize,
                totalPages = (int)Math.Ceiling(result.TotalCount / (double)result.PageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get invalid records list");
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בטעינת רשומות לא תקינות",
                    messageEnglish = "Failed to retrieve invalid records"
                }
            });
        }
    }

    /// <summary>
    /// Get single invalid record by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetInvalidRecord(string id)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "GET /api/v1/invalid-records/{RecordId}, CorrelationId: {CorrelationId}",
            id, correlationId);
        
        try
        {
            var record = await _service.GetByIdAsync(id);
            
            if (record == null)
            {
                return NotFound(new
                {
                    isSuccess = false,
                    error = new
                    {
                        message = "רשומה לא נמצאה",
                        messageEnglish = "Invalid record not found"
                    }
                });
            }
            
            return Ok(new { isSuccess = true, data = record });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get invalid record {RecordId}", id);
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בטעינת רשומה",
                    messageEnglish = "Failed to retrieve record"
                }
            });
        }
    }

    /// <summary>
    /// Get statistics for invalid records
    /// </summary>
    [HttpGet("statistics")]
    public async Task<IActionResult> GetStatistics()
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "GET /api/v1/invalid-records/statistics, CorrelationId: {CorrelationId}",
            correlationId);
        
        try
        {
            var stats = await _service.GetStatisticsAsync();
            
            return Ok(new { isSuccess = true, data = stats });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get invalid records statistics");
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בטעינת סטטיסטיקות",
                    messageEnglish = "Failed to retrieve statistics"
                }
            });
        }
    }

    /// <summary>
    /// Update status of an invalid record
    /// </summary>
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateStatusRequest request)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "PUT /api/v1/invalid-records/{RecordId}/status - Status: {Status}, User: {User}, CorrelationId: {CorrelationId}",
            id, request.Status, request.UpdatedBy, correlationId);
        
        try
        {
            // Verify record exists
            var record = await _service.GetByIdAsync(id);
            if (record == null)
            {
                return NotFound(new
                {
                    isSuccess = false,
                    error = new
                    {
                        message = "רשומה לא נמצאה",
                        messageEnglish = "Invalid record not found"
                    }
                });
            }

            await _service.UpdateStatusAsync(id, request);
            
            return Ok(new
            {
                isSuccess = true,
                message = "סטטוס עודכן בהצלחה",
                messageEnglish = "Status updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update status for invalid record {RecordId}", id);
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בעדכון סטטוס",
                    messageEnglish = "Failed to update status"
                }
            });
        }
    }

    /// <summary>
    /// Delete an invalid record
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRecord(string id, [FromQuery] string? deletedBy = "User")
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "DELETE /api/v1/invalid-records/{RecordId}, DeletedBy: {User}, CorrelationId: {CorrelationId}",
            id, deletedBy, correlationId);
        
        try
        {
            // Verify record exists
            var record = await _service.GetByIdAsync(id);
            if (record == null)
            {
                return NotFound(new
                {
                    isSuccess = false,
                    error = new
                    {
                        message = "רשומה לא נמצאה",
                        messageEnglish = "Invalid record not found"
                    }
                });
            }

            var request = new BulkOperationRequest
            {
                RecordIds = new List<string> { id },
                RequestedBy = deletedBy ?? "User"
            };

            await _service.BulkDeleteAsync(request);
            
            return Ok(new
            {
                isSuccess = true,
                message = "רשומה נמחקה בהצלחה",
                messageEnglish = "Record deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete invalid record {RecordId}", id);
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה במחיקת רשומה",
                    messageEnglish = "Failed to delete record"
                }
            });
        }
    }

    /// <summary>
    /// Bulk delete invalid records
    /// </summary>
    [HttpPost("bulk/delete")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkOperationRequest request)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "POST /api/v1/invalid-records/bulk/delete - Count: {Count}, User: {User}, CorrelationId: {CorrelationId}",
            request.RecordIds.Count, request.RequestedBy, correlationId);
        
        try
        {
            var result = await _service.BulkDeleteAsync(request);
            
            return Ok(new
            {
                isSuccess = true,
                data = result,
                message = $"{result.Successful} מתוך {result.TotalRequested} רשומות נמחקו בהצלחה",
                messageEnglish = $"{result.Successful} of {result.TotalRequested} records deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed bulk delete operation");
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה במחיקה מרובה",
                    messageEnglish = "Failed bulk delete operation"
                }
            });
        }
    }

    /// <summary>
    /// Correct invalid record data
    /// </summary>
    [HttpPut("{id}/correct")]
    public async Task<IActionResult> CorrectRecord(string id, [FromBody] CorrectRecordRequest request)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "PUT /api/v1/invalid-records/{RecordId}/correct - User: {User}, CorrelationId: {CorrelationId}",
            id, request.CorrectedBy, correlationId);
        
        try
        {
            var result = await _correctionService.CorrectRecordAsync(id, request);
            
            if (!result.Success)
            {
                return BadRequest(new
                {
                    isSuccess = false,
                    error = new
                    {
                        message = result.Message,
                        messageEnglish = result.Message
                    }
                });
            }
            
            return Ok(new
            {
                isSuccess = true,
                data = result,
                message = "נתונים תוקנו בהצלחה",
                messageEnglish = "Data corrected successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to correct invalid record {RecordId}", id);
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בתיקון נתונים",
                    messageEnglish = "Failed to correct data"
                }
            });
        }
    }

    /// <summary>
    /// Reprocess invalid record
    /// </summary>
    [HttpPost("{id}/reprocess")]
    public async Task<IActionResult> ReprocessRecord(string id)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "POST /api/v1/invalid-records/{RecordId}/reprocess, CorrelationId: {CorrelationId}",
            id, correlationId);
        
        try
        {
            var result = await _correctionService.ReprocessRecordAsync(id);
            
            if (!result.Success)
            {
                return BadRequest(new
                {
                    isSuccess = false,
                    error = new
                    {
                        message = result.Message,
                        messageEnglish = result.Message
                    }
                });
            }
            
            return Ok(new
            {
                isSuccess = true,
                data = result,
                message = "רשומה נשלחה לעיבוד מחדש",
                messageEnglish = "Record reprocessed"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reprocess invalid record {RecordId}", id);
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בעיבוד מחדש",
                    messageEnglish = "Failed to reprocess record"
                }
            });
        }
    }

    /// <summary>
    /// Bulk reprocess invalid records
    /// </summary>
    [HttpPost("bulk/reprocess")]
    public async Task<IActionResult> BulkReprocess([FromBody] BulkOperationRequest request)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "POST /api/v1/invalid-records/bulk/reprocess - Count: {Count}, User: {User}, CorrelationId: {CorrelationId}",
            request.RecordIds.Count, request.RequestedBy, correlationId);
        
        try
        {
            var result = await _correctionService.BulkReprocessAsync(request);
            
            return Ok(new
            {
                isSuccess = true,
                data = result,
                message = $"{result.Successful} מתוך {result.TotalRequested} רשומות עובדו מחדש בהצלחה",
                messageEnglish = $"{result.Successful} of {result.TotalRequested} records reprocessed successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed bulk reprocess operation");
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בעיבוד מחדש מרובה",
                    messageEnglish = "Failed bulk reprocess operation"
                }
            });
        }
    }

    /// <summary>
    /// Bulk mark invalid records as ignored
    /// </summary>
    [HttpPost("bulk/ignore")]
    public async Task<IActionResult> BulkIgnore([FromBody] BulkOperationRequest request)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "POST /api/v1/invalid-records/bulk/ignore - Count: {Count}, User: {User}, CorrelationId: {CorrelationId}",
            request.RecordIds.Count, request.RequestedBy, correlationId);
        
        try
        {
            var result = await _correctionService.BulkIgnoreAsync(request);
            
            return Ok(new
            {
                isSuccess = true,
                data = result,
                message = $"{result.Successful} מתוך {result.TotalRequested} רשומות סומנו כמתעלמות בהצלחה",
                messageEnglish = $"{result.Successful} of {result.TotalRequested} records marked as ignored successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed bulk ignore operation");
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בסימון כמתעלמות מרובה",
                    messageEnglish = "Failed bulk ignore operation"
                }
            });
        }
    }

    /// <summary>
    /// Export invalid records to CSV
    /// </summary>
    [HttpPost("export")]
    public async Task<IActionResult> ExportToCsv([FromBody] ExportRequest request)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        
        _logger.LogInformation(
            "POST /api/v1/invalid-records/export - Format: {Format}, CorrelationId: {CorrelationId}",
            request.Format, correlationId);
        
        try
        {
            var csvBytes = await _service.ExportToCsvAsync(request);
            
            var fileName = $"invalid-records-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
            
            return File(csvBytes, "text/csv", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export invalid records");
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה בייצוא נתונים",
                    messageEnglish = "Failed to export data"
                }
            });
        }
    }

    /// <summary>
    /// Trigger bulk revalidation of invalid records.
    /// Per D-08: Called from invalid records page header and schema tab in datasource edit.
    /// Per D-09: Returns count before execution, confirmation handled by frontend.
    /// </summary>
    [HttpPost("revalidate-all")]
    public async Task<IActionResult> RevalidateAll([FromBody] RevalidateAllRequest? request = null)
    {
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? "N/A";
        var dataSourceId = request?.DataSourceId;

        _logger.LogInformation(
            "POST /api/v1/invalid-records/revalidate-all - DataSourceId: {DataSourceId}, CorrelationId: {CorrelationId}",
            dataSourceId ?? "all", correlationId);

        try
        {
            var result = await _revalidationService.BulkRevalidateByDataSourceAsync(
                dataSourceId ?? string.Empty,
                request?.TriggeredBy ?? "ManualButton");

            return Ok(new
            {
                isSuccess = true,
                data = result,
                message = $"{result.Published} רשומות נשלחו לאימות מחדש",
                messageEnglish = $"{result.Published} records sent for revalidation"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed revalidate-all operation");
            return StatusCode(500, new
            {
                isSuccess = false,
                error = new
                {
                    message = "שגיאה באימות מחדש",
                    messageEnglish = "Failed revalidation operation"
                }
            });
        }
    }

    /// <summary>
    /// Get count of revalidatable records for confirmation popover (per D-09)
    /// </summary>
    [HttpGet("revalidate-count")]
    public async Task<IActionResult> GetRevalidateCount([FromQuery] string? dataSourceId = null)
    {
        try
        {
            var count = await _service.GetRevalidatableCountAsync(dataSourceId);
            return Ok(new { isSuccess = true, data = new { count } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get revalidatable count");
            return StatusCode(500, new { isSuccess = false });
        }
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            Service = "InvalidRecordsService",
            Status = "Healthy",
            Timestamp = DateTime.UtcNow,
            Version = "1.0.0"
        });
    }
}

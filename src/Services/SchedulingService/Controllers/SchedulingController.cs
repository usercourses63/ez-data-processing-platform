using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using DataProcessing.Scheduling.Services;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;

namespace DataProcessing.Scheduling.Controllers;

/// <summary>
/// REST API controller for managing data source scheduling operations
/// </summary>
[ApiController]
[Route("api/v1/scheduling")]
[Produces("application/json")]
public class SchedulingController : ControllerBase
{
    private readonly ISchedulingManager _schedulingManager;
    private readonly ILogger<SchedulingController> _logger;
    private readonly BusinessMetrics _metrics;
    private static readonly ActivitySource ActivitySource = new("DataProcessing.Scheduling");

    public SchedulingController(
        ISchedulingManager schedulingManager,
        ILogger<SchedulingController> logger,
        BusinessMetrics metrics)
    {
        _schedulingManager = schedulingManager;
        _logger = logger;
        _metrics = metrics;
    }

    /// <summary>
    /// Creates or updates a polling schedule for a data source
    /// </summary>
    /// <param name="dataSourceId">Data source identifier</param>
    /// <param name="request">Schedule creation request</param>
    /// <returns>Success status</returns>
    [HttpPost("datasources/{dataSourceId}/schedule")]
    [ProducesResponseType(typeof(ScheduleApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ScheduleDataSourceAsync(string dataSourceId, [FromBody] ScheduleDataSourceRequest request)
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("ScheduleDataSource");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            _logger.LogInformation("Received schedule request for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            // Validate request
            if (!ModelState.IsValid)
            {
                return BadRequest(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "הבקשה אינה תקינה", // "Request is invalid" in Hebrew
                    Details = ModelState.ToString() ?? "Validation errors"
                });
            }

            // Create data source object from request
            var dataSource = new DataProcessingDataSource
            {
                ID = dataSourceId,
                Name = request.DataSourceName,
                SupplierName = request.SupplierName ?? "Unknown",
                FilePath = "/default",
                JsonSchema = new MongoDB.Bson.BsonDocument(),
                PollingRate = request.PollingInterval,
                IsActive = true,
                CreatedBy = "SchedulingService"
            };

            var success = await _schedulingManager.ScheduleDataSourcePollingAsync(dataSource, correlationId);

            if (success)
            {
                var status = await _schedulingManager.GetScheduleStatusAsync(dataSourceId);
                
                _metrics.RecordMessageReceived("schedule_request", "scheduling", "success");
                
                return Ok(new ScheduleApiResponse
                {
                    Success = true,
                    Message = "תזמון נוצר בהצלחה", // "Schedule created successfully" in Hebrew
                    CorrelationId = correlationId,
                    Schedule = status!
                });
            }
            else
            {
                _metrics.RecordMessageReceived("schedule_request", "scheduling", "failed");
                
                return BadRequest(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "נכשל ביצירת התזמון", // "Failed to create schedule" in Hebrew
                    Details = $"Unable to schedule polling for data source: {dataSourceId}"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scheduling data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while processing the schedule request"
            });
        }
    }

    /// <summary>
    /// Removes a polling schedule for a data source
    /// </summary>
    /// <param name="dataSourceId">Data source identifier</param>
    /// <returns>Success status</returns>
    [HttpDelete("datasources/{dataSourceId}/schedule")]
    [ProducesResponseType(typeof(ScheduleApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnscheduleDataSourceAsync(string dataSourceId)
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("UnscheduleDataSource");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            _logger.LogInformation("Received unschedule request for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            var success = await _schedulingManager.UnscheduleDataSourcePollingAsync(dataSourceId, correlationId);

            if (success)
            {
                return Ok(new ScheduleApiResponse
                {
                    Success = true,
                    Message = "תזמון בוטל בהצלחה", // "Schedule cancelled successfully" in Hebrew
                    CorrelationId = correlationId
                });
            }
            else
            {
                return NotFound(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "תזמון לא נמצא", // "Schedule not found" in Hebrew
                    Details = $"No schedule found for data source: {dataSourceId}"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unscheduling data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while removing the schedule"
            });
        }
    }

    /// <summary>
    /// Updates the polling interval for an existing schedule
    /// </summary>
    /// <param name="dataSourceId">Data source identifier</param>
    /// <param name="request">Update request</param>
    /// <returns>Updated schedule status</returns>
    [HttpPut("datasources/{dataSourceId}/schedule")]
    [ProducesResponseType(typeof(ScheduleApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePollingIntervalAsync(string dataSourceId, [FromBody] UpdateScheduleRequest request)
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("UpdatePollingInterval");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            _logger.LogInformation("Received update schedule request for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            if (!ModelState.IsValid)
            {
                return BadRequest(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "הבקשה אינה תקינה", // "Request is invalid" in Hebrew
                    Details = ModelState.ToString() ?? "Validation errors"
                });
            }

            var success = await _schedulingManager.UpdatePollingIntervalAsync(dataSourceId, request.NewPollingInterval, correlationId);

            if (success)
            {
                var status = await _schedulingManager.GetScheduleStatusAsync(dataSourceId);
                
                return Ok(new ScheduleApiResponse
                {
                    Success = true,
                    Message = "תזמון עודכן בהצלחה", // "Schedule updated successfully" in Hebrew
                    CorrelationId = correlationId,
                    Schedule = status!
                });
            }
            else
            {
                return NotFound(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "תזמון לא נמצא או עדכון נכשל", // "Schedule not found or update failed" in Hebrew
                    Details = $"Unable to update schedule for data source: {dataSourceId}"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating schedule for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while updating the schedule"
            });
        }
    }

    /// <summary>
    /// Pauses polling for a data source
    /// </summary>
    /// <param name="dataSourceId">Data source identifier</param>
    /// <returns>Success status</returns>
    [HttpPost("datasources/{dataSourceId}/pause")]
    [ProducesResponseType(typeof(ScheduleApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PauseDataSourcePollingAsync(string dataSourceId)
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("PauseDataSourcePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            var success = await _schedulingManager.PauseDataSourcePollingAsync(dataSourceId, correlationId);

            if (success)
            {
                var status = await _schedulingManager.GetScheduleStatusAsync(dataSourceId);
                
                return Ok(new ScheduleApiResponse
                {
                    Success = true,
                    Message = "תזמון הושהה בהצלחה", // "Schedule paused successfully" in Hebrew
                    CorrelationId = correlationId,
                    Schedule = status!
                });
            }
            else
            {
                return NotFound(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "תזמון לא נמצא", // "Schedule not found" in Hebrew
                    Details = $"No schedule found to pause for data source: {dataSourceId}"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pausing schedule for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while pausing the schedule"
            });
        }
    }

    /// <summary>
    /// Resumes polling for a data source
    /// </summary>
    /// <param name="dataSourceId">Data source identifier</param>
    /// <returns>Success status</returns>
    [HttpPost("datasources/{dataSourceId}/resume")]
    [ProducesResponseType(typeof(ScheduleApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResumeDataSourcePollingAsync(string dataSourceId)
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("ResumeDataSourcePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            var success = await _schedulingManager.ResumeDataSourcePollingAsync(dataSourceId, correlationId);

            if (success)
            {
                var status = await _schedulingManager.GetScheduleStatusAsync(dataSourceId);
                
                return Ok(new ScheduleApiResponse
                {
                    Success = true,
                    Message = "תזמון חודש בהצלחה", // "Schedule resumed successfully" in Hebrew
                    CorrelationId = correlationId,
                    Schedule = status!
                });
            }
            else
            {
                return NotFound(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "תזמון לא נמצא", // "Schedule not found" in Hebrew
                    Details = $"No schedule found to resume for data source: {dataSourceId}"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resuming schedule for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while resuming the schedule"
            });
        }
    }

    /// <summary>
    /// Triggers immediate polling for a data source
    /// </summary>
    /// <param name="dataSourceId">Data source identifier</param>
    /// <returns>Success status</returns>
    [HttpPost("datasources/{dataSourceId}/trigger")]
    [ProducesResponseType(typeof(ScheduleApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TriggerImmediatePollingAsync(string dataSourceId)
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("TriggerImmediatePolling");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            var success = await _schedulingManager.TriggerImmediatePollingAsync(dataSourceId, correlationId);

            if (success)
            {
                return Ok(new ScheduleApiResponse
                {
                    Success = true,
                    Message = "תזמון הופעל ידנית בהצלחה", // "Schedule triggered manually successfully" in Hebrew
                    CorrelationId = correlationId
                });
            }
            else
            {
                return NotFound(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "תזמון לא נמצא", // "Schedule not found" in Hebrew
                    Details = $"No schedule found to trigger for data source: {dataSourceId}"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error triggering schedule for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while triggering the schedule"
            });
        }
    }

    /// <summary>
    /// Gets the current schedule status for a data source
    /// </summary>
    /// <param name="dataSourceId">Data source identifier</param>
    /// <returns>Schedule status information</returns>
    [HttpGet("datasources/{dataSourceId}/status")]
    [ProducesResponseType(typeof(ScheduleStatusApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetScheduleStatusAsync(string dataSourceId)
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("GetScheduleStatus");
        activity?.SetTag("correlation-id", correlationId);
        activity?.SetTag("data-source-id", dataSourceId);

        try
        {
            var status = await _schedulingManager.GetScheduleStatusAsync(dataSourceId);

            if (status != null)
            {
                return Ok(new ScheduleStatusApiResponse
                {
                    Success = true,
                    CorrelationId = correlationId,
                    Status = status
                });
            }
            else
            {
                return NotFound(new ErrorResponse
                {
                    CorrelationId = correlationId,
                    Error = "תזמון לא נמצא", // "Schedule not found" in Hebrew
                    Details = $"No schedule found for data source: {dataSourceId}"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting schedule status for data source {DataSourceId}. CorrelationId: {CorrelationId}",
                dataSourceId, correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while getting the schedule status"
            });
        }
    }

    /// <summary>
    /// Gets all active schedules
    /// </summary>
    /// <returns>List of all schedules</returns>
    [HttpGet("schedules")]
    [ProducesResponseType(typeof(SchedulesListApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllSchedulesAsync()
    {
        var correlationId = HttpContext.TraceIdentifier;
        using var activity = ActivitySource.StartActivity("GetAllSchedules");
        activity?.SetTag("correlation-id", correlationId);

        try
        {
            var schedules = await _schedulingManager.GetAllSchedulesAsync();

            return Ok(new SchedulesListApiResponse
            {
                Success = true,
                CorrelationId = correlationId,
                Schedules = schedules,
                TotalCount = schedules.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all schedules. CorrelationId: {CorrelationId}", correlationId);

            return StatusCode(500, new ErrorResponse
            {
                CorrelationId = correlationId,
                Error = "שגיאה פנימית בשרת", // "Internal server error" in Hebrew
                Details = "An error occurred while getting all schedules"
            });
        }
    }
}

#region Request/Response Models

/// <summary>
/// Request model for scheduling a data source
/// </summary>
public class ScheduleDataSourceRequest
{
    /// <summary>
    /// Name of the data source
    /// </summary>
    public string DataSourceName { get; set; } = string.Empty;

    /// <summary>
    /// Supplier name
    /// </summary>
    public string? SupplierName { get; set; }

    /// <summary>
    /// Polling interval
    /// </summary>
    public TimeSpan PollingInterval { get; set; }
}

/// <summary>
/// Request model for updating a schedule
/// </summary>
public class UpdateScheduleRequest
{
    /// <summary>
    /// New polling interval
    /// </summary>
    public TimeSpan NewPollingInterval { get; set; }
}

/// <summary>
/// Standard API response for scheduling operations
/// </summary>
public class ScheduleApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string CorrelationId { get; set; } = string.Empty;
    public ScheduleStatus? Schedule { get; set; }
}

/// <summary>
/// API response for schedule status requests
/// </summary>
public class ScheduleStatusApiResponse
{
    public bool Success { get; set; }
    public string CorrelationId { get; set; } = string.Empty;
    public ScheduleStatus? Status { get; set; }
}

/// <summary>
/// API response for schedules list requests
/// </summary>
public class SchedulesListApiResponse
{
    public bool Success { get; set; }
    public string CorrelationId { get; set; } = string.Empty;
    public List<ScheduleInfo> Schedules { get; set; } = new();
    public int TotalCount { get; set; }
}

/// <summary>
/// Error response model
/// </summary>
public class ErrorResponse
{
    public string CorrelationId { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
}

#endregion

using DataProcessing.DataSourceManagement.Models.Responses;
using DataProcessing.DataSourceManagement.Services;
using Microsoft.AspNetCore.Mvc;

namespace DataProcessing.DataSourceManagement.Controllers;

/// <summary>
/// REST API controller for device health status.
/// Provides aggregated health data for NAS devices and AdminServers.
/// v0.2.0: Device Health Monitoring (MON-05, MON-06)
/// </summary>
[ApiController]
[Route("api/v1/health-status")]
public class HealthStatusController : ControllerBase
{
    private readonly IDeviceHealthService _healthService;
    private readonly ILogger<HealthStatusController> _logger;

    public HealthStatusController(
        IDeviceHealthService healthService,
        ILogger<HealthStatusController> logger)
    {
        _healthService = healthService;
        _logger = logger;
    }

    /// <summary>
    /// Get aggregated health status for all NAS devices and AdminServers.
    /// Returns device status, latency, uptime percentage, and summary counts.
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Aggregated device health status</returns>
    [HttpGet]
    [ProducesResponseType(typeof(DeviceHealthStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<DeviceHealthStatusResponse>> GetHealthStatus(CancellationToken ct = default)
    {
        try
        {
            var result = await _healthService.GetHealthStatusAsync(ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור סטטוס בריאות מכשירים");
            return StatusCode(500, new
            {
                message = "שגיאה באחזור סטטוס בריאות מכשירים",
                error = ex.Message
            });
        }
    }
}

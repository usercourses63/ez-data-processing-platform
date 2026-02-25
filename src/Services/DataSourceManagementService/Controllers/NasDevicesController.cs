using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Entities;
using Microsoft.AspNetCore.Mvc;

namespace DataProcessing.DataSourceManagement.Controllers;

/// <summary>
/// Controller for managing NAS (Network Attached Storage) devices.
/// Provides CRUD operations, K8s provisioning, and connection testing.
/// v0.2.0: NAS/NFS Architecture Support
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
public class NasDevicesController : ControllerBase
{
    private readonly INasDeviceService _nasDeviceService;
    private readonly ILogger<NasDevicesController> _logger;

    public NasDevicesController(
        INasDeviceService nasDeviceService,
        ILogger<NasDevicesController> logger)
    {
        _nasDeviceService = nasDeviceService;
        _logger = logger;
    }

    /// <summary>
    /// Get all NAS devices
    /// </summary>
    /// <param name="includeDeleted">Include soft-deleted devices</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of NAS devices</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<NasDevice>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<NasDevice>>> GetAll(
        [FromQuery] bool includeDeleted = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var devices = await _nasDeviceService.GetAllNasDevicesAsync(includeDeleted, cancellationToken);
            return Ok(devices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור התקני NAS");
            return StatusCode(500, new { message = "שגיאה באחזור התקני NAS", error = ex.Message });
        }
    }

    /// <summary>
    /// Get a NAS device by ID
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>NAS device</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(NasDevice), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NasDevice>> GetById(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var device = await _nasDeviceService.GetNasDeviceByIdAsync(id, cancellationToken);

            if (device == null)
            {
                return NotFound(new { message = $"התקן NAS לא נמצא: {id}" });
            }

            return Ok(device);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור התקן NAS: {DeviceId}", id);
            return StatusCode(500, new { message = "שגיאה באחזור התקן NAS", error = ex.Message });
        }
    }

    /// <summary>
    /// Get NAS devices by role
    /// </summary>
    /// <param name="role">NAS device role (Input, Output, Backup, Both)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of NAS devices</returns>
    [HttpGet("by-role/{role}")]
    [ProducesResponseType(typeof(List<NasDevice>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<NasDevice>>> GetByRole(
        string role,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!Enum.TryParse<NasDeviceRole>(role, ignoreCase: true, out var parsedRole))
            {
                return BadRequest(new { message = $"תפקיד לא תקין: {role}. ערכים אפשריים: Input, Output, Backup, Both" });
            }

            var devices = await _nasDeviceService.GetNasDevicesByRoleAsync(parsedRole, cancellationToken);
            return Ok(devices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור התקני NAS לפי תפקיד: {Role}", role);
            return StatusCode(500, new { message = "שגיאה באחזור התקני NAS", error = ex.Message });
        }
    }

    /// <summary>
    /// Create a new NAS device
    /// </summary>
    /// <param name="request">NAS device creation request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created NAS device</returns>
    [HttpPost]
    [ProducesResponseType(typeof(NasDevice), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<NasDevice>> Create(
        [FromBody] CreateNasDeviceRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var device = new NasDevice
            {
                Name = request.Name,
                Description = request.Description,
                Host = request.Host,
                Port = request.Port,
                ExportPath = request.ExportPath,
                Role = request.Role,
                StorageCapacity = request.StorageCapacity,
                AccessMode = request.AccessMode,
                ReclaimPolicy = request.ReclaimPolicy,
                MountOptions = request.MountOptions ?? new List<string>()
            };

            var created = await _nasDeviceService.CreateNasDeviceAsync(device, cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = created.ID }, created);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה ביצירת התקן NAS");
            return StatusCode(500, new { message = "שגיאה ביצירת התקן NAS", error = ex.Message });
        }
    }

    /// <summary>
    /// Update an existing NAS device
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="request">NAS device update request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated NAS device</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(NasDevice), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NasDevice>> Update(
        string id,
        [FromBody] UpdateNasDeviceRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var device = new NasDevice
            {
                Name = request.Name,
                Description = request.Description,
                Host = request.Host,
                Port = request.Port,
                ExportPath = request.ExportPath,
                Role = request.Role,
                StorageCapacity = request.StorageCapacity,
                AccessMode = request.AccessMode,
                ReclaimPolicy = request.ReclaimPolicy,
                MountOptions = request.MountOptions ?? new List<string>(),
                IsActive = request.IsActive
            };

            var updated = await _nasDeviceService.UpdateNasDeviceAsync(id, device, cancellationToken);

            if (updated == null)
            {
                return NotFound(new { message = $"התקן NAS לא נמצא: {id}" });
            }

            return Ok(updated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בעדכון התקן NAS: {DeviceId}", id);
            return StatusCode(500, new { message = "שגיאה בעדכון התקן NAS", error = ex.Message });
        }
    }

    /// <summary>
    /// Check if a NAS device can be deleted (no DataSources reference it)
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Delete eligibility status with referencing DataSources if blocked</returns>
    [HttpGet("{id}/can-delete")]
    [ProducesResponseType(typeof(NasDeviceDeleteCheckResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NasDeviceDeleteCheckResult>> CanDelete(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var device = await _nasDeviceService.GetNasDeviceByIdAsync(id, cancellationToken);
            if (device == null)
            {
                return NotFound(new { message = $"התקן NAS לא נמצא: {id}" });
            }

            var result = await _nasDeviceService.CanDeleteNasDeviceAsync(id, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בבדיקת יכולת מחיקת התקן NAS: {DeviceId}", id);
            return StatusCode(500, new { message = "שגיאה בבדיקת יכולת מחיקה", error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a NAS device (soft delete). Fails if DataSources reference it.
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Success or error response</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var deleted = await _nasDeviceService.DeleteNasDeviceAsync(id, cancellationToken);

            if (!deleted)
            {
                return NotFound(new { message = $"התקן NAS לא נמצא: {id}" });
            }

            return Ok(new { message = "התקן NAS נמחק בהצלחה" });
        }
        catch (InvalidOperationException ex)
        {
            // Referential integrity violation - cannot delete
            _logger.LogWarning("Cannot delete NAS device {DeviceId}: {Message}", id, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה במחיקת התקן NAS: {DeviceId}", id);
            return StatusCode(500, new { message = "שגיאה במחיקת התקן NAS", error = ex.Message });
        }
    }

    /// <summary>
    /// Provision Kubernetes resources (PV/PVC) for a NAS device
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="request">Provisioning request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Provisioning result</returns>
    [HttpPost("{id}/provision")]
    [ProducesResponseType(typeof(NasDeviceProvisionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NasDeviceProvisionResult>> Provision(
        string id,
        [FromBody] ProvisionNasDeviceRequest? request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Use default request if none provided
            request ??= new ProvisionNasDeviceRequest();

            var result = await _nasDeviceService.ProvisionNasDeviceAsync(id, request, cancellationToken);

            if (result.ErrorMessage?.Contains("לא נמצא") == true)
            {
                return NotFound(new { message = result.ErrorMessage });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בהקצאת משאבי Kubernetes להתקן NAS: {DeviceId}", id);
            return StatusCode(500, new { message = "שגיאה בהקצאת משאבי Kubernetes", error = ex.Message });
        }
    }

    /// <summary>
    /// Deprovision Kubernetes resources (PV/PVC) for a NAS device
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="namespace_">Kubernetes namespace (default: ez-platform)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content</returns>
    [HttpDelete("{id}/provision")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deprovision(
        string id,
        [FromQuery(Name = "namespace")] string namespace_ = "ez-platform",
        CancellationToken cancellationToken = default)
    {
        try
        {
            var deprovisioned = await _nasDeviceService.DeprovisionNasDeviceAsync(id, namespace_, cancellationToken);

            if (!deprovisioned)
            {
                return NotFound(new { message = $"התקן NAS לא נמצא או שגיאה בביטול הקצאה: {id}" });
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בביטול הקצאת משאבי Kubernetes להתקן NAS: {DeviceId}", id);
            return StatusCode(500, new { message = "שגיאה בביטול הקצאת משאבי Kubernetes", error = ex.Message });
        }
    }

    /// <summary>
    /// Test connection to a NAS device
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Connection test result</returns>
    [HttpPost("{id}/test-connection")]
    [ProducesResponseType(typeof(NasDeviceConnectionTestResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NasDeviceConnectionTestResult>> TestConnection(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _nasDeviceService.TestConnectionAsync(id, cancellationToken);

            if (result.ErrorMessage?.Contains("לא נמצא") == true)
            {
                return NotFound(new { message = result.ErrorMessage });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בבדיקת חיבור להתקן NAS: {DeviceId}", id);
            return StatusCode(500, new { message = "שגיאה בבדיקת חיבור", error = ex.Message });
        }
    }
}

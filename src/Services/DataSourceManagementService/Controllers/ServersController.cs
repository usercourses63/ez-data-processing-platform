using DataProcessing.DataSourceManagement.Hubs;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Bson;

namespace DataProcessing.DataSourceManagement.Controllers;

/// <summary>
/// Controller for managing admin servers (input/output file servers)
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
public class ServersController : ControllerBase
{
    private readonly IServerService _serverService;
    private readonly IHubContext<MonitoringHub> _hubContext;
    private readonly ILogger<ServersController> _logger;

    public ServersController(
        IServerService serverService,
        IHubContext<MonitoringHub> hubContext,
        ILogger<ServersController> logger)
    {
        _serverService = serverService;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Get all servers
    /// </summary>
    /// <param name="includeInactive">Include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of servers</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<AdminServer>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<AdminServer>>> GetAll(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var servers = await _serverService.GetAllServersAsync(includeInactive, cancellationToken);
            return Ok(servers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתים");
            return StatusCode(500, new { message = "שגיאה באחזור שרתים", error = ex.Message });
        }
    }

    /// <summary>
    /// Get input servers (for file discovery sources)
    /// </summary>
    /// <param name="includeInactive">Include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of input servers</returns>
    [HttpGet("input")]
    [ProducesResponseType(typeof(List<AdminServer>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<AdminServer>>> GetInputServers(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var servers = await _serverService.GetInputServersAsync(includeInactive, cancellationToken);
            return Ok(servers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתי קלט");
            return StatusCode(500, new { message = "שגיאה באחזור שרתי קלט", error = ex.Message });
        }
    }

    /// <summary>
    /// Get output servers (for file destinations)
    /// </summary>
    /// <param name="includeInactive">Include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of output servers</returns>
    [HttpGet("output")]
    [ProducesResponseType(typeof(List<AdminServer>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<AdminServer>>> GetOutputServers(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var servers = await _serverService.GetOutputServersAsync(includeInactive, cancellationToken);
            return Ok(servers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתי פלט");
            return StatusCode(500, new { message = "שגיאה באחזור שרתי פלט", error = ex.Message });
        }
    }

    /// <summary>
    /// Get available server types with their capabilities
    /// </summary>
    /// <returns>List of server type definitions</returns>
    [HttpGet("types")]
    [ProducesResponseType(typeof(List<ServerTypeDefinition>), StatusCodes.Status200OK)]
    public ActionResult<List<ServerTypeDefinition>> GetServerTypes()
    {
        try
        {
            var types = _serverService.GetAvailableServerTypes();
            return Ok(types);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור סוגי שרתים");
            return StatusCode(500, new { message = "שגיאה באחזור סוגי שרתים", error = ex.Message });
        }
    }

    /// <summary>
    /// Get a server by ID
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Server</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(AdminServer), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminServer>> GetById(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var server = await _serverService.GetServerByIdAsync(id, cancellationToken);

            if (server == null)
            {
                return NotFound(new { message = $"שרת לא נמצא: {id}" });
            }

            return Ok(server);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרת: {ServerId}", id);
            return StatusCode(500, new { message = "שגיאה באחזור שרת", error = ex.Message });
        }
    }

    /// <summary>
    /// Get servers by type
    /// </summary>
    /// <param name="serverType">Server type (ftp, sftp, s3, etc.)</param>
    /// <param name="includeInactive">Include inactive servers</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of servers</returns>
    [HttpGet("by-type/{serverType}")]
    [ProducesResponseType(typeof(List<AdminServer>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<AdminServer>>> GetByType(
        string serverType,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var servers = await _serverService.GetServersByTypeAsync(serverType, includeInactive, cancellationToken);
            return Ok(servers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור שרתים לפי סוג: {ServerType}", serverType);
            return StatusCode(500, new { message = "שגיאה באחזור שרתים", error = ex.Message });
        }
    }

    /// <summary>
    /// Create a new server
    /// </summary>
    /// <param name="request">Server creation request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created server</returns>
    [HttpPost]
    [ProducesResponseType(typeof(AdminServer), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminServer>> Create(
        [FromBody] CreateServerRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var server = new AdminServer
            {
                Name = request.Name,
                Description = request.Description,
                ServerType = request.ServerType,
                Direction = request.Direction,
                IsActive = request.IsActive,
                Host = request.Host,
                Port = request.Port,
                BasePath = request.BasePath,
                CredentialSecretRef = request.CredentialSecretRef,
                KafkaConfig = request.KafkaConfig != null ? MapKafkaConfig(request.KafkaConfig) : null,
                TypeSpecificConfig = ConvertToBsonDocument(request.TypeSpecificConfig),
                ConnectionTimeoutSeconds = request.ConnectionTimeoutSeconds,
                RetryCount = request.RetryCount
            };

            var created = await _serverService.CreateServerAsync(server, cancellationToken);

            await _hubContext.Clients.All.SendAsync("EntityChanged", new
            {
                EntityType = "AdminServer",
                EntityId = created.ID,
                Action = "created",
                Version = created.Version
            });

            return CreatedAtAction(nameof(GetById), new { id = created.ID }, created);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה ביצירת שרת");
            return StatusCode(500, new { message = "שגיאה ביצירת שרת", error = ex.Message });
        }
    }

    /// <summary>
    /// Update an existing server
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="request">Server update request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated server</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(AdminServer), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminServer>> Update(
        string id,
        [FromBody] UpdateServerRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var server = new AdminServer
            {
                Name = request.Name,
                Description = request.Description,
                ServerType = request.ServerType,
                Direction = request.Direction,
                IsActive = request.IsActive,
                Host = request.Host,
                Port = request.Port,
                BasePath = request.BasePath,
                CredentialSecretRef = request.CredentialSecretRef,
                KafkaConfig = request.KafkaConfig != null ? MapKafkaConfig(request.KafkaConfig) : null,
                TypeSpecificConfig = ConvertToBsonDocument(request.TypeSpecificConfig),
                ConnectionTimeoutSeconds = request.ConnectionTimeoutSeconds,
                RetryCount = request.RetryCount
            };

            var updated = await _serverService.UpdateServerAsync(id, server, cancellationToken);

            if (updated == null)
            {
                return NotFound(new { message = $"שרת לא נמצא: {id}" });
            }

            await _hubContext.Clients.All.SendAsync("EntityChanged", new
            {
                EntityType = "AdminServer",
                EntityId = id,
                Action = "updated",
                Version = updated.Version
            });

            return Ok(updated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בעדכון שרת: {ServerId}", id);
            return StatusCode(500, new { message = "שגיאה בעדכון שרת", error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a server
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var deleted = await _serverService.DeleteServerAsync(id, cancellationToken);

            if (!deleted)
            {
                return NotFound(new { message = $"שרת לא נמצא: {id}" });
            }

            await _hubContext.Clients.All.SendAsync("EntityChanged", new
            {
                EntityType = "AdminServer",
                EntityId = id,
                Action = "deleted",
                Version = 0
            });

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה במחיקת שרת: {ServerId}", id);
            return StatusCode(500, new { message = "שגיאה במחיקת שרת", error = ex.Message });
        }
    }

    /// <summary>
    /// Test connection to a server
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Connection test result</returns>
    [HttpPost("{id}/test-connection")]
    [ProducesResponseType(typeof(ServerConnectionTestResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ServerConnectionTestResult>> TestConnection(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _serverService.TestConnectionAsync(id, cancellationToken);

            if (result.ErrorMessage?.Contains("לא נמצא") == true)
            {
                return NotFound(new { message = result.ErrorMessage });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בבדיקת חיבור לשרת: {ServerId}", id);
            return StatusCode(500, new { message = "שגיאה בבדיקת חיבור", error = ex.Message });
        }
    }

    /// <summary>
    /// Toggle server active status
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="isActive">New active status</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated server</returns>
    [HttpPatch("{id}/toggle-active")]
    [ProducesResponseType(typeof(AdminServer), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminServer>> ToggleActive(
        string id,
        [FromQuery] bool isActive,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var server = await _serverService.ToggleServerActiveAsync(id, isActive, cancellationToken);

            if (server == null)
            {
                return NotFound(new { message = $"שרת לא נמצא: {id}" });
            }

            await _hubContext.Clients.All.SendAsync("EntityChanged", new
            {
                EntityType = "AdminServer",
                EntityId = id,
                Action = "updated",
                Version = server.Version
            });

            return Ok(server);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בשינוי סטטוס שרת: {ServerId}", id);
            return StatusCode(500, new { message = "שגיאה בשינוי סטטוס שרת", error = ex.Message });
        }
    }

    /// <summary>
    /// Get datasource usage count for a server
    /// </summary>
    /// <param name="id">Server ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Usage count</returns>
    [HttpGet("{id}/usage-count")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetUsageCount(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var server = await _serverService.GetServerByIdAsync(id, cancellationToken);

            if (server == null)
            {
                return NotFound(new { message = $"שרת לא נמצא: {id}" });
            }

            var count = await _serverService.GetDataSourceCountByServerAsync(id, cancellationToken);

            return Ok(new
            {
                serverId = id,
                serverName = server.Name,
                usageCount = count,
                canHardDelete = count == 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בקבלת מספר שימושים בשרת: {ServerId}", id);
            return StatusCode(500, new { message = "שגיאה בקבלת מספר שימושים", error = ex.Message });
        }
    }

    /// <summary>
    /// Map KafkaServerConfigRequest to KafkaServerConfig
    /// </summary>
    private static KafkaServerConfig MapKafkaConfig(KafkaServerConfigRequest request)
    {
        return new KafkaServerConfig
        {
            BootstrapServers = request.BootstrapServers,
            SecurityProtocol = request.SecurityProtocol,
            SaslMechanism = request.SaslMechanism,
            EnableSsl = request.EnableSsl,
            SslCaLocation = request.SslCaLocation,
            AcksRequired = request.AcksRequired,
            DefaultConsumerGroup = request.DefaultConsumerGroup,
            AdditionalConfig = request.AdditionalConfig
        };
    }

    /// <summary>
    /// Converts a Dictionary&lt;string, object&gt; (which may contain JsonElement values
    /// from System.Text.Json deserialization) to a BsonDocument. Delegates to the shared,
    /// unit-tested <see cref="ServerConfigConverter"/> so the PascalCase S3 key contract is
    /// preserved verbatim (Phase 34, Pitfall 2).
    /// </summary>
    private static BsonDocument? ConvertToBsonDocument(Dictionary<string, object>? dict)
        => ServerConfigConverter.ConvertToBsonDocument(dict);
}

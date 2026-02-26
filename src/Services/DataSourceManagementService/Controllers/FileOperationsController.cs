using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Connectors;
using Microsoft.AspNetCore.Mvc;

namespace DataProcessing.DataSourceManagement.Controllers;

/// <summary>
/// REST proxy for IServerConnector file operations (list, read, write).
/// Enables Playwright tests and external tools to exercise file operations
/// on any registered AdminServer via HTTP.
/// </summary>
[ApiController]
[Route("api/v1/file-operations")]
public class FileOperationsController : ControllerBase
{
    private readonly IFileOperationsService _fileOperationsService;
    private readonly ILogger<FileOperationsController> _logger;

    public FileOperationsController(
        IFileOperationsService fileOperationsService,
        ILogger<FileOperationsController> logger)
    {
        _fileOperationsService = fileOperationsService;
        _logger = logger;
    }

    /// <summary>
    /// List files on a server
    /// </summary>
    /// <param name="serverId">Admin server ID</param>
    /// <param name="request">List files request with optional path and pattern</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of discovered files</returns>
    [HttpPost("{serverId}/list")]
    [ProducesResponseType(typeof(List<DiscoveredFile>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> ListFiles(
        string serverId,
        [FromBody] ListFilesRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var files = await _fileOperationsService.ListFilesAsync(
                serverId,
                request.Path,
                request.Pattern ?? "*",
                cancellationToken);

            return Ok(files);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = $"שרת לא נמצא: {serverId}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בליסטינג קבצים בשרת: {ServerId}", serverId);
            return StatusCode(500, new { message = "שגיאה בליסטינג קבצים", error = ex.Message });
        }
    }

    /// <summary>
    /// Read a file from a server
    /// </summary>
    /// <param name="serverId">Admin server ID</param>
    /// <param name="request">Read file request with file path</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>File content as application/octet-stream</returns>
    [HttpPost("{serverId}/read")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> ReadFile(
        string serverId,
        [FromBody] ReadFileRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrEmpty(request.FilePath))
            {
                return BadRequest(new { message = "FilePath is required" });
            }

            var content = await _fileOperationsService.ReadFileAsync(
                serverId,
                request.FilePath,
                cancellationToken);

            return File(content, "application/octet-stream");
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = $"שרת לא נמצא: {serverId}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בקריאת קובץ מהשרת: {ServerId}, Path: {FilePath}", serverId, request.FilePath);
            return StatusCode(500, new { message = "שגיאה בקריאת קובץ", error = ex.Message });
        }
    }

    /// <summary>
    /// Write a file to a server
    /// </summary>
    /// <param name="serverId">Admin server ID</param>
    /// <param name="request">Write file request with file path and base64-encoded content</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Success or failure response</returns>
    [HttpPost("{serverId}/write")]
    [ProducesResponseType(typeof(FileOperationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> WriteFile(
        string serverId,
        [FromBody] WriteFileRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrEmpty(request.FilePath))
            {
                return BadRequest(new { message = "FilePath is required" });
            }

            if (string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(new { message = "Content is required (base64-encoded)" });
            }

            byte[] content;
            try
            {
                content = Convert.FromBase64String(request.Content);
            }
            catch (FormatException)
            {
                return BadRequest(new { message = "Content must be a valid base64-encoded string" });
            }

            await _fileOperationsService.WriteFileAsync(
                serverId,
                request.FilePath,
                content,
                cancellationToken);

            return Ok(FileOperationResponse.Success());
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = $"שרת לא נמצא: {serverId}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בכתיבת קובץ לשרת: {ServerId}, Path: {FilePath}", serverId, request.FilePath);
            return StatusCode(500, FileOperationResponse.Failure($"שגיאה בכתיבת קובץ: {ex.Message}"));
        }
    }
}

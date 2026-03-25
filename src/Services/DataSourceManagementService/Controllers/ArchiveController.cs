using DataProcessing.Shared.Services;
using Microsoft.AspNetCore.Mvc;

namespace DataProcessing.DataSourceManagement.Controllers;

/// <summary>
/// REST endpoints for server-side archive analysis and extraction.
/// Replaces the broken libarchive.js WASM frontend approach with
/// reliable SharpCompress-based backend processing.
/// </summary>
[ApiController]
[Route("api/v1/archive")]
public class ArchiveController : ControllerBase
{
    private readonly IArchiveService _archiveService;
    private readonly ILogger<ArchiveController> _logger;

    /// <summary>
    /// Maximum upload size: 100 MB
    /// </summary>
    private const long MaxUploadSizeBytes = 100 * 1024 * 1024;

    public ArchiveController(
        IArchiveService archiveService,
        ILogger<ArchiveController> logger)
    {
        _archiveService = archiveService;
        _logger = logger;
    }

    /// <summary>
    /// Analyze an archive file and list its contents.
    /// </summary>
    /// <param name="file">Archive file (multipart/form-data)</param>
    /// <param name="password">Optional password for encrypted archives</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Archive contents with metadata</returns>
    [HttpPost("analyze")]
    [RequestSizeLimit(MaxUploadSizeBytes)]
    [ProducesResponseType(typeof(ArchiveAnalyzeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Analyze(
        IFormFile file,
        [FromForm] string? password = null,
        CancellationToken cancellationToken = default)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file provided" });
        }

        if (file.Length > MaxUploadSizeBytes)
        {
            return BadRequest(new { message = $"File exceeds maximum size of {MaxUploadSizeBytes / (1024 * 1024)} MB" });
        }

        _logger.LogInformation(
            "Analyzing archive: {FileName} ({Size:N0} bytes)",
            file.FileName, file.Length);

        try
        {
            // Read file into byte array
            byte[] archiveContent;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms, cancellationToken);
                archiveContent = ms.ToArray();
            }

            // Detect archive type
            var archiveType = _archiveService.GetArchiveType(file.FileName, archiveContent);
            if (archiveType == null)
            {
                return BadRequest(new { message = "File is not a recognized archive format" });
            }

            // List contents
            var entries = await _archiveService.ListContentsAsync(
                archiveContent,
                archiveType,
                password,
                ArchiveSecuritySettings.Default,
                cancellationToken);

            var isEncrypted = entries.Any(e => e.IsEncrypted);

            var response = new ArchiveAnalyzeResponse
            {
                Files = entries.Select(e => new ArchiveFileInfo
                {
                    Name = e.Path,
                    Size = e.UncompressedSize,
                    IsDirectory = e.IsDirectory
                }).ToList(),
                ArchiveType = MapArchiveType(archiveType.Value),
                IsEncrypted = isEncrypted
            };

            return Ok(response);
        }
        catch (ArchivePasswordException ex)
        {
            _logger.LogWarning(ex, "Password required or incorrect for archive: {FileName}", file.FileName);
            // Return partial response indicating encryption
            return Ok(new ArchiveAnalyzeResponse
            {
                Files = new List<ArchiveFileInfo>(),
                ArchiveType = MapArchiveType(
                    _archiveService.GetArchiveType(file.FileName) ?? Shared.Services.ArchiveType.Zip),
                IsEncrypted = true
            });
        }
        catch (ArchiveSecurityException ex)
        {
            _logger.LogWarning(ex, "Security violation analyzing archive: {FileName}", file.FileName);
            return BadRequest(new { message = $"Archive security violation: {ex.Message}" });
        }
        catch (ArchiveException ex)
        {
            _logger.LogError(ex, "Error analyzing archive: {FileName}", file.FileName);
            return BadRequest(new { message = $"Archive error: {ex.Message}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error analyzing archive: {FileName}", file.FileName);
            return StatusCode(500, new { message = "Internal error analyzing archive", error = ex.Message });
        }
    }

    /// <summary>
    /// Extract a specific file from an archive.
    /// </summary>
    /// <param name="file">Archive file (multipart/form-data)</param>
    /// <param name="filename">Path of the file to extract within the archive</param>
    /// <param name="password">Optional password for encrypted archives</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Extracted file content as application/octet-stream</returns>
    [HttpPost("extract")]
    [RequestSizeLimit(MaxUploadSizeBytes)]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Extract(
        IFormFile file,
        [FromForm] string filename,
        [FromForm] string? password = null,
        CancellationToken cancellationToken = default)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file provided" });
        }

        if (string.IsNullOrWhiteSpace(filename))
        {
            return BadRequest(new { message = "No filename specified for extraction" });
        }

        if (file.Length > MaxUploadSizeBytes)
        {
            return BadRequest(new { message = $"File exceeds maximum size of {MaxUploadSizeBytes / (1024 * 1024)} MB" });
        }

        _logger.LogInformation(
            "Extracting '{EntryPath}' from archive: {FileName}",
            filename, file.FileName);

        try
        {
            // Read file into byte array
            byte[] archiveContent;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms, cancellationToken);
                archiveContent = ms.ToArray();
            }

            // Detect archive type
            var archiveType = _archiveService.GetArchiveType(file.FileName, archiveContent);

            // Extract the requested file
            var extractedContent = await _archiveService.ExtractFileAsync(
                archiveContent,
                filename,
                archiveType,
                password,
                ArchiveSecuritySettings.Default,
                cancellationToken);

            // Determine content type from the extracted filename
            var contentType = "application/octet-stream";
            var extractedFileName = Path.GetFileName(filename);

            return File(extractedContent, contentType, extractedFileName);
        }
        catch (ArchiveEntryNotFoundException ex)
        {
            _logger.LogWarning(ex, "Entry not found: {EntryPath} in {FileName}", filename, file.FileName);
            return NotFound(new { message = $"File '{filename}' not found in archive" });
        }
        catch (ArchivePasswordException ex)
        {
            _logger.LogWarning(ex, "Password required for extraction from: {FileName}", file.FileName);
            return BadRequest(new { message = "Invalid or missing password for encrypted archive" });
        }
        catch (ArchiveSecurityException ex)
        {
            _logger.LogWarning(ex, "Security violation extracting from: {FileName}", file.FileName);
            return BadRequest(new { message = $"Archive security violation: {ex.Message}" });
        }
        catch (ArchiveException ex)
        {
            _logger.LogError(ex, "Error extracting from archive: {FileName}", file.FileName);
            return BadRequest(new { message = $"Archive error: {ex.Message}" });
        }
        catch (Exception ex) when (
            ex.Message.Contains("password", StringComparison.OrdinalIgnoreCase) ||
            ex.Message.Contains("encrypted", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(ex, "Password required for extraction from: {FileName}", file.FileName);
            return BadRequest(new { message = "Invalid or missing password for encrypted archive" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error extracting from archive: {FileName}", file.FileName);
            return StatusCode(500, new { message = "Internal error extracting file", error = ex.Message });
        }
    }

    /// <summary>
    /// Map backend ArchiveType enum to frontend string representation
    /// </summary>
    private static string MapArchiveType(Shared.Services.ArchiveType type) => type switch
    {
        Shared.Services.ArchiveType.Zip => "zip",
        Shared.Services.ArchiveType.TarGz => "tar.gz",
        Shared.Services.ArchiveType.Tar => "tar.gz",
        Shared.Services.ArchiveType.Rar => "rar",
        Shared.Services.ArchiveType.SevenZip => "7z",
        Shared.Services.ArchiveType.GZip => "tar.gz",
        Shared.Services.ArchiveType.BZip2 => "tar.gz",
        _ => "zip"
    };
}

/// <summary>
/// Response model for archive analysis
/// </summary>
public class ArchiveAnalyzeResponse
{
    public List<ArchiveFileInfo> Files { get; set; } = new();
    public string ArchiveType { get; set; } = "zip";
    public bool IsEncrypted { get; set; }
}

/// <summary>
/// Information about a single file within an archive
/// </summary>
public class ArchiveFileInfo
{
    public string Name { get; set; } = string.Empty;
    public long Size { get; set; }
    public bool IsDirectory { get; set; }
}

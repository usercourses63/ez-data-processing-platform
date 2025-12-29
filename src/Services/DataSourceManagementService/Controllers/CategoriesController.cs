using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Entities;
using Microsoft.AspNetCore.Mvc;

namespace DataProcessing.DataSourceManagement.Controllers;

/// <summary>
/// Controller for managing datasource categories
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;
    private readonly ILogger<CategoriesController> _logger;

    public CategoriesController(
        ICategoryService categoryService,
        ILogger<CategoriesController> logger)
    {
        _categoryService = categoryService;
        _logger = logger;
    }

    /// <summary>
    /// Get all categories
    /// </summary>
    /// <param name="includeInactive">Include inactive categories</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of categories</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<DataSourceCategory>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DataSourceCategory>>> GetAll(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var categories = await _categoryService.GetAllCategoriesAsync(includeInactive, cancellationToken);
            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור קטגוריות");
            return StatusCode(500, new { message = "שגיאה באחזור קטגוריות", error = ex.Message });
        }
    }

    /// <summary>
    /// Get a category by ID
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Category</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(DataSourceCategory), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DataSourceCategory>> GetById(
        string id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var category = await _categoryService.GetCategoryByIdAsync(id, cancellationToken);

            if (category == null)
            {
                return NotFound(new { message = $"קטגוריה לא נמצאה: {id}" });
            }

            return Ok(category);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור קטגוריה: {CategoryId}", id);
            return StatusCode(500, new { message = "שגיאה באחזור קטגוריה", error = ex.Message });
        }
    }

    /// <summary>
    /// Create a new category
    /// </summary>
    /// <param name="request">Category creation request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created category</returns>
    [HttpPost]
    [ProducesResponseType(typeof(DataSourceCategory), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DataSourceCategory>> Create(
        [FromBody] CreateCategoryRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var category = new DataSourceCategory
            {
                Name = request.Name,
                NameEn = request.NameEn,
                Description = request.Description,
                SortOrder = request.SortOrder ?? 0,
                IsActive = request.IsActive
            };

            var created = await _categoryService.CreateCategoryAsync(category, cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = created.ID }, created);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה ביצירת קטגוריה");
            return StatusCode(500, new { message = "שגיאה ביצירת קטגוריה", error = ex.Message });
        }
    }

    /// <summary>
    /// Update an existing category
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="request">Category update request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated category</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(DataSourceCategory), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DataSourceCategory>> Update(
        string id,
        [FromBody] UpdateCategoryRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var category = new DataSourceCategory
            {
                Name = request.Name,
                NameEn = request.NameEn,
                Description = request.Description,
                SortOrder = request.SortOrder,
                IsActive = request.IsActive
            };

            var updated = await _categoryService.UpdateCategoryAsync(id, category, cancellationToken);

            if (updated == null)
            {
                return NotFound(new { message = $"קטגוריה לא נמצאה: {id}" });
            }

            return Ok(updated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בעדכון קטגוריה: {CategoryId}", id);
            return StatusCode(500, new { message = "שגיאה בעדכון קטגוריה", error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a category
    /// </summary>
    /// <param name="id">Category ID</param>
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
            var deleted = await _categoryService.DeleteCategoryAsync(id, cancellationToken);

            if (!deleted)
            {
                return NotFound(new { message = $"קטגוריה לא נמצאה: {id}" });
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה במחיקת קטגוריה: {CategoryId}", id);
            return StatusCode(500, new { message = "שגיאה במחיקת קטגוריה", error = ex.Message });
        }
    }

    /// <summary>
    /// Reorder categories
    /// </summary>
    /// <param name="request">Reorder request with ordered category IDs</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Success status</returns>
    [HttpPost("reorder")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reorder(
        [FromBody] ReorderCategoriesRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            await _categoryService.ReorderCategoriesAsync(request.CategoryIds, cancellationToken);

            return Ok(new { message = "קטגוריות סודרו מחדש בהצלחה" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בסידור מחדש של קטגוריות");
            return StatusCode(500, new { message = "שגיאה בסידור מחדש של קטגוריות", error = ex.Message });
        }
    }

    /// <summary>
    /// Toggle category active status
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="isActive">New active status</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated category</returns>
    [HttpPatch("{id}/toggle-active")]
    [ProducesResponseType(typeof(DataSourceCategory), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DataSourceCategory>> ToggleActive(
        string id,
        [FromQuery] bool isActive,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var category = await _categoryService.ToggleCategoryActiveAsync(id, isActive, cancellationToken);

            if (category == null)
            {
                return NotFound(new { message = $"קטגוריה לא נמצאה: {id}" });
            }

            return Ok(category);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בשינוי סטטוס קטגוריה: {CategoryId}", id);
            return StatusCode(500, new { message = "שגיאה בשינוי סטטוס קטגוריה", error = ex.Message });
        }
    }

    /// <summary>
    /// Get datasource usage count for a category
    /// </summary>
    /// <param name="id">Category ID</param>
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
            var category = await _categoryService.GetCategoryByIdAsync(id, cancellationToken);

            if (category == null)
            {
                return NotFound(new { message = $"קטגוריה לא נמצאה: {id}" });
            }

            var count = await _categoryService.GetDataSourceCountByCategoryAsync(category.Name, cancellationToken);

            return Ok(new
            {
                categoryId = id,
                categoryName = category.Name,
                usageCount = count,
                canHardDelete = count == 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בקבלת מספר שימושים בקטגוריה: {CategoryId}", id);
            return StatusCode(500, new { message = "שגיאה בקבלת מספר שימושים", error = ex.Message });
        }
    }
}

using DataProcessing.Shared.Entities;
using MongoDB.Entities;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service for managing datasource categories
/// </summary>
public class CategoryService : ICategoryService
{
    private readonly ILogger<CategoryService> _logger;

    public CategoryService(ILogger<CategoryService> logger)
    {
        _logger = logger;
    }

    public async Task<List<DataSourceCategory>> GetAllCategoriesAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving all categories. IncludeInactive: {IncludeInactive}", includeInactive);

            var query = DB.Find<DataSourceCategory, DataSourceCategory>();

            if (!includeInactive)
            {
                query = query.Match(c => c.IsActive == true);
            }

            var categories = await query
                .Sort(c => c.SortOrder, MongoDB.Entities.Order.Ascending)
                .ExecuteAsync(cancellationToken);

            _logger.LogInformation("Retrieved {Count} categories", categories.Count);
            return categories;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור קטגוריות");
            throw;
        }
    }

    public async Task<DataSourceCategory?> GetCategoryByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Retrieving category by ID: {CategoryId}", id);
            return await DB.Find<DataSourceCategory, DataSourceCategory>().OneAsync(id, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה באחזור קטגוריה: {CategoryId}", id);
            throw;
        }
    }

    public async Task<DataSourceCategory> CreateCategoryAsync(DataSourceCategory category, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Creating new category: {CategoryName}", category.Name);

            // Set default sort order to highest + 1 if not specified
            if (category.SortOrder == 0)
            {
                var maxSortOrder = await DB.Find<DataSourceCategory, DataSourceCategory>()
                    .Sort(c => c.SortOrder, MongoDB.Entities.Order.Descending)
                    .Limit(1)
                    .ExecuteAsync(cancellationToken);

                category.SortOrder = maxSortOrder.Any() ? maxSortOrder[0].SortOrder + 1 : 1;
            }

            category.CreatedAt = DateTime.UtcNow;
            category.UpdatedAt = DateTime.UtcNow;

            await category.SaveAsync(cancellation: cancellationToken);

            _logger.LogInformation("קטגוריה נוצרה בהצלחה: {CategoryId}", category.ID);
            return category;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה ביצירת קטגוריה: {CategoryName}", category.Name);
            throw;
        }
    }

    public async Task<DataSourceCategory?> UpdateCategoryAsync(string id, DataSourceCategory category, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Updating category: {CategoryId}", id);

            var existing = await GetCategoryByIdAsync(id, cancellationToken);
            if (existing == null)
            {
                _logger.LogWarning("קטגוריה לא נמצאה: {CategoryId}", id);
                return null;
            }

            // If name is changing, propagate to all datasources
            if (existing.Name != category.Name)
            {
                _logger.LogInformation("שם קטגוריה משתנה מ-'{OldName}' ל-'{NewName}', מעדכן datasources...",
                    existing.Name, category.Name);

                var updatedCount = await PropagateRenameToDataSourcesAsync(id, existing.Name, category.Name, cancellationToken);

                _logger.LogInformation("עודכנו {Count} datasources עם שם קטגוריה חדש", updatedCount);
            }

            existing.Name = category.Name;
            existing.NameEn = category.NameEn;
            existing.Description = category.Description;
            existing.SortOrder = category.SortOrder;
            existing.IsActive = category.IsActive;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.ModifiedBy = category.ModifiedBy;

            await existing.SaveAsync(cancellation: cancellationToken);

            _logger.LogInformation("קטגוריה עודכנה בהצלחה: {CategoryId}", id);
            return existing;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בעדכון קטגוריה: {CategoryId}", id);
            throw;
        }
    }

    public async Task<int> PropagateRenameToDataSourcesAsync(string id, string oldName, string newName, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("מעדכן datasources: '{OldName}' → '{NewName}'", oldName, newName);

            var result = await DB.Update<DataProcessingDataSource>()
                .Match(ds => ds.Category == oldName)
                .Modify(ds => ds.Category, newName)
                .Modify(ds => ds.UpdatedAt, DateTime.UtcNow)
                .ExecuteAsync(cancellationToken);

            _logger.LogInformation("עודכנו {Count} datasources בהצלחה", result.ModifiedCount);
            return (int)result.ModifiedCount;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בהעברת שינויים ל-datasources");
            throw;
        }
    }

    public async Task<long> GetDataSourceCountByCategoryAsync(string categoryName, CancellationToken cancellationToken = default)
    {
        try
        {
            var count = await DB.CountAsync<DataProcessingDataSource>(
                ds => ds.Category == categoryName);

            _logger.LogInformation("מספר datasources המשתמשים בקטגוריה '{CategoryName}': {Count}", categoryName, count);
            return count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בספירת datasources לקטגוריה: {CategoryName}", categoryName);
            throw;
        }
    }

    public async Task<bool> DeleteCategoryAsync(string id, CancellationToken cancellationToken = default)
    {
        try
        {
            var category = await GetCategoryByIdAsync(id, cancellationToken);
            if (category == null)
            {
                _logger.LogWarning("קטגוריה לא נמצאה למחיקה: {CategoryId}", id);
                return false;
            }

            // Check if any datasources are using this category
            var usageCount = await GetDataSourceCountByCategoryAsync(category.Name, cancellationToken);

            if (usageCount > 0)
            {
                // Soft delete: mark as inactive if in use
                _logger.LogInformation("קטגוריה '{CategoryName}' בשימוש על ידי {Count} datasources - מבצע soft delete",
                    category.Name, usageCount);

                category.IsActive = false;
                category.UpdatedAt = DateTime.UtcNow;
                await category.SaveAsync(cancellation: cancellationToken);

                _logger.LogInformation("✅ קטגוריה סומנה כלא פעילה (soft delete): {CategoryId}", id);
            }
            else
            {
                // Hard delete: permanently remove if not in use
                _logger.LogInformation("קטגוריה '{CategoryName}' אינה בשימוש - מבצע hard delete", category.Name);

                var result = await DB.DeleteAsync<DataSourceCategory>(id);

                if (result.DeletedCount > 0)
                {
                    _logger.LogInformation("✅ קטגוריה נמחקה לצמיתות (hard delete): {CategoryId}", id);
                }
                else
                {
                    _logger.LogWarning("⚠️ לא הצלחנו למחוק קטגוריה: {CategoryId}", id);
                    return false;
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ שגיאה במחיקת קטגוריה: {CategoryId}", id);
            throw;
        }
    }

    public async Task<bool> ReorderCategoriesAsync(List<string> categoryIds, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Reordering {Count} categories", categoryIds.Count);

            for (int i = 0; i < categoryIds.Count; i++)
            {
                await DB.Update<DataSourceCategory>()
                    .MatchID(categoryIds[i])
                    .Modify(c => c.SortOrder, i + 1)
                    .Modify(c => c.UpdatedAt, DateTime.UtcNow)
                    .ExecuteAsync(cancellationToken);
            }

            _logger.LogInformation("סידור קטגוריות הושלם בהצלחה");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בסידור מחדש של קטגוריות");
            throw;
        }
    }

    public async Task<DataSourceCategory?> ToggleCategoryActiveAsync(string id, bool isActive, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Toggling category active status: {CategoryId} -> {IsActive}", id, isActive);

            var category = await GetCategoryByIdAsync(id, cancellationToken);
            if (category == null)
            {
                _logger.LogWarning("קטגוריה לא נמצאה: {CategoryId}", id);
                return null;
            }

            category.IsActive = isActive;
            category.UpdatedAt = DateTime.UtcNow;
            await category.SaveAsync(cancellation: cancellationToken);

            _logger.LogInformation("סטטוס קטגוריה עודכן בהצלחה: {CategoryId}", id);
            return category;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בשינוי סטטוס קטגוריה: {CategoryId}", id);
            throw;
        }
    }
}

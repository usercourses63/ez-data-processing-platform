using DataProcessing.Shared.Entities;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service interface for managing datasource categories
/// </summary>
public interface ICategoryService
{
    /// <summary>
    /// Get all categories ordered by SortOrder
    /// </summary>
    /// <param name="includeInactive">Whether to include inactive categories</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of categories</returns>
    Task<List<DataSourceCategory>> GetAllCategoriesAsync(bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a category by ID
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Category or null if not found</returns>
    Task<DataSourceCategory?> GetCategoryByIdAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Create a new category
    /// </summary>
    /// <param name="category">Category to create</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created category</returns>
    Task<DataSourceCategory> CreateCategoryAsync(DataSourceCategory category, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update an existing category
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="category">Updated category data</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated category or null if not found</returns>
    Task<DataSourceCategory?> UpdateCategoryAsync(string id, DataSourceCategory category, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get count of datasources using a specific category
    /// </summary>
    /// <param name="categoryName">Category name to check</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Number of datasources using this category</returns>
    Task<long> GetDataSourceCountByCategoryAsync(string categoryName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a category (smart delete: hard delete if unused, soft delete if in use)
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if deleted, false if not found</returns>
    Task<bool> DeleteCategoryAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reorder categories by updating their SortOrder values
    /// </summary>
    /// <param name="categoryIds">Ordered list of category IDs</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if successful</returns>
    Task<bool> ReorderCategoriesAsync(List<string> categoryIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Toggle category active status
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="isActive">New active status</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated category or null if not found</returns>
    Task<DataSourceCategory?> ToggleCategoryActiveAsync(string id, bool isActive, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update category name and propagate changes to all datasources using this category
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="oldName">Current category name</param>
    /// <param name="newName">New category name</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Number of datasources updated</returns>
    Task<int> PropagateRenameToDataSourcesAsync(string id, string oldName, string newName, CancellationToken cancellationToken = default);
}

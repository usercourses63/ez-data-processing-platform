using InvalidRecordsService.Models.Responses;

namespace InvalidRecordsService.Services;

/// <summary>
/// Service for bulk revalidation of invalid records triggered by schema changes
/// </summary>
public interface IRevalidationService
{
    /// <summary>
    /// Bulk revalidates all non-ignored invalid records for a datasource by publishing
    /// ValidationRequestEvents. Processes in batches of 100 with rate limiting for large datasets.
    /// </summary>
    /// <param name="dataSourceId">The datasource whose invalid records should be revalidated</param>
    /// <param name="triggeredBy">Description of what triggered the revalidation (e.g., "SchemaChange", "Manual")</param>
    /// <returns>Result containing counts of published, skipped, and failed records</returns>
    Task<BulkRevalidationResult> BulkRevalidateByDataSourceAsync(string dataSourceId, string triggeredBy);
}

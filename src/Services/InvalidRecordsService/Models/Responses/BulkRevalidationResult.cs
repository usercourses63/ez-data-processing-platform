namespace InvalidRecordsService.Models.Responses;

/// <summary>
/// Result of a bulk revalidation operation triggered by schema change or manual action
/// </summary>
public class BulkRevalidationResult
{
    /// <summary>
    /// Total number of non-ignored invalid records found for the datasource
    /// </summary>
    public int TotalRecords { get; set; }

    /// <summary>
    /// Number of ValidationRequestEvents successfully published
    /// </summary>
    public int Published { get; set; }

    /// <summary>
    /// Number of records skipped (e.g., already being reprocessed)
    /// </summary>
    public int Skipped { get; set; }

    /// <summary>
    /// Number of records that failed to publish
    /// </summary>
    public int Failed { get; set; }

    /// <summary>
    /// Error messages for failed records
    /// </summary>
    public List<string> Errors { get; set; } = new();
}

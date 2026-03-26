namespace DataProcessing.Shared.Messages;

/// <summary>
/// Event published when a data source schema is modified.
/// Consumed by InvalidRecordsService to trigger bulk revalidation of affected records.
/// </summary>
public class SchemaUpdatedEvent : IDataProcessingMessage
{
    public string CorrelationId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string PublishedBy { get; set; } = "DataSourceManagementService";
    public int MessageVersion { get; set; } = 1;

    /// <summary>
    /// Data source identifier whose schema was updated
    /// </summary>
    public string DataSourceId { get; set; } = string.Empty;

    /// <summary>
    /// Data source display name
    /// </summary>
    public string DataSourceName { get; set; } = string.Empty;

    /// <summary>
    /// Schema version before the update
    /// </summary>
    public int PreviousSchemaVersion { get; set; }

    /// <summary>
    /// Schema version after the update (auto-incremented)
    /// </summary>
    public int NewSchemaVersion { get; set; }

    /// <summary>
    /// User who triggered the schema update
    /// </summary>
    public string UpdatedBy { get; set; } = string.Empty;
}

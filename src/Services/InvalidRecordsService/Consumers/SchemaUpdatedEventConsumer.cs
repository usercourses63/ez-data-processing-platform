using DataProcessing.Shared.Consumers;
using DataProcessing.Shared.Messages;
using InvalidRecordsService.Services;
using MassTransit;

namespace InvalidRecordsService.Consumers;

/// <summary>
/// Consumes SchemaUpdatedEvent published by DataSourceManagementService when a datasource
/// schema is modified. Triggers bulk revalidation of all non-ignored invalid records
/// for the affected datasource.
/// </summary>
public class SchemaUpdatedEventConsumer : DataProcessingConsumerBase<SchemaUpdatedEvent>
{
    private readonly IRevalidationService _revalidationService;

    public SchemaUpdatedEventConsumer(
        ILogger<SchemaUpdatedEventConsumer> logger,
        IRevalidationService revalidationService)
        : base(logger)
    {
        _revalidationService = revalidationService;
    }

    protected override async Task ProcessMessage(ConsumeContext<SchemaUpdatedEvent> context)
    {
        var message = context.Message;

        Logger.LogInformation(
            "Received SchemaUpdatedEvent for datasource {DataSourceId} ({DataSourceName}), schema version {PreviousVersion} -> {NewVersion}. CorrelationId: {CorrelationId}",
            message.DataSourceId, message.DataSourceName, message.PreviousSchemaVersion, message.NewSchemaVersion, message.CorrelationId);

        var result = await _revalidationService.BulkRevalidateByDataSourceAsync(
            message.DataSourceId, "SchemaChange");

        Logger.LogInformation(
            "Schema change revalidation complete for datasource {DataSourceId}: {Published} records published for revalidation, {Failed} failed, {TotalRecords} total. CorrelationId: {CorrelationId}",
            message.DataSourceId, result.Published, result.Failed, result.TotalRecords, message.CorrelationId);
    }
}

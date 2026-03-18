using MassTransit;
using DataProcessing.DataSourceManagement.Models;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Messages;

namespace DataProcessing.DataSourceManagement.Consumers;

/// <summary>
/// MassTransit consumer that listens to pipeline events and pushes them
/// to SignalR via the MonitoringBroadcaster for real-time UI updates.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public class PipelineEventConsumer :
    IConsumer<FileDiscoveredEvent>,
    IConsumer<ValidationCompletedEvent>,
    IConsumer<FileProcessingFailedEvent>,
    IConsumer<FileProcessingCompletedEvent>
{
    private readonly MonitoringBroadcaster _broadcaster;
    private readonly ILogger<PipelineEventConsumer> _logger;

    public PipelineEventConsumer(
        MonitoringBroadcaster broadcaster,
        ILogger<PipelineEventConsumer> logger)
    {
        _broadcaster = broadcaster;
        _logger = logger;
    }

    public Task Consume(ConsumeContext<FileDiscoveredEvent> context)
    {
        var msg = context.Message;
        var evt = new PipelineEventDto
        {
            Id = Guid.NewGuid().ToString(),
            Timestamp = msg.Timestamp,
            Service = msg.PublishedBy,
            Level = "info",
            Message = $"File discovered: {msg.FileName} ({msg.FileSizeBytes} bytes)",
            CorrelationId = msg.CorrelationId
        };

        _logger.LogDebug("Pipeline event: FileDiscovered {FileName}", msg.FileName);
        _broadcaster.AddPipelineEvent(evt);
        return Task.CompletedTask;
    }

    public Task Consume(ConsumeContext<ValidationCompletedEvent> context)
    {
        var msg = context.Message;
        var evt = new PipelineEventDto
        {
            Id = Guid.NewGuid().ToString(),
            Timestamp = msg.Timestamp,
            Service = msg.PublishedBy,
            Level = msg.IsSuccessful ? "info" : "warn",
            Message = $"Validated {msg.FileName}: {msg.ValidRecords}/{msg.TotalRecords} records valid",
            CorrelationId = msg.CorrelationId
        };

        _logger.LogDebug("Pipeline event: ValidationCompleted {FileName}", msg.FileName);
        _broadcaster.AddPipelineEvent(evt);
        return Task.CompletedTask;
    }

    public Task Consume(ConsumeContext<FileProcessingFailedEvent> context)
    {
        var msg = context.Message;
        var evt = new PipelineEventDto
        {
            Id = Guid.NewGuid().ToString(),
            Timestamp = msg.Timestamp,
            Service = msg.PublishedBy,
            Level = "error",
            Message = $"Failed: {msg.FileName} at {msg.FailureStage} - {msg.ErrorMessage}",
            CorrelationId = msg.CorrelationId
        };

        _logger.LogDebug("Pipeline event: ProcessingFailed {FileName}", msg.FileName);
        _broadcaster.AddPipelineEvent(evt);
        return Task.CompletedTask;
    }

    public Task Consume(ConsumeContext<FileProcessingCompletedEvent> context)
    {
        var msg = context.Message;
        var evt = new PipelineEventDto
        {
            Id = Guid.NewGuid().ToString(),
            Timestamp = msg.Timestamp,
            Service = msg.PublishedBy,
            Level = "info",
            Message = $"Processing complete: {msg.FilesProcessed} files, {msg.TotalRecords} records",
            CorrelationId = msg.CorrelationId
        };

        _logger.LogDebug("Pipeline event: ProcessingCompleted {FilesProcessed} files", msg.FilesProcessed);
        _broadcaster.AddPipelineEvent(evt);
        return Task.CompletedTask;
    }
}

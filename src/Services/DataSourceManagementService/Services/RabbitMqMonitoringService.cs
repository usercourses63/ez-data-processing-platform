using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DataProcessing.DataSourceManagement.Models;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Queries RabbitMQ Management HTTP API for queue metrics.
/// MassTransit creates queues named after consumer types (e.g., "DataProcessing.Shared.Messages:FileDiscoveredEvent").
/// v0.3.0: Replace Kafka monitoring with RabbitMQ/MassTransit
/// </summary>
public class RabbitMqMonitoringService : IKafkaMonitoringService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RabbitMqMonitoringService> _logger;

    // Map MassTransit queue name patterns to friendly display names
    private static readonly Dictionary<string, string> QueueDisplayNames = new()
    {
        ["file-discovered"] = "File Discovered",
        ["file-polling"] = "File Polling",
        ["validation-request"] = "Validation Request",
        ["validation-completed"] = "Validation Completed",
        ["processing-failed"] = "Processing Failed",
        ["datasource-created"] = "DataSource Created",
        ["datasource-updated"] = "DataSource Updated",
        ["datasource-deleted"] = "DataSource Deleted",
    };

    public RabbitMqMonitoringService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<RabbitMqMonitoringService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<List<QueueStatusDto>> GetQueueStatusesAsync(CancellationToken ct)
    {
        var result = new List<QueueStatusDto>();

        try
        {
            var managementUrl = _configuration["RabbitMQ:ManagementUrl"] ?? "http://rabbitmq:15672";
            var username = _configuration["RabbitMQ:Username"] ?? "guest";
            var password = _configuration["RabbitMQ:Password"] ?? "guest";

            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
                "Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes($"{username}:{password}")));

            var response = await client.GetAsync($"{managementUrl}/api/queues/%2F", ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RabbitMQ management API returned {Status}", response.StatusCode);
                return result;
            }

            var content = await response.Content.ReadAsStringAsync(ct);
            var queues = JsonSerializer.Deserialize<JsonElement[]>(content) ?? [];

            foreach (var queue in queues)
            {
                var queueName = queue.GetProperty("name").GetString() ?? "";

                // Skip internal RabbitMQ queues and error/skipped queues
                if (queueName.StartsWith("amq.") || string.IsNullOrEmpty(queueName))
                    continue;

                // Find friendly display name or use queue name
                var displayName = queueName;
                foreach (var (pattern, friendly) in QueueDisplayNames)
                {
                    if (queueName.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                    {
                        displayName = friendly;
                        break;
                    }
                }

                var messageCount = queue.TryGetProperty("messages", out var msgs) ? msgs.GetInt64() : 0;
                var consumerCount = queue.TryGetProperty("consumers", out var cons) ? cons.GetInt32() : 0;
                var messageRate = 0.0;
                if (queue.TryGetProperty("message_stats", out var stats) &&
                    stats.TryGetProperty("publish_details", out var pubDetails) &&
                    pubDetails.TryGetProperty("rate", out var rate))
                {
                    messageRate = rate.GetDouble();
                }

                var status = messageCount switch
                {
                    > 1000 => "error",
                    > 100 => "warning",
                    _ => "healthy"
                };

                // Mark as warning if no consumers for a non-empty queue
                if (messageCount > 0 && consumerCount == 0)
                    status = "warning";

                result.Add(new QueueStatusDto
                {
                    Name = displayName,
                    Topic = queueName,
                    Depth = messageCount,
                    Rate = messageRate,
                    Consumers = consumerCount,
                    Status = status,
                });
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to get RabbitMQ queue statuses");
        }

        return result;
    }
}

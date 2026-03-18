using Confluent.Kafka;
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Entities;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Polly;
using Polly.Registry;
using System.Text;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading messages from Kafka topics as files
/// Each message or batch of messages is treated as a file
/// </summary>
public class KafkaConnector : IDataSourceConnector
{
    private readonly ILogger<KafkaConnector> _logger;
    private readonly ResiliencePipeline _pipeline;

    public string ConnectorType => "kafka";

    public KafkaConnector(
        ILogger<KafkaConnector> logger,
        ResiliencePipelineProvider<string> pipelineProvider)
    {
        _logger = logger;
        _pipeline = pipelineProvider.GetPipeline(ResilienceConfiguration.ExternalConnectorPipelineKey);
    }

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        // For Kafka, filePath is treated as topic:partition:offset format
        var parts = filePath.Split(':');
        if (parts.Length != 3)
        {
            throw new ArgumentException("File path must be in format 'topic:partition:offset'");
        }

        var topic = parts[0];
        var partition = int.Parse(parts[1]);
        var offset = long.Parse(parts[2]);

        try
        {
            return await _pipeline.ExecuteAsync(ct =>
            {
                var config = GetKafkaConfig(dataSource);
                var consumerConfig = new ConsumerConfig
                {
                    BootstrapServers = config.BootstrapServers,
                    GroupId = config.ConsumerGroup,
                    AutoOffsetReset = AutoOffsetReset.Earliest,
                    EnableAutoCommit = false
                };

                using var consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();

                var topicPartition = new TopicPartition(topic, partition);
                var topicPartitionOffset = new TopicPartitionOffset(topicPartition, new Offset(offset));

                consumer.Assign(topicPartitionOffset);
                var result = consumer.Consume(ct);

                if (result == null)
                {
                    throw new FileNotFoundException($"No message found at {filePath}");
                }

                var content = Encoding.UTF8.GetBytes(result.Message.Value);
                return ValueTask.FromResult<Stream>(new MemoryStream(content));
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading from Kafka: {FilePath}", filePath);
            throw;
        }
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        // For Kafka, list recent messages from topic (last N messages)
        var topic = dataSource.FilePath; // Topic name

        try
        {
            return await _pipeline.ExecuteAsync(ct =>
            {
                var config = GetKafkaConfig(dataSource);
                var consumerConfig = new ConsumerConfig
                {
                    BootstrapServers = config.BootstrapServers,
                    GroupId = config.ConsumerGroup,
                    AutoOffsetReset = AutoOffsetReset.Latest,
                    EnableAutoCommit = false
                };

                using var consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
                consumer.Subscribe(topic);

                var files = new List<string>();
                var maxMessages = config.MaxMessagesToList;
                var timeout = TimeSpan.FromSeconds(5);

                for (int i = 0; i < maxMessages && !ct.IsCancellationRequested; i++)
                {
                    var result = consumer.Consume(timeout);
                    if (result == null) break;

                    // Format: topic:partition:offset
                    var filePath = $"{result.Topic}:{result.Partition.Value}:{result.Offset.Value}";
                    files.Add(filePath);
                }

                _logger.LogInformation("Listed {Count} messages from Kafka topic: {Topic}", files.Count, topic);
                return ValueTask.FromResult(files);
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing messages from Kafka topic: {Topic}", topic);
            throw;
        }
    }

    public async Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var config = GetKafkaConfig(dataSource);
            _logger.LogInformation("Testing Kafka connection to: {BootstrapServers}", config.BootstrapServers);

            return await _pipeline.ExecuteAsync(ct =>
            {
                using var adminClient = new AdminClientBuilder(new AdminClientConfig
                {
                    BootstrapServers = config.BootstrapServers
                }).Build();

                // GetMetadata is synchronous in the Confluent.Kafka client
                var metadata = adminClient.GetMetadata(TimeSpan.FromSeconds(5));

                _logger.LogInformation("Kafka connection test successful. Found {Count} brokers",
                    metadata.Brokers.Count);
                return ValueTask.FromResult(true);
            }, cancellationToken);
        }
        catch (Polly.CircuitBreaker.BrokenCircuitException bcEx)
        {
            _logger.LogWarning(bcEx, "Circuit is open for {ConnectorType} — not attempting connection", ConnectorType);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kafka connection test failed");
            return false;
        }
    }

    public Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        // For Kafka, metadata is limited
        var parts = filePath.Split(':');
        var metadata = new FileMetadata
        {
            FilePath = filePath,
            FileName = parts.Length > 0 ? $"kafka-msg-{parts[^1]}" : "kafka-message",
            FileSizeBytes = 0, // Unknown until consumed
            LastModifiedUtc = DateTime.UtcNow,
            ContentType = "application/json"
        };

        metadata.AdditionalProperties["KafkaTopic"] = parts.Length > 0 ? parts[0] : "";
        metadata.AdditionalProperties["KafkaPartition"] = parts.Length > 1 ? parts[1] : "";
        metadata.AdditionalProperties["KafkaOffset"] = parts.Length > 2 ? parts[2] : "";

        return Task.FromResult(metadata);
    }

    private KafkaConfiguration GetKafkaConfig(DataProcessingDataSource dataSource)
    {
        var config = new KafkaConfiguration
        {
            BootstrapServers = dataSource.FilePath // Default to FilePath
        };

        if (dataSource.AdditionalConfiguration != null)
        {
            if (dataSource.AdditionalConfiguration.Contains("KafkaBootstrapServers"))
                config.BootstrapServers = dataSource.AdditionalConfiguration["KafkaBootstrapServers"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("KafkaConsumerGroup"))
                config.ConsumerGroup = dataSource.AdditionalConfiguration["KafkaConsumerGroup"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("KafkaMaxMessagesToList"))
                config.MaxMessagesToList = dataSource.AdditionalConfiguration["KafkaMaxMessagesToList"].AsInt32;
        }

        return config;
    }

    private class KafkaConfiguration
    {
        public string BootstrapServers { get; set; } = "localhost:9092";
        public string ConsumerGroup { get; set; } = "file-discovery-service";
        public int MaxMessagesToList { get; set; } = 100;
    }
}

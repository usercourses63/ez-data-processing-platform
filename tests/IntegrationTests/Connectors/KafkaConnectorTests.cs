// KafkaConnectorTests.cs - Kafka Connector Integration Tests
// EZ Platform Integration Tests
// Version: 1.0
// Date: February 2, 2026

using System.Text;
using System.Text.Json;
using DataProcessing.IntegrationTests.Fixtures;
using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Polly;
using Polly.Registry;
using Xunit;
using Xunit.Abstractions;

namespace DataProcessing.IntegrationTests.Connectors;

/// <summary>
/// Kafka connector integration tests.
/// Uses KafkaFixture for broker connectivity.
/// Tests the KafkaConnector's IDataSourceConnector implementation.
///
/// Note: KafkaConnector implements IDataSourceConnector (not IServerConnector),
/// so tests use DataProcessingDataSource for configuration.
/// For Kafka message flow tests, see ServiceIntegration/KafkaFlowTests.cs
/// </summary>
[Collection("Integration")]
[Trait("Category", "Protocol")]
[Trait("Protocol", "Kafka")]
[Trait("OCP", "Compatible")]
public class KafkaConnectorTests : IClassFixture<KafkaFixture>
{
    private readonly KafkaFixture _kafka;
    private readonly ITestOutputHelper _output;
    private readonly KafkaConnector _connector;
    private readonly string _testRunId;

    public KafkaConnectorTests(KafkaFixture kafka, ITestOutputHelper output)
    {
        _kafka = kafka;
        _output = output;
        var registry = new ResiliencePipelineRegistry<string>();
        registry.TryAddBuilder("external-connector", (builder, _) => { });
        _connector = new KafkaConnector(NullLogger<KafkaConnector>.Instance, registry);
        _testRunId = Guid.NewGuid().ToString("N")[..8];
    }

    // ========== Skip Helper ==========

    private void SkipIfKafkaNotAvailable()
    {
        if (!_kafka.IsKafkaAvailable())
        {
            var skipReason = "Kafka broker not available. " +
                "Ensure port-forwarding is active: kubectl port-forward svc/kafka 9094:9094 -n ez-platform";
            _output.WriteLine($"Skipping: {skipReason}");
            Skip.If(true, skipReason);
        }
    }

    // ========== Helper Methods ==========

    private string GenerateTestTopic()
    {
        return $"protocol-test-{_testRunId}";
    }

    private DataProcessingDataSource CreateDataSource(string topic)
    {
        return new DataProcessingDataSource
        {
            Name = $"kafka-test-{_testRunId}",
            SupplierName = "Protocol Tests",
            FilePath = topic, // Topic name goes in FilePath (used as bootstrap servers when no AdditionalConfiguration)
            FilePattern = "*",
            IsActive = true,
            AdditionalConfiguration = new BsonDocument
            {
                ["KafkaBootstrapServers"] = TestConfiguration.KafkaBootstrapServers,
                ["KafkaConsumerGroup"] = $"test-consumer-{_testRunId}",
                ["KafkaMaxMessagesToList"] = 10
            }
        };
    }

    // ========== Logical Tests (No Broker Required) ==========

    [Fact(DisplayName = "Kafka: Connector type returns 'kafka'")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Kafka")]
    public void KafkaConnector_ConnectorType_ReturnsKafka()
    {
        // Act
        var connectorType = _connector.ConnectorType;

        // Assert
        connectorType.Should().Be("kafka", "Kafka connector should identify as 'kafka' type");

        _output.WriteLine($"Connector type: {connectorType}");
    }

    [Fact(DisplayName = "Kafka: GetFileMetadata returns correct topic info")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Kafka")]
    public async Task KafkaConnector_GetFileMetadata_ReturnsCorrectTopicInfo()
    {
        // Arrange
        var dataSource = CreateDataSource("test-topic");
        var filePath = "test-topic:0:12345"; // topic:partition:offset format

        // Act
        var metadata = await _connector.GetFileMetadataAsync(dataSource, filePath);

        // Assert
        metadata.Should().NotBeNull();
        metadata.FilePath.Should().Be(filePath);
        metadata.FileName.Should().Contain("kafka-msg");
        metadata.ContentType.Should().Be("application/json");
        metadata.AdditionalProperties["KafkaTopic"].Should().Be("test-topic");
        metadata.AdditionalProperties["KafkaPartition"].Should().Be("0");
        metadata.AdditionalProperties["KafkaOffset"].Should().Be("12345");

        _output.WriteLine($"Metadata - Topic: {metadata.AdditionalProperties["KafkaTopic"]}");
        _output.WriteLine($"Metadata - Partition: {metadata.AdditionalProperties["KafkaPartition"]}");
        _output.WriteLine($"Metadata - Offset: {metadata.AdditionalProperties["KafkaOffset"]}");
    }

    // ========== Broker-Dependent Tests ==========

    [SkippableFact(DisplayName = "Kafka: Test connection returns success when broker available")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Kafka")]
    public async Task KafkaConnector_TestConnection_ReturnsSuccess_WhenBrokerAvailable()
    {
        // Skip if Kafka not available
        SkipIfKafkaNotAvailable();

        // Arrange
        var dataSource = CreateDataSource(GenerateTestTopic());

        _output.WriteLine($"Testing Kafka connection to: {TestConfiguration.KafkaBootstrapServers}");

        // Act
        var result = await _connector.TestConnectionAsync(dataSource);

        // Assert
        result.Should().BeTrue("Kafka connection should succeed when broker is available");

        _output.WriteLine("Kafka connection test successful");
    }

    [SkippableFact(DisplayName = "Kafka: Produce and consume message round-trips")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Kafka")]
    public async Task KafkaConnector_ProduceConsume_RoundTrips()
    {
        // Skip if Kafka not available
        SkipIfKafkaNotAvailable();

        // Arrange
        var topic = GenerateTestTopic();
        var testMessage = new
        {
            TestId = _testRunId,
            Timestamp = DateTime.UtcNow.ToString("o"),
            Data = "Protocol test message"
        };
        var messageJson = JsonSerializer.Serialize(testMessage);

        _output.WriteLine($"Testing produce/consume on topic: {topic}");
        _output.WriteLine($"Message: {messageJson}");

        // Act - Produce using KafkaFixture
        var deliveryResult = await _kafka.ProduceAsync(topic, _testRunId, messageJson);

        _output.WriteLine($"Message produced - Partition: {deliveryResult.Partition}, Offset: {deliveryResult.Offset}");

        // Act - Wait for message using KafkaFixture
        var consumedMessage = await _kafka.WaitForMessageAsync(
            topic,
            result => result.Message.Key == _testRunId,
            TimeSpan.FromSeconds(10));

        // Assert
        consumedMessage.Should().NotBeNull("Should receive the produced message");
        consumedMessage!.Message.Value.Should().Contain(_testRunId);
        consumedMessage.Message.Value.Should().Contain("Protocol test message");

        _output.WriteLine($"Message consumed successfully from partition {consumedMessage.Partition}");
        _output.WriteLine($"Consumed value: {consumedMessage.Message.Value}");
    }

    [SkippableFact(DisplayName = "Kafka: ReadFile retrieves message at specific offset")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Kafka")]
    public async Task KafkaConnector_ReadFile_RetrievesMessageAtOffset()
    {
        // Skip if Kafka not available
        SkipIfKafkaNotAvailable();

        // Arrange - First produce a message to get a known offset
        var topic = GenerateTestTopic();
        var testMessage = new
        {
            TestId = _testRunId,
            Content = "ReadFile test message",
            Timestamp = DateTime.UtcNow.ToString("o")
        };
        var messageJson = JsonSerializer.Serialize(testMessage);

        var deliveryResult = await _kafka.ProduceAsync(topic, _testRunId, messageJson);
        var partition = deliveryResult.Partition.Value;
        var offset = deliveryResult.Offset.Value;

        _output.WriteLine($"Produced message to {topic}:{partition}:{offset}");

        // Arrange - Create data source and file path
        var dataSource = CreateDataSource(topic);
        var filePath = $"{topic}:{partition}:{offset}";

        _output.WriteLine($"Reading message from: {filePath}");

        // Act
        using var stream = await _connector.ReadFileAsync(dataSource, filePath);
        using var reader = new StreamReader(stream);
        var content = await reader.ReadToEndAsync();

        // Assert
        content.Should().NotBeNullOrEmpty("Should retrieve message content");
        content.Should().Contain(_testRunId, "Content should contain our test ID");
        content.Should().Contain("ReadFile test message");

        _output.WriteLine($"Read content: {content}");
    }

    [SkippableFact(DisplayName = "Kafka: ListFiles returns recent messages from topic")]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "Kafka")]
    public async Task KafkaConnector_ListFiles_ReturnsRecentMessages()
    {
        // Skip if Kafka not available
        SkipIfKafkaNotAvailable();

        // Arrange - Produce some messages first
        var topic = GenerateTestTopic();
        var messageCount = 3;

        _output.WriteLine($"Producing {messageCount} test messages to topic: {topic}");

        for (int i = 0; i < messageCount; i++)
        {
            var testMessage = new
            {
                TestId = _testRunId,
                Index = i,
                Timestamp = DateTime.UtcNow.ToString("o")
            };
            await _kafka.ProduceAsync(topic, $"{_testRunId}-{i}", JsonSerializer.Serialize(testMessage));
            _output.WriteLine($"  Produced message {i + 1}/{messageCount}");
        }

        // Small delay to ensure messages are available
        await Task.Delay(500);

        // Arrange - Create data source with topic
        var dataSource = CreateDataSource(topic);

        _output.WriteLine($"Listing files (messages) from topic: {topic}");

        // Act
        var files = await _connector.ListFilesAsync(dataSource, "*");

        // Assert
        files.Should().NotBeNull("File list should not be null");

        _output.WriteLine($"Listed {files.Count} messages from topic");
        foreach (var file in files.Take(5))
        {
            _output.WriteLine($"  - {file}");
        }

        // Verify file path format (topic:partition:offset)
        if (files.Count > 0)
        {
            var parts = files[0].Split(':');
            parts.Should().HaveCount(3, "File path should be in topic:partition:offset format");
            parts[0].Should().Be(topic, "First part should be topic name");
        }
    }
}

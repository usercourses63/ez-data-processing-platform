// PipelineFixture.cs - Coordinated Pipeline Test Fixture
// EZ Platform Integration Tests
// Phase 04-02: Pipeline Path Testing
// Version: 1.0
// Date: February 2, 2026

using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using FluentFTP;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;

namespace DataProcessing.IntegrationTests.Fixtures;

/// <summary>
/// Coordinated fixture for pipeline integration tests.
/// Manages dependencies: Kafka, Hazelcast, MongoDB, FileSimulator.
/// Provides test data source creation, cleanup, and helper methods.
/// </summary>
public class PipelineFixture : IAsyncLifetime
{
    private readonly KafkaFixture _kafka;
    private readonly HazelcastFixture _hazelcast;
    private readonly MongoDbFixture _mongodb;
    private readonly FileSimulatorFixture _fileSimulator;

    /// <summary>
    /// Test data source ID created for pipeline tests
    /// </summary>
    public string TestDataSourceId { get; private set; } = string.Empty;

    /// <summary>
    /// Whether all required infrastructure is available
    /// </summary>
    public bool IsAvailable { get; private set; }

    /// <summary>
    /// Reason for skipping tests if infrastructure unavailable
    /// </summary>
    public string SkipReason { get; private set; } = string.Empty;

    /// <summary>
    /// Whether file-simulator is available for file staging
    /// </summary>
    public bool IsFileSimulatorAvailable => _fileSimulator.IsAvailable;

    // ========== Constructor ==========

    /// <summary>
    /// Creates a new PipelineFixture with internal fixture instances.
    /// xUnit collection fixtures cannot inject other fixtures via constructor,
    /// so we create our own instances.
    /// </summary>
    public PipelineFixture()
    {
        _kafka = new KafkaFixture();
        _hazelcast = new HazelcastFixture();
        _mongodb = new MongoDbFixture();
        _fileSimulator = new FileSimulatorFixture();
    }

    // ========== Lifecycle ==========

    /// <summary>
    /// Initializes the fixture by checking all dependencies
    /// </summary>
    public async Task InitializeAsync()
    {
        // Initialize FileSimulatorFixture (it implements IAsyncLifetime)
        await _fileSimulator.InitializeAsync();

        // Check all dependencies
        var kafkaOk = _kafka.IsKafkaAvailable();
        var hazelcastOk = await _hazelcast.IsHazelcastAvailableAsync();
        var mongoOk = await _mongodb.IsMongoDbAvailableAsync();
        var fileSimOk = _fileSimulator.IsAvailable;

        // Core infrastructure required (file-simulator optional for message-only tests)
        IsAvailable = kafkaOk && hazelcastOk && mongoOk;

        if (!IsAvailable)
        {
            var missing = new List<string>();
            if (!kafkaOk) missing.Add("Kafka");
            if (!hazelcastOk) missing.Add("Hazelcast");
            if (!mongoOk) missing.Add("MongoDB");
            SkipReason = $"Pipeline infrastructure unavailable: {string.Join(", ", missing)}";
        }

        if (IsAvailable)
        {
            // Create test data source via direct MongoDB insert
            TestDataSourceId = await CreateTestDataSourceAsync();
        }

        Console.WriteLine($"PipelineFixture: Kafka={kafkaOk}, Hazelcast={hazelcastOk}, MongoDB={mongoOk}, FileSimulator={fileSimOk}");
        Console.WriteLine($"PipelineFixture: IsAvailable={IsAvailable}, TestDataSourceId={TestDataSourceId}");
    }

    /// <summary>
    /// Cleans up test data source and disposes resources
    /// </summary>
    public async Task DisposeAsync()
    {
        if (!string.IsNullOrEmpty(TestDataSourceId))
        {
            await CleanupTestDataSourceAsync(TestDataSourceId);
        }

        // Dispose owned resources
        _kafka.Dispose();
        _hazelcast.Dispose();
        _mongodb.Dispose();
        await _fileSimulator.DisposeAsync();
    }

    // ========== Test Data Source Management ==========

    /// <summary>
    /// Creates a minimal test data source in MongoDB for pipeline testing
    /// </summary>
    private async Task<string> CreateTestDataSourceAsync()
    {
        try
        {
            var dataSourceId = $"test-pipeline-{Guid.NewGuid():N}"[..32];

            var dataSource = new BsonDocument
            {
                ["_id"] = dataSourceId,
                ["Name"] = "Pipeline Test Data Source",
                ["Description"] = "Auto-created for pipeline integration tests",
                ["IsEnabled"] = true,
                ["ConnectionType"] = "FTP",
                ["ConnectionSettings"] = new BsonDocument
                {
                    ["Host"] = _fileSimulator.FileSimulatorIp,
                    ["Port"] = _fileSimulator.FtpPort,
                    ["Username"] = FileSimulatorFixture.Credentials.Ftp.User,
                    ["Password"] = FileSimulatorFixture.Credentials.Ftp.Password,
                    ["RootPath"] = "/input"
                },
                ["FileFormat"] = "CSV",
                ["FilePattern"] = "*.csv",
                ["CreatedAt"] = DateTime.UtcNow,
                ["UpdatedAt"] = DateTime.UtcNow,
                ["IsDeleted"] = false,
                ["Version"] = 1
            };

            var collection = _mongodb.GetCollection("datasources");
            await collection.InsertOneAsync(dataSource);

            Console.WriteLine($"PipelineFixture: Created test data source {dataSourceId}");
            return dataSourceId;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"PipelineFixture: Failed to create test data source: {ex.Message}");
            return string.Empty;
        }
    }

    /// <summary>
    /// Removes test data source from MongoDB
    /// </summary>
    private async Task CleanupTestDataSourceAsync(string dataSourceId)
    {
        try
        {
            var collection = _mongodb.GetCollection("datasources");
            var filter = Builders<BsonDocument>.Filter.Eq("_id", dataSourceId);
            await collection.DeleteOneAsync(filter);
            Console.WriteLine($"PipelineFixture: Cleaned up test data source {dataSourceId}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"PipelineFixture: Failed to cleanup test data source: {ex.Message}");
        }
    }

    // ========== File Staging Helpers ==========

    /// <summary>
    /// Stages a test file via FTP to file-simulator
    /// </summary>
    /// <param name="fileName">Name of the file</param>
    /// <param name="content">File content as string</param>
    /// <returns>Tuple of (fileName, filePath)</returns>
    public async Task<(string FileName, string FilePath)> StageTestFileAsync(
        string fileName, string content)
    {
        if (!_fileSimulator.IsAvailable)
        {
            throw new InvalidOperationException("File-simulator not available for file staging");
        }

        try
        {
            using var ftpClient = new AsyncFtpClient(
                _fileSimulator.FileSimulatorIp,
                FileSimulatorFixture.Credentials.Ftp.User,
                FileSimulatorFixture.Credentials.Ftp.Password,
                _fileSimulator.FtpPort);

            await ftpClient.Connect();

            var remotePath = $"/input/{fileName}";
            var bytes = Encoding.UTF8.GetBytes(content);
            using var stream = new MemoryStream(bytes);

            var result = await ftpClient.UploadStream(stream, remotePath, FtpRemoteExists.Overwrite, true);
            await ftpClient.Disconnect();

            if (result != FtpStatus.Success)
            {
                throw new Exception($"FTP upload failed with status: {result}");
            }

            Console.WriteLine($"PipelineFixture: Staged test file {fileName} at {remotePath}");
            return (fileName, remotePath);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"PipelineFixture: Failed to stage test file: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Stages a binary test file (e.g., Excel) via FTP to file-simulator
    /// </summary>
    /// <param name="fileName">Name of the file</param>
    /// <param name="content">File content as bytes</param>
    /// <returns>Tuple of (fileName, filePath)</returns>
    public async Task<(string FileName, string FilePath)> StageTestFileBinaryAsync(
        string fileName, byte[] content)
    {
        if (!_fileSimulator.IsAvailable)
        {
            throw new InvalidOperationException("File-simulator not available for file staging");
        }

        try
        {
            using var ftpClient = new AsyncFtpClient(
                _fileSimulator.FileSimulatorIp,
                FileSimulatorFixture.Credentials.Ftp.User,
                FileSimulatorFixture.Credentials.Ftp.Password,
                _fileSimulator.FtpPort);

            await ftpClient.Connect();

            var remotePath = $"/input/{fileName}";
            using var stream = new MemoryStream(content);

            var result = await ftpClient.UploadStream(stream, remotePath, FtpRemoteExists.Overwrite, true);
            await ftpClient.Disconnect();

            if (result != FtpStatus.Success)
            {
                throw new Exception($"FTP upload failed with status: {result}");
            }

            Console.WriteLine($"PipelineFixture: Staged binary test file {fileName} at {remotePath}");
            return (fileName, remotePath);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"PipelineFixture: Failed to stage binary test file: {ex.Message}");
            throw;
        }
    }

    // ========== Pipeline Completion Helpers ==========

    /// <summary>
    /// Publishes a FileDiscoveredEvent to trigger the pipeline
    /// </summary>
    public async Task PublishFileDiscoveredEventAsync(
        string correlationId,
        string fileName,
        string filePath,
        string? dataSourceId = null)
    {
        var fileDiscoveredEvent = JsonSerializer.Serialize(new
        {
            CorrelationId = correlationId,
            DataSourceId = dataSourceId ?? TestDataSourceId,
            FileName = fileName,
            FilePath = filePath,
            Timestamp = DateTime.UtcNow,
            PublishedBy = "IntegrationTest",
            MessageVersion = 1
        });

        await _kafka.ProduceAsync(
            TestConfiguration.KafkaTopics.FileDiscovered,
            correlationId,
            fileDiscoveredEvent);

        Console.WriteLine($"PipelineFixture: Published FileDiscoveredEvent for {fileName} with correlation {correlationId}");
    }

    /// <summary>
    /// Waits for pipeline completion by checking for output message
    /// </summary>
    /// <param name="correlationId">Correlation ID to match</param>
    /// <param name="timeout">Maximum time to wait</param>
    /// <returns>True if output received, false if timeout</returns>
    public async Task<bool> WaitForPipelineCompletionAsync(
        string correlationId,
        TimeSpan timeout)
    {
        var result = await _kafka.WaitForMessageAsync(
            TestConfiguration.KafkaTopics.RecordOutput,
            r => r.Message.Value.Contains(correlationId),
            timeout);

        return result != null;
    }

    /// <summary>
    /// Waits for any message on a specific topic matching the correlation ID
    /// </summary>
    public async Task<string?> WaitForMessageOnTopicAsync(
        string topic,
        string correlationId,
        TimeSpan timeout)
    {
        var result = await _kafka.WaitForMessageAsync(
            topic,
            r => r.Message.Value.Contains(correlationId),
            timeout);

        return result?.Message.Value;
    }

    /// <summary>
    /// Waits for an invalid record message matching the correlation ID
    /// </summary>
    public async Task<string?> WaitForInvalidRecordAsync(
        string correlationId,
        TimeSpan timeout)
    {
        var result = await _kafka.WaitForMessageAsync(
            TestConfiguration.KafkaTopics.InvalidRecord,
            r => r.Message.Value.Contains(correlationId),
            timeout);

        return result?.Message.Value;
    }

    // ========== Accessors for Underlying Fixtures ==========

    /// <summary>
    /// Kafka fixture for direct access
    /// </summary>
    public KafkaFixture Kafka => _kafka;

    /// <summary>
    /// Hazelcast fixture for direct access
    /// </summary>
    public HazelcastFixture Hazelcast => _hazelcast;

    /// <summary>
    /// MongoDB fixture for direct access
    /// </summary>
    public MongoDbFixture MongoDB => _mongodb;

    /// <summary>
    /// FileSimulator fixture for direct access
    /// </summary>
    public FileSimulatorFixture FileSimulator => _fileSimulator;
}

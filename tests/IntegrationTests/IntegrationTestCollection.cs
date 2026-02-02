// IntegrationTestCollection.cs - xUnit Test Collection Definition
// EZ Platform Integration Tests
// Version: 1.1
// Date: February 2, 2026

using DataProcessing.IntegrationTests.Fixtures;
using Xunit;

namespace DataProcessing.IntegrationTests;

/// <summary>
/// Defines the "Integration" test collection for managing shared test context
/// All integration tests use this collection to ensure proper fixture lifecycle
/// </summary>
[CollectionDefinition("Integration")]
public class IntegrationTestCollection :
    ICollectionFixture<IntegrationTestContext>,
    ICollectionFixture<FileSimulatorFixture>
{
    // This class has no code, and is never created.
    // Its purpose is to be the place to apply [CollectionDefinition]
    // and all the ICollectionFixture<> interfaces.
}

/// <summary>
/// Shared context for all integration tests
/// Provides common setup and teardown for the test collection
/// </summary>
public class IntegrationTestContext : IAsyncLifetime
{
    public bool IsKubernetesAvailable { get; private set; }
    public bool IsKafkaAvailable { get; private set; }
    public bool IsMongoDbAvailable { get; private set; }
    public bool IsHazelcastAvailable { get; private set; }

    public async Task InitializeAsync()
    {
        // Check infrastructure availability
        IsKafkaAvailable = await CheckTcpConnectionAsync("localhost", 9094);
        IsMongoDbAvailable = await CheckTcpConnectionAsync("localhost", 27017);
        IsHazelcastAvailable = await CheckTcpConnectionAsync("localhost", 5701);

        Console.WriteLine($"Integration Test Context Initialized:");
        Console.WriteLine($"  Kafka Available: {IsKafkaAvailable}");
        Console.WriteLine($"  MongoDB Available: {IsMongoDbAvailable}");
        Console.WriteLine($"  Hazelcast Available: {IsHazelcastAvailable}");
    }

    public Task DisposeAsync()
    {
        Console.WriteLine("Integration Test Context Disposed");
        return Task.CompletedTask;
    }

    private async Task<bool> CheckTcpConnectionAsync(string host, int port)
    {
        try
        {
            using var client = new System.Net.Sockets.TcpClient();
            var connectTask = client.ConnectAsync(host, port);
            var timeoutTask = Task.Delay(TimeSpan.FromSeconds(2));

            var completed = await Task.WhenAny(connectTask, timeoutTask);
            return completed == connectTask && client.Connected;
        }
        catch
        {
            return false;
        }
    }
}

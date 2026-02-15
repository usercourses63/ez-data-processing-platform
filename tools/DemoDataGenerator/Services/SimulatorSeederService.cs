using DataProcessing.Shared.Entities;
using DemoDataGenerator.Generators;
using DemoDataGenerator.Models;
using MongoDB.Entities;

namespace DemoDataGenerator.Services;

/// <summary>
/// Orchestrates clean-slate seeding from the file-simulator Control API.
/// Discovers servers, maps them to EZ entities, and persists to MongoDB.
/// </summary>
public class SimulatorSeederService
{
    private readonly FileSimulatorClient _client;
    private readonly ServerMappingService _mappingService;

    public SimulatorSeederService(FileSimulatorClient client, ServerMappingService mappingService)
    {
        _client = client;
        _mappingService = mappingService;
    }

    /// <summary>
    /// Seeds AdminServer and NasDevice entities from the file-simulator.
    /// Performs clean-slate: deletes all existing AdminServers and NasDevices first.
    /// </summary>
    /// <param name="createDynamic">If true, creates dynamic servers (FTP/SFTP input/output pairs, NAS) before discovering</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Tuple of created AdminServers and NasDevices</returns>
    public async Task<(List<AdminServer> Servers, List<NasDevice> NasDevices)> SeedFromSimulatorAsync(
        bool createDynamic, CancellationToken ct = default)
    {
        Console.WriteLine("\n[SIM] Seeding from file-simulator...");

        // 1. Health check
        Console.WriteLine("  Checking simulator health...");
        var healthy = await _client.EnsureHealthyAsync(ct);
        if (!healthy)
        {
            throw new InvalidOperationException(
                "File-simulator is not reachable. Ensure it is running and accessible. " +
                "Use --simulator-url to specify the correct URL.");
        }
        Console.WriteLine("  \u2713 Simulator is healthy");

        // 2. Clean slate - delete existing AdminServers and NasDevices
        Console.WriteLine("  Cleaning existing AdminServers and NasDevices...");
        await DB.DeleteAsync<AdminServer>(_ => true);
        await DB.DeleteAsync<NasDevice>(_ => true);
        Console.WriteLine("  \u2713 Cleaned existing entities");

        // 3. Optionally create dynamic servers in the file-simulator
        if (createDynamic)
        {
            Console.WriteLine("  Creating dynamic servers...");

            // FTP input/output pair
            await TryCreateDynamic(() => _client.CreateFtpServerAsync("ftp-input", "ftpuser", "ftppass123", ct), "FTP: ftp-input");
            await TryCreateDynamic(() => _client.CreateFtpServerAsync("ftp-output", "ftpuser", "ftppass123", ct), "FTP: ftp-output");

            // SFTP input/output pair
            await TryCreateDynamic(() => _client.CreateSftpServerAsync("sftp-input", "sftpuser", "sftppass123", ct), "SFTP: sftp-input");
            await TryCreateDynamic(() => _client.CreateSftpServerAsync("sftp-output", "sftpuser", "sftppass123", ct), "SFTP: sftp-output");

            // NAS servers
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-input", "/data/input", ct), "NAS: nfs-input");
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-output", "/data/output", ct), "NAS: nfs-output");
        }

        // 4. Discover all servers
        Console.WriteLine("  Discovering servers...");
        var servers = await _client.GetServersAsync(ct);
        Console.WriteLine($"  \u2713 Found {servers.Count} servers");

        // 5. Get connection details
        Console.WriteLine("  Fetching connection info...");
        var connInfo = await _client.GetConnectionInfoAsync(ct);
        Console.WriteLine("  \u2713 Connection info retrieved");

        // 6. Map and save entities
        var adminServers = new List<AdminServer>();
        var nasDevices = new List<NasDevice>();

        foreach (var server in servers)
        {
            var protocol = server.Protocol.ToUpperInvariant();

            // Skip management server — it's the control API, not a file protocol
            if (protocol == "MANAGEMENT")
            {
                Console.WriteLine($"  - Skipping: {server.Name} (management server)");
                continue;
            }

            if (protocol is "NFS" or "NAS")
            {
                var nasDevice = _mappingService.MapToNasDevice(server, connInfo);
                await nasDevice.SaveAsync();
                nasDevices.Add(nasDevice);
                Console.WriteLine($"  \u2713 Created NasDevice: {nasDevice.Name} ({nasDevice.Role})");
            }
            else
            {
                // Direction is inferred from server name:
                // "ftp-input" → Input, "ftp-output" → Output, "ftp" → Both
                var adminServer = _mappingService.MapToAdminServer(server, connInfo);
                await adminServer.SaveAsync();
                adminServers.Add(adminServer);
                Console.WriteLine($"  \u2713 Created AdminServer: {adminServer.Name} ({adminServer.ServerType}, {adminServer.Direction})");
            }
        }

        // 7. Add Kafka servers from EZ platform's internal cluster
        Console.WriteLine("  Adding Kafka servers from EZ platform cluster...");
        var kafkaInput = CreateKafkaServer("kafka-input", "EZ Platform Kafka (input consumer)", ServerDirection.Input);
        await kafkaInput.SaveAsync();
        adminServers.Add(kafkaInput);
        Console.WriteLine($"  \u2713 Created AdminServer: kafka-input (kafka, Input)");

        var kafkaOutput = CreateKafkaServer("kafka-output", "EZ Platform Kafka (output producer)", ServerDirection.Output);
        await kafkaOutput.SaveAsync();
        adminServers.Add(kafkaOutput);
        Console.WriteLine($"  \u2713 Created AdminServer: kafka-output (kafka, Output)");

        // 8. Summary
        var inputCount = adminServers.Count(s => s.CanBeInput);
        var outputCount = adminServers.Count(s => s.CanBeOutput);
        Console.WriteLine($"\n  \u2705 {adminServers.Count} AdminServers ({inputCount} input, {outputCount} output), {nasDevices.Count} NasDevices seeded\n");

        return (adminServers, nasDevices);
    }

    private static AdminServer CreateKafkaServer(string name, string description, ServerDirection direction)
    {
        return new AdminServer
        {
            Name = name,
            Description = description,
            ServerType = "kafka",
            Direction = direction,
            IsActive = true,
            Host = "localhost",
            Port = 9094,
            KafkaConfig = new KafkaServerConfig
            {
                BootstrapServers = "localhost:9094",
                SecurityProtocol = "PLAINTEXT",
                DefaultConsumerGroup = "dataprocessing-group",
                AcksRequired = 1
            },
            ConnectionTimeoutSeconds = 30,
            RetryCount = 3,
            LastConnectionTest = DateTime.UtcNow,
            LastConnectionSuccess = true,
            CreatedBy = "SimulatorSeeder",
            CorrelationId = Guid.NewGuid().ToString()
        };
    }

    private static async Task TryCreateDynamic(Func<Task<SimulatorServer>> createAction, string label)
    {
        try
        {
            await createAction();
            Console.WriteLine($"  \u2713 Created dynamic: {label}");
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"  \u26a0 Skipped {label}: {ex.Message}");
        }
    }
}

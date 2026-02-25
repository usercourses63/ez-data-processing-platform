using System.Net.Http.Json;
using System.Text.Json;
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
    private readonly HttpClient? _apiClient;

    public SimulatorSeederService(FileSimulatorClient client, ServerMappingService mappingService, HttpClient? apiClient = null)
    {
        _client = client;
        _mappingService = mappingService;
        _apiClient = apiClient;
    }

    /// <summary>
    /// Seeds AdminServer and NasDevice entities from the file-simulator.
    /// Performs clean-slate: deletes all existing AdminServers and NasDevices first.
    /// </summary>
    /// <param name="createDynamic">If true, creates dynamic servers (FTP/SFTP input/output pairs, NAS) before discovering</param>
    /// <param name="provisionNas">If true, provisions PV/PVC for NAS devices via DataSourceManagement API</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Tuple of created AdminServers and NasDevices</returns>
    public async Task<(List<AdminServer> Servers, List<NasDevice> NasDevices)> SeedFromSimulatorAsync(
        bool createDynamic, bool provisionNas = false, CancellationToken ct = default)
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

            // NAS servers — input, output, both, backup with varied export paths
            // Note: file-simulator requires relative directory (no leading '/'), creates C:\simulator-data\<dir>
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-input-data", "input-data", ct), "NAS: nfs-input-data");
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-input-archive", "input-archive", ct), "NAS: nfs-input-archive");
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-output-data", "output-data", ct), "NAS: nfs-output-data");
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-output-reports", "output-reports", ct), "NAS: nfs-output-reports");
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-shared", "shared", ct), "NAS: nfs-shared");
            await TryCreateDynamic(() => _client.CreateNasServerAsync("nfs-backup", "backup", ct), "NAS: nfs-backup");
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

        // 8. Provision NAS devices (PV/PVC/Mount)
        if (provisionNas && nasDevices.Count > 0)
        {
            Console.WriteLine("\n  Provisioning NAS devices (PV/PVC/Mount)...");
            await ProvisionNasDevicesAsync(nasDevices, ct);
        }

        // 9. Summary
        var inputCount = adminServers.Count(s => s.CanBeInput);
        var outputCount = adminServers.Count(s => s.CanBeOutput);
        Console.WriteLine($"\n  \u2705 {adminServers.Count} AdminServers ({inputCount} input, {outputCount} output), {nasDevices.Count} NasDevices seeded\n");

        return (adminServers, nasDevices);
    }

    private static AdminServer CreateKafkaServer(string name, string description, ServerDirection direction)
    {
        // Use internal Kubernetes service address for in-cluster communication
        // kafka:9092 is the internal service, localhost:9094 only works from port-forward
        return new AdminServer
        {
            Name = name,
            Description = description,
            ServerType = "kafka",
            Direction = direction,
            IsActive = true,
            Host = "kafka",
            Port = 9092,
            KafkaConfig = new KafkaServerConfig
            {
                BootstrapServers = "kafka:9092",
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

    /// <summary>
    /// Provisions PV/PVC for NAS devices by calling the DataSourceManagement API.
    /// </summary>
    private async Task ProvisionNasDevicesAsync(List<NasDevice> nasDevices, CancellationToken ct)
    {
        if (_apiClient == null)
        {
            Console.WriteLine("  \u26a0 No API client configured - skipping provisioning");
            Console.WriteLine("    Use --api-url=http://datasource-management:5001 to enable");
            return;
        }

        var provisionedCount = 0;
        var failedCount = 0;

        foreach (var device in nasDevices)
        {
            try
            {
                var request = new
                {
                    Namespace = "ez-platform",
                    CreatePv = true,
                    CreatePvc = true,
                    WaitForBinding = true,
                    TimeoutSeconds = 60
                };

                var response = await _apiClient.PostAsJsonAsync(
                    $"/api/v1/nasdevices/{device.ID}/provision",
                    request,
                    ct);

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<ProvisionResult>(ct);
                    if (result?.Success == true)
                    {
                        provisionedCount++;
                        Console.WriteLine($"  \u2713 Provisioned: {device.Name} (PV={result.PvCreated}, PVC={result.PvcCreated}, Bound={result.PvcBound})");

                        // Update local entity to reflect provisioning
                        device.IsPvCreated = result.PvCreated;
                        device.IsPvcBound = result.PvcBound;
                        await device.SaveAsync(cancellation: ct);

                        // Log mounted deployments
                        if (result.MountedDeployments?.Count > 0)
                        {
                            Console.WriteLine($"    Mounted to: {string.Join(", ", result.MountedDeployments)}");
                        }
                    }
                    else
                    {
                        failedCount++;
                        Console.WriteLine($"  \u2717 Failed: {device.Name} - {result?.ErrorMessage ?? "Unknown error"}");
                    }
                }
                else
                {
                    failedCount++;
                    var error = await response.Content.ReadAsStringAsync(ct);
                    Console.WriteLine($"  \u2717 Failed: {device.Name} - HTTP {response.StatusCode}: {error}");
                }
            }
            catch (Exception ex)
            {
                failedCount++;
                Console.WriteLine($"  \u2717 Failed: {device.Name} - {ex.Message}");
            }
        }

        Console.WriteLine($"  Provisioning complete: {provisionedCount} succeeded, {failedCount} failed");
    }

    /// <summary>
    /// Result model for NAS provisioning API response
    /// </summary>
    private class ProvisionResult
    {
        public bool Success { get; set; }
        public bool PvCreated { get; set; }
        public bool PvcCreated { get; set; }
        public bool PvcBound { get; set; }
        public string? PvName { get; set; }
        public string? PvcName { get; set; }
        public string? ErrorMessage { get; set; }
        public long DurationMs { get; set; }
        public List<string>? MountedDeployments { get; set; }
        public List<string>? FailedMounts { get; set; }
    }
}

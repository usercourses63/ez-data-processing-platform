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
    /// <param name="createDynamic">If true, creates dynamic NAS servers before discovering</param>
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

        // 3. Optionally create dynamic NAS servers
        if (createDynamic)
        {
            Console.WriteLine("  Creating dynamic NAS servers...");
            try
            {
                await _client.CreateNasServerAsync("nfs-input", "/data/input", ct);
                Console.WriteLine("  \u2713 Created dynamic NAS: nfs-input");
                await _client.CreateNasServerAsync("nfs-output", "/data/output", ct);
                Console.WriteLine("  \u2713 Created dynamic NAS: nfs-output");
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"  \u26a0 Dynamic NAS creation skipped: {ex.Message}");
            }
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
            if (protocol is "NFS" or "NAS")
            {
                var nasDevice = _mappingService.MapToNasDevice(server, connInfo);
                await nasDevice.SaveAsync();
                nasDevices.Add(nasDevice);
                Console.WriteLine($"  \u2713 Created NasDevice: {nasDevice.Name} ({nasDevice.Role})");
            }
            else
            {
                var adminServer = _mappingService.MapToAdminServer(server, connInfo);
                await adminServer.SaveAsync();
                adminServers.Add(adminServer);
                Console.WriteLine($"  \u2713 Created AdminServer: {adminServer.Name} ({adminServer.ServerType}, {adminServer.Direction})");
            }
        }

        // 7. Summary
        Console.WriteLine($"\n  \u2705 {adminServers.Count} AdminServers, {nasDevices.Count} NasDevices seeded from simulator\n");

        return (adminServers, nasDevices);
    }
}

using DataProcessing.Shared.Entities;
using DemoDataGenerator.Models;
using DemoDataGenerator.Services;
using MongoDB.Entities;

namespace DemoDataGenerator.Generators;

/// <summary>
/// Generates NasDevice entities from file-simulator NAS/NFS servers.
/// Uses ServerMappingService to map simulator servers to EZ NasDevice entities.
/// </summary>
public class NasDeviceGenerator
{
    private readonly ServerMappingService _mappingService;
    private readonly List<SimulatorServer> _servers;
    private readonly SimulatorConnectionInfo _connectionInfo;

    public NasDeviceGenerator(
        ServerMappingService mappingService,
        List<SimulatorServer> servers,
        SimulatorConnectionInfo connectionInfo)
    {
        _mappingService = mappingService;
        _servers = servers;
        _connectionInfo = connectionInfo;
    }

    /// <summary>
    /// Generates NasDevice entities for all NFS/NAS protocol servers from the simulator
    /// </summary>
    public async Task<List<NasDevice>> GenerateAsync()
    {
        Console.WriteLine("[NAS] Generating NasDevice entities from simulator...");
        var nasDevices = new List<NasDevice>();

        var nasServers = _servers.Where(s =>
            s.Protocol.Equals("NFS", StringComparison.OrdinalIgnoreCase) ||
            s.Protocol.Equals("NAS", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (nasServers.Count == 0)
        {
            Console.WriteLine("  No NFS/NAS servers found in simulator");
            return nasDevices;
        }

        foreach (var server in nasServers)
        {
            var nasDevice = _mappingService.MapToNasDevice(server, _connectionInfo);
            await nasDevice.SaveAsync();
            nasDevices.Add(nasDevice);
            Console.WriteLine($"  \u2713 Created NasDevice: {nasDevice.Name} ({nasDevice.Role})");
        }

        Console.WriteLine($"  Generated {nasDevices.Count} NasDevice entities\n");
        return nasDevices;
    }
}

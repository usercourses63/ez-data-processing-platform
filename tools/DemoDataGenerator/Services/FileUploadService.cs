using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;

namespace DemoDataGenerator.Services;

/// <summary>
/// Orchestrates multi-protocol file uploads to file-simulator servers via IServerConnector.
/// Supports FTP, SFTP, S3, HTTP protocols. Skips Kafka (non-file) and NAS (no host mount).
///
/// File uploads use overwrite semantics. Re-running is safe and produces fresh demo files.
/// Each invocation regenerates content and overwrites any existing files at the same paths,
/// which is the correct behavior for demo data seeding.
/// </summary>
public class FileUploadService
{
    private readonly IConnectorFactory _connectorFactory;
    private readonly FileGeneratorService _fileGenerator;
    private readonly HttpClient? _apiClient;

    /// <summary>
    /// Creates a new FileUploadService.
    /// </summary>
    /// <param name="connectorFactory">Factory for resolving protocol-specific connectors</param>
    /// <param name="fileGenerator">Service for generating CSV/JSON file content</param>
    /// <param name="apiClient">Optional HTTP client for NAS REST API fallback (currently unused)</param>
    public FileUploadService(
        IConnectorFactory connectorFactory,
        FileGeneratorService fileGenerator,
        HttpClient? apiClient = null)
    {
        _connectorFactory = connectorFactory;
        _fileGenerator = fileGenerator;
        _apiClient = apiClient;
    }

    /// <summary>
    /// Uploads generated demo files to all eligible servers and NAS devices.
    /// Servers with CanBeInput=true get demo files uploaded. Kafka servers are skipped.
    /// NAS devices are skipped (NFS mounts not available from host).
    /// </summary>
    /// <param name="servers">List of AdminServer entities to upload to</param>
    /// <param name="nasDevices">List of NasDevice entities (skipped with informative message)</param>
    /// <param name="ct">Cancellation token</param>
    public async Task UploadFilesAsync(
        List<AdminServer> servers,
        List<NasDevice> nasDevices,
        CancellationToken ct = default)
    {
        Console.WriteLine("\n[UPLOAD] Uploading demo files to servers...");

        int totalUploaded = 0;
        int serverCount = 0;

        // Upload to AdminServers via connectors
        foreach (var server in servers)
        {
            if (!server.CanBeInput)
            {
                Console.WriteLine($"  - Skipping {server.Name}: not an input server");
                continue;
            }

            if (string.Equals(server.ServerType, "kafka", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine($"  - Skipping {server.Name}: Kafka is not a file protocol");
                continue;
            }

            // NFS/local connectors write to K8s PVC paths — not accessible from host
            if (string.Equals(server.ServerType, "nfs", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(server.ServerType, "local", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(server.ServerType, "folder", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine($"  - Skipping {server.Name}: {server.ServerType} requires in-cluster access (not available from host)");
                continue;
            }

            var connector = _connectorFactory.GetConnector(server) as IServerConnector;
            if (connector == null)
            {
                Console.WriteLine($"  - Skipping {server.Name}: connector does not support file writes");
                continue;
            }

            var creds = ResolveCredentials(server);
            var manifest = _fileGenerator.GetFileManifest(4);
            int uploadedCount = 0;

            Console.WriteLine($"\n  [{server.ServerType.ToUpperInvariant()}] {server.Name}:");

            foreach (var (schemaIndex, recordCount, isJson) in manifest)
            {
                try
                {
                    var content = isJson
                        ? _fileGenerator.GenerateJsonContent(schemaIndex, recordCount)
                        : _fileGenerator.GenerateCsvContent(schemaIndex, recordCount);

                    var ext = _fileGenerator.GetFileExtension(isJson);
                    var basePath = server.BasePath?.TrimEnd('/') ?? "";
                    var filePath = $"{basePath}/demo-{schemaIndex:D2}-{recordCount}r{ext}";

                    await connector.WriteFileAsync(server, creds, filePath, content, ct);
                    Console.WriteLine($"    Uploaded: {filePath} ({content.Length} bytes) to {server.Name}");
                    uploadedCount++;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"    WARNING: Failed to upload file to {server.Name}: {ex.Message}");
                }
            }

            Console.WriteLine($"    {uploadedCount}/{manifest.Length} files uploaded to {server.Name}");
            totalUploaded += uploadedCount;
            serverCount++;
        }

        // NAS devices — cannot upload from outside the cluster
        foreach (var nasDevice in nasDevices)
        {
            if (!nasDevice.CanBeInput)
            {
                Console.WriteLine($"  - Skipping NAS {nasDevice.Name}: not an input device");
                continue;
            }

            Console.WriteLine($"  - Skipping NAS {nasDevice.Name}: file upload requires in-cluster NFS mount (upload files manually or from within K8s pods)");
        }

        Console.WriteLine($"\n  Upload complete: {totalUploaded} files across {serverCount} servers");
    }

    /// <summary>
    /// Resolves credentials from the server's TypeSpecificConfig BsonDocument.
    /// Uses PascalCase keys matching the ServerMappingService convention.
    /// </summary>
    /// <param name="server">AdminServer with TypeSpecificConfig</param>
    /// <returns>ServerCredentials extracted from config, or null if no config</returns>
    private static ServerCredentials? ResolveCredentials(AdminServer server)
    {
        if (server.TypeSpecificConfig == null)
            return null;

        return ServerCredentials.FromBsonDocument(server.TypeSpecificConfig);
    }
}

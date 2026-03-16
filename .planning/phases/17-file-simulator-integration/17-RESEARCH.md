# Phase 17: File-Simulator Integration - Research

**Researched:** 2026-03-16
**Domain:** DemoDataGenerator CLI tool extension — file generation, multi-protocol upload, DataSource creation
**Confidence:** HIGH

## Summary

Phase 17 extends the existing DemoDataGenerator tool to generate test files (CSV and JSON), upload them to file-simulator servers via the Shared connectors, and create complete DataSource entities with schemas, schedules, and output destinations. The codebase is well-structured: `FileSimulatorClient` and `SimulatorSeederService` already handle server discovery and AdminServer/NasDevice creation. The main work is adding file content generation, upload orchestration, and ensuring the generated DataSources form complete pipelines ready for processing.

The key architectural decision is **how to invoke connectors from the DemoDataGenerator console app**. The Shared connectors (`FtpConnector`, `SftpConnector`, etc.) require DI-injected `ILogger` instances and the `ConnectorFactory` uses `IServiceProvider`. Two viable paths exist: (1) use the DataSourceManagement REST API's `FileOperationsController` write endpoint (simpler, no DI setup needed, already proven in Phase 15.1), or (2) set up a minimal DI container in DemoDataGenerator to instantiate connectors directly. The REST API approach is recommended — it avoids DI complexity, reuses the exact code path the pipeline uses, and was validated in Phase 15.1 testing.

**Primary recommendation:** Use the existing REST API endpoint `POST /api/v1/fileoperations/{serverId}/write` for all file uploads. Generate CSV/JSON content in-memory using the existing schema definitions from `AllGenerators.cs`. Add a new `--upload-files` CLI flag and a `FileUploadService` class following the existing service pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Generate CSV and JSON files only (XML and Excel deferred)
- Claude decides file content based on existing schema templates in the codebase
- 3-5 files per protocol, mix of small (10 records) and medium (100 records)
- Upload directly via Shared connectors (FtpConnector, SftpConnector, NfsConnector, etc.) — same code path the pipeline uses
- New `--upload-files` CLI flag to enable file generation + upload phase
- FileSimulatorClient IS the documentation — no separate markdown doc needed
- Trust existing endpoint coverage (health, servers, connection-info, create NAS/FTP/SFTP)
- SIM-01 satisfied by the existing client code + any inline comments added during this phase
- Full pipeline setup: seed AdminServers + NAS devices -> create matching DataSources with schemas, schedules, and output destinations
- S3 and HTTP/WebDAV: discover and seed static servers from simulator (no dynamic creation)
- FTP, SFTP, NAS, Kafka: create dynamic servers via simulator API (existing behavior)
- Idempotent upsert pattern: check by name before creating, update if exists, safe to re-run
- DemoDataGenerator's existing `--incremental` flag aligns with this

### Claude's Discretion
- File content generation approach (use existing schema templates or create new generator)
- DataSource configuration details (cron schedule expressions, output destination types)
- Schema assignment per DataSource (match generated file format)
- Error handling for upload failures (retry, skip, or abort)
- Whether to add a `--dry-run` flag for testing without actual uploads

### Deferred Ideas (OUT OF SCOPE)
- XML and Excel file generation — add when needed for broader format testing
- File-simulator API markdown documentation — client code is sufficient for now
- Dynamic S3/HTTP server creation — simulator may not support this
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIM-01 | File-simulator docs/API understood and documented | Existing `FileSimulatorClient.cs` covers all endpoints with XML doc comments. Add inline comments during implementation to complete documentation. No separate doc needed per user decision. |
| SIM-02 | DemoDataGenerator reads file-simulator config via API and creates matching EZ devices | `SimulatorSeederService.SeedFromSimulatorAsync()` already does this. Extend with DataSource creation (schemas, schedules, output destinations) to make devices pipeline-ready. |
| SIM-03 | DemoDataGenerator uploads files via multi-protocol using file-simulator endpoints | New `FileUploadService` using connector instances or REST API. Generate CSV/JSON content from existing schema templates. Upload 3-5 files per protocol. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| DataProcessing.Shared | (project ref) | Connectors, Entities, base classes | Already referenced by DemoDataGenerator |
| MongoDB.Entities | (CPM) | Data access for DataSource, Schema entities | Already used throughout DemoDataGenerator |
| System.Text.Json | built-in | JSON file content generation | No external dep needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Microsoft.Extensions.DependencyInjection | (CPM) | Minimal DI container for connectors | Only if direct connector instantiation chosen |
| Microsoft.Extensions.Logging | (CPM) | ILogger for connectors | Required by all connector constructors |
| Microsoft.Extensions.Http | (CPM) | HttpClient for REST API calls | Already in DemoDataGenerator.csproj |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct connector instantiation | REST API `POST /api/v1/fileoperations/{serverId}/write` | REST API is simpler (no DI setup) but requires DataSourceManagement service running; direct connectors work standalone but need DI container setup |
| Custom CSV generator | CsvHelper library | Overkill for simple CSV — `StringBuilder` with comma-separated values is sufficient for demo data |

## Architecture Patterns

### Upload Strategy: Direct Connectors vs REST API

**Option A: Direct Connector Instantiation (User's locked decision)**

The user decided "Upload directly via Shared connectors." This requires setting up a minimal DI container in DemoDataGenerator since connectors need `ILogger<T>`:

```csharp
// Minimal DI setup for connector instantiation
var services = new ServiceCollection();
services.AddLogging(builder => builder.AddConsole());
services.AddHttpClient(); // For HttpApiConnector
services.AddConnectorFactory(); // Registers all connectors
var provider = services.BuildServiceProvider();
var factory = provider.GetRequiredService<IConnectorFactory>();
```

**Option B: REST API (fallback if connector DI proves problematic)**

```csharp
// POST /api/v1/fileoperations/{serverId}/write
var request = new { FilePath = "/data/test.csv", Content = Convert.ToBase64String(csvBytes) };
await apiClient.PostAsJsonAsync($"/api/v1/fileoperations/{serverId}/write", request);
```

**Recommendation:** Implement Option A (direct connectors) as user decided. The DI setup is straightforward — just `ServiceCollection` + `AddLogging` + `AddConnectorFactory`. The `IServerConnector.WriteFileAsync` signature is: `Task WriteFileAsync(AdminServer server, ServerCredentials? credentials, string filePath, byte[] content, CancellationToken ct)`.

### Recommended New File Structure
```
tools/DemoDataGenerator/
├── Services/
│   ├── FileSimulatorClient.cs          # (existing) HTTP client for simulator API
│   ├── SimulatorSeederService.cs       # (existing) Server seeding — EXTEND with DataSource creation
│   ├── ServerMappingService.cs         # (existing) Server-to-entity mapping
│   ├── DatabaseResetService.cs         # (existing) DB cleanup
│   ├── FileGeneratorService.cs         # (NEW) Generates CSV/JSON file content from schemas
│   └── FileUploadService.cs            # (NEW) Uploads files to servers via connectors
├── Generators/
│   ├── AllGenerators.cs                # (existing) DataSourceGenerator, SchemaGenerator, etc.
│   ├── AdminServerGenerator.cs         # (existing)
│   └── NasDeviceGenerator.cs           # (existing)
├── Models/
│   ├── SimulatorModels.cs              # (existing)
│   ├── HebrewCategories.cs             # (existing)
│   └── SchemaFieldMappings.cs          # (existing)
├── Templates/
│   └── OutputConfigurationTemplate.cs  # (existing)
└── Program.cs                          # (existing) — add --upload-files flag + upload step
```

### Pattern 1: File Content Generation
**What:** Generate CSV and JSON file content matching existing schema definitions.
**When to use:** When `--upload-files` flag is set.

```csharp
// FileGeneratorService generates content matching schema templates
public class FileGeneratorService
{
    private readonly Random _random;

    public FileGeneratorService(Random random)
    {
        _random = random;
    }

    // Generate CSV content for a given schema index
    public byte[] GenerateCsvContent(int schemaIndex, int recordCount)
    {
        // Use schema field definitions from AllGenerators to produce matching data
        var sb = new StringBuilder();
        // Header row from schema properties
        // Data rows with realistic random values
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    // Generate JSON content (array of objects matching schema)
    public byte[] GenerateJsonContent(int schemaIndex, int recordCount)
    {
        // Array of JSON objects matching the schema definition
        return JsonSerializer.SerializeToUtf8Bytes(records);
    }
}
```

### Pattern 2: Upload Orchestration
**What:** Upload generated files to each seeded server via its protocol connector.
**When to use:** After server seeding in SimulatorSeederService.

```csharp
// FileUploadService orchestrates uploads across all protocols
public class FileUploadService
{
    private readonly IConnectorFactory _connectorFactory;

    public async Task UploadFilesAsync(
        List<AdminServer> servers,
        List<NasDevice> nasDevices,
        FileGeneratorService fileGen)
    {
        foreach (var server in servers.Where(s => s.CanBeInput))
        {
            var connector = _connectorFactory.GetConnector(server) as IServerConnector;
            if (connector == null) continue;

            var creds = ResolveCredentials(server); // From TypeSpecificConfig

            // Upload 3-5 files per server (mix of CSV and JSON, 10 and 100 records)
            for (int i = 0; i < fileCount; i++)
            {
                var content = isJson
                    ? fileGen.GenerateJsonContent(schemaIndex, recordCount)
                    : fileGen.GenerateCsvContent(schemaIndex, recordCount);

                await connector.WriteFileAsync(server, creds, filePath, content);
            }
        }
    }
}
```

### Pattern 3: Credential Resolution from TypeSpecificConfig
**What:** Extract credentials from AdminServer.TypeSpecificConfig BsonDocument.
**When to use:** When calling connector WriteFileAsync (credentials parameter).

```csharp
// Credentials stored in TypeSpecificConfig as PascalCase keys
private ServerCredentials? ResolveCredentials(AdminServer server)
{
    if (server.TypeSpecificConfig == null) return null;

    var username = server.TypeSpecificConfig.GetValue("Username", "").AsString;
    var password = server.TypeSpecificConfig.GetValue("Password", "").AsString;

    if (string.IsNullOrEmpty(username)) return null;

    return new ServerCredentials { Username = username, Password = password };
}
```

### Anti-Patterns to Avoid
- **Building a full ASP.NET host in the console app:** Unnecessary. A simple `ServiceCollection` is sufficient for connector DI.
- **Hardcoding file content:** Use the schema definitions from `AllGenerators.cs` to ensure generated files match the schemas assigned to DataSources.
- **Creating files that don't match schemas:** If a DataSource expects `*.csv` but receives JSON content, validation will fail. Match file format to DataSource `FilePattern`.
- **Ignoring SFTP chroot paths:** SFTP servers use `/data` as the writable base (chroot jail). BasePath is already set to `/data` or `/upload` by `ServerMappingService`. Always use `server.BasePath` as prefix.
- **Using NfsConnector for NAS file uploads:** The NFS connector writes to local filesystem mount paths. From DemoDataGenerator (running on host, not in K8s), NFS mounts are not available. Use the REST API endpoint for NAS file writes, or skip NAS uploads if running outside the cluster.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Full CSV library | StringBuilder with proper escaping | Demo data is simple, no special characters/quoting edge cases |
| JSON generation | Manual string building | System.Text.Json serializer | Built-in, handles escaping correctly |
| Protocol-specific upload | Custom FTP/SFTP/S3 client code | Shared connectors (IServerConnector.WriteFileAsync) | Already tested in Phase 15.1, handles connection, retries, path construction |
| Credential management | New credential store | AdminServer.TypeSpecificConfig BsonDocument | Already populated by ServerMappingService with correct PascalCase keys |
| DataSource entity creation | New generator | Extend existing DataSourceGenerator pattern | Round-robin server assignment, output config templates already exist |

**Key insight:** Almost everything needed already exists. The file generation is new code, but the upload infrastructure (connectors), entity patterns (generators), and server discovery (SimulatorSeederService) are battle-tested.

## Common Pitfalls

### Pitfall 1: NFS Connector Cannot Write from Host Machine
**What goes wrong:** NfsConnector uses `File.WriteAllBytesAsync` on a local mount path. DemoDataGenerator runs on the host, not inside K8s pods where NFS volumes are mounted.
**Why it happens:** NFS volumes are only mounted inside pod containers.
**How to avoid:** For NAS/NFS uploads, use the REST API endpoint `POST /api/v1/fileoperations/{serverId}/write` which runs inside the cluster. OR: For NAS devices, use the DataSourceManagement API for writes. For non-NAS protocols (FTP, SFTP, S3, HTTP), direct connector use works fine since they connect over network.
**Warning signs:** "File not found" or "Directory not found" errors when writing to NFS paths.

### Pitfall 2: SFTP Chroot Jail BasePath
**What goes wrong:** Writing to `/` instead of `/data` on SFTP servers.
**Why it happens:** SFTP uses `ChrootDirectory %h` — root is read-only, only `/data` is writable.
**How to avoid:** ServerMappingService already sets `BasePath` based on direction. SftpConnector.WriteFileAsync combines BasePath + filePath. Ensure filePath is relative, not absolute.
**Warning signs:** "Permission denied" or "Access denied" on SFTP writes.

### Pitfall 3: FTP Passive Mode Required
**What goes wrong:** FTP data connections fail through NAT/port-forward.
**Why it happens:** Active FTP requires server-to-client callback which doesn't work through port-forward.
**How to avoid:** TypeSpecificConfig already has `PassiveMode: true`. FtpConnector respects this setting.
**Warning signs:** Connection timeouts on FTP data channel.

### Pitfall 4: S3 Bucket Must Exist Before Upload
**What goes wrong:** S3 PutObject fails with "NoSuchBucket".
**Why it happens:** MinIO server may not have the target bucket pre-created.
**How to avoid:** Create the bucket first or use a known existing bucket from the simulator. Check `TypeSpecificConfig["Bucket"]` value matches what exists on the MinIO server.
**Warning signs:** 404 or NoSuchBucket errors on S3 writes.

### Pitfall 5: Kafka Upload is Not File-Based
**What goes wrong:** Attempting to use file upload semantics for Kafka servers.
**Why it happens:** Kafka is a message broker, not a file system. "Uploading files" doesn't apply.
**How to avoid:** Skip Kafka servers in the file upload step. Kafka DataSources are configured to consume from topics, not file directories. The file upload is only for FTP, SFTP, NAS, S3, and HTTP/WebDAV servers.
**Warning signs:** Type mismatch errors, KafkaConnector doesn't implement file-oriented WriteFileAsync meaningfully.

### Pitfall 6: DI Setup Missing for Connectors
**What goes wrong:** `ConnectorFactory` tries to resolve connector from `IServiceProvider`, gets `InvalidOperationException`.
**Why it happens:** Connectors not registered in DI container.
**How to avoid:** Call `services.AddConnectorFactory()` which registers all built-in connectors. Also call `services.AddLogging()` since every connector constructor requires `ILogger<T>`.
**Warning signs:** "Failed to create connector for server type" exceptions.

## Code Examples

### Connector DI Setup in Console App
```csharp
// Source: ConnectorFactory.cs AddConnectorFactory extension method
var services = new ServiceCollection();
services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Warning));
services.AddHttpClient(); // Required for HttpApiConnector
services.AddConnectorFactory(); // Registers all connectors + factory
var serviceProvider = services.BuildServiceProvider();
var connectorFactory = serviceProvider.GetRequiredService<IConnectorFactory>();
```

### Writing File via IServerConnector
```csharp
// Source: IConnectorFactory.cs IServerConnector interface
var connector = connectorFactory.GetConnector(server.ServerType) as IServerConnector;
if (connector == null)
{
    Console.WriteLine($"  Skipped {server.Name}: connector does not support IServerConnector");
    return;
}

var credentials = new ServerCredentials
{
    Username = server.TypeSpecificConfig?["Username"]?.AsString ?? "",
    Password = server.TypeSpecificConfig?["Password"]?.AsString ?? ""
};

await connector.WriteFileAsync(server, credentials, "/data/test-file.csv", csvBytes);
```

### REST API File Write (Alternative for NAS)
```csharp
// Source: FileOperationsController.cs WriteFile endpoint
// POST /api/v1/fileoperations/{serverId}/write
var request = new
{
    FilePath = "/data/test-file.csv",
    Content = Convert.ToBase64String(csvBytes)  // Base64 encoded
};
var response = await apiClient.PostAsJsonAsync(
    $"/api/v1/fileoperations/{server.ID}/write", request);
response.EnsureSuccessStatusCode();
```

### Simple CSV Generation from Schema
```csharp
// Based on schema 0 (SimpleTransaction) from AllGenerators.cs
public byte[] GenerateSimpleTransactionCsv(int recordCount)
{
    var sb = new StringBuilder();
    sb.AppendLine("transactionId,amount,date,status");

    var statuses = new[] { "ממתין", "אושר", "נדחה" };
    for (int i = 0; i < recordCount; i++)
    {
        var txnId = $"TXN-{_random.Next(10000000, 99999999)}";
        var amount = Math.Round(_random.NextDouble() * 100000, 2);
        var date = DateTime.Now.AddDays(-_random.Next(1, 365)).ToString("yyyy-MM-dd");
        var status = statuses[_random.Next(statuses.Length)];
        sb.AppendLine($"{txnId},{amount},{date},{status}");
    }

    return Encoding.UTF8.GetBytes(sb.ToString());
}
```

### JSON Generation from Schema
```csharp
// Based on schema 0 (SimpleTransaction) from AllGenerators.cs
public byte[] GenerateSimpleTransactionJson(int recordCount)
{
    var records = new List<Dictionary<string, object>>();
    var statuses = new[] { "ממתין", "אושר", "נדחה" };

    for (int i = 0; i < recordCount; i++)
    {
        records.Add(new Dictionary<string, object>
        {
            ["transactionId"] = $"TXN-{_random.Next(10000000, 99999999)}",
            ["amount"] = Math.Round(_random.NextDouble() * 100000, 2),
            ["date"] = DateTime.Now.AddDays(-_random.Next(1, 365)).ToString("yyyy-MM-dd"),
            ["status"] = statuses[_random.Next(statuses.Length)]
        });
    }

    return JsonSerializer.SerializeToUtf8Bytes(records, new JsonSerializerOptions { WriteIndented = true });
}
```

### Existing CLI Flag Pattern
```csharp
// Source: Program.cs — existing flag parsing pattern
bool uploadFiles = args.Contains("--upload-files");
// ... later in pipeline:
if (uploadFiles && useSimulator)
{
    var uploadService = new FileUploadService(connectorFactory, fileGen);
    await uploadService.UploadFilesAsync(servers, seededNasDevices);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual file placement on simulator | Automated upload via connectors | Phase 17 (this phase) | Repeatable demo environment setup |
| DataSources without real files | DataSources with matching files on servers | Phase 17 | Full pipeline testing possible |
| Separate server seeding + DataSource creation | Unified pipeline in DemoDataGenerator | Phase 17 | Single command creates complete environment |

## Open Questions

1. **NFS File Upload Path**
   - What we know: NfsConnector writes to local filesystem paths. DemoDataGenerator runs on the host.
   - What's unclear: Whether NFS mounts are accessible from the host (they're K8s PV mounts inside pods).
   - Recommendation: For NAS devices, use the REST API endpoint as fallback. Or, accept that NAS files are uploaded via the API while FTP/SFTP/S3/HTTP use direct connectors. Document this as a known limitation.

2. **S3 Bucket Pre-creation**
   - What we know: MinIO server exists on the simulator. S3Connector can write objects.
   - What's unclear: Whether the target bucket (e.g., "input") is automatically created by the simulator or needs explicit creation.
   - Recommendation: Add a bucket creation step using the S3 SDK or check if simulator creates default buckets. MinIO supports auto-bucket-creation on first write in some configurations.

3. **Kafka Server File Semantics**
   - What we know: Kafka servers are in the seeded AdminServer list. They're not file-based.
   - What's unclear: Whether SIM-03 requires "uploading" to Kafka topics or just file-protocol servers.
   - Recommendation: Skip Kafka servers in the file upload step. Focus on FTP, SFTP, NAS, S3, HTTP. Document Kafka as a non-file protocol.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (no existing test project for DemoDataGenerator) |
| Config file | none |
| Quick run command | `cd tools/DemoDataGenerator && dotnet run -- --use-simulator --create-servers --upload-files --direct-connection --simulator-url http://<IP>:30500` |
| Full suite command | Same as quick run + verify files exist via `POST /api/v1/fileoperations/{serverId}/list` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-01 | FileSimulatorClient covers all simulator endpoints | manual | Review inline comments in FileSimulatorClient.cs | N/A |
| SIM-02 | DemoDataGenerator creates matching EZ devices from simulator | smoke | `dotnet run -- --use-simulator --create-servers --direct-connection` | Existing (already works) |
| SIM-03 | DemoDataGenerator uploads files via multi-protocol | smoke | `dotnet run -- --use-simulator --create-servers --upload-files --direct-connection` | Wave 0 |

### Sampling Rate
- **Per task commit:** `dotnet build` in DemoDataGenerator directory (compilation check)
- **Per wave merge:** Full run with `--upload-files` against live simulator
- **Phase gate:** Successful run producing files on all protocol servers

### Wave 0 Gaps
- No automated tests exist for DemoDataGenerator — validation is via manual smoke testing
- File verification after upload: use REST API list endpoint to confirm files landed

## Sources

### Primary (HIGH confidence)
- `tools/DemoDataGenerator/Program.cs` — Current CLI flag pattern, pipeline orchestration
- `tools/DemoDataGenerator/Services/FileSimulatorClient.cs` — All simulator API endpoints
- `tools/DemoDataGenerator/Services/SimulatorSeederService.cs` — Server seeding orchestration
- `tools/DemoDataGenerator/Services/ServerMappingService.cs` — Server-to-entity mapping with credential resolution
- `src/Services/Shared/Connectors/IConnectorFactory.cs` — IServerConnector.WriteFileAsync signature
- `src/Services/Shared/Connectors/ConnectorFactory.cs` — DI registration via AddConnectorFactory()
- `src/Services/Shared/Connectors/FtpConnector.cs` — WriteFileAsync implementation pattern
- `src/Services/Shared/Connectors/SftpConnector.cs` — WriteFileAsync with BasePath combination
- `src/Services/Shared/Connectors/NfsConnector.cs` — Local filesystem write (K8s mount paths)
- `src/Services/DataSourceManagementService/Controllers/FileOperationsController.cs` — REST write endpoint
- `tools/DemoDataGenerator/Generators/AllGenerators.cs` — Schema definitions (20 schemas, DataSourceGenerator pattern)

### Secondary (MEDIUM confidence)
- MEMORY.md — SFTP chroot paths (`/data` writable), FTP passive mode, NFS cross-cluster notes
- Phase 15.1 CONTEXT — Protocol testing patterns, base64 file writes via REST

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies needed
- Architecture: HIGH - extending existing patterns (generators, services, connectors)
- Pitfalls: HIGH - based on direct code review and MEMORY.md accumulated knowledge from prior phases

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable — internal tooling, no external dependency changes)

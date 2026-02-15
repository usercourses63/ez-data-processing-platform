# Phase 13: AdminServer & Feature Completion - Research

**Researched:** 2026-02-15
**Domain:** DemoDataGenerator integration, File-Simulator API, NAS device selection UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### DemoDataGenerator - File-Simulator Integration
- **Clean slate seeding**: DemoDataGenerator wipes existing EZ servers/NAS devices before seeding from simulator
- **Configurable server creation**: Flag to choose `--discover-only` (use existing simulator servers) or `--create-servers` (create dynamic servers in simulator before discovering them)
- **Simulator URL config**: appsettings.json default (`FileSimulator:ControlApiUrl`), CLI argument override (`--simulator-url`)
- **Config only mode**: DemoDataGenerator configures servers and DataSources; test module handles test file creation (no file uploads by DemoDataGenerator)
- **All protocols**: DemoDataGenerator configures DataSources using all supported simulator protocols -- FTP, SFTP, NFS/NAS, SMB, HTTP/WebDAV, Kafka. S3 skipped unless its API can be used for test comparison (files not accessible from Windows folders)
- **Protocol mapping**: Simulator servers -> EZ AdminServer Input/Output tabs -> NAS Devices tab. Each simulator server maps to the corresponding EZ entity type based on protocol

#### NAS Device Selection in DataSource Forms
- **NAS dropdown -> auto-test -> sub-path**: When user selects NAS device, system auto-tests connection (verifies export reachable + PVC bound), then user specifies sub-path within mount
- **Role-based filtering**: Connection tab shows only Input/Both NAS devices. Output tab shows only Output/Both/Backup NAS devices. Prevents misconfiguration.
- **Unmounted NAS disabled**: NAS devices without bound PVC appear in dropdown but disabled with "Not mounted" indicator
- **Delete protection**: Already implemented in Phase 12-03 -- delete blocked with Hebrew error listing referencing DataSources

#### E2E Test Architecture
- **New dedicated test project**: Separate from DemoDataGenerator (e.g., `EZ.PipelineTests` or similar)
- **Black-box testing**: Tests interact only with Windows filesystem side. Protocol communication (FTP, SFTP, NFS etc.) happens inside K8s cluster between EZ and simulator. This validates correct protocol usage as in production OCP
- **Test flow**: Write input file to `C:\simulator-data\nas-input-1\` (Windows) -> EZ pipeline discovers/reads/processes/validates/outputs -> Read output from `C:\simulator-data\nas-output-1\` (Windows) -> Compare
- **Content equivalence comparison**: Parse input and output into normalized JSON format, compare content regardless of file format (CSV input -> JSON output still passes)
- **Completion detection**: Poll output folder with timeout (primary) + query EZ DataSource processing stats API (verification/fallback)
- **Protocol coverage**: All protocols tested -- ensures system handles each correctly as in production

#### Production-Like Deployment
- **Separate Helm values file**: `values-local-prod.yaml` with replicas: 1, reduced resources, same images as OCP production
- **Cluster topology**: Two separate Minikube profiles already running -- `minikube` (EZ platform, docker driver, 192.168.49.2) and `file-simulator` (hyperv driver, 172.17.89.141)
- **Differentiation from OCP**: Single-replica for all services and infrastructure. Otherwise identical to production deployment.

### Claude's Discretion
- DemoDataGenerator internal architecture (service classes, command pattern)
- Exact API client implementation for file-simulator integration
- Test project framework choice (xUnit, NUnit, or custom runner)
- Polling intervals and timeout values for E2E completion detection
- Helm values-local-prod.yaml resource limits (memory/CPU per service)

### Deferred Ideas (OUT OF SCOPE)
- Archive extraction E2E testing -- deferred to Phase 18 (E2E Validation). Backend fully implemented.
- SignalR real-time updates -- Phase 16. File-simulator already uses SignalR pattern (reference implementation).
- S3 protocol E2E testing -- only if API-based comparison is feasible (files not on Windows filesystem)

</user_constraints>

## Summary

This phase establishes the integration between EZ Platform's DemoDataGenerator and the file-simulator-suite, enabling automated seeding of AdminServer configurations and NAS devices from the simulator's Control API. The phase also completes the NAS device selection UI in DataSource forms with role-based filtering and connection testing.

The file-simulator-suite v2.1 provides a comprehensive Control API at `http://file-simulator.local:30500` with REST endpoints for server discovery (`GET /api/servers`), dynamic server creation (`POST /api/servers/{type}`), and connection info (`GET /api/connection-info`). The existing EZ codebase already has the entities (`AdminServer`, `NasDevice`), services, and frontend components in place -- this phase connects them to real simulator infrastructure.

**Primary recommendation:** Extend DemoDataGenerator with a `FileSimulatorClient` service that queries the simulator API, maps discovered servers to EZ entities (AdminServer for FTP/SFTP/HTTP/Kafka/S3, NasDevice for NAS servers), and populates MongoDB. Add auto-test behavior to the existing ConnectionTab/OutputTab NAS selection components.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| System.Net.Http.HttpClient | .NET 10.0 | HTTP client for simulator API | Built-in, async, connection pooling |
| System.Text.Json | .NET 10.0 | JSON serialization | High performance, native to .NET |
| MongoDB.Entities | 23.x | Database ORM | Already in use throughout EZ |
| React Query (TanStack) | 5.x | Frontend data fetching | Already in use, handles caching |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Polly | 8.x | Retry policies for API calls | Connection failures to simulator |
| xUnit | 2.6+ | Test framework for E2E project | Recommended for .NET test projects |
| FluentAssertions | 6.x | Test assertions | Clear, readable test code |
| Microsoft.Extensions.Configuration | .NET 10.0 | appsettings.json parsing | CLI config override |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xUnit | NUnit | Both work; xUnit has better parallel execution |
| Polly | Manual retry | Polly provides exponential backoff, circuit breaker |
| System.Net.Http | RestSharp | HttpClient is lighter, sufficient for simple REST |

**Installation:**
```bash
# E2E test project
dotnet add package xunit
dotnet add package xunit.runner.visualstudio
dotnet add package FluentAssertions
dotnet add package Polly.Extensions.Http
```

## Architecture Patterns

### Recommended Project Structure
```
tools/
├── DemoDataGenerator/
│   ├── Program.cs                      # Entry point with new --simulator flags
│   ├── appsettings.json               # FileSimulator:ControlApiUrl config
│   ├── Services/
│   │   ├── FileSimulatorClient.cs     # HTTP client for simulator API
│   │   ├── ServerMappingService.cs    # Maps simulator -> EZ entities
│   │   └── SimulatorSeederService.cs  # Orchestrates discovery + seeding
│   └── Generators/
│       ├── AdminServerGenerator.cs    # EXISTING - modify to use simulator data
│       └── NasDeviceGenerator.cs      # NEW - generates NasDevice entities
tests/
└── EZ.PipelineTests/                   # NEW - separate E2E test project
    ├── EZ.PipelineTests.csproj
    ├── TestFixtures/
    │   ├── SimulatorDataFixture.cs    # Sets up test files
    │   └── PipelineWaitHelper.cs      # Polls for completion
    ├── Tests/
    │   ├── FtpProtocolTests.cs
    │   ├── SftpProtocolTests.cs
    │   ├── NasProtocolTests.cs
    │   └── ContentEquivalenceTests.cs
    └── Helpers/
        └── ContentNormalizer.cs        # JSON normalization for comparison
```

### Pattern 1: Simulator API Client
**What:** Typed HTTP client with retry policy for simulator Control API
**When to use:** All interactions with file-simulator API
**Example:**
```csharp
// Source: file-simulator API-REFERENCE.md
public class FileSimulatorClient
{
    private readonly HttpClient _http;
    private readonly ILogger<FileSimulatorClient> _logger;

    public FileSimulatorClient(HttpClient http, ILogger<FileSimulatorClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<List<SimulatorServer>> GetServersAsync(CancellationToken ct = default)
    {
        var response = await _http.GetAsync("/api/servers", ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<List<SimulatorServer>>(json, _jsonOptions) ?? [];
    }

    public async Task<SimulatorConnectionInfo> GetConnectionInfoAsync(CancellationToken ct = default)
    {
        var response = await _http.GetAsync("/api/connection-info?format=json", ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<SimulatorConnectionInfo>(ct)
            ?? throw new InvalidOperationException("Empty response from simulator");
    }

    public async Task<SimulatorServer> CreateNasServerAsync(string name, string directory, CancellationToken ct = default)
    {
        var request = new { name, directory };
        var response = await _http.PostAsJsonAsync("/api/servers/nas", request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<SimulatorServer>(ct)
            ?? throw new InvalidOperationException("Failed to create NAS server");
    }
}
```

### Pattern 2: Protocol Mapping
**What:** Maps simulator server types to EZ entity types
**When to use:** During seeding to determine AdminServer vs NasDevice
**Example:**
```csharp
// Source: EZ AdminServer.cs, NasDevice.cs entities
public class ServerMappingService
{
    // Simulator protocol -> EZ entity type
    private static readonly Dictionary<string, string> ProtocolToEntityType = new()
    {
        ["FTP"] = "AdminServer",
        ["SFTP"] = "AdminServer",
        ["HTTP"] = "AdminServer",
        ["S3"] = "AdminServer",
        ["Kafka"] = "AdminServer",
        ["NFS"] = "NasDevice",    // NAS servers become NasDevice
        ["NAS"] = "NasDevice"
    };

    // Maps simulator server to EZ AdminServer entity
    public AdminServer MapToAdminServer(SimulatorServer server, SimulatorConnectionInfo connInfo)
    {
        return new AdminServer
        {
            Name = server.Name,
            Description = $"Simulator {server.Protocol} server (auto-discovered)",
            ServerType = server.Protocol.ToLowerInvariant(),
            Direction = DetermineDirection(server.Name),  // Parse from name pattern
            Host = connInfo.Hostname ?? "file-simulator.local",
            Port = server.Port,
            BasePath = DetermineBasePath(server),
            IsActive = server.IsHealthy,
            CredentialSecretRef = GetCredentialRef(server.Protocol),
            TypeSpecificConfig = BuildTypeSpecificConfig(server, connInfo)
        };
    }

    // Maps simulator NAS server to EZ NasDevice entity
    public NasDevice MapToNasDevice(SimulatorServer server, SimulatorConnectionInfo connInfo)
    {
        var nasInfo = connInfo.Nas?.FirstOrDefault(n => n.Name == server.Name);
        return new NasDevice
        {
            Name = server.Name,
            Description = $"Simulator NAS (auto-discovered)",
            Host = nasInfo?.Host ?? "file-simulator.local",
            Port = nasInfo?.Port ?? 2049,
            ExportPath = nasInfo?.Path ?? "/data",
            Role = DetermineNasRole(server.Name),  // Parse from name: input/output/backup
            StorageCapacity = "10Gi",
            IsActive = server.IsHealthy,
            IsPvCreated = false,  // Will be provisioned separately
            IsPvcBound = false
        };
    }

    private NasDeviceRole DetermineNasRole(string name)
    {
        var lower = name.ToLowerInvariant();
        if (lower.Contains("input")) return NasDeviceRole.Input;
        if (lower.Contains("output")) return NasDeviceRole.Output;
        if (lower.Contains("backup")) return NasDeviceRole.Backup;
        return NasDeviceRole.Both;
    }

    private ServerDirection DetermineDirection(string name)
    {
        var lower = name.ToLowerInvariant();
        if (lower.Contains("input")) return ServerDirection.Input;
        if (lower.Contains("output")) return ServerDirection.Output;
        return ServerDirection.Both;
    }
}
```

### Pattern 3: NAS Selection with Auto-Test (Frontend)
**What:** Dropdown selection triggers connection test, shows mount status
**When to use:** ConnectionTab, DestinationEditorModal
**Example:**
```tsx
// Source: Existing ConnectionTab.tsx pattern
const ConnectionTab = ({ form, t, onTestConnection }) => {
  const { mutateAsync: testNasConnection, isLoading: testingNas } = useMutation({
    mutationFn: (deviceId: string) =>
      fetch(`/api/v1/nasdevices/${deviceId}/test-connection`, { method: 'POST' })
        .then(r => r.json()),
  });

  const handleNasDeviceChange = async (deviceId: string) => {
    form.setFieldValue('nasDeviceId', deviceId);

    // Auto-test connection when NAS device selected
    try {
      const result = await testNasConnection(deviceId);
      if (result.Success) {
        message.success(t('datasources.nasConnectionSuccess'));
      } else {
        message.warning(result.ErrorMessage || t('datasources.nasConnectionFailed'));
      }
    } catch (error) {
      message.error(t('datasources.nasTestError'));
    }
  };

  return (
    <Select onChange={handleNasDeviceChange} loading={testingNas}>
      {availableNasDevices.map((device) => {
        const isMounted = device.IsPvCreated && device.IsPvcBound;
        return (
          <Option key={device.ID} value={device.ID} disabled={!isMounted}>
            <Space>
              <HddOutlined style={{ color: isMounted ? '#52c41a' : '#faad14' }} />
              {device.Name}
              {!isMounted && <Tag color="warning">Not mounted</Tag>}
            </Space>
          </Option>
        );
      })}
    </Select>
  );
};
```

### Anti-Patterns to Avoid
- **Hardcoding simulator IP**: Use `file-simulator.local` hostname which resolves via hosts file
- **Polling without timeout**: Always set max wait time (30s recommended) for completion detection
- **Mixing entity types**: NAS servers MUST become NasDevice entities, not AdminServer

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP retry logic | Manual retry loops | Polly retry policy | Handles exponential backoff, jitter, circuit breaker |
| JSON parsing | Regex/string manipulation | System.Text.Json | Type-safe, handles edge cases |
| File watching | Thread.Sleep loops | FileSystemWatcher + timeout | OS-level efficiency |
| Content comparison | String equality | JSON normalization | Format-agnostic, handles whitespace |

**Key insight:** The simulator API is well-documented and returns consistent JSON. Use typed clients with deserialization rather than parsing JSON manually.

## Common Pitfalls

### Pitfall 1: Simulator Not Running
**What goes wrong:** DemoDataGenerator fails with connection refused
**Why it happens:** Minikube file-simulator profile not started or tunnel not running
**How to avoid:** Add health check at startup, fail fast with clear message
**Warning signs:** `HttpRequestException` with `Connection refused`

```csharp
// Health check at startup
public async Task<bool> EnsureSimulatorHealthyAsync()
{
    try
    {
        var response = await _http.GetAsync("/api/health");
        return response.IsSuccessStatusCode;
    }
    catch (HttpRequestException ex)
    {
        _logger.LogError("File-simulator not reachable: {Message}", ex.Message);
        return false;
    }
}
```

### Pitfall 2: NAS Device Role Mismatch
**What goes wrong:** DataSource creation fails because NAS device role doesn't match usage
**Why it happens:** Output tab showing Input-only devices, or vice versa
**How to avoid:** Role filtering already implemented; ensure backend validation matches frontend filtering
**Warning signs:** 400 Bad Request on DataSource create with NAS device

### Pitfall 3: Stale Connection Test Results
**What goes wrong:** User selects NAS device, auto-test passes, but actual usage fails
**Why it happens:** PVC became unbound between test and actual use
**How to avoid:** Re-validate PVC status before DataSource save, not just on selection
**Warning signs:** `IsPvcBound` is false but test showed success

### Pitfall 4: Windows Path vs Unix Path
**What goes wrong:** Test files not found despite being in correct folder
**Why it happens:** Mixing Windows paths (`C:\simulator-data\`) with Unix paths (`/data/`)
**How to avoid:** E2E tests use Windows paths only; let simulator handle the mapping
**Warning signs:** FileNotFoundExceptions with path mismatches

## Code Examples

Verified patterns from official sources and existing EZ codebase:

### Simulator API Response Structures
```csharp
// Source: file-simulator API-REFERENCE.md
public record SimulatorServer
{
    public string Name { get; init; } = "";
    public string Protocol { get; init; } = "";
    public bool IsDynamic { get; init; }
    public string Status { get; init; } = "";
    public bool IsHealthy { get; init; }
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public int Replicas { get; init; }
    public int ReadyReplicas { get; init; }
}

public record SimulatorConnectionInfo
{
    public string Hostname { get; init; } = "";
    public SimulatorFtpInfo? Ftp { get; init; }
    public SimulatorSftpInfo? Sftp { get; init; }
    public SimulatorHttpInfo? Http { get; init; }
    public SimulatorS3Info? S3 { get; init; }
    public SimulatorKafkaInfo? Kafka { get; init; }
    public List<SimulatorNasInfo>? Nas { get; init; }
}

public record SimulatorNasInfo
{
    public string Name { get; init; } = "";
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public string Path { get; init; } = "";
}
```

### Clean Slate Seeding
```csharp
// Source: DemoDataGenerator existing pattern + decision
public class SimulatorSeederService
{
    private readonly FileSimulatorClient _client;
    private readonly ServerMappingService _mapper;
    private readonly ILogger<SimulatorSeederService> _logger;

    public async Task SeedFromSimulatorAsync(bool createDynamic, CancellationToken ct)
    {
        // Step 1: Clean slate - wipe existing servers/devices
        _logger.LogInformation("Wiping existing AdminServers and NasDevices...");
        await DB.DeleteAsync<AdminServer>(_ => true, ct);
        await DB.DeleteAsync<NasDevice>(_ => true, ct);

        // Step 2: Optionally create dynamic servers in simulator
        if (createDynamic)
        {
            _logger.LogInformation("Creating dynamic servers in simulator...");
            await _client.CreateNasServerAsync("dyn-input", "input", ct);
            await _client.CreateNasServerAsync("dyn-output", "output", ct);
        }

        // Step 3: Discover all servers from simulator
        _logger.LogInformation("Discovering servers from simulator...");
        var servers = await _client.GetServersAsync(ct);
        var connInfo = await _client.GetConnectionInfoAsync(ct);

        // Step 4: Map and save to EZ database
        foreach (var server in servers)
        {
            if (server.Protocol is "NFS" or "NAS")
            {
                var nasDevice = _mapper.MapToNasDevice(server, connInfo);
                await nasDevice.SaveAsync(cancellation: ct);
                _logger.LogInformation("Created NasDevice: {Name}", nasDevice.Name);
            }
            else
            {
                var adminServer = _mapper.MapToAdminServer(server, connInfo);
                await adminServer.SaveAsync(cancellation: ct);
                _logger.LogInformation("Created AdminServer: {Name}", adminServer.Name);
            }
        }
    }
}
```

### E2E Test Pattern
```csharp
// Source: Decision - black-box testing via Windows filesystem
public class NasProtocolTests : IClassFixture<SimulatorDataFixture>
{
    private readonly SimulatorDataFixture _fixture;

    public NasProtocolTests(SimulatorDataFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Pipeline_ProcessesInputFile_ProducesMatchingOutput()
    {
        // Arrange - Write test file to Windows input folder
        var inputPath = @"C:\simulator-data\nas-input-1\test-data.csv";
        var expectedOutput = @"C:\simulator-data\nas-output-1\test-data.json";
        var inputContent = "id,name,value\n1,Test,100\n2,Sample,200";

        await File.WriteAllTextAsync(inputPath, inputContent);

        // Act - Wait for pipeline to process (poll output folder)
        var waitHelper = new PipelineWaitHelper(TimeSpan.FromSeconds(30));
        var outputExists = await waitHelper.WaitForFileAsync(expectedOutput);

        Assert.True(outputExists, "Output file was not created within timeout");

        // Assert - Compare content (normalized JSON)
        var outputContent = await File.ReadAllTextAsync(expectedOutput);
        var normalizedInput = ContentNormalizer.NormalizeCsv(inputContent);
        var normalizedOutput = ContentNormalizer.NormalizeJson(outputContent);

        normalizedOutput.Should().BeEquivalentTo(normalizedInput);
    }
}

public class PipelineWaitHelper
{
    private readonly TimeSpan _timeout;
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(1);

    public PipelineWaitHelper(TimeSpan timeout) => _timeout = timeout;

    public async Task<bool> WaitForFileAsync(string path)
    {
        var stopwatch = Stopwatch.StartNew();
        while (stopwatch.Elapsed < _timeout)
        {
            if (File.Exists(path))
                return true;
            await Task.Delay(_pollInterval);
        }
        return false;
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual IP detection | `file-simulator.local` hostname | v0.2.0 | No more hosts file permission issues |
| AdminServer for all protocols | NasDevice separate entity | Phase 12 | Role-based filtering, PVC tracking |
| Static demo data | Simulator-based seeding | Phase 13 | Real protocol testing possible |

**Deprecated/outdated:**
- Direct NFS server type in AdminServer: Now use NasDevice entity for all NAS/NFS
- `minikube ip` calls: Use stable hostname instead

## Open Questions

1. **S3 E2E Testing Feasibility**
   - What we know: S3 files not on Windows filesystem (MinIO in K8s only)
   - What's unclear: Can we use MinIO client from test project to compare?
   - Recommendation: Defer to Phase 18 unless quick spike shows it's easy

2. **Dynamic Server Cleanup**
   - What we know: `--create-servers` creates dynamic servers in simulator
   - What's unclear: Should DemoDataGenerator clean them up on next run?
   - Recommendation: Yes, delete existing dynamic servers before creating new ones

3. **NasDevice Provisioning Automation**
   - What we know: DemoDataGenerator seeds NasDevice records, provisioning is separate
   - What's unclear: Should DemoDataGenerator also trigger `POST /api/v1/nasdevices/{id}/provision`?
   - Recommendation: Yes, provision immediately after seeding for full automation

## Sources

### Primary (HIGH confidence)
- `file-simulator-suite/docs/API-REFERENCE.md` - Full Control API documentation
- `file-simulator-suite/README.md` - Server endpoints, credentials, architecture
- `EZ/src/Services/Shared/Entities/AdminServer.cs` - Server entity structure
- `EZ/src/Services/Shared/Entities/NasDevice.cs` - NAS entity structure
- `EZ/src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx` - Existing NAS selection UI

### Secondary (MEDIUM confidence)
- `file-simulator-suite/docs/CLIENT-INTEGRATION-GUIDE.md` - .NET client patterns
- `EZ/tools/DemoDataGenerator/Generators/AdminServerGenerator.cs` - Existing generator pattern
- `EZ/src/Services/DataSourceManagementService/Controllers/NasDevicesController.cs` - NAS API endpoints

### Tertiary (LOW confidence)
- None - all patterns verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing .NET 10.0 patterns and libraries already in project
- Architecture: HIGH - Follows established DemoDataGenerator patterns with verified API
- Pitfalls: HIGH - Based on actual codebase patterns and API documentation

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - stable patterns, unlikely to change)

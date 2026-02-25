# Phase 3: Protocol Test Coverage - Research

**Researched:** 2026-02-02
**Domain:** Integration Testing, Protocol Connectors, xUnit Test Patterns, File-Simulator Integration
**Confidence:** HIGH

## Summary

This research investigates how to build comprehensive integration tests for all 8 EZ Platform file protocol connectors (FTP, SFTP, S3/MinIO, SMB, NFS, HTTP/WebDAV, Kafka, Local) against the file-simulator test environment. The goal is to verify every connector works correctly with real protocol servers rather than mocks.

The EZ Platform already has well-structured connectors implementing both `IDataSourceConnector` (legacy pattern) and `IServerConnector` (AdminServer pattern). The existing test infrastructure uses xUnit with collection fixtures and demonstrates patterns we should follow. The file-simulator provides NodePort endpoints for FTP (30021), SFTP (30022), S3/MinIO (30900), HTTP (30088), WebDAV (30089), and NFS (32150-32156). SMB support requires special handling (port 445 via tunnel).

**Primary recommendation:** Create a FileSimulatorFixture using xUnit's ICollectionFixture pattern that manages file-simulator connectivity, provides test file setup/cleanup helpers, and enables parallel test execution. Test each connector with read, write, list, and connection test operations.

## Standard Stack

The established libraries/tools for this testing domain:

### Core (Testing Framework)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xUnit | 2.9.0+ | Test framework | Already used in EZ Platform, supports ICollectionFixture for shared context |
| FluentAssertions | 6.12.0+ | Assertion library | Readable assertions, already used in KafkaFlowTests |
| Bogus | 35.0.0+ | Test data generation | Standard for generating realistic test data |

### Protocol Libraries (Already in EZ Platform)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FluentFTP | 50.0.1 | FTP client | Used in FtpConnector, has test support |
| SSH.NET (Renci.SshNet) | 2024.1.0 | SFTP client | Used in SftpConnector, production-ready |
| AWSSDK.S3 | 3.7.305 | S3/MinIO client | Used in S3Connector, works with MinIO |
| Confluent.Kafka | 2.3.0+ | Kafka client | Used in KafkaConnector and KafkaFlowTests |

### SMB Library (NEW - Required for SMB connector)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SMBLibrary | 1.5.5.1 | SMB 1/2/3 client | Open-source, .NET Standard 2.0, actively maintained by TalAloni |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Polly | 8.2.0+ | Resilience patterns | Retry logic for transient network failures in tests |
| System.IO.Abstractions | 20.0.0+ | File system abstraction | Optional for local connector tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SMBLibrary | EzSmb | EzSmb is built on SMBLibrary, adds convenience but extra dependency |
| SMBLibrary | SharpCifs.Std | Only supports SMB v1, incompatible with modern Windows |
| Direct file-simulator | Testcontainers | File-simulator is already deployed, Testcontainers adds complexity |

**Installation:**
```bash
# SMB connector (if not present)
dotnet add src/Services/Shared package SMBLibrary --version 1.5.5.1

# Testing packages (if not present in test project)
dotnet add tests/IntegrationTests package FluentAssertions
dotnet add tests/IntegrationTests package Bogus
```

## Architecture Patterns

### Recommended Test Project Structure
```
tests/IntegrationTests/
├── Connectors/                        # Protocol connector integration tests
│   ├── FtpConnectorTests.cs           # FTP read/write/list tests
│   ├── SftpConnectorTests.cs          # SFTP read/write/list tests
│   ├── S3ConnectorTests.cs            # S3/MinIO read/write/list tests
│   ├── SmbConnectorTests.cs           # SMB read/write/list tests (NEW)
│   ├── NfsConnectorTests.cs           # NFS via NAS device tests
│   ├── HttpApiConnectorTests.cs       # HTTP/WebDAV read tests
│   ├── KafkaConnectorTests.cs         # Kafka produce/consume tests
│   └── LocalFileConnectorTests.cs     # Local filesystem (OCP-incompatible reference)
├── Fixtures/
│   ├── FileSimulatorFixture.cs        # File-simulator connection management (NEW)
│   ├── KafkaFixture.cs                # Kafka producer/consumer (existing)
│   ├── MongoDbFixture.cs              # MongoDB connection (existing)
│   └── HazelcastFixture.cs            # Hazelcast connection (existing)
├── TestData/
│   └── ProtocolTestDataFactory.cs     # Test file generation helpers (NEW)
└── IntegrationTestCollection.cs       # Collection definition (existing)
```

### Pattern 1: FileSimulatorFixture with ICollectionFixture
**What:** Shared fixture managing file-simulator connectivity and test data setup
**When to use:** All protocol connector tests
**Example:**
```csharp
// Source: EZ Platform tests/IntegrationTests/Fixtures/FileSimulatorFixture.cs (NEW)
public class FileSimulatorFixture : IAsyncLifetime
{
    public string FileSimulatorIp { get; private set; } = string.Empty;
    public bool IsFileSimulatorAvailable { get; private set; }

    // Protocol endpoints
    public string FtpEndpoint => $"{FileSimulatorIp}:30021";
    public string SftpEndpoint => $"{FileSimulatorIp}:30022";
    public string S3Endpoint => $"http://{FileSimulatorIp}:30900";
    public string HttpEndpoint => $"http://{FileSimulatorIp}:30088";
    public string WebDavEndpoint => $"http://{FileSimulatorIp}:30089";

    // Default credentials (from file-simulator)
    public (string User, string Password) FtpCredentials => ("ftpuser", "ftppass123");
    public (string User, string Password) SftpCredentials => ("sftpuser", "sftppass123");
    public (string AccessKey, string SecretKey) S3Credentials => ("minioadmin", "minioadmin123");
    public (string User, string Password) HttpCredentials => ("httpuser", "httppass123");

    public async Task InitializeAsync()
    {
        // Try to get file-simulator IP
        FileSimulatorIp = await GetFileSimulatorIpAsync();
        IsFileSimulatorAvailable = !string.IsNullOrEmpty(FileSimulatorIp)
            && await TestConnectivityAsync();
    }

    public async Task DisposeAsync()
    {
        // Cleanup test files if needed
    }

    private async Task<string> GetFileSimulatorIpAsync()
    {
        // Read from environment variable or ConfigMap
        var ip = Environment.GetEnvironmentVariable("FILE_SIMULATOR_IP");
        if (!string.IsNullOrEmpty(ip)) return ip;

        // Try to read from resolved ConfigMap
        // Or execute: minikube ip -p file-simulator
        return string.Empty;
    }

    private async Task<bool> TestConnectivityAsync()
    {
        // Test basic TCP connectivity to FTP port
        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(FileSimulatorIp, 30021);
            return true;
        }
        catch { return false; }
    }
}
```

### Pattern 2: Connector Test Base Class
**What:** Abstract base class for common connector test setup
**When to use:** Inherit for each protocol connector test class
**Example:**
```csharp
// Source: Derived from existing EZ Platform test patterns
[Collection("Integration")]
public abstract class ConnectorTestBase : IClassFixture<FileSimulatorFixture>
{
    protected readonly FileSimulatorFixture FileSimulator;
    protected readonly ITestOutputHelper Output;
    protected readonly string TestRunId;

    protected ConnectorTestBase(FileSimulatorFixture fileSimulator, ITestOutputHelper output)
    {
        FileSimulator = fileSimulator;
        Output = output;
        TestRunId = Guid.NewGuid().ToString("N")[..8];
    }

    protected void SkipIfFileSimulatorUnavailable()
    {
        Skip.If(!FileSimulator.IsFileSimulatorAvailable,
            "File-simulator is not available. Run verification script first.");
    }

    protected string GenerateTestFileName(string extension = ".csv")
    {
        return $"test-{TestRunId}-{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
    }

    protected byte[] GenerateTestContent(int recordCount = 10)
    {
        var sb = new StringBuilder();
        sb.AppendLine("id,name,amount,date");
        for (int i = 1; i <= recordCount; i++)
        {
            sb.AppendLine($"{i},Item-{i},{i * 100.50:F2},{DateTime.UtcNow:yyyy-MM-dd}");
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
```

### Pattern 3: Protocol-Specific Test Class
**What:** Concrete test class for each protocol connector
**When to use:** Implement for FTP, SFTP, S3, HTTP, NFS, SMB, Kafka
**Example:**
```csharp
// Source: Derived from EZ Platform connector patterns
public class FtpConnectorTests : ConnectorTestBase
{
    private readonly FtpConnector _connector;
    private readonly ILogger<FtpConnector> _logger;

    public FtpConnectorTests(FileSimulatorFixture fileSimulator, ITestOutputHelper output)
        : base(fileSimulator, output)
    {
        _logger = new TestOutputLogger<FtpConnector>(output);
        _connector = new FtpConnector(_logger);
    }

    [Fact]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "FTP")]
    public async Task FtpConnector_TestConnection_ReturnsSuccess()
    {
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        // Act
        var result = await _connector.TestConnectionAsync(server, credentials);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.ResponseTimeMs.Should().BeLessThan(5000);
    }

    [Fact]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "FTP")]
    public async Task FtpConnector_WriteAndReadFile_RoundTripsSuccessfully()
    {
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();
        var fileName = GenerateTestFileName();
        var content = GenerateTestContent();

        // Act - Write
        await _connector.WriteFileAsync(server, credentials, $"/output/{fileName}", content);

        // Act - Read
        var readContent = await _connector.ReadFileAsync(server, credentials, $"/output/{fileName}");

        // Assert
        readContent.Should().BeEquivalentTo(content);
    }

    [Fact]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "FTP")]
    public async Task FtpConnector_ListFiles_ReturnsMatchingFiles()
    {
        SkipIfFileSimulatorUnavailable();

        // Arrange
        var server = CreateAdminServer();
        var credentials = CreateCredentials();

        // Act
        var files = await _connector.ListFilesAsync(server, credentials, "/", "*.csv");

        // Assert
        files.Should().NotBeNull();
        files.Should().OnlyContain(f => f.FileName.EndsWith(".csv"));
    }

    private AdminServer CreateAdminServer()
    {
        return new AdminServer
        {
            Name = "file-simulator-ftp",
            ServerType = "ftp",
            Host = FileSimulator.FileSimulatorIp,
            Port = 30021,
            BasePath = "/",
            ConnectionTimeoutSeconds = 30
        };
    }

    private ServerCredentials CreateCredentials()
    {
        var (user, pass) = FileSimulator.FtpCredentials;
        return new ServerCredentials
        {
            Username = user,
            Password = pass
        };
    }
}
```

### Pattern 4: NFS Tests via NAS Device Entity
**What:** NFS tests that use Phase 2 NAS device infrastructure
**When to use:** Testing NFS connector through NAS device PV/PVC mounts
**Example:**
```csharp
// Source: Phase 2 NAS architecture integration
public class NfsConnectorTests : ConnectorTestBase
{
    private readonly NfsConnector _connector;

    public NfsConnectorTests(FileSimulatorFixture fileSimulator, ITestOutputHelper output)
        : base(fileSimulator, output)
    {
        _connector = new NfsConnector(new TestOutputLogger<NfsConnector>(output));
    }

    [Fact]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    public async Task NfsConnector_TestConnection_WithMountedPvc_ReturnsSuccess()
    {
        SkipIfFileSimulatorUnavailable();

        // Arrange - NFS connector accesses files via mounted PVC path
        // Path: /mnt/nas-input-1 (mounted by K8s from file-simulator NAS)
        var server = new AdminServer
        {
            Name = "nas-input-1",
            ServerType = "nfs",
            BasePath = "/mnt/nas-input-1",
            ConnectionTimeoutSeconds = 30
        };

        // Act
        var result = await _connector.TestConnectionAsync(server, null);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Message.Should().Contain("mount accessible");
    }

    [Fact]
    [Trait("Category", "Protocol")]
    [Trait("Protocol", "NFS")]
    public async Task NfsConnector_ListFiles_ViaKubernetesPvcMount()
    {
        SkipIfFileSimulatorUnavailable();

        // NFS connector uses local filesystem API on mounted PVC
        var server = new AdminServer
        {
            Name = "nas-input-1",
            ServerType = "nfs",
            BasePath = "/mnt/nas-input-1"
        };

        // Act
        var files = await _connector.ListFilesAsync(server, null, null, "*.*");

        // Assert
        files.Should().NotBeNull();
        Output.WriteLine($"Found {files.Count} files in NAS mount");
    }
}
```

### Anti-Patterns to Avoid
- **Hardcoding file-simulator IP:** Use environment variables or ConfigMap; IP changes after restart
- **Shared test files:** Use unique file names per test (include TestRunId) to prevent interference
- **Ignoring connection failures:** Use Skip.If() to skip tests gracefully when file-simulator unavailable
- **Testing Local connector in CI:** Local connector is OCP-incompatible; document as reference only
- **SMB on NodePort:** SMB requires port 445; use tunnel or skip SMB tests without tunnel

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test file generation | Manual string building | Bogus library | Realistic data, locale support, type safety |
| Assertion readability | Assert.True/False chains | FluentAssertions | Readable failures, rich comparison |
| Test retries | Manual try-catch loops | Polly or xUnit.retries | Exponential backoff, jitter built-in |
| Test context sharing | Static variables | ICollectionFixture | Thread-safe, proper lifecycle management |
| Protocol client libraries | Raw sockets | FluentFTP, SSH.NET, AWSSDK.S3, SMBLibrary | Handles edge cases, encoding, timeouts |
| Test output logging | Console.WriteLine | ITestOutputHelper | Captured per test, visible in test explorer |

**Key insight:** The EZ Platform connectors already implement all protocol operations. Tests should verify these implementations work against real servers, not re-implement protocol logic.

## Common Pitfalls

### Pitfall 1: File-Simulator IP Changes After Restart
**What goes wrong:** Tests fail with connection refused after Minikube restart
**Why it happens:** Minikube assigns dynamic IP per session
**How to avoid:**
1. Run `scripts/verify-file-simulator.ps1 -Apply` after restart
2. Tests read IP from environment variable or ConfigMap
3. FileSimulatorFixture handles IP resolution
**Warning signs:** Tests passed yesterday, fail today with no code changes

### Pitfall 2: Test File Interference
**What goes wrong:** Tests fail intermittently due to shared files
**Why it happens:** Multiple tests read/write same files
**How to avoid:**
1. Generate unique file names per test (include GUID or timestamp)
2. Clean up test files in test teardown
3. Use separate directories per test class
**Warning signs:** Flaky tests, unexpected file contents, test order matters

### Pitfall 3: SMB Port 445 Requirement
**What goes wrong:** SMB connector tests fail while FTP/SFTP work
**Why it happens:** SMBLibrary requires standard port 445, not NodePort 30445
**How to avoid:**
1. Run `minikube tunnel -p file-simulator` before SMB tests
2. Use LoadBalancer IP, not NodePort
3. Consider SMB tests optional until tunnel is available
**Warning signs:** FTP, SFTP pass; SMB fails with "connection refused"

### Pitfall 4: NFS Mount Not Ready
**What goes wrong:** NFS tests fail with "file not found" or empty directory
**Why it happens:** Init container hasn't synced files from Windows
**How to avoid:**
1. Place test files in `C:\simulator-data\nas-*` directories first
2. Restart NAS pod to trigger sync
3. Add retry logic for initial mount delay
**Warning signs:** Tests pass locally but fail in CI; directory exists but is empty

### Pitfall 5: Kafka Consumer Group Conflicts
**What goes wrong:** Kafka tests miss messages or get duplicates
**Why it happens:** Shared consumer group across tests
**How to avoid:**
1. Use unique consumer group ID per test (already done in KafkaFixture)
2. Use `AutoOffsetReset.Earliest` for new groups
3. Don't share consumers between tests
**Warning signs:** Messages "disappear" or appear multiple times

### Pitfall 6: Missing SMB Connector Implementation
**What goes wrong:** SMB tests cannot run because connector doesn't exist
**Why it happens:** SMB connector was not implemented yet (only in file-simulator docs)
**How to avoid:**
1. Implement SmbConnector following FtpConnector pattern
2. Add SMBLibrary NuGet package
3. Register in ConnectorFactory
**Warning signs:** ConnectorFactory throws "Unknown server type: smb"

## Code Examples

Verified patterns from official sources and existing EZ Platform code:

### FileSimulatorFixture Implementation
```csharp
// Source: Derived from existing KafkaFixture pattern
// File: tests/IntegrationTests/Fixtures/FileSimulatorFixture.cs

using System.Net.Sockets;

namespace DataProcessing.IntegrationTests.Fixtures;

/// <summary>
/// Manages file-simulator connectivity for protocol integration tests.
/// Provides endpoints, credentials, and test data helpers.
/// </summary>
public class FileSimulatorFixture : IAsyncLifetime
{
    // Connection state
    public string FileSimulatorIp { get; private set; } = string.Empty;
    public bool IsAvailable { get; private set; }

    // Protocol endpoints
    public int FtpPort => 30021;
    public int SftpPort => 30022;
    public int S3Port => 30900;
    public int HttpPort => 30088;
    public int WebDavPort => 30089;

    // Credentials
    public static class Credentials
    {
        public static readonly (string User, string Password) Ftp = ("ftpuser", "ftppass123");
        public static readonly (string User, string Password) Sftp = ("sftpuser", "sftppass123");
        public static readonly (string AccessKey, string SecretKey) S3 = ("minioadmin", "minioadmin123");
        public static readonly (string User, string Password) Http = ("httpuser", "httppass123");
    }

    public async Task InitializeAsync()
    {
        // 1. Try environment variable
        FileSimulatorIp = Environment.GetEnvironmentVariable("FILE_SIMULATOR_IP") ?? "";

        // 2. Fall back to known dev IP
        if (string.IsNullOrEmpty(FileSimulatorIp))
        {
            FileSimulatorIp = "172.25.201.3"; // Common Hyper-V IP
        }

        // 3. Verify connectivity
        IsAvailable = await TestTcpConnectivityAsync(FileSimulatorIp, FtpPort);

        Console.WriteLine($"FileSimulatorFixture: IP={FileSimulatorIp}, Available={IsAvailable}");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<bool> TestTcpConnectivityAsync(string host, int port)
    {
        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(host, port);
            var completed = await Task.WhenAny(connectTask, Task.Delay(3000));
            return completed == connectTask && client.Connected;
        }
        catch
        {
            return false;
        }
    }
}
```

### SMB Connector Implementation Skeleton
```csharp
// Source: Derived from file-simulator docs and SMBLibrary GitHub
// File: src/Services/Shared/Connectors/SmbConnector.cs (NEW)

using SMBLibrary;
using SMBLibrary.Client;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading/writing files via SMB protocol.
/// Requires SMBLibrary NuGet package.
/// Note: SMB requires port 445; NodePort mapping doesn't work.
/// </summary>
public class SmbConnector : IDataSourceConnector, IServerConnector
{
    private readonly ILogger<SmbConnector> _logger;

    public string ConnectorType => "smb";

    public SmbConnector(ILogger<SmbConnector> logger)
    {
        _logger = logger;
    }

    public async Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            using var client = new SMB2Client();
            var connected = client.Connect(
                System.Net.IPAddress.Parse(server.Host!),
                SMBTransportType.DirectTCPTransport);

            if (!connected)
            {
                return ConnectionTestResult.Failure("Failed to connect to SMB server");
            }

            var status = client.Login(
                string.Empty, // Domain
                credentials?.Username ?? "guest",
                credentials?.Password ?? string.Empty);

            if (status != NTStatus.STATUS_SUCCESS)
            {
                return ConnectionTestResult.Failure($"SMB login failed: {status}");
            }

            client.Logoff();
            client.Disconnect();
            stopwatch.Stop();

            return ConnectionTestResult.Success(
                stopwatch.ElapsedMilliseconds,
                $"SMB Server connected successfully");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "SMB connection test failed: {Server}", server.Host);
            return ConnectionTestResult.Failure($"SMB Error: {ex.Message}");
        }
    }

    // ... ReadFileAsync, WriteFileAsync, ListFilesAsync implementations
    // Follow pattern from FtpConnector using SMBLibrary API
}
```

### Test Collection Definition
```csharp
// Source: Existing IntegrationTestCollection.cs pattern
// Update to include FileSimulatorFixture

[CollectionDefinition("Integration")]
public class IntegrationTestCollection :
    ICollectionFixture<IntegrationTestContext>,
    ICollectionFixture<FileSimulatorFixture>,
    ICollectionFixture<KafkaFixture>
{
    // Combined fixtures for all integration tests
}
```

### Running Protocol Tests
```bash
# Run all protocol tests
dotnet test tests/IntegrationTests --filter "Category=Protocol"

# Run specific protocol
dotnet test tests/IntegrationTests --filter "Protocol=FTP"

# Run with file-simulator IP override
FILE_SIMULATOR_IP=172.25.201.3 dotnet test tests/IntegrationTests --filter "Category=Protocol"

# Run with verbose output
dotnet test tests/IntegrationTests --filter "Category=Protocol" --logger "console;verbosity=detailed"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock protocol clients | Real servers via file-simulator | Phase 1 (2026-02) | Full protocol fidelity |
| Static test files | Dynamic test data with Bogus | xUnit best practices | No file conflicts |
| Manual server setup | NodePort services on file-simulator | file-simulator v1.0 | Automated test infrastructure |
| SMB v1 (SharpCifs) | SMB 2/3 (SMBLibrary) | SMBLibrary 1.5 | Compatible with modern Windows |

**Deprecated/outdated:**
- **SharpCifs.Std:** Only SMB v1, incompatible with current Windows (use SMBLibrary)
- **Local file mocks:** Use file-simulator for realistic testing
- **Shared consumer groups:** Use per-test unique groups (already implemented)

## Open Questions

Things that couldn't be fully resolved:

1. **SMB Connector Implementation Status**
   - What we know: ConnectorFactory doesn't register "smb" type; no SmbConnector.cs exists
   - What's unclear: Is SMB support required for v0.2.0, or deferred?
   - Recommendation: Create SmbConnector using SMBLibrary; mark tests as optional until implemented

2. **NFS Test Execution Context**
   - What we know: NFS connector works via mounted PVC path; tests run on dev machine
   - What's unclear: How do tests access /mnt/nas-* paths that only exist inside K8s pods?
   - Recommendation: For CI, run tests inside K8s pod with mounted PVC, or use kubectl exec pattern

3. **Local Connector OCP Compatibility**
   - What we know: Local connector tests exist but use local filesystem paths
   - What's unclear: Should local connector tests be completely skipped or maintained as reference?
   - Recommendation: Document as OCP-incompatible; keep tests but mark as [Trait("OCP", "Incompatible")]

4. **WebDAV vs HTTP Separation**
   - What we know: HttpApiConnector handles both HTTP and WebDAV; file-simulator has separate ports
   - What's unclear: Should WebDAV have separate tests or use HttpApiConnector with DAV methods?
   - Recommendation: Use HttpApiConnector for both; add WebDAV-specific write tests using PUT method

## Sources

### Primary (HIGH confidence)
- **EZ Platform Connectors** (`src/Services/Shared/Connectors/*.cs`) - Existing implementation patterns
- **EZ Platform Tests** (`tests/IntegrationTests/`) - Existing xUnit patterns, KafkaFixture, MongoDbFixture
- **Phase 1 Research** (`.planning/phases/01-file-simulator-integration/01-RESEARCH.md`) - File-simulator infrastructure
- **Phase 2 Research** (`.planning/phases/02-nas-nfs-architecture/02-RESEARCH.md`) - NAS device entity, NFS connector
- **File-Simulator Setup** (`docs/testing/file-simulator-setup.md`) - NodePorts, credentials, troubleshooting

### Secondary (MEDIUM confidence)
- [xUnit Advanced Features: Fixtures](https://medium.com/@leogjorge/xunit-advanced-features-fixtures-6b0ca4d10469) - Collection fixture patterns
- [FluentFTP Automated Testing](https://github.com/robinrodricks/FluentFTP/wiki/Automated-Testing) - FTP testing patterns
- [SMBLibrary GitHub](https://github.com/TalAloni/SMBLibrary) - SMB client implementation reference
- [Integration Testing with xUnit](https://www.jimmybogard.com/integration-testing-with-xunit/) - Test organization patterns

### Tertiary (LOW confidence)
- [ASP.NET Core Integration Testing Best Practices](https://antondevtips.com/blog/asp-net-core-integration-testing-best-practises) - General integration testing guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing EZ Platform libraries and test patterns
- Architecture: HIGH - Based on existing IntegrationTests structure and connector implementations
- Pitfalls: HIGH - Documented issues from Phase 1 research and file-simulator CLAUDE.md

**Research date:** 2026-02-02
**Valid until:** 60 days (test patterns are stable; xUnit and FluentAssertions versions may update)

---

## Implementation Requirements Mapping

| Requirement | Test Coverage | Confidence |
|-------------|--------------|------------|
| TEST-02: FTP protocol | FtpConnectorTests (TestConnection, ReadWrite, ListFiles) | HIGH |
| TEST-02: SFTP protocol | SftpConnectorTests (TestConnection, ReadWrite, ListFiles) | HIGH |
| TEST-02: S3/MinIO protocol | S3ConnectorTests (TestConnection, ReadWrite, ListFiles) | HIGH |
| TEST-02: SMB protocol | SmbConnectorTests (requires new SmbConnector implementation) | MEDIUM |
| TEST-02: NFS->NAS protocol | NfsConnectorTests via NAS device PV/PVC mounts | HIGH |
| TEST-02: HTTP protocol | HttpApiConnectorTests (TestConnection, Read, List) | HIGH |
| TEST-02: Kafka protocol | KafkaConnectorTests (existing KafkaFlowTests pattern) | HIGH |
| TEST-02: Local protocol | LocalFileConnectorTests (documented as OCP-incompatible) | HIGH |

## Appendix: File-Simulator Protocol Quick Reference

| Protocol | NodePort | Credentials | Test Endpoint Pattern |
|----------|----------|-------------|----------------------|
| FTP | 30021 | ftpuser / ftppass123 | `{IP}:30021` |
| SFTP | 30022 | sftpuser / sftppass123 | `{IP}:30022` |
| S3/MinIO | 30900 | minioadmin / minioadmin123 | `http://{IP}:30900` |
| HTTP | 30088 | httpuser / httppass123 | `http://{IP}:30088/` |
| WebDAV | 30089 | httpuser / httppass123 | `http://{IP}:30089/` |
| SMB | 445 (tunnel) | smbuser / smbpass123 | Requires `minikube tunnel` |
| NFS | 32150-32156 | N/A (via PV/PVC) | Mounted at `/mnt/nas-*` |

## Test Categories and Traits

```csharp
// Recommended test traits for filtering
[Trait("Category", "Protocol")]      // All protocol connector tests
[Trait("Protocol", "FTP")]           // Protocol-specific
[Trait("Protocol", "SFTP")]
[Trait("Protocol", "S3")]
[Trait("Protocol", "SMB")]
[Trait("Protocol", "NFS")]
[Trait("Protocol", "HTTP")]
[Trait("Protocol", "Kafka")]
[Trait("Protocol", "Local")]
[Trait("OCP", "Compatible")]         // Works in OCP
[Trait("OCP", "Incompatible")]       // Does not work in OCP (e.g., Local)
[Trait("Dependency", "FileSimulator")] // Requires file-simulator
[Trait("Dependency", "Tunnel")]       // Requires minikube tunnel (SMB)
```

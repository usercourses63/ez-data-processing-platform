# Technology Stack Additions for v0.2.0

**Project:** EZ Platform - Production Validation & Release
**Researched:** 2026-02-11
**Scope:** Stack additions for SignalR real-time monitoring, OTEL verification, file-simulator integration, device health monitoring, and archive extraction

---

## Executive Summary

This document covers ONLY new stack additions needed for v0.2.0 features. The existing stack (React 19, .NET 10, MongoDB, Kafka, MassTransit, OTEL, etc.) is validated and does not require changes.

**Key Finding:** Most required capabilities are already present or require minimal additions. The frontend already has `@microsoft/signalr` installed. The backend already has comprehensive OTEL instrumentation and SharpCompress for archive extraction.

---

## Recommended Stack Additions

### 1. SignalR Real-Time Updates (Backend)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| `Microsoft.AspNetCore.SignalR.Core` | 10.0.3 | Server-side SignalR hub | Built into ASP.NET Core 10.0 - no additional package needed |

**Why:** SignalR is already part of ASP.NET Core 10.0. The frontend already has `@microsoft/signalr@7.0.11` installed (upgrade to 10.0.0 recommended for version alignment).

**Backend Implementation Pattern (from file-simulator-suite reference):**
```csharp
// Hubs/SystemMonitoringHub.cs
public class SystemMonitoringHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        // Subscribe to service group for targeted broadcasts
        await Groups.AddToGroupAsync(Context.ConnectionId, "monitoring");
        await base.OnConnectedAsync();
    }
}

// Program.cs
app.MapHub<SystemMonitoringHub>("/hubs/monitoring");
```

**Frontend Pattern (from file-simulator-suite useSignalR hook):**
```typescript
// Copy useSignalR.ts from file-simulator-suite/src/dashboard/src/hooks/useSignalR.ts
// Key features: automatic reconnection, connection state tracking, last update timestamp
```

**Confidence:** HIGH - Verified with official Microsoft documentation and NuGet package versions.

---

### 2. SignalR Frontend Client (Upgrade)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| `@microsoft/signalr` | 10.0.0 | React SignalR client | Version alignment with .NET 10 backend |

**Current:** `@microsoft/signalr@7.0.11` (in package.json)
**Recommended:** `@microsoft/signalr@10.0.0` (latest stable, published November 2025)

**Why Upgrade:** Version alignment ensures protocol compatibility. The 10.x version is designed for ASP.NET Core 10.0 SignalR hubs.

**Installation:**
```bash
cd src/Frontend
npm install @microsoft/signalr@10.0.0
```

**Confidence:** HIGH - Verified on npm registry.

---

### 3. OTEL Verification Tooling

**Finding:** No additional packages needed. The existing OTEL stack is comprehensive.

**Existing Stack (in Directory.Packages.props):**
- `OpenTelemetry` 1.14.0
- `OpenTelemetry.Extensions.Hosting` 1.14.0
- `OpenTelemetry.Instrumentation.AspNetCore` 1.14.0
- `OpenTelemetry.Instrumentation.Http` 1.14.0
- `OpenTelemetry.Instrumentation.Runtime` 1.14.0
- `OpenTelemetry.Instrumentation.Process` 1.14.0-beta.2
- `OpenTelemetry.Exporter.OpenTelemetryProtocol` 1.14.0

**OTEL Verification Approach:** Build a verification script/tool that:
1. Queries each service's `/health/detailed` endpoint
2. Checks OTEL Collector health at `:13133/health`
3. Verifies traces in Jaeger at `:16686/api/services`
4. Validates metrics in Prometheus at `:9090/api/v1/targets`
5. Confirms log forwarding to Elasticsearch at `:9200/_cat/indices`

| Tool | Purpose | Already Available |
|------|---------|-------------------|
| HttpClient | Service health queries | Yes (.NET built-in) |
| Jaeger API | Trace verification | Yes (REST API) |
| Prometheus API | Metric target verification | Yes (REST API) |
| Elasticsearch API | Log verification | Yes (REST API) |

**Confidence:** HIGH - Based on existing infrastructure review.

---

### 4. File-Simulator API Client Integration (DemoDataGenerator)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| `FileSimulator.Client` (project reference) | 2.0.0 | File upload to simulator protocols | Already built, reference directly |

**Current DemoDataGenerator.csproj dependencies:**
- `MongoDB.Entities`
- `Newtonsoft.Json`
- Project reference to `DataProcessing.Shared`

**Recommended Addition:**
```xml
<!-- Reference file-simulator client directly or copy source -->
<ItemGroup>
  <!-- Option A: Copy FileSimulatorClient.cs and FileSimulatorOptions.cs -->
  <!-- Option B: NuGet package if published -->
  <!-- Option C: Project reference if monorepo setup -->
</ItemGroup>
```

**Required packages already in file-simulator client:**
- `FluentFTP` (already in EZ: 49.0.2)
- `SSH.NET` (already in EZ: 2025.1.0)
- `AWSSDK.S3` (already in EZ: 3.7.411.7)
- `SMBLibrary` (already in EZ: 1.5.5.1)

**Integration Pattern:**
```csharp
// DemoDataGenerator with file-simulator integration
var simulatorClient = new FileSimulatorClient(FileSimulatorOptions.ForMinikube("192.168.49.2"));
await simulatorClient.UploadViaFtpAsync(localCsvPath, "/incoming/demo-data.csv");
await simulatorClient.UploadViaS3Async(localCsvPath, "demo-bucket", "incoming/demo-data.csv");
```

**Confidence:** HIGH - Direct code review of file-simulator-suite.

---

### 5. Device Health Monitoring (Protocol Latency)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| `AspNetCore.HealthChecks.Network` | 9.0.0 | TCP/SFTP/FTP connectivity health | Proven library for network health checks |
| `AspNetCore.HealthChecks.Uris` | 9.0.0 | HTTP/S3 endpoint health | For HTTP-based protocol health |

**Note:** Version 9.0.0 targets .NET 8.0 and .NET Standard 2.0, which is compatible with .NET 10.0.

**Existing in Directory.Packages.props:**
- `Microsoft.Extensions.Diagnostics.HealthChecks` 10.0.0
- `AspNetCore.HealthChecks.MongoDb` 9.0.0
- `AspNetCore.HealthChecks.Kafka` 9.0.0
- `AspNetCore.HealthChecks.Elasticsearch` 9.0.0

**Required Additions:**
```xml
<!-- Add to Directory.Packages.props -->
<PackageVersion Include="AspNetCore.HealthChecks.Network" Version="9.0.0" />
<PackageVersion Include="AspNetCore.HealthChecks.Uris" Version="9.0.0" />
```

**Available Health Check Methods:**
- `AddTcpHealthCheck()` - TCP port connectivity with latency
- `AddPingHealthCheck()` - ICMP ping with latency
- `AddSftpHealthCheck()` - SFTP connectivity
- `AddFtpHealthCheck()` - FTP connectivity
- `AddDnsResolveHealthCheck()` - DNS resolution
- `AddUrlGroup()` - HTTP/HTTPS endpoint health

**Implementation Pattern (from file-simulator client):**
```csharp
builder.Services.AddHealthChecks()
    .AddTcpHealthCheck(setup => setup.AddHost("ftp-server", 21), name: "ftp-tcp")
    .AddTcpHealthCheck(setup => setup.AddHost("sftp-server", 22), name: "sftp-tcp")
    .AddSftpHealthCheck(setup => setup.AddHost("sftp-server", 22, "user", "pass"), name: "sftp-auth")
    .AddUrlGroup(new Uri("http://s3-server:9000/minio/health/live"), name: "s3-health");
```

**Confidence:** HIGH - Verified with NuGet and Xabaril GitHub repository.

---

### 6. Archive Extraction (Already Complete)

**Finding:** Archive extraction is ALREADY IMPLEMENTED. No additional packages needed.

**Existing Implementation:**
- `SharpCompress` 0.38.0 (in Directory.Packages.props)
- `SharpCompressArchiveService.cs` in `DataProcessing.Shared/Services/`
- Supports: ZIP, TAR, TAR.GZ, RAR, 7Z, BZip2

**Security Features Already Implemented:**
- Max archive size limits
- Max entries per archive
- Max uncompressed size
- Max compression ratio (zip bomb protection)
- Path traversal detection
- Encrypted archive handling

**Confidence:** HIGH - Direct code review.

---

## Package Version Summary

### New Packages to Add

```xml
<!-- Add to Directory.Packages.props -->
<PackageVersion Include="AspNetCore.HealthChecks.Network" Version="9.0.0" />
<PackageVersion Include="AspNetCore.HealthChecks.Uris" Version="9.0.0" />
```

### Frontend Package Updates

```json
{
  "@microsoft/signalr": "^10.0.0"
}
```

### Packages NOT Needed (Already Present)

| Capability | Existing Package | Version |
|------------|------------------|---------|
| SignalR Backend | Built into ASP.NET Core | 10.0.0 |
| SignalR Frontend | @microsoft/signalr | 7.0.11 (upgrade to 10.0.0) |
| OpenTelemetry | OpenTelemetry.* | 1.14.0 |
| Archive Extraction | SharpCompress | 0.38.0 |
| FTP Client | FluentFTP | 49.0.2 |
| SFTP Client | SSH.NET | 2025.1.0 |
| S3 Client | AWSSDK.S3 | 3.7.411.7 |
| SMB Client | SMBLibrary | 1.5.5.1 |
| Resilience | Polly | 8.5.2 |
| Health Checks Base | Microsoft.Extensions.Diagnostics.HealthChecks | 10.0.0 |

---

## What NOT to Add

| Technology | Reason |
|------------|--------|
| Socket.IO | SignalR is the .NET standard for WebSocket communication |
| WebSocketSharp | SignalR handles WebSocket abstraction |
| Prometheus exporter libraries | Already using prometheus-net 8.2.1 |
| Custom archive libraries | SharpCompress 0.38.0 covers all formats |
| Third-party OTEL backends | Using existing Jaeger/Prometheus/Elasticsearch |
| Redis for SignalR backplane | Not needed for single-instance deployment (add later for HA) |
| Custom useSignalR package | Copy the proven hook from file-simulator-suite |

---

## Installation Commands

### Backend (Directory.Packages.props)
```bash
# No dotnet add needed - add to Directory.Packages.props manually
# Then reference in individual .csproj files:
# <PackageReference Include="AspNetCore.HealthChecks.Network" />
# <PackageReference Include="AspNetCore.HealthChecks.Uris" />
```

### Frontend
```bash
cd src/Frontend
npm install @microsoft/signalr@10.0.0
```

### File-Simulator Client Integration
```bash
# Option 1: Copy source files from file-simulator-suite
# Copy: FileSimulatorClient.cs, FileSimulatorOptions.cs, FileProtocolServices.cs
# To: tools/DemoDataGenerator/Services/ or src/Services/Shared/FileSimulator/

# Option 2: If file-simulator-suite publishes NuGet package
# dotnet add tools/DemoDataGenerator/DemoDataGenerator.csproj package FileSimulator.Client
```

---

## Version Compatibility Matrix

| Component | Current | Target | Compatible |
|-----------|---------|--------|------------|
| .NET Runtime | 10.0 | 10.0 | Yes |
| ASP.NET Core SignalR | Built-in | Built-in | Yes |
| @microsoft/signalr | 7.0.11 | 10.0.0 | Yes (upgrade) |
| AspNetCore.HealthChecks.Network | N/A | 9.0.0 | Yes (.NET Standard 2.0) |
| AspNetCore.HealthChecks.Uris | N/A | 9.0.0 | Yes (.NET Standard 2.0) |
| OpenTelemetry | 1.14.0 | 1.14.0 | Yes (no change) |
| SharpCompress | 0.38.0 | 0.38.0 | Yes (no change) |
| React | 19.0.0 | 19.0.0 | Yes (no change) |
| TypeScript | 5.9.3 | 5.9.3 | Yes (no change) |

---

## Integration Points with Existing Stack

### SignalR + OTEL Integration
SignalR connections can be traced via existing OTEL HTTP instrumentation. No additional configuration needed.

### Health Checks + Prometheus
Health check results can be exposed as Prometheus metrics via existing prometheus-net integration.

### File-Simulator + Hazelcast
File content from simulator can be cached in existing Hazelcast cluster using same patterns as FileProcessor service.

### Archive Extraction + File Discovery
SharpCompressArchiveService already registered in FileDiscoveryService and FileProcessorService Program.cs.

---

## Sources

- [ASP.NET Core SignalR Overview](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction?view=aspnetcore-10.0) - Official Microsoft documentation
- [Microsoft.AspNetCore.SignalR.Client NuGet](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Client) - Version 10.0.3
- [@microsoft/signalr npm](https://www.npmjs.com/package/@microsoft/signalr) - Version 10.0.0
- [AspNetCore.HealthChecks.Network NuGet](https://www.nuget.org/packages/AspNetCore.HealthChecks.Network) - Version 9.0.0
- [Xabaril/AspNetCore.Diagnostics.HealthChecks GitHub](https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks) - Network health check methods
- [OpenTelemetry .NET](https://opentelemetry.io/docs/languages/dotnet/) - Official documentation
- file-simulator-suite source code (local) - SignalR hub and useSignalR hook patterns

# Architecture Patterns: v0.2.0 Feature Integration

**Domain:** EZ Platform - Production Validation & Release Features
**Researched:** 2026-02-11
**Overall Confidence:** HIGH (based on existing codebase analysis + official documentation)

## Executive Summary

This document analyzes how five new v0.2.0 features integrate with the existing 9-microservice architecture:

1. **SignalR Real-Time Monitoring Hub** - New component hosted by DataSourceManagementService
2. **OTEL Verification** - Audit tooling for existing instrumentation
3. **Device Health Monitoring** - Periodic health checks via SchedulingService
4. **File-Simulator API Client** - Integration point in DemoDataGenerator
5. **Archive Extraction** - Already integrated in FileDiscoveryService/FileProcessorService

## System Overview

### Current Architecture

```
                                    ┌─────────────────────────┐
                                    │   React 19 Frontend     │
                                    │      (Port 7000)        │
                                    └───────────┬─────────────┘
                                                │
                            ┌───────────────────┼───────────────────┐
                            │                   │                   │
                    ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
                    │ DataSource    │   │ Metrics       │   │ Validation    │
                    │ Management    │   │ Configuration │   │ Service       │
                    │ (5001)        │   │ (5002)        │   │ (5003)        │
                    └───────┬───────┘   └───────────────┘   └───────┬───────┘
                            │                                       │
                            │           ┌───────────────┐           │
                            │           │ Scheduling    │           │
                            │           │ (5004)        │           │
                            │           └───────┬───────┘           │
                            │                   │                   │
        ┌───────────────────┼───────────────────┼───────────────────┼───────────────────┐
        │                   │                   │                   │                   │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│ FileDiscovery │   │ FileProcessor │   │ Output        │   │ InvalidRecords│   │ DataSource    │
│               │   │ (5008)        │   │ (5009)        │   │ (5007)        │   │ Chat          │
└───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼───────┐
                    │   RabbitMQ    │
                    │  (MassTransit)│
                    └───────────────┘
```

### Data Flow (Existing Pipeline)

```
SchedulingService          FileDiscoveryService        FileProcessorService        ValidationService           OutputService
      │                           │                           │                           │                           │
      │ FilePollingEvent          │                           │                           │                           │
      ├──────────────────────────>│                           │                           │                           │
      │                           │                           │                           │                           │
      │                           │ FileDiscoveredEvent       │                           │                           │
      │                           ├──────────────────────────>│                           │                           │
      │                           │                           │                           │                           │
      │                           │                           │ ValidationRequestEvent    │                           │
      │                           │                           ├──────────────────────────>│                           │
      │                           │                           │                           │                           │
      │                           │                           │                           │ ValidationCompletedEvent  │
      │                           │                           │                           ├──────────────────────────>│
      │                           │                           │                           │                           │
```

## Component Responsibilities

### Existing Services

| Service | Port | Responsibility | Key Dependencies |
|---------|------|----------------|------------------|
| DataSourceManagementService | 5001 | CRUD for datasources, servers, NAS devices, categories, schemas | MongoDB, MassTransit |
| MetricsConfigurationService | 5002 | Business metrics configuration, PromQL, alerts | MongoDB, Prometheus |
| ValidationService | 5003 | JSON Schema validation, record validation | MongoDB, Hazelcast |
| SchedulingService | 5004 | Quartz.NET job scheduling, file polling triggers | MongoDB, MassTransit |
| InvalidRecordsService | 5007 | Invalid record storage and management | MongoDB |
| FileProcessorService | 5008 | File reading, format conversion, archive extraction | Connectors, Hazelcast |
| OutputService | 5009 | Multi-destination output (file, Kafka, API) | Connectors, MassTransit |
| FileDiscoveryService | - | File discovery, deduplication, archive listing | Connectors, Hazelcast |
| DataSourceChatService | - | AI assistant (optional) | External LLM API |

### Shared Library Components

| Component | Purpose |
|-----------|---------|
| Configuration/ | DI setup: DatabaseConfiguration, MassTransitConfiguration, OpenTelemetryConfiguration, LoggingConfiguration |
| Connectors/ | IDataSourceConnector implementations: Local, FTP, SFTP, SMB, NFS, S3, HTTP, Kafka |
| Converters/ | IFormatConverter implementations: CSV, JSON, XML, Excel |
| Services/ | IArchiveService (SharpCompress), IArchiveCacheService (Hazelcast), ICredentialResolver (K8s Secrets) |
| Monitoring/ | BusinessMetrics (26 metrics), DataProcessingMetrics (deprecated) |
| Messages/ | Event contracts: FilePollingEvent, FileDiscoveredEvent, ValidationRequestEvent, etc. |

## New Feature Integration Architecture

### 1. SignalR Real-Time Monitoring Hub

**Decision:** Host SignalR hub in DataSourceManagementService

**Rationale:**
- DataSourceManagementService is the "gateway" service (primary API, port 5001)
- Already has CORS configured for frontend access
- Already handles MassTransit message bus (can subscribe to events from other services)
- Frontend already connects to this service for all management operations

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DataSourceManagementService                          │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │   Controllers/   │    │   Services/      │    │   Hubs/          │       │
│  │   (REST API)     │    │   (Business)     │    │   MonitoringHub  │       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘       │
│           │                       │                       │                  │
│           │                       │              SignalR WebSocket           │
│           │                       │                       │                  │
└───────────┼───────────────────────┼───────────────────────┼──────────────────┘
            │                       │                       │
            │                       │                       │
    ┌───────▼───────────────────────▼───────────────────────▼───────┐
    │                        Frontend (React 19)                     │
    │                                                                │
    │  ┌────────────────┐    ┌────────────────┐    ┌────────────┐   │
    │  │ REST API       │    │ useMonitoring  │    │ SignalR    │   │
    │  │ Clients        │    │ Hook           │    │ Client     │   │
    │  └────────────────┘    └────────────────┘    └────────────┘   │
    └────────────────────────────────────────────────────────────────┘
```

**New Components:**

| Location | Component | Purpose |
|----------|-----------|---------|
| DataSourceManagementService/Hubs/ | MonitoringHub.cs | SignalR hub for real-time events |
| DataSourceManagementService/Consumers/ | ProcessingEventConsumer.cs | Subscribes to pipeline events, pushes to hub |
| Frontend/src/hooks/ | useMonitoring.ts | React hook for SignalR connection |
| Frontend/src/services/ | signalr-client.ts | SignalR client configuration |

**Hub Interface:**

```csharp
public interface IMonitoringClient
{
    Task ReceiveFileDiscovered(FileDiscoveredNotification notification);
    Task ReceiveProcessingStatus(ProcessingStatusNotification notification);
    Task ReceiveValidationResult(ValidationResultNotification notification);
    Task ReceiveDeviceHealth(DeviceHealthNotification notification);
    Task ReceiveServerHealth(ServerHealthNotification notification);
}

public class MonitoringHub : Hub<IMonitoringClient>
{
    // Strongly-typed hub for compile-time safety
}
```

**Integration with MassTransit:**

```csharp
public class ProcessingEventConsumer :
    IConsumer<FileDiscoveredEvent>,
    IConsumer<ValidationCompletedEvent>
{
    private readonly IHubContext<MonitoringHub, IMonitoringClient> _hubContext;

    public async Task Consume(ConsumeContext<FileDiscoveredEvent> context)
    {
        await _hubContext.Clients.All.ReceiveFileDiscovered(
            new FileDiscoveredNotification(context.Message));
    }
}
```

**Frontend Connection:**

```typescript
// signalr-client.ts
import * as signalR from '@microsoft/signalr';

export const createMonitoringConnection = () => {
    return new signalR.HubConnectionBuilder()
        .withUrl('/api/monitoring')  // Proxied through ingress to port 5001
        .withAutomaticReconnect()
        .build();
};
```

---

### 2. OTEL Verification Audit

**Decision:** Create verification tooling in tools/ directory, not a runtime service

**Rationale:**
- OTEL verification is a development/CI concern, not runtime
- Existing OpenTelemetryConfiguration.cs already instruments all services
- Need to audit that each service actually calls the configuration
- Need to verify traces appear in Jaeger and metrics in Prometheus

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           tools/OtelVerifier/                                │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │ Program.cs       │    │ ServiceChecker   │    │ ReportGenerator  │       │
│  │ (Entry point)    │    │ (Per service)    │    │ (Markdown/JSON)  │       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘       │
│           │                       │                       │                  │
└───────────┼───────────────────────┼───────────────────────┼──────────────────┘
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │ Source Code   │       │ Jaeger API    │       │ Prometheus    │
    │ Analysis      │       │ (Traces)      │       │ (Metrics)     │
    └───────────────┘       └───────────────┘       └───────────────┘
```

**Verification Checklist:**

| Check | Method | Expected |
|-------|--------|----------|
| OTEL DI registered | Parse Program.cs for `AddDataProcessingOpenTelemetry` | All 9 services |
| BusinessMetrics registered | Parse Program.cs for `AddBusinessMetrics` | All 9 services |
| ActivitySource created | Parse Program.cs for `new ActivitySource` | All 9 services |
| Traces in Jaeger | Query Jaeger API for service.name | All 9 services have traces |
| Metrics in Prometheus | Query Prometheus for business_* | Metrics present |
| Correlation IDs propagated | Check trace spans for correlation-id tag | Present in all spans |

**New Components:**

| Location | Component | Purpose |
|----------|-----------|---------|
| tools/OtelVerifier/ | Program.cs | CLI tool entry point |
| tools/OtelVerifier/ | ServiceAnalyzer.cs | Source code analysis |
| tools/OtelVerifier/ | JaegerClient.cs | Query Jaeger API for traces |
| tools/OtelVerifier/ | PrometheusClient.cs | Query Prometheus for metrics |
| tools/OtelVerifier/ | ReportGenerator.cs | Generate verification report |

**CLI Usage:**

```bash
cd tools/OtelVerifier
dotnet run -- --output report.md --format markdown
dotnet run -- --check-live --jaeger http://localhost:16686 --prometheus http://localhost:9090
```

---

### 3. Device Health Monitoring

**Decision:** Run periodic health checks via SchedulingService with Quartz.NET jobs

**Rationale:**
- SchedulingService already manages scheduled jobs (Quartz.NET)
- Health checks involve connector calls (FTP, SFTP, NFS, S3, etc.)
- Results should be stored in MongoDB and broadcast via SignalR
- Follows existing pattern: scheduled job -> consumer -> database update

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SchedulingService                                  │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                               │
│  │ DeviceHealthJob  │───>│ DeviceHealthEvent│                               │
│  │ (Quartz.NET)     │    │ (to MassTransit) │                               │
│  └──────────────────┘    └────────┬─────────┘                               │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │ MassTransit
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DataSourceManagementService                              │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │ DeviceHealth     │───>│ Update MongoDB   │───>│ Push to          │       │
│  │ EventConsumer    │    │ (AdminServer,    │    │ MonitoringHub    │       │
│  │                  │    │  NasDevice)      │    │                  │       │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**New Components:**

| Location | Component | Purpose |
|----------|-----------|---------|
| SchedulingService/Jobs/ | DeviceHealthCheckJob.cs | Quartz.NET job that checks all devices |
| Shared/Messages/ | DeviceHealthCheckEvent.cs | Message contract for health check results |
| DataSourceManagementService/Consumers/ | DeviceHealthEventConsumer.cs | Updates MongoDB, pushes to SignalR |

**Health Check Flow:**

1. Quartz.NET triggers DeviceHealthCheckJob every N minutes (configurable)
2. Job iterates through all active AdminServers and NasDevices
3. For each device, uses IConnectorFactory to get appropriate connector
4. Calls `TestConnectionAsync` on connector
5. Publishes DeviceHealthCheckEvent with results
6. DataSourceManagementService consumer updates entity and broadcasts to clients

**New Message Contract:**

```csharp
public class DeviceHealthCheckEvent : IDataProcessingMessage
{
    public Guid CorrelationId { get; init; }
    public DateTime Timestamp { get; init; }
    public string PublishedBy { get; init; } = "SchedulingService";
    public int MessageVersion { get; init; } = 1;

    public string DeviceId { get; init; } = string.Empty;
    public string DeviceType { get; init; } = string.Empty; // "AdminServer" or "NasDevice"
    public string DeviceName { get; init; } = string.Empty;
    public bool IsHealthy { get; init; }
    public string? ErrorMessage { get; init; }
    public TimeSpan CheckDuration { get; init; }
}
```

---

### 4. File-Simulator API Client

**Decision:** Add HTTP client to DemoDataGenerator for file-simulator API

**Rationale:**
- DemoDataGenerator already references `file-simulator.local` hostname
- Need actual API calls to trigger file generation vs. hardcoded DNS
- File-simulator runs as separate container with REST API
- Keeps DemoDataGenerator as single entry point for demo setup

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        tools/DemoDataGenerator/                              │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │ Program.cs       │───>│ DatabaseReset    │    │ FileSimulator    │       │
│  │ (Orchestrator)   │    │ Service          │    │ Client           │       │
│  └────────┬─────────┘    └──────────────────┘    └────────┬─────────┘       │
│           │                                               │                  │
│           │                                               │ HTTP             │
│           │                                               │                  │
└───────────┼───────────────────────────────────────────────┼──────────────────┘
            │                                               │
            ▼                                               ▼
    ┌───────────────┐                               ┌───────────────┐
    │ MongoDB       │                               │ file-simulator│
    │ (Demo Data)   │                               │ (Generate     │
    │               │                               │  test files)  │
    └───────────────┘                               └───────────────┘
```

**New Components:**

| Location | Component | Purpose |
|----------|-----------|---------|
| tools/DemoDataGenerator/Clients/ | FileSimulatorClient.cs | HTTP client for file-simulator API |
| tools/DemoDataGenerator/Models/ | FileSimulatorRequests.cs | Request/response DTOs |

**FileSimulator Client Interface:**

```csharp
public interface IFileSimulatorClient
{
    Task<bool> PingAsync();
    Task<GenerateFilesResponse> GenerateFilesAsync(GenerateFilesRequest request);
    Task<ServerStatus> GetServerStatusAsync(string serverId);
}

public class GenerateFilesRequest
{
    public string ServerId { get; init; } = string.Empty;
    public string FilePattern { get; init; } = "*.csv";
    public int FileCount { get; init; } = 5;
    public int RecordsPerFile { get; init; } = 100;
    public string SchemaId { get; init; } = string.Empty;
}
```

**Integration in DemoDataGenerator:**

```csharp
// Program.cs - After generating servers and datasources
var fileSimulatorClient = new FileSimulatorClient(fileSimulatorHost);

if (await fileSimulatorClient.PingAsync())
{
    Console.WriteLine("File-simulator connected, generating test files...");

    foreach (var datasource in datasources.Take(3)) // First 3 datasources
    {
        await fileSimulatorClient.GenerateFilesAsync(new GenerateFilesRequest
        {
            ServerId = datasource.FileServerId,
            FilePattern = datasource.FilePattern,
            FileCount = 5,
            RecordsPerFile = 50
        });
    }
}
```

---

### 5. Archive Extraction (Already Integrated)

**Status:** COMPLETE in current codebase

**Integration Points (Verified):**

| Service | Component | Archive Support |
|---------|-----------|-----------------|
| FileDiscoveryService | FilePollingEventConsumer | Detects archives, lists contents, caches in Hazelcast |
| FileProcessorService | FileDiscoveredEventConsumer | Extracts files from cached archives |
| Shared | IArchiveService | SharpCompressArchiveService supports ZIP, TAR.GZ, RAR, 7Z |
| Shared | IArchiveCacheService | HazelcastArchiveCacheService with size-tiered caching |

**Existing Flow:**

1. FileDiscoveryService detects archive via `IArchiveService.IsArchive()`
2. Downloads archive content via connector
3. Lists archive entries via `IArchiveService.ListContentsAsync()`
4. Caches archive in Hazelcast via `IArchiveCacheService`
5. Publishes FileDiscoveredEvent with `IsFromArchive=true`, `PathInArchive`, `ArchiveCacheKey`
6. FileProcessorService receives event
7. Retrieves archive from cache or re-downloads
8. Extracts specific file via `IArchiveService.ExtractFileAsync()`
9. Continues normal processing pipeline

**No new components needed** - verify existing implementation during production validation.

---

## Architectural Patterns to Follow

### Pattern 1: Consumer-to-Hub Broadcast

**What:** MassTransit consumer receives event, updates database, pushes to SignalR
**When:** Any event that clients should see in real-time
**Example:**

```csharp
public class FileDiscoveredEventConsumer : IConsumer<FileDiscoveredEvent>
{
    private readonly IHubContext<MonitoringHub, IMonitoringClient> _hubContext;

    public async Task Consume(ConsumeContext<FileDiscoveredEvent> context)
    {
        // 1. Process event (existing logic)

        // 2. Broadcast to connected clients
        await _hubContext.Clients.All.ReceiveFileDiscovered(
            new FileDiscoveredNotification
            {
                FileName = context.Message.FileName,
                DataSourceId = context.Message.DataSourceId,
                Timestamp = DateTime.UtcNow
            });
    }
}
```

### Pattern 2: Scheduled Health Check

**What:** Quartz.NET job checks device health, publishes event, consumer updates UI
**When:** Periodic device/server connectivity monitoring
**Example:**

```csharp
[DisallowConcurrentExecution]
public class DeviceHealthCheckJob : IJob
{
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IConnectorFactory _connectorFactory;

    public async Task Execute(IJobExecutionContext context)
    {
        var servers = await DB.Find<AdminServer>()
            .Match(s => s.IsActive && !s.IsDeleted)
            .ExecuteAsync();

        foreach (var server in servers)
        {
            var connector = _connectorFactory.GetConnector(server.ServerType);
            var result = await connector.TestConnectionAsync(/* ... */);

            await _publishEndpoint.Publish(new DeviceHealthCheckEvent
            {
                DeviceId = server.ID,
                DeviceType = "AdminServer",
                DeviceName = server.Name,
                IsHealthy = result,
                CheckDuration = stopwatch.Elapsed
            });
        }
    }
}
```

### Pattern 3: Strongly-Typed SignalR Hub

**What:** Use `Hub<T>` for compile-time safety on client methods
**When:** Always for SignalR hubs
**Example:**

```csharp
public interface IMonitoringClient
{
    Task ReceiveFileDiscovered(FileDiscoveredNotification notification);
    Task ReceiveProcessingStatus(ProcessingStatusNotification notification);
}

public class MonitoringHub : Hub<IMonitoringClient>
{
    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: SignalR in Multiple Services

**What:** Hosting SignalR hubs in multiple microservices
**Why Bad:**
- Requires Redis backplane for state synchronization
- Clients need to connect to multiple endpoints
- Complex authentication/authorization across services
**Instead:** Single SignalR hub in DataSourceManagementService, other services publish events via MassTransit

### Anti-Pattern 2: Direct Database Polling for Real-Time

**What:** Frontend polling database via REST API for real-time updates
**Why Bad:**
- High load on database and API
- Latency (polling interval)
- Wasted bandwidth when no changes
**Instead:** Use SignalR push notifications for real-time data

### Anti-Pattern 3: Health Checks in API Controllers

**What:** Exposing health check endpoints that call connectors synchronously
**Why Bad:**
- Blocks API threads during connection tests
- Timeouts can cascade to frontend
- No aggregated view across devices
**Instead:** Scheduled background jobs with async event publishing

---

## Data Flow Changes

### New SignalR Data Flow

```
Service Events                   MonitoringHub                    Frontend
     │                               │                               │
     │ FileDiscoveredEvent           │                               │
     ├──────────────────────────────>│                               │
     │                               │ ReceiveFileDiscovered         │
     │                               ├──────────────────────────────>│
     │                               │                               │
     │ DeviceHealthCheckEvent        │                               │
     ├──────────────────────────────>│                               │
     │                               │ ReceiveDeviceHealth           │
     │                               ├──────────────────────────────>│
     │                               │                               │
```

### Health Check Data Flow

```
SchedulingService        MassTransit        DataSourceMgmt        MongoDB        SignalR
     │                       │                   │                   │              │
     │ DeviceHealthJob       │                   │                   │              │
     ├─────────────────────>│                   │                   │              │
     │                       │ HealthEvent       │                   │              │
     │                       ├──────────────────>│                   │              │
     │                       │                   │ Update Entity     │              │
     │                       │                   ├──────────────────>│              │
     │                       │                   │                   │              │
     │                       │                   │ Broadcast         │              │
     │                       │                   ├──────────────────────────────────>│
     │                       │                   │                   │              │
```

---

## Integration Points Summary

### Services Modified

| Service | Change | Files Affected |
|---------|--------|----------------|
| DataSourceManagementService | Add SignalR hub, add event consumers | Program.cs, Hubs/MonitoringHub.cs, Consumers/ |
| SchedulingService | Add DeviceHealthCheckJob | Program.cs, Jobs/DeviceHealthCheckJob.cs |
| Shared | Add DeviceHealthCheckEvent message | Messages/DeviceHealthCheckEvent.cs |

### New Components

| Location | Component | Depends On |
|----------|-----------|------------|
| DataSourceManagementService/Hubs/ | MonitoringHub.cs | Microsoft.AspNetCore.SignalR |
| DataSourceManagementService/Consumers/ | ProcessingEventConsumer.cs | MassTransit, SignalR |
| DataSourceManagementService/Consumers/ | DeviceHealthEventConsumer.cs | MassTransit, SignalR |
| SchedulingService/Jobs/ | DeviceHealthCheckJob.cs | Quartz.NET, Connectors |
| tools/OtelVerifier/ | Full project | .NET 10, HttpClient |
| tools/DemoDataGenerator/Clients/ | FileSimulatorClient.cs | HttpClient |
| Frontend/src/hooks/ | useMonitoring.ts | @microsoft/signalr |
| Frontend/src/services/ | signalr-client.ts | @microsoft/signalr |

### Existing Components Unchanged

- FileDiscoveryService (archive support already complete)
- FileProcessorService (archive extraction already complete)
- ValidationService (no changes)
- OutputService (no changes)
- InvalidRecordsService (no changes)
- MetricsConfigurationService (no changes)
- DataSourceChatService (no changes)

---

## Build Order Recommendation

Based on dependencies, build in this order:

**Phase 1: Foundation (No Dependencies)**
1. OTEL Verifier tool (standalone)
2. FileSimulator API client (standalone)

**Phase 2: Backend Infrastructure**
3. DeviceHealthCheckEvent message (Shared library)
4. DeviceHealthCheckJob (SchedulingService)

**Phase 3: SignalR Hub**
5. MonitoringHub (DataSourceManagementService)
6. ProcessingEventConsumer (DataSourceManagementService)
7. DeviceHealthEventConsumer (DataSourceManagementService)

**Phase 4: Frontend Integration**
8. SignalR client (Frontend)
9. useMonitoring hook (Frontend)
10. Real-time monitoring components (Frontend)

**Phase 5: Validation**
11. Run OTEL verification
12. E2E tests for real-time features
13. Production validation script updates

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| SignalR connections | Single instance OK | Consider Redis backplane | Azure SignalR Service |
| Health check frequency | Every 5 minutes | Every 15 minutes | Distributed checks |
| Event broadcast | All clients | Group-based filtering | Sharded by tenant |

**For v0.2.0 (100s of users):** Single SignalR hub without backplane is sufficient.

---

## Sources

- [SignalR ASP.NET Core Guide 2025](https://www.asptoday.com/p/signalr-and-aspnet-core-building) - Hub architecture patterns
- [Microsoft SignalR Overview](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction?view=aspnetcore-10.0) - Official documentation
- [Building Microservices with SignalR and RabbitMQ](https://www.altkomsoftware.com/blog/building-microservices-6/) - Integration patterns
- [OpenTelemetry Weaver](https://opentelemetry.io/blog/2025/otel-weaver/) - Instrumentation verification
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/) - Current spec
- Existing codebase: `src/Services/Shared/Configuration/OpenTelemetryConfiguration.cs`
- Existing codebase: `src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs`
- Existing codebase: `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs`

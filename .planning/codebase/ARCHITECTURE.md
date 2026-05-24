<!-- refreshed: 2026-05-24 -->
# Architecture

**Analysis Date:** 2026-05-24

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         React Frontend (port 7000)                            │
│                       `src/Frontend/src/App.tsx`                              │
│  Pages → Components → Services (fetch) → React Query → SignalR (EntitySync)   │
└──────────┬──────────────────────────────────────────────────────┬─────────────┘
           │ REST /api/v1/*                                       │ SignalR /hubs/monitoring
           ▼                                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       9 .NET 10 Microservices (ASP.NET Core)                  │
│  ┌──────────────────────┬──────────────────────┬──────────────────────────┐  │
│  │ DataSourceMgmt :5001 │ MetricsConfig :5002  │ Validation :5003         │  │
│  │ + MonitoringHub      │ + AlertEvaluation    │ + Corvus.Json Validator  │  │
│  │ `…/Hubs/Monitoring…` │ `…/Services/Alerts/` │ `…/Services/Validation…` │  │
│  ├──────────────────────┼──────────────────────┼──────────────────────────┤  │
│  │ Scheduling :5004     │ InvalidRecords :5007 │ FileProcessor :5008      │  │
│  │ + Quartz.NET Jobs    │ + Hub + TTL Purge    │ + Format converters      │  │
│  │ `…/Jobs/DataSource…` │ `…/Hubs/InvalidRec…` │ `…/Consumers/FileDisc…`  │  │
│  ├──────────────────────┼──────────────────────┼──────────────────────────┤  │
│  │ Output :5009         │ FileDiscovery (job)  │ DataSourceChat (AI)      │  │
│  │ + 6 Output Handlers  │ + Quartz polling     │ Optional, lightweight    │  │
│  │ `…/Handlers/*`       │ `…/Workers/FileDis…` │ `…Services/Chat…`        │  │
│  └──────────────────────┴──────────────────────┴──────────────────────────┘  │
│                                  │                                            │
│  All services depend on `src/Services/Shared/` for:                           │
│    • Base entity `DataProcessingBaseEntity`                                   │
│    • Consumer base `DataProcessingConsumerBase<T>`                            │
│    • Message contracts (`IDataProcessingMessage` + 12 events)                 │
│    • Connectors (FTP/SFTP/S3/NFS/SMB/HTTP/Kafka/Local)                        │
│    • Format converters (CSV/JSON/XML/Excel)                                   │
│    • Configuration extensions (OTEL, MassTransit, Hazelcast, Logging)         │
└──────────┬──────────────────────────┬────────────────────┬──────────────────┘
           │ MassTransit              │ MongoDB.Entities   │ Hazelcast Client
           ▼                          ▼                    ▼
┌─────────────────────┐   ┌────────────────────┐   ┌────────────────────────┐
│  Kafka / RabbitMQ   │   │ MongoDB (3-node    │   │ Hazelcast (distributed │
│  Event bus          │   │ replica set)       │   │ in-memory cache)       │
│  Topics:            │   │ DB: `ezplatform`   │   │ Maps:                  │
│  dataprocessing.*   │   │ Collections per    │   │  • file-content        │
│                     │   │ shared entity      │   │  • valid-records       │
└─────────────────────┘   └────────────────────┘   └────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Observability:  OTEL Collector (4317/4318)                                    │
│   → Prometheus System (9090) + Prometheus Business (9091) + Grafana (3001)    │
│   → Elasticsearch (9200) + Jaeger (16686)                                     │
│   Implementation: `src/Services/Shared/Configuration/OpenTelemetryConfig…cs`  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| DataSourceManagementService | Primary CRUD API for datasources, categories, servers, NAS devices, schemas; hosts the global `MonitoringHub` SignalR endpoint and Kubernetes/Prometheus monitoring proxy | `src/Services/DataSourceManagementService/Program.cs` |
| MetricsConfigurationService | Business metric definition CRUD, alert rules, PromQL query proxy, periodic metric collection background service | `src/Services/MetricsConfigurationService/Program.cs` |
| ValidationService | JSON Schema validation via Corvus, reads file content from Hazelcast, calculates business metrics, publishes `ValidationCompletedEvent` | `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs` |
| SchedulingService | Quartz.NET cron-based polling of active datasources, publishes `FilePollingEvent`; reacts to datasource CRUD events to reload schedules | `src/Services/SchedulingService/Jobs/DataSourcePollingJob.cs` |
| FileDiscoveryService | Consumes `FilePollingEvent`, lists files via connectors (FTP/SFTP/S3/NFS/SMB/local), deduplicates by hash, publishes `FileDiscoveredEvent` | `src/Services/FileDiscoveryService/Workers/FileDiscoveryWorker.cs` |
| FileProcessorService | Consumes `FileDiscoveredEvent`, reads file via connector, converts format → JSON, caches in Hazelcast, publishes `ValidationRequestEvent` | `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs` |
| OutputService | Consumes `ValidationCompletedEvent`, reconstructs format, writes to 1-N destinations (folder/FTP/SFTP/S3/HTTP/Kafka) | `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs` |
| InvalidRecordsService | Stores invalid records, provides CRUD/correction/revalidation API, hosts `InvalidRecordsHub` for live notifications, TTL purge job | `src/Services/InvalidRecordsService/Program.cs` |
| DataSourceChatService | Optional AI assistant API for natural-language data source interaction | `src/Services/DataSourceChatService/Program.cs` |
| Shared library | Base classes, message contracts, connectors, converters, OTEL/MassTransit/Hazelcast configuration extensions | `src/Services/Shared/DataProcessing.Shared.csproj` |
| React Frontend | Hebrew/RTL-enabled UI for datasource management, monitoring, metrics, validation, invalid records | `src/Frontend/src/App.tsx` |

## Pattern Overview

**Overall:** Event-driven microservices with shared kernel library on a Kubernetes (`ez-platform` namespace) substrate.

**Key Characteristics:**
- Message-passing pipeline using MassTransit abstraction over Kafka (event bus) and RabbitMQ (CRUD broadcast and request/response)
- Each service follows the same internal layered structure: `Controllers/` → `Services/` → `Repositories/` (MongoDB.Entities) with `Consumers/` and `Jobs/` as alternate entry points
- A shared kernel (`src/Services/Shared/`) provides the contract between services — events, base entity, base consumer, connectors, converters, telemetry config
- SignalR is the second cross-cutting bus: `MonitoringHub` in DataSourceManagement broadcasts `EntityChanged` for every CRUD operation so all browsers stay in sync
- Two persistence tiers: MongoDB for durable state, Hazelcast for high-throughput file/record payload transfer between pipeline stages

## Layers

**Frontend (React SPA):**
- Purpose: Hebrew/RTL UI for the platform
- Location: `src/Frontend/src/`
- Contains: Pages (route components), components (reusable UI), services (API clients), hooks (data + SignalR), utils (schema/file analysis), i18n
- Depends on: Backend REST APIs over fetch, SignalR `/hubs/monitoring`
- Used by: End users via http://localhost:7000

**API / Hub layer (per service):**
- Purpose: HTTP/SignalR surface
- Location: `src/Services/*Service/Controllers/` and `src/Services/*Service/Hubs/`
- Contains: ASP.NET Core controllers under `[Route("api/v1/[controller]")]`, SignalR hubs (`MonitoringHub`, `InvalidRecordsHub`)
- Depends on: Service layer (DI scoped)
- Used by: Frontend, other services via REST, browsers via WebSocket

**Service / Domain layer:**
- Purpose: Business logic
- Location: `src/Services/*Service/Services/`
- Contains: `I*Service` interfaces and `*Service` implementations (e.g., `IDataSourceService` → `DataSourceService`)
- Depends on: Repository layer, Shared utilities, MassTransit `IPublishEndpoint`
- Used by: Controllers, Consumers, Jobs

**Repository layer:**
- Purpose: MongoDB persistence
- Location: `src/Services/*Service/Repositories/`
- Contains: `I*Repository` + `*Repository` over MongoDB.Entities `DB.Find/Save/Delete`
- Depends on: MongoDB.Entities (initialized in `Program.cs` via `DB.InitAsync(...)`)
- Used by: Service layer

**Message-handler layer:**
- Purpose: React to events from the bus
- Location: `src/Services/*Service/Consumers/`
- Contains: Either `IConsumer<TEvent>` (MassTransit) directly or subclasses of `DataProcessingConsumerBase<TEvent>` (Shared kernel) for built-in metrics + correlation handling
- Depends on: Service layer, Hazelcast, MongoDB
- Used by: MassTransit runtime

**Background-job layer:**
- Purpose: Scheduled work
- Location: `src/Services/*Service/Jobs/` and `src/Services/FileDiscoveryService/Workers/`
- Contains: Quartz.NET `IJob` implementations (`DataSourcePollingJob`, `DeviceHealthCheckJob`, `FileDiscoveryWorker`, `InvalidRecordsTtlPurgeJob`)
- Depends on: Service layer, `IPublishEndpoint`
- Used by: Quartz scheduler registered in `Program.cs`

**Shared kernel:**
- Purpose: Cross-service contracts and infrastructure
- Location: `src/Services/Shared/`
- Contains: `Entities/`, `Messages/`, `Consumers/`, `Connectors/`, `Converters/`, `Configuration/`, `Monitoring/`, `Services/`, `Extensions/`, `Middleware/`, `Utilities/`
- Depends on: External NuGet only (MongoDB.Entities, MassTransit, Hazelcast, OpenTelemetry, Corvus.Json, Quartz)
- Used by: Every microservice via project reference

## Data Flow

### Primary File-Processing Pipeline

```
SchedulingService(cron) → FilePollingEvent
   ↓ (Kafka topic: dataprocessing.scheduling.filepolling)
FileDiscoveryService → list files via Connector → FileDiscoveredEvent
   ↓ (RabbitMQ via MassTransit)
FileProcessorService → fetch bytes → convert (CSV/XML/Excel → JSON) →
   put payload in Hazelcast map `file-content` → ValidationRequestEvent
   ↓
ValidationService → load payload from Hazelcast → Corvus.Json schema validate →
   put valid records in Hazelcast `valid-records`, persist invalids to MongoDB →
   ValidationCompletedEvent
   ↓
OutputService → load valid records → reconstruct format → fan-out to all
   configured OutputConfiguration destinations (Folder/FTP/SFTP/S3/HTTP/Kafka)
```

1. Quartz fires `DataSourcePollingJob` (`src/Services/SchedulingService/Jobs/DataSourcePollingJob.cs:32`) → publishes `FilePollingEvent`
2. `FilePollingEventConsumer` (`src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs`) invokes the appropriate `IDataSourceConnector` from `ConnectorFactory` (`src/Services/Shared/Connectors/ConnectorFactory.cs`)
3. Discovered files are dedup-hashed via `IFileHashService` (`src/Services/Shared/Services/HazelcastFileHashService.cs`) and emitted as `FileDiscoveredEvent` (`src/Services/Shared/Messages/FileDiscoveredEvent.cs`)
4. `FileDiscoveredEventConsumer` (`src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs:53`) reads the file, runs `IFormatConverter` (`src/Services/Shared/Converters/`), stores JSON payload in Hazelcast, emits `ValidationRequestEvent`
5. `ValidationRequestEventConsumer` (`src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs`) validates each record with Corvus.Json, computes business metrics via `DataMetricsCalculator`, then emits `ValidationCompletedEvent`
6. `ValidationCompletedEventConsumer` (`src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs:50`) routes valid records to every configured `IOutputHandler` (`src/Services/OutputService/Handlers/`)

### CRUD / Real-Time Sync Flow

1. Browser issues `POST /api/v1/datasource` → `DataSourceController.Create` (`src/Services/DataSourceManagementService/Controllers/DataSourceController.cs`)
2. Controller persists via `IDataSourceService` → `IDataSourceRepository` → MongoDB
3. Controller broadcasts `EntityChanged` via `IHubContext<MonitoringHub>` on `/hubs/monitoring`
4. Controller publishes `DataSourceCreatedEvent` (`src/Services/Shared/Messages/DataSourceCreatedEvent.cs`) on the bus
5. `SchedulingService.Consumers.DataSourceCreatedConsumer` reloads Quartz triggers
6. All browsers receive `EntityChanged` on `useEntitySync` (`src/Frontend/src/hooks/useEntitySync.ts:26`) → React Query invalidates affected query keys → UI refreshes

### Monitoring Snapshot Flow

1. `MonitoringBroadcaster` hosted service (`src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs`) periodically polls Kubernetes (`KubernetesMonitoringService`), Prometheus (`PrometheusQueryService`), and RabbitMQ (`RabbitMqMonitoringService`)
2. State is broadcast to all `/hubs/monitoring` clients
3. New clients receive an `InitialState` snapshot on connect (`MonitoringHub.OnConnectedAsync` — `src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs:23`)
4. Frontend `useMonitoringHub` (`src/Frontend/src/hooks/useMonitoringHub.ts`) renders the live `SystemMonitoring` page

**State Management:**
- Server state: MongoDB (`ezplatform` DB) for durable records, soft-deleted via `DataProcessingBaseEntity.IsDeleted`
- Pipeline state: Hazelcast maps `file-content` (5 min TTL) and `valid-records` (5 min TTL) for inter-service payload transfer
- Optimistic concurrency: `DataProcessingBaseEntity.Version` (incremented by `MarkAsModified`)
- Frontend cache: React Query (`QueryClient` in `src/Frontend/src/App.tsx:54`, 5-minute stale time) invalidated by SignalR `EntityChanged`

## Key Abstractions

**`DataProcessingBaseEntity`:**
- Purpose: Base for every MongoDB-persisted entity; provides audit (`CreatedAt`/`UpdatedAt`/`CreatedBy`/`UpdatedBy`), soft delete (`IsDeleted`), correlation tracking (`CorrelationId`), and optimistic concurrency (`Version`)
- Location: `src/Services/Shared/Entities/DataProcessingBaseEntity.cs`
- Subclasses: `DataProcessingDataSource`, `DataProcessingSchema`, `DataProcessingInvalidRecord`, `DataProcessingValidationResult`, `AdminServer`, `NasDevice`, `DataSourceCategory`, `OutputConfiguration`, `ProcessedFileHash`, `ScheduledDataSource`, `DeviceHealthCheckResult`
- Pattern: All inherit from MongoDB.Entities `Entity`; call `MarkAsModified()` before save

**`IDataProcessingMessage`:**
- Purpose: Contract every event on the bus must satisfy — correlation ID, UTC timestamp, source service name, schema version
- Location: `src/Services/Shared/Messages/IDataProcessingMessage.cs`
- Implementations: `FilePollingEvent`, `FileDiscoveredEvent`, `ValidationRequestEvent`, `ValidationCompletedEvent`, `FileProcessingCompletedEvent`, `FileProcessingFailedEvent`, `DataSourceCreatedEvent`, `DataSourceUpdatedEvent`, `DataSourceDeletedEvent`, `SchemaUpdatedEvent`, plus request/response pair `GetMetricsConfigurationRequest`/`GetMetricsConfigurationResponse`

**`DataProcessingConsumerBase<T>`:**
- Purpose: Base for all MassTransit consumers; wraps `Consume` with OpenTelemetry activity, structured logging, `messages_processed_total` / `messages_errored_total` counters, processing-duration histogram, message-age validation, and retry-classification (`ShouldRetryOnError`)
- Location: `src/Services/Shared/Consumers/DataProcessingConsumerBase.cs`
- Subclass contract: implement `protected abstract Task ProcessMessage(ConsumeContext<T> context)`
- Example: `ValidationRequestEventConsumer : DataProcessingConsumerBase<ValidationRequestEvent>` (`src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs:23`)

**`IDataSourceConnector` / `ConnectorFactory`:**
- Purpose: Uniform contract for reading from any protocol (FTP, SFTP, S3, NFS, SMB, HTTP, Kafka, Local). Factory selects implementation by `AdminServer.Type`
- Location: `src/Services/Shared/Connectors/IDataSourceConnector.cs`, `src/Services/Shared/Connectors/ConnectorFactory.cs`
- Implementations: `FtpConnector`, `SftpConnector`, `S3Connector`, `NfsConnector`, `SmbConnector`, `HttpApiConnector`, `KafkaConnector`, `LocalFileConnector`

**`IFormatConverter` / `IFormatReconstructor`:**
- Purpose: Convert source bytes → JSON for validation, then reconstruct JSON → target format for output
- Location: `src/Services/Shared/Converters/`
- Implementations: `CsvToJsonConverter`, `ExcelToJsonConverter`, `XmlToJsonConverter`, `JsonToJsonConverter`, `JsonToCsvReconstructor`, `JsonToExcelReconstructor`, `JsonToXmlReconstructor`

**`IOutputHandler`:**
- Purpose: Pluggable strategy for writing valid records to one destination type
- Location: `src/Services/OutputService/Handlers/IOutputHandler.cs`
- Implementations: `FolderOutputHandler`, `FtpOutputHandler`, `SftpOutputHandler`, `S3OutputHandler`, `KafkaOutputHandler`, `HttpOutputHandler`

**`MonitoringHub` + `useEntitySync`:**
- Purpose: Server-side SignalR hub broadcasting `EntityChanged` for every CRUD; client-side global React hook that listens and invalidates React Query caches
- Files: `src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs`, `src/Frontend/src/hooks/useEntitySync.ts`

## Entry Points

**Backend services** (each is a separate executable):
- `src/Services/DataSourceManagementService/Program.cs` — port 5001 (HTTP + SignalR + Quartz)
- `src/Services/MetricsConfigurationService/Program.cs` — port 5002
- `src/Services/ValidationService/Program.cs` — port 5003
- `src/Services/SchedulingService/Program.cs` — port 5004 (Quartz scheduler)
- `src/Services/InvalidRecordsService/Program.cs` — port 5007 (HTTP + SignalR)
- `src/Services/FileProcessorService/Program.cs` — port 5008 (consumer)
- `src/Services/OutputService/Program.cs` — port 5009 (consumer)
- `src/Services/FileDiscoveryService/Program.cs` — Quartz job + consumer (no public HTTP)
- `src/Services/DataSourceChatService/Program.cs` — optional AI API

Each follows the same Program.cs sequence:
1. `AddDataProcessingLogging` (Serilog → OTEL)
2. `AddDataProcessingOpenTelemetry` (metrics + traces + logs → OTLP collector)
3. `DB.InitAsync(databaseName, settings)` (MongoDB.Entities)
4. `AddResilientHazelcast` (where applicable)
5. `AddMassTransit` with RabbitMQ host + consumer registrations
6. `AddSignalR` (DataSourceManagement + InvalidRecords)
7. Quartz scheduler with `AddQuartzHostedService` (where applicable)

**Frontend:**
- `src/Frontend/src/index.tsx` — React bootstrap (`ReactDOM.createRoot`, mounts `<App />`)
- `src/Frontend/src/App.tsx` — Router, ConfigProvider (Ant Design with `direction='rtl'`), QueryClient, lazy-loaded pages, `useEntitySync` provider

**Background-job triggers:**
- `DataSourcePollingJob` (`src/Services/SchedulingService/Jobs/DataSourcePollingJob.cs`) — Quartz cron per datasource
- `FileDiscoveryWorker` (`src/Services/FileDiscoveryService/Workers/FileDiscoveryWorker.cs`) — Quartz `[DisallowConcurrentExecution]`
- `DeviceHealthCheckJob` (`src/Services/DataSourceManagementService/Jobs/DeviceHealthCheckJob.cs`) — every 30 s
- `InvalidRecordsTtlPurgeJob` (`src/Services/InvalidRecordsService/Jobs/InvalidRecordsTtlPurgeJob.cs`) — retention purge
- `MonitoringBroadcaster` and `DeviceHealthService` — `IHostedService` long-runners

## Architectural Constraints

- **Threading:** All services run as ASP.NET Core hosted apps (multi-threaded); Quartz jobs marked `[DisallowConcurrentExecution]` (e.g., `DataSourcePollingJob`, `FileDiscoveryWorker`) to prevent overlapping polling cycles. `FilePollingEventConsumer` uses `UseConcurrentMessageLimit(5)` to cap parallel datasource processing.
- **Global state:** `MonitoringBroadcaster` is registered as a singleton hosted service in `DataSourceManagementService/Program.cs` and holds the latest cluster state in memory for `MonitoringHub.OnConnectedAsync` snapshots.
- **Shared database:** All services connect to a single MongoDB database (`ezplatform`) and use the shared entity definitions in `src/Services/Shared/Entities/`. Schema changes therefore affect every service simultaneously — coordinate.
- **MongoDB initialization:** `DB.InitAsync` is called once per service at startup; replica-set URIs must be parsed via `MongoClientSettings.FromConnectionString` (see `DataSourceManagementService/Program.cs:210`).
- **Database name override:** `ConnectionStrings__DatabaseName` env var overrides default `ezplatform`; all services share the same DB so this must be consistent across the cluster.
- **Transport split:** CRUD/control-plane events flow over RabbitMQ via `MassTransit.UsingRabbitMq`; high-volume pipeline events use Kafka via `MassTransit.AddRider().UsingKafka` (`src/Services/Shared/Configuration/MassTransitConfiguration.cs:32`). Services pick one based on workload.
- **SignalR hub URL:** The frontend hardcodes `/hubs/monitoring` (`src/Frontend/src/hooks/useEntitySync.ts:16`); the hub is only mounted in DataSourceManagementService — the nginx/k8s ingress must route this path to port 5001.
- **MassTransit Kafka host:** Single Kafka rider per process — `AddMassTransit` is called once in each `Program.cs`; mixing Kafka + RabbitMQ in the same service requires both `UsingRabbitMq` and `AddRider().UsingKafka`.
- **Hazelcast TTL:** Pipeline payloads expire from Hazelcast after 5 min (`time-to-live-seconds: 300`). If a downstream consumer is slower than this, payload retrieval fails — keep consumer concurrency aligned with producer rate.

## Anti-Patterns

### Direct `DB.Find<T>()` in controllers

**What happens:** A controller bypasses `IDataSourceService` / `IDataSourceRepository` and calls `DB.Find<DataProcessingDataSource>()` directly.
**Why it's wrong:** Skips the validation, correlation ID propagation, and metric instrumentation done in the service layer; couples HTTP to MongoDB.Entities; defeats unit-testability.
**Do this instead:** Go through `IDataSourceService` (`src/Services/DataSourceManagementService/Services/IDataSourceService.cs`) which already wraps repository access.

### Implementing `IConsumer<TEvent>` directly when the event is `IDataProcessingMessage`

**What happens:** A new consumer declares `class FooConsumer : IConsumer<MyEvent>` and writes its own try/catch + logging.
**Why it's wrong:** Misses the standard correlation-tag, message-age check, `dataprocessing_messages_processed_total` counter, processing-duration histogram, and retry classification from the base.
**Do this instead:** Extend `DataProcessingConsumerBase<MyEvent>` (`src/Services/Shared/Consumers/DataProcessingConsumerBase.cs:15`) and override `ProcessMessage`. Existing exceptions: pipeline consumers (`FileDiscoveredEventConsumer`, `ValidationCompletedEventConsumer`, `FilePollingEventConsumer`) currently implement `IConsumer<T>` directly — that is the legacy path; new code should not follow it.

### Forgetting to broadcast SignalR `EntityChanged`

**What happens:** A new CRUD endpoint persists to MongoDB but does not call `_hubContext.Clients.All.SendAsync("EntityChanged", …)`.
**Why it's wrong:** Other browser sessions silently show stale data; users have to refresh. The `useEntitySync` hook on the frontend is built on the assumption every mutation broadcasts.
**Do this instead:** Follow the pattern in `DataSourceController` (`src/Services/DataSourceManagementService/Controllers/DataSourceController.cs`) — inject `IHubContext<MonitoringHub>` and emit `{ EntityType, EntityId, Action, Version }` after every create/update/delete. Add the entity to the `queryKeyMap` in `src/Frontend/src/hooks/useEntitySync.ts:36` so React Query invalidates the right keys.

### Reading bytes directly with `File.ReadAllBytesAsync` from a consumer

**What happens:** A pipeline consumer accesses the filesystem instead of going through `IDataSourceConnector`.
**Why it's wrong:** Breaks the FTP/SFTP/S3/NFS/SMB abstraction; only works for local paths; bypasses credential resolution via `ICredentialResolver`.
**Do this instead:** Inject `IConnectorFactory` and call `connectorFactory.CreateConnector(server)` to get an `IDataSourceConnector` (`src/Services/Shared/Connectors/IDataSourceConnector.cs`).

### Storing inter-service payloads in MongoDB

**What happens:** A consumer persists the raw file content / record list to MongoDB so the next consumer can read it.
**Why it's wrong:** MongoDB is the durable record store; payloads are transient and high-volume. Writes dominate IO budget and force schema versioning.
**Do this instead:** Use Hazelcast maps `file-content` (FileProcessor → Validation) and `valid-records` (Validation → Output), and only put cache keys on the event payload.

## Error Handling

**Strategy:** Try/catch at every boundary, with retry classification centralized in `DataProcessingConsumerBase<T>.ShouldRetryOnError` (`src/Services/Shared/Consumers/DataProcessingConsumerBase.cs:192`).

**Patterns:**
- Controllers return `ApiResponse<T>` / `ErrorResponse` shapes (e.g., `DataSourceController.GetById` — `src/Services/DataSourceManagementService/Controllers/DataSourceController.cs:58`); never raw exceptions.
- Consumers using `DataProcessingConsumerBase<T>` automatically record `messages_errored_total` and decide retry based on exception type (`TimeoutException`/`HttpRequestException` retried; `ArgumentException`/`NotSupportedException` swallowed).
- Validation failures during file processing publish `FileProcessingFailedEvent` rather than throwing; failed records persist via `DataProcessingInvalidRecord` for later correction by `InvalidRecordsService.CorrectionService`.
- Hazelcast access is wrapped in `IResilientHazelcastClient` (auto-reconnect, retry, circuit breaker) — configured via `AddResilientHazelcast` in `src/Services/Shared/Configuration/ResilienceConfiguration.cs`.
- Hebrew-localized error responses are factoried in `src/Services/DataSourceManagementService/Infrastructure/HebrewErrorResponseFactory.cs`.

## Cross-Cutting Concerns

**Logging:** Serilog configured via `AddDataProcessingLogging` (`src/Services/Shared/Configuration/LoggingConfiguration.cs`), shipping through the OTEL Collector to Elasticsearch index `dataprocessing-logs`. All log statements include `{CorrelationId}` and structured fields.

**Tracing:** Every service registers an `ActivitySource` with its service name; OTLP traces flow to Jaeger via the OTEL Collector. `DataProcessingConsumerBase<T>` opens a child activity per message with `correlation-id`, `message-type`, `consumer-type`, `published-by` tags.

**Metrics:** Two Prometheus instances — System (9090) and Business (9091). Business metrics live in `src/Services/Shared/Monitoring/BusinessMetrics.cs` and `DataProcessingMetrics.cs` (20 counters/histograms/gauges including `business_records_processed_total`, `business_processing_duration_seconds`, `business_active_jobs`).

**Validation:** Schema validation uses Corvus.Json.Validator (JSON Schema 2020-12) cached per schema; controller request validation uses DataAnnotations on request DTOs.

**Authentication:** None at present — services run inside the `ez-platform` namespace and are protected by Kubernetes network policies (default deny-ingress + per-service allow rules in `release-package/k8s/network-policies.yaml`). CORS is configured per service (`AllowAll` policy in development, named `Production` policy with origin whitelist).

**Correlation IDs:** Generated at the entry point (controller or job), propagated on every `IDataProcessingMessage` and every log line. Middleware: `src/Services/Shared/Middleware/CorrelationIdMiddleware.cs`.

**Credentials:** Resolved via `ICredentialResolver` (`src/Services/Shared/Services/ICredentialResolver.cs`) — defaulting to `KubernetesCredentialResolver` which reads from Kubernetes Secrets mounted into pods.

---

*Architecture analysis: 2026-05-24*

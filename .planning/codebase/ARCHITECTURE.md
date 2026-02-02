# Architecture

**Analysis Date:** 2026-02-02

## Pattern Overview

**Overall:** Microservices Event-Driven Architecture with Message Broker Orchestration

**Key Characteristics:**
- **Event-driven pipeline:** Services communicate via asynchronous events (MassTransit with RabbitMQ)
- **Shared library pattern:** `DataProcessing.Shared` provides base classes, entities, and utilities across all services
- **Multi-layer per service:** Controllers → Services → Repositories → MongoDB (each service follows consistent structure)
- **Correlation ID tracing:** All messages and requests include CorrelationId for cross-service request tracing
- **Distributed caching:** Hazelcast caches file content and archive data between processing stages

## Layers

**API Layer (Controllers):**
- Purpose: REST API endpoints for frontend and external integrations
- Location: `src/Services/[ServiceName]/Controllers/`
- Contains: ASP.NET Core controllers (e.g., `DataSourceController.cs`, `SchemaController.cs`)
- Depends on: Service layer interfaces, DTO models
- Used by: React frontend, external API consumers
- Pattern: Controllers delegate to services, return `ApiResponse<T>` wrappers with metadata

**Service Layer (Business Logic):**
- Purpose: Core business logic, orchestration, validation
- Location: `src/Services/[ServiceName]/Services/`
- Contains: IService interfaces and Service implementations
- Depends on: Repository layer, shared utilities (connectors, converters), message publisher
- Used by: Controllers, consumers, other services (via IRequestClient)
- Pattern: Services are scoped, injected via constructor, perform atomic operations

**Repository Layer (Data Access):**
- Purpose: MongoDB data access using MongoDB.Entities ORM
- Location: `src/Services/[ServiceName]/Repositories/`
- Contains: IRepository interfaces and Repository implementations
- Depends on: DB.InitAsync() setup, entities
- Used by: Services for CRUD operations
- Pattern: Generic CRUD + custom queries, returns entities with soft-delete filtering

**Message Consumer Layer:**
- Purpose: Event subscription and async message processing
- Location: `src/Services/[ServiceName]/Consumers/`
- Contains: Classes implementing `IConsumer<T>` from MassTransit
- Depends on: `DataProcessingConsumerBase<T>` for correlation ID tracking and error handling
- Used by: MassTransit event bus automatically
- Pattern: Inherits from base class, overrides `ProcessMessage()`, metrics/logging via base class

**Shared Library (Cross-Service):**
- Purpose: Reusable abstractions, base classes, and utilities
- Location: `src/Services/Shared/`
- Contains:
  - `Configuration/` - DI setup (Database, MassTransit, OpenTelemetry, Health checks, Hazelcast)
  - `Connectors/` - Data source connector implementations (Local, FTP, SFTP, Kafka, HTTP, S3)
  - `Converters/` - Format conversion (CSV↔JSON, XML↔JSON, Excel↔JSON)
  - `Entities/` - Shared MongoDB entities (DataProcessingBaseEntity, DataSourceCategory, etc.)
  - `Messages/` - Event contracts for MassTransit (FileDiscoveredEvent, ValidationRequestEvent, etc.)
  - `Consumers/` - DataProcessingConsumerBase<T> with auto-logging, metrics, retry logic
  - `Monitoring/` - BusinessMetrics, DataProcessingMetrics for OpenTelemetry
  - `Middleware/` - CorrelationIdMiddleware, error handling
- Used by: All services for DI configuration and base implementations

**Frontend Layer (React):**
- Purpose: User interface for platform
- Location: `src/Frontend/src/`
- Contains: React components, pages, API client services
- Depends on: React Query for server-state management, Ant Design for UI, i18next for i18n
- Used by: End users via browser
- Pattern: Pages (route components) → Components (reusable UI) → Services (API clients)

## Data Flow

**File Processing Pipeline:**

1. **FileDiscoveryService** → Discovers files matching pattern on data source
   - Reads data source config from MongoDB
   - Uses connector to list/access files
   - Publishes `FileDiscoveredEvent` for each file

2. **FileProcessorService** consumes `FileDiscoveredEvent`
   - Reads file content via connector
   - Converts to JSON (uses converter based on file type)
   - Stores JSON in Hazelcast cache (key: file-content:{guid})
   - Publishes `ValidationRequestEvent` with cache key reference

3. **ValidationService** consumes `ValidationRequestEvent`
   - Retrieves JSON from Hazelcast cache
   - Validates against schema (Corvus.Json.Validator - JSON Schema 2020-12)
   - Separates valid and invalid records
   - Stores `DataProcessingValidationResult` in MongoDB
   - Publishes `ValidationCompletedEvent`

4. **OutputService** consumes `ValidationCompletedEvent`
   - Queries validation results from MongoDB
   - Reconstructs data to original format (if needed)
   - Outputs to configured destinations:
     - Folder (local filesystem or network)
     - Kafka topic
     - SFTP server
     - HTTP endpoint
     - S3 bucket
     - FTP server
   - Publishes completion event

**Request-Response for Configuration:**

1. Frontend calls **DataSourceManagementService** API endpoints
   - `GET /api/v1/datasources` - List data sources (paginated)
   - `POST /api/v1/datasources` - Create data source
   - `PUT /api/v1/datasources/{id}` - Update data source
   - Also handles schema management, category management, server management

2. Frontend calls **MetricsConfigurationService** API endpoints
   - `GET /api/v1/metrics` - List metrics
   - `POST /api/v1/metrics` - Create metric with PromQL
   - Supports alert rule definition

3. Frontend calls **InvalidRecordsService** API endpoints
   - `GET /api/v1/invalid-records` - List invalid records (paginated)
   - Allows filtering by data source, pipeline stage

**State Management:**

- **Correlation ID Propagation:**
  - Generated on API request or by publishing service
  - Included in all event messages
  - Extracted in consumers and logged
  - Used for distributed tracing via OpenTelemetry

- **Hazelcast Cache Layers:**
  - `file-content:{guid}` - Raw JSON from FileProcessor (TTL: 5 min)
  - `valid-records:{guid}` - Validated records (TTL: 5 min)
  - Archive cache (`.ArchiveCacheService`) - Extracted archives

- **MongoDB Collections:**
  - `dataprocessingsources` - Data sources (with unique index on Name)
  - `dataprocessingdataSourceCategory` - Categories
  - `dataprocessingdataSourceAdminServer` - Server credentials
  - `dataprocessingvalidationresults` - Validation run results
  - `dataprocessinginvalidrecords` - Invalid record entries
  - `dataprocessingschema` - JSON schemas
  - `outputconfigurations` - Output destination configs
  - All documents have soft-delete flag, version, and correlation ID

## Key Abstractions

**IDataSourceConnector:**
- Purpose: Plugin interface for different file sources
- Examples: `src/Services/Shared/Connectors/LocalFileConnector.cs`, `FtpConnector.cs`, `HttpApiConnector.cs`, `S3Connector.cs`
- Pattern: Implement `ReadFileAsync()`, `ListFilesAsync()`, `TestConnectionAsync()`, `GetFileMetadataAsync()`
- Used by: FileDiscoveryService (list files), FileProcessorService (read files)

**IDataProcessingMessage:**
- Purpose: Message contract for all events
- Definition: `src/Services/Shared/Messages/IDataProcessingMessage.cs`
- Properties: CorrelationId, Timestamp, PublishedBy, MessageVersion
- Implementations: `FileDiscoveredEvent`, `ValidationRequestEvent`, `ValidationCompletedEvent`, etc.

**DataProcessingBaseEntity:**
- Purpose: MongoDB entity base class with audit trail
- Location: `src/Services/Shared/Entities/DataProcessingBaseEntity.cs`
- Features: CreatedAt, UpdatedAt, IsDeleted (soft delete), CorrelationId, Version, CreatedBy, UpdatedBy
- All domain entities extend this class

**DataProcessingConsumerBase<T>:**
- Purpose: Base class for MassTransit consumers with metrics/tracing
- Location: `src/Services/Shared/Consumers/DataProcessingConsumerBase.cs`
- Features:
  - Correlation ID tracking via activity tags
  - Counter metrics for processed/errored messages
  - Histogram for processing duration
  - Retry logic decision (ShouldRetryOnError)
  - Message validation hooks
- Usage: All consumers inherit and override `ProcessMessage()`

**ConnectorFactory:**
- Purpose: Factory pattern for connector instantiation
- Location: `src/Services/Shared/Connectors/ConnectorFactory.cs`
- Pattern: DI container creates connector by type string (e.g., "local", "ftp", "sftp")
- Resolves credentials from AdminServer entities before creating connector

## Entry Points

**DataSourceManagementService:**
- Location: `src/Services/DataSourceManagementService/Program.cs`
- Triggers: HTTP requests on port 5001
- Responsibilities:
  - CRUD for data sources
  - Connection testing via connectors
  - Schema management and assignment
  - Server credential management
  - Category management
  - Triggers FileDiscoveryService indirectly (scheduling)

**FileDiscoveryService:**
- Location: `src/Services/FileDiscoveryService/Program.cs`
- Triggers: Scheduled jobs via Quartz.NET (cron expressions)
- Responsibilities:
  - Polls data sources at scheduled intervals
  - Lists files matching configured pattern
  - Publishes FileDiscoveredEvent for each file
  - Tracks processed file hashes (deduplication)

**FileProcessorService:**
- Location: `src/Services/FileProcessorService/Program.cs`
- Triggers: FileDiscoveredEvent messages from RabbitMQ
- Responsibilities:
  - Reads file content via connector
  - Extracts from archives (SharpCompress)
  - Converts to JSON via converter
  - Caches JSON in Hazelcast
  - Publishes ValidationRequestEvent

**ValidationService:**
- Location: `src/Services/ValidationService/Program.cs`
- Triggers: ValidationRequestEvent messages from RabbitMQ
- Responsibilities:
  - Retrieves cached JSON from Hazelcast
  - Validates against assigned schema (Corvus.Json.Validator)
  - Splits valid/invalid records
  - Stores results in MongoDB
  - Publishes ValidationCompletedEvent

**OutputService:**
- Location: `src/Services/OutputService/Program.cs`
- Triggers: ValidationCompletedEvent messages from RabbitMQ
- Responsibilities:
  - Reconstructs data to original format
  - Routes to multiple output destinations
  - Handles folder, Kafka, SFTP, HTTP, S3, FTP outputs
  - Tracks processing completion

**React Frontend:**
- Location: `src/Frontend/src/main.tsx` or similar entry
- Triggers: User navigation and interactions
- Responsibilities:
  - Displays dashboards and forms
  - Manages data sources, schemas, metrics
  - Views validation results and invalid records
  - Configures alerts and output destinations
  - RTL/Hebrew language support

## Error Handling

**Strategy:** Combination of try-catch, consumer retry logic, and dead-letter queues

**Patterns:**

- **Service Layer:** Try-catch, log error, return `ApiResponse<T>` with error status and message
  - Example: `src/Services/DataSourceManagementService/Services/DataSourceService.cs`
  - Returns `(IsSuccess: false, Error: new ErrorDetails { StatusCode, Message })`

- **Consumer Layer:** Use `DataProcessingConsumerBase<T>` which:
  - Wraps `ProcessMessage()` in try-catch
  - Calls `ShouldRetryOnError()` to decide retry
  - Throws to trigger MassTransit retry (exponential backoff)
  - Logs to dead-letter if max retries exceeded
  - Example: `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs`

- **Validation Errors:** Non-retryable (ArgumentException, InvalidOperationException)
  - Consumer logs and moves to invalid records table
  - FileProcessingFailedEvent published for observability

- **Transient Errors:** Retryable (TimeoutException, HttpRequestException, TaskCanceledException)
  - Consumer throws to trigger MassTransit retry policy
  - Configured with exponential backoff in MassTransit setup

- **Health Checks:** `/health`, `/health/ready`, `/health/live` endpoints
  - Monitor database connectivity, message broker, Hazelcast
  - Kubernetes liveness/readiness probes query these

## Cross-Cutting Concerns

**Logging:**
- Framework: Serilog (structured logging)
- Configuration: `src/Services/Shared/Configuration/LoggingConfiguration.cs`
- Pattern: `_logger.LogInformation()` with structured properties
- Exported to: Elasticsearch via OpenTelemetry collector (OTLP gRPC 4317)
- Format: Includes correlation ID in all logs

**Validation:**
- Request DTOs: Data annotations on request models (Required, StringLength, Range, etc.)
  - Example: `src/Services/DataSourceManagementService/Models/Requests/CreateDataSourceRequest.cs`
- Schema validation: Corvus.Json.Validator for JSON documents against JSON Schema 2020-12
  - Example: `src/Services/ValidationService/Services/ValidationService.cs`
- Message validation: `DataProcessingConsumerBase<T>` validates IDataProcessingMessage contract

**Authentication & Authorization:**
- Current: None (open API for MVP)
- Future: Plan for adding API key or JWT support
- CORS: Configured per environment (AllowAll in dev, Production policy in prod)

**Monitoring:**
- Metrics framework: OpenTelemetry with Prometheus exporters
- Two-tier system:
  - **Prometheus System** (9090): ASP.NET Core metrics, HTTP request counts, latencies
  - **Prometheus Business** (9091): Custom business metrics (records processed, invalid records, etc.)
- Traces: Jaeger via OTLP gRPC from OpenTelemetry Collector
- Logs: Elasticsearch via OpenTelemetry Collector (structured Serilog output)
- Grafana dashboards (port 3001): Visualize metrics and logs

**Distributed Tracing:**
- Framework: OpenTelemetry with ActivitySource
- Correlation ID flow:
  1. API request includes `X-Correlation-ID` header
  2. CorrelationIdMiddleware extracts/generates ID
  3. All downstream calls include correlation ID
  4. Activity spans tagged with correlation-id
  5. Jaeger traces show end-to-end flow

**Caching:**
- Framework: Hazelcast (distributed, in-memory)
- Strategy: Cache intermediate data between processing stages
- Maps:
  - `file-content` - JSON from FileProcessor (5 min TTL, 3 min idle)
  - `valid-records` - Validated records (5 min TTL, 3 min idle)
- Eviction: LRU when map exceeds 256MB
- Invalidation: TTL-based (no manual invalidation needed for pipeline)

---

*Architecture analysis: 2026-02-02*

# Architecture

**Analysis Date:** 2026-01-28

## Pattern Overview

**Overall:** Microservices architecture with event-driven data processing pipeline

**Key Characteristics:**
- 9 independent backend microservices (DataSourceManagement, Validation, FileProcessor, FileDiscovery, Scheduling, Output, Metrics, InvalidRecords, DataSourceChat)
- React 19 frontend with TypeScript consuming REST APIs
- Event-driven asynchronous processing via MassTransit (Kafka/RabbitMQ)
- MongoDB document database with shared entity base
- Distributed cache (Hazelcast) for performance optimization
- Centralized OpenTelemetry monitoring (metrics, traces, logs)
- Kubernetes orchestration with OCP compliance

## Layers

**API Layer (Frontend):**
- Purpose: User interface for data source management, schema validation, metrics configuration, and monitoring
- Location: `src/Frontend/src/`
- Contains: React pages, components, services (API clients), hooks, i18n configuration
- Depends on: Backend REST APIs (DataSourceManagement primary, MetricsConfiguration, InvalidRecords, etc.)
- Used by: End users via HTTP/HTTPS

**REST API Layer (Services):**
- Purpose: Request handling and HTTP routing
- Location: `src/Services/[ServiceName]/Controllers/`
- Contains: ASP.NET Core controllers with route attributes, request validation
- Pattern: Each service has one or more controllers (e.g., `DataSourceController`, `CategoriesController`, `SchemaController`)
- Depends on: Service layer for business logic
- Response format: `ApiResponse<T>` wrapper with correlation ID, success flag, error details

**Business Logic Layer (Services):**
- Purpose: Core domain logic, validation, orchestration
- Location: `src/Services/[ServiceName]/Services/`
- Contains: Service implementations with interfaces (e.g., `IDataSourceService`, `IValidationService`)
- Pattern: Constructor injection of repository, logger, metrics, publish endpoint
- Depends on: Data access layer, shared configuration, event publishing
- Error handling: Try-catch with Hebrew localized error responses via `HebrewErrorResponseFactory`

**Data Access Layer (Repositories):**
- Purpose: MongoDB interaction and persistence
- Location: `src/Services/[ServiceName]/Repositories/`
- Contains: Repository implementations inheriting from MongoDB.Entities base
- Pattern: Async methods return entities or null; supports query, insert, update, delete operations
- Depends on: MongoDB.Entities ORM, correlation ID tracking
- Features: Soft-delete support (IsDeleted flag), optimistic concurrency (Version field)

**Shared Infrastructure Layer:**
- Purpose: Cross-cutting concerns and reusable utilities
- Location: `src/Services/Shared/`
- Contains:
  - `Configuration/`: DI setup (Database, MassTransit, OpenTelemetry, Logging, Hazelcast)
  - `Connectors/`: Data source connectors (Local, FTP, SFTP, Kafka, HTTP, AdminServer) - factory pattern
  - `Converters/`: Format converters (CSV, JSON, XML, Excel)
  - `Entities/`: Base entity classes and domain models
  - `Messages/`: Event contracts (12+ event types) implementing `IDataProcessingMessage`
  - `Consumers/`: `DataProcessingConsumerBase<T>` for Kafka message handling
  - `Monitoring/`: `BusinessMetrics` for counters, histograms, gauges
  - `Middleware/`: Authentication, correlation ID, logging middleware
- Used by: All services via dependency injection

**Event Bus Layer (MassTransit):**
- Purpose: Asynchronous inter-service communication
- Transport: RabbitMQ (synchronous) + Kafka (async topics)
- Topics:
  - `dataprocessing.scheduling.filepolling` - SchedulingService → FileDiscoveryService
  - `dataprocessing.filesreceiver.validationrequest` - FileDiscoveryService → ValidationService
  - `dataprocessing.validation.completed` - ValidationService → OutputService
  - `dataprocessing.global.processingfailed` - Any service (error dead-letter topic)
- Pattern: Consumers inherit from `DataProcessingConsumerBase<T>`, override `ProcessMessage()`
- Correlation: Automatic propagation via `CorrelationId` on all messages

**Data Storage Layer:**
- MongoDB: Database name `ezplatform`, connection via `ConnectionStrings__DefaultConnection`
- Hazelcast: Distributed cache for file content and validation results (TTL: 5 minutes)
- Indices: Auto-created for Name (unique), SupplierName, IsActive, CreatedAt fields

## Data Flow

**Ingest Pipeline:**

1. User creates/enables DataSource in UI → API call to DataSourceManagement (POST /api/v1/datasources)
2. DataSourceManagement validates, stores in MongoDB, publishes `FilePollingEvent`
3. SchedulingService creates Quartz.NET job based on schedule
4. At scheduled time, job emits `FilePollingEvent` → Kafka topic
5. FileDiscoveryService consumes event, connects to data source (FTP/Local/HTTP/etc.)
6. Discovers files matching pattern, reads content → stores in Hazelcast cache
7. Publishes `ValidationRequestEvent` → Kafka
8. ValidationService consumes, validates against schema using Corvus.Json.Validator
9. Valid records → OutputService consumes `ValidationCompletedEvent` → writes to destination (Folder, Kafka, etc.)
10. Invalid records → InvalidRecordsService for management and review

**Error Handling Flow:**

- Any step fails → catch block publishes `FileProcessingFailedEvent` to dead-letter topic
- Service logs with correlation ID, increments failure metric
- Error response to client includes: correlation ID, error code, Hebrew localized message, HTTP status

**State Management:**

- Request state: Correlation ID passed through all services (headers, message context)
- Entity state: MongoDB with soft-delete (IsDeleted flag), version field for concurrency
- Cache state: Hazelcast TTL-based eviction, invalidated on source updates
- UI state: React Query caching with hierarchical query keys (see `queryKeys.ts`)

## Key Abstractions

**Data Source:**
- Purpose: Represents external data provider (FTP, Local, HTTP, Kafka, AdminServer)
- Files: `Entities/DataProcessingDataSource.cs`, controllers/services in DataSourceManagementService
- Pattern: Store connection metadata (host, port, credentials via Vault), schedule, destination config
- Connector factory pattern: `IConnectorFactory` creates `IDataSourceConnector` implementations

**Connector:**
- Purpose: Abstraction over different data source protocols
- Examples: `FtpConnector`, `LocalConnector`, `SftpConnector`, `KafkaConnector`, `HttpConnector`
- Located: `Shared/Connectors/` implementations
- Pattern: Each connector implements `IDataSourceConnector` with connection test and file read methods

**Schema:**
- Purpose: JSON Schema validation rules for records
- Files: `Entities/DataProcessingSchema.cs`, `DataSourceManagementService/Services/Schema/`
- Pattern: Stored as JSON document, validated using Corvus.Json.Validator (JSON Schema 2020-12)
- Usage: ValidationService applies schema to each record during processing

**Converter:**
- Purpose: Format transformation (CSV→JSON, JSON→XML, Excel→CSV, etc.)
- Located: `Shared/Converters/` implementations
- Pattern: Each format has converter implementing `IFormatConverter`

**Metrics:**
- Purpose: Business-level observability counters and histograms
- Located: `Shared/Monitoring/BusinessMetrics.cs`
- Metrics: records_processed, invalid_records, files_processed, jobs_completed, processing_duration, validation_latency, etc.
- Labels: data_source, service, status, error_type, file_type, pipeline_stage, output_destination

**Output Destination:**
- Purpose: Target for processed records
- Types: Folder (Local), Kafka (topic), HTTP (webhook)
- Stored in: `OutputConfiguration` entity
- Pattern: OutputService routes validated records to destination(s) based on configuration

## Entry Points

**Frontend Entry:**
- Location: `src/Frontend/src/index.tsx` → `App.tsx`
- Triggers: Browser navigation to localhost:7000
- Responsibilities:
  - Initialize React Query, i18n (en-US, he-IL), Ant Design
  - Set RTL layout based on language
  - Lazy load route components
  - Manage splash screen, error boundary
  - Configure API base URL

**Backend Services Entry:**
- Each service: `src/Services/[ServiceName]/Program.cs`
- Initialization sequence:
  1. Configuration loading (appsettings.json + environment variables)
  2. Service registration (DI container setup)
  3. Logging configuration (Serilog → Elasticsearch)
  4. OpenTelemetry setup (OTLP exporter to OTEL Collector)
  5. MongoDB connection initialization
  6. Hazelcast connection (if cache needed)
  7. MassTransit configuration (RabbitMQ/Kafka)
  8. Health check endpoints (/health, /health/ready, /health/live)
  9. Middleware pipeline (CORS, correlation ID, security headers)
  10. Route mapping (controllers, swagger)
  11. Graceful shutdown hooks

**Microservices Responsibilities:**

- **DataSourceManagementService** (Port 5001): CRUD for data sources, schemas, servers, categories, connection testing
- **ValidationService** (Port 5003): Schema validation, Corvus.Json validator integration
- **FileProcessorService** (Port 5008): Format conversion, file processing
- **FileDiscoveryService**: File discovery and polling (consumer pattern, no direct API)
- **SchedulingService** (Port 5004): Quartz.NET job scheduling and management
- **OutputService** (Port 5009): Multi-destination output (Folder, Kafka, HTTP)
- **MetricsConfigurationService** (Port 5002): Business metrics, PromQL expressions, alert rules
- **InvalidRecordsService** (Port 5007): Invalid record storage and management
- **DataSourceChatService**: Optional AI assistant (consumer pattern)

## Error Handling

**Strategy:** Three-tier error handling with localization

**Tier 1 - Service Layer:**
```csharp
try {
  // Business logic
} catch (Exception ex) {
  _logger.LogError(ex, "...", correlationId);
  _metrics.IncrementFailureCounter();
  return ApiResponse<T>.Failure(
    HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message),
    correlationId
  );
}
```

**Tier 2 - API Response Wrapper:**
- `ApiResponse<T>` contains: `IsSuccess`, `Data`, `Error`
- `ErrorResponse` contains: `ErrorCode`, `Message` (Hebrew), `Details`, `Timestamp`, `CorrelationId`

**Tier 3 - Consumer Error Handling:**
- `DataProcessingConsumerBase<T>` catches exceptions during message processing
- Logs with correlation ID, records error metrics
- Decision logic: retry on TimeoutException, TaskCanceledException, HttpRequestException
- Non-retry on validation errors, not supported errors
- Failed messages → dead-letter topic `dataprocessing.global.processingfailed`

**Patterns:**
- Input validation before processing (required field checks, range validation)
- Database operation errors caught and mapped to HTTP 500 with user-friendly Hebrew message
- Missing resource errors return 404 with "Not found" message
- Concurrent modification conflicts use optimistic locking (Version field check)

## Cross-Cutting Concerns

**Logging:** Structured logging with Serilog → Elasticsearch
- Enrichers: Service name, environment, machine name, correlation ID
- Log levels: Information (default), Warning (framework), Error (exceptions)
- Console output: `[HH:mm:ss LVL] Message {Properties}`

**Validation:**
- Input: Controller level via DataAnnotations (Required, Range, StringLength)
- Business: Service level custom validation (duplicate check, connection test)
- Schema: ValidationService uses Corvus.Json.Validator for JSON Schema 2020-12

**Authentication:**
- Header-based correlation ID: `X-Correlation-ID`
- Generated if not present (Guid.NewGuid())
- Propagated through all service calls and Kafka messages

**Hebrew/RTL Support:**
- Frontend: Ant Design ConfigProvider with `direction="rtl"`, locale="he_IL"
- Backend: `HebrewErrorResponseFactory` for localized error messages
- Technical fields: CSS class `ltr-field` keeps regex/paths in LTR
- Encoding: `JavaScriptEncoder.UnsafeRelaxedJsonEscaping` prevents Hebrew escaping

**OpenTelemetry Pipeline:**
- Services emit to OTEL Collector (4317 gRPC, 4318 HTTP)
- Collector routes to:
  - Prometheus System (9090) for infrastructure metrics
  - Prometheus Business (9091) for application metrics
  - Elasticsearch (9200) for logs and traces
  - Jaeger (16686) for distributed tracing
- Correlation: `CorrelationId` tag on all activities and metrics

---

*Architecture analysis: 2026-01-28*

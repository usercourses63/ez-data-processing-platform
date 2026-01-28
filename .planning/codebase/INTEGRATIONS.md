# External Integrations

**Analysis Date:** 2026-01-28

## APIs & External Services

**Data Source Connectivity:**
- **FTP/FTPS** - FluentFTP (`src/Services/Shared/Connectors/FtpConnector.cs`)
- **SFTP** - SSH.NET (`src/Services/Shared/Connectors/SftpConnector.cs`)
- **Amazon S3 & S3-compatible** - AWSSDK.S3 (`src/Services/Shared/Connectors/S3Connector.cs`)
  - Supports AWS S3, MinIO, DigitalOcean Spaces, etc.
- **HTTP/HTTPS APIs** - Axios/HttpClient (`src/Services/Shared/Connectors/HttpApiConnector.cs`)
- **Kafka** - Confluent.Kafka/MassTransit (`src/Services/Shared/Connectors/KafkaConnector.cs`)
- **Local Filesystem** - System.IO (`src/Services/Shared/Connectors/LocalFileConnector.cs`)

**Output Destinations:**
- **FTP Output** - FluentFTP (`src/Services/OutputService/Handlers/FtpOutputHandler.cs`)
- **SFTP Output** - SSH.NET (`src/Services/OutputService/Handlers/SftpOutputHandler.cs`)
- **S3 Output** - AWSSDK.S3 (`src/Services/OutputService/Handlers/S3OutputHandler.cs`)
- **HTTP Output** - HttpClient (`src/Services/OutputService/Handlers/HttpOutputHandler.cs`)
- **Kafka Output** - Confluent.Kafka (`src/Services/OutputService/Handlers/KafkaOutputHandler.cs`)
- **Folder/Local Output** - System.IO (`src/Services/OutputService/Handlers/FolderOutputHandler.cs`)

**Internal Service Communication:**
- Uses Kafka for async inter-service messaging
- Uses HTTP for synchronous REST API calls (DataSourceManagementService as primary API)

## Data Storage

**Primary Database:**
- **MongoDB** (Self-hosted, 3-node replica set)
  - Connection: `mongodb://mongodb-0.mongodb.ez-platform.svc.cluster.local:27017,mongodb-1.mongodb.ez-platform.svc.cluster.local:27017,mongodb-2.mongodb.ez-platform.svc.cluster.local:27017/?replicaSet=rs0`
  - Database name: `ezplatform`
  - Client: MongoDB.Entities ORM
  - Replica set name: `rs0`
  - Connection via ConfigMap: `services-config.mongodb-connection`
  - Env var: `ConnectionStrings__DefaultConnection`

**File Storage During Processing:**
- **Hazelcast Distributed Cache** - In-memory storage
  - Maps: `file-content`, `valid-records`
  - TTL: 1 hour (configurable via `Hazelcast__CacheTTLHours`)
  - Purpose: Store large file content outside message broker (unlimited file size)
  - Address: `hazelcast:5701` (cluster), `localhost:5701` (host access)
  - Cluster name: `data-processing-cluster`

**Output File Storage:**
- Multiple destination types (see Integrations section above)
- Optional local filesystem storage via Kubernetes PVCs

## Caching

**Distributed Cache:**
- **Hazelcast 5.6.0** - In-memory, distributed
  - Heap: 2GB (4GB container limit)
  - Two maps configured:
    - `file-content`: Stores file data during processing pipeline
    - `valid-records`: Caches validated records for output
  - TTL: 1 hour (file content), configurable via ConfigMap
  - Max size: 256MB per map (configurable)
  - Eviction policy: LRU
  - Connection: `services-config.hazelcast-server`
  - Env var: `Hazelcast__Servers` = `localhost:5701`

**Validation Cache:**
- Corvus.Json.Validator caches JSON Schema compilation results
- Hazelcast also caches file deduplication hashes
- Deduplication TTL: 0.25 hours (testing), 4-24 hours (production)
  - Configured via ConfigMap: `FileDiscovery__DeduplicationTTLHours`

## Authentication & Identity

**Auth Provider:**
- Custom authentication (not yet fully implemented in v0.1.1-rc3)
- Services use OpenAPI/Swagger for API documentation
- No external identity provider (AAD, Auth0, etc.) in current version
- OWASP compliance planned for future releases

**Credential Management:**
- Credentials stored in Kubernetes Secrets (production)
- Secrets mounted as environment variables or files
- S3 connector: AWS credentials via AWSSDK credential chain
- FTP/SFTP: Credentials passed via DataSource configuration
- No hardcoded credentials in code

## Message Broker & Event Streaming

**Primary Broker:**
- **Apache Kafka** (Confluent 7.5.0)
  - Brokers: `kafka:9092` (internal cluster)
  - External access: `localhost:9094` (via port-forward)
  - Dual listener architecture:
    - INTERNAL (9092): Pod-to-pod cluster communication
    - EXTERNAL (9094): External/localhost access

**Message Transport:**
- **MassTransit** - Distributed messaging framework
  - Kafka rider for Kafka transport
  - RabbitMQ fallback for some services
  - Topic naming convention: `dataprocessing.[service].[event]`

**Kafka Topics:**
- `dataprocessing.scheduling.filepolling` - File polling trigger (Published by SchedulingService, Consumed by FilesReceiverService)
- `dataprocessing.filesreceiver.validationrequest` - Validation request (Published by FilesReceiverService, Consumed by ValidationService)
- `dataprocessing.validation.completed` - Validation result (Published by ValidationService, Consumed by OutputService)
- `dataprocessing.global.processingfailed` - Error event (Published by any service, Consumed by InvalidRecordsService)

**Topic Configuration:**
- Partitions: 3
- Replication factor: 1 (development), scalable for production
- Auto-create if missing
- ZooKeeper coordination: `zookeeper:2181`

**Message Contract:**
- All messages implement `IDataProcessingMessage` interface:
  - `CorrelationId` (Guid) - Request tracing
  - `Timestamp` (DateTime UTC) - Message ordering
  - `PublishedBy` (string) - Source service
  - `MessageVersion` (int) - Compatibility versioning

**Fallback/Alternative:**
- **RabbitMQ** configured as transport option in some services
  - Not primary in current version but available via MassTransit.RabbitMQ
  - Would listen on port 5672 if deployed

## Monitoring & Observability

**Error Tracking:**
- Elasticsearch - Logs and errors via Elastic.Serilog.Sinks
- Index pattern: `dataprocessing-logs-*`
- Correlation ID tracking for distributed error tracing

**Log Aggregation:**
- **Elasticsearch 8.17** - Log and trace storage
  - Address: `elasticsearch:9200` (cluster), `localhost:9200` (port-forward)
  - Indices: `ez-logs-YYYY.MM.DD` (daily rotation)
- **Fluent Bit** DaemonSet - Infrastructure container log collection
- **Serilog** - Application structured logging
  - Enriched with: CorrelationId, Environment, Thread, Timestamp
  - Outputs to Elasticsearch and console

**Metrics Collection:**
- **Prometheus (System)** - Infrastructure metrics
  - Port: 9090
  - Collects: ASP.NET Core, HTTP client, Runtime, Process metrics
  - Auto-instrumentation via OpenTelemetry
- **Prometheus (Business)** - Business KPIs
  - Port: 9091
  - Collects: Business metrics with `business_*` prefix
  - Metrics: records_processed, invalid_records, files_processed, jobs_completed, etc.
- **prometheus-net** - .NET Prometheus client
- **OpenTelemetry** - Metrics exporter to Prometheus via OTLP

**Distributed Tracing:**
- **Jaeger (all-in-one)** - Distributed tracing UI
  - Port: 16686
  - Receives traces from OpenTelemetry Collector
- **OpenTelemetry Collector** - Telemetry aggregation
  - OTLP gRPC receiver: 4317
  - OTLP HTTP receiver: 4318
  - Exports to: Jaeger, Prometheus, Elasticsearch
- **OpenTelemetry SDK** - Instrumentation
  - ActivitySource: `DataProcessing.Platform`
  - Automatic ASP.NET Core, HTTP, Runtime instrumentation
  - Custom spans via ActivitySource in services

**Health Checks:**
- Endpoint: `/health` (primary)
- Detailed: `/health/detailed`
- Checks performed:
  - MongoDB connectivity (via AspNetCore.HealthChecks.MongoDb)
  - Kafka broker health (via AspNetCore.HealthChecks.Kafka)
  - Elasticsearch connectivity (via AspNetCore.HealthChecks.Elasticsearch)

## CI/CD & Deployment

**Hosting:**
- Kubernetes (production-ready)
- Minikube (local development)
- OpenCP 4.12+ compatible (OCP Compliance v0.1.1-rc3+)

**Container Registry:**
- Docker images built locally and loaded to Minikube
- Images pinned to specific versions (no :latest)
- Multi-stage builds for optimized image size

**Deployment Orchestration:**
- kubectl for cluster operations
- Kubernetes manifests in `k8s/` directory
- StatefulSets for: MongoDB, Kafka, Zookeeper, Hazelcast
- Deployments for: Microservices, Frontend, Monitoring stack
- Services (ClusterIP, Headless, LoadBalancer) for networking
- ConfigMaps for centralized configuration
- Secrets for sensitive data

**CI/CD Platform:**
- Not detected in current version
- Scripts provided: `scripts/start-port-forwards.ps1`, `scripts/bootstrap-k8s-cluster.ps1`
- Manual deployment via kubectl

**Network:**
- Kubernetes Services for load balancing
- Namespace: `ez-platform`
- Network Policies: Default deny-all (OCP compliance)
- Explicit allow rules for service communication

## Environment Configuration

**Required Environment Variables:**
- `ConnectionStrings__DefaultConnection` - MongoDB connection string
- `Kafka__Brokers` or `ConnectionStrings__Kafka` - Kafka bootstrap servers
- `OpenTelemetry__OtlpEndpoint` - OTLP Collector endpoint
- `Hazelcast__Servers` - Hazelcast cluster address
- `ASPNETCORE_ENVIRONMENT` - Development/Production/Staging
- `ASPNETCORE_URLS` - HTTP binding address and port

**Optional Environment Variables:**
- `OpenTelemetry__EnableMetrics` - Enable metrics collection (default: true)
- `OpenTelemetry__EnableTraces` - Enable trace collection (default: true)
- `OpenTelemetry__EnableLogs` - Enable log collection (default: true)
- `OpenTelemetry__SamplingRatio` - Trace sampling ratio (default: 1.0)
- `FileDiscovery__DeduplicationTTLHours` - File hash cache duration

**Secrets Location:**
- Kubernetes Secrets (production)
- Environment variables (local development)
- `.env` file in project root (development)
- User Secrets via `dotnet user-secrets` (development)
  - Configured in: `src/Services/ValidationService/DataProcessing.Validation.csproj`
  - User Secrets ID: `validation-service`

## Data Source Credentials

**Storage Method:**
- MongoDB in `DataProcessingDataSource` entity
- Encrypted at application layer (future enhancement)
- Credentials passed to connectors at runtime

**Credential Types Supported:**
- **FTP:** Username, Password, Host, Port
- **SFTP:** Username, Password (SSH key auth), Host, Port
- **S3:** AWS Access Key ID, Secret Access Key, Region, Endpoint (optional)
- **HTTP API:** API Key, Bearer Token, Basic Auth headers
- **Kafka:** Bootstrap servers, SASL credentials (optional)
- **Local:** File path

## File Format Support

**Input Formats:**
- **CSV** - CsvHelper parser, automatic detection
- **Excel** - EPPlus library (.xlsx, .xls support)
- **JSON** - Newtonsoft.Json parser
- **XML** - SharpCompress/System.Xml
- **Archives** - SharpCompress (ZIP, TAR, GZIP, BZIP2, 7Z, RAR)

**Output Formats:**
- **CSV** - CsvHelper writer
- **JSON** - Newtonsoft.Json serializer
- **Excel** - EPPlus writer
- **XML** - Custom formatter
- **Kafka** - Topic publishing via Confluent.Kafka
- **S3/FTP/SFTP** - Stream writing to remote storage

## Webhooks & Callbacks

**Incoming Webhooks:**
- Not detected in current version
- Kafka topics used for async event notification instead

**Outgoing Webhooks:**
- Not detected in current version
- HTTP Output Handler can POST to external endpoints
- Event notifications via Kafka topics (`dataprocessing.global.processingfailed`, etc.)

**SignalR Integration:**
- Real-time signaling support via `@microsoft/signalr` (v7.0.11)
- Frontend connection point: Not fully implemented in v0.1.1-rc3
- Intended for: Live updates, job status, error notifications

## Third-Party APIs

**AWS Integration:**
- **AWSSDK.S3** - S3 file access and storage
- **S3Connector** - Both read (DataSource) and write (OutputHandler)
- Credentials: Via AWS credential chain or environment variables
- Regions: Configurable per data source
- S3-compatible endpoints: Supported (MinIO, DigitalOcean Spaces, etc.)

**Code Editor Integration:**
- **Monaco Editor** (v0.54) - Frontend code editing
- Used in schema builder and metrics configuration UI
- Syntax highlighting for: JSON, JavaScript, PromQL, CRON expressions

**Date/Time Utilities:**
- **cronstrue** - CRON expression to human readable text
- **date-fns** - Date formatting and manipulation
- **moment.js** - Legacy date handling (kept for backward compatibility)

## RTL/Internationalization Integration

**i18next Integration:**
- Multi-language support: Hebrew (he), English (en)
- Backend namespace: `translation.json` files per language
- Frontend auto-detection via `i18next-browser-languagedetector`
- HTTP backend loading: `i18next-http-backend`
- 200+ translation keys covering all business domains

**Hebrew Support:**
- Ant Design RTL: `ConfigProvider direction="rtl"`
- Document direction: `document.documentElement.dir = 'rtl'`
- Technical fields forced LTR: `.ltr-field` CSS class
- Arabic numerals support
- Categories: 10 business categories fully translated

---

*Integration audit: 2026-01-28*

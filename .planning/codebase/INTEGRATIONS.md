# External Integrations

**Analysis Date:** 2026-02-02

## APIs & External Services

**File Source Protocols:**
- Local File System - Direct filesystem access via `LocalFileConnector` (`src/Services/Shared/Connectors/LocalFileConnector.cs`)
- FTP/FTPS - `FluentFTP` package via `FtpConnector` (`src/Services/Shared/Connectors/FtpConnector.cs`)
  - Auth: Credentials stored in `DataProcessingDataSource.Credentials`
- SFTP - `SSH.NET` package via `SftpConnector` (`src/Services/Shared/Connectors/SftpConnector.cs`)
  - Auth: SSH keys and passwords supported
- HTTP/HTTPS APIs - `HttpApiConnector` (`src/Services/Shared/Connectors/HttpApiConnector.cs`)
  - Client: `@microsoft/signalr` 7.0.11 (frontend), HttpClient (backend)
  - Auth: Bearer tokens, API keys, custom headers
- Amazon S3 / S3-Compatible - `AWSSDK.S3` via `S3Connector` (`src/Services/Shared/Connectors/S3Connector.cs`)
  - Supports: AWS S3, MinIO, DigitalOcean Spaces, Wasabi
  - Credentials: IAM roles, access keys (environment-based or embedded)
- Apache Kafka - `MassTransit.Kafka` via `KafkaConnector` (`src/Services/Shared/Connectors/KafkaConnector.cs`)
  - Protocol: PLAINTEXT (cluster), EXTERNAL listener for external access
  - Consumer groups per service

**Web Integrations:**
- Frontend API Gateway: Proxy to backend services at `http://localhost:5001` (DataSourceManagementService)
- All frontend API calls use `VITE_API_URL` environment variable or default to relative paths
- CORS: Handled via backend CORS policy (Ant Design RTL requests)

## Data Storage

**Databases:**
- MongoDB 8.0 (3-node replica set recommended, 1-node for dev)
  - Connection: Environment variable `ConnectionStrings__DefaultConnection`
  - Direct Connection: Use `?directConnection=true` to bypass replica set discovery
  - Database Name: `ezplatform` (configurable, environment-specific naming: `data_processing_{environment}`)
  - Client: MongoDB.Entities ORM (`src/Services/Shared/Configuration/DatabaseConfiguration.cs`)
  - Service: `mongodb:27017` (internal) / `localhost:27017` (port-forward)
  - Collections: `DataProcessingDataSource`, `DataProcessingValidationResult`, `DataProcessingInvalidRecord`

**File Storage:**
- S3/S3-Compatible - For large file archival and backup
- Local Filesystem - Development and testing only
- Archive Support: SharpCompress for ZIP, RAR, 7Z extraction

**Caching:**
- Hazelcast 5.x - Distributed in-memory cache
  - Connection: `Hazelcast__Servers` env var (default: `localhost:5701`)
  - Maps: `file-content` (FileProcessor → ValidationService), `valid-records` (ValidationService → OutputService)
  - TTL: 5 minutes by default, configurable via ConfigMaps
  - Cluster Name: `data-processing-cluster`
  - Failover: Cluster nodes automatically coordinate

## Authentication & Identity

**Auth Provider:**
- Custom/None - No external OAuth/OIDC currently integrated
- Frontend: No authentication layer (assumed internal/trusted network)
- API: No API key validation (assumed internal only)

**Credential Storage:**
- Database-backed: Credentials encrypted in MongoDB `DataProcessingDataSource.Credentials` field
- Environment Variables: Service credentials loaded from ConfigMaps and Secrets
- Kubernetes Secrets: For sensitive connection strings

## Monitoring & Observability

**Error Tracking:**
- OpenTelemetry Collector (OTLP) - Centralized telemetry aggregation
- Jaeger 16686 - Distributed tracing backend
- Elasticsearch 9200 - Log and trace storage

**Logs:**
- Serilog 3.x - Structured logging framework (`src/Services/Shared/Configuration/LoggingConfiguration.cs`)
- Elasticsearch sink - Logs indexed as `dataprocessing-logs-YYYY.MM.DD`
- Fluent Bit (optional) - DaemonSet for infrastructure container logs
- Correlation IDs - Automatic propagation via `Serilog.Enrichers.CorrelationId`

**Metrics:**
- Prometheus System (port 9090) - ASP.NET Core, HTTP, runtime metrics
- Prometheus Business (port 9091) - Application-specific metrics (records processed, validation latency, etc.)
- OpenTelemetry Collector filters:
  - System metrics: `http.*`, `process.*`, `dotnet.*`, `runtime.*`, `aspnetcore.*`, `kestrel.*`, `system.*`, `dns.*`, `validation.*`
  - Business metrics: `business.*` prefix
- Dual-instance setup: Prometheus System → System metrics, Prometheus Business → Business metrics

**Tracing:**
- OpenTelemetry SDK - Distributed tracing instrumentation
- Endpoint: `http://localhost:4317` (gRPC) or `http://localhost:4318` (HTTP)
- Exporters: Jaeger (4317) + Elasticsearch (9200)
- Sampling ratio: Configurable via `OpenTelemetry__SamplingRatio` (default: 1.0 = 100%)
- Activity Source: `DataProcessing.Platform` v1.0.0

**Dashboards:**
- Grafana 3001 - Visualization dashboard (admin/admin)
  - Infrastructure Dashboard - Pod metrics, resource usage
  - Business Metrics Dashboard - File processing, validation metrics
  - Data source: Prometheus System + Prometheus Business

## CI/CD & Deployment

**Hosting:**
- Kubernetes (Minikube for dev, must support OCP 4.12+ for production)
- Namespace: `ez-platform`

**Image Registry:**
- Docker Hub (default assumed)
- All images pinned to specific versions (no `:latest` tags)
- Image pull policy: `IfNotPresent` (OCP requirement)
- Non-root users in Dockerfiles (OCP requirement)

**CI Pipeline:**
- Not detected in codebase (likely external GitHub Actions or GitLab CI)
- Deployment via kubectl apply or Helm charts

**Deployment Scripts:**
- PowerShell: `scripts/start-port-forwards.ps1` - Port forwarding for local development
- Bash: `k8s/deploy-all.sh` - Full cluster deployment

## Environment Configuration

**Required Environment Variables:**
- `ConnectionStrings__DefaultConnection` - MongoDB connection string
- `Kafka__Brokers` - Kafka bootstrap servers (default: localhost:9094 for external, kafka:9092 for internal)
- `OpenTelemetry__OtlpEndpoint` - OTEL Collector endpoint
- `Hazelcast__Servers` - Hazelcast cluster nodes

**Optional Environment Variables:**
- `OpenTelemetry__EnableMetrics` - Enable metrics export (default: true)
- `OpenTelemetry__EnableTraces` - Enable trace export (default: true)
- `OpenTelemetry__EnableLogs` - Enable log export (default: true)
- `OpenTelemetry__SamplingRatio` - Trace sampling ratio (default: 1.0)
- `OpenTelemetry__EnableConsoleExporter` - Debug console output (default: false)

**Secrets Location:**
- Kubernetes ConfigMaps: `k8s/configmaps/services-config.yaml`
- Kubernetes Secrets: For passwords and API keys (not in repository)
- Environment-specific appsettings files: Checked into repo for non-sensitive defaults

## Message Broker Configuration

**Kafka Topics (MassTransit conventions):**
- `dataprocessing.scheduling.filepolling` - File polling trigger (Published by SchedulingService → FileDiscoveryService)
  - Partitions: 3
  - Replication Factor: 1
  - Retention: 168 hours (7 days)

- `dataprocessing.filesreceiver.validationrequest` - Validation request (Published by FileDiscoveryService → ValidationService)
  - Partitions: 3
  - Replication Factor: 1

- `dataprocessing.validation.completed` - Validation completion (Published by ValidationService → OutputService)
  - Partitions: 3
  - Replication Factor: 1

- `dataprocessing.global.processingfailed` - Error events (Published by any service → InvalidRecordsService)
  - Partitions: 3
  - Replication Factor: 1

**Kafka Connectivity:**
- Internal (cluster): `kafka:9092` (pod-to-pod)
- External (localhost): `localhost:9094` (port-forward)
- ZooKeeper: `zookeeper:2181` (internal cluster coordination)

**MassTransit Configuration:**
- Transport: Kafka with RabbitMQ fallback support
- Message Contract: All messages inherit from `IDataProcessingMessage` with CorrelationId, Timestamp, PublishedBy, MessageVersion
- In-Memory Bus: Local processing for development

## Webhooks & Callbacks

**Incoming:**
- Not detected - No external webhook receivers configured

**Outgoing:**
- Potential S3 notifications (not currently wired)
- Kafka message publishing (asynchronous event driven)

## API Endpoints

**Frontend API Clients** (`src/Frontend/src/services/`):
- DataSource Management: `${VITE_API_URL}/api/v1/datasources`
- Metrics: `${VITE_API_URL}/api/v1/metrics`
- Invalid Records: `${VITE_INVALIDRECORDS_API_URL}/api/v1/invalid-records`
- Schema: `${VITE_SCHEMA_API_URL}/api/v1/schema`
- Dashboard: `${VITE_API_URL}/api/v1/dashboard/overview`

**Backend Health Endpoints:**
- `/health` - Basic health check (all services)
- `/health/detailed` - Detailed health with dependency status

---

*Integration audit: 2026-02-02*

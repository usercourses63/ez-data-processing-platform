# External Integrations

**Analysis Date:** 2026-05-24

## APIs & External Services

**AI / LLM:**
- OpenAI — `DataSourceChatService` AI assistant
  - SDK/Client: `OpenAI` 2.7.0 NuGet package (see `src/Services/DataSourceChatService/DataProcessing.Chat.csproj`)
  - Entry point: `src/Services/DataSourceChatService/Program.cs`
  - Auth: API key via configuration (environment variable / appsettings) — keys never quoted here for security

**Kubernetes Control Plane:**
- Kubernetes API (in-cluster + kubeconfig fallback)
  - Client: `KubernetesClient` 14.0.2 NuGet package
  - Registration: `src/Services/Shared/Configuration/KubernetesConfiguration.cs` (`AddKubernetesClient`)
  - Auto-detects in-cluster config first; falls back to `Kubernetes:Context` (default `minikube`) and `Kubernetes:KubeConfigPath`
  - Consumers: `KubernetesMonitoringService`, `NasDeviceService` (DataSourceManagementService) for pod/PV/PVC monitoring
  - Quirk: `config.SkipTlsVerify = true` set to work around .NET OpenSSL `X509Chain.Build` NRE on certain runtimes

**External File / Data Source Protocols (consumed via connector abstraction `IDataSourceConnector`):**
- Local Filesystem — `src/Services/Shared/Connectors/LocalFileConnector.cs` (server types `local`, `folder`)
- NFS via Kubernetes PVC mounts — `NfsConnector.cs` (server type `nfs`)
- FTP — `FtpConnector.cs` (`FluentFTP` 49.0.2)
- SFTP — `SftpConnector.cs` (`SSH.NET` 2025.1.0)
- SMB/CIFS (port 445) — `SmbConnector.cs` (`SMBLibrary` 1.5.5.1)
- HTTP/HTTPS API — `HttpApiConnector.cs` (typed `HttpClient` from DI)
- Kafka topic source — `KafkaConnector.cs` (`Confluent.Kafka` 2.12.0)
- S3 / S3-compatible (MinIO etc.) — `S3Connector.cs` (`AWSSDK.S3` 3.7.411.7; server types `s3`, `s3compat`)
- Factory registration: `src/Services/Shared/Connectors/ConnectorFactory.cs` (`DefaultConnectorTypes` map)

## Data Storage

**Databases:**
- MongoDB (3-node replica set in production)
  - Connection: `ConnectionStrings:MongoDB` (default `localhost`) + `ConnectionStrings:DefaultConnection` (database name; default `ezplatform`)
  - Client: `MongoDB.Driver` 3.2.0 via `MongoDB.Entities` 24.1.1 ORM
  - Initialization: `src/Services/Shared/Configuration/DatabaseConfiguration.cs` (`InitializeAsync`)
  - Per-service init also done in `src/Services/DataSourceManagementService/Program.cs` (lines 203–293) with explicit replica-set-aware `MongoClientSettings.FromConnectionString`
  - Database name pattern: `data_processing_{environment}` (Shared config) or `ezplatform` (Program.cs override)
  - Connection string supports `?directConnection=true` to bypass replica-set discovery
  - Health check: `AspNetCore.HealthChecks.MongoDb` 9.0
  - Entities inherit `DataProcessingBaseEntity` (audit + soft delete + `Version` for optimistic concurrency)

**Distributed Cache:**
- Hazelcast 5.6.0 (single-node Docker / multi-node K8s)
  - Server: `Hazelcast:Server` (default `hazelcast:5701` in cluster, `localhost:5701` for host)
  - Cluster name: `Hazelcast:ClusterName` (default `data-processing-cluster`)
  - Client: `Hazelcast.Net` 5.5.1
  - Wrapper: `src/Services/Shared/Configuration/HazelcastConfiguration.cs` — `ResilientHazelcastClient` with Polly retry + circuit breaker
  - Retry policy: 5 attempts with backoff 100ms→500ms→1s→2s→5s; circuit breaker opens after 5 failures for 30s
  - Maps in use:
    - `file-content` — FileProcessor → ValidationService (raw file payload, avoids RabbitMQ size limits)
    - `valid-records` — ValidationService → OutputService
  - TTL: configurable (`Hazelcast:CacheTTLHours`, default 1h); per-map TTL 300s, max-idle 180s, LRU eviction, 256MB max per map (per `CLAUDE.md`)

**File Storage:**
- Local filesystem mounts (NFS via K8s PVCs) — Primary input/output for file pipeline
- S3-compatible object storage (output destination) — Via `S3Connector` + `OutputService` handlers

## Authentication & Identity

**Auth Provider:**
- None enforced at application layer (no JWT/OAuth middleware found in `Program.cs` files)
- API access controlled via:
  - CORS policies (`AllowAll` in development, `Production` policy reading from `Cors:AllowedOrigins` config)
  - Rate limiting (`src/Services/Shared/Configuration/RateLimitingConfiguration.cs`, `AddDataProcessingRateLimiting`)
  - Security headers middleware in `DataSourceManagementService/Program.cs` (lines 309–318): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self'`, etc.
- Frontend SignalR uses cookie-based credentials (`AllowCredentials()` required for WebSocket transport)

**Internal credentials:**
- RabbitMQ default `guest/guest` (overridable via `RabbitMQ:Username` / `RabbitMQ:Password`)
- MongoDB connection string (potentially with embedded credentials in production)
- Hazelcast: no auth (open-source edition)
- OpenAI: API key via env var

## Monitoring & Observability

**OpenTelemetry Collector (central hub):**
- Image: `otel/opentelemetry-collector-contrib:latest`
- Endpoints: gRPC `4317`, HTTP `4318`, health `13133`, pprof `1777`, internal metrics `8888`
- Config: `deploy/otel-collector/config.yaml`
- Receives all application telemetry (metrics, traces, logs) via OTLP
- Pipelines:
  - `metrics/system` → Prometheus System (filters `http_*`, `process_*`, `dotnet_*`, `runtime_*`, `aspnetcore_*`, `kestrel_*`, `system_*`)
  - `metrics/business` → Prometheus Business (filters `business_*`)
  - `logs` → Elasticsearch (index `dataprocessing-logs`, ECS mapping mode)
  - `traces` → Jaeger (gRPC `14250`) + Elasticsearch (`dataprocessing-traces` index)
- Resource attributes injected: `environment`, `cluster=dataprocessing`, `region=israel`, `timezone=Asia/Jerusalem`
- Service-side wiring: `src/Services/Shared/Configuration/OpenTelemetryConfiguration.cs` (`AddDataProcessingOpenTelemetry`)

**Prometheus (dual-instance):**
- prometheus-system (`prom/prometheus:latest`) — Infrastructure/runtime metrics on port `9090`
  - Config: `deploy/prometheus/prometheus-system.yml`
- prometheus-business (`prom/prometheus:latest`) — Business KPIs on port `9091`
  - Config: `deploy/prometheus/prometheus-business.yml`
- Receives via Prometheus Remote Write from OTEL Collector
- Native client: `prometheus-net` 8.2.1 + `prometheus-net.AspNetCore` 8.2.1 (exposes `/metrics`)

**Grafana:**
- Image: `grafana/grafana:latest`
- Port: `3001` (mapped from container `3000`)
- Admin: `admin/admin` (env `GF_SECURITY_ADMIN_USER` / `GF_SECURITY_ADMIN_PASSWORD`)
- Plugins: `grafana-clock-panel`, `grafana-simple-json-datasource`
- Datasources provisioned: `deploy/grafana/provisioning/datasources/datasources.yaml`
- Data sources: prometheus-system, prometheus-business, elasticsearch

**Elasticsearch:**
- Image: `docker.elastic.co/elasticsearch/elasticsearch:8.17.0`
- Port: `9200` (HTTP), `9300` (transport)
- Single-node mode (`discovery.type=single-node`), `xpack.security.enabled=false`
- Heap: 512MB (`ES_JAVA_OPTS=-Xms512m -Xmx512m`)
- Indices:
  - `dataprocessing-logs` (OTEL Collector logs pipeline)
  - `dataprocessing-traces` (OTEL Collector traces pipeline)
  - `dataprocessing-filediscovery`, `dataprocessing-fileprocessor` (per-service Serilog `IndexPrefix`)
  - `ez-logs-YYYY.MM.DD` (Fluent Bit DaemonSet for infrastructure container logs — `k8s/deployments/fluent-bit.yaml` per `CLAUDE.md`)
- Health check: `AspNetCore.HealthChecks.Elasticsearch` 9.0

**Jaeger:**
- Image: `jaegertracing/all-in-one:latest`
- UI port: `16686`
- gRPC receiver from OTEL Collector: `14250`
- Receives distributed traces forwarded from OTEL Collector traces pipeline
- ActivitySources registered: `DataProcessing.Platform`, `DataProcessing.Consumer`, `DataProcessing.Validation`, `DataProcessing.FileProcessor`, `MassTransit`, `{serviceName}.*`

**Serilog (structured logging):**
- Config: `src/Services/Shared/Configuration/LoggingConfiguration.cs` (`AddDataProcessingLogging`)
- Sinks: Console + optional File + Elasticsearch (`Elastic.Serilog.Sinks` 9.0)
- Enrichers: `MachineName`, `ThreadId`, `Service`, `Environment`, `Application`, `Version`, `CorrelationIdEnricher`
- Default levels: `Information` (app), `Warning` (Microsoft/System)
- Log/trace pipeline ALSO flows through OTEL Collector for unified observability

**Health Checks:**
- Endpoint pattern: `/health`, `/health/ready`, `/health/live` on every service
- Probes: MongoDB (`AspNetCore.HealthChecks.MongoDb`), Kafka (`AspNetCore.HealthChecks.Kafka`), Elasticsearch (`AspNetCore.HealthChecks.Elasticsearch`)
- Helm values declare readiness/liveness/startup probes on port `8080` (`deploy/helm/dataprocessing-service/values.yaml`)

## Message Brokers

**Apache Kafka (`confluentinc/cp-kafka:7.4.0`):**
- Dual listener:
  - INTERNAL `9092` (pod-to-pod cluster)
  - EXTERNAL `9094` (host / port-forward)
- Zookeeper: `confluentinc/cp-zookeeper:7.4.0` on `2181` (mapped `12181` external)
- Client libraries: `Confluent.Kafka` 2.12.0 (raw), `MassTransit.Kafka` 8.5.7 (event abstraction)
- Wiring: `src/Services/Shared/Configuration/MassTransitConfiguration.cs` (`AddDataProcessingMassTransit` with Kafka rider)
- Topics (3 partitions, replication factor 1):
  - `dataprocessing.scheduling.filepolling` (Published by SchedulingService → consumed by FileDiscoveryService)
  - `dataprocessing.filesreceiver.validationrequest` (FileProcessor → ValidationService)
  - `dataprocessing.validation.completed` (ValidationService → OutputService)
  - `dataprocessing.global.processingfailed` (cross-service failure dead-letter)
- Used by: `OutputService` (`KafkaOutputHandler` for output destinations), `MetricsConfigurationService` (Kafka rider)
- Health check: `AspNetCore.HealthChecks.Kafka` 9.0

**RabbitMQ:**
- Default host: `rabbitmq.ez-platform.svc.cluster.local` (in-cluster) or `localhost:5672` (dev)
- Credentials: `RabbitMQ:Username` / `RabbitMQ:Password` (default `guest/guest`)
- Client: `MassTransit.RabbitMQ` 8.5.7
- Primary transport for: `DataSourceManagementService`, `FileDiscoveryService`, `FileProcessorService`, `ValidationService`, `SchedulingService`, `OutputService`, `InvalidRecordsService`
- Configured per-service in `Program.cs` files (e.g. `DataSourceManagementService/Program.cs` lines 65–84)

**Message Contract:**
- All messages implement `IDataProcessingMessage` (`src/Services/Shared/Messages/`) with: `CorrelationId` (Guid), `Timestamp` (UTC), `PublishedBy` (source service), `MessageVersion` (int for compatibility)
- Publisher abstraction: `IDataProcessingMessagePublisher` / `DataProcessingMessagePublisher` (`MassTransitConfiguration.cs`)

## CI/CD & Deployment

**Container Registry:**
- Local Minikube image cache (`minikube image load servicename:v1`) for dev
- Production registry: not explicitly defined in repo (deploy scripts use `dataprocessing` repo prefix)

**Hosting:**
- Kubernetes (Minikube for dev; OpenShift Container Platform / OCP for production)
- Namespace: `ez-platform`
- Helm chart: `deploy/helm/dataprocessing-service/` (Chart + values + templates)
- Manifests: `deploy/kubernetes/deployment.template.yaml`, `deploy/kubernetes/filesreceiver-deployment.yaml`
- Docker Compose (dev only): `docker-compose.development.yml` brings up MongoDB, Kafka+Zookeeper, OTEL Collector, dual Prometheus, Elasticsearch, Jaeger, Hazelcast, Grafana

**CI Pipeline:**
- Local CI script: `scripts/ci-local.sh`
- Build orchestration: `scripts/build-all-images.sh` / `.ps1`, `scripts/build-all-services-beta.ps1`, `scripts/build-all-services-rc3.ps1`
- Image export for offline package: `scripts/export-images.ps1`, `export-images-beta.ps1`, `export-images-rc3.ps1`
- Validation: `scripts/validate-release.ps1`, `scripts/sanity-test.ps1` / `.sh`
- Helm packaging: `scripts/sync-helm-charts.sh`, `scripts/test-helm-charts.ps1`
- Performance: `scripts/run-performance-tests.sh`, `scripts/burn-in.sh`

**Dockerfiles:**
- One per service under `docker/` (`docker/DataSourceManagementService.Dockerfile`, etc.)
- Multi-stage builds: `mcr.microsoft.com/dotnet/sdk:10.0` → `mcr.microsoft.com/dotnet/aspnet:10.0`
- Version injection via `ARG VERSION` / `ARG COMMIT_SHA` → OCI labels + `InformationalVersion`
- Frontend: `docker/Frontend.Dockerfile` uses `node:20-alpine` → `nginx:alpine`; OCP-compatible variant `src/Frontend/Dockerfile` runs nginx as non-root user `1001` on port `8080`
- Health checks: `HEALTHCHECK CMD curl -f http://localhost:{port}/health || exit 1`

## Real-Time Communication

**SignalR Hubs (server-side):**
- `MonitoringHub` mounted at `/hubs/monitoring` on `DataSourceManagementService` — broadcasts pod/service/queue/trace/alert state every interval via `MonitoringBroadcaster` (hosted service)
- Hub on `InvalidRecordsService` at `/hubs/invalid-records` — revalidation notifications (v0.4.0)
- Entity sync broadcasting: every CRUD controller calls `_hubContext.Clients.All.SendAsync("EntityChanged", ...)` with `EntityType`, `EntityId`, `Action`, `Version`

**SignalR Clients (frontend):**
- Library: `@microsoft/signalr` 7.0.11
- Hooks: `src/Frontend/src/hooks/useMonitoringHub.ts`, `useEntitySync.ts`, `useRevalidationNotifications.ts`
- 7 monitoring event types + `InitialState` received via `useMonitoringHub`
- Connection state: `connecting | connected | reconnecting | disconnected` with auto-reconnection and toast notifications
- nginx proxy passes `/hubs/` to backend with `proxy_read_timeout 86400s` to keep WebSocket alive

## Environment Configuration

**Required env vars (mapped from K8s ConfigMap `services-config`):**
- `ConnectionStrings__DefaultConnection` — MongoDB connection string
- `ConnectionStrings__DatabaseName` — Database name override
- `Kafka__Brokers` — Kafka bootstrap servers
- `OpenTelemetry__OtlpEndpoint` — OTEL Collector endpoint (typically `http://otel-collector:4317`)
- `Hazelcast__Servers` — Hazelcast cluster nodes
- `RabbitMQ__Host`, `RabbitMQ__Username`, `RabbitMQ__Password`
- `Elasticsearch__Url` (or `ConnectionStrings__Elasticsearch`)
- `Kubernetes__Context`, `Kubernetes__Namespace`
- `ASPNETCORE_ENVIRONMENT` — `Development` / `Production`

**Secrets locations:**
- Production: Kubernetes Secrets (`mongodb-secret` / `kafka-secret` per `deploy/helm/dataprocessing-service/values.yaml`)
- Dev: `appsettings.Development.json` per service, `.env` files (existence noted only — contents never quoted)
- Helm chart references: `externalServices.mongodb.secretName` / `connectionStringKey`

## Webhooks & Callbacks

**Incoming:**
- None detected — services communicate via message bus (Kafka/RabbitMQ) and SignalR; no HTTP webhook receivers found

**Outgoing:**
- None detected — `HttpApiConnector.cs` makes outbound REST calls to configured data sources, but no outbound webhook fire-and-forget pattern found

---

*Integration audit: 2026-05-24*

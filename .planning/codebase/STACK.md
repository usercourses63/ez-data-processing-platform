# Technology Stack

**Analysis Date:** 2026-01-28

## Languages

**Primary:**
- C# (.NET 10.0) - Backend microservices
- TypeScript 5 - Frontend and type safety
- JavaScript - Frontend utilities

**Secondary:**
- YAML - Kubernetes manifests and configuration
- JSON - Configuration, seeds, and data

## Runtime

**Environment:**
- .NET 10.0 (via `global.json` - SDK version 10.0.100)
- Node.js (frontend, via npm)
- OpenJDK (Kafka, Zookeeper, Hazelcast, Elasticsearch via Docker)

**Package Manager:**
- NuGet - Backend dependencies (centralized in `Directory.Packages.props`)
- npm - Frontend dependencies
- Lockfile: `package-lock.json` present for frontend

## Frameworks

**Core Backend:**
- ASP.NET Core Web API (.NET 10.0) - All microservices use this framework
- Located in `src/Services/[ServiceName]/Program.cs` for dependency injection

**Core Frontend:**
- React 19 - UI framework
- React Router 6 - Client-side routing
- React Query (TanStack) - Server state management (`@tanstack/react-query@^5.90.2`)

**Build/Dev Tools:**
- Vite 5 - Frontend build tool (configured for React with TypeScript)
- React Scripts 5 - Development server
- Docker & Docker Compose - Local development containerization
- Kubernetes (Minikube) - Production deployment

**Testing:**
- Playwright 1.49 - E2E testing
- Testing Library (Jest) - React component testing
- dotnet test - Backend unit/integration testing

**ORM/Data:**
- MongoDB.Entities - .NET ORM for MongoDB (all services use this)

**Job Scheduling:**
- Quartz.NET - Distributed job scheduling (in SchedulingService and FileDiscoveryService)

**Validation:**
- Corvus.Json.Validator - JSON Schema 2020-12 validation (ValidationService)
- AJV 8.17 - Frontend JSON Schema validation

**Format Handling:**
- CsvHelper - CSV parsing and generation
- EPPlus - Excel file processing
- Newtonsoft.Json / System.Text.Json - JSON serialization
- SharpCompress - Archive support (ZIP, TAR, etc.)

**Messaging:**
- MassTransit - Distributed messaging framework
- MassTransit.Kafka - Kafka transport for MassTransit
- MassTransit.RabbitMQ - RabbitMQ transport (used in DataSourceManagementService, FileProcessorService, ValidationService)
- Confluent.Kafka - Direct Kafka client (OutputService for KafkaOutputHandler)

## Key Dependencies

**Critical Infrastructure:**
- MongoDB.Entities - Data persistence across all services
- Hazelcast.Net - Distributed in-memory cache (5 minutes TTL for file content)
- MassTransit + Kafka - Event-driven architecture
- Polly - Retry policies and resilience patterns

**File I/O & Connectivity:**
- FluentFTP - FTP/FTPS file access
- SSH.NET - SFTP file access
- AWSSDK.S3 - Amazon S3 and S3-compatible storage
- KubernetesClient - Kubernetes API interactions

**Monitoring & Observability:**
- OpenTelemetry (Core) - Distributed tracing framework
- OpenTelemetry.Instrumentation.AspNetCore - HTTP instrumentation
- OpenTelemetry.Instrumentation.Http - HTTP client tracing
- OpenTelemetry.Instrumentation.Runtime - Runtime metrics
- OpenTelemetry.Instrumentation.Process - Process metrics
- OpenTelemetry.Exporter.OpenTelemetryProtocol - OTLP exporter (gRPC to OTEL Collector)
- prometheus-net - Prometheus client (System and Business metrics)
- prometheus-net.AspNetCore - ASP.NET Core instrumentation for Prometheus
- Serilog - Structured logging
- Serilog.AspNetCore - ASP.NET Core integration
- Elastic.Serilog.Sinks - Elasticsearch sink
- Serilog.Enrichers.CorrelationId - Distributed tracing correlation

**Health Checks:**
- AspNetCore.HealthChecks.MongoDb - MongoDB connectivity checks
- AspNetCore.HealthChecks.Kafka - Kafka connectivity checks
- AspNetCore.HealthChecks.Elasticsearch - Elasticsearch connectivity checks
- Microsoft.Extensions.Diagnostics.HealthChecks - Base health check framework

**Frontend Utilities:**
- Ant Design 5.10 - UI component library (RTL-enabled for Hebrew)
- Axios 1.5 - HTTP client
- i18next 23.5 - Internationalization (Hebrew/English)
- i18next-browser-languagedetector - Auto language detection
- i18next-http-backend - Load translations from backend
- react-i18next - React binding for i18next
- Monaco Editor 0.54 - Code editor component
- Recharts 2.8 - Chart and graph visualization
- Lodash 4.17 - Utility library
- date-fns 4.1 - Date manipulation
- moment 2.29 - Legacy date formatting
- cronstrue 3.9 - CRON expression to human-readable text
- randexp 0.5 - Random regex-based data generation
- vanilla-jsoneditor 3.10 - JSON editor component
- react-markdown 10.1 - Markdown rendering in React

**Frontend API Integration:**
- @microsoft/signalr - WebSocket signaling (7.0.11)
- @monaco-editor/react - React wrapper for Monaco Editor
- jsonjoy-builder - JSON schema builder

## Configuration

**Environment Variables (Required):**
- `ConnectionStrings__DefaultConnection` - MongoDB connection string with replica set
- `Kafka__Brokers` or `ConnectionStrings__Kafka` - Kafka bootstrap servers (defaults to `localhost:9092` in development)
- `OpenTelemetry__OtlpEndpoint` - OTLP Collector endpoint (defaults to `http://localhost:4317`)
- `Hazelcast__Servers` - Hazelcast cluster endpoint (defaults to `localhost:5701`)
- `ASPNETCORE_ENVIRONMENT` - `Development`, `Production` (set in Dockerfile)
- `ASPNETCORE_URLS` - HTTP binding (set per service port in Dockerfile)

**Backend Configuration Files:**
- `appsettings.json` - Base configuration per service
- `appsettings.Development.json` - Development environment overrides
- `appsettings.Production.json` - Production environment overrides
- Located in `src/Services/[ServiceName]/` for each microservice

**Frontend Configuration:**
- `.env` files (checked in `.planning/codebase/.env`)
- API proxy: `proxy: "http://localhost:5001"` in `package.json`
- Environment detection via `i18next-browser-languagedetector`

**Build Configuration:**
- `Directory.Build.props` - Centralized .NET project defaults
- `Directory.Packages.props` - Centralized NuGet package versions
- `vite.config.ts` (implicit via package.json scripts)
- `tsconfig.json` - TypeScript configuration
- `.eslintrc` - ESLint configuration (extends react-app)
- `playwright.config.ts` - E2E test configuration

## Container & Orchestration

**Containerization:**
- Docker multi-stage builds (all microservices)
- Base image: `mcr.microsoft.com/dotnet/sdk:10.0` (build stage)
- Runtime image: `mcr.microsoft.com/dotnet/aspnet:10.0` (production)
- Non-root user (UID 1000) for OCP compliance
- Read-only root filesystem support

**Orchestration:**
- Kubernetes (production) via kubectl
- Minikube (local development)
- Namespace: `ez-platform`
- Node.js container for frontend development

## Infrastructure Services (Kubernetes/Docker)

**Data Storage:**
- MongoDB 8.0 - 3-node replica set (StatefulSet)
  - Storage: 20Gi per node
  - Resource requests: 1000m CPU, 2Gi memory
  - Headless service: `mongodb.ez-platform.svc.cluster.local:27017`

**Message Broker:**
- Kafka (Confluent 7.5.0) - 1 node (scalable)
  - Internal listener: `:9092` (cluster communication)
  - External listener: `:9094` (localhost/port-forward access)
  - Storage: 10Gi
  - Resource requests: 1000m CPU, 2Gi memory
- Zookeeper (Confluent 7.5.0) - 1 node for Kafka coordination
  - Storage: 5Gi
  - Resource requests: 250m CPU, 512Mi memory

**Distributed Cache:**
- Hazelcast 5.6.0 - 1 node (via Docker/K8s)
  - Heap: 2GB (4GB container limit)
  - Port: 5701
  - Cluster name: `data-processing-cluster`
  - TTL: 1 hour default

**Observability Stack:**
- Prometheus (System) 9090 - Infrastructure metrics
- Prometheus (Business) 9091 - Business KPIs
- Elasticsearch 8.17 - Logs and trace storage (9200, 9300)
- Grafana 11.x - Dashboard and query layer (3001)
- Jaeger (all-in-one) - Distributed tracing UI (16686)
- OpenTelemetry Collector - Telemetry aggregation (4317 gRPC, 4318 HTTP)

**Logging Infrastructure:**
- Fluent Bit DaemonSet - Container log aggregation
- Elasticsearch indices: `ez-logs-YYYY.MM.DD`

**Documentation:**
- Docusaurus - Documentation website (8080 port)

## Service Ports

**Backend Services:**
- DataSourceManagementService: 5001
- MetricsConfigurationService: 5002
- ValidationService: 5003
- SchedulingService: 5004
- InvalidRecordsService: 5007
- FileProcessorService: 5008
- OutputService: 5009

**Frontend:**
- React development: 7000 (Vite dev server)
- React production: 8080

**Infrastructure:**
- MongoDB: 27017
- Kafka (internal): 9092
- Kafka (external): 9094
- Zookeeper: 2181
- Hazelcast: 5701
- Prometheus (System): 9090
- Prometheus (Business): 9091
- Elasticsearch: 9200, 9300
- Grafana: 3000 (host) → 3001 (localhost)
- Jaeger: 16686
- OTEL Collector: 4317 (gRPC), 4318 (HTTP)

## Platform Requirements

**Development:**
- .NET 10.0 SDK
- Node.js LTS (for npm/frontend)
- Docker Desktop or Docker Engine
- Kubernetes (Minikube recommended)
- kubectl CLI
- PowerShell (for Windows scripts)

**Production:**
- Kubernetes 1.24+ (OCP 4.12+ compatible)
- Container runtime (containerd, CRI-O, or Docker)
- Persistent volumes (20Gi for MongoDB, 10Gi for Kafka, 5Gi for Zookeeper)
- Network policies support
- Security Context Constraints (SCC) support for non-root pods

---

*Stack analysis: 2026-01-28*

# Technology Stack

**Analysis Date:** 2026-05-24

## Languages

**Primary:**
- C# 12 (`net10.0` target) — All backend microservices under `src/Services/`
- TypeScript 5.9 — React frontend under `src/Frontend/src/`

**Secondary:**
- PowerShell — Build/deploy/test orchestration scripts under `scripts/`
- Python 3 — Test data generation and CRUD verification scripts under `tests/` (e.g. `tests/complete-crud-verification.py`)
- Bash — POSIX deploy/CI helpers under `scripts/` (`scripts/build-all-images.sh`, `scripts/ci-local.sh`)
- YAML — Kubernetes manifests, Helm charts, OTEL config (`deploy/helm/`, `deploy/kubernetes/`, `deploy/otel-collector/config.yaml`)
- JSON / JSON Schema — appsettings, schema validation resources (`src/Services/ValidationService/Resources/*.json`)

## Runtime

**Environment:**
- .NET 10.0 (`global.json` pins `10.0.100` with `rollForward: latestMajor`)
- Node.js 20 (alpine) — confirmed by `docker/Frontend.Dockerfile` build stage
- Docker container images: `mcr.microsoft.com/dotnet/aspnet:10.0` (runtime), `mcr.microsoft.com/dotnet/sdk:10.0` (build), `nginx:alpine` (frontend serve)

**Package Manager:**
- NuGet — Centralized via `Directory.Packages.props` (`ManagePackageVersionsCentrally=true`)
- npm — Frontend dependencies (`src/Frontend/package.json`, `package-lock.json`)
- Lockfile: `package-lock.json` present; `*.csproj` files use central package versions (no per-project version pinning)

## Frameworks

**Core (Backend):**
- ASP.NET Core 10.0 — All HTTP APIs (`Microsoft.NET.Sdk.Web`)
- MongoDB.Entities 24.1.1 — Document ORM over `MongoDB.Driver` 3.2.0
- MassTransit 8.5.7 — Message bus abstraction (RabbitMQ + Kafka transports)
- Quartz.NET 3.15.1 — Cron-style job scheduling (`SchedulingService`, `DataSourceManagementService` device health)
- Corvus.Json.Validator 4.3.9 — JSON Schema 2020-12 validation (`ValidationService`)
- Hazelcast.Net 5.5.1 — Distributed in-memory cache client
- Polly 8.5.2 — Resilience policies (retry, circuit breaker) used by `HazelcastConfiguration`
- SignalR — Real-time WebSocket broadcasting via `Microsoft.AspNetCore.SignalR` (built into ASP.NET Core 10)
- KubernetesClient 14.0.2 — In-cluster K8s API for monitoring
- OpenAI 2.7.0 — `DataSourceChatService` AI assistant

**Core (Frontend):**
- React 19 (`react` ^19.0.0, `react-dom` ^19.0.0)
- React Router DOM 6.15
- Ant Design 5.10 (RTL-enabled) — Primary UI component library
- TanStack React Query 5.90 — Server state management
- @microsoft/signalr 7.0.11 — Real-time client for monitoring/entity sync hubs
- i18next 23.5 + react-i18next 13.2 — Hebrew/English internationalization
- Monaco Editor 0.54 + @monaco-editor/react 4.7 — Code/JSON/schema editors
- Ajv 8.17 — Client-side JSON Schema validation
- axios 1.5 — HTTP client (REST APIs)
- Recharts 2.8 — Charts/visualizations
- Papaparse 5.5, xlsx 0.18, js-yaml 4.1, jszip 3.10, libarchive.js 2.0 — File parsing/preview
- vanilla-jsoneditor 3.10 + jsonjoy-builder 0.1 — JSON editing widgets
- randexp 0.5, cronstrue 3.9, date-fns 4.1, moment 2.29, lodash 4.17 — Utilities

**Testing:**
- xUnit 2.9.2 + xunit.SkippableFact 1.4.13 — Backend unit/integration tests
- Moq 4.20.72 — Backend mocking
- FluentAssertions 7.0 — Backend assertion library
- coverlet.collector 6.0.2 — Code coverage
- Microsoft.NET.Test.Sdk 17.12.0 — Test runner
- @playwright/test 1.49 — Frontend E2E tests (`src/Frontend/tests/e2e/`)
- @testing-library/react 14.1 + @testing-library/jest-dom 6.1 + @testing-library/user-event 14.5 — Component tests
- Python Playwright — Comprehensive UI verification under `src/Frontend/tests/webapp-testing/`

**Build/Dev:**
- Vite 5.4 + @vitejs/plugin-react 4.7 — Frontend bundler (`src/Frontend/vite.config.ts`)
- vite-plugin-svgr 4.5, vite-plugin-imp 2.4, vite-tsconfig-paths 4.3 — Vite plugins
- TypeScript 5.9.3 — Frontend type checker
- ESLint 8.48 + eslint-config-react-app 7.0.1 — Frontend linting
- `dotnet` CLI (SDK 10.0) — Backend build/publish
- `Directory.Build.props` enforces `TreatWarningsAsErrors=true`, `Nullable=enable`, `GenerateDocumentationFile=true`

## Key Dependencies

**Critical:**
- `MongoDB.Driver` 3.2.0 / `MongoDB.Entities` 24.1.1 — Primary persistence
- `MassTransit` 8.5.7 / `MassTransit.RabbitMQ` 8.5.7 / `MassTransit.Kafka` 8.5.7 — Inter-service messaging; most services use RabbitMQ, `MetricsConfigurationService` + `MassTransitConfiguration.cs` configure Kafka rider
- `Confluent.Kafka` 2.12.0 — Native Kafka client used by `OutputService` `KafkaOutputHandler`
- `Hazelcast.Net` 5.5.1 — File content + valid records map storage between services
- `Corvus.Json.Validator` 4.3.9 + `Corvus.Json.ExtendedTypes` 4.3.9 — Schema 2020-12 validation engine
- `Quartz` 3.15.1 + `Quartz.Extensions.Hosting` 3.15.1 — Background job scheduling

**Data Format / File Transport:**
- `CsvHelper` 33.1.0 — CSV parsing/writing
- `EPPlus` 8.3.1 + `ExcelDataReader` 3.8.0 + `ExcelDataReader.DataSet` 3.8.0 — Excel I/O
- `Newtonsoft.Json` 13.0.4 + `Newtonsoft.Json.Schema` 4.0.1 + `NJsonSchema` 11.5.2 — JSON serialization/schema
- `FluentFTP` 49.0.2 — FTP connector (`src/Services/Shared/Connectors/FtpConnector.cs`)
- `SSH.NET` 2025.1.0 — SFTP connector (`SftpConnector.cs`)
- `SMBLibrary` 1.5.5.1 — SMB/CIFS connector (`SmbConnector.cs`)
- `AWSSDK.S3` 3.7.411.7 — S3 / S3-compatible (`S3Connector.cs`)
- `SharpCompress` 0.38.0 — Archive (zip/tar/gz) handling (`SharpCompressArchiveService`)

**Infrastructure:**
- `OpenTelemetry` 1.14.0 + `OpenTelemetry.Exporter.OpenTelemetryProtocol` 1.14.0 — OTLP gRPC export
- `OpenTelemetry.Instrumentation.AspNetCore` / `Http` / `Runtime` / `Process` 1.14.0 — Auto-instrumentation
- `prometheus-net` 8.2.1 + `prometheus-net.AspNetCore` 8.2.1 — Prometheus metrics
- `Serilog` 4.3.0 + `Serilog.AspNetCore` 10.0 + `Elastic.Serilog.Sinks` 9.0 — Structured logging to Elasticsearch
- `Serilog.Enrichers.CorrelationId` 3.0.1 / `Environment` 3.0.1 / `Thread` 4.0 — Log enrichment
- `AspNetCore.HealthChecks.MongoDb` / `Kafka` / `Elasticsearch` 9.0 — Health probes
- `Grpc.Net.Client` 2.71.0 — gRPC client (used by OTEL OTLP transport)
- `KubernetesClient` 14.0.2 — In-cluster K8s API
- `Polly` 8.5.2 / `Polly.Extensions` 8.5.2 — Resilience patterns

**AI / Utilities:**
- `OpenAI` 2.7.0 — Chat completion (`DataSourceChatService`)
- `Bogus` 35.6.1 — Fake data generation (`tools/DemoDataGenerator`)
- `System.CommandLine` 2.0.0-beta4 — CLI parsing (DemoDataGenerator, ServiceOrchestrator)

## Configuration

**Environment:**
- ASP.NET Core layered config: `appsettings.json` → `appsettings.{Environment}.json` → environment variables → command line (see `src/Services/DataSourceManagementService/Program.cs` lines 23–28)
- Per-service `appsettings.json` + `appsettings.Development.json` + `appsettings.Production.json` files
- Kubernetes ConfigMap `services-config` injects values at runtime (per `CLAUDE.md`)

**Key Configs Required:**
- `ConnectionStrings:MongoDB` — MongoDB host (default `localhost`)
- `ConnectionStrings:DefaultConnection` / `DatabaseName` — Database name (default `ezplatform`)
- `ConnectionStrings:Kafka` / `Kafka:Brokers` — Kafka bootstrap (default `localhost:9092` internal, `9094` external)
- `RabbitMQ:Host` / `Username` / `Password` — RabbitMQ credentials (default `guest`/`guest`)
- `Hazelcast:Server` (default `hazelcast:5701`) + `Hazelcast:ClusterName` (`data-processing-cluster`)
- `Elasticsearch:Url` + `Elasticsearch:IndexPrefix` (default `http://localhost:9200`)
- `OpenTelemetry:OtlpEndpoint` (default `http://localhost:4317`, gRPC)
- `Jaeger:AgentHost` / `Jaeger:AgentPort` (legacy, OTEL Collector forwards to Jaeger)
- `Kubernetes:Context` / `Kubernetes:Namespace` (defaults `minikube` / `ez-platform`)

**Build:**
- `Directory.Build.props` — Global C# build properties (target framework, nullable, warnings-as-errors)
- `Directory.Packages.props` — Centralized NuGet package versions for all `.csproj`
- `global.json` — Pins .NET SDK 10.0.100
- `DataProcessingPlatform.sln` — Visual Studio solution; aggregates all backend projects + tests + tools
- `src/Frontend/vite.config.ts` — Vite bundler config with manual vendor chunking (react/antd/query/i18n/monaco/utils) and version injection from `VERSION` / `COMMIT_SHA` env vars
- `src/Frontend/tsconfig.json` — TypeScript strict mode, ES2020 target, `moduleResolution: bundler`

## Platform Requirements

**Development:**
- Windows 10/11 with PowerShell 5+ (primary dev OS based on `scripts/*.ps1`)
- Docker Desktop + Minikube (Kubernetes for local infra)
- .NET 10 SDK
- Node.js 20+
- Ports 5001–5009 (services), 7000 (frontend), 3001 (Grafana), 9090/9091 (Prometheus), 9200 (Elasticsearch), 16686 (Jaeger), 4317/4318 (OTEL), 27017 (MongoDB), 9094 (Kafka external), 5672 (RabbitMQ), 5701 (Hazelcast)
- Port-forward setup script: `scripts/start-port-forwards.ps1`
- Helper scripts: `scripts/setup-dev-environment.ps1`, `scripts/bootstrap-k8s-cluster.ps1`, `start-all-services.ps1`

**Production:**
- Kubernetes (target: OpenShift Container Platform / OCP) — Manifests in `deploy/kubernetes/` and `deploy/helm/dataprocessing-service/`
- Helm chart: `deploy/helm/dataprocessing-service/Chart.yaml` + `values.yaml`
- OCP-compatible: non-root containers (`runAsUser: 1000`), non-privileged ports (frontend on 8080), `readOnlyRootFilesystem`, `seccompProfile: RuntimeDefault`
- Namespace: `ez-platform`
- All images pinned to specific versions, `imagePullPolicy: IfNotPresent`

---

*Stack analysis: 2026-05-24*

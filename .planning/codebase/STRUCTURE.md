# Codebase Structure

**Analysis Date:** 2026-05-24

## Directory Layout

```
ez/
├── src/
│   ├── Services/                              # 9 .NET 10 microservices + Shared kernel
│   │   ├── Shared/                            # Shared library — referenced by every service
│   │   │   ├── Configuration/                 # DI setup (Database, MassTransit, OTEL, Hazelcast, etc.)
│   │   │   ├── Connectors/                    # FTP/SFTP/S3/NFS/SMB/HTTP/Kafka/Local data-source connectors
│   │   │   ├── Consumers/                     # `DataProcessingConsumerBase<T>` base class
│   │   │   ├── Converters/                    # CSV/JSON/XML/Excel ↔ JSON converters + reconstructors
│   │   │   ├── Entities/                      # `DataProcessingBaseEntity` + 11 domain entities
│   │   │   ├── Extensions/                    # MongoDB query extensions
│   │   │   ├── Messages/                      # `IDataProcessingMessage` + 12 event contracts
│   │   │   ├── Middleware/                    # `CorrelationIdMiddleware`
│   │   │   ├── Monitoring/                    # `BusinessMetrics`, `DataProcessingMetrics`
│   │   │   ├── Services/                      # Cross-cutting services (cache, hash, archive, credentials)
│   │   │   ├── Utilities/                     # `CronExpressionConverter`, `FileHashCalculator`
│   │   │   └── DataProcessing.Shared.csproj   # Project file referenced by all services
│   │   ├── DataSourceManagementService/       # Primary API (port 5001) + MonitoringHub
│   │   ├── DataSourceManagementService.Tests/ # Test project
│   │   ├── MetricsConfigurationService/       # Business metrics + alerts (port 5002)
│   │   ├── ValidationService/                 # JSON schema validation (port 5003)
│   │   ├── SchedulingService/                 # Quartz cron polling (port 5004)
│   │   ├── InvalidRecordsService/             # Invalid record CRUD + revalidation (port 5007)
│   │   ├── FileProcessorService/              # Format conversion (port 5008)
│   │   ├── FileProcessorService.Tests/        # Test project
│   │   ├── FileDiscoveryService/              # File polling worker
│   │   ├── OutputService/                     # Multi-destination output (port 5009)
│   │   └── DataSourceChatService/             # Optional AI assistant API
│   └── Frontend/                              # React 19 + Vite SPA (port 7000)
│       ├── src/
│       │   ├── pages/                         # Route components (Dashboard, datasources, monitoring, schema, …)
│       │   ├── components/                    # Reusable components (datasource, metrics, schema, layout, shared)
│       │   ├── services/                      # API client modules (one per backend feature)
│       │   ├── hooks/                         # `useEntitySync`, `useMonitoringHub`, `useOptimisticMutation`, …
│       │   ├── api/                           # Cross-cutting API clients
│       │   ├── utils/                         # Schema validators, file analyzers, helpers
│       │   ├── types/                         # TypeScript types (api.ts, entities.ts, forms.ts, monitoring.types.ts)
│       │   ├── i18n/                          # i18next setup + locales (he, en)
│       │   ├── config/                        # App config (`version.ts`)
│       │   ├── App.tsx                        # Router + ConfigProvider + QueryClient root
│       │   └── index.tsx                      # ReactDOM bootstrap
│       ├── tests/
│       │   ├── e2e/                           # Playwright sanity specs
│       │   └── webapp-testing/                # Python Playwright comprehensive scripts
│       ├── public/
│       ├── playwright.config.ts
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       └── Dockerfile
├── tests/                                     # Backend test projects (xUnit, .NET)
│   ├── DataSourceManagement.Tests/
│   ├── IntegrationTests/
│   ├── InvalidRecordsService.Tests/
│   ├── MetricsConfiguration.Tests/
│   ├── OutputService.Tests/
│   ├── SchedulingService.Tests/
│   ├── Shared.Tests/
│   ├── ValidationService.Tests/
│   └── performance/                           # Python perf/CRUD verification scripts
├── tools/                                     # Auxiliary .NET tools + scripts
│   ├── DemoDataGenerator/
│   ├── E2EDataSourceGenerator/
│   ├── HazelcastReset/
│   ├── KafkaMessageExtractor/
│   ├── ServiceOrchestrator/
│   └── TestDataGenerator/
├── docker/                                    # Dockerfiles for every image
│   ├── DataSourceManagementService.Dockerfile
│   ├── FileDiscoveryService.Dockerfile
│   ├── … (one per service)
│   └── nginx.conf
├── release-package/                           # Authoritative k8s manifests for releases
│   └── k8s/
│       ├── configmaps/                        # services-config.yaml, prometheus-* configs
│       ├── deployments/                       # One deployment per microservice + sidecars
│       ├── infrastructure/                    # MongoDB, Kafka, Hazelcast, Prometheus, Grafana, Elasticsearch
│       ├── services/                          # all-services.yaml, frontend-nodeport.yaml
│       ├── ingress/                           # ez-platform-ingress.yaml
│       ├── jobs/                              # demo-data-generator.yaml
│       ├── namespace.yaml                     # `ez-platform` namespace
│       ├── network-policies.yaml              # Default deny + explicit allows
│       └── ocp-routes.yaml                    # OpenShift routes
├── deployment-v0.1.1-rc3-20260112-125216/     # Frozen prior-release k8s snapshot
├── scripts/                                   # PowerShell deployment + dev scripts
│   ├── start-port-forwards.ps1                # CRITICAL: configures all 18 port forwards
│   ├── bootstrap-k8s-cluster.ps1
│   ├── build-all-images.ps1                   # also .sh variant
│   ├── deploy-local-rc3.ps1
│   ├── export-images-*.ps1
│   ├── assemble-package.ps1                   # also .sh variant
│   └── ci-local.sh
├── docs/                                      # Project documentation
│   ├── architecture/                          # ARCHITECTURE.md, SYSTEM-ARCHITECTURE.md, HTML diagrams
│   ├── admin/                                 # Admin operations
│   ├── archive/                               # Archived material
│   ├── planning/                              # MVP plan, deployment plan
│   ├── data_processing_prd.md
│   ├── PROJECT_STANDARDS.md
│   └── COMPREHENSIVE-PROJECT-ANALYSIS.md
├── .planning/                                 # GSD planning workspace
│   ├── PROJECT.md
│   ├── REQUIREMENTS.md
│   ├── ROADMAP.md
│   ├── MILESTONES.md
│   ├── STATE.md
│   ├── codebase/                              # ← Output of `/gsd-map-codebase` (this directory)
│   ├── phases/                                # Phase plans (01-* through 32-*)
│   ├── milestones/
│   ├── debug/
│   ├── research/
│   └── todos/
├── test-data/                                 # CSV/Excel/JSON test inputs (E2E-001 … LoadTest-10000)
├── sample-data/                               # Sample Hebrew datasource JSON
├── test-files/                                # Misc fixture files
├── test-results/                              # Generated test artifacts
├── design-artifacts/
├── publish/                                   # `dotnet publish` output
├── dist/                                      # Distribution artifacts
├── deploy/                                    # Deployment helpers
├── DataProcessingPlatform.sln                 # Visual Studio solution
├── Directory.Build.props                      # MSBuild defaults for all projects
├── Directory.Packages.props                   # Central NuGet version management
├── global.json                                # .NET SDK pin
├── docker-compose.development.yml             # Local-only compose
├── start-all-services.ps1
├── stop-all-services.ps1
├── CLAUDE.md                                  # Project instructions for AI tooling
├── README.md
└── CHANGELOG.md
```

## Directory Purposes

**`src/Services/Shared/`:**
- Purpose: Shared kernel referenced by every microservice (via `ProjectReference` to `DataProcessing.Shared.csproj`)
- Contains: Base classes, message contracts, connectors, converters, telemetry, configuration extensions
- Key files: `Entities/DataProcessingBaseEntity.cs`, `Consumers/DataProcessingConsumerBase.cs`, `Messages/IDataProcessingMessage.cs`, `Connectors/ConnectorFactory.cs`, `Configuration/MassTransitConfiguration.cs`

**`src/Services/*Service/` (each microservice):**
- Purpose: One bounded context per service, deployable as a separate Kubernetes pod
- Contains: `Program.cs` (entry point), `Controllers/` (HTTP), `Services/` (business logic), `Repositories/` (MongoDB), `Consumers/` (events), `Jobs/` (Quartz), `Models/` (DTOs), `Hubs/` (SignalR where applicable), `appsettings.json`, `Dockerfile`
- Key files: `Program.cs`, `*.csproj`

**`src/Services/*Service.Tests/`:**
- Purpose: xUnit integration tests for the matching service
- Contains: `*Tests.cs` files, fixtures, test helpers

**`src/Frontend/src/pages/`:**
- Purpose: Top-level route components, lazy-loaded by `App.tsx`
- Contains: Subdirectories per feature (`datasources/`, `metrics/`, `schema/`, `monitoring/`, `admin/`, `invalid-records/`, `validation/`, `alerts/`, `ai-assistant/`, `help/`, `notifications/`)
- Key files: `Dashboard.tsx`, `datasources/DataSourceList.tsx`, `monitoring/SystemMonitoring.tsx`

**`src/Frontend/src/components/`:**
- Purpose: Reusable React components grouped by feature
- Contains: `datasource/`, `metrics/`, `schema/`, `invalid-records/`, `layout/`, `shared/`
- Key files: `layout/AppHeader.tsx`, `layout/AppSidebar.tsx`, `shared/DataTable.tsx`, `shared/ErrorBoundary.tsx`

**`src/Frontend/src/services/`:**
- Purpose: REST clients (`fetch`) — one module per backend feature
- Contains: `dashboard-api-client.ts`, `metrics-api-client.ts`, `schema-api-client.ts`, `nas-devices-api-client.ts`, `servers-api-client.ts`, `invalidrecords-api-client.ts`, `categories-api-client.ts`, `health-status-api-client.ts`, plus `queryKeys.ts` (React Query key constants)

**`src/Frontend/src/hooks/`:**
- Purpose: Custom React hooks
- Contains: `useEntitySync.ts` (global SignalR CRUD sync), `useMonitoringHub.ts` (live cluster state), `useOptimisticMutation.ts`, `useRealtimeSchemaValidation.ts`, `useRevalidationNotifications.ts`

**`src/Frontend/src/utils/`:**
- Purpose: Pure-function helpers (no React)
- Contains: `schemaValidator.ts`, `schemaAutoSuggest.ts`, `schemaExampleGenerator.ts`, `validationErrorTranslator.ts`, `fileAnalyzer/`, `docs-url.ts`

**`src/Frontend/src/i18n/`:**
- Purpose: i18next configuration and translation files
- Contains: `index.ts` (setup), `locales/he.json`, `locales/en.json`, `jsonjoy-hebrew.ts`

**`release-package/k8s/`:**
- Purpose: Authoritative Kubernetes manifests applied by deploy scripts
- Contains: `configmaps/`, `deployments/`, `services/`, `infrastructure/`, `ingress/`, `jobs/`, `namespace.yaml`, `network-policies.yaml`, `ocp-routes.yaml`
- Key files: `deployments/*-deployment.yaml` (one per microservice), `configmaps/services-config.yaml`

**`scripts/`:**
- Purpose: PowerShell + Bash automation for build, package, deploy, port-forward
- Key files: `start-port-forwards.ps1` (mandatory dev tool), `bootstrap-k8s-cluster.ps1`, `deploy-local-rc3.ps1`, `build-all-images.ps1`

**`tools/`:**
- Purpose: Auxiliary .NET console apps and Node/Python scripts for data generation and debugging
- Contains: `DemoDataGenerator/`, `E2EDataSourceGenerator/`, `HazelcastReset/`, `KafkaMessageExtractor/`, `ServiceOrchestrator/`, `TestDataGenerator/`

**`.planning/`:**
- Purpose: GSD (Get Stuff Done) workflow workspace — milestone tracking, phase plans, codebase mapping output
- Contains: `phases/01-*` through `phases/32-*` (sequential implementation phases), `codebase/` (this dir), `milestones/`, `debug/`, `research/`, `todos/`
- Key files: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `MILESTONES.md`, `STATE.md`

**`docs/`:**
- Purpose: Long-form documentation
- Contains: `architecture/` (system diagrams in MD + HTML), `admin/`, `archive/`, `planning/`, root-level status reports
- Key files: `architecture/ARCHITECTURE.md`, `PROJECT_STANDARDS.md`, `data_processing_prd.md`

**`docker/`:**
- Purpose: One Dockerfile per service image plus shared nginx config
- Contains: `*Service.Dockerfile` files, `nginx.conf`

**`test-data/`:**
- Purpose: Pre-staged input files for end-to-end scenarios
- Contains: `E2E-001/`, `E2E-003/`, `E2E-004/`, `E2E-005/`, `E2E-006/`, `LoadTest-100/`, `LoadTest-1000/`, `LoadTest-10000/`, plus generated files

## Key File Locations

**Entry Points:**
- `src/Services/DataSourceManagementService/Program.cs` — primary API + SignalR hub
- `src/Services/MetricsConfigurationService/Program.cs`
- `src/Services/ValidationService/Program.cs`
- `src/Services/SchedulingService/Program.cs`
- `src/Services/InvalidRecordsService/Program.cs`
- `src/Services/FileProcessorService/Program.cs`
- `src/Services/FileDiscoveryService/Program.cs`
- `src/Services/OutputService/Program.cs`
- `src/Services/DataSourceChatService/Program.cs`
- `src/Frontend/src/index.tsx` — React DOM bootstrap
- `src/Frontend/src/App.tsx` — Router root with lazy-loaded pages

**Configuration:**
- `Directory.Build.props` — MSBuild defaults
- `Directory.Packages.props` — central NuGet version management
- `global.json` — .NET SDK version pin
- `src/Services/*Service/appsettings.json` — per-service config (MongoDB, Kafka, RabbitMQ, OTEL endpoint)
- `release-package/k8s/configmaps/services-config.yaml` — runtime config in cluster
- `src/Frontend/vite.config.ts` — frontend build
- `src/Frontend/playwright.config.ts` — E2E test runner

**Core Logic — Shared:**
- `src/Services/Shared/Entities/DataProcessingBaseEntity.cs` — base entity
- `src/Services/Shared/Consumers/DataProcessingConsumerBase.cs` — consumer base
- `src/Services/Shared/Messages/IDataProcessingMessage.cs` — message contract
- `src/Services/Shared/Connectors/ConnectorFactory.cs` — connector selection
- `src/Services/Shared/Configuration/MassTransitConfiguration.cs` — Kafka topic conventions
- `src/Services/Shared/Configuration/OpenTelemetryConfiguration.cs` — OTLP pipeline
- `src/Services/Shared/Configuration/LoggingConfiguration.cs` — Serilog setup
- `src/Services/Shared/Monitoring/BusinessMetrics.cs` — 20 business metrics

**Core Logic — Frontend:**
- `src/Frontend/src/App.tsx` — router, ConfigProvider (RTL), QueryClient
- `src/Frontend/src/hooks/useEntitySync.ts` — global SignalR CRUD sync
- `src/Frontend/src/hooks/useMonitoringHub.ts` — live cluster state

**SignalR Hubs (server side):**
- `src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs` — `/hubs/monitoring`
- `src/Services/InvalidRecordsService/Hubs/InvalidRecordsHub.cs` — invalid-record notifications

**Pipeline Consumers:**
- `src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs`
- `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs`
- `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs`
- `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs`

**Output Handlers:**
- `src/Services/OutputService/Handlers/FolderOutputHandler.cs`
- `src/Services/OutputService/Handlers/FtpOutputHandler.cs`
- `src/Services/OutputService/Handlers/SftpOutputHandler.cs`
- `src/Services/OutputService/Handlers/S3OutputHandler.cs`
- `src/Services/OutputService/Handlers/KafkaOutputHandler.cs`
- `src/Services/OutputService/Handlers/HttpOutputHandler.cs`

**Testing:**
- `tests/*.Tests/` — xUnit backend test projects
- `src/Frontend/tests/e2e/` — Playwright E2E (`sanity.spec.ts`)
- `src/Frontend/tests/webapp-testing/` — Python Playwright deep-UI tests
- `src/Frontend/playwright.config.ts` — baseURL http://localhost:7000

## Naming Conventions

**.NET projects (`.csproj`):**
- Pattern: `DataProcessing.<ServiceArea>.csproj`
- Examples: `DataProcessing.Shared.csproj`, `DataProcessing.DataSourceManagement.csproj`, `DataProcessing.Validation.csproj`, `DataProcessing.FileDiscovery.csproj`, `DataProcessing.FileProcessor.csproj`, `DataProcessing.Output.csproj`, `DataProcessing.Scheduling.csproj`, `DataProcessing.Chat.csproj`
- Exceptions: `InvalidRecordsService.csproj` and `MetricsConfigurationService.csproj` use service-name-direct naming (legacy)

**Namespaces:**
- Pattern: `DataProcessing.<ServiceArea>[.<Subdir>]`
- Examples: `DataProcessing.Shared.Entities`, `DataProcessing.Shared.Messages`, `DataProcessing.DataSourceManagement.Controllers`, `DataProcessing.Validation.Consumers`, `DataProcessing.Output.Handlers`, `DataProcessing.Scheduling.Jobs`, `DataProcessing.FileDiscovery.Workers`

**Service folders:**
- Pattern: `<ServiceName>Service/` (PascalCase + `Service` suffix)
- Examples: `DataSourceManagementService/`, `ValidationService/`, `FileProcessorService/`, `OutputService/`, `SchedulingService/`, `InvalidRecordsService/`, `MetricsConfigurationService/`, `FileDiscoveryService/`, `DataSourceChatService/`

**Interfaces:**
- Pattern: `I` prefix + capability noun
- Examples: `IDataSourceService`, `IDataSourceRepository`, `IConnectorFactory`, `IDataSourceConnector`, `IFormatConverter`, `IFormatReconstructor`, `IOutputHandler`, `IFileHashService`, `IArchiveService`, `ICredentialResolver`, `IValidationService`, `ISchemaService`

**Service implementations:**
- Pattern: `<Capability>Service` for business-logic classes
- Examples: `DataSourceService`, `CategoryService`, `ServerService`, `NasDeviceService`, `DeviceHealthService`, `ConnectionTestService`, `SchemaService`, `ValidationService`, `RevalidationService`, `CorrectionService`

**Repositories:**
- Pattern: `<Entity>Repository` (implements `I<Entity>Repository`)
- Examples: `DataSourceRepository`, `SchemaRepository`, `MetricRepository`, `GlobalAlertRepository`, `InvalidRecordRepository`

**Consumers:**
- Pattern: `<Event>Consumer` (e.g., `<Verb><Subject>EventConsumer`)
- Examples: `FilePollingEventConsumer`, `FileDiscoveredEventConsumer`, `ValidationRequestEventConsumer`, `ValidationCompletedEventConsumer`, `DataSourceCreatedConsumer`, `DataSourceUpdatedConsumer`, `DataSourceDeletedConsumer`, `SchemaUpdatedEventConsumer`, `PipelineEventConsumer`

**Events / Messages:**
- Pattern: `<Verb-ed-or-Subject>Event` implementing `IDataProcessingMessage`
- Examples: `FilePollingEvent`, `FileDiscoveredEvent`, `FileProcessingCompletedEvent`, `FileProcessingFailedEvent`, `ValidationRequestEvent`, `ValidationCompletedEvent`, `DataSourceCreatedEvent`, `DataSourceUpdatedEvent`, `DataSourceDeletedEvent`, `SchemaUpdatedEvent`
- Request/response pair: `GetMetricsConfigurationRequest` / `GetMetricsConfigurationResponse`

**Entities:**
- Pattern: `<Subject>` or `DataProcessing<Subject>` (the latter when the type is shared across services)
- Examples: `DataProcessingBaseEntity`, `DataProcessingDataSource`, `DataProcessingSchema`, `DataProcessingInvalidRecord`, `DataProcessingValidationResult`, `AdminServer`, `NasDevice`, `DataSourceCategory`, `OutputConfiguration`, `ProcessedFileHash`, `ScheduledDataSource`, `DeviceHealthCheckResult`

**Quartz jobs:**
- Pattern: `<Action>Job` implementing `IJob`
- Examples: `DataSourcePollingJob`, `DeviceHealthCheckJob`, `InvalidRecordsTtlPurgeJob`, plus `FileDiscoveryWorker` (legacy `Worker` suffix in `FileDiscoveryService/Workers/`)

**Controllers:**
- Pattern: `<Resource>Controller` with attribute `[Route("api/v1/[controller]")]`
- Examples: `DataSourceController`, `CategoriesController`, `ServersController`, `NasDevicesController`, `SchemaController`, `ConnectionTestController`, `DashboardController`, `HealthStatusController`, `FileOperationsController`, `ArchiveController`, `MetricController`, `MetricDataController`, `GlobalAlertController`, `InvalidRecordController`, `SchedulingController`

**SignalR hubs:**
- Pattern: `<Domain>Hub` inheriting from `Hub`
- Examples: `MonitoringHub`, `InvalidRecordsHub`

**Output handlers:**
- Pattern: `<Destination>OutputHandler` implementing `IOutputHandler`
- Examples: `FolderOutputHandler`, `FtpOutputHandler`, `SftpOutputHandler`, `S3OutputHandler`, `KafkaOutputHandler`, `HttpOutputHandler`

**Connectors:**
- Pattern: `<Protocol>Connector` implementing `IDataSourceConnector`
- Examples: `LocalFileConnector`, `FtpConnector`, `SftpConnector`, `S3Connector`, `NfsConnector`, `SmbConnector`, `HttpApiConnector`, `KafkaConnector`

**Frontend files:**
- React components: PascalCase `.tsx` (e.g., `DataSourceList.tsx`, `SystemMonitoring.tsx`, `AppHeader.tsx`)
- Hooks: `use<Name>.ts` camelCase (e.g., `useEntitySync.ts`, `useMonitoringHub.ts`)
- Services / API clients: kebab-case `.ts` (e.g., `metrics-api-client.ts`, `nas-devices-api-client.ts`)
- Utilities: camelCase `.ts` (e.g., `schemaValidator.ts`, `validationErrorTranslator.ts`)
- Types: camelCase or kebab-case `.ts` (e.g., `api.ts`, `monitoring.types.ts`, `kubernetes.types.ts`, `schema-api.ts`)

**Kafka topics:**
- Pattern: `dataprocessing.<service>.<event>` (lowercase, dot-separated)
- Examples: `dataprocessing.scheduling.filepolling`, `dataprocessing.filesreceiver.validationrequest`, `dataprocessing.validation.completed`, `dataprocessing.global.processingfailed`

**Kubernetes resources:**
- Deployments: `<servicename>-deployment.yaml` (lowercase) — e.g., `datasource-management-deployment.yaml`, `filediscovery-deployment.yaml`, `validation-deployment.yaml`
- Namespace: `ez-platform`

## Where to Add New Code

**New backend microservice:**
- Create `src/Services/<NewName>Service/` with subfolders `Controllers/`, `Services/`, `Repositories/`, `Consumers/`, `Models/`, `Properties/`
- Add `<NewName>Service/Program.cs` following the boilerplate in `src/Services/DataSourceManagementService/Program.cs` (logging → OTEL → MongoDB.Entities → Hazelcast → MassTransit → controllers)
- Project file: `DataProcessing.<Name>.csproj` referencing `../Shared/DataProcessing.Shared.csproj`
- Add Dockerfile: `docker/<NewName>Service.Dockerfile`
- Add k8s deployment: `release-package/k8s/deployments/<lowercase-name>-deployment.yaml`
- Add port-forward entry in `scripts/start-port-forwards.ps1`
- Register in `DataProcessingPlatform.sln`

**New REST endpoint in existing service:**
- Controller: `src/Services/<Service>/Controllers/<Resource>Controller.cs` with `[Route("api/v1/[controller]")]`
- Request/response DTOs: `src/Services/<Service>/Models/Requests/` and `Models/Responses/`
- Business logic: add to or create `src/Services/<Service>/Services/I<Capability>Service.cs` + `<Capability>Service.cs`
- Repository (if persisting new entity): `src/Services/<Service>/Repositories/I<Entity>Repository.cs` + `<Entity>Repository.cs`
- For CRUD endpoints — inject `IHubContext<MonitoringHub>` and broadcast `EntityChanged`; add the entity type to `queryKeyMap` in `src/Frontend/src/hooks/useEntitySync.ts`

**New event / message contract:**
- Add `src/Services/Shared/Messages/<Subject>Event.cs` implementing `IDataProcessingMessage`
- Producer: inject `IPublishEndpoint` and call `Publish`
- Consumer in target service: `src/Services/<Service>/Consumers/<Subject>EventConsumer.cs` extending `DataProcessingConsumerBase<<Subject>Event>` (preferred) or implementing `IConsumer<<Subject>Event>` directly
- Register consumer in target service `Program.cs` via `x.AddConsumer<…>()`
- If high-volume / pipeline: add topic name to `MassTransitConfiguration.ConfigureKafkaTopics` (`src/Services/Shared/Configuration/MassTransitConfiguration.cs`)

**New entity (shared across services):**
- Add `src/Services/Shared/Entities/<Name>.cs` inheriting `DataProcessingBaseEntity`
- Initialize indexes in each service's `Program.cs` where the entity is queried (see DataSourceManagement pattern around `Program.cs:234`)

**New entity (single-service):**
- Add `src/Services/<Service>/Models/` (DTO) or local Entities folder; do not pollute Shared unless cross-service

**New connector / output destination:**
- Connector: `src/Services/Shared/Connectors/<Protocol>Connector.cs` implementing `IDataSourceConnector`; register in `ConnectorFactory.cs`
- Output handler: `src/Services/OutputService/Handlers/<Destination>OutputHandler.cs` implementing `IOutputHandler`; register in `Program.cs` (DI picks it up via `IEnumerable<IOutputHandler>`)

**New format converter:**
- `src/Services/Shared/Converters/<Source>To<Target>Converter.cs` implementing `IFormatConverter`
- Reconstructor counterpart for output: `<Target>To<Source>Reconstructor.cs` implementing `IFormatReconstructor`

**New frontend page:**
- Create `src/Frontend/src/pages/<feature>/<PageName>.tsx`
- Register lazy import in `src/Frontend/src/App.tsx` (alongside the existing `lazy(() => import(...))` calls)
- Add route in the `Routes` element of `App.tsx`
- Add sidebar entry in `src/Frontend/src/components/layout/AppSidebar.tsx`
- Add translation keys to `src/Frontend/src/i18n/locales/he.json` and `en.json`

**New frontend reusable component:**
- Pick the right folder: `components/datasource/`, `components/metrics/`, `components/schema/`, `components/invalid-records/`, `components/layout/`, or `components/shared/` (only generic primitives)
- For form parts of the 7-tab datasource form, place in `components/datasource/tabs/`

**New API client:**
- `src/Frontend/src/services/<feature>-api-client.ts` (kebab-case)
- Define types in `src/Frontend/src/types/<feature>.ts`
- Add React Query keys to `src/Frontend/src/services/queryKeys.ts`

**New React hook:**
- `src/Frontend/src/hooks/use<Name>.ts`

**New Quartz job:**
- `src/Services/<Service>/Jobs/<Action>Job.cs` implementing `IJob` with `[DisallowConcurrentExecution]` if the job must not overlap
- Register in `Program.cs` via `builder.Services.AddQuartz(q => q.AddJob<…>())`

**New SignalR hub:**
- `src/Services/<Service>/Hubs/<Name>Hub.cs` inheriting `Hub`
- Register in `Program.cs`: `services.AddSignalR()` then `app.MapHub<…>("/hubs/<name>")`

**New shared utility:**
- Stateless helpers: `src/Services/Shared/Utilities/`
- Cross-cutting middleware: `src/Services/Shared/Middleware/`
- DI extension methods: `src/Services/Shared/Configuration/`

**New Kubernetes manifest:**
- Deployment: `release-package/k8s/deployments/<service>-deployment.yaml` (and mirror to `deployment-v0.1.1-rc3-…` for the frozen release if needed)
- Service: append to `release-package/k8s/services/all-services.yaml`
- Network policy: edit `release-package/k8s/network-policies.yaml`
- Ingress: edit `release-package/k8s/ingress/ez-platform-ingress.yaml`

**New phase plan:**
- `.planning/phases/<NN>-<slug>/` with phase markdown files; follow numbering from the existing 01–32 sequence

## Special Directories

**`release-package/k8s/`:**
- Purpose: Authoritative Kubernetes manifests for the current release; this is what deploy scripts apply
- Generated: No (hand-maintained)
- Committed: Yes

**`deployment-v0.1.1-rc3-20260112-125216/`:**
- Purpose: Frozen snapshot of a prior release's k8s manifests, kept for rollback reference
- Generated: Snapshot from release tooling
- Committed: Yes

**`publish/`:**
- Purpose: Output of `dotnet publish` (DLLs, runtime files)
- Generated: Yes — by build scripts
- Committed: No (per `.gitignore` convention)

**`dist/`:**
- Purpose: Distribution artifacts (compiled frontend, packaged releases)
- Generated: Yes
- Committed: No

**`node_modules/`, `bin/`, `obj/`:**
- Purpose: Package + build output
- Generated: Yes
- Committed: No

**`test-results/`, `playwright-report/`:**
- Purpose: Test runner output
- Generated: Yes (per test run)
- Committed: No

**`tests/performance/`:**
- Purpose: Python scripts for CRUD verification and performance testing (separate from xUnit `.Tests` projects)
- Generated: No (hand-written scripts)
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Output of `/gsd-map-codebase` (this directory) consumed by `/gsd-plan-phase` and `/gsd-execute-phase`
- Generated: Yes — produced by codebase mapper agents
- Committed: Yes

---

*Structure analysis: 2026-05-24*

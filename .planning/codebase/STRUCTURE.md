# Codebase Structure

**Analysis Date:** 2026-02-02

## Directory Layout

```
EZ/
├── src/
│   ├── Services/                              # All backend microservices
│   │   ├── Shared/                            # Shared library (base classes, utilities)
│   │   │   ├── Configuration/                 # DI setup modules
│   │   │   ├── Connectors/                    # Data source connectors (plugins)
│   │   │   ├── Converters/                    # Format converters
│   │   │   ├── Entities/                      # MongoDB entity base classes
│   │   │   ├── Messages/                      # MassTransit event contracts
│   │   │   ├── Consumers/                     # Base consumer class with tracing
│   │   │   ├── Monitoring/                    # Metrics and observability
│   │   │   ├── Middleware/                    # Request middleware
│   │   │   ├── Services/                      # Utility services (archive, cache)
│   │   │   └── Utilities/                     # Helper functions
│   │   ├── DataSourceManagementService/       # Service 1: Data source CRUD
│   │   ├── FileDiscoveryService/              # Service 2: File polling
│   │   ├── FileProcessorService/              # Service 3: File reading/conversion
│   │   ├── ValidationService/                 # Service 4: Schema validation
│   │   ├── OutputService/                     # Service 5: Multi-destination output
│   │   ├── SchedulingService/                 # Service 6: Job scheduling (Quartz)
│   │   ├── MetricsConfigurationService/       # Service 7: Metrics and alerts
│   │   ├── InvalidRecordsService/             # Service 8: Invalid record management
│   │   └── DataSourceChatService/             # Service 9: AI assistant (beta)
│   └── Frontend/                              # React application
│       ├── src/
│       │   ├── pages/                         # Route components
│       │   ├── components/                    # Reusable UI components
│       │   ├── services/                      # API client services
│       │   ├── hooks/                         # Custom React hooks
│       │   ├── types/                         # TypeScript interfaces
│       │   ├── utils/                         # Utility functions
│       │   ├── i18n/                          # Internationalization (Hebrew/English)
│       │   ├── config/                        # Frontend config
│       │   └── App.tsx                        # Root component
│       ├── public/                            # Static assets
│       ├── tests/e2e/                         # Playwright E2E tests
│       └── package.json                       # Frontend dependencies
├── deploy/                                    # Kubernetes manifests
│   ├── kubernetes/                            # K8s resource definitions
│   ├── docker/                                # Docker images
│   ├── helm/                                  # Helm charts
│   ├── prometheus/                            # Prometheus configuration
│   ├── grafana/                               # Grafana dashboards
│   └── otel-collector/                        # OpenTelemetry collector config
├── tools/                                     # Development and utility tools
│   ├── DemoDataGenerator/                     # Generate sample data
│   ├── ServiceOrchestrator/                   # Service lifecycle management
│   ├── E2EDataSourceGenerator/                # Create test data sources
│   ├── KafkaMessageExtractor/                 # Debug Kafka messages
│   └── HazelcastReset/                        # Reset cache
├── tests/                                     # Integration and unit tests
│   ├── IntegrationTests/                      # Full pipeline tests
│   ├── ValidationService.Tests/               # Service-specific tests
│   ├── OutputService.Tests/
│   └── Shared.Tests/
├── docs/                                      # Documentation
│   ├── planning/                              # Implementation plans
│   ├── data_processing_prd.md                 # Product requirements
│   ├── PROJECT_STANDARDS.md                   # Coding standards
│   └── COMPREHENSIVE-PROJECT-ANALYSIS.md      # Detailed analysis
├── scripts/                                   # PowerShell helper scripts
│   ├── start-port-forwards.ps1                # Port forwarding setup
│   ├── bootstrap-k8s-cluster.ps1              # K8s bootstrap
│   └── setup-dev-environment.ps1              # Dev setup
├── test-data/                                 # Test data files
│   └── excel-creator/                         # Excel file generation tool
├── .planning/codebase/                        # GSD codebase analysis docs
├── .vscode/                                   # VS Code settings
├── CLAUDE.md                                  # Project instructions
└── .gitignore                                 # Git ignore rules
```

## Directory Purposes

**src/Services/Shared:**
- Purpose: Reusable code shared across all microservices
- Contains: Base classes, configuration, connectors, converters, entities, events, middleware
- Key files:
  - `Configuration/OpenTelemetryConfiguration.cs` - OTEL setup
  - `Configuration/MassTransitConfiguration.cs` - RabbitMQ/event setup
  - `Consumers/DataProcessingConsumerBase.cs` - Consumer base class
  - `Connectors/IConnectorFactory.cs` - Connector plugin pattern

**src/Services/[ServiceName]/:**
- Purpose: Individual microservice with standard structure
- Contains: Controllers (API), Services (business logic), Repositories (data access), Consumers (event handling)
- Pattern:
  - Controllers inherit from ControllerBase
  - Services are scoped, injected via DI
  - Repositories use MongoDB.Entities
  - Consumers inherit from DataProcessingConsumerBase<T>

**src/Services/DataSourceManagementService:**
- Purpose: Data source CRUD, configuration, schema management
- Key files:
  - `Controllers/DataSourceController.cs` - REST API endpoints
  - `Services/DataSourceService.cs` - Business logic
  - `Services/Schema/SchemaService.cs` - Schema operations
  - `Services/ConnectionTest/ConnectionTestService.cs` - Connection testing
  - `Repositories/DataSourceRepository.cs` - MongoDB queries

**src/Services/FileDiscoveryService:**
- Purpose: Scheduled file polling from data sources
- Key files:
  - `Services/FileDiscoveryService.cs` - Main polling logic
  - Uses `IDataSourceConnector` to list files
  - Publishes `FileDiscoveredEvent` for each file
  - Tracks processed hashes for deduplication

**src/Services/FileProcessorService:**
- Purpose: File reading, format conversion, caching
- Key files:
  - `Consumers/FileDiscoveredEventConsumer.cs` - Event handler
  - Uses connectors to read files
  - Uses converters to transform to JSON
  - Caches JSON in Hazelcast
  - Publishes `ValidationRequestEvent`

**src/Services/ValidationService:**
- Purpose: Schema validation, record splitting
- Key files:
  - `Consumers/ValidationRequestEventConsumer.cs` - Event handler
  - `Services/ValidationService.cs` - Corvus.Json.Validator integration
  - Stores `DataProcessingValidationResult` entities
  - Publishes `ValidationCompletedEvent`

**src/Services/OutputService:**
- Purpose: Data reconstruction and multi-destination output
- Key files:
  - `Consumers/ValidationCompletedEventConsumer.cs` - Event handler
  - `Handlers/` - Output handler implementations (Kafka, Folder, SFTP, HTTP, S3, FTP)
  - `Services/FormatReconstructorService.cs` - Format conversion
  - Routes to multiple output destinations

**src/Services/SchedulingService:**
- Purpose: Quartz.NET job scheduling for file polling
- Key files:
  - `Jobs/FilePollingJob.cs` - Scheduled job definition
  - Triggers FileDiscoveryService at cron intervals

**src/Services/MetricsConfigurationService:**
- Purpose: Metrics and alert rule management
- Key files:
  - `Controllers/MetricsController.cs` - API endpoints
  - `Services/MetricsService.cs` - Metrics CRUD
  - Stores PromQL queries and thresholds

**src/Services/InvalidRecordsService:**
- Purpose: Invalid record management and analysis
- Key files:
  - `Controllers/InvalidRecordsController.cs` - API endpoints
  - `Repositories/InvalidRecordRepository.cs` - MongoDB queries
  - Stores and retrieves invalid record details

**src/Frontend/src:**
- Purpose: React user interface
- Contains: Pages, components, services, hooks, utilities

**src/Frontend/src/pages:**
- Purpose: Route components for each major feature
- Key files:
  - `datasources/DataSourceList.tsx` - Data source list view
  - `datasources/DataSourceForm.tsx` - Create/edit data source
  - `schema/SchemaManagement.tsx` - Schema management
  - `metrics/MetricConfigurationWizard.tsx` - Metrics and alerts
  - `validation/ValidationResults.tsx` - Validation results view
  - `invalid-records/InvalidRecordsManagement.tsx` - Invalid records
  - `monitoring/SystemMonitoring.tsx` - System status

**src/Frontend/src/components:**
- Purpose: Reusable UI components
- Subfolders:
  - `datasource/` - Data source UI components
  - `schema/` - Schema builder components
  - `metrics/` - Metrics configuration components
  - `layout/` - Header, sidebar, footer
  - `shared/` - Common components (ErrorBoundary, LoadingState, etc.)

**src/Frontend/src/services:**
- Purpose: API client services for backend communication
- Key files:
  - `queryKeys.ts` - React Query cache keys
  - `datasources-api-client.ts` - Data source API calls
  - `schema-api-client.ts` - Schema API calls
  - `metrics-api-client.ts` - Metrics API calls
  - `invalidrecords-api-client.ts` - Invalid records API calls

**deploy/kubernetes:**
- Purpose: Kubernetes resource definitions
- Contains: Deployments, services, configmaps, StatefulSets
- Key files:
  - `configmaps/services-config.yaml` - Service configuration
  - `deployments/` - Microservice deployments
  - `infrastructure/` - MongoDB, Kafka, Hazelcast, etc.
  - `services/` - Service definitions for networking

**tests/:**
- Purpose: Integration and unit tests
- Contains:
  - `IntegrationTests/` - Full pipeline E2E tests
  - `ValidationService.Tests/` - Validation service tests
  - `OutputService.Tests/` - Output service tests
  - `Shared.Tests/` - Shared library tests

**tools/:**
- Purpose: Development and debugging tools
- Key tools:
  - `DemoDataGenerator/` - Creates sample data sources and test data
  - `ServiceOrchestrator/` - Manages service lifecycle (start/stop/restart)
  - `E2EDataSourceGenerator/` - Creates test data sources with demo files
  - `KafkaMessageExtractor/` - Extracts Kafka messages for debugging
  - `HazelcastReset/` - Clears Hazelcast cache

## Key File Locations

**Entry Points:**
- Backend services: `src/Services/[ServiceName]/Program.cs` (ASP.NET Core bootstrap)
- Frontend: `src/Frontend/src/main.tsx` or `src/Frontend/src/index.tsx` (React entry)
- Tests: `tests/IntegrationTests/Hooks/SetupHook.cs` (test bootstrap)

**Configuration:**
- Service DI setup: `src/Services/Shared/Configuration/*.cs` (8 files for different concerns)
- Frontend env config: `src/Frontend/src/config/`
- Kubernetes config: `deploy/kubernetes/configmaps/services-config.yaml`
- Docker builds: `src/Services/[ServiceName]/Dockerfile`

**Core Logic:**
- Data source management: `src/Services/DataSourceManagementService/Services/DataSourceService.cs`
- File discovery: `src/Services/FileDiscoveryService/Services/FileDiscoveryService.cs`
- Format conversion: `src/Services/Shared/Converters/` (CSV, XML, Excel, JSON)
- Schema validation: `src/Services/ValidationService/Services/ValidationService.cs`
- Message publishing: `src/Services/Shared/Configuration/MassTransitConfiguration.cs`
- Connector plugin system: `src/Services/Shared/Connectors/ConnectorFactory.cs`

**Testing:**
- Integration tests: `tests/IntegrationTests/` (full pipeline)
- Service-specific tests: `tests/[ServiceName].Tests/`
- E2E playwright: `src/Frontend/tests/e2e/` (user workflows)

## Naming Conventions

**Files:**
- Services: `[Feature]Service.cs` (e.g., `DataSourceService.cs`, `ValidationService.cs`)
- Controllers: `[Resource]Controller.cs` (e.g., `DataSourceController.cs`)
- Consumers: `[Event]Consumer.cs` (e.g., `FileDiscoveredEventConsumer.cs`)
- Repositories: `[Entity]Repository.cs` (e.g., `DataSourceRepository.cs`)
- Models: Request = `Create/Update[Entity]Request.cs`, Response = `[Entity]Response.cs`
- React components: `[ComponentName].tsx` (PascalCase, e.g., `DataSourceList.tsx`)
- API clients: `[feature]-api-client.ts` (kebab-case, e.g., `datasources-api-client.ts`)

**Directories:**
- Services: PascalCase folder per service (e.g., `DataSourceManagementService`)
- Components: lowercase folders by feature (e.g., `datasource/`, `schema/`, `metrics/`)
- Configuration modules: lowercase with scope (e.g., `configuration/`, `connectors/`)

**C# Classes:**
- Entities: `DataProcessing[Feature]` or `[Feature]` (e.g., `DataProcessingDataSource`)
- Events: `[Action]Event` (e.g., `FileDiscoveredEvent`, `ValidationCompletedEvent`)
- Services: `I[Name]Service` (interface), `[Name]Service` (implementation)
- Consumers: `[Event]Consumer` (e.g., `FileDiscoveredEventConsumer`)
- Repositories: `I[Entity]Repository` (interface), `[Entity]Repository` (implementation)

**Namespaces:**
- Pattern: `DataProcessing.[ServiceArea]` (e.g., `DataProcessing.DataSourceManagement`, `DataProcessing.Validation`)
- Shared: `DataProcessing.Shared.[Module]` (e.g., `DataProcessing.Shared.Configuration`)

**React Patterns:**
- Custom hooks: `use[HookName].ts` (e.g., `useDataSources.ts`, `useMetrics.ts`)
- Context providers: `[Feature]Provider.tsx`
- API response types: `IApiResponse`, `IPagedResult` (I prefix for interfaces)

## Where to Add New Code

**New Feature (e.g., Add new data source type):**
- Primary code: `src/Services/DataSourceManagementService/Services/[Feature]Service.cs`
- Controller: `src/Services/DataSourceManagementService/Controllers/[Feature]Controller.cs`
- Repository: `src/Services/DataSourceManagementService/Repositories/[Feature]Repository.cs`
- Entity: `src/Services/Shared/Entities/DataProcessing[Feature].cs` (if shared)
- Tests: `tests/IntegrationTests/[Feature]Tests.cs`

**New Connector (e.g., Add GCS file source):**
- Implementation: `src/Services/Shared/Connectors/GcsConnector.cs`
- Inherit from: `IDataSourceConnector` interface
- Register in: `src/Services/Shared/Connectors/ConnectorFactory.cs` (add factory method)
- DI registration: Services.AddScoped<GcsConnector>() in Program.cs where needed

**New Converter (e.g., Add YAML conversion):**
- Implementation: `src/Services/Shared/Converters/YamlToJsonConverter.cs` (extends `IConverter` pattern)
- Registration: Add to DI in services needing it (FileProcessorService, OutputService)
- Usage: Converter selection by file extension in FileProcessorService

**New Output Handler (e.g., Add BigQuery output):**
- Implementation: `src/Services/OutputService/Handlers/BigQueryOutputHandler.cs`
- Inherit from: `IOutputHandler`
- Register in: `OutputService/Program.cs` - `services.AddScoped<IOutputHandler, BigQueryOutputHandler>()`
- Configuration: Add handler type to OutputConfiguration entity

**New API Endpoint:**
- Controller method: `src/Services/[ServiceName]/Controllers/[Controller].cs`
- Route: `[HttpGet/Post/Put/Delete("api/v1/[route]")]`
- DTO models: `src/Services/[ServiceName]/Models/Requests/*.cs` and `Responses/*.cs`
- Service method: `src/Services/[ServiceName]/Services/[Service].cs`
- Documentation: XML comments with `<summary>`, `<response>` tags

**New Message Event (e.g., Add pipeline completion event):**
- Contract: `src/Services/Shared/Messages/[Event]Event.cs`
- Implements: `IDataProcessingMessage`
- Consumer: `src/Services/[ServiceName]/Consumers/[Event]Consumer.cs`
- Extends: `DataProcessingConsumerBase<[Event]Event>`
- Override: `ProcessMessage()` method with event handling logic
- Registration: Add to MassTransit config in consuming service's Program.cs

**New React Page:**
- File: `src/Frontend/src/pages/[feature]/[Page].tsx`
- Route: Add route to `src/Frontend/src/App.tsx` in Routes section
- API client: Create or extend `src/Frontend/src/services/[feature]-api-client.ts`
- Components: Reusable UI in `src/Frontend/src/components/[feature]/`
- Query keys: Add to `src/Frontend/src/services/queryKeys.ts`

**New React Component:**
- File: `src/Frontend/src/components/[feature]/[Component].tsx`
- Type: Create interfaces in `src/Frontend/src/types/[feature].ts` or inline
- Props: Use TypeScript interfaces for type safety
- Query hooks: Use `queryKeys` pattern with React Query (TanStack)
- Styling: Ant Design components + CSS modules when needed

**Utilities/Helpers:**
- Shared C# utils: `src/Services/Shared/Utilities/[Utility].cs`
- Service-specific utils: `src/Services/[ServiceName]/[Utility].cs`
- Frontend utils: `src/Frontend/src/utils/[utility].ts`

## Special Directories

**src/Services/Shared/Configuration:**
- Purpose: Dependency injection setup modules
- Generated: No (source)
- Committed: Yes
- Key files:
  - `OpenTelemetryConfiguration.cs` - OTEL metrics, traces, logs setup
  - `MassTransitConfiguration.cs` - RabbitMQ and event topics
  - `DatabaseConfiguration.cs` - MongoDB.Entities init
  - `HazelcastConfiguration.cs` - Hazelcast client with resilience
  - `LoggingConfiguration.cs` - Serilog setup with OTEL
  - `HealthCheckConfiguration.cs` - Service health endpoints

**src/Services/Shared/Messages:**
- Purpose: MassTransit event contracts
- Generated: No
- Committed: Yes
- Pattern: All events implement `IDataProcessingMessage` with CorrelationId, Timestamp, PublishedBy, MessageVersion

**deploy/kubernetes:**
- Purpose: K8s manifests for cluster deployment
- Generated: No
- Committed: Yes
- Contains: All resource definitions for services, infrastructure, networking

**tools/:**
- Purpose: Development and operational tools
- Generated: Tool outputs go to separate folders (e.g., `deploy/` for deployment artifacts)
- Committed: Yes (source code), No (generated output)
- Each tool is a separate .csproj

**test-data/**
- Purpose: Sample data for testing
- Generated: Some files generated by DemoDataGenerator
- Committed: Base test data committed, generated data in .gitignore

**.planning/codebase/**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by GSD mapping command)
- Committed: Yes
- Files: ARCHITECTURE.md, STRUCTURE.md, STACK.md, INTEGRATIONS.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

---

*Structure analysis: 2026-02-02*

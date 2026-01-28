# Codebase Structure

**Analysis Date:** 2026-01-28

## Directory Layout

```
EZ/
├── src/
│   ├── Services/                                # Backend microservices
│   │   ├── Shared/                              # Shared library (DI, logging, monitoring, etc.)
│   │   │   ├── Configuration/                   # Dependency injection setup
│   │   │   ├── Connectors/                      # Data source protocol implementations
│   │   │   ├── Converters/                      # Format converters (CSV, JSON, XML, Excel)
│   │   │   ├── Entities/                        # Base classes and domain models
│   │   │   ├── Messages/                        # Kafka event contracts
│   │   │   ├── Consumers/                       # Base consumer for MassTransit
│   │   │   ├── Middleware/                      # Authentication, correlation ID, logging
│   │   │   └── Monitoring/                      # Metrics collectors, business metrics
│   │   ├── DataSourceManagementService/        # Data source CRUD and management
│   │   │   ├── Controllers/                     # 6 REST endpoints (DataSource, Schema, Server, Category, etc.)
│   │   │   ├── Services/                        # Business logic (DataSourceService, etc.)
│   │   │   ├── Repositories/                    # MongoDB data access
│   │   │   ├── Models/                          # Request/Response DTOs
│   │   │   ├── Data/                            # Seeders for categories
│   │   │   ├── Infrastructure/                  # Configuration helpers
│   │   │   └── Program.cs                       # Service entry point
│   │   ├── ValidationService/                   # Schema validation
│   │   ├── FileProcessorService/                # Format conversion and file processing
│   │   ├── FileDiscoveryService/                # File polling and discovery
│   │   ├── SchedulingService/                   # Quartz.NET job scheduling
│   │   ├── OutputService/                       # Multi-destination output routing
│   │   ├── MetricsConfigurationService/         # Business metrics and PromQL
│   │   ├── InvalidRecordsService/               # Invalid record management
│   │   └── DataSourceChatService/               # AI assistant (optional)
│   └── Frontend/                                # React application
│       ├── src/
│       │   ├── pages/                           # Route components (Dashboard, DataSources, Schema, Metrics, etc.)
│       │   │   ├── datasources/                 # DataSourceList, DataSourceForm, DataSourceEdit, Details
│       │   │   ├── schema/                      # SchemaManagement, SchemaBuilder, SchemaEditor
│       │   │   ├── metrics/                     # MetricConfigurationWizard, AlertsManagement
│       │   │   ├── validation/                  # ValidationResults
│       │   │   ├── monitoring/                  # SystemMonitoring (Grafana dashboard)
│       │   │   ├── invalid-records/             # InvalidRecordsManagement
│       │   │   ├── alerts/                      # AlertsManagement
│       │   │   ├── ai-assistant/                # AIAssistant
│       │   │   ├── admin/                       # AdminSettings, ServerManagement
│       │   │   ├── help/                        # HelpPage, documentation
│       │   │   ├── notifications/               # NotificationsPage
│       │   │   └── Dashboard.tsx                # Main dashboard
│       │   ├── components/                      # Reusable React components
│       │   │   ├── datasource/                  # DataSource forms, tabs, modals
│       │   │   │   ├── tabs/                    # Form tabs (BasicInfo, Connection, Schedule, Schema, etc.)
│       │   │   │   ├── modals/                  # Dialogs (DestinationEditor, etc.)
│       │   │   │   └── details/                 # Detail views and related data
│       │   │   ├── schema/                      # Schema editor, regex helper, templates
│       │   │   ├── metrics/                     # Metric builders, alert expressions, filters
│       │   │   ├── invalid-records/             # Invalid record handling components
│       │   │   ├── layout/                      # AppHeader, AppSidebar, AppFooter
│       │   │   ├── shared/                      # Common utilities (ErrorBoundary, LoadingState)
│       │   │   └── SplashScreen.tsx             # Loading splash screen
│       │   ├── services/                        # API client services
│       │   │   ├── datasource-api-client.ts    # DataSource API methods
│       │   │   ├── schema-api-client.ts         # Schema API methods
│       │   │   ├── metrics-api-client.ts        # Metrics API methods
│       │   │   ├── invalidrecords-api-client.ts # Invalid records API
│       │   │   ├── categories-api-client.ts     # Categories API
│       │   │   ├── servers-api-client.ts        # Server management API
│       │   │   ├── dashboard-api-client.ts      # Dashboard data API
│       │   │   ├── connection-test-api-client.ts # Connection test API
│       │   │   └── queryKeys.ts                 # React Query key factory
│       │   ├── hooks/                           # Custom React hooks
│       │   ├── utils/                           # Utilities (schema validation, data generation, formatting)
│       │   ├── types/                           # TypeScript interfaces and types
│       │   ├── i18n/                            # Internationalization (en, he)
│       │   ├── api/                             # Deprecated or legacy API clients
│       │   ├── config/                          # Frontend configuration
│       │   ├── App.tsx                          # Root component with routing
│       │   ├── App.css                          # Global styles
│       │   └── index.tsx                        # React DOM mount
│       ├── tests/e2e/                           # Playwright E2E tests
│       ├── public/                              # Static assets
│       ├── Dockerfile                           # Frontend container image
│       ├── nginx.conf                           # NGINX configuration
│       ├── vite.config.ts                       # Vite build configuration
│       ├── tsconfig.json                        # TypeScript configuration
│       └── package.json                         # Dependencies
├── k8s/                                         # Kubernetes manifests
│   ├── namespace.yaml                           # ez-platform namespace
│   ├── configmaps/                              # Service configuration (services-config.yaml)
│   ├── deployments/                             # Microservice deployments
│   │   ├── datasource-management.yaml
│   │   ├── validation.yaml
│   │   ├── file-processor.yaml
│   │   ├── file-discovery.yaml
│   │   ├── scheduling.yaml
│   │   ├── output.yaml
│   │   ├── metrics-configuration.yaml
│   │   ├── invalid-records.yaml
│   │   ├── frontend.yaml
│   │   └── datasource-chat.yaml
│   ├── infrastructure/                          # Database, broker, monitoring
│   │   ├── mongodb.yaml                         # MongoDB Replica Set
│   │   ├── kafka.yaml                           # Kafka cluster
│   │   ├── rabbitmq.yaml                        # RabbitMQ message broker
│   │   ├── hazelcast.yaml                       # Distributed cache
│   │   ├── prometheus-system.yaml               # System metrics
│   │   ├── prometheus-business.yaml             # Business metrics
│   │   ├── grafana.yaml                         # Monitoring dashboard
│   │   ├── elasticsearch.yaml                   # Log storage
│   │   ├── jaeger.yaml                          # Distributed tracing
│   │   ├── otel-collector.yaml                  # OpenTelemetry collector
│   │   ├── fluent-bit.yaml                      # Log forwarding
│   │   └── zookeeper.yaml                       # Kafka coordination
│   ├── services/                                # Service definitions
│   ├── ingress/                                 # Ingress routing rules
│   ├── network-policies.yaml                    # Network access control
│   ├── ocp-routes.yaml                          # OpenShift routes (OCP compatibility)
│   └── README.md                                # Kubernetes deployment guide
├── scripts/                                     # Utility scripts
│   ├── start-port-forwards.ps1                  # PORT FORWARDING (CRITICAL)
│   ├── bootstrap-k8s-cluster.ps1                # Cluster initialization
│   └── setup-dev-environment.ps1                # Dev environment setup
├── docs/                                        # Documentation
│   ├── PROJECT_STANDARDS.md                     # Architecture and standards
│   ├── COMPREHENSIVE-PROJECT-ANALYSIS.md       # Detailed analysis
│   ├── data_processing_prd.md                   # Product requirements
│   └── planning/                                # Implementation plans
├── tools/                                       # Development tools
│   ├── DemoDataGenerator/                       # Demo data generation
│   └── ServiceOrchestrator/                     # Service lifecycle management
├── docker/                                      # Docker compose files
├── test-data/                                   # Test data files
├── DataProcessingPlatform.sln                   # .NET solution file
├── Directory.Build.props                        # Common .NET properties
├── Directory.Packages.props                     # Central package versions
└── CLAUDE.md                                    # Project instructions (CRITICAL)
```

## Directory Purposes

**src/Services/Shared/:**
- Purpose: Cross-cutting concerns and reusable utilities shared by all microservices
- Contains:
  - `Configuration/`: Service registration helpers (AddDataProcessingOpenTelemetry, AddResilientHazelcast, etc.)
  - `Connectors/`: Protocol handlers (FTP, SFTP, Local, Kafka, HTTP, AdminServer)
  - `Converters/`: Format transformers (CSV, JSON, XML, Excel)
  - `Entities/`: Base entity class (DataProcessingBaseEntity) and domain models
  - `Messages/`: Kafka event contracts (FilePollingEvent, ValidationRequestEvent, etc.)
  - `Consumers/`: Base consumer class for MassTransit message handling
  - `Middleware/`: HTTP middleware for correlation ID, authentication, logging
  - `Monitoring/`: BusinessMetrics counters and histograms

**src/Frontend/src/pages/:**
- Purpose: Route-level components corresponding to main application sections
- Each subdirectory represents a feature area with its own page components

**src/Frontend/src/components/:**
- Purpose: Reusable React components used across multiple pages
- Organized by feature (datasource, schema, metrics) not by component type
- Shared folder: Common components (ErrorBoundary, LoadingState, modals)

**src/Frontend/src/services/:**
- Purpose: API client service layer
- Each file handles HTTP calls to a specific backend service
- queryKeys.ts: React Query key factory for cache management

**k8s/infrastructure/:**
- Purpose: Infrastructure components (stateful services)
- MongoDB: Data persistence (3-node replica set for HA)
- Kafka: Event streaming (3-broker cluster)
- RabbitMQ: Message broker for MassTransit
- Hazelcast: Distributed in-memory cache
- OTEL Collector: Telemetry ingestion and routing
- Prometheus (dual): System + Business metrics
- Grafana, Elasticsearch, Jaeger: Observability stack

## Key File Locations

**Entry Points:**
- `src/Services/DataSourceManagementService/Program.cs`: Main API service startup
- `src/Services/[ServiceName]/Program.cs`: Other microservice startups
- `src/Frontend/src/index.tsx`: React DOM mount
- `src/Frontend/src/App.tsx`: Root component with routing setup

**Configuration:**
- `appsettings.json`: Service configuration (per-service)
- `appsettings.Development.json`: Development overrides
- `k8s/configmaps/services-config.yaml`: Kubernetes ConfigMap for all services
- `src/Frontend/.env` or environment variables: Frontend API base URL

**Core Logic:**
- `src/Services/Shared/Configuration/`: Dependency injection setup
- `src/Services/DataSourceManagementService/Services/DataSourceService.cs`: Data source business logic
- `src/Services/ValidationService/Services/ValidationService.cs`: Validation logic
- `src/Services/FileProcessorService/Services/FileProcessorService.cs`: Format conversion
- `src/Services/OutputService/Services/OutputService.cs`: Output routing

**Testing:**
- `src/Frontend/tests/e2e/`: Playwright E2E tests
- `src/Services/[ServiceName].Tests/`: .NET integration tests (if applicable)

## Naming Conventions

**Files:**
- Controllers: `[Entity]Controller.cs` (e.g., `DataSourceController.cs`)
- Services: `I[Entity]Service.cs` (interface), `[Entity]Service.cs` (implementation)
- Repositories: `I[Entity]Repository.cs` (interface), `[Entity]Repository.cs` (implementation)
- Consumers: `[Event]Consumer.cs` (e.g., `FileDiscoveredEventConsumer.cs`)
- Converters: `[Format]Converter.cs` (e.g., `CsvToJsonConverter.cs`)
- Entities: `DataProcessing[EntityName].cs` (e.g., `DataProcessingDataSource.cs`)

**Directories:**
- Service folders: `src/Services/[ServiceArea]Service/` (PascalCase)
- Frontend feature folders: `src/Frontend/src/components/[feature]/` (kebab-case)
- Backend namespaces: `DataProcessing.[ServiceArea]` (PascalCase)
- Frontend components: `CamelCase.tsx` for React components

**API Routes:**
- Version prefix: `/api/v1/`
- Resource names: kebab-case (e.g., `/api/v1/data-sources`, `/api/v1/invalid-records`)
- Crud: `GET /[resource]`, `GET /[resource]/{id}`, `POST /[resource]`, `PUT /[resource]/{id}`, `DELETE /[resource]/{id}`

## Where to Add New Code

**New Feature (e.g., Reports):**
- Primary code: `src/Services/[ServiceName]/Services/ReportService.cs` (interface + implementation)
- Repository: `src/Services/[ServiceName]/Repositories/ReportRepository.cs`
- Controller: `src/Services/[ServiceName]/Controllers/ReportController.cs`
- Entity: `src/Services/Shared/Entities/DataProcessingReport.cs`
- Tests: `src/Services/[ServiceName].Tests/Services/ReportServiceTests.cs`
- Frontend page: `src/Frontend/src/pages/reports/ReportList.tsx` and `ReportDetails.tsx`
- Frontend API client: `src/Frontend/src/services/reports-api-client.ts`

**New Component/Module:**
- Implementation: `src/Frontend/src/components/[feature]/ComponentName.tsx`
- Types: Add interface to `src/Frontend/src/types/index.ts`
- Hooks: `src/Frontend/src/hooks/useComponentName.ts`
- Styling: Component-scoped CSS or inline styles (Ant Design ConfigProvider)

**Backend Utilities:**
- Shared helpers: `src/Services/Shared/Utilities/HelperName.cs`
- Configuration: `src/Services/Shared/Configuration/[Area]Configuration.cs`
- Converters: `src/Services/Shared/Converters/[Format]Converter.cs`

**Message Events:**
- New event: `src/Services/Shared/Messages/[EntityArea]/[EventName]Event.cs`
- Consumer: `src/Services/[ServiceName]/Consumers/[EventName]EventConsumer.cs` (inherit from `DataProcessingConsumerBase<T>`)
- Topic registration: `src/Services/Shared/Configuration/MassTransitConfiguration.cs` → `ConfigureKafkaTopics()`

**Frontend API Integration:**
- New API client: `src/Frontend/src/services/[entity]-api-client.ts`
- Query keys: Add to `src/Frontend/src/services/queryKeys.ts` (hierarchical structure)
- Hook wrapper: `src/Frontend/src/hooks/use[Entity]Query.ts` for convenience

## Special Directories

**`.planning/codebase/`:**
- Purpose: Generated analysis documents for GSD commands
- Generated: Yes (by mapping tools)
- Committed: Yes (read-only reference)

**`k8s/configmaps/`:**
- Purpose: Configuration data mounted into Kubernetes pods
- Generated: No (manually maintained)
- Committed: Yes
- Key file: `services-config.yaml` contains: MongoDB, Kafka, Hazelcast, OTEL endpoints

**`k8s/infrastructure/`:**
- Purpose: Stateful services (databases, brokers, monitoring)
- Generated: No (but may be templated)
- Committed: Yes

**`src/Frontend/tests/e2e/`:**
- Purpose: End-to-end tests using Playwright
- Generated: No (manually written)
- Committed: Yes
- Run via: `npm run test:e2e`

**`docs/planning/`:**
- Purpose: Implementation plans from `/gsd:plan-phase` command
- Generated: Yes
- Committed: Yes (for documentation)

**`test-data/`:**
- Purpose: Sample CSV/JSON/XML files for testing
- Generated: Yes (by DemoDataGenerator)
- Committed: Yes (minimal samples)

**`publish/` and `bin/` and `obj/`:**
- Purpose: Build artifacts
- Generated: Yes (during build)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-28*

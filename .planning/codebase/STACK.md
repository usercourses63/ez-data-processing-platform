# Technology Stack

**Analysis Date:** 2026-02-02

## Languages

**Primary:**
- C# (.NET 10.0) - Backend microservices and shared libraries
- TypeScript 5.9.3 - Frontend application
- YAML - Kubernetes manifests and configuration

**Secondary:**
- JavaScript/JSX - React component configuration
- PowerShell - Infrastructure scripting

## Runtime

**Environment:**
- .NET Runtime 10.0.100
- Node.js - Frontend development and build

**Package Manager:**
- NuGet - .NET packages (referenced in .csproj files)
- npm - JavaScript packages
- Lockfile: package-lock.json (present)

## Frameworks

**Core Backend:**
- ASP.NET Core Web API - REST API framework for microservices
- MassTransit 8.x - Message bus and event publishing
- MassTransit.Kafka - Kafka transport for MassTransit
- MongoDB.Entities - ORM for MongoDB data access

**Frontend:**
- React 19.0.0 - UI framework
- Ant Design 5.10.0 - RTL-enabled component library
- TanStack React Query 5.90.2 - Data fetching and state management
- Vite 5.4.21 - Build tool and dev server
- React Router v6.15.0 - Routing

**Testing:**
- Playwright 1.49.0 - E2E testing (frontend)
- xUnit - Integration and unit tests (.NET)

**Build/Dev:**
- React Scripts 5.0.1 - Create React App build tools
- Vite with React plugin 4.7.0 - Modern build tooling
- TypeScript 5.9.3 - Type safety
- ESLint 8.48.0 - Code linting
- Prettier - Code formatting (via react-app config)

## Key Dependencies

**Critical Backend:**
- CsvHelper - CSV parsing and writing
- EPPlus - Excel file manipulation
- FluentFTP - FTP/FTPS protocol support
- SSH.NET - SFTP protocol support
- AWSSDK.S3 - Amazon S3 and S3-compatible storage (MinIO, DigitalOcean Spaces)
- SharpCompress - Archive format support (ZIP, RAR, 7Z, etc.)
- KubernetesClient - Direct Kubernetes API interaction
- Hazelcast.Net 5.x - Distributed in-memory cache
- Polly - Resilience and transient fault handling

**Critical Frontend:**
- axios 1.5.0 - HTTP client
- i18next 23.5.1 - Internationalization (Hebrew/English)
- i18next-browser-languagedetector - Auto language detection
- i18next-http-backend - Translation file loading
- react-i18next 13.2.2 - React i18n integration
- @monaco-editor/react 4.7.0 - Code editor for schema/regex
- vanilla-jsoneditor 3.10.0 - JSON editor
- recharts 2.8.0 - Chart rendering
- date-fns 4.1.0 - Date utilities
- lodash 4.17.21 - Utility functions
- cronstrue 3.9.0 - Cron expression parsing
- ajv 8.17.1 - JSON Schema validation

**Infrastructure:**
- prometheus-net 1.x - Prometheus metrics export
- OpenTelemetry SDK + exporters - Distributed tracing
  - OpenTelemetry.Exporter.OpenTelemetryProtocol - OTLP/gRPC export
  - OpenTelemetry.Instrumentation.AspNetCore
  - OpenTelemetry.Instrumentation.Http
  - OpenTelemetry.Instrumentation.Runtime
  - OpenTelemetry.Instrumentation.Process
- Serilog 3.x - Structured logging
- Serilog.AspNetCore - ASP.NET Core logging integration
- Elastic.Serilog.Sinks - Elasticsearch sink for Serilog
- Serilog.Enrichers.* - Correlation ID, environment, thread enrichers
- Swashbuckle.AspNetCore - OpenAPI/Swagger documentation

**Health Checks:**
- AspNetCore.HealthChecks.MongoDb - MongoDB readiness probe
- AspNetCore.HealthChecks.Kafka - Kafka broker connectivity check
- AspNetCore.HealthChecks.Elasticsearch - Elasticsearch health monitoring
- Microsoft.Extensions.Diagnostics.HealthChecks - Base health check framework

## Configuration

**Environment:**
- appsettings.json - Development defaults
- appsettings.Development.json - Development overrides
- appsettings.Production.json - Production settings
- Kubernetes ConfigMaps (k8s/configmaps/) - Runtime configuration
- Environment variables - Service connection strings and secrets

**Build:**
- global.json - .NET SDK version pinning (10.0.100)
- tsconfig.json - TypeScript compilation settings
- vite.config.ts - Frontend build configuration
- playwright.config.ts - E2E test configuration

**Key Configuration Values:**
- `ConnectionStrings__DefaultConnection` - MongoDB connection (required)
- `Kafka__Brokers` - Kafka bootstrap servers (required)
- `OpenTelemetry__OtlpEndpoint` - OTEL Collector endpoint (default: http://localhost:4317)
- `Hazelcast__Servers` - Hazelcast cluster nodes (default: localhost:5701)
- Environment prefixes: `dataprocessing.[service].[topic]` for Kafka topics

## Platform Requirements

**Development:**
- .NET 10.0 SDK
- Node.js 18+ (for frontend)
- Docker (for containerized dependencies)
- Minikube or Kubernetes cluster
- kubectl CLI

**Production:**
- Kubernetes 1.24+ (OCP 4.12+ compatible)
- Docker container runtime
- 3-node MongoDB replica set
- 1+ node Kafka cluster
- Elasticsearch 8.x
- Prometheus (dual instances: system and business)
- Grafana 10.x
- OpenTelemetry Collector
- Hazelcast cluster (optional, for distributed caching)

**Network:**
- Service mesh optional (no Istio enforced currently)
- All services use non-privileged ports (>1024)
- Internal pod-to-pod communication on internal ports
- External access via port-forward or ingress

---

*Stack analysis: 2026-02-02*

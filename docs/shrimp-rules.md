---
last-verified: 2026-02-02
status: current
---
# EZ Data Processing Platform - AI Agent Development Rules

## Project Overview

- **Purpose**: Israeli microservices platform for data processing with Hebrew RTL UI support
- **Technology Stack**: .NET 9.0, MongoDB.Entities, React 18 TypeScript, MassTransit/Kafka, Docker/Kubernetes
- **Current Status**: Phase 2 core services complete (DataSourceManagementService, SchedulingService, FilesReceiverService, ValidationService)

## Critical MongoDB Rules

### **STRICT PROHIBITION: MongoDB.Driver**
- **NEVER** use MongoDB.Driver in any capacity
- **ALWAYS** use pure MongoDB.Entities patterns exclusively
- **MUST** use `MongoClientSettings.FromConnectionString()` for connection configuration
- **REQUIRED**: All entities inherit from `DataProcessingBaseEntity` in src/Services/Shared/Entities/
- **REQUIRED**: Use `BsonDocumentJsonConverter` for Boolean serialization issues

### MongoDB Connection Pattern
```csharp
// CORRECT - Pure MongoDB.Entities
var settings = MongoClientSettings.FromConnectionString(connectionString);
await DB.InitAsync("DatabaseName", settings);

// FORBIDDEN - Never use MongoDB.Driver
// var client = new MongoClient(connectionString);
```

## Hebrew Localization Coordination Rules

### **CRITICAL FILE COORDINATION**
- **WHEN** modifying `src/Frontend/src/i18n/locales/en.json`
- **MUST** simultaneously update `src/Frontend/src/i18n/locales/he.json`
- **WHEN** adding Hebrew error messages in any service
- **MUST** create corresponding `Resources/ErrorMessages.he.json` file
- **REQUIRED**: All UI components support RTL layout
- **REQUIRED**: All form validations have Hebrew error messages

### Hebrew Error Messages Pattern
```csharp
// REQUIRED for all services
public class HebrewErrorResponseFactory 
{
    // Implementation in src/Services/DataSourceManagementService/Infrastructure/
}
```

## Microservices Architecture Rules

### Service Creation Rules
- **NAMING CONVENTION**: `DataProcessing.{ServiceName}.csproj`
- **REQUIRED**: All services reference `DataProcessing.Shared` project
- **REQUIRED**: All MassTransit consumers inherit from `DataProcessingConsumerBase`
- **REQUIRED**: All repositories inherit from `BaseRepository<T>` pattern
- **REQUIRED**: Each service has dedicated `Tests/` folder with integration tests

### Service Coordination Requirements
- **WHEN** adding new service
- **MUST** update `docker-compose.development.yml`
- **MUST** create corresponding Dockerfile using `deploy/docker/Dockerfile.template`
- **MUST** create Kubernetes deployment using `deploy/kubernetes/deployment.template.yaml`
- **MUST** update `deploy/prometheus/prometheus.yml` for monitoring endpoints

## MassTransit Messaging Rules

### Event Patterns
- **NAMING CONVENTION**: `{Action}{Entity}Event` (e.g., `FilePollingEvent`, `ValidationCompletedEvent`)
- **REQUIRED**: All events implement `IDataProcessingMessage` interface
- **REQUIRED**: All consumers inherit from `DataProcessingConsumerBase<TMessage>`
- **LOCATION**: Event definitions in `src/Services/Shared/Messages/`

### Consumer Implementation Pattern
```csharp
// REQUIRED pattern for all consumers
public class MyEventConsumer : DataProcessingConsumerBase<MyEvent>
{
    protected override async Task HandleMessage(MyEvent message, ConsumeContext<MyEvent> context)
    {
        // Implementation
    }
}
```

## Frontend Development Rules

### React Component Rules
- **REQUIRED**: All pages support Hebrew RTL layout
- **REQUIRED**: TypeScript for all components
- **PATTERN**: Page components in `src/Frontend/src/pages/{feature}/`
- **PATTERN**: Layout components in `src/Frontend/src/components/layout/`
- **REQUIRED**: Material-UI with RTL theme configuration

### AI Assistant Interface Rules
- **REFERENCE**: `src/Frontend/src/pages/ai-assistant/AIAssistant.tsx` for Hebrew chat patterns
- **REQUIRED**: Sophisticated Hebrew conversation UI
- **REQUIRED**: Streaming updates support
- **REQUIRED**: Quick actions in Hebrew

## Testing Patterns

### Integration Test Rules
- **REQUIRED**: Use `TestWebApplicationFactory` pattern from existing services
- **REQUIRED**: Use `TestDatabaseConfiguration` for isolated test environments
- **REQUIRED**: Each service has `appsettings.Test.json`
- **LOCATION**: Integration tests in `{ServiceName}/Tests/Integration/`
- **NAMING**: `{ServiceName}.IntegrationTests.csproj`

### Hebrew Data Testing
- **PATTERN**: Demo data files follow `datasource-hebrew-{number}.json`
- **REQUIRED**: PowerShell scripts handle Hebrew text encoding correctly
- **FIX REQUIRED**: `scripts/test-integration-workflow.ps1` has Hebrew encoding issues

## File Processing Rules

### File Reader Implementation
- **PATTERN**: All file readers implement `IFileReader` interface
- **LOCATION**: `src/Services/FilesReceiverService/Infrastructure/`
- **IMPLEMENTATIONS**: `CsvFileReader`, `ExcelFileReader`, `JsonFileReader`, `XmlFileReader`
- **REQUIRED**: Each file type has dedicated reader class

## Deployment Coordination Rules

### Docker Rules
- **TEMPLATE**: Use `deploy/docker/Dockerfile.template` for all services
- **REQUIRED**: Multi-stage builds for all services
- **REQUIRED**: Specific resource limits in Kubernetes deployments

### Helm Chart Rules
- **TEMPLATE**: Use `deploy/helm/dataprocessing-service/Chart.yaml` pattern
- **REQUIRED**: Service-specific `values.yaml` for environment configuration
- **COORDINATION**: Update Helm charts when adding new services

### Kubernetes Rules
- **TEMPLATE**: Use `deploy/kubernetes/deployment.template.yaml`
- **REQUIRED**: Health check endpoints using `HealthCheckConfiguration`
- **REQUIRED**: Resource limits and requests defined

## Monitoring and Observability Rules

### Telemetry Requirements
- **REQUIRED**: All services use `OpenTelemetryConfiguration` pattern
- **REQUIRED**: All services implement `DataProcessingMetrics` custom metrics
- **REQUIRED**: All services use `LoggingConfiguration` standardized logging
- **REQUIRED**: All services implement `CorrelationIdMiddleware`

### Health Check Rules
- **REQUIRED**: All services implement health check endpoints
- **PATTERN**: Use `HealthCheckConfiguration` from shared library
- **KUBERNETES**: Readiness/liveness probes point to health check endpoints

### Prometheus Integration
- **COORDINATION**: When adding new service, update `deploy/prometheus/prometheus.yml`
- **REQUIRED**: All services expose `/metrics` endpoint
- **REQUIRED**: Custom metrics follow `DataProcessingMetrics` patterns

## Configuration Management Rules

### Build Configuration
- **REQUIRED**: All projects conform to `Directory.Build.props` settings
- **REQUIRED**: .NET 9.0 SDK version specified in `global.json`
- **REQUIRED**: Consistent formatting per `.editorconfig`

### Environment Configuration
- **PATTERN**: Each service has `appsettings.Development.json`
- **PATTERN**: Test environments use `appsettings.Test.json`
- **REQUIRED**: Database connection strings use `DatabaseConfiguration` pattern

## Script Rules

### PowerShell Script Requirements
- **REQUIRED**: All scripts handle Hebrew text encoding correctly
- **PATTERN**: Development setup in `scripts/setup-dev-environment.ps1`
- **PATTERN**: Integration testing in `scripts/test-integration-workflow.ps1`
- **FIX REQUIRED**: Hebrew encoding issues in test scripts

## Prohibited Actions

### **ABSOLUTE PROHIBITIONS**
- ❌ **NEVER** use MongoDB.Driver (use MongoDB.Entities exclusively)
- ❌ **NEVER** modify `en.json` without updating corresponding `he.json`
- ❌ **NEVER** create services without Hebrew error message support
- ❌ **NEVER** skip integration test implementation
- ❌ **NEVER** add services without updating deployment configurations
- ❌ **NEVER** create consumers without inheriting from `DataProcessingConsumerBase`

## AI Decision-Making Guidelines

### When Adding New Service
1. ✅ Create service project with `DataProcessing.{ServiceName}.csproj` naming
2. ✅ Add reference to `DataProcessing.Shared`
3. ✅ Implement Hebrew error messages in `Resources/ErrorMessages.he.json`
4. ✅ Create integration tests using `TestWebApplicationFactory` pattern
5. ✅ Update `docker-compose.development.yml`
6. ✅ Create Dockerfile from template
7. ✅ Create Kubernetes deployment from template
8. ✅ Update Prometheus configuration

### When Modifying UI
1. ✅ Update both `en.json` AND `he.json` simultaneously
2. ✅ Ensure RTL support for all new components
3. ✅ Test Hebrew text rendering and layout
4. ✅ Follow Material-UI RTL theme patterns

### When Working with Data
1. ✅ Use pure MongoDB.Entities patterns exclusively
2. ✅ Inherit entities from `DataProcessingBaseEntity`
3. ✅ Use `BsonDocumentJsonConverter` for Boolean issues
4. ✅ Follow repository patterns from existing services

### When Implementing Messaging
1. ✅ Create events in `src/Services/Shared/Messages/`
2. ✅ Implement `IDataProcessingMessage` interface
3. ✅ Use `{Action}{Entity}Event` naming convention
4. ✅ Inherit consumers from `DataProcessingConsumerBase<T>`

## Examples of Correct Implementation

### ✅ Correct Service Structure
```
src/Services/MyNewService/
├── DataProcessing.MyNewService.csproj
├── Controllers/MyNewController.cs
├── Services/IMyNewService.cs
├── Services/MyNewService.cs
├── Models/Requests/
├── Models/Responses/
├── Resources/ErrorMessages.he.json
├── Tests/
│   ├── Integration/MyNewServiceTests.cs
│   ├── appsettings.Test.json
│   └── DataProcessing.MyNewService.IntegrationTests.csproj
└── Program.cs
```

### ✅ Correct Hebrew Localization Update
```json
// en.json
{
  "dataSource": {
    "create": "Create Data Source",
    "delete": "Delete Data Source"
  }
}

// he.json (MUST be updated simultaneously)
{
  "dataSource": {
    "create": "צור מקור נתונים",
    "delete": "מחק מקור נתונים"
  }
}
```

### ❌ Prohibited MongoDB Usage
```csharp
// FORBIDDEN - Never use MongoDB.Driver
using MongoDB.Driver;
var client = new MongoClient(connectionString);
var database = client.GetDatabase("mydb");

// CORRECT - Pure MongoDB.Entities only
using MongoDB.Entities;
await DB.InitAsync("mydb", MongoClientSettings.FromConnectionString(connectionString));
```

## File Modification Priority Matrix

| File Type | Hebrew Coordination | Deployment Update | Test Update |
|-----------|--------------------|--------------------|-------------|
| Service Code | ✅ ErrorMessages.he.json | ✅ Docker/K8s | ✅ Integration Tests |
| Frontend i18n | ✅ BOTH en.json + he.json | ❌ Not Required | ✅ UI Tests |
| New Service | ✅ Hebrew Support | ✅ ALL Deployment | ✅ Full Test Suite |
| Shared Library | ❌ Not Required | ✅ Service Updates | ✅ Shared Tests |

This document provides comprehensive AI-specific guidance for maintaining consistency and coordination across the EZ Data Processing Platform.

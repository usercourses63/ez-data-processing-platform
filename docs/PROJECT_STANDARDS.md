---
last-verified: 2026-02-02
status: current
---
# Data Processing Platform - Project Standards

## Architecture Overview

This project follows a **microservices architecture** using **.NET 9.0** with clean architecture principles. Each service is containerized and deployed on Kubernetes with comprehensive monitoring and observability.

## Project Structure Standards

### Directory Structure
```
src/
├── Services/
│   ├── Shared/                    # Shared components across services
│   ├── [ServiceName]Service/      # Individual microservice
│   │   ├── Controllers/           # API controllers
│   │   ├── Services/             # Business logic services
│   │   ├── Infrastructure/       # Data access and external dependencies
│   │   ├── Models/               # Data transfer objects
│   │   ├── Consumers/            # MassTransit message consumers
│   │   ├── Jobs/                 # Background jobs (Quartz.NET)
│   │   ├── Tests/                # Integration tests
│   │   └── Program.cs            # Application entry point
deploy/
├── docker/                       # Docker configurations
├── kubernetes/                   # Kubernetes manifests
└── helm/                         # Helm charts
scripts/                          # Development and deployment scripts
```

### Naming Conventions

#### Projects and Namespaces
- **Format**: `DataProcessing.[ServiceArea]`
- **Examples**: 
  - `DataProcessing.DataSourceManagement`
  - `DataProcessing.Validation`
  - `DataProcessing.Shared`

#### Services and Classes
- **Interfaces**: Start with `I` prefix
- **Services**: End with `Service` suffix
- **Consumers**: End with `Consumer` suffix
- **Jobs**: End with `Job` suffix
- **Entities**: Prefix with `DataProcessing` for MongoDB entities

#### Files and Directories
- **PascalCase** for all file names
- **Plural names** for collections (Controllers, Services, Models)
- **Singular names** for individual items

## Technology Stack Standards

### Core Framework
- **.NET 9.0** - Primary framework
- **ASP.NET Core** - Web API framework
- **C# 13** - Programming language

### Data Storage
- **MongoDB** - Primary database
- **MongoDB.Entities** - ORM for MongoDB operations
- **Soft delete pattern** - All entities inherit from `DataProcessingBaseEntity`

### Messaging
- **MassTransit** - Service bus abstraction
- **Apache Kafka** - Message broker transport
- **Message correlation** - All messages implement `IDataProcessingMessage`

### Background Processing
- **Quartz.NET** - Job scheduling
- **IHostedService** - Long-running background services

### Monitoring and Observability
- **OpenTelemetry** - Distributed tracing
- **Prometheus** - Metrics collection
- **Serilog** - Structured logging
- **Health Checks** - Application health monitoring

### Containerization
- **Docker** - Application containerization
- **Kubernetes** - Container orchestration
- **Helm** - Package management for Kubernetes

## Coding Standards

### General Guidelines
1. **Follow Clean Architecture principles**
2. **Use dependency injection** for all service dependencies
3. **Implement proper error handling** with structured logging
4. **Use async/await** for I/O operations
5. **Apply SOLID principles**
6. **Write self-documenting code** with clear naming

### Entity Guidelines
```csharp
public class DataProcessingSampleEntity : DataProcessingBaseEntity
{
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    // Always inherit from DataProcessingBaseEntity for soft delete
}
```

### Service Implementation Pattern
```csharp
public interface ISampleService
{
    Task<SampleResult> ProcessAsync(SampleRequest request, CancellationToken cancellationToken = default);
}

public class SampleService : ISampleService
{
    private readonly ILogger<SampleService> _logger;
    private readonly ISampleRepository _repository;
    
    public SampleService(ILogger<SampleService> logger, ISampleRepository repository)
    {
        _logger = logger;
        _repository = repository;
    }
    
    public async Task<SampleResult> ProcessAsync(SampleRequest request, CancellationToken cancellationToken = default)
    {
        using var activity = DataProcessingMetrics.ActivitySource.StartActivity("ProcessSample");
        
        _logger.LogInformation("Processing sample request for {Name}", request.Name);
        
        try
        {
            // Implementation
            DataProcessingMetrics.SampleProcessed.Inc();
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process sample request");
            DataProcessingMetrics.SampleProcessingFailed.Inc();
            throw;
        }
    }
}
```

### Consumer Implementation Pattern
```csharp
public class SampleEventConsumer : DataProcessingConsumerBase<SampleEvent>
{
    public SampleEventConsumer(ILogger<SampleEventConsumer> logger, ISampleService sampleService)
        : base(logger)
    {
        // Constructor
    }

    protected override async Task ProcessMessageAsync(ConsumeContext<SampleEvent> context)
    {
        // Implementation with proper correlation ID handling
    }
}
```

## Configuration Standards

### Service Registration Pattern
```csharp
var builder = WebApplication.CreateBuilder(args);

// Core services
builder.Services.AddControllers();
builder.Services.AddHealthChecks();

// Custom configurations
DatabaseConfiguration.Configure(builder.Services, builder.Configuration);
MassTransitConfiguration.Configure(builder.Services, builder.Configuration);
OpenTelemetryConfiguration.Configure(builder.Services, builder.Configuration);

// Service registrations
builder.Services.AddScoped<ISampleService, SampleService>();

var app = builder.Build();

// Middleware pipeline
app.UseRouting();
app.UseCorrelationId();
app.MapControllers();
app.MapHealthChecks("/health");

await app.RunAsync();
```

### Configuration Files
- **appsettings.json** - Base configuration
- **appsettings.Development.json** - Development overrides
- **appsettings.Production.json** - Production overrides

## Testing Standards

### Integration Testing
- Use **TestWebApplicationFactory** for API testing
- **Test against real infrastructure** (containers, in-memory buses)
- **No unit tests** - Focus on end-to-end integration tests
- **Test database isolation** using unique database names

### Test Structure
```csharp
public class SampleControllerTests : IClassFixture<TestWebApplicationFactory<Program>>
{
    private readonly TestWebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public SampleControllerTests(TestWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task ProcessSample_ValidRequest_ReturnsSuccess()
    {
        // Arrange, Act, Assert
    }
}
```

## Internationalization Standards

### Hebrew Language Support
- **RTL layout support** in frontend applications
- **Hebrew error messages** in `ErrorMessages.he.json`
- **Correlation ID tracking** for request tracing
- **Hebrew-friendly logging** with proper encoding

### Error Message Pattern
```json
{
  "NotFound": "הרשומה לא נמצאה",
  "ValidationFailed": "הוולידציה נכשלה",
  "InternalError": "שגיאה פנימית במערכת"
}
```

## Message Bus Standards

### Message Definition
```csharp
public record SampleEvent(
    string CorrelationId,
    string EntityId,
    DateTime OccurredAt
) : IDataProcessingMessage;
```

### Event Publishing
```csharp
await publishEndpoint.Publish(new SampleEvent(
    correlationId,
    entityId,
    DateTime.UtcNow
), cancellationToken);
```

## Monitoring Standards

### Metrics
- Use **static Prometheus metrics** defined in `DataProcessingMetrics`
- **Counter metrics** for operations (processed, failed)
- **Histogram metrics** for duration tracking
- **Gauge metrics** for current state

### Tracing
- Use **ActivitySource** for distributed tracing
- **Correlation ID propagation** across service boundaries
- **Structured activity naming** following OpenTelemetry conventions

### Logging
```csharp
_logger.LogInformation("Processing {EntityType} with ID {EntityId}", 
    entityType, entityId);
```

## File Processing Standards

### Multi-Format Support
- **CSV** - Using CsvHelper library
- **Excel** - Using EPPlus library  
- **JSON** - Using System.Text.Json
- **XML** - Using System.Xml

### Validation Approach
- **Normalize to JSON** for validation
- **Use JSON Schema** for validation rules
- **Preserve original format** in output
- **Validate individual records**, not entire files

## Deployment Standards

### Docker
- Use **multi-stage builds** for optimization
- **Non-root user** for security
- **Health check endpoints** in containers

### Kubernetes
- **Resource limits** for all pods
- **Liveness and readiness probes**
- **ConfigMaps** for configuration
- **Secrets** for sensitive data

### Helm Charts
- **Parameterized values** for different environments
- **Default values** that work for development
- **Production overrides** in separate values files

## Development Workflow

### Code Quality
1. **Follow established patterns** from existing services
2. **Use EditorConfig** for consistent formatting
3. **Implement proper error handling**
4. **Add comprehensive logging**
5. **Include metrics and tracing**

### Git Workflow
1. **Feature branches** for new development
2. **Pull request reviews** required
3. **Integration tests** must pass
4. **Clean commit messages** describing changes

### Dependencies
- **Keep NuGet packages updated** using latest stable versions
- **Use shared dependencies** defined in Directory.Build.props
- **Minimize external dependencies**

## Security Standards

### API Security
- **Authentication and authorization** as required
- **Input validation** on all endpoints
- **CORS configuration** for frontend integration

### Data Security
- **Sensitive data encryption** in storage
- **Secure connection strings** using secrets
- **Audit logging** for data access

---

*This document should be updated as the project evolves and new patterns emerge.*

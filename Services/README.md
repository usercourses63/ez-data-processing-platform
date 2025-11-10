# EZ Data Processing Platform - Backend Services

.NET 9 microservices architecture for enterprise data processing, validation, and monitoring.

## Architecture Overview

The platform consists of 7 microservices and a shared library:

### Core Services

1. **DataSourceManagementService** (Port 5001)
   - Data source CRUD operations
   - Schema management and validation
   - JSON Schema 2020-12 support
   - Dashboard statistics

2. **FilesReceiverService** (Port 5002)
   - File ingestion from multiple sources
   - File format validation
   - Message bus publishing

3. **ValidationService** (Port 5003)
   - JSON Schema validation
   - Business rule validation
   - Error reporting

4. **MetricsConfigurationService** (Port 5004)
   - Metrics definition and management
   - PromQL expression support
   - Alert rule configuration

5. **InvalidRecordsService** (Port 5005)
   - Invalid record tracking
   - Error analysis
   - Retry mechanisms

6. **SchedulingService** (Port 5006)
   - Cron-based job scheduling
   - File polling orchestration
   - Background task management

7. **DataSourceChatService** (Port 5007)
   - AI assistant integration
   - Natural language queries
   - Schema suggestions

### Shared Library

**DataProcessing.Shared**
- Common entities and models
- Monitoring and telemetry
- Message contracts
- Utility classes

## Technology Stack

- **.NET 9** - Latest LTS framework
- **ASP.NET Core** - Web API framework
- **MongoDB** - Primary database (MongoDB.Entities)
- **MassTransit + Kafka** - Message bus
- **OpenTelemetry** - Distributed tracing
- **Prometheus** - Metrics collection
- **Serilog** - Structured logging
- **Elasticsearch** - Log aggregation
- **NJsonSchema** - JSON Schema validation

## Service Details

### DataSourceManagementService

**Responsibilities:**
- Manage data source configurations
- Store and validate JSON schemas
- Provide schema templates
- Dashboard statistics and reporting

**Key Endpoints:**
- `GET/POST/PUT/DELETE /api/v1/datasource` - Data source management
- `GET/POST/PUT/DELETE /api/v1/schema` - Schema management
- `POST /api/v1/schema/{id}/validate` - Schema validation
- `GET /api/v1/dashboard/statistics` - Dashboard data

**Database Collections:**
- `datasources` - Data source configurations
- `schemas` - JSON schemas with versioning

### FilesReceiverService

**Responsibilities:**
- Poll file sources based on schedules
- Receive files via HTTP upload
- Validate file formats
- Publish to message bus for processing

**Key Endpoints:**
- `POST /api/v1/files/upload` - Manual file upload
- `GET /api/v1/files/status/{id}` - Processing status

**Message Publishing:**
- `FileReceived` - File ready for validation

### ValidationService

**Responsibilities:**
- Validate JSON data against schemas
- Apply business rules
- Track validation results
- Report errors with details

**Key Endpoints:**
- `POST /api/v1/validation/validate` - Validate data
- `GET /api/v1/validation/results` - Query results

**Message Consumption:**
- `FileReceived` - Validate received files

**Message Publishing:**
- `ValidationCompleted` - Validation results
- `ValidationFailed` - Validation errors

### MetricsConfigurationService

**Responsibilities:**
- Define custom business metrics
- Configure PromQL expressions
- Set alert thresholds
- Provide metric templates

**Key Endpoints:**
- `GET/POST/PUT/DELETE /api/v1/metrics` - Metrics CRUD
- `POST /api/v1/metrics/test` - Test metric expression
- `GET /api/v1/metrics/templates` - Metric templates

**Database Collections:**
- `metricsconfigurations` - Metric definitions

### InvalidRecordsService

**Responsibilities:**
- Store invalid records
- Provide error analysis
- Support manual review
- Enable retry mechanisms

**Key Endpoints:**
- `GET /api/v1/invalidrecords` - List invalid records
- `GET /api/v1/invalidrecords/{id}` - Get record details
- `POST /api/v1/invalidrecords/{id}/retry` - Retry processing
- `DELETE /api/v1/invalidrecords/{id}` - Dismiss record

**Database Collections:**
- `invalidrecords` - Failed validation records

### SchedulingService

**Responsibilities:**
- Execute scheduled jobs
- Trigger file polling
- Run background maintenance
- Monitor job execution

**Key Endpoints:**
- `GET /api/v1/jobs` - List scheduled jobs
- `POST /api/v1/jobs` - Create job
- `POST /api/v1/jobs/{id}/trigger` - Manual trigger

**Background Jobs:**
- File polling based on cron schedules
- Cleanup old records
- Generate periodic reports

### DataSourceChatService

**Responsibilities:**
- AI-powered assistance
- Natural language schema queries
- Schema generation suggestions
- Documentation lookup

**Key Endpoints:**
- `POST /api/v1/chat/query` - Send chat query
- `GET /api/v1/chat/history` - Chat history
- `POST /api/v1/chat/suggest-schema` - Schema suggestions

## Project Structure

```
Services/
├── DataSourceManagementService/
│   ├── Controllers/
│   │   ├── DataSourceController.cs
│   │   ├── SchemaController.cs
│   │   └── DashboardController.cs
│   ├── Services/
│   ├── Repositories/
│   ├── Models/
│   ├── Infrastructure/
│   ├── Program.cs
│   └── DataProcessing.DataSourceManagement.csproj
│
├── FilesReceiverService/
│   ├── Controllers/
│   ├── Services/
│   ├── Program.cs
│   └── DataProcessing.FilesReceiver.csproj
│
├── ValidationService/
│   ├── Consumers/
│   ├── Services/
│   ├── Program.cs
│   └── DataProcessing.Validation.csproj
│
├── MetricsConfigurationService/
│   ├── Controllers/
│   ├── Services/
│   ├── Program.cs
│   └── DataProcessing.MetricsConfiguration.csproj
│
├── InvalidRecordsService/
│   ├── Controllers/
│   ├── Services/
│   ├── Program.cs
│   └── DataProcessing.InvalidRecords.csproj
│
├── SchedulingService/
│   ├── Jobs/
│   ├── Services/
│   ├── Program.cs
│   └── DataProcessing.Scheduling.csproj
│
├── DataSourceChatService/
│   ├── Controllers/
│   ├── Services/
│   ├── Program.cs
│   └── DataProcessing.DataSourceChat.csproj
│
└── Shared/
    ├── Entities/
    ├── Monitoring/
    ├── Messages/
    ├── Extensions/
    └── DataProcessing.Shared.csproj
```

## Common Features

### Health Checks

All services expose standard health check endpoints:
- `/health` - Overall health with details
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe

### Observability

**OpenTelemetry Integration:**
- Distributed tracing across services
- Span correlation with trace IDs
- Export to Jaeger/Zipkin

**Prometheus Metrics:**
- HTTP request metrics
- Custom business metrics
- Resource usage

**Serilog Logging:**
- Structured JSON logs
- Correlation ID tracking
- Export to Elasticsearch

### Error Handling

**Bilingual Support:**
- Hebrew error messages
- English error messages
- Consistent error format

```json
{
  "isSuccess": false,
  "error": {
    "message": "שגיאה באימות",
    "messageEnglish": "Validation error",
    "code": "VALIDATION_ERROR",
    "details": {}
  }
}
```

## Running the Services

### Prerequisites

- .NET 9 SDK
- MongoDB (local or Docker)
- Kafka (optional, for message bus)

### Development

**Start all services:**
```bash
dotnet build
./start-all-services.ps1
```

**Start individual service:**
```bash
cd Services/DataSourceManagementService
dotnet run
```

### Docker

**Build images:**
```bash
docker-compose build
```

**Start services:**
```bash
docker-compose up
```

## Configuration

### MongoDB Connection

All services use MongoDB with the following connection settings:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "ezplatform",
    "MongoDB": "mongodb://localhost:27017"
  }
}
```

### CORS

CORS is configured per environment:

**Development:** Allow all origins
**Production:** Specific origins only

### Message Bus

MassTransit with Kafka configuration:

```json
{
  "MessageBus": {
    "Host": "localhost:9092",
    "TopicPrefix": "dataprocessing"
  }
}
```

## API Documentation

Each service exposes its own API documentation:
- Swagger UI available in development mode
- OpenAPI 3.0 specifications
- Request/response examples

## Security

### HTTPS
- All services support HTTPS
- Development certificates
- Production certificates from Let's Encrypt

### CORS
- Configured per environment
- Whitelist specific origins
- Credential support

### Input Validation
- Model validation with data annotations
- Custom validation rules
- Schema-based validation

## Monitoring

### Metrics
- Prometheus scraping endpoints
- Custom business metrics
- System metrics (CPU, memory)

### Tracing
- OpenTelemetry integration
- Trace context propagation
- Jaeger UI for visualization

### Logging
- Structured logging with Serilog
- Elasticsearch aggregation
- Kibana dashboards

## Deployment

### Docker
Each service has a Dockerfile for containerization

### Kubernetes
Helm charts available in `/deploy/helm`

### CI/CD
GitHub Actions workflows for build and deploy

## Development Guidelines

### Code Style
- Follow Microsoft C# coding conventions
- Use async/await for I/O operations
- Implement proper error handling
- Add XML documentation comments

### Testing
- Unit tests with xUnit
- Integration tests with WebApplicationFactory
- End-to-end tests

### Versioning
- Semantic versioning (SemVer)
- API versioning in URLs
- Backward compatibility

## License

Proprietary

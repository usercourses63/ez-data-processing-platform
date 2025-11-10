# Data Source Management Service

.NET 9 ASP.NET Core Web API service for managing data sources and schemas.

## Features

- **Data Source Management**: CRUD operations for data sources
- **Schema Management**: JSON Schema 2020-12 management and validation
- **Health Checks**: /health, /health/ready, /health/live endpoints
- **MongoDB Integration**: Using MongoDB.Entities
- **CORS Support**: Configurable for development and production
- **Localization**: Hebrew and English support
- **Monitoring**: OpenTelemetry and Prometheus metrics

## Prerequisites

- .NET 9 SDK
- MongoDB (local or remote)

## Configuration

Edit `appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "ezplatform",
    "MongoDB": "mongodb://localhost:27017"
  },
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:3000"
    ]
  }
}
```

## Running the Service

```bash
cd Services/DataSourceManagementService
dotnet restore
dotnet run
```

The service will start on:
- HTTP: http://localhost:5001
- HTTPS: https://localhost:7001

## API Endpoints

### Data Sources
- `GET /api/v1/datasource` - List data sources
- `GET /api/v1/datasource/{id}` - Get data source by ID
- `POST /api/v1/datasource` - Create data source
- `PUT /api/v1/datasource/{id}` - Update data source
- `DELETE /api/v1/datasource/{id}` - Delete data source

### Schemas
- `GET /api/v1/schema` - List schemas
- `GET /api/v1/schema/{id}` - Get schema by ID
- `POST /api/v1/schema` - Create schema
- `PUT /api/v1/schema/{id}` - Update schema
- `DELETE /api/v1/schema/{id}` - Delete schema
- `POST /api/v1/schema/{id}/validate` - Validate data against schema
- `GET /api/v1/schema/templates` - Get schema templates

### Dashboard
- `GET /api/v1/dashboard/statistics` - Get dashboard statistics

### Health
- `GET /health` - Health check with details
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

## Project Structure

```
DataSourceManagementService/
├── Controllers/
│   ├── DataSourceController.cs
│   ├── SchemaController.cs
│   └── DashboardController.cs
├── Services/
│   ├── DataSourceService.cs
│   └── Schema/
│       ├── SchemaService.cs
│       └── SchemaValidationService.cs
├── Repositories/
│   ├── DataSourceRepository.cs
│   └── Schema/
│       └── SchemaRepository.cs
├── Models/
│   ├── Requests/
│   ├── Responses/
│   └── Schema/
├── Infrastructure/
│   ├── BaseRepository.cs
│   └── HebrewErrorResponseFactory.cs
├── Resources/
│   └── ErrorMessages.he.json
├── Program.cs
└── appsettings.json
```

## Dependencies

- MongoDB.Entities - MongoDB ORM
- NJsonSchema - JSON Schema validation
- MassTransit - Message bus integration
- Serilog - Logging
- OpenTelemetry - Distributed tracing
- Prometheus - Metrics

## License

Proprietary

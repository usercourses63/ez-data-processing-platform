# EZ Data Processing Platform

Enterprise data ingestion, validation, and monitoring system with React frontend and .NET microservices backend.

## Project Structure

```
ez-data-processing-platform/
├── Frontend/                    # React + TypeScript frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API clients
│   │   ├── types/             # TypeScript definitions
│   │   ├── i18n/              # Internationalization
│   │   └── App.tsx            # Main app component
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── Services/                  # .NET 9 microservices
│   ├── DataSourceManagementService/
│   ├── FilesReceiverService/
│   ├── ValidationService/
│   ├── MetricsConfigurationService/
│   ├── InvalidRecordsService/
│   ├── SchedulingService/
│   ├── DataSourceChatService/
│   ├── Shared/                # Shared library
│   └── README.md
│
├── DataProcessingPlatform.sln # Solution file
└── README.md                  # This file
```

## Features

### Frontend
- **React 19** with TypeScript
- **Ant Design** UI components
- **RTL Support** for Hebrew
- **Bilingual** (Hebrew/English)
- Data source management
- Schema builder with visual editor
- Metrics configuration wizard
- Real-time monitoring dashboard

### Backend
- **7 Microservices** built with .NET 9
- **MongoDB** for data storage
- **MassTransit + Kafka** for messaging
- **OpenTelemetry** for distributed tracing
- **Prometheus** for metrics
- **Serilog** for structured logging
- Health checks and observability

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- .NET 9 SDK
- MongoDB
- Docker (optional)

### Frontend

```bash
cd Frontend
npm install
npm start
```

Access at: http://localhost:3000

### Backend

**Start all services:**
```bash
dotnet build
# Use PowerShell script
./start-all-services.ps1
```

**Or start individual service:**
```bash
cd Services/DataSourceManagementService
dotnet run
```

### Docker

```bash
docker-compose up
```

## Architecture

### Microservices

1. **DataSourceManagementService** (5001) - Data source and schema management
2. **FilesReceiverService** (5002) - File ingestion
3. **ValidationService** (5003) - Data validation
4. **MetricsConfigurationService** (5004) - Metrics management
5. **InvalidRecordsService** (5005) - Invalid record tracking
6. **SchedulingService** (5006) - Job scheduling
7. **DataSourceChatService** (5007) - AI assistant

### Technology Stack

**Frontend:**
- React 19, TypeScript, Ant Design
- React Query, React Router
- i18next for localization
- Axios for HTTP requests

**Backend:**
- .NET 9, ASP.NET Core
- MongoDB.Entities
- MassTransit, Kafka
- NJsonSchema for validation
- OpenTelemetry, Prometheus, Serilog

## Configuration

### MongoDB Connection

Edit `appsettings.Development.json` in each service:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "ezplatform",
    "MongoDB": "mongodb://localhost:27017"
  }
}
```

### Frontend API URLs

Create `Frontend/.env`:

```env
REACT_APP_SCHEMA_API_URL=http://localhost:5001/api/v1/schema
REACT_APP_METRICS_API_URL=http://localhost:5004/api/v1/metrics
```

## API Documentation

### Data Source Management
- `GET/POST/PUT/DELETE /api/v1/datasource` - CRUD operations
- `GET/POST/PUT/DELETE /api/v1/schema` - Schema management
- `POST /api/v1/schema/{id}/validate` - Validate data

### Metrics Configuration
- `GET/POST/PUT/DELETE /api/v1/metrics` - Metrics CRUD
- `POST /api/v1/metrics/test` - Test metric

### Health Checks
- `/health` - Overall health
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe

## Development

### Code Style

**Frontend:**
- TypeScript strict mode
- ESLint with React rules
- Functional components with hooks

**Backend:**
- Microsoft C# conventions
- Async/await for I/O
- XML documentation comments

### Testing

**Frontend:**
```bash
npm test
```

**Backend:**
```bash
dotnet test
```

## Deployment

### Docker

Each service has a Dockerfile:

```bash
docker build -t service-name ./Services/ServiceName
```

### Kubernetes

Helm charts available in `/deploy/helm`:

```bash
helm install ez-platform ./deploy/helm/dataprocessing-service
```

## Monitoring

### Metrics
- Prometheus scrapes `/metrics` endpoint
- Grafana dashboards in `/deploy/grafana`

### Tracing
- OpenTelemetry exports to Jaeger
- Distributed tracing across services

### Logging
- Serilog to Elasticsearch
- Kibana for log visualization

## License

Proprietary

## Documentation

- [Frontend Documentation](Frontend/README.md)
- [Backend Services Documentation](Services/README.md)
- [Frontend Structure](Frontend/STRUCTURE.md)

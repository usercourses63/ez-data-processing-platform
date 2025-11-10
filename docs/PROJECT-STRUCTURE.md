# EZ Data Processing Platform - Project Structure

## Overview

The EZ Data Processing Platform is an enterprise-grade system for data ingestion, validation, and monitoring with a microservices architecture.

## High-Level Architecture

```
┌────────────────────────────────────────┐
│          React Frontend (Port 3000)           │
│   TypeScript + Ant Design + RTL Support      │
└────────────────────────────────────────┘
                      │
                      │ HTTP/REST
                      │
        ┌─────────────────────────────────┐
        │       .NET 9 Microservices         │
        │                                   │
        │  ┌──────────────────────────┐  │
        │  │ DataSourceManagement   │  │
        │  │ (Port 5001)            │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ FilesReceiver          │  │
        │  │ (Port 5002)            │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ Validation             │  │
        │  │ (Port 5003)            │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ MetricsConfiguration   │  │
        │  │ (Port 5004)            │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ InvalidRecords         │  │
        │  │ (Port 5005)            │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ Scheduling             │  │
        │  │ (Port 5006)            │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ DataSourceChat         │  │
        │  │ (Port 5007)            │  │
        │  └──────────────────────────┘  │
        └─────────────────────────────────┘
                      │
                      │ MassTransit + Kafka
                      │
        ┌─────────────────────────────────┐
        │         MongoDB                  │
        │    (Primary Data Store)         │
        └─────────────────────────────────┘
```

## Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript 4.9** - Type safety
- **Ant Design 5.10** - UI components
- **React Router 6** - Routing
- **React Query** - Server state
- **i18next** - Internationalization
- **Axios** - HTTP client

### Backend
- **.NET 9** - Framework
- **ASP.NET Core** - Web API
- **MongoDB.Entities** - ORM
- **MassTransit** - Message bus
- **NJsonSchema** - JSON Schema validation

### Infrastructure
- **MongoDB** - Database
- **Kafka** - Message broker
- **Elasticsearch** - Log aggregation
- **Prometheus** - Metrics
- **OpenTelemetry** - Tracing

## Repository Structure

```
ez-data-processing-platform/
├── Frontend/                    # React application
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API clients
│   │   ├── types/             # TypeScript types
│   │   └── i18n/              # Translations
│   ├── public/
│   └── package.json
│
├── Services/                  # .NET microservices
│   ├── DataSourceManagementService/
│   ├── FilesReceiverService/
│   ├── ValidationService/
│   ├── MetricsConfigurationService/
│   ├── InvalidRecordsService/
│   ├── SchedulingService/
│   ├── DataSourceChatService/
│   └── Shared/                # Shared library
│
├── tools/                     # Development tools
│   ├── DemoDataGenerator/
│   └── ServiceOrchestrator/
│
├── docs/                      # Documentation
│   ├── README.md
│   ├── PROJECT-STRUCTURE.md    # This file
│   └── data_processing_prd.md  # Requirements
│
├── DataProcessingPlatform.sln # Solution file
└── README.md                  # Project overview
```

## Data Flow

### File Processing Flow

```
1. FilesReceiverService receives file
   ↓
2. Publishes FileReceived message to Kafka
   ↓
3. ValidationService consumes message
   ↓
4. Validates against JSON Schema
   ↓
5. If valid: Publishes ValidationSuccess
   If invalid: Publishes ValidationFailed
   ↓
6. InvalidRecordsService stores failed records
   ↓
7. MetricsConfigurationService calculates metrics
```

### User Interaction Flow

```
1. User accesses React Frontend
   ↓
2. Frontend calls REST APIs
   ↓
3. Services process requests
   ↓
4. Data stored in MongoDB
   ↓
5. Real-time updates via SignalR (optional)
```

## Key Design Patterns

### Backend
- **Repository Pattern** - Data access abstraction
- **Service Layer** - Business logic separation
- **CQRS** - Command Query Responsibility Segregation
- **Event-Driven** - Asynchronous communication via Kafka

### Frontend
- **Component-Based** - Reusable UI components
- **Container/Presenter** - Separation of concerns
- **Custom Hooks** - Shared logic
- **Context API** - Global state management

## Security

### Authentication & Authorization
- JWT tokens (planned)
- Role-based access control (planned)

### Data Security
- HTTPS for all communications
- MongoDB authentication
- Input validation
- SQL injection prevention (N/A - NoSQL)
- XSS protection

## Monitoring & Observability

### Logging
- **Serilog** - Structured logging
- **Elasticsearch** - Log aggregation
- **Kibana** - Log visualization

### Metrics
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization
- Custom business metrics

### Tracing
- **OpenTelemetry** - Distributed tracing
- **Jaeger** - Trace visualization
- Correlation IDs across services

## Deployment

### Development
- Local MongoDB instance
- Services run on localhost
- Frontend dev server (port 3000)

### Production
- Docker containers
- Kubernetes orchestration
- Helm charts for deployment
- CI/CD via GitHub Actions

## Database Collections

### MongoDB Collections

- `datasources` - Data source configurations
- `schemas` - JSON schemas
- `metricsconfigurations` - Metric definitions
- `validationresults` - Validation outcomes
- `invalidrecords` - Failed validations
- `scheduledjobs` - Job configurations

## API Endpoints

See individual service READMEs for detailed API documentation:
- [DataSourceManagementService](../Services/DataSourceManagementService/README.md)
- [Other services documentation available in local codebase]

## Development Guidelines

### Code Standards
- Follow Microsoft C# coding conventions
- Use TypeScript strict mode
- Write unit tests for business logic
- Document public APIs

### Git Workflow
- Feature branches from main
- Pull requests for code review
- Squash commits before merge

### Testing Strategy
- Unit tests for business logic
- Integration tests for APIs
- E2E tests for critical flows

## Performance Considerations

### Backend
- Async/await for I/O operations
- Database indexing
- Caching strategies
- Connection pooling

### Frontend
- Code splitting
- Lazy loading
- Memoization
- Virtual scrolling for large lists

## Scalability

### Horizontal Scaling
- Stateless services
- Load balancing
- Service replication

### Vertical Scaling
- Resource allocation
- Performance tuning

## Future Enhancements

- GraphQL API layer
- Real-time dashboards with SignalR
- Advanced analytics
- Machine learning integration
- Multi-tenancy support

---

**Last Updated:** November 10, 2025  
**Version:** 2.0

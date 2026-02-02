---
sidebar_position: 1
last-verified: 2026-02-02
status: current
description: Complete system architecture guide for EZ Platform - microservices, data pipeline, infrastructure, and design decisions
---

# Architecture Guide

> Complete system architecture documentation for EZ Platform - a microservices-based data processing and validation platform

---

## Overview

EZ Platform is an enterprise data processing platform that automates file discovery, format conversion, schema validation, and multi-destination output. Built with a microservices architecture on .NET 10.0 and deployed on Kubernetes, it provides full Hebrew/RTL support and comprehensive observability.

### Key Capabilities

- **File Discovery** - Automated polling with deduplication across multiple protocols (Local, FTP, SFTP, HTTP, S3, Kafka)
- **Format Conversion** - Support for CSV, XML, Excel, and JSON with automatic detection
- **Schema Validation** - JSON Schema 2020-12 compliance via Corvus validator
- **Multi-Destination Output** - Route validated data to Local folders, SFTP, HTTP APIs, Kafka topics, or S3
- **Full Observability** - Metrics (Prometheus), logs (Elasticsearch), traces (Jaeger), dashboards (Grafana)

### System Components

| Component | Count | Purpose |
|-----------|-------|---------|
| Microservices | 9 | Data processing pipeline and APIs |
| Frontend | 1 | React 19 UI with Hebrew/RTL support |
| Message Broker | 1 | RabbitMQ with MassTransit |
| Database | 1 | MongoDB 3-node replica set |
| Cache | 1 | Hazelcast distributed cache |
| Monitoring | 5 | Prometheus (dual), Grafana, Jaeger, Elasticsearch |

### Quick Links

- [Operations](#operations) - Health checks, commands, troubleshooting
- [Development](#development) - Service structure, patterns, extending the system
- [Architecture](#architecture) - Design decisions, data flow, scalability

---

## Operations

This section provides operational procedures for deploying, monitoring, and maintaining EZ Platform.

### Health Checks

All services expose health endpoints:

```bash
# Service health checks (after port-forwarding)
curl http://localhost:5001/health  # DataSource Management
curl http://localhost:5002/health  # Metrics Configuration
curl http://localhost:5003/health  # Validation
curl http://localhost:5004/health  # Scheduling
curl http://localhost:5007/health  # File Discovery
curl http://localhost:5008/health  # File Processor
curl http://localhost:5009/health  # Output

# Detailed health (includes dependency checks)
curl http://localhost:5001/health/ready
curl http://localhost:5001/health/live
```

### Port Forwarding

**Always use the port-forward script** instead of individual `kubectl port-forward` commands:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

This configures all 18 required ports:

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 7000 | React UI |
| DataSource Management | 5001 | Primary API |
| Metrics Configuration | 5002 | Metrics API |
| Validation | 5003 | Schema validation |
| Scheduling | 5004 | Job scheduling |
| Invalid Records | 5007 | Error tracking |
| File Processor | 5008 | Format conversion |
| Output | 5009 | Multi-destination output |
| Grafana | 3001 | Dashboards |
| Prometheus System | 9090 | Infrastructure metrics |
| Prometheus Business | 9091 | Business metrics |
| Elasticsearch | 9200 | Logs and traces |
| Jaeger | 16686 | Distributed tracing |
| MongoDB | 27017 | Database |
| Kafka | 9094 | Event streaming |
| RabbitMQ | 5672 | Message broker |
| Hazelcast | 5701 | Distributed cache |

### Kubernetes Commands

```bash
# Check pod status
kubectl get pods -n ez-platform
kubectl get pods -n ez-platform -w  # Watch mode

# View service logs
kubectl logs -f deployment/fileprocessor -n ez-platform
kubectl logs -f deployment/validation -n ez-platform --tail=100

# Service restart
kubectl rollout restart deployment/fileprocessor -n ez-platform

# Scale deployment
kubectl scale deployment/output --replicas=5 -n ez-platform

# Resource usage
kubectl top pods -n ez-platform

# Recent events
kubectl get events -n ez-platform --sort-by='.lastTimestamp'

# Pod debugging
kubectl exec -it <pod-name> -n ez-platform -- /bin/bash
kubectl describe pod <pod-name> -n ez-platform
```

### ConfigMap Management

```bash
# View current config
kubectl get configmap services-config -n ez-platform -o yaml

# Edit config
kubectl edit configmap services-config -n ez-platform

# Restart services to pick up changes
kubectl rollout restart deployment/fileprocessor -n ez-platform
```

### Monitoring URLs

After port-forwarding:

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3001 | admin/admin |
| Jaeger | http://localhost:16686 | - |
| Prometheus System | http://localhost:9090 | - |
| Prometheus Business | http://localhost:9091 | - |
| Elasticsearch | http://localhost:9200 | - |
| Frontend | http://localhost:7000 | - |

### Troubleshooting

**Port already in use:**
```powershell
taskkill /F /IM kubectl.exe
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

**Pod not starting:**
```bash
kubectl get events -n ez-platform --sort-by='.lastTimestamp'
kubectl logs <pod-name> -n ez-platform --previous
kubectl describe pod <pod-name> -n ez-platform
```

**MongoDB connection issues:**
```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongosh
kubectl get configmap services-config -n ez-platform -o jsonpath='{.data.mongodb-connection}'
```

**Hazelcast cache issues:**
```bash
kubectl logs -f deployment/hazelcast -n ez-platform
kubectl exec -it hazelcast-0 -n ez-platform -- curl http://localhost:5701/hazelcast/health
```

---

## Development

This section covers service implementation patterns, code organization, and extending the platform.

### Service Structure

Each microservice follows a consistent structure:

```
[ServiceName]Service/
├── Controllers/           # REST API endpoints
├── Services/              # Business logic (interfaces + implementations)
├── Repositories/          # Data access (MongoDB.Entities)
├── Consumers/             # MassTransit message consumers
├── Models/                # Request/Response DTOs
├── Jobs/                  # Quartz.NET background jobs (if applicable)
└── Program.cs             # Entry point with DI configuration
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Namespaces | `DataProcessing.[ServiceArea]` | `DataProcessing.Validation` |
| Interfaces | `I` prefix | `IDataSourceService` |
| Services | `Service` suffix | `DataSourceService` |
| Consumers | `Consumer` suffix | `FileDiscoveredEventConsumer` |
| Entities | Inherit from base | `DataProcessingBaseEntity` |
| Events | `Event` suffix | `FileDiscoveredEvent` |

### Service Implementation Pattern

```csharp
public interface ISampleService
{
    Task<SampleResult> ProcessAsync(SampleRequest request, CancellationToken ct = default);
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

    public async Task<SampleResult> ProcessAsync(SampleRequest request, CancellationToken ct = default)
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
    private readonly ISampleService _sampleService;

    public SampleEventConsumer(ILogger<SampleEventConsumer> logger, ISampleService sampleService)
        : base(logger)
    {
        _sampleService = sampleService;
    }

    protected override async Task ProcessMessageAsync(ConsumeContext<SampleEvent> context)
    {
        // Correlation ID automatically tracked via base class
        await _sampleService.ProcessAsync(context.Message);
    }
}
```

### Entity Base Class

All MongoDB entities inherit from `DataProcessingBaseEntity`:

```csharp
public class DataProcessingBaseEntity
{
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }      // Soft delete
    public Guid CorrelationId { get; set; }
    public int Version { get; set; }          // Optimistic concurrency
}
```

### Adding a New Connector

Connectors implement the `IDataSourceConnector` interface:

```csharp
public interface IDataSourceConnector
{
    Task<IEnumerable<FileInfo>> ListFilesAsync(string pattern, CancellationToken ct);
    Task<byte[]> ReadFileAsync(string path, CancellationToken ct);
    Task<bool> TestConnectionAsync(CancellationToken ct);
    Task<FileMetadata> GetFileMetadataAsync(string path, CancellationToken ct);
}
```

Existing connectors: Local, FTP, SFTP, HTTP, S3, Kafka

### Adding a New Format Converter

Converters transform files to/from JSON:

```csharp
public interface IFormatConverter
{
    Task<JsonDocument> ToJsonAsync(Stream input, CancellationToken ct);
    Task<Stream> FromJsonAsync(JsonDocument json, CancellationToken ct);
    string[] SupportedExtensions { get; }
}
```

Existing converters: CSV, XML, Excel, JSON

### Running Tests

```bash
# Backend integration tests
cd src/Services/[Service].Tests
dotnet test

# Frontend E2E tests
cd src/Frontend
npm run test:e2e
npm run test:e2e:headed  # With browser
npm run test:e2e:ui      # Interactive UI
```

### Building and Deploying a Service

```powershell
# Build and load image to minikube
cd src/Services/[ServiceName]
docker build -t servicename:v1 .
minikube image load servicename:v1

# Update deployment
kubectl set image deployment/servicename servicename=servicename:v1 -n ez-platform

# Watch rollout
kubectl rollout status deployment/servicename -n ez-platform
```

---

## Architecture

This section covers system design, data flow, and architectural decisions.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EZ PLATFORM ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   PRESENTATION          API LAYER              PROCESSING PIPELINE          │
│   ═══════════          ═════════              ═══════════════════           │
│                                                                              │
│   ┌──────────┐    ┌─────────────────┐    ┌──────────┐    ┌──────────┐      │
│   │ React 19 │───►│ DataSource Mgmt │    │ File     │───►│ File     │      │
│   │ Frontend │    │ (5001)          │    │ Discovery│    │ Processor│      │
│   │          │    ├─────────────────┤    │ (5007)   │    │ (5008)   │      │
│   │ • Ant    │    │ Metrics Config  │    └────┬─────┘    └────┬─────┘      │
│   │   Design │    │ (5002)          │         │               │            │
│   │ • RTL/HE │    ├─────────────────┤    ┌────▼─────┐    ┌────▼─────┐      │
│   │ • i18next│    │ Invalid Records │    │Validation│───►│  Output  │      │
│   └──────────┘    │ (5006)          │    │ (5003)   │    │  (5009)  │      │
│                   └─────────────────┘    └──────────┘    └──────────┘      │
│                                                                              │
│   INFRASTRUCTURE                                                             │
│   ══════════════                                                             │
│                                                                              │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│   │  MongoDB  │  │ RabbitMQ  │  │ Hazelcast │  │  OTEL     │               │
│   │ (27017)   │  │ (5672)    │  │ (5701)    │  │ Collector │               │
│   │           │  │           │  │           │  │ (4317)    │               │
│   │ • ezplatfm│  │• MassTransit│ │• file-content│ ├───────────┤              │
│   │ • 2 nodes │  │• 4 topics │  │• valid-records│ │Prometheus │              │
│   └───────────┘  └───────────┘  └───────────┘  │Jaeger     │               │
│                                                 │Elastic    │               │
│                                                 └───────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Processing Pipeline

```
SOURCE FILES              PROCESSING STAGES                    DESTINATIONS
════════════              ══════════════════                   ════════════

┌─────────┐     ┌─────────────────────────────────────────┐     ┌─────────┐
│  CSV    │     │                                         │     │  Local  │
│  XML    │────►│  DISCOVER → CONVERT → VALIDATE → OUTPUT │────►│  SFTP   │
│  Excel  │     │      │         │          │         │   │     │  HTTP   │
│  JSON   │     │      │         │          │         │   │     │  Kafka  │
└─────────┘     │      ▼         ▼          ▼         │   │     │  S3     │
                │   Hazelcast Hazelcast  Hazelcast    │   │     └─────────┘
  50Gi INPUT    │   (hashes) (content)  (valid-recs)  │   │
                │                                     │   │     INVALID
                │      └─────────┴──────────┘         │   │     RECORDS
                │           RabbitMQ                  │   │────►(MongoDB)
                │         (Event-Driven)              │   │
                └─────────────────────────────────────────┘     100Gi OUTPUT
```

**Pipeline Stages:**

| Stage | Service | Input | Output | Cache Key |
|-------|---------|-------|--------|-----------|
| 1. Discover | FileDiscovery (5007) | Cron trigger | FileDiscoveredEvent | file-hashes |
| 2. Convert | FileProcessor (5008) | Raw file | JSON records | file-content |
| 3. Validate | Validation (5003) | JSON + Schema | Valid/Invalid records | valid-records |
| 4. Output | Output (5009) | Valid records | Multi-destination | - |

### Message Flow (RabbitMQ)

```
Topic: dataprocessing.scheduling.filepolling
├─ Producer: Scheduling Service (Quartz cron trigger)
└─ Consumer: FileDiscovery Service

Topic: dataprocessing.filesreceiver.validationrequest
├─ Producer: FileProcessor Service
└─ Consumer: Validation Service

Topic: dataprocessing.validation.completed
├─ Producer: Validation Service
└─ Consumers: Output Service, InvalidRecords Service

Topic: dataprocessing.global.processingfailed
├─ Producer: Any service on error
└─ Consumer: Error handling
```

**Message Contract:**

All messages implement `IDataProcessingMessage`:

```csharp
public interface IDataProcessingMessage
{
    Guid CorrelationId { get; }     // Request tracing
    DateTime Timestamp { get; }      // UTC ordering
    string PublishedBy { get; }      // Source service
    int MessageVersion { get; }      // Compatibility
}
```

### Caching Strategy (Hazelcast)

| Map | Purpose | TTL | Max Idle | Eviction |
|-----|---------|-----|----------|----------|
| file-content | JSON from FileProcessor | 5 min | 3 min | LRU, 256MB |
| valid-records | Validated records | 5 min | 3 min | LRU, 256MB |
| file-hashes | Deduplication hashes | 24 hr | 12 hr | LRU, 128MB |

### Database Schema (MongoDB)

**Database:** `ezplatform`

| Collection | Purpose | Key Indexes |
|------------|---------|-------------|
| dataprocessingsources | Data source configs | Name (unique) |
| dataprocessingvalidationresults | Validation audit trail | CorrelationId, DataSourceId |
| dataprocessinginvalidrecords | Failed validations | DataSourceId, CreatedAt |
| dataprocessingschema | JSON schemas | Name (unique) |
| outputconfigurations | Output destinations | DataSourceId |

### Observability Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Services (OTEL SDK)  →  OTEL Collector (4317/4318)                    │
│                            ├→ Prometheus System (9090) → Infra Metrics  │
│                            ├→ Prometheus Business (9091) → Business KPIs│
│                            ├→ Elasticsearch (9200) → Logs & Traces      │
│                            └→ Jaeger (16686) → Distributed Tracing      │
│                                                                          │
│   Container Logs  →  Fluent Bit (DaemonSet)  →  Elasticsearch           │
│                                                                          │
│   All Sources  →  Grafana (3001)  →  Dashboards                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Design Decisions

**Why MassTransit over direct RabbitMQ?**
- Provides saga support for complex workflows
- Built-in retry with exponential backoff
- Consistent consumer patterns across services
- Abstraction allows broker swap (RabbitMQ ↔ Kafka)

**Why Hazelcast for caching?**
- Distributed cache survives pod restarts
- Near-cache reduces network calls
- TTL-based eviction handles pipeline data lifecycle
- Supports both Java and .NET clients

**Why MongoDB over SQL?**
- Schema flexibility for evolving data structures
- Native JSON document storage
- Replica set provides HA without complexity
- MongoDB.Entities ORM simplifies .NET integration

**Why dual Prometheus instances?**
- Separation of concerns: infrastructure vs business metrics
- Different retention policies
- Different scrape intervals (15s system, 30s business)
- Independent alerting rules

### OCP Compatibility

All deployments follow OpenShift Container Platform requirements:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault
containers:
- securityContext:
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: [ALL]
```

- All services use non-privileged ports (>1024)
- Images pinned to specific versions (no :latest)
- imagePullPolicy: IfNotPresent

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| File processing | <1s per 100-record file | ✅ Achieved |
| Cache hit rate | >95% | ✅ 97% |
| Service startup | <5s | ✅ 3-4s |
| P99 API latency | <500ms | ✅ ~350ms |

### Resource Requirements

| Environment | CPU | Memory | Storage |
|-------------|-----|--------|---------|
| Development | 12 cores | 32Gi | 100Gi |
| Production | 20+ cores | 64Gi+ | 500Gi+ |

---

*Last verified: 2026-02-02*

*Consolidated from:*
- docs/architecture/SYSTEM-ARCHITECTURE.md
- .planning/codebase/ARCHITECTURE.md
- docs/PROJECT_STANDARDS.md
- CLAUDE.md (operational sections)

# EZ Platform - CLAUDE.md

## Project Overview

EZ Platform is a data processing platform built with microservices architecture (.NET 10.0 backend, React 19 frontend) deployed on Kubernetes. It provides file discovery, format conversion, schema validation, and multi-destination output with full Hebrew/RTL support.

**Status:** Production Ready - v0.3.0
**Architecture:** 9 Microservices + React Frontend + Kubernetes + Kafka + MongoDB (3-node Replica Set)
**Last Updated:** March 20, 2026

---

## CRITICAL: Task Orchestrator MCP Tool (MANDATORY)

**⚠️ STRICT REQUIREMENT: ONLY use `task-orchestrator` MCP tool via `mcp-exec` for ALL task management.**

**DO NOT use any alternative methods (TodoWrite, manual tracking, etc.) without explicit user permission.**

### MCP-Exec Access Pattern (REQUIRED)
```
# All task-orchestrator operations MUST use mcp-exec:
mcp__MCP_DOCKER__mcp-exec with name="<tool_name>" and arguments={...}

# If task-orchestrator tools are not available:
1. First run: mcp__MCP_DOCKER__mcp-add with name="task-orchestrator" and activate=true
2. Then retry the mcp-exec call
3. If still failing, STOP and ask user how to proceed
```

### Available Task Orchestrator Tools (via mcp-exec)
| Tool Name | Purpose |
|-----------|---------|
| `get_overview` | Get current work state |
| `create_feature` | Create a new feature |
| `create_task` | Create a task under a feature |
| `update_task` | Update task status/details |
| `search_tasks` | Search for tasks |
| `create_dependency` | Set task dependencies |
| `apply_template` | Apply templates |
| `add_section` | Add documentation sections |

### Workflow Requirements

1. **Planning Phase** - Use task-orchestrator to:
   - Create features with `create_feature`
   - Break down features into tasks with `create_task`
   - Set dependencies with `create_dependency`
   - Apply templates with `apply_template`

2. **Execution Phase** - Use task-orchestrator to:
   - Get overview with `get_overview` before starting work
   - Update task status to `in_progress` when starting
   - Update task status to `completed` when done
   - Track progress with sections using `add_section`

3. **Completion Phase** - After EVERY completed task:
   - Update task status to `completed`
   - **Git commit the changes** with descriptive message
   - **Git push to remote**
   - Report completion status

### Example mcp-exec Calls
```
# Update task status
mcp__MCP_DOCKER__mcp-exec(
  name="update_task",
  arguments={"id": "task-uuid", "status": "completed"}
)

# Create a task
mcp__MCP_DOCKER__mcp-exec(
  name="create_task",
  arguments={"title": "Task title", "summary": "Task description", "featureId": "feature-uuid"}
)

# Get overview
mcp__MCP_DOCKER__mcp-exec(
  name="get_overview",
  arguments={}
)
```

### Troubleshooting

If you encounter "Tool not found" errors, see: [docs/troubleshooting/task-orchestrator-mcp-usage.md](docs/troubleshooting/task-orchestrator-mcp-usage.md)

**Common issues:**
- Tool names must be simple (e.g., `update_task` NOT `task-orchestrator_update_task`)
- Session may expire - re-run `mcp-add` if tools stop working
- Always use `activate=true` when adding the server

### Mandatory Git Workflow After Task Completion
```powershell
# After completing any task:
git add .
git commit -m "Task: [task-title] - [brief description]"
git push
```

---

## CRITICAL: Port Forwarding Rule

**ALWAYS use the port-forward script instead of individual `kubectl port-forward` commands:**

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\UserC\source\repos\EZ\scripts\start-port-forwards.ps1"
```

This script configures ALL 18 required port forwards:

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 7000 | React UI |
| DataSourceManagement | 5001 | Primary API |
| MetricsConfiguration | 5002 | Metrics API |
| Validation | 5003 | Schema validation |
| Scheduling | 5004 | Job scheduling |
| InvalidRecords | 5007 | Invalid records |
| FileProcessor | 5008 | File processing |
| Output | 5009 | Output service |
| Grafana | 3001 | Monitoring dashboard |
| Prometheus System | 9090 | System metrics |
| Prometheus Business | 9091 | Business metrics |
| Elasticsearch | 9200 | Log storage |
| Jaeger | 16686 | Distributed tracing |
| OTEL Collector | 4317/4318 | Telemetry (gRPC/HTTP) |
| MongoDB | 27017 | Database |
| Kafka | 9094 | Event streaming |
| RabbitMQ | 5672 | Message broker |
| Hazelcast | 5701 | Distributed cache |

---

## Technology Stack

### Backend
- **Runtime:** .NET 10.0
- **API:** ASP.NET Core Web API
- **Database:** MongoDB + MongoDB.Entities ORM
- **Messaging:** MassTransit + Apache Kafka / RabbitMQ
- **Job Scheduling:** Quartz.NET
- **Validation:** Corvus.Json.Validator (JSON Schema 2020-12)
- **Cache:** Hazelcast (distributed, in-memory)
- **Monitoring:** OpenTelemetry, Serilog, Prometheus

### Frontend
- **Framework:** React 19 + TypeScript 5
- **UI Library:** Ant Design 5.x (RTL-enabled)
- **State:** React Query (TanStack)
- **i18n:** i18next (Hebrew/English)
- **Code Editor:** Monaco Editor
- **Charts:** Recharts
- **Build:** Vite / React Scripts

### Infrastructure
- **Container:** Docker
- **Orchestration:** Kubernetes (Minikube for dev)
- **Monitoring:** Prometheus (dual) + Grafana + Elasticsearch
- **Tracing:** Jaeger via OpenTelemetry

---

## OCP Compatibility Requirements (v0.1.1-rc3+)

### Security Context (Required for all pods)
```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: container-name
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
```

### Port Requirements
- All services use non-privileged ports (>1024)
- Frontend: 8080 (not 80)
- Docusaurus docs: 8080 (not 80)

### Image Requirements
- All images pinned to specific versions (no :latest)
- imagePullPolicy: IfNotPresent (not Never)
- Non-root USER in Dockerfiles

### Network Policies
- Default deny-all-ingress policy
- Explicit allow rules for service communication

### OCP-Specific Resources
- Routes (alternative to Ingress)
- SCC (Security Context Constraints): use restricted-v2

---

## Project Structure

```
EZ/
├── src/
│   ├── Services/                    # Backend microservices
│   │   ├── Shared/                  # Shared library
│   │   │   ├── Configuration/       # DI setup (Database, MassTransit, OTEL)
│   │   │   ├── Connectors/          # Data source connectors (Local, FTP, SFTP, Kafka, HTTP)
│   │   │   ├── Converters/          # Format converters (CSV, JSON, XML, Excel)
│   │   │   ├── Entities/            # Base entities & domain models
│   │   │   ├── Messages/            # Event contracts (12+ event types)
│   │   │   ├── Consumers/           # Base consumer class
│   │   │   └── Monitoring/          # BusinessMetrics, DataProcessingMetrics
│   │   ├── DataSourceManagementService/  # CRUD, connection testing, 16 APIs
│   │   ├── ValidationService/           # Schema validation with caching
│   │   ├── FileProcessorService/        # Format conversion, file processing
│   │   ├── FileDiscoveryService/        # File polling and discovery
│   │   ├── SchedulingService/           # Quartz.NET job scheduling
│   │   ├── OutputService/               # Multi-destination output
│   │   ├── MetricsConfigurationService/ # Business metrics, PromQL
│   │   ├── InvalidRecordsService/       # Invalid record management
│   │   └── DataSourceChatService/       # AI assistant (optional)
│   └── Frontend/                    # React application
│       ├── src/
│       │   ├── pages/               # Route components
│       │   ├── components/          # Reusable UI components
│       │   ├── services/            # API clients
│       │   ├── utils/               # Schema validation, data generation
│       │   ├── types/               # TypeScript interfaces
│       │   └── i18n/                # Internationalization
│       └── tests/e2e/               # Playwright tests
├── k8s/                             # Kubernetes manifests
│   ├── configmaps/                  # Service configurations
│   ├── deployments/                 # Microservice deployments
│   ├── infrastructure/              # MongoDB, Kafka, Prometheus, etc.
│   ├── services/                    # Service definitions
│   └── ingress/                     # Ingress routing
├── tools/                           # Development tools
│   ├── DemoDataGenerator/           # Generate demo data
│   └── ServiceOrchestrator/         # Service lifecycle management
├── scripts/                         # PowerShell scripts
│   ├── start-port-forwards.ps1     # Port forwarding (CRITICAL)
│   ├── bootstrap-k8s-cluster.ps1   # Cluster setup
│   └── setup-dev-environment.ps1   # Dev environment setup
├── docs/                            # Documentation
│   └── planning/                    # Implementation plans
└── test-data/                       # Test data files
```

---

## Service Architecture

### Service Structure Pattern
Each microservice follows this structure:
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
- **Namespaces:** `DataProcessing.[ServiceArea]`
- **Interfaces:** `I` prefix (e.g., `IDataSourceService`)
- **Services:** `Service` suffix (e.g., `DataSourceService`)
- **Consumers:** `Consumer` suffix (e.g., `FileDiscoveredEventConsumer`)
- **Entities:** Inherit from `DataProcessingBaseEntity`
- **Events:** `[Action]Event` suffix (e.g., `FileDiscoveredEvent`)

### Service Implementation Pattern
- Interfaces with `I` prefix
- Services with dependency injection via constructor
- OpenTelemetry activity tracing with `DataProcessingMetrics.ActivitySource`
- Structured logging with correlation IDs
- Try-catch with metric counters for failures

### Consumer Pattern
- Inherit from `DataProcessingConsumerBase<TEvent>`
- Override `ProcessMessageAsync` for message handling
- Automatic correlation ID tracking from message context

---

## Message Broker Configuration

### Kafka Topics
- `dataprocessing.scheduling.filepolling`
- `dataprocessing.filesreceiver.validationrequest`
- `dataprocessing.validation.completed`
- `dataprocessing.global.processingfailed`

### Kafka Dual Listener
- **INTERNAL (9092):** Pod-to-pod cluster communication
- **EXTERNAL (9094):** External/localhost access via port-forward

### Message Contract
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

---

## Database Configuration

### MongoDB
- **Database Name:** `ezplatform`
- **Connection:** Environment variable `ConnectionStrings__DefaultConnection`
- **Direct Connection:** Use `?directConnection=true` for replica set bypass

### Entity Base
```csharp
public class DataProcessingBaseEntity
{
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }  // Soft delete
    public Guid CorrelationId { get; set; }
    public int Version { get; set; }  // Optimistic concurrency
}
```

### Hazelcast Cache
```yaml
Maps:
  file-content:    # FileProcessor → ValidationService
  valid-records:   # ValidationService → OutputService

TTL Settings:
  time-to-live-seconds: 300    # 5 minutes
  max-idle-seconds: 180        # 3 minutes
  eviction-policy: LRU
  max-size: 256MB per map
```

---

## Frontend Development

### API Integration
```typescript
// Service layer pattern - src/services/
const apiClient = {
  async getDataSources(): Promise<ApiResponse<DataSource[]>> {
    const response = await fetch(`${API_BASE_URL}/api/v1/datasources`);
    return response.json();
  }
};

// ApiResponse wrapper
interface ApiResponse<T> {
  data: T;
  isSuccess: boolean;
  message?: string;
}
```

### RTL/Hebrew Support
```typescript
// Document direction
document.documentElement.dir = isRTL ? 'rtl' : 'ltr';

// Ant Design
<ConfigProvider direction={isRTL ? 'rtl' : 'ltr'}>

// Technical fields stay LTR
<Input className="ltr-field" />  // regex, paths, URLs, PromQL
```

### Component Organization
```
src/components/
├── datasource/          # Data source CRUD
│   ├── tabs/            # Form tabs (7 tabs)
│   └── modals/          # Dialogs
├── metrics/             # Metrics configuration
│   ├── AlertRuleBuilder.tsx
│   ├── FormulaBuilder.tsx
│   └── PromQLExpressionHelper.tsx
├── schema/              # JSON schema management
│   ├── RegexHelperDialog.tsx
│   └── SchemaTemplateLibrary.tsx
├── layout/              # App layout
└── invalid-records/     # Invalid record handling
```

---

## Testing Strategy

### E2E-First Approach
```
        ┌──────────────────┐
        │ E2E Tests (60%) │  ← Primary focus (6 scenarios - ALL PASSING)
        └──────────────────┘
             ┌────────────┐
             │ Integration│  ← Critical paths (83 tests - ALL PASSING)
             │ Tests (25%)│
             └────────────┘
                  ┌────┐
                  │Unit│  ← Critical logic (25 tests)
                  │15% │
                  └────┘
```

### E2E Scenarios (All Passing)
1. **E2E-001:** Basic pipeline (FileDiscovery → Validation → Output)
2. **E2E-002:** Large file processing (100+ records)
3. **E2E-003:** Invalid records handling
4. **E2E-004:** Multi-destination output (Folder + Kafka)
5. **E2E-005:** Scheduled polling verification
6. **E2E-006:** Error recovery & retry logic

### Known Test Gaps
⚠️ **To be addressed in future releases:**
- Multiple file formats (XML, Excel, JSON) - Only CSV fully tested
- High load testing (10,000+ records) - Max tested: 100 records
- Multi-destination scaling (4+ destinations) - Only 2 destinations tested

### Test Commands
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

---

## Kubernetes Operations

### Namespace
All resources in `ez-platform` namespace.

### Common Commands
```bash
# Full deployment
bash k8s/deploy-all.sh

# Check status
kubectl get pods -n ez-platform
kubectl get svc -n ez-platform

# View logs
kubectl logs -f deployment/fileprocessor -n ez-platform
kubectl logs -f deployment/validation -n ez-platform --tail=100

# Pod debugging
kubectl exec -it <pod-name> -n ez-platform -- /bin/bash
kubectl describe pod <pod-name> -n ez-platform

# Service restart
kubectl rollout restart deployment/fileprocessor -n ez-platform

# Scale deployment
kubectl scale deployment fileprocessor --replicas=5 -n ez-platform

# Resource usage
kubectl top pods -n ez-platform
kubectl get events -n ez-platform --sort-by='.lastTimestamp'
```

### ConfigMap Updates
```bash
# View current config
kubectl get configmap services-config -n ez-platform -o yaml

# Edit config
kubectl edit configmap services-config -n ez-platform

# Restart services to pick up changes
kubectl rollout restart deployment/fileprocessor -n ez-platform
```

### Health Checks
```bash
# Check readiness
curl http://localhost:5001/health
curl http://localhost:5003/health

# Detailed health
curl http://localhost:5001/health/detailed
```

---

## Monitoring & Observability

### Access URLs (after port-forwarding)
- **Grafana:** http://localhost:3001 (admin/admin)
- **Jaeger:** http://localhost:16686
- **Prometheus System:** http://localhost:9090
- **Prometheus Business:** http://localhost:9091
- **Elasticsearch:** http://localhost:9200

### Business Metrics (20 Total)
```
Counters:
  business_records_processed_total
  business_invalid_records_total
  business_files_processed_total
  business_jobs_completed_total
  business_bytes_processed_total

Histograms:
  business_processing_duration_seconds
  business_end_to_end_latency_seconds
  business_validation_latency_seconds

Gauges:
  business_active_jobs
  business_files_pending
```

### Metric Labels
- `data_source`, `service`, `status`, `error_type`
- `file_type`, `pipeline_stage`, `output_destination`
- Business context: `category`, `supplier_name`, `schedule_type`

### OpenTelemetry Pipeline
```
Services → OTEL Collector (4317/4318)
    ├── System Metrics → Prometheus System (9090) → Grafana
    ├── Business Metrics → Prometheus Business (9091) → Grafana
    ├── Logs → Elasticsearch (9200) → Grafana
    └── Traces → Jaeger (16686)
```

### Two-Tier Logging Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE CONTAINERS                     │
│  (MongoDB, Kafka, Elasticsearch, Hazelcast, Zookeeper, etc.)    │
│                                                                 │
│  Container Logs → Fluent Bit DaemonSet → Elasticsearch          │
│                   (k8s/deployments/fluent-bit.yaml)             │
│                   Index: ez-logs-YYYY.MM.DD                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION SERVICES                          │
│  (FileProcessor, Validation, Output, Scheduling, etc.)          │
│                                                                 │
│  Serilog → OTEL Collector → Elasticsearch + Jaeger + Prometheus │
│           (OTLP gRPC 4317)                                      │
│                                                                 │
│  Pipeline: Logs   → elasticsearch:9200 (dataprocessing-logs)    │
│            Traces → jaeger:4317 + elasticsearch:9200            │
│            Metrics→ prometheus-system + prometheus-business     │
└─────────────────────────────────────────────────────────────────┘
```

**Key Implementation Files:**
- `k8s/deployments/fluent-bit.yaml` - Infrastructure log collection
- `k8s/infrastructure/otel-collector.yaml` - Application telemetry
- `src/Services/Shared/Configuration/LoggingConfiguration.cs` - Serilog setup

---

## Development Workflow

### Start Development Environment
```powershell
# 1. Start Kubernetes cluster (if not running)
minikube start

# 2. Deploy infrastructure
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/infrastructure/

# 3. Wait for infrastructure
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s

# 4. Deploy services
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# 5. Start port forwarding (CRITICAL)
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"

# 6. Access frontend
start http://localhost:7000
```

### Generate Demo Data
```powershell
cd tools/DemoDataGenerator
dotnet run

# Incremental mode (adds to existing)
dotnet run -- --incremental
```

### Service Rebuild & Deploy
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

## Configuration

### Environment Variables
```
ConnectionStrings__DefaultConnection    # MongoDB
ConnectionStrings__DatabaseName         # Database name override
Kafka__Brokers                          # Kafka bootstrap servers
OpenTelemetry__OtlpEndpoint             # OTEL Collector
Hazelcast__Servers                      # Hazelcast cluster
```

### appsettings.json Structure
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "mongodb://localhost:27017",
    "DatabaseName": "ezplatform"
  },
  "Kafka": {
    "Brokers": "localhost:9094"
  },
  "OpenTelemetry": {
    "OtlpEndpoint": "http://localhost:4317"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

### ConfigMap Key Mappings
```yaml
# k8s/configmaps/services-config.yaml
mongodb-connection: "mongodb"
kafka-server: "kafka:9092"
hazelcast-server: "hazelcast:5701"
prometheus-endpoint: "http://prometheus:9090"
otlp-endpoint: "http://otel-collector:4317"
elasticsearch-endpoint: "http://elasticsearch:9200"
database-name: "ezplatform"
```

---

## Hebrew Localization

### Implementation
- Full RTL layout via Ant Design 5.x
- i18next for translations (200+ keys)
- `.ltr-field` CSS class for technical fields
- Hebrew error messages for all validation

### Key Files
- `src/Frontend/src/locales/he/translation.json`
- `src/Frontend/src/locales/en/translation.json`

### Hebrew Categories
10 business categories fully translated: Sales, Finance, HR, Inventory, Customer Service, Marketing, Logistics, Operations, R&D, Procurement.

---

## Troubleshooting

### Common Issues

**Port already in use:**
```powershell
# Kill existing kubectl processes
taskkill /F /IM kubectl.exe

# Restart port forwards
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

**Pod not starting:**
```bash
# Check events
kubectl get events -n ez-platform --sort-by='.lastTimestamp'

# Check pod logs
kubectl logs <pod-name> -n ez-platform --previous

# Check resource limits
kubectl describe pod <pod-name> -n ez-platform
```

**MongoDB connection issues:**
```bash
# Check MongoDB pod
kubectl exec -it mongodb-0 -n ez-platform -- mongosh

# Verify connection string
kubectl get configmap services-config -n ez-platform -o jsonpath='{.data.mongodb-connection}'
```

**Hazelcast cache issues:**
```bash
# Check Hazelcast logs
kubectl logs -f deployment/hazelcast -n ez-platform

# Verify cluster formation
kubectl exec -it hazelcast-0 -n ez-platform -- curl http://localhost:5701/hazelcast/health
```

**Kafka connectivity:**
```bash
# Check Kafka pods
kubectl get pods -l app=kafka -n ez-platform

# Test producer (from inside cluster)
kubectl exec -it kafka-0 -n ez-platform -- kafka-console-producer.sh --bootstrap-server localhost:9092 --topic test
```

---

## Key File Locations

### Documentation
- `docs/PROJECT_STANDARDS.md` - Architecture & coding standards
- `docs/COMPREHENSIVE-PROJECT-ANALYSIS.md` - Detailed analysis
- `docs/data_processing_prd.md` - Product requirements
- `docs/planning/MVP-DEPLOYMENT-PLAN.md` - Deployment plan

### Backend Code
- `src/Services/Shared/` - Shared utilities & base classes
- `src/Services/[ServiceName]Service/` - Individual services
- `src/Services/[ServiceName]Service.Tests/` - Integration tests

### Frontend Code
- `src/Frontend/src/pages/` - Route components
- `src/Frontend/src/components/` - React components
- `src/Frontend/src/services/` - API clients

### Infrastructure
- `k8s/services-config.yaml` - Service configuration
- `k8s/infrastructure/` - Database, broker, monitoring configs
- `scripts/start-port-forwards.ps1` - Port forwarding script

---

## Byterover Knowledge Management

### Store Knowledge
Use `byterover-store-knowledge` when:
- Learning new patterns or APIs from the codebase
- Finding error solutions or debugging techniques
- Discovering reusable code patterns
- Completing significant tasks

### Retrieve Knowledge
Use `byterover-retrieve-knowledge` when:
- Starting new tasks (gather context)
- Making architectural decisions
- Debugging issues (check previous solutions)
- Working with unfamiliar code

---

## Performance Targets

- File processing: <1 second per 100-record file
- Hazelcast cache hit rate: >95%
- Service startup time: <5 seconds
- P99 API latency: <500ms

---

## Quick Reference Commands

```powershell
# Start everything
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"

# Generate demo data
cd tools/DemoDataGenerator && dotnet run

# Check all services health
curl http://localhost:5001/health; curl http://localhost:5002/health; curl http://localhost:5003/health

# View all logs
kubectl logs -f deployment/fileprocessor -n ez-platform

# Restart a service
kubectl rollout restart deployment/fileprocessor -n ez-platform

# Open monitoring
start http://localhost:3001  # Grafana
start http://localhost:16686 # Jaeger
```

---

*Last Updated: January 12, 2026*
*Version: v0.3.0*
*Status: Production Ready - Week 5 Validation Phase*

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase

# EZ Platform - Project Context

**Generated:** 2026-02-02
**Purpose:** Business and operational context supplement to technical codebase mapping
**Status:** v0.1.1-rc3 Production Ready → v0.2.0 In Progress

---

## Current Project State

### Version Status
- **Production Version:** v0.1.1-rc3 (Week 5 Validation Phase)
- **Overall Completion:** 97%
- **Next Version:** v0.2.0 - External File Access & Archive Support
- **Project Phase:** Mature brownfield project with extensive deployment history

### Architecture Overview
```
EZ Platform - Data Processing Microservices
├── Backend: .NET 10.0 (9 microservices)
├── Frontend: React 19 + TypeScript 5
├── Infrastructure: Kubernetes + Kafka + MongoDB (3-node replica set)
├── Monitoring: Prometheus (dual) + Grafana + Elasticsearch + Jaeger
└── Deployment: Docker + Helm + OCP-compatible
```

### Core Services
| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| DataSourceManagement | 5001 | ✅ Production Ready | CRUD operations, 16 APIs, 7-tab UI |
| MetricsConfiguration | 5002 | ✅ Production Ready | Business metrics, PromQL helper |
| ValidationService | 5003 | ✅ Production Ready | Schema validation with caching |
| SchedulingService | 5004 | ✅ Production Ready | Quartz.NET job scheduling |
| InvalidRecordsService | 5006 | ✅ Production Ready | Invalid record management + reprocess |
| FileDiscoveryService | 5007 | ✅ Production Ready | File polling and discovery |
| FileProcessorService | 5008 | ✅ Production Ready | Format conversion, processing |
| OutputService | 5009 | ✅ Production Ready | Multi-destination output |
| Frontend | 7000 | ✅ Production Ready | React 19 UI with RTL support |

---

## Active Work (Task Orchestrator)

### Feature 1: External File Access & Archive Support v0.2.0
**Status:** Planning (20 tasks, mostly completed)

**Completed Work:**
- ✅ Backend integration tests (all connectors)
- ✅ Infrastructure verification tests
- ✅ Session handoff procedures documented
- ✅ i18n translation keys fixed
- ✅ NFS set as default output protocol
- ✅ Admin server direction field fixed
- ✅ Local/Folder protocols removed (OCP compliance)
- ✅ Server selection UI added to Output tab
- ✅ Archive settings form mapping fixed
- ✅ Archive properties backend API fixed
- ✅ AdminServerGenerator updated with file-simulator endpoints
- ✅ Archive settings UI added
- ✅ Mandatory server selection validation
- ✅ Admin Server UI split into Input/Output tabs
- ✅ HttpApiConnector IServerConnector implementation
- ✅ LocalFileConnector IServerConnector implementation

**Pending Work:**
- 🔄 Documentation & Release package for v0.2.0
  - Update CLAUDE.md with AdminServer architecture
  - Update CLAUDE.md with ConnectorFactory pattern
  - Update CLAUDE.md with file-simulator setup
  - Update version to v0.2.0 in all docs
  - Create CHANGELOG.md for v0.2.0
  - Create GitHub release notes
- 🔄 Frontend E2E tests - Playwright scenarios for v0.2.0
  - Create admin server via UI (FTP type)
  - Create datasource with admin server reference
  - Test archive settings UI
  - Test server selection validation
  - Test Input/Output tabs

### Feature 2: OCP Compatibility Release v0.1.1-rc2
**Status:** ✅ Completed

All OCP security requirements implemented:
- Non-root containers
- Security contexts
- Non-privileged ports (>1024)
- Network policies
- SCC compatibility

---

## Testing Status

### E2E Tests: 6/6 Complete (100%) ✅
| Test | Status | Description |
|------|--------|-------------|
| E2E-001 | ✅ Complete | Basic pipeline flow |
| E2E-002 | ✅ Complete | Large file processing (100+ records) |
| E2E-003 | ✅ Complete | Invalid records handling |
| E2E-004 | ✅ Complete | Multi-destination output (Folder + Kafka) |
| E2E-005 | ✅ Complete | Scheduled polling verification |
| E2E-006 | ✅ Complete | Error recovery and retry logic |

### Integration/Unit Tests: 83/83 Complete (100%) ✅
- Service Integration: 16/16 ✅
- Data Persistence: 12/12 ✅
- Caching & Performance: 8/8 ✅
- Output Handlers: 8/8 ✅
- Error Handling: 14/14 ✅
- Unit Tests: 25/25 ✅

### Production Validation (Week 5): 8/10 Complete
- ✅ Logs Storage (Elasticsearch) - All 8/8 services
- ✅ Metrics (Prometheus) - System + BusinessMetrics
- ✅ BusinessMetrics Integration - 20 operational metrics
- ✅ Distributed Tracing (Jaeger) - 570K+ traces
- ✅ Load Testing - 1000 files, ~21 files/sec
- ✅ Stress Test Recommendations - Horizontal scaling, monitoring
- 🔄 Failover testing - In progress
- 🔄 Security validation - In progress

---

## Key Architecture Decisions

### Connector Pattern (v0.2.0)
**Decision:** ConnectorFactory pattern for dynamic protocol selection

**Rationale:**
- Support 6 file protocols (FTP, SFTP, S3/MinIO, HTTP/WebDAV, SMB, NFS)
- Unified `IDataSourceConnector` interface
- Runtime protocol resolution from datasource configuration
- Separate Input (FileDiscovery, FileProcessor) and Output (OutputService) handlers

**Implementation:**
```
ConnectorFactory.GetConnector(dataSource)
  ↓
Resolves connector type from:
  1. AdditionalConfiguration["ConnectorType"]
  2. ConfigurationSettings.connectionConfig.type
  3. FilePath prefix detection (s3://, ftp://, etc.)
  4. Default to "local"
```

### Admin Server Pattern (v0.2.0)
**Decision:** Two-tier architecture with AdminServer entities

**Benefits:**
- Centralized connection management
- Reusable server configurations
- Separation of concerns (server vs datasource)
- Input/Output direction separation in UI

**Structure:**
```
AdminServer (connection details)
  ↓
DataSource (polling, schema, validation)
  ↓
FileDiscovery → FileProcessor → Validation → Output
```

### Message Broker: Kafka Dual Listener
**Decision:** Two listeners for cluster-internal and external access

```yaml
INTERNAL: kafka-0:9092 (pod-to-pod)
EXTERNAL: localhost:9094 (port-forward access)
```

**Rationale:**
- Internal: Service-to-service communication
- External: Development, testing, integration tests
- Advertised listeners prevent connection failures

### Database: MongoDB DirectConnection
**Decision:** Use `?directConnection=true` for replica set bypass

**Rationale:**
- Replica set requires internal DNS names
- Port-forwarding doesn't resolve internal hostnames
- DirectConnection allows localhost testing

### Cache: Hazelcast with TTL Safety
**Decision:** Explicit cleanup + TTL fallback

**Maps:**
- `file-content`: FileProcessor → ValidationService
- `valid-records`: ValidationService → OutputService

**Settings:**
- TTL: 5 minutes (auto-expire if not cleaned)
- Idle timeout: 3 minutes
- Eviction: LRU
- Max size: 256MB per map

**Rationale:**
- Explicit cleanup is primary strategy
- TTL provides fallback safety if cleanup fails
- Prevents memory leaks from orphaned entries

---

## Known Issues & Resolutions

### Critical Bugs Fixed (Production)

#### Session 6 Defects (December 9, 2025)
- ✅ **BUG-001 (P0):** Hazelcast empty address list - Fixed with single-address config
- ✅ **BUG-002 (P0):** MongoDB database mismatch - Changed to "ezplatform"
- ✅ **BUG-003 (P0):** Stream disposal in ConvertToJsonAsync - Separate stream instances

#### Session 9 Defects (December 10, 2025)
- ✅ **BUG-004 to BUG-012:** 9 critical bugs fixed in 3.1 hours
  - Database name standardization (ValidationService, InvalidRecordsService)
  - FilePattern glob pattern fix (CSV → *.csv)
  - Hazelcast caching issues (ValidRecordsData population)
  - Output service validation status mismatch
  - Output service Hazelcast map mismatch
  - Output destination type mismatch

#### Session 17-19 Optimizations (December 15-17, 2025)
- ✅ **BUG-013:** Replaced Newtonsoft.Json.Schema with Corvus.Json.Validator (license issue)
- ✅ Hazelcast cache cleanup bugs (OutputService, ValidationService)
- ✅ Memory optimization: Hazelcast 4GB→512MB, ValidationService 6Gi→512Mi
- ✅ Hazelcast TTL configuration for automatic cleanup

#### Week 4 Integration Test Discoveries (December 17, 2025)
- ✅ Kafka external access: Dual listener configuration required
- ✅ MongoDB directConnection: Replica set bypass for localhost
- ✅ InvalidRecords API: Hyphenated URL `/api/v1/invalid-records`
- ✅ REST API property naming: Uppercase "ID" not "Id"
- ✅ Datasource unique keys: Add GUID suffix to prevent conflicts

### Known Limitations

**Test Gaps (Deferred to Phase 2):**
- Multiple file formats (XML, Excel, JSON) - Only CSV fully tested
- High load testing (10,000+ records) - Max tested: 1,000 files
- Multi-destination scaling (4+ destinations) - Only 2 destinations tested

**Frontend Placeholders:**
- Dashboard page (85% complete)
- Notifications page (placeholder)
- AI Assistant page (placeholder)

---

## Configuration Management

### Critical ConfigMaps

#### services-config.yaml
Central configuration for all services:
```yaml
mongodb-connection: "mongodb://mongodb:27017"
database-name: "ezplatform"
kafka-server: "kafka:9092"
hazelcast-server: "hazelcast:5701"
otlp-endpoint: "http://otel-collector:4317"
elasticsearch-endpoint: "http://elasticsearch:9200"
```

#### file-simulator-config.yaml (v0.2.0)
External file access endpoints:
```yaml
SIMULATOR_HOST: "172.23.17.71"
FILE_FTP_PORT: "30021"
FILE_SFTP_PORT: "30022"
FILE_S3_ENDPOINT: "http://172.23.17.71:30900"
FILE_SMB_HOST: "10.101.173.233"  # LoadBalancer IP
FILE_NFS_MOUNT_PATH: "/mnt/nfs"
```

### Environment-Specific

**Development (Minikube):**
- File simulator: Separate Minikube profile
- Cross-cluster access: NodePort services
- NFS: NFSv4 single port (32149)
- SMB: Requires `minikube tunnel` for LoadBalancer

**Production (OCP):**
- Credentials: Kubernetes Secrets (never ConfigMaps)
- NFS: Enterprise PersistentVolume
- Network Policies: Restrict egress to known IPs
- TLS/SSL: Enabled for all external protocols

---

## Port Forwarding Requirements

### CRITICAL: Use Centralized Script
```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

**Never use individual `kubectl port-forward` commands.**

### All 18 Required Ports
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
| Kafka | 9094 | Event streaming (EXTERNAL) |
| RabbitMQ | 5672 | Message broker |
| Hazelcast | 5701 | Distributed cache |

---

## Monitoring & Observability

### Two-Tier Logging Architecture

**Tier 1: Infrastructure Containers**
```
MongoDB, Kafka, Elasticsearch, Hazelcast, Zookeeper
  ↓
Fluent Bit DaemonSet
  ↓
Elasticsearch (ez-logs-YYYY.MM.DD)
```

**Tier 2: Application Services**
```
All 9 microservices
  ↓
Serilog → OTEL Collector (gRPC 4317)
  ↓
├── Elasticsearch (dataprocessing-logs)
├── Jaeger (distributed traces)
└── Prometheus (system + business metrics)
```

### Business Metrics (20 Total)

**Counters:**
- `business_records_processed_total`
- `business_invalid_records_total`
- `business_files_processed_total`
- `business_jobs_completed_total`
- `business_bytes_processed_total`

**Histograms:**
- `business_processing_duration_seconds`
- `business_end_to_end_latency_seconds`
- `business_validation_latency_seconds`

**Gauges:**
- `business_active_jobs`
- `business_files_pending`

**Labels:** `data_source`, `service`, `status`, `error_type`, `file_type`, `pipeline_stage`, `output_destination`

### Distributed Tracing

**Status:** ✅ 570K+ traces collected
- TraceID correlation across 10 services
- W3C Trace Context propagation via MassTransit
- ConversationID persisted across pipeline
- Elasticsearch backend for persistence

---

## Hebrew/RTL Support

### Implementation Status: ✅ 100% Complete

**Frontend Features:**
- Full RTL layout via Ant Design 5.x
- i18next for translations (200+ keys)
- `.ltr-field` CSS class for technical fields (regex, paths, URLs, PromQL)
- Hebrew error messages for all validation
- 10 business categories fully translated

**Technical Fields (LTR):**
- Regex patterns
- Cron expressions
- PromQL formulas
- File paths
- URLs
- Connection strings

**RTL Bug Fix History:**
- Original bug: Technical fields reversed character-by-character
- Fix: CSS infrastructure + field-by-field application
- Status: 100% complete (all components fixed)

---

## Development Workflow

### Start Development Environment
```powershell
# 1. Start Kubernetes cluster
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

## Documentation Structure

### Planning Documents (270+ files)
```
docs/
├── planning/
│   ├── Phase-MVP-Deployment/        # 5-week deployment plan
│   │   ├── MVP-DEPLOYMENT-PLAN.md   # Master plan
│   │   ├── SESSION-*.md             # Daily session logs
│   │   └── Testing/                 # Test catalog and logs
│   ├── FILE-ACCESS-INTEGRATION-PLAN.md  # v0.2.0 detailed plan
│   └── InvalidRecords/              # Feature-specific docs
├── architecture/                    # System architecture
├── frontend/                        # Frontend architecture
├── deployment/                      # Deployment guides
├── testing/                         # Test reports
├── troubleshooting/                 # Known issues and fixes
└── releases/                        # Release notes
```

### Key Documents
- `CLAUDE.md` - Project overview and critical patterns (this file)
- `PROJECT_STANDARDS.md` - Architecture and coding standards
- `COMPREHENSIVE-PROJECT-ANALYSIS.md` - Detailed project status
- `data_processing_prd.md` - Product requirements
- `MVP-DEPLOYMENT-PLAN.md` - 5-week deployment master plan

---

## Next Steps (Based on Current State)

### Immediate (v0.2.0 Completion)
1. **Documentation Updates**
   - Update CLAUDE.md with AdminServer architecture
   - Update CLAUDE.md with ConnectorFactory pattern
   - Document file-simulator setup procedures
   - Update version numbers to v0.2.0
   - Create CHANGELOG.md

2. **Frontend E2E Tests**
   - Playwright scenarios for admin server CRUD
   - Playwright scenarios for datasource with admin server
   - Archive settings UI tests
   - Server selection validation tests

3. **Release Preparation**
   - GitHub release notes
   - Migration guide (v0.1.1 → v0.2.0)
   - Breaking changes documentation

### Phase 2 (Deferred Items)
- Advanced Notifications system
- Extended Dashboard features
- AI Assistant integration
- Comprehensive unit test coverage
- Multi-format E2E tests (XML, Excel, JSON)
- 10K+ load testing

---

## Critical Success Factors

### What Made This Project Successful

1. **E2E-First Testing Strategy**
   - 6 comprehensive E2E scenarios as primary quality gate
   - Integration/unit tests supplement E2E for critical paths
   - Test-driven debugging approach (fix-test-retest cycle)

2. **Incremental Deployment Approach**
   - Week-by-week deployment plan with clear milestones
   - Daily session logs with detailed progress tracking
   - Defect identification and immediate resolution

3. **Clean Architecture Implementation**
   - SOLID principles throughout
   - Dependency injection for all services
   - Clear separation of concerns

4. **Comprehensive Observability**
   - Two-tier logging (Fluent Bit + OTEL)
   - Dual Prometheus (system + business metrics)
   - Distributed tracing with Jaeger
   - Grafana dashboards for visualization

5. **Documentation Culture**
   - 270+ markdown files covering all aspects
   - Daily session summaries
   - Architectural decision records (implicit)
   - Troubleshooting guides with root cause analysis

---

## Project Timeline

**Key Milestones:**
- October 2025: Project inception, Phase 1-3 implementation
- November 2025: Schema management, metrics configuration
- December 2-6, 2025: Week 1-2 (Connection testing, K8s deployment)
- December 8-15, 2025: Week 3 (E2E testing, 6/6 complete)
- December 15-17, 2025: Week 4 (Integration testing, 83/83 complete)
- December 17-24, 2025: Week 5 (Production validation, 8/10 complete)
- January 2026: v0.2.0 development (External File Access)

**Current:** January 2026 - v0.2.0 feature completion + final testing

---

**Document Status:** Living Document
**Last Updated:** 2026-02-02 (Post-codebase mapping)
**Maintained By:** Development Team + AI Assistant
**Review Frequency:** Weekly during active development

---

## References

### Task Orchestrator
- Feature ID: 808f01f8-b6c2-47fd-9e34-485c160f808f (v0.2.0)
- Feature ID: 5dee2c78-b357-4199-8476-9f0f0cd2dab7 (v0.1.1-rc2)

### Critical Documentation Files
- `.planning/codebase/STACK.md` - Technology stack details
- `.planning/codebase/ARCHITECTURE.md` - System design patterns
- `.planning/codebase/STRUCTURE.md` - Directory layout
- `.planning/codebase/CONVENTIONS.md` - Code style and patterns
- `.planning/codebase/TESTING.md` - Test structure and practices
- `.planning/codebase/INTEGRATIONS.md` - External services
- `.planning/codebase/CONCERNS.md` - Technical debt and issues
- `docs/planning/Phase-MVP-Deployment/MVP-DEPLOYMENT-PLAN.md` - Deployment master plan
- `docs/planning/FILE-ACCESS-INTEGRATION-PLAN.md` - v0.2.0 implementation plan

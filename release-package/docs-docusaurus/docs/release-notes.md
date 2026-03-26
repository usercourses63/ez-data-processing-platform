---
sidebar_position: 2
---

# EZ Platform - Release Notes

---

## v0.5.0 - Auto-Revalidation & Invalid Records Management (March 2026)

**Status:** Production Release
**Type:** Feature Release - Auto-Revalidation, Schema Versioning, Invalid Records TTL

### Highlights

This release delivers **automatic revalidation** of invalid records when datasource schemas change,
**schema version tracking** for audit trails, **TTL-based cleanup** of expired invalid records,
and a **YAML schema download** option.

### Auto-Revalidation
- Schema changes automatically trigger revalidation of all non-ignored invalid records
- Records that pass the new schema are routed to output destinations
- Records that still fail get updated error messages reflecting the new schema
- Rate-limited batching (100 records/batch) prevents system overload

### Manual Revalidation
- "Revalidate All" button on invalid records page header (respects active filters)
- "Revalidate All" button on schema tab (scoped to current datasource, visible when invalid records exist)
- Confirmation popover shows record count before execution

### Schema Versioning
- SchemaVersion auto-increments on every schema change
- ValidatedWithSchemaVersion tracks which schema version validated each record
- Visual schema version tags on invalid records

### Invalid Records TTL
- Global default: 4 days retention before automatic hard delete
- Per-datasource override in basic info tab
- Daily purge job at 03:00 UTC

### YAML Schema Download
- "Download YAML" button alongside existing JSON download in schema editor
- Frontend-only conversion using js-yaml library

### Migration Notes
- New Kafka topic: `dataprocessing.schema.updated`
- New ConfigMap key: `invalid-records-ttl-days: 4`
- InvalidRecordsService requires SignalR hub configuration
- Quartz.NET purge job added to InvalidRecordsService

---

## v0.4.0 - Datasource Productivity Features (March 2026)

**Status:** Production Release
**Type:** Feature Release - Clone, Import from File, Completeness Checklist

### Highlights

This release delivers three productivity features for datasource management:
**Clone Datasource** for quick duplication, **Import from File** for auto-creating
datasources from sample data files, and **Completeness Checklist** for real-time
form guidance.

### Clone Datasource
- Duplicate any datasource from the list page or edit page
- All settings preserved: schema, connection, archive settings, output destinations
- Schedule disabled by default to prevent accidental pipeline execution

### Import from File
- Upload CSV/JSON/XML/Excel files to auto-create datasources
- Archive support (ZIP, TAR.GZ, 7Z, RAR) including encrypted archives
- Smart schema inference with type detection and pattern matching
- Data preview before applying to form

### Completeness Checklist
- Real-time progress tracking with color-coded field borders
- Per-tab completion status in sidebar panel
- Auto-disable for incomplete datasources
- Missing fields navigation for quick form completion

### Migration Notes
- No database migration required (frontend-only features)
- Backend archive API endpoints added (SharpCompress): `/api/v1/archive/analyze`, `/api/v1/archive/extract`
- nginx `client_max_body_size` should be set to at least 100MB for archive uploads
- Frontend image must be rebuilt (new components for clone, import, completeness)

### Known Limitations
- Excel import processes only the first sheet
- Archive files >100MB may experience slower processing
- Completeness percentage includes recommended fields (not just required)

---

## v0.3.0 - NAS UX + Monitoring + Pipeline Fixes (March 2026)

**Status:** Production Release
**Type:** Feature Enhancement - NAS UX improvements, monitoring stability, pipeline reliability

### Highlights

This release delivers **NAS device UX improvements** with SignalR-based real-time sync across browser tabs, **monitoring stability fixes** for Device Health and pipeline visualization, and **pipeline reliability fixes** for server credential handling and protocol parsing.

### NAS UX Improvements

- **SignalR Entity Broadcasts (NAS-12, NAS-13)**: Creating, updating, deleting, or toggling Servers and Categories in any browser tab instantly propagates changes to all connected clients via SignalR EntityChanged events
- **Delete Auto-Deprovision (NAS-14)**: Deleting a NAS device automatically cleans up Kubernetes PV/PVC resources before performing soft-delete, preventing orphaned cluster resources
- **Status Tags i18n (NAS-15)**: NAS connection status tags (connected/disconnected) now use i18n translation keys, displaying correctly in both Hebrew and English
- **Role Enum Fix (NAS-16)**: Backend NAS Role enum accepts string values ("Input", "Output", "Both", "Backup") from frontend via JsonStringEnumConverter, fixing the numeric enum mismatch

### Data Pipeline Fixes

- **FileServerId Extraction (PIPE-06)**: FileServerId correctly extracted from ConfigurationSettings when creating or updating datasources
- **NasDeviceId Extraction (PIPE-07)**: NasDeviceId and NasSubPath properly extracted from ConfigurationSettings
- **FTP URL Parsing (PIPE-08)**: FTP connector parses `ftp://` URLs to extract host and port separately, instead of using the entire URL as hostname
- **Server Credentials (PIPE-09)**: Credentials auto-populated from AdminServer.TypeSpecificConfig when creating file discovery and processing connections
- **NAS ConnectionString Optional (PIPE-10)**: ConnectionString field no longer required for NAS datasources since mount path is derived from provisioned PV

### Monitoring Fixes

- **Device Health HTTP Fallback (MON-15)**: Device Health tab loads data via HTTP polling when SignalR connection is unavailable, preventing blank tab on WebSocket failures
- **SignalR Case Mapping (MON-16)**: SignalR data mappers handle both camelCase and PascalCase property names, fixing data display issues when backend serialization changes
- **RabbitMQ Queue Monitoring (MON-17)**: Queue monitoring queries RabbitMQ management API instead of Kafka, matching the actual message broker used by pipeline services
- **Pipeline Flow Service IDs (MON-18)**: Service identifiers in pipeline flow visualization match actual Kubernetes deployment names (e.g., `fileprocessor` not `FileProcessorService`)
- **Traces Relative Timing (MON-19)**: Traces tab queries all pipeline services and displays spans with correct relative timing from trace start

### Migration from v0.2.0

**Backward compatible** -- no breaking changes. Standard Helm upgrade:

```bash
helm upgrade ez-platform ./helm/ez-platform -f values-local.yaml --namespace ez-platform
```

No database migration required. All changes are backward-compatible service updates.

---

## v0.2.0 - Production Release (March 2026)

**Status:** Production Release
**Type:** Feature Release - NAS Management, OTEL Observability, Device Health, SignalR Real-Time Dashboard, File-Simulator Integration, E2E Validation

### Highlights

This major release introduces **NAS device management**, **OTEL observability verification** across all 8 microservices, **device health monitoring** with automated Quartz.NET checks, **SignalR real-time dashboard** with WebSocket streaming, **file-simulator integration** for multi-protocol testing, and comprehensive **E2E validation** of the full data processing pipeline.

### New Features

#### NAS Device Management (Phase 12)

- **Dynamic NAS provisioning**: Configure NAS devices via Admin UI with automatic Kubernetes PV/PVC creation
- **Role-based devices**: Assign Input, Output, Both, or Backup roles to NAS devices with color-coded indicators
- **Mount status monitoring**: Real-time display of PV/PVC provisioning status
- **Connection testing**: Verify NAS connectivity before provisioning
- **NFS protocol support**: Full NFS v3/v4 support with configurable mount options

#### OTEL Observability (Phase 14)

- **Full OTEL verification**: All 8 deployed microservices verified with 3 signals (24/24 checks)
- **Structured logs**: Serilog -> OTEL Collector -> Elasticsearch (`dataprocessing-logs` index)
- **Distributed traces**: OTEL SDK -> OTEL Collector -> Jaeger (port 16686)
- **Metrics**: OTEL SDK -> OTEL Collector -> Prometheus System (9090) + Business (9091)
- **DataSourceManagement rebuilt**: v0.2.0-otel image with Serilog logging

#### Device Health Monitoring (Phase 15)

- **Automated health checks**: Quartz.NET job every 30 seconds for all NAS and AdminServer devices
- **Status tracking**: Healthy (0 failures) / Degraded (1-2 failures) / Down (3+ failures)
- **Latency thresholds**: NAS 2000ms, AdminServer 5000ms
- **MongoDB TTL history**: Health check results with automatic cleanup
- **Frontend UI**: Device Health tab with status cards, summary bar, 15s polling

#### SignalR Real-Time Updates (Phase 16)

- **WebSocket monitoring**: SignalR hub at `/hubs/monitoring` for live data streaming
- **Dual-speed broadcast**: 5-second fast data (services, Kafka) / 30-second slow data (traces, events)
- **Connection recovery**: Automatic reconnection with configurable backoff
- **Frontend integration**: Connection status indicator, React Query polling fallback

#### File-Simulator Integration (Phase 17)

- **DemoDataGenerator integration**: `--use-simulator` mode for multi-protocol testing
- **Dynamic server creation**: `--create-servers` flag creates FTP/SFTP/NAS via simulator API
- **Multi-protocol upload**: FileUploadService supports all configured protocols

#### E2E Validation (Phase 18)

- **Playwright E2E infrastructure**: beforeAll/afterAll setup modules with protocol-aware fixtures
- **Pipeline validation**: Full pipeline completion and output comparison tests
- **RTL-safe interactions**: Ant Design tab clicks via dispatchEvent pattern
- **Validation report**: E2E-VALIDATION-REPORT.md tracking all test results

#### Enhanced Protocol Support

- **Comprehensive protocol testing**: FTP, SFTP, HTTP, S3, SMB, NFS, Kafka, Local connectors
- **File-simulator integration**: Unified testing environment for all protocols
- **Protocol x format matrix**: Automated testing of all protocol and format combinations

#### CI/CD Automation

- **GitHub Actions pipeline**: Multi-job CI with build, test, and Docker stages
- **Parallel Docker builds**: All 10 services built with version injection
- **Helm chart updates**: Charts at v0.2.0 with smoke test hooks
- **Docusaurus documentation portal**: Deployed at `/docs` path

#### Documentation Portal

- **Docusaurus 3.x**: Full documentation portal with search
- **Component documentation**: Detailed guides for all UI components including System Monitoring and Device Health
- **Development guides**: API coordination, React 19 patterns
- **Hebrew user guide**: Native Hebrew documentation with RTL support
- **Sidebar restructured**: Monitoring category added, Legacy labels removed

### API Changes

#### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/nasdevices` | GET | List NAS devices |
| `/api/v1/nasdevices` | POST | Create NAS device |
| `/api/v1/nasdevices/{id}` | GET | Get NAS device by ID |
| `/api/v1/nasdevices/{id}` | PUT | Update NAS device |
| `/api/v1/nasdevices/{id}` | DELETE | Delete NAS device |
| `/api/v1/nasdevices/{id}/provision` | POST | Provision K8s resources |
| `/api/v1/nasdevices/{id}/deprovision` | POST | Remove K8s resources |
| `/api/v1/nasdevices/{id}/test` | POST | Test NFS connection |
| `/api/v1/health-status` | GET | All device health statuses |
| `/api/v1/health-status/{id}` | GET | Single device health |
| `/hubs/monitoring` | SignalR | Real-time monitoring WebSocket hub |

#### Changed Endpoints

- `POST /api/v1/datasources` - Now accepts `nasDeviceId` for NAS protocol connections

### Configuration Changes

#### Helm Values

```yaml
# New in values.yaml
datasource-management:
  rbac:
    enabled: true  # Enable NAS device RBAC (default: true)
```

#### RBAC Requirements

NAS device management requires Kubernetes RBAC permissions:
- `persistentvolumes`: create, get, list, delete, watch
- `persistentvolumeclaims`: create, get, list, delete, watch

Applied via: `k8s/rbac/nas-device-rbac.yaml`

### Breaking Changes

- **NFS protocol removed from connection dropdown**: Use NAS device selection instead
- Direct NFS path entry no longer supported; configure NAS devices in Admin settings

### Migration Guide

#### From v0.1.1-rc3

**Step 1: Backup existing data**
```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongodump --db=ezplatform --out=/tmp/backup
```

**Step 2: Apply RBAC for NAS management**
```bash
kubectl apply -f k8s/rbac/nas-device-rbac.yaml
```

**Step 3: Helm upgrade**
```bash
helm upgrade ez-platform ./helm/ez-platform -f values.yaml
```

**Step 4: Migrate existing NFS data sources**

For each data source using NFS:
1. Create a NAS device in **Admin > NAS Devices** with the same NFS server/path
2. Click "Provision" to create PV/PVC
3. Edit the data source, change protocol to NAS, select the device
4. Verify connection with "Test Connection"

**Step 5: Verify RBAC**
```bash
kubectl get clusterrolebinding nas-device-manager-binding
kubectl auth can-i create persistentvolumes --as=system:serviceaccount:ez-platform:datasource-management
```

### Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Protocol connectors | 32 | All passing (skip when deps unavailable) |
| Format converters | 63 | All passing |
| Pipeline flows | 17 | 3 pass, 14 skip (require file-simulator) |
| E2E tests | 6 | All passing |
| RTL visual regression | 12 | All passing |

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| File processing | &lt;1s per 100-record file | Standard file sizes |
| NAS mount time | &lt;5s | Initial PVC bind |
| Cache hit rate | &gt;95% | Hazelcast efficiency |
| P99 API latency | &lt;500ms | End-user experience |

---

## v0.1.1-rc2 (January 8, 2026)

**Status:** Release Candidate 2
**Type:** OCP Compatibility & Security Hardening

### Highlights

This release focuses on **OpenShift Container Platform (OCP) compatibility** with comprehensive security hardening for enterprise Kubernetes deployments.

### New Features

#### OCP/OpenShift Compatibility
- **SecurityContext for all pods**: `runAsNonRoot: true`, `runAsUser: 1000`, `fsGroup: 1000`
- **Container SecurityContext**: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`
- **seccompProfile**: RuntimeDefault for all workloads
- **Non-privileged ports**: Frontend and docs changed from port 80 to 8080
- **OCP Routes**: Alternative to Ingress for OpenShift deployments

#### Network Security
- **NetworkPolicies**: Default deny-all-ingress with explicit allow rules
- **Pod isolation**: Inter-service communication whitelisted explicitly
- **Namespace isolation**: All traffic restricted to ez-platform namespace

#### Image Management
- **Version pinning**: All images use specific versions (no `:latest` tags)
- **Image pull policy**: Changed to `IfNotPresent` for production
- **Non-root users**: All Dockerfiles updated with USER directive

#### PowerShell Scripts
- **Windows-native deployment**: All bash scripts converted to PowerShell
- **deploy-all.ps1**: Complete deployment automation
- **install.ps1/uninstall.ps1**: Installation management

### Bug Fixes

#### OCP-Specific Fixes
- **Nginx PID permission error**: Custom nginx-main.conf with PID in `/tmp/nginx.pid`
- **Fluent-bit volume mount**: Changed DB path from `/var/log/flb_kube.db` to `/tmp/flb_kube.db`
- **Default nginx page override**: Clear `/usr/share/nginx/html/*` before copying custom content

#### Configuration Updates
- **Frontend Dockerfile**: Added non-root nginx user (UID 1001)
- **Docs-Docusaurus Dockerfile**: OCP-compatible nginx configuration
- **All deployments**: SecurityContext added consistently

### Technical Improvements
- Comprehensive DEPLOYMENT-TROUBLESHOOTING-GUIDE.md with OCP section
- CLAUDE.md updated with OCP requirements
- README.md updated with OCP deployment instructions

### Deployment Changes
- SCC (Security Context Constraints): restricted-v2 compatible
- All containers drop ALL capabilities
- PodSecurityPolicy/PodSecurityStandard: restricted

### Upgrade from v0.1.1-rc1
- **Backward Compatible:** Yes
- **Breaking Changes:** Port change from 80 to 8080 for frontend/docs
- **Migration Required:** Update port-forward scripts, Ingress/Route configurations

---

## v0.1.1-rc1 (January 1, 2026)

**Status:** Release Candidate 1
**Type:** Production Readiness Update

### New Features

#### Swagger/OpenAPI Integration
- Added interactive API documentation to all 8 backend services
- Swagger UI accessible at `/swagger` endpoint on each service
- OpenAPI 3.0 specification with full endpoint documentation
- Services: DataSourceManagement, FileDiscovery, FileProcessor, Validation, Output, InvalidRecords, Scheduling, MetricsConfiguration

#### Frontend Enhancements
- **Splash Screen:** Added EZ Platform branded splash screen on app startup
- **Logo Integration:** EZ Platform logo in application header (ez-platform-logo.svg)
- **Hebrew Localization:** Splash screen and branding text in Hebrew and English

### Bug Fixes

#### Critical Fixes
- **MetricsConfigurationService:** Fixed MongoDB connection and health check configuration
- **Frontend Documentation:** Fixed USER-GUIDE-HE.md not loading in help page
- **Frontend Routing:** Corrected nginx.conf API proxy routes to use `/api/v1/` prefix correctly
- **Error Messages:** Standardized error format to Corvus.Json.Validator format

#### Configuration Updates
- **services-config.yaml:** Added `database-name: "ezplatform"` for consistent database naming
- **Probe Timings:** Increased health check timeouts for MetricsConfigurationService (60s liveness, 30s readiness)
- **Image Pull Policy:** Changed to `Never` for offline deployment compatibility

### Technical Improvements
- Enhanced frontend Docker build with explicit documentation copy
- Updated nginx configuration with proper proxy headers
- Improved error message parsing in frontend error parser
- Standardized demo data generator to use Corvus format

### Deployment Changes
- Updated image tags from v0.1.0-beta to v0.1.1-rc1 (9 images)
- Modified ConfigMap with database-name key
- Adjusted health check probe settings for production stability

### Upgrade from v0.1.0-beta
- **Backward Compatible:** Yes
- **Breaking Changes:** None
- **Migration Required:** No (clean deployment recommended)

---

## v0.1.0-beta (December 29, 2025)

**Status:** Beta Release for Testing & Demonstration
**Type:** Pre-Release

### Overview

First beta release of EZ Platform - a data processing platform for file discovery, format conversion, schema validation, and multi-destination output with full Hebrew/RTL support.

**Target Audience:** Early adopters, testing teams, demonstration environments

---

## What's New in v0.1.0-beta

### 🎯 Core Features

#### Data Processing Pipeline
- **File Discovery Service**: Automated file polling from Local, SFTP, FTP, HTTP, and Kafka sources
- **Format Conversion**: CSV, JSON, XML, Excel format support with intelligent conversion
- **Schema Validation**: JSON Schema 2020-12 validation with Corvus.Json.Validator
- **Multi-Destination Output**: Simultaneous output to multiple folders and Kafka topics
- **Invalid Records Handling**: Dedicated service for managing validation failures

#### Category Management (NEW in BETA)
- ✅ **Admin-Managed Categories**: Create, edit, delete datasource categories via Admin UI
- ✅ **Smart Delete**: Permanent removal if unused, soft delete if in use
- ✅ **Auto-Migration**: Existing category values automatically migrated
- ✅ **Rename Propagation**: Category renames update all datasources automatically
- ✅ **Hebrew/English Names**: Bilingual category support

#### User Interface
- **React 19 Frontend**: Modern responsive interface with Ant Design 5.x
- **Full Hebrew/RTL Support**: Complete right-to-left layout with Hebrew translations
- **DataSource Management**: 7-tab form for complete datasource configuration
- **Schema Builder**: Visual JSON Schema editor with templates
- **Metrics Configuration**: Business metrics with PromQL integration
- **Alerts Management**: Create and manage alert rules
- **Invalid Records UI**: Browse, edit, and reprocess invalid records

#### Monitoring & Observability
- **Dual Prometheus**: Separate system and business metrics
- **Grafana Dashboards**: Pre-configured dashboards for monitoring
- **Jaeger Tracing**: Distributed tracing with Elasticsearch persistence
- **Elasticsearch Logging**: Centralized log aggregation
- **Business Metrics**: 20+ business KPIs tracked

---

## Technical Specifications

### Architecture
- **Microservices:** 9 services (.NET 10.0)
- **Internal Messaging:** RabbitMQ via MassTransit (service-to-service events)
- **External Messaging:** Apache Kafka (data source inputs & output destinations)
- **Database:** MongoDB with MongoDB.Entities ORM
- **Cache:** Hazelcast distributed cache
- **Scheduler:** Quartz.NET for job scheduling
- **Orchestration:** Kubernetes (tested on Minikube v1.37.0)

**Messaging Architecture:**
- RabbitMQ handles internal events (FileDiscovered, ValidationCompleted, etc.)
- Kafka handles external data sources and outputs (configurable by users)
- MassTransit abstracts both brokers with unified API

### Service Inventory
1. **DataSourceManagementService** (Port 5001): CRUD, connection testing, category management
2. **FileDiscoveryService** (Port 5005): File polling and discovery
3. **FileProcessorService** (Port 5008): Format conversion
4. **ValidationService** (Port 5003): Schema validation
5. **OutputService** (Port 5009): Multi-destination output
6. **SchedulingService** (Port 5004): Quartz.NET job scheduling
7. **InvalidRecordsService** (Port 5007): Invalid record management
8. **MetricsConfigurationService** (Port 5002): Business metrics API
9. **Frontend** (Port 3000): React application

### Infrastructure Components
- **MongoDB 7.0**: 3-node replica set (data persistence)
- **RabbitMQ 3.x**: Message broker for MassTransit (internal service communication)
- **Apache Kafka 3.x**: 3-node cluster with Zookeeper (external data sources/outputs)
- **Hazelcast 5.x**: 2-node distributed cache
- **Prometheus**: Dual instances (system + business metrics)
- **Grafana 10.x**: Visualization and dashboards
- **Elasticsearch 8.x**: Log aggregation and Jaeger trace storage
- **Jaeger**: Distributed tracing (Elasticsearch backend)
- **OpenTelemetry Collector**: Unified telemetry pipeline

---

## Installation

### Prerequisites
- Kubernetes cluster (v1.25+)
- kubectl configured
- 16GB RAM minimum
- 50GB storage
- Helm 3.x (recommended)

### Quick Start
```bash
# Apply Kubernetes manifests
kubectl create namespace ez-platform
kubectl apply -f k8s/infrastructure/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

# Start port forwarding (18 services)
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1

# Access frontend
http://localhost:3000
```

**See:** [Installation Guide](/docs/installation) for detailed instructions

---

## API Reference

### DataSource Management API
```
Base URL: http://localhost:5001/api/v1

# DataSources
GET    /datasource              - List with pagination
GET    /datasource/{id}         - Get by ID
POST   /datasource              - Create
PUT    /datasource/{id}         - Update
DELETE /datasource/{id}         - Delete
POST   /datasource/{id}/test    - Test connection

# Categories (NEW)
GET    /categories              - List categories
POST   /categories              - Create category
PUT    /categories/{id}         - Update category
DELETE /categories/{id}         - Smart delete
PATCH  /categories/{id}/toggle-active - Toggle active
GET    /categories/{id}/usage-count   - Get usage info
```

### Other Services
- **Validation**: http://localhost:5003/api/v1/validation
- **Scheduling**: http://localhost:5004/api/v1/scheduling
- **Metrics**: http://localhost:5002/api/v1/metrics
- **Invalid Records**: http://localhost:5007/api/v1/invalidrecords

---

## Configuration

### Environment Variables
```yaml
ConnectionStrings__DefaultConnection: mongodb://mongodb:27017
ConnectionStrings__DatabaseName: ezplatform
Kafka__Brokers: kafka:9092
OpenTelemetry__OtlpEndpoint: http://otel-collector:4317
Hazelcast__Servers: hazelcast:5701
```

### Default Credentials
- **Grafana**: Username: `admin`, Password: `EZPlatform2025!Beta`
- **MongoDB**: No authentication (dev mode)

---

## Known Limitations (Beta Release)

### Functional Limitations
1. **No User Authentication**: Single-user mode, no login required
2. **No Multi-Tenancy**: Single tenant per installation
3. **Limited Error Recovery**: Some edge cases in retry logic
4. **Manual Scaling**: Horizontal scaling requires manual configuration

### Performance Notes
- Tested with up to 10,000 records per file
- Tested with up to 1,000 concurrent files
- Recommended limits: 100 files/minute, 5,000 records/file

### Testing Coverage
- ✅ E2E Testing: 6/6 scenarios passing
- ✅ Integration Tests: 83 tests passing
- ⚠️ Load Testing: Limited to 10K records
- ⚠️ Format Testing: All formats tested individually

### Known Issues
1. Elasticsearch security disabled (xpack.security=false) - Enable for production
2. Category list doesn't support custom ordering (alphabetical only)
3. Translation keys might be missing in some edge cases
4. Bundle size larger than recommended (~725KB gzipped)

---

## Upgrade Path

This is the initial beta release. No upgrade path exists yet.

**Future releases will include:**
- Migration scripts for database schema changes
- Breaking change documentation
- Backward compatibility notes

---

## Breaking Changes

None (initial release)

---

## Performance Metrics

### Baseline Performance (100-file test)
- **End-to-end latency**: ~45 seconds
- **Processing rate**: ~60-80 files/minute
- **Record throughput**: ~10,000 records/minute
- **Memory usage**: 2-4GB total (all services)
- **CPU usage**: 2-3 cores under load

### Hazelcast Cache
- **Hit rate**: >95%
- **TTL**: 1 hour (configurable)
- **Memory**: 256MB per map

---

## Security Notes

### Beta Release Security Posture
✅ **Secured:**
- Grafana credentials in K8s Secret (base64)
- Jaeger traces persist in Elasticsearch
- HTTPS ready (configured, not enforced)
- Security headers enabled in services

⚠️ **Not Production-Ready:**
- MongoDB without authentication
- Elasticsearch security disabled
- No network policies
- No pod security policies
- No secrets encryption at rest

**For Production:**
- Enable MongoDB authentication
- Enable Elasticsearch xpack.security
- Implement network policies
- Add pod security policies
- Use external secret management (Vault, Sealed Secrets)

---

## Monitoring Access

**After port-forwarding:**
- **Frontend**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/EZPlatform2025!Beta)
- **Jaeger**: http://localhost:16686
- **Prometheus System**: http://localhost:9090
- **Prometheus Business**: http://localhost:9091
- **Elasticsearch**: http://localhost:9200

---

## Documentation

- **Installation Guide**: [Installation](/docs/installation)
- **Admin Guide**: [Admin Guide](/docs/admin)
- **User Guide (Hebrew)**: [User Guide](/docs/user-guide/)
- **Architecture**: [System Architecture](/docs/architecture/system-architecture)
- **Deployment Guide**: [Deployment Plan](/docs/deployment/deployment-plan)

---

## Testing

### E2E Test Scenarios (All Passing)
1. ✅ E2E-001: Basic pipeline (FileDiscovery → Validation → Output)
2. ✅ E2E-002: Large file processing (100+ records)
3. ✅ E2E-003: Invalid records handling
4. ✅ E2E-004: Multi-destination output (Folder + Kafka)
5. ✅ E2E-005: Scheduled polling verification
6. ✅ E2E-006: Error recovery & retry logic

**Test Data:** Located in `test-data/` directory

---

## Support

### Reporting Issues
- **GitHub Issues**: [Repository Issues](https://github.com/usercourses63/ez-data-processing-platform/issues)
- **Documentation**: See `docs/` directory

### Common Issues
See [Troubleshooting Guide](/docs/admin#troubleshooting)

---

## Contributors

- Development Team: Data Processing Platform Team
- Testing: QA Team
- Documentation: Technical Writing Team

---

## License

[Specify license here]

---

## Changelog

### v0.1.0-beta (2025-12-29)

**Added:**
- Initial microservices architecture (9 services)
- React frontend with Hebrew/RTL support
- Admin-managed category system
- Smart delete with usage tracking
- DataSource list filters (category + status)
- MongoDB persistence with MongoDB.Entities
- Kafka messaging with MassTransit
- Hazelcast distributed caching
- OpenTelemetry observability stack
- Grafana dashboards
- Jaeger distributed tracing with Elasticsearch
- JSON Schema validation
- Multi-format file processing
- Multi-destination output
- Quartz.NET job scheduling

**Security:**
- Grafana password secured in K8s Secret
- Jaeger Elasticsearch persistence enabled

**Testing:**
- 6 E2E scenarios (100% passing)
- 83 integration tests (100% passing)
- Load testing up to 10,000 records

**Documentation:**
- Installation guide
- Admin guide
- Hebrew user guide
- API documentation

---

## Next Release (Planned)

**v0.5.0 (Estimated: Q3 2026)**
- User authentication & authorization
- Multi-tenancy support
- Advanced scheduling options
- Performance optimizations
- Enhanced monitoring dashboards

---

*For installation instructions, see [Installation Guide](/docs/installation)*
*For user documentation, see [Hebrew User Guide](/docs/user-guide/)*
*For administrator documentation, see [Admin Guide](/docs/admin)*

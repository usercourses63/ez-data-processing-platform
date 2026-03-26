---
sidebar_position: 2
---

# Changelog

All notable changes to EZ Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - 2026-03-26

### Added

#### Clone Datasource
- Clone from list page actions menu or edit page header button
- Pre-fills all form fields including schema, connection, archive settings, output destinations
- Cloned name prefixed with "Copy of" (Hebrew: "העתק של")
- Output destinations get new unique IDs; schedule disabled by default
- Archive settings (format, password, inner file path) preserved in clone

#### Import from File
- Upload CSV, JSON, XML, or Excel sample files to auto-create datasources
- Archive support: ZIP, TAR.GZ, 7Z, RAR (including password-protected via SharpCompress backend)
- Client-side file analysis with type detection (integer, number, boolean, date, string)
- Smart constraint suggestions (email format, phone patterns, date formats) via schemaAutoSuggest
- Preview table shows parsed data before applying to form
- Headerless CSV generates synthetic field names (field_1, field_2, ... field_N)
- Auto-create datasource on "Continue" (not just pre-fill)
- Backend CsvToJsonConverter maps headerless CSV columns by schema field position order

#### Completeness Checklist
- Real-time completeness percentage on create and edit forms
- Per-tab completion status with color-coded indicators (red=required, green=filled, amber=recommended, gray=optional)
- Clickable incomplete items navigate directly to the corresponding tab
- Missing fields panel shows which fields need attention
- Mini progress ring in datasource list for at-a-glance status
- Auto-disable toggle for datasources below required completeness threshold
- AJV schema validation for field-level completeness checking

#### Documentation
- Hebrew user guide completely refactored into workflow-centric chapters
- Automated Playwright screenshot pipeline for documentation
- Mermaid diagram support added to Docusaurus
- Per-feature Hebrew chapters: Import from File, Clone, Completeness

---

## [0.3.0] - 2026-03-20

### Added

#### NAS UX Improvements
- SignalR EntityChanged broadcasts on Servers controller (create/update/delete/toggle-active)
- SignalR EntityChanged broadcasts on Categories controller (create/update/delete/reorder/toggle-active)
- NAS delete auto-deprovisions K8s PV/PVC before soft-delete
- NAS status tags use i18n keys (connected/disconnected in Hebrew and English)
- NAS Role enum accepts both string and numeric values (JsonStringEnumConverter)
- NAS full lifecycle E2E test (create, connect, provision, deprovision, delete)

#### Data Pipeline Fixes
- FileServerId extracted from ConfigurationSettings JSON on datasource create/update
- NasDeviceId and NasSubPath extracted from ConfigurationSettings JSON
- FTP connector parses ftp:// URLs for host/port instead of passing full URL as hostname
- Server credentials auto-populated from AdminServer.TypeSpecificConfig
- ConnectionString made optional for NAS datasources
- FileDiscoveryService Dockerfile added for source builds

#### Monitoring Improvements
- Device Health tab crash fixed (SignalR camelCase normalization)
- HTTP polling fallback for Device Health (not blocked by SignalR connection)
- All SignalR mappers handle both camelCase and PascalCase via dual-casing helper
- RabbitMQ Management API monitoring replaces Kafka for queue status
- Pipeline flow lanes use real K8s deployment names
- Traces tab queries all 6 pipeline services with relative span timing
- Service names shortened (strip DataProcessing. prefix) with tooltip for full name
- Metrics overview latency precision rounded to 1 decimal place

#### Release Infrastructure
- SANITY-11: NAS pipeline sanity test (create datasource with NAS device via UI)
- Deployment package with 10 service + 11 infrastructure image tars
- Helm chart updated to v0.3.0
- Frontend version display updated to v0.3.0

### Changed
- Monitoring queues tab shows RabbitMQ/MassTransit queues instead of Kafka topics
- FileDiscovery DeduplicationTTLHours changed from 0.25 to 1 (integer required)
- Pipeline deployments include hostAliases for file-simulator.local cross-cluster access

### Fixed
- Cluster header showing empty values (SignalR camelCase property mapping)
- MetricsOverviewCards crashing on undefined values (defensive ?? 0 fallbacks)
- DeviceHealthSummaryBar crashing on undefined counts
- DistributedTracing showing absolute timestamps instead of relative span timing

---

## [0.2.0] - 2026-03-17

### Added

#### NAS Device Management (Phase 12)
- NasDevice entity with role-based classification (Input/Output/Both/Backup)
- NasDevicesController with full CRUD and provisioning endpoints
- NasResourceService for dynamic Kubernetes PV/PVC creation
- NfsConnector for NFS protocol file operations
- Frontend NasDevicesTab for device management UI
- RBAC manifests for Kubernetes API access (`k8s/rbac/nas-device-rbac.yaml`)
- Connection testing and mount status monitoring

#### OTEL Observability (Phase 14)
- All 8 deployed microservices verified: structured logs, distributed traces, metrics
- DataSourceManagement service rebuilt with Serilog OTEL logging (v0.2.0-otel)
- Automated OTEL verification script: 24/24 checks pass (8 services x 3 signals)
- OpenTelemetry__OtlpEndpoint env var added to all k8s deployments

#### Device Health Monitoring (Phase 15)
- Quartz.NET health check job (30-second interval)
- Consecutive failure tracking: Healthy (0) / Degraded (1-2) / Down (3+)
- Configurable latency thresholds: NAS 2000ms, AdminServer 5000ms
- MongoDB TTL storage for health check history
- REST API: GET /api/v1/health-status
- Frontend Device Health tab with status cards, summary bar, 15s polling
- HeartOutlined icon in System Monitoring page tab bar

#### Protocol File Operations Testing (Phase 15.1)
- Backend file operation REST proxy endpoints (List/Read/Write) for all server protocols
- Playwright test infrastructure for protocol x format matrix testing
- Static device testing (Scenario A): all protocols tested against file-simulator
- Dynamic device testing (Scenario B): FTP, SFTP, NAS created via simulator API
- Protocol x format matrix report with pass/fail per combination

#### SignalR Real-Time Updates (Phase 16)
- MonitoringBroadcaster singleton hosted service with dual-speed broadcast (5s/30s)
- SignalR hub at /hubs/monitoring for WebSocket connections
- CORS: SetIsOriginAllowed + AllowCredentials for SignalR WebSocket
- Short-lived Kafka AdminClient per call (avoids connection pooling)
- Frontend useMonitoringHub hook with connection recovery
- Connection status dot indicator in ClusterHeader
- React Query conditional polling fallback when SignalR disconnected
- PascalCase mapper functions for backend-frontend data bridge

#### File-Simulator Integration (Phase 17)
- DemoDataGenerator --use-simulator mode for multi-protocol testing
- FileSimulatorClient for REST API communication
- FileGeneratorService for test data generation
- FileUploadService for multi-protocol file upload
- ServerCredentials.FromBsonDocument for credential resolution
- Dynamic server creation via --create-servers flag

#### E2E Validation (Phase 18)
- Playwright E2E test infrastructure with beforeAll/afterAll setup modules
- Protocol-aware test fixtures matching DemoDataGenerator SimpleTransaction schema
- Ant Design RTL-safe tab interaction (dispatchEvent pattern)
- Flexible assertions for loading/empty/data states
- E2E validation report (E2E-VALIDATION-REPORT.md)
- Pipeline completion and output comparison tests

#### Protocol Testing
- FileSimulatorFixture for unified protocol testing
- FTP connector tests (3 tests)
- SFTP connector tests (3 tests)
- HTTP API connector tests (2 tests)
- S3/MinIO connector tests (3 tests)
- SMB connector tests (3 tests via SMBLibrary)
- NFS connector tests (6 tests, K8s pod context)
- Kafka connector tests (6 tests)
- Local file connector tests (6 tests, OCP-Incompatible trait)

#### CI/CD Infrastructure
- GitHub Actions multi-job pipeline (build, test, docker)
- Parallel Docker build script (`scripts/build-all-images.ps1`)
- Version injection for all services (VERSION, COMMIT_SHA)
- Docusaurus Docker build with version injection
- Helm charts updated to v0.2.0 with smoke test hooks

#### Documentation
- NAS/NFS architecture section in system-architecture.md
- Component documentation (datasource-forms, schema-editor, nas-devices, system-monitoring, device-health)
- Development guides (API coordination, React 19 patterns)
- Hebrew user guide updated with NAS/archive/monitoring sections
- Help button integration with docs portal
- Sidebar restructured with Monitoring category, no Legacy labels

#### Testing
- E2E schema management tests (20+ test cases)
- RTL visual regression tests with 30% threshold
- Help integration E2E tests
- Bidirectional format tests (14 round-trip tests)
- Pipeline flow tests (7 E2E, 10 format-specific)
- Load tests (10/100/1000 file volumes)

### Changed
- Connection tab requires NAS device selection for NFS protocol
- NFS protocol renamed to NAS in UI dropdown
- Helm chart version aligned: Chart.yaml 0.2.0, appVersion v0.2.0
- Docusaurus baseUrl changed to `/docs/` for path-based routing
- Ingress rules updated with /docs path before / catch-all

### Deprecated
- `AdditionalConfiguration` field on DataSource (use `FileServerId` or `NasDeviceId` instead)

### Removed
- Standalone NFS protocol option (use NAS device instead)
- Direct NFS path entry in Connection tab

### Security
- RBAC for Kubernetes PV/PVC operations
- OCP-compatible security contexts on all pods
- Non-root container execution

### Documentation
- docs/testing/protocol-test-guide.md - Protocol test documentation
- docs/testing/format-pipeline-test-guide.md - Format and pipeline testing
- docs/deployment/rollback-procedures.md - Rollback runbook
- docs/deployment/smoke-test-guide.md - Smoke test guide
- docs/deployment/documentation-workflow.md - GSD to Docusaurus sync

---

## [0.1.1-rc1] - 2026-01-01

### Added
- Swagger/OpenAPI documentation to all backend services (17 commits)
- Frontend splash screen with EZ Platform branding
- EZ Platform logo in SVG format (ez-platform-logo.svg)
- Hebrew and English translations for branding elements
- database-name ConfigMap key for consistent database naming
- Deployment plan documentation in MkDocs site

### Changed
- Updated nginx.conf with correct `/api/v1/` API routing (4 new routes added)
- Increased MetricsConfigurationService health check timeouts (liveness: 30s→60s, readiness: 15s→30s)
- Changed global imagePullPolicy from `Always` to `Never` for offline deployment
- Standardized error messages to Corvus.Json.Validator format in DemoDataGenerator
- Enhanced frontend Docker build with explicit USER-GUIDE-HE.md copy

### Fixed
- MetricsConfigurationService MongoDB connection configuration
- USER-GUIDE-HE.md not loading in frontend help page
- Frontend API routing to backend services (was using incorrect paths)
- Corvus error parser field name extraction and Hebrew translation
- Frontend-to-backend communication issues

### Technical
- 17 commits since v0.1.0-beta
- 38 files modified across deployment, configuration, and source code
- 9 Docker images rebuilt with Swagger integration
- Updated Helm chart to version 1.1.0
- Helm chart appVersion updated to 0.1.1-rc1

---

## [0.1.0-beta] - 2025-12-29

### Added

#### Core Features
- **Admin Category Management**: Full CRUD for datasource categories with Hebrew/English support
- **Smart Delete**: Intelligent category deletion (hard delete if unused, soft delete if in use)
- **Category Auto-Migration**: Automatically migrates existing category values from datasources
- **Rename Propagation**: Category renames update all associated datasources
- **DataSource List Filters**: Filter by category and status

#### Services
- DataSourceManagementService with category management API
- FileDiscoveryService for automated file polling
- FileProcessorService for format conversion (CSV, JSON, XML, Excel)
- ValidationService with JSON Schema 2020-12 support
- OutputService for multi-destination output
- SchedulingService with Quartz.NET
- InvalidRecordsService for error handling
- MetricsConfigurationService for business metrics
- Frontend React application with Hebrew/RTL support

#### Infrastructure
- MongoDB 7.0 (3-node replica set)
- RabbitMQ 3.x for internal messaging (MassTransit)
- Apache Kafka 3.x for external data sources/outputs
- Hazelcast 5.x distributed cache
- Elasticsearch 8.x for logs and traces
- Prometheus (dual: system + business metrics)
- Grafana with pre-configured dashboards
- Jaeger for distributed tracing
- OpenTelemetry Collector

#### Monitoring
- 26 business metrics tracked
- Distributed tracing across all services
- Centralized logging via Elasticsearch
- Pre-built Grafana dashboards

#### Documentation
- Installation Guide with volume mounting instructions
- Admin Guide with maintenance utilities
- Hebrew User Guide (מדריך למשתמש)
- Release Notes with RabbitMQ/Kafka architecture explained
- API endpoint documentation

#### Network Access
- NodePort service for frontend (port 30080)
- Internal LAN access configuration
- Multi-user support

### Changed
- Migrated from legacy DataProcessingMetrics to BusinessMetrics (all services)
- Updated messaging architecture documentation (RabbitMQ vs Kafka clarification)
- Enhanced button spacing in category management UI (16px gap)

### Fixed
- Grafana credentials now in K8s Secret (was hardcoded)
- Jaeger persistence using Elasticsearch (was in-memory)
- MongoDB.Entities query syntax updated for v26+
- CORS configuration for network access

### Security
- Grafana password secured with base64 encoding
- Jaeger traces persist across restarts
- Security headers enabled in all services

---

## [Unreleased]

### Planned for v0.5.0
- User authentication and authorization
- Multi-tenancy support
- Advanced scheduling options
- Performance optimizations
- Production security hardening (MongoDB auth, Elasticsearch security)

---

**For detailed release notes:** See [Release Notes](/docs/release-notes)

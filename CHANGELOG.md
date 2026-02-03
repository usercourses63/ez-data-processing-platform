# Changelog

All notable changes to EZ Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-02-03

### Added

#### NAS Device Management
- **NAS Device CRUD**: Configure NAS devices via Admin UI with name, host, export path, and role
- **Automatic Provisioning**: Kubernetes PV/PVC creation when device is provisioned
- **Connection Testing**: Verify NAS accessibility through Test Connection button
- **Device Roles**: Input (blue), Output (green), Backup (orange), Both (purple) color coding
- **Mount Status**: Real-time indication of PVC mount state in UI

#### Archive Extraction Support
- **Multi-Format Archives**: Support for ZIP, TAR.GZ, RAR, 7Z archive formats
- **Extraction Patterns**: Filter files within archives using glob patterns (e.g., *.csv)
- **Password Protection**: Support for password-protected archives
- **Nested Archives**: Configurable extraction of archives within archives
- **Security Controls**: Max file size, entry count, and depth limits (zip bomb protection)

#### Protocol Test Coverage
- **FTP/SFTP/HTTP Tests**: 8 connector tests with file-simulator integration
- **S3/SMB Tests**: 6 tests for object storage and network share protocols
- **NFS/Kafka Tests**: 12 tests covering streaming and mount-based access
- **Local Tests**: 6 tests with OCP-Incompatible trait for reference

#### CI/CD Automation
- **Docker Build Script**: Parallel builds with version injection (scripts/build-all-images.ps1)
- **GitHub Actions Pipeline**: Multi-job CI with build, test, docker stages
- **Helm Charts v0.2.0**: Both standard and OCP-compatible charts updated
- **Smoke Tests**: helm test hook validates all 10 services

#### Documentation
- **Docusaurus Portal**: Complete documentation portal with /docs routing
- **Component Documentation**: React component guides (DataSource forms, Schema editor, NAS devices)
- **Development Guides**: API coordination, React 19 patterns
- **Hebrew User Guide**: Updated with NAS and archive sections (user-guide-he.mdx)

#### E2E Test Coverage
- **NAS Device Tests**: CRUD, provisioning, connection testing, visual regression
- **AdminServer Tests**: Server CRUD, bulk operations, server-datasource linking
- **Archive Tests**: Settings UI, protocol coverage for all 5 protocols
- **Visual Regression**: RTL baselines for new UI components

### Changed
- **Connection Tab**: Uses server-based configuration for all protocols
- **NFS Protocol**: Renamed to NAS in UI (NFS is implementation detail)
- **Archive Extraction**: Centralized in FileProcessor service (connectors just fetch bytes)
- **Helm Charts**: Version 0.2.0 with environment overlays (values-dev.yaml, values-prod.yaml)
- **Docusaurus**: baseUrl changed to '/docs/' for path-based deployment

### Deprecated
- **AdditionalConfiguration**: Use FileServerId instead for server-based datasources

### Removed
- **Standalone NFS Protocol**: NFS option removed from connection dropdown (use NAS instead)

### Security
- **Archive Security Settings**: Max file size, max entry count, max depth limits
- **RBAC Manifests**: Kubernetes PV/PVC operations scoped to ez-platform namespace
- **OCP Security Contexts**: Non-root users, read-only root filesystem, dropped capabilities

### Fixed
- **NFS Mount Path**: Dynamic computation for PVC-based mounts
- **Archive Extraction**: Proper security controls prevent zip bomb attacks

---

## [0.1.1-rc3] - 2026-01-12

### Fixed
- **MongoDB Replica Set Support**: Fixed MongoDB connection string parsing for 3-node replica set deployment
  - All 8 services now properly parse `mongodb://` URIs without appending `:27017` to query strings
  - Uses `MongoClientSettings.FromConnectionString()` for replica set URIs
  - Maintains backward compatibility with simple hostname connections for local development

### Changed
- **MongoDB Configuration**: Updated ConfigMap with full replica set connection string
  - Connection string format: `mongodb://mongodb-0...27017,mongodb-1...27017,mongodb-2...27017/?replicaSet=rs0`
  - MongoDB StatefulSet scaled to 3 replicas for high availability
- **All Services Updated**: DataSourceManagement, FileProcessor, FileDiscovery, Validation, Scheduling, Output, MetricsConfiguration, InvalidRecords

### Technical Details
- Fixed `DB.InitAsync()` to detect and parse MongoDB URIs correctly
- Prevents MongoDB .NET driver from incorrectly appending default port to replica set connection strings
- Services: [Program.cs] MongoDB initialization now uses conditional URI parsing logic

---

## [0.1.1-rc2] - 2026-01-08

### Fixed
- **Frontend API Connectivity**: Fixed hardcoded localhost URLs, now using nginx proxy with relative URLs
- **Production Deployment**: Frontend now works in any Kubernetes environment without port-forward
- **Docusaurus Root Page**: Added meta refresh redirect from root to /docs/

### Changed
- **Frontend Image**: Updated to use ez-platform/frontend:v0.1.1-rc2 with nginx proxy configuration
- **Docs Image**: Updated to ez-platform/docs-docusaurus:v0.1.1-rc2 with root redirect fix
- **K8s Manifests**: Updated frontend-deployment.yaml with correct image reference

### Documentation
- **Production API Guide**: Added comprehensive API proxy configuration documentation
- **Deployment Troubleshooting**: Updated with OCP compatibility fixes (v2.0)
- **Incremental Package**: Created 132MB incremental update package (vs 4.0GB full package)

### Technical Details
- Converted 15+ TypeScript files from `localhost:5001` to relative paths
- Added nginx proxy routes for all backend services (datasource, metrics, scheduling, invalid-records)
- Verified frontend loads data correctly with Playwright browser testing

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

### Planned for v0.3.0
- User authentication and authorization
- Multi-tenancy support
- Advanced scheduling options
- Performance optimizations
- Production security hardening (MongoDB auth, Elasticsearch security)

---

**For detailed release notes:** See [release-package/docs-docusaurus/docs/release-notes.md](release-package/docs-docusaurus/docs/release-notes.md)

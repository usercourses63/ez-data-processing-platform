---
sidebar_position: 2
---

# Changelog

All notable changes to EZ Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Planned for v0.2.0
- User authentication and authorization
- Multi-tenancy support
- Advanced scheduling options
- Performance optimizations
- Production security hardening (MongoDB auth, Elasticsearch security)

---

**For detailed release notes:** See [docs/releases/RELEASE-NOTES-v0.1.0-beta.md](docs/releases/RELEASE-NOTES-v0.1.0-beta.md)

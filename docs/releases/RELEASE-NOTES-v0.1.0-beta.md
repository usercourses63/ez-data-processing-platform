# EZ Platform - Release Notes v0.1.0-beta

**Release Date:** December 29, 2025
**Status:** Beta Release for Testing & Demonstration
**Type:** Pre-Release

---

## Overview

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

**See:** [Installation Guide](../installation/INSTALLATION-GUIDE.md) for detailed instructions

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

- **Installation Guide**: [INSTALLATION-GUIDE.md](../installation/INSTALLATION-GUIDE.md)
- **Admin Guide**: [ADMIN-GUIDE.md](../admin/ADMIN-GUIDE.md)
- **User Guide (Hebrew)**: [USER-GUIDE-HE.md](../user-guide/USER-GUIDE-HE.md)
- **Project Standards**: [PROJECT_STANDARDS.md](../PROJECT_STANDARDS.md)
- **MVP Deployment Plan**: [MVP-DEPLOYMENT-PLAN.md](../planning/Phase-MVP-Deployment/MVP-DEPLOYMENT-PLAN.md)

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
See [Troubleshooting Guide](../admin/ADMIN-GUIDE.md#troubleshooting)

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

**v0.2.0 (Estimated: Q1 2026)**
- User authentication & authorization
- Multi-tenancy support
- Advanced scheduling options
- Performance optimizations
- Enhanced monitoring dashboards
- Production-grade security hardening

---

*For installation instructions, see [INSTALLATION-GUIDE.md](../installation/INSTALLATION-GUIDE.md)*
*For user documentation, see [USER-GUIDE-HE.md](../user-guide/USER-GUIDE-HE.md)*

# Changelog

All notable changes to the EZ Platform release package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.2.0] - 2026-03-18

### Added
- **NAS Lifecycle Management**: Auto-mount PV/PVC volumes to service deployments based on device role (Input -> FileDiscovery + FileProcessor, Output -> OutputService, Both -> all three). DataSource-NasDevice entity linking with mount path auto-population and PVC binding validation.
- **Device Health Monitoring**: Quartz.NET health check job (every 30s) tracking connectivity, latency, and availability for all NAS devices and AdminServers. Hebrew-aware UI with status cards and React Query polling.
- **SignalR Real-Time Updates**: MonitoringBroadcaster broadcasts health status changes to System Monitoring page in real-time. Connection recovery and polling fallback built in.
- **Protocol File Operations Testing**: Full matrix test coverage for FTP, SFTP, HTTP/WebDAV, S3, Kafka, and NFS protocols against file-simulator. Scenario A (static devices) and Scenario B (dynamic creation) both pass.
- **File-Simulator Integration**: DemoDataGenerator queries file-simulator API and seeds AdminServer + NasDevice entities. `--upload-files` flag uploads test files via multi-protocol endpoints.
- **E2E Validation Suite**: Playwright-based full pipeline flow tests (generate -> ingest -> process -> output -> compare), error/negative tests, and UI tests for all features.
- **Docusaurus Documentation Portal**: Updated documentation for all v0.2.0 features, built as standalone container, accessible via frontend Help link.
- **CI/CD Pipeline**: GitHub Actions pipeline builds all 10 application images from source, assembles versioned offline deployment packages (`deployment-{VERSION}-{YYYYMMDD}-{HHMMSS}/`), deploys via Helm on self-hosted runner, seeds with DemoDataGenerator, and validates with `@Sanity` test suite.
- **Offline Deployment Package**: Self-contained deployment folder with all 21 image tars (10 application + 11 infrastructure), Helm chart, values-local.yaml, and install scripts for air-gapped environments.
- **OCP Resource Configuration**: Proper resource requests/limits defined for all pods; security contexts (runAsNonRoot, allowPrivilegeEscalation: false, capabilities drop ALL) for OCP compliance.

### Changed
- Frontend footer displays version number injected by CI/CD build pipeline
- Local production deployment uses single-replica configuration (values-local.yaml) reducing Hazelcast memory from 8Gi to 1Gi
- Docusaurus nginx pinned to 1.28-alpine for OCP compliance
- Helm-first deployment workflow in README replaces manual kubectl apply instructions

### Fixed
- Hebrew/RTL layout regressions in Ant Design (fixed columns, Badge, Collapse icons)
- Unwanted English translations in Hebrew mode eliminated
- NAS device dropdown replaced NFS protocol selector in DataSource Connection and Output tabs
- NAS delete prevented when referenced by DataSources; cascade cleanup on deprovision

---

## [v0.1.1-rc2] - 2025-01-08

### Added
- OCP (OpenShift Container Platform) compatibility
- NetworkPolicies for pod isolation and security
- OpenShift Routes configuration (ocp-routes.yaml)
- PowerShell deployment scripts for Windows environments (install.ps1, uninstall.ps1, deploy-all.ps1)
- SecurityContext configurations for all deployments

### Changed
- Frontend port changed from 80 to 8080 (non-privileged)
- Docusaurus docs portal port changed to 8080
- All images now use pinned versions instead of :latest
- imagePullPolicy changed from Never to IfNotPresent

### Security
- Added runAsNonRoot: true for all pods
- Added allowPrivilegeEscalation: false for all containers
- Added capabilities drop ALL for containers
- Added seccompProfile: RuntimeDefault
- Hardened MongoDB, Kafka, Elasticsearch, Grafana with security contexts

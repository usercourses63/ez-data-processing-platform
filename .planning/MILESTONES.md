# Milestones

## v0.2 Production Validation & Release (Shipped: 2026-03-20)

**Phases completed:** 13 phases (11-23), 38 plans
**Key accomplishments:**
- NAS lifecycle completion (auto-mount, DataSource linking, PVC verification, delete cascade)
- Full OTEL verification across all 9 microservices
- Device health monitoring with real K8s/Prometheus/Jaeger data
- SignalR real-time monitoring (services, pods, metrics, queues, traces, device health)
- File-simulator integration (DemoDataGenerator, protocol testing)
- Release package CI pipeline (build-all-images, assemble-package, offline deploy)
- Docusaurus documentation portal, local sanity deploy scripts

**Carried to v0.3:**
- NAS UX improvements (SignalR sync, deprovision on delete, i18n)
- Monitoring fixes (camelCase normalization, RabbitMQ, pipeline lanes)
- Pipeline fixes (FileServerId, FTP connector, NasDeviceId extraction)

---

## v0.1 Testing Foundation + Infrastructure (Shipped: 2026-02-11)

**Phases completed:** 10 phases, 35 plans, 30 tasks

**Key accomplishments:**
- NAS/NFS architecture with dynamic K8s PV/PVC provisioning via .NET 10 API
- 32 protocol integration tests across 8 connectors (FTP, SFTP, S3, SMB, NFS, HTTP, Kafka, Local)
- CI/CD pipeline (GitHub Actions) with parallel Docker builds, test quality gates, version injection
- Helm chart packaging (v0.2.0) with OCP deployment, smoke tests, and rollback procedures
- Documentation audit (402 files), archive, and consolidation into GSD single source of truth
- Frontend workflow: component docs, Playwright E2E tests, RTL/Hebrew verification, Docusaurus portal

**Incomplete items carried to next milestone:**
- Plan 10-04 (Release Validation) not executed
- FEAT-01/02/03 requirements pending
- Hebrew/RTL bugs, unwanted English translations
- NFS→NAS protocol dropdown fix needed
- See .planning/milestones/v0.1-MILESTONE-AUDIT.md for full tech debt list

---


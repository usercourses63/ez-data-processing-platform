# Phase 13: AdminServer & Feature Completion - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete AdminServer integration with file-simulator-suite, NAS device selection in DataSource forms, and establish the DemoDataGenerator → file-simulator → EZ pipeline connection. This phase bridges the EZ platform with the file-simulator-suite so that subsequent E2E testing (Phase 18) can run against real protocol servers.

Key deliverables:
- DemoDataGenerator queries file-simulator API to discover/create servers and seeds EZ AdminServer settings
- NAS device selection in DataSource Connection/Output tabs with role filtering and export verification
- DataSources reference real simulator servers for all supported protocols
- Archive extraction deferred to E2E phase (backend already fully implemented)

</domain>

<decisions>
## Implementation Decisions

### DemoDataGenerator → File-Simulator Integration
- **Clean slate seeding**: DemoDataGenerator wipes existing EZ servers/NAS devices before seeding from simulator
- **Configurable server creation**: Flag to choose `--discover-only` (use existing simulator servers) or `--create-servers` (create dynamic servers in simulator before discovering them)
- **Simulator URL config**: appsettings.json default (`FileSimulator:ControlApiUrl`), CLI argument override (`--simulator-url`)
- **Config only mode**: DemoDataGenerator configures servers and DataSources; test module handles test file creation (no file uploads by DemoDataGenerator)
- **All protocols**: DemoDataGenerator configures DataSources using all supported simulator protocols — FTP, SFTP, NFS/NAS, SMB, HTTP/WebDAV, Kafka. S3 skipped unless its API can be used for test comparison (files not accessible from Windows folders)
- **Protocol mapping**: Simulator servers → EZ AdminServer Input/Output tabs → NAS Devices tab. Each simulator server maps to the corresponding EZ entity type based on protocol

### NAS Device Selection in DataSource Forms
- **NAS dropdown → auto-test → sub-path**: When user selects NAS device, system auto-tests connection (verifies export reachable + PVC bound), then user specifies sub-path within mount
- **Role-based filtering**: Connection tab shows only Input/Both NAS devices. Output tab shows only Output/Both/Backup NAS devices. Prevents misconfiguration.
- **Unmounted NAS disabled**: NAS devices without bound PVC appear in dropdown but disabled with "Not mounted" indicator
- **Delete protection**: Already implemented in Phase 12-03 — delete blocked with Hebrew error listing referencing DataSources

### E2E Test Architecture
- **New dedicated test project**: Separate from DemoDataGenerator (e.g., `EZ.PipelineTests` or similar)
- **Black-box testing**: Tests interact only with Windows filesystem side. Protocol communication (FTP, SFTP, NFS etc.) happens inside K8s cluster between EZ and simulator. This validates correct protocol usage as in production OCP
- **Test flow**: Write input file to `C:\simulator-data\nas-input-1\` (Windows) → EZ pipeline discovers/reads/processes/validates/outputs → Read output from `C:\simulator-data\nas-output-1\` (Windows) → Compare
- **Content equivalence comparison**: Parse input and output into normalized JSON format, compare content regardless of file format (CSV input → JSON output still passes)
- **Completion detection**: Poll output folder with timeout (primary) + query EZ DataSource processing stats API (verification/fallback)
- **Protocol coverage**: All protocols tested — ensures system handles each correctly as in production

### Production-Like Deployment
- **Separate Helm values file**: `values-local-prod.yaml` with replicas: 1, reduced resources, same images as OCP production
- **Cluster topology**: Two separate Minikube profiles already running — `minikube` (EZ platform, docker driver, 192.168.49.2) and `file-simulator` (hyperv driver, 172.17.89.141)
- **Differentiation from OCP**: Single-replica for all services and infrastructure. Otherwise identical to production deployment.

### Claude's Discretion
- DemoDataGenerator internal architecture (service classes, command pattern)
- Exact API client implementation for file-simulator integration
- Test project framework choice (xUnit, NUnit, or custom runner)
- Polling intervals and timeout values for E2E completion detection
- Helm values-local-prod.yaml resource limits (memory/CPU per service)

</decisions>

<specifics>
## Specific Ideas

- File-simulator-suite codebase at `C:\Users\UserC\source\repos\file-simulator-suite` — README, docs, and examples folders contain API reference, .NET K8s integration guide, client integration guide
- File-simulator Control API: `http://file-simulator.local:30500` (NodePort 30500)
- Simulator has .NET client library (`FileSimulator.Client`) with FTP, SFTP, S3, HTTP operations
- Simulator uses SignalR hubs for real-time status updates (reference for Phase 16)
- Windows folder sync: Input servers use init container rsync; Output servers use bidirectional sidecar sync (every 30s)
- `GET /api/servers` returns all servers (static + dynamic) with connection details
- `POST /api/servers/ftp`, `/api/servers/sftp`, `/api/servers/nas` create dynamic servers
- Simulator NAS servers expose single NFS export (`/data`) — sub-path within export is what matters for file organization
- Default simulator credentials: FTP (ftpuser/ftppass123), SFTP (sftpuser/sftppass123), HTTP (httpuser/httppass123), S3 (minioadmin/minioadmin123), SMB (smbuser/smbpass123)

</specifics>

<deferred>
## Deferred Ideas

- Archive extraction E2E testing — deferred to Phase 18 (E2E Validation). Backend fully implemented.
- SignalR real-time updates — Phase 16. File-simulator already uses SignalR pattern (reference implementation).
- S3 protocol E2E testing — only if API-based comparison is feasible (files not on Windows filesystem)

</deferred>

---

*Phase: 13-adminserver-feature-completion*
*Context gathered: 2026-02-15*

# Phase 17: File-Simulator Integration - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the DemoDataGenerator ↔ file-simulator integration: generate test files (CSV, JSON), upload them to simulator servers via EZ connectors, and create full pipeline DataSources with schemas, schedules, and output destinations. The FileSimulatorClient and SimulatorSeederService already exist — this phase extends them with file generation, upload, and DataSource creation.

</domain>

<decisions>
## Implementation Decisions

### File upload strategy
- Generate CSV and JSON files only (XML and Excel deferred)
- Claude decides file content based on existing schema templates in the codebase
- 3-5 files per protocol, mix of small (10 records) and medium (100 records)
- Upload directly via Shared connectors (FtpConnector, SftpConnector, NfsConnector, etc.) — same code path the pipeline uses
- New `--upload-files` CLI flag to enable file generation + upload phase

### API documentation scope
- FileSimulatorClient IS the documentation — no separate markdown doc needed
- Trust existing endpoint coverage (health, servers, connection-info, create NAS/FTP/SFTP)
- SIM-01 satisfied by the existing client code + any inline comments added during this phase

### Device seeding completeness
- Full pipeline setup: seed AdminServers + NAS devices → create matching DataSources with schemas, schedules, and output destinations
- S3 and HTTP/WebDAV: discover and seed static servers from simulator (no dynamic creation)
- FTP, SFTP, NAS, Kafka: create dynamic servers via simulator API (existing behavior)
- Idempotent upsert pattern: check by name before creating, update if exists, safe to re-run
- DemoDataGenerator's existing `--incremental` flag aligns with this

### Claude's Discretion
- File content generation approach (use existing schema templates or create new generator)
- DataSource configuration details (cron schedule expressions, output destination types)
- Schema assignment per DataSource (match generated file format)
- Error handling for upload failures (retry, skip, or abort)
- Whether to add a `--dry-run` flag for testing without actual uploads

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DemoDataGenerator (existing code)
- `tools/DemoDataGenerator/Program.cs` — Main entry, CLI flags, pipeline orchestration
- `tools/DemoDataGenerator/Services/FileSimulatorClient.cs` — HTTP client for simulator API
- `tools/DemoDataGenerator/Services/SimulatorSeederService.cs` — Orchestrates seeding from simulator
- `tools/DemoDataGenerator/Models/SimulatorModels.cs` — Simulator API DTOs
- `tools/DemoDataGenerator/Generators/AdminServerGenerator.cs` — Server entity generation
- `tools/DemoDataGenerator/Generators/NasDeviceGenerator.cs` — NAS device generation
- `tools/DemoDataGenerator/appsettings.json` — Config (simulator URL)

### File operations (existing infrastructure)
- `src/Services/Shared/Connectors/` — All protocol connectors (FTP, SFTP, NFS, S3, HTTP)
- `src/Services/DataSourceManagementService/Services/FileOperationsService.cs` — Backend file ops proxy

### Phase 15.1 context (protocol testing patterns)
- `.planning/phases/15.1-test-all-system-devices-nas-and-protocols-file-operations-against-simulator/15.1-CONTEXT.md` — Protocol coverage decisions, simulator environment details

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileSimulatorClient`: HTTP client already covers health, servers, connection-info, create NAS/FTP/SFTP
- `SimulatorSeederService`: Orchestrates clean-slate seeding, creates dynamic servers, discovers static servers
- `FtpConnector`, `SftpConnector`, `NfsConnector`, `S3Connector`, `HttpApiConnector`: All protocol connectors with WriteFileAsync
- `--use-simulator`, `--create-servers`, `--provision-nas` flags: Already implemented in Program.cs
- `--incremental` flag: Supports idempotent re-runs

### Established Patterns
- DemoDataGenerator uses generator classes (AdminServerGenerator, NasDeviceGenerator, etc.) — follow same pattern for file content
- MongoDB.Entities for data access with `DataProcessingBaseEntity` base class
- Connector pattern: `IServerConnector.WriteFileAsync(server, credentials, filePath, content)`
- PascalCase for backend DTOs, camelCase mapping in frontend

### Integration Points
- `SimulatorSeederService.SeedFromSimulatorAsync()` — extend to include file upload + DataSource creation steps
- `Program.cs` main pipeline — add file upload step after server seeding
- Connector resolution via `ConnectorFactory` or direct instantiation per protocol type
- DataSource entity creation via MongoDB.Entities (same pattern as other generators)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key outcome: running DemoDataGenerator with `--use-simulator --upload-files` produces a complete working environment with servers, devices, files, DataSources, schemas, and schedules ready for pipeline processing.

</specifics>

<deferred>
## Deferred Ideas

- XML and Excel file generation — add when needed for broader format testing
- File-simulator API markdown documentation — client code is sufficient for now
- Dynamic S3/HTTP server creation — simulator may not support this

</deferred>

---

*Phase: 17-file-simulator-integration*
*Context gathered: 2026-03-16*

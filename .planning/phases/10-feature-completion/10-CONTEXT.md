# Phase 10: Feature Completion - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete v0.2.0 feature work with documentation and tests. Validate NAS/NFS architecture production-ready. Includes deferred datasource-NAS integration from Phase 2.

Key deliverables:
- Datasource-NAS integration (NAS in Connection tab)
- Archive extraction E2E validation
- AdminServer and NAS device E2E tests
- v0.2.0 documentation completion
- NAS production validation in OCP

</domain>

<decisions>
## Implementation Decisions

### Datasource-NAS Integration
- NAS replaces NFS in protocol dropdown (NFS only used to access NAS devices, not as standalone)
- User selects NAS from servers dropdown (same pattern as AdminServer)
- Export dropdown shows available NFS exports, then user specifies sub-path within export
- When NAS device changes during edit: preserve export and path if compatible (same export name exists on new NAS), else clear
- Status indication: use existing Test Connection button pattern, show warning icon for unavailable NAS
- Path display: both relative (to export) and full mount path with toggle
- Unmounted NAS devices appear in dropdown but disabled with "Not mounted" indicator
- File browser works for NAS paths to browse directories via backend API
- NAS supports both input source AND output destination

### Archive Settings
- Frontend UI already exists (ArchiveSettingsSection.tsx) supporting: auto, zip, tar.gz, rar, 7z
- Archive password, extraction pattern (e.g., *.csv), and nested archives toggle already implemented
- Full E2E extraction testing required (not just UI form behavior)
- All input protocols support archive extraction: NAS, FTP, SFTP, S3, HTTP
- Archive extraction happens in FileProcessor service (single implementation, connectors just fetch bytes)
- Flow: Connector downloads archive → FileProcessor detects archive → Extracts matching files → Processes each

### E2E Test Coverage
- AdminServer priority journeys (all four):
  1. NAS device management (CRUD, mounting verification)
  2. Connection testing (all server types)
  3. Server-datasource linking (create datasource using admin server)
  4. Bulk operations (multi-select, bulk delete/status change)
- Tests run against file-simulator (real services, not mocks)
- CI must fail if file-simulator unavailable (no skip annotations)
- Visual regression tests in both LTR and RTL for new NAS/archive features

### Documentation Structure
- NAS/NFS architecture goes in ARCHITECTURE.md as dedicated section
- v0.2.0 release documentation includes:
  - Feature changelog (External File Access, NAS, Archive)
  - Migration guide (from v0.1.1-rc3)
  - API changes (new/changed REST endpoints)
  - Configuration changes (ConfigMap keys, Helm values)
- Docusaurus portal: full update with NAS/archive features
- Hebrew user guide (user-guide-he.mdx): full update with NAS and archive sections in Hebrew

### Claude's Discretion
- Exact NAS export query implementation (K8s PVC enumeration vs NAS API)
- Archive extraction library choice (SharpZipLib vs System.IO.Compression)
- E2E test file organization (single spec vs multiple)
- Documentation formatting and section ordering

</decisions>

<specifics>
## Specific Ideas

- NAS should "feel like" selecting any other server in AdminServer
- Archive extraction should be invisible to connectors — they just fetch bytes
- Test Connection button is the existing pattern for server health indication
- Hebrew documentation should be complete and native, not machine-translated

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-feature-completion*
*Context gathered: 2026-02-03*

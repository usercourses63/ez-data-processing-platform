---
phase: 17-file-simulator-integration
plan: 02
subsystem: tooling
tags: [demo-data, cli, dependency-injection, connectors, file-upload, pipeline]

requires:
  - phase: 17-file-simulator-integration
    provides: FileGeneratorService and FileUploadService from plan 01
  - phase: 01-file-simulator
    provides: ConnectorFactory and IServerConnector infrastructure
provides:
  - "--upload-files CLI flag wiring in DemoDataGenerator Program.cs"
  - "DI container setup for IConnectorFactory in CLI tool"
  - "Full pipeline: seed servers -> upload files -> create DataSources with matching patterns"
affects: [18-e2e-validation]

tech-stack:
  added: [Microsoft.Extensions.DependencyInjection, Microsoft.Extensions.Logging.Console]
  patterns:
    - "ServiceCollection-based DI in CLI tool for connector factory instantiation"
    - "simulatorFilePatterns override for server-linked DataSources"

key-files:
  created: []
  modified:
    - tools/DemoDataGenerator/Program.cs
    - tools/DemoDataGenerator/DemoDataGenerator.csproj
    - tools/DemoDataGenerator/Generators/AllGenerators.cs
    - Directory.Packages.props

key-decisions:
  - "DI container scoped to upload step only, disposed after use (minimal lifetime)"
  - "simulatorFilePatterns (*.csv, *.json) override for server-linked DataSources; unlinked DataSources keep 5-pattern variety"
  - "CPM versions added to Directory.Packages.props for DI and Logging.Console packages"

patterns-established:
  - "CLI DI pattern: ServiceCollection -> AddConnectorFactory -> BuildServiceProvider -> GetRequiredService -> Dispose"
  - "effectiveFilePattern: server-linked DataSources get simulator-compatible patterns"

requirements-completed: [SIM-02, SIM-03]

duration: 4min
completed: 2026-03-16
---

# Phase 17 Plan 02: CLI Wiring and Pipeline Integration Summary

**--upload-files CLI flag with DI-based ConnectorFactory and DataSource FilePattern alignment for full simulator pipeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T18:10:19Z
- **Completed:** 2026-03-16T18:14:40Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- DemoDataGenerator accepts --upload-files flag and sets up ServiceCollection DI for IConnectorFactory
- Upload step (3b) runs after server seeding but before DataSource creation, only when both --use-simulator and --upload-files present
- DataSources linked to simulator servers now get CSV/JSON FilePatterns matching uploaded file formats

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DI package references to DemoDataGenerator.csproj** - `e72664e` (chore)
2. **Task 2: Wire --upload-files flag, DI container, and upload step into Program.cs** - `3f2204a` (feat)
3. **Task 3: Ensure DataSourceGenerator FilePatterns align with uploaded file formats** - `9ccd581` (feat)

## Files Created/Modified
- `tools/DemoDataGenerator/DemoDataGenerator.csproj` - Added DependencyInjection, Logging, Logging.Console PackageReferences
- `Directory.Packages.props` - Added CPM version entries for new packages
- `tools/DemoDataGenerator/Program.cs` - --upload-files flag, DI container setup, Step 3b upload pipeline
- `tools/DemoDataGenerator/Generators/AllGenerators.cs` - simulatorFilePatterns override for server-linked DataSources

## Decisions Made
- DI container scoped to upload step only and disposed immediately after (minimal resource lifetime)
- simulatorFilePatterns array (*.csv, *.json) used for DataSources with server/NAS refs; DataSources without server links retain original 5-format variety (*.json, *.xml, *.csv, *.xlsx, *.txt)
- Added CPM version entries to Directory.Packages.props rather than inline versions in csproj

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full pipeline complete: `dotnet run -- --use-simulator --create-servers --upload-files --direct-connection --simulator-url http://<IP>:30500`
- Seeds servers from simulator, uploads CSV/JSON files, creates DataSources with matching patterns/schedules/schemas/outputs
- Ready for Phase 18 E2E validation testing

---
*Phase: 17-file-simulator-integration*
*Completed: 2026-03-16*

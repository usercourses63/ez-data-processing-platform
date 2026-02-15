---
phase: 13-adminserver-feature-completion
plan: 01
subsystem: tooling
tags: [http-client, file-simulator, demo-data, api-client, nas, admin-server, mongodb]

# Dependency graph
requires:
  - phase: 12-nas-lifecycle-completion
    provides: NasDevice entity with Role enum, provisioning fields
provides:
  - FileSimulatorClient HTTP client for file-simulator Control API
  - ServerMappingService mapping simulator servers to AdminServer and NasDevice entities
  - SimulatorSeederService for clean-slate API-driven seeding
  - NasDeviceGenerator for NFS/NAS protocol servers
  - CLI flags --use-simulator, --simulator-url, --discover-only, --create-servers
affects: [13-02, 13-03, 17-file-simulator-integration, 18-e2e-validation]

# Tech tracking
tech-stack:
  added: [Microsoft.Extensions.Configuration, Microsoft.Extensions.Configuration.Json, Microsoft.Extensions.Http, Microsoft.Extensions.Http.Polly]
  patterns: [simulator-api-client, server-mapping-service, cli-flag-parsing]

key-files:
  created:
    - tools/DemoDataGenerator/appsettings.json
    - tools/DemoDataGenerator/Models/SimulatorModels.cs
    - tools/DemoDataGenerator/Services/FileSimulatorClient.cs
    - tools/DemoDataGenerator/Services/ServerMappingService.cs
    - tools/DemoDataGenerator/Services/SimulatorSeederService.cs
    - tools/DemoDataGenerator/Generators/NasDeviceGenerator.cs
  modified:
    - tools/DemoDataGenerator/DemoDataGenerator.csproj
    - tools/DemoDataGenerator/Program.cs
    - Directory.Packages.props

key-decisions:
  - "Used Central Package Management (CPM) - versions in Directory.Packages.props, not csproj"
  - "Direct HttpClient instantiation in Program.cs instead of DI container (tool, not service)"

patterns-established:
  - "SimulatorClient pattern: typed HTTP client with JSON deserialization for file-simulator API"
  - "ServerMappingService pattern: protocol-specific mapping from simulator models to EZ entities"
  - "Dual-mode CLI: --use-simulator toggles between API-driven and static seeding"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 13 Plan 01: File-Simulator API Client + DemoDataGenerator Integration Summary

**FileSimulatorClient HTTP client with typed API methods, ServerMappingService for protocol-to-entity mapping, and dual-mode DemoDataGenerator with --use-simulator CLI flag**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T12:37:45Z
- **Completed:** 2026-02-15T12:43:23Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- FileSimulatorClient with GetServersAsync, GetConnectionInfoAsync, EnsureHealthyAsync, CreateNasServerAsync
- ServerMappingService mapping all protocols (FTP, SFTP, HTTP, S3, Kafka, NFS) to AdminServer/NasDevice entities
- SimulatorSeederService with clean-slate seeding (delete + discover + map + save)
- DemoDataGenerator now supports --use-simulator, --simulator-url, --discover-only, --create-servers flags

## Task Commits

Each task was committed atomically:

1. **Task 1: Create file-simulator API client infrastructure** - `133818b` (feat)
2. **Task 2: Create server mapping service and NasDevice generator** - `be140b6` (feat)
3. **Task 3: Create SimulatorSeederService and update Program.cs** - `16419ab` (feat)

## Files Created/Modified
- `tools/DemoDataGenerator/appsettings.json` - Default FileSimulator:ControlApiUrl configuration
- `tools/DemoDataGenerator/Models/SimulatorModels.cs` - Typed record models for simulator API responses
- `tools/DemoDataGenerator/Services/FileSimulatorClient.cs` - HTTP client for file-simulator Control API
- `tools/DemoDataGenerator/Services/ServerMappingService.cs` - Maps simulator servers to AdminServer/NasDevice entities
- `tools/DemoDataGenerator/Services/SimulatorSeederService.cs` - Orchestrates clean-slate seeding from simulator
- `tools/DemoDataGenerator/Generators/NasDeviceGenerator.cs` - Generates NasDevice entities for NFS/NAS servers
- `tools/DemoDataGenerator/DemoDataGenerator.csproj` - Added Configuration and Http packages
- `tools/DemoDataGenerator/Program.cs` - Added --use-simulator mode with CLI flags
- `Directory.Packages.props` - Added Microsoft.Extensions.Configuration and Http package versions

## Decisions Made
- Used Central Package Management (CPM) instead of inline version numbers in csproj - required by repo convention
- Direct HttpClient instantiation in Program.cs rather than DI container since DemoDataGenerator is a CLI tool, not a hosted service

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Central Package Management version conflict**
- **Found during:** Task 1 (adding NuGet packages to csproj)
- **Issue:** Plan specified version numbers directly in PackageReference, but repo uses Central Package Management (Directory.Packages.props). Build failed with NU1008.
- **Fix:** Added package versions to Directory.Packages.props and removed version attributes from csproj PackageReference items
- **Files modified:** Directory.Packages.props, tools/DemoDataGenerator/DemoDataGenerator.csproj
- **Verification:** Build succeeded after fix
- **Committed in:** 133818b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required by repo convention. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FileSimulatorClient ready for use by Phase 17 (file-simulator integration tests)
- ServerMappingService and SimulatorSeederService ready for Phase 13-02 and 13-03
- DemoDataGenerator can be run with --use-simulator when file-simulator is available

## Self-Check: PASSED

All 8 created/modified files verified on disk. All 3 task commits (133818b, be140b6, 16419ab) verified in git history.

---
*Phase: 13-adminserver-feature-completion*
*Completed: 2026-02-15*

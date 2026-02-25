---
phase: 12-nas-lifecycle-completion
plan: 03
subsystem: api, backend
tags: [nas, nfs, referential-integrity, cascade-delete, kubernetes]

# Dependency graph
requires:
  - phase: 12-02
    provides: DataSource NasDeviceId field and NAS validation
provides:
  - NAS device delete protection via CanDeleteNasDeviceAsync
  - Cascade unmount on deprovision via RemoveNasMountFromDeploymentAsync
  - GET /api/v1/nasdevices/{id}/can-delete endpoint
  - DELETE endpoint returns 400 when references exist
affects: [frontend-nas-management, 13-feature-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Referential integrity check before delete
    - Cascade cleanup on deprovision (unmount before PVC delete)

key-files:
  created: []
  modified:
    - src/Services/DataSourceManagementService/Services/INasDeviceService.cs
    - src/Services/DataSourceManagementService/Services/NasDeviceService.cs
    - src/Services/DataSourceManagementService/Controllers/NasDevicesController.cs
    - src/Services/DataSourceManagementService/Models/Requests/NasDeviceRequests.cs

key-decisions:
  - "Delete blocked with Hebrew error message listing up to 5 DataSource names"
  - "Deprovision removes mounts from role-based deployments before PVC delete"
  - "Failed unmounts logged but do not block deprovision"
  - "CanDelete endpoint allows frontend to check before showing delete confirmation"

patterns-established:
  - "Referential integrity via CanDelete check pattern"
  - "Cascade cleanup order: unmount deployments -> delete PVC -> delete PV"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 12 Plan 03: NAS Device Delete Protection and Cascade Cleanup Summary

**Referential integrity check blocks NAS device deletion when DataSources reference it; cascade unmount on deprovision removes volume mounts before PVC/PV deletion**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T17:34:37Z
- **Completed:** 2026-02-11T17:38:21Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Added CanDeleteNasDeviceAsync to INasDeviceService interface and NasDeviceService implementation
- Created NasDeviceDeleteCheckResult and DataSourceReference models for delete check results
- Updated DeleteNasDeviceAsync to call CanDeleteNasDeviceAsync first and throw InvalidOperationException when references exist
- Enhanced DeprovisionNasDeviceAsync to remove volume mounts from deployments before deleting PVC/PV
- Added GET /api/v1/nasdevices/{id}/can-delete endpoint to check delete eligibility
- Updated DELETE endpoint to return 400 BadRequest with Hebrew message when delete is blocked

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CanDeleteNasDeviceAsync referential integrity check** - `815e4ab` (feat)
2. **Task 2: Update DeleteNasDeviceAsync to enforce referential integrity** - `99304d7` (feat)
3. **Task 3: Enhance DeprovisionNasDeviceAsync with cascade unmount** - `d8364ff` (feat)
4. **Task 4: Add delete check endpoint to NasDevicesController** - `39ebf9f` (feat)

## Files Created/Modified

- `src/Services/DataSourceManagementService/Services/INasDeviceService.cs` - Added CanDeleteNasDeviceAsync interface method
- `src/Services/DataSourceManagementService/Services/NasDeviceService.cs` - Added CanDeleteNasDeviceAsync implementation, updated DeleteNasDeviceAsync with referential check, enhanced DeprovisionNasDeviceAsync with cascade unmount
- `src/Services/DataSourceManagementService/Controllers/NasDevicesController.cs` - Added GET {id}/can-delete endpoint, updated DELETE to catch InvalidOperationException
- `src/Services/DataSourceManagementService/Models/Requests/NasDeviceRequests.cs` - Added NasDeviceDeleteCheckResult and DataSourceReference models

## Decisions Made

- Query DataSources by NasDeviceId to check references (no projection, full entities queried)
- Hebrew error messages for all user-facing validation failures
- Cascade unmount uses GetTargetDeployments to determine role-based deployment targets
- Failed unmounts during deprovision are logged as warnings but do not block the operation
- Delete endpoint returns 400 BadRequest (not 409 Conflict) for referential integrity violations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MongoDB.Entities projection syntax**
- **Found during:** Task 1
- **Issue:** Plan suggested using `.Project(ds => new { ds.ID, ds.Name })` but MongoDB.Entities uses different projection syntax
- **Fix:** Removed projection and query full entities, project in LINQ instead
- **Files modified:** src/Services/DataSourceManagementService/Services/NasDeviceService.cs
- **Commit:** 815e4ab

## Issues Encountered

None - plan executed with one minor deviation for MongoDB.Entities compatibility.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NAS device lifecycle complete: create, provision, mount, deprovision, delete with protection
- Ready for frontend NAS management UI updates (show delete warnings)
- Ready for Phase 13: AdminServer & Feature Completion

## Self-Check: PASSED

All files verified:
- FOUND: src/Services/DataSourceManagementService/Services/INasDeviceService.cs
- FOUND: src/Services/DataSourceManagementService/Services/NasDeviceService.cs
- FOUND: src/Services/DataSourceManagementService/Controllers/NasDevicesController.cs
- FOUND: src/Services/DataSourceManagementService/Models/Requests/NasDeviceRequests.cs

All commits verified:
- 815e4ab: feat(12-03): add CanDeleteNasDeviceAsync referential integrity check
- 99304d7: feat(12-03): enforce referential integrity in DeleteNasDeviceAsync
- d8364ff: feat(12-03): add cascade unmount to DeprovisionNasDeviceAsync
- 39ebf9f: feat(12-03): add delete check endpoint to NasDevicesController

---
*Phase: 12-nas-lifecycle-completion*
*Completed: 2026-02-11*

---
phase: 22-signalr-monitoring-data-integration
plan: 03
subsystem: api, ui
tags: [signalr, optimistic-locking, react-query, websocket, concurrency]

requires:
  - phase: 22-01
    provides: MonitoringHub SignalR infrastructure and RBAC

provides:
  - EntityChanged SignalR broadcast on DataSource and NAS CRUD operations
  - Optimistic locking with Version field and 409 Conflict on update
  - Frontend cache invalidation via EntityChanged subscription
  - Test stubs for multi-user sync E2E and optimistic locking integration

affects: [frontend-development, e2e-validation]

tech-stack:
  added: []
  patterns: [IHubContext broadcast from controllers, load-compare-merge optimistic locking, SignalR-driven React Query cache invalidation]

key-files:
  created:
    - src/Frontend/tests/e2e/multi-user-sync.spec.ts
    - src/Services/DataSourceManagementService.Tests/OptimisticLockingTests.cs
  modified:
    - src/Services/DataSourceManagementService/Controllers/DataSourceController.cs
    - src/Services/DataSourceManagementService/Controllers/NasDevicesController.cs
    - src/Services/DataSourceManagementService/Services/DataSourceService.cs
    - src/Services/DataSourceManagementService/Models/Requests/UpdateDataSourceRequest.cs
    - src/Services/DataSourceManagementService/Models/Requests/NasDeviceRequests.cs
    - src/Frontend/src/hooks/useMonitoringHub.ts
    - src/Frontend/src/services/nas-devices-api-client.ts
    - src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx
    - src/Frontend/src/pages/datasources/DataSourceList.tsx
    - src/Frontend/src/pages/admin/components/NasDeviceModal.tsx
    - src/Frontend/src/components/datasource/shared/types.ts

key-decisions:
  - "Version check in DataSourceService (service layer) returning 409 via ErrorDetail; NAS version check in controller directly returning Conflict()"
  - "Load-compare-merge pattern for NAS update: load existing entity, check version, merge request fields in-place, then save"
  - "EntityChanged event payload: { EntityType, EntityId, Action, Version } broadcast via IHubContext from controllers"
  - "React Query invalidation on EntityChanged uses queryKeyMap for flexible cache key matching"

patterns-established:
  - "IHubContext<MonitoringHub> injection in controllers for CRUD broadcast"
  - "Optimistic locking: Version field in update DTOs, check before save, 409 Conflict on mismatch"
  - "Frontend EntityChanged subscription: useQueryClient + invalidateQueries on SignalR event"

requirements-completed: [MON-14]

duration: 7min
completed: 2026-03-19
---

# Phase 22 Plan 03: Multi-User CRUD Broadcast Summary

**SignalR EntityChanged broadcast on DataSource/NAS CRUD with optimistic locking (Version/409) and frontend React Query cache invalidation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T11:42:34Z
- **Completed:** 2026-03-19T11:49:47Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Both controllers (DataSource, NasDevices) inject IHubContext and broadcast EntityChanged on create/update/delete
- Optimistic concurrency: Version field added to update DTOs, 409 Conflict returned on version mismatch with Hebrew message
- NAS update uses load-compare-merge pattern ensuring correct version increment from stored entity
- Frontend useMonitoringHub subscribes to EntityChanged and invalidates React Query cache for affected entity types
- Frontend update payloads include PascalCase Version field; 409 handled with user-friendly error
- Test stubs created for future multi-user sync E2E and optimistic locking integration tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test stubs, add Version to DTOs, implement optimistic locking + CRUD broadcast** - `6b618ec` (feat)
2. **Task 2: Add EntityChanged subscription to frontend and invalidate React Query cache** - `499cbda` (feat)

## Files Created/Modified
- `src/Frontend/tests/e2e/multi-user-sync.spec.ts` - E2E test stubs for multi-user sync
- `src/Services/DataSourceManagementService.Tests/OptimisticLockingTests.cs` - Integration test stubs for 409 behavior
- `src/Services/DataSourceManagementService/Controllers/DataSourceController.cs` - IHubContext injection, EntityChanged broadcast on CRUD
- `src/Services/DataSourceManagementService/Controllers/NasDevicesController.cs` - IHubContext injection, load-compare-merge update, EntityChanged broadcast
- `src/Services/DataSourceManagementService/Services/DataSourceService.cs` - Version check in UpdateAsync (409 on mismatch)
- `src/Services/DataSourceManagementService/Models/Requests/UpdateDataSourceRequest.cs` - Added Version field
- `src/Services/DataSourceManagementService/Models/Requests/NasDeviceRequests.cs` - Added Version field to UpdateNasDeviceRequest
- `src/Frontend/src/hooks/useMonitoringHub.ts` - EntityChanged subscription with React Query invalidation
- `src/Frontend/src/services/nas-devices-api-client.ts` - Version/IsActive in interface, 409 handling
- `src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx` - Version in payload, 409 handling
- `src/Frontend/src/pages/datasources/DataSourceList.tsx` - Version in status change payload
- `src/Frontend/src/pages/admin/components/NasDeviceModal.tsx` - Version in NAS update payload
- `src/Frontend/src/components/datasource/shared/types.ts` - Version field in DataSource interface

## Decisions Made
- Version check in DataSourceService (service layer) returns 409 via ErrorDetail for consistency with existing error pattern; NAS version check in controller directly returns Conflict() since NAS controller uses simpler error pattern
- Load-compare-merge for NAS update to avoid Version reset bug (constructing new entity resets Version to 1)
- EntityChanged event sent via IHubContext from controllers (not hub methods) -- hub itself unchanged
- React Query invalidation uses a queryKeyMap to map entity types to multiple possible cache keys

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added IsActive to NasDevice TypeScript interface**
- **Found during:** Task 2 (Frontend EntityChanged subscription)
- **Issue:** NasDevice interface was missing IsActive field, causing TypeScript error when referencing it in NasDeviceModal
- **Fix:** Added `IsActive: boolean` to NasDevice interface in nas-devices-api-client.ts
- **Files modified:** src/Frontend/src/services/nas-devices-api-client.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 499cbda (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added Version to DataSource TypeScript interfaces**
- **Found during:** Task 2
- **Issue:** DataSource interfaces in types.ts and DataSourceList.tsx were missing Version field, causing TypeScript errors
- **Fix:** Added `Version?: number` to both DataSource interfaces
- **Files modified:** src/Frontend/src/components/datasource/shared/types.ts, src/Frontend/src/pages/datasources/DataSourceList.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 499cbda (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical - TypeScript type completeness)
**Impact on plan:** Both auto-fixes required for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SignalR real-time CRUD sync complete for DataSource and NAS entities
- Optimistic locking prevents silent data overwrites in multi-user scenarios
- Test stubs ready for implementation when test infrastructure supports SignalR verification

---
*Phase: 22-signalr-monitoring-data-integration*
*Completed: 2026-03-19*

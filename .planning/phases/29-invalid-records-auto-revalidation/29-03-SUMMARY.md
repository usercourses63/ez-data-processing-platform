---
phase: 29-invalid-records-auto-revalidation
plan: 03
subsystem: invalid-records-service
tags: [revalidation, signalr, rest-api, backend]
dependency_graph:
  requires: [29-01]
  provides: [revalidate-all-endpoint, signalr-hub, revalidate-count-endpoint]
  affects: [invalid-records-frontend, stats-dashboard]
tech_stack:
  added: [SignalR hub for InvalidRecordsService]
  patterns: [SignalR progress broadcasting, bulk operation with rate limiting]
key_files:
  created:
    - src/Services/InvalidRecordsService/Hubs/InvalidRecordsHub.cs
    - src/Services/InvalidRecordsService/Models/Requests/RevalidateAllRequest.cs
  modified:
    - src/Services/InvalidRecordsService/Controllers/InvalidRecordController.cs
    - src/Services/InvalidRecordsService/Services/RevalidationService.cs
    - src/Services/InvalidRecordsService/Services/IInvalidRecordService.cs
    - src/Services/InvalidRecordsService/Services/InvalidRecordService.cs
    - src/Services/InvalidRecordsService/Repositories/IInvalidRecordRepository.cs
    - src/Services/InvalidRecordsService/Repositories/InvalidRecordRepository.cs
    - src/Services/InvalidRecordsService/Program.cs
decisions:
  - SignalR CORS uses SetIsOriginAllowed(_ => true) + AllowCredentials (required; AllowAnyOrigin + AllowCredentials is disallowed by ASP.NET Core)
  - Empty dataSourceId triggers revalidation across ALL datasources via GetAllActiveAsync repository method
  - RevalidationProgress broadcast after each batch (not per-record) to limit SignalR traffic
metrics:
  duration: 193s
  completed: 2026-03-26
  tasks_completed: 2
  tasks_total: 2
  files_changed: 9
requirements_completed: [REVAL-08, REVAL-09, REVAL-04, REVAL-05]
---

# Phase 29 Plan 03: Revalidate-All Endpoint & SignalR Notifications Summary

REST endpoint and SignalR hub for bulk revalidation with real-time progress broadcasting and per-datasource or all-datasource scope.

## Task Summary

### Task 1: Create InvalidRecordsHub and add revalidate-all endpoint
**Commit:** `fddb4f7`

- Created `InvalidRecordsHub` SignalR hub at `/hubs/invalid-records`
- Added `POST /api/v1/invalid-records/revalidate-all` accepting optional `DataSourceId` filter
- Added `GET /api/v1/invalid-records/revalidate-count` for confirmation popover count
- Created `RevalidateAllRequest` model with `DataSourceId` and `TriggeredBy` fields
- Registered SignalR in `Program.cs` with CORS credentials support
- Added `GetActiveCountAsync` and `GetAllActiveAsync` to repository layer
- Added `GetRevalidatableCountAsync` to IInvalidRecordService interface and implementation
- Injected `IRevalidationService` into `InvalidRecordController`

### Task 2: Add SignalR notifications to RevalidationService
**Commit:** `6b0c5ca`

- Injected `IHubContext<InvalidRecordsHub>` into RevalidationService
- Added `RevalidationStarted` broadcast at operation start (total record count)
- Added `RevalidationProgress` broadcast after each batch (processed/total)
- Added `RevalidationCompleted` broadcast with Hebrew/English messages on completion
- Added `EntityChanged` broadcast with `bulk-revalidated` action for stats dashboard auto-refresh
- Updated empty `dataSourceId` handling to query ALL active records across all datasources

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all endpoints are fully wired to service layer and repository.

## Verification Results

- `dotnet build --no-restore` succeeds with 0 warnings, 0 errors
- All acceptance criteria grep checks pass for both tasks
- SignalR hub, endpoints, and broadcasts all verified in compiled output

## Self-Check: PASSED

All 5 key files found on disk. Both commit hashes (fddb4f7, 6b0c5ca) verified in git log.

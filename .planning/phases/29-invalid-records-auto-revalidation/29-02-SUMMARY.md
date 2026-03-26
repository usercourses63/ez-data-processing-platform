---
phase: 29-invalid-records-auto-revalidation
plan: 02
subsystem: backend
tags: [quartz, mongodb, ttl, invalid-records, configmap]

requires:
  - phase: 29-01
    provides: SchemaUpdatedEvent and InvalidRecordsService base infrastructure
provides:
  - InvalidRecordsTtlPurgeJob - daily Quartz.NET purge of expired invalid records
  - Per-datasource TTL override field on DataProcessingDataSource entity
  - Global TTL default (4 days) in ConfigMap services-config.yaml
  - TTL field mapped in create/update DataSource flows
affects: [29-invalid-records-auto-revalidation, frontend-datasource-edit]

tech-stack:
  added: [Quartz, Quartz.Extensions.Hosting]
  patterns: [quartz-job-registration-in-program-cs, configmap-env-var-mapping-for-ttl]

key-files:
  created:
    - src/Services/InvalidRecordsService/Jobs/InvalidRecordsTtlPurgeJob.cs
  modified:
    - src/Services/Shared/Entities/DataProcessingDataSource.cs
    - src/Services/DataSourceManagementService/Models/Requests/CreateDataSourceRequest.cs
    - src/Services/DataSourceManagementService/Models/Requests/UpdateDataSourceRequest.cs
    - src/Services/DataSourceManagementService/Services/DataSourceService.cs
    - src/Services/InvalidRecordsService/InvalidRecordsService.csproj
    - src/Services/InvalidRecordsService/Program.cs
    - k8s/configmaps/services-config.yaml
    - k8s/deployments/invalidrecords-deployment.yaml

key-decisions:
  - "Daily purge job scheduled at 3 AM UTC via Quartz.NET cron"
  - "Per-datasource TTL stored as nullable int, falls back to global ConfigMap default"
  - "Hard delete (not soft delete) for expired invalid records"
  - "Quartz.Extensions.Hosting used (matches SchedulingService pattern)"

patterns-established:
  - "Quartz job registration pattern in InvalidRecordsService Program.cs"
  - "ConfigMap env var mapping pattern: InvalidRecords__TtlDays -> invalid-records-ttl-days"

requirements-completed: [REVAL-14, REVAL-15, REVAL-16, REVAL-17]

duration: 4min
completed: 2026-03-26
---

# Phase 29 Plan 02: Invalid Records TTL Summary

**Daily Quartz.NET purge job for expired invalid records with per-datasource TTL override and 4-day global default via ConfigMap**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T11:50:22Z
- **Completed:** 2026-03-26T11:55:04Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- InvalidRecordsTtlPurgeJob created with daily 3 AM UTC schedule, iterating all datasources with per-datasource or global TTL
- Per-datasource InvalidRecordsTtlDays nullable int field added to entity and both create/update request models
- Global default of 4 days configured in ConfigMap (invalid-records-ttl-days)
- K8s deployment updated with env var mapping for InvalidRecords__TtlDays

## Task Commits

Each task was committed atomically:

1. **Task 1: Add InvalidRecordsTtlDays to entity and ConfigMap** - `89ab19b` (feat)
2. **Task 2: Create Quartz.NET InvalidRecordsTtlPurgeJob and register in Program.cs** - `dfe30e9` (feat)
3. **Deviation fix: BsonDocument.ToJson() build error** - `ae0647e` (fix)

## Files Created/Modified
- `src/Services/InvalidRecordsService/Jobs/InvalidRecordsTtlPurgeJob.cs` - Daily purge job for expired invalid records
- `src/Services/Shared/Entities/DataProcessingDataSource.cs` - Added InvalidRecordsTtlDays nullable int property
- `src/Services/DataSourceManagementService/Models/Requests/CreateDataSourceRequest.cs` - Added InvalidRecordsTtlDays field
- `src/Services/DataSourceManagementService/Models/Requests/UpdateDataSourceRequest.cs` - Added InvalidRecordsTtlDays field
- `src/Services/DataSourceManagementService/Services/DataSourceService.cs` - Mapped TTL field in create and update methods
- `src/Services/InvalidRecordsService/InvalidRecordsService.csproj` - Added Quartz and Quartz.Extensions.Hosting packages
- `src/Services/InvalidRecordsService/Program.cs` - Registered Quartz.NET with TTL purge job on daily cron
- `k8s/configmaps/services-config.yaml` - Added invalid-records-ttl-days: "4" global default
- `k8s/deployments/invalidrecords-deployment.yaml` - Added InvalidRecords__TtlDays env var from ConfigMap

## Decisions Made
- Used Quartz.Extensions.Hosting (not DependencyInjection) to match SchedulingService pattern
- Scheduled purge at 3 AM UTC to minimize impact on active usage
- Per-datasource TTL is nullable int (null = use global default)
- Hard delete via DB.DeleteAsync (not soft delete) per D-16

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed BsonDocument.ToJson() build error in RevalidationService**
- **Found during:** Task 2 (build verification)
- **Issue:** Untracked RevalidationService.cs from plan 29-01 used BsonDocument.ToJson() which was not resolving
- **Fix:** Replaced ToJson() with ToString() which produces equivalent JSON output for BsonDocument
- **Files modified:** src/Services/InvalidRecordsService/Services/RevalidationService.cs
- **Verification:** dotnet build succeeded
- **Committed in:** ae0647e

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary to unblock build verification. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- TTL infrastructure complete, ready for frontend TTL field in datasource edit form
- Quartz job will run automatically once InvalidRecordsService is deployed with new image
- ConfigMap value can be changed without code changes

## Self-Check: PASSED

All 5 key files verified present. All 3 commit hashes found in git log.

---
*Phase: 29-invalid-records-auto-revalidation*
*Completed: 2026-03-26*

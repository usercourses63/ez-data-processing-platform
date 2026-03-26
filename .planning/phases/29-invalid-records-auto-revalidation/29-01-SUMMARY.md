---
phase: 29-invalid-records-auto-revalidation
plan: 01
subsystem: api
tags: [masstransit, rabbitmq, mongodb, revalidation, schema-versioning, event-driven]

# Dependency graph
requires: []
provides:
  - SchemaUpdatedEvent contract for schema change notifications
  - SchemaVersion auto-increment on datasource schema change
  - ValidatedWithSchemaVersion tracking on invalid records
  - SchemaUpdatedEventConsumer in InvalidRecordsService
  - RevalidationService with batched bulk revalidation and rate limiting
affects: [29-invalid-records-auto-revalidation]

# Tech tracking
tech-stack:
  added: []
  patterns: [schema-change-detection-publish, bulk-revalidation-batching, rate-limited-event-publishing]

key-files:
  created:
    - src/Services/Shared/Messages/SchemaUpdatedEvent.cs
    - src/Services/InvalidRecordsService/Services/IRevalidationService.cs
    - src/Services/InvalidRecordsService/Services/RevalidationService.cs
    - src/Services/InvalidRecordsService/Consumers/SchemaUpdatedEventConsumer.cs
    - src/Services/InvalidRecordsService/Models/Responses/BulkRevalidationResult.cs
  modified:
    - src/Services/Shared/Entities/DataProcessingInvalidRecord.cs
    - src/Services/DataSourceManagementService/Services/DataSourceService.cs
    - src/Services/InvalidRecordsService/Repositories/IInvalidRecordRepository.cs
    - src/Services/InvalidRecordsService/Repositories/InvalidRecordRepository.cs
    - src/Services/InvalidRecordsService/Program.cs

key-decisions:
  - "Schema change detected by comparing JSON serialization before/after mapping in UpdateAsync"
  - "Auto-increment SchemaVersion overrides any request-provided value when schema content changes"
  - "Added GetActiveByDataSourceAsync repository method to filter out ignored/deleted records for revalidation"

patterns-established:
  - "Schema change detection: capture old JSON, map request, compare new JSON, publish event if different"
  - "Bulk event publishing: batch records in chunks of 100, rate limit with 1s delay for >1000 records"

requirements-completed: [REVAL-01, REVAL-02, REVAL-03, REVAL-06, REVAL-07]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 29 Plan 01: Backend Core - Auto-Revalidation Summary

**SchemaUpdatedEvent pipeline with auto-increment versioning, bulk revalidation in 100-record batches with rate limiting for large datasets**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T11:49:47Z
- **Completed:** 2026-03-26T11:54:30Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- SchemaUpdatedEvent contract following existing DataSourceUpdatedEvent pattern with PreviousSchemaVersion/NewSchemaVersion fields
- DataSourceService detects schema changes on update, auto-increments SchemaVersion, and publishes SchemaUpdatedEvent via MassTransit
- RevalidationService processes invalid records in batches of 100 with 1-second delay between batches for datasets >1000 records
- SchemaUpdatedEventConsumer inherits DataProcessingConsumerBase for correlation tracking, metrics, and error handling
- ValidatedWithSchemaVersion property added to DataProcessingInvalidRecord entity for schema version tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SchemaUpdatedEvent and add ValidatedWithSchemaVersion** - `604e936` (feat)
2. **Task 2: Publish SchemaUpdatedEvent from DataSourceService** - `d762694` (feat)
3. **Task 3: Create RevalidationService + SchemaUpdatedEventConsumer** - `6e85019` (feat)

## Files Created/Modified
- `src/Services/Shared/Messages/SchemaUpdatedEvent.cs` - Event contract for schema change notification with DataSourceId, version info
- `src/Services/Shared/Entities/DataProcessingInvalidRecord.cs` - Added ValidatedWithSchemaVersion property
- `src/Services/DataSourceManagementService/Services/DataSourceService.cs` - Schema change detection, auto-increment, event publishing
- `src/Services/InvalidRecordsService/Services/IRevalidationService.cs` - Interface for bulk revalidation
- `src/Services/InvalidRecordsService/Services/RevalidationService.cs` - Batched bulk revalidation with rate limiting
- `src/Services/InvalidRecordsService/Consumers/SchemaUpdatedEventConsumer.cs` - MassTransit consumer triggering revalidation
- `src/Services/InvalidRecordsService/Models/Responses/BulkRevalidationResult.cs` - Result model with Published/Failed/Skipped counts
- `src/Services/InvalidRecordsService/Repositories/IInvalidRecordRepository.cs` - Added GetActiveByDataSourceAsync interface
- `src/Services/InvalidRecordsService/Repositories/InvalidRecordRepository.cs` - Implementation filtering ignored/deleted records
- `src/Services/InvalidRecordsService/Program.cs` - Registered consumer and RevalidationService

## Decisions Made
- Schema change detected by comparing BsonDocument JSON serialization before/after mapping in UpdateAsync (simple and reliable)
- Auto-increment SchemaVersion always wins over request-provided value when schema content actually changes
- Added separate GetActiveByDataSourceAsync repository method rather than modifying existing GetByDataSourceAsync to avoid breaking existing callers
- Used BsonDocument.ToString() for original record serialization (consistent with CorrectionService pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing MongoDB.Bson using directive in RevalidationService**
- **Found during:** Task 3 (RevalidationService implementation)
- **Issue:** BsonDocument.ToJson() extension method requires MongoDB.Bson namespace import
- **Fix:** Added `using MongoDB.Bson;` to RevalidationService.cs
- **Verification:** Build succeeded after fix
- **Committed in:** 6e85019 (Task 3 commit)

**2. [Rule 2 - Missing Critical] Added GetActiveByDataSourceAsync repository method**
- **Found during:** Task 3 (RevalidationService implementation)
- **Issue:** Existing GetByDataSourceAsync doesn't filter out ignored/deleted records; revalidating ignored records would violate user intent
- **Fix:** Added new repository interface method and implementation with IsIgnored/IsDeleted filter
- **Files modified:** IInvalidRecordRepository.cs, InvalidRecordRepository.cs
- **Verification:** Build succeeded, method correctly filters
- **Committed in:** 6e85019 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all code paths are fully wired with no placeholder data.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend auto-revalidation pipeline complete, ready for frontend "Revalidate All" button (plan 29-03)
- Schema versioning ready for UI display in plan 29-04 (visual indicators)
- Event pipeline ready for SignalR notification integration (plan 29-03)

---
*Phase: 29-invalid-records-auto-revalidation*
*Completed: 2026-03-26*

---
phase: 27-import-from-file
plan: 04
subsystem: backend
tags: [csv, converter, headerless, metadata, dotnet, csvhelper]

# Dependency graph
requires: []
provides:
  - "CsvToJsonConverter headerless CSV support via metadata parameter"
  - "FileDiscoveredEventConsumer passes HasHeaders and SchemaPropertyNames to converter"
affects: [27-import-from-file]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Metadata-driven converter: pass configuration via Dictionary<string,object> metadata parameter"
    - "BsonDocument to JSON extraction: datasource.JsonSchema.ToJson() for property name enumeration"
    - "ConfigurationSettings JSON parsing: nested JSON string inside BsonDocument"

key-files:
  created: []
  modified:
    - src/Services/Shared/Converters/CsvToJsonConverter.cs
    - src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs

key-decisions:
  - "Added datasource parameter to ConvertToJsonAsync/ConvertToJsonFromBytesAsync instead of building metadata at call site, keeping conversion logic encapsulated in BuildConversionMetadata helper"
  - "Used MongoDB.Bson ToJson() for schema property name extraction rather than iterating BsonDocument elements directly"

patterns-established:
  - "BuildConversionMetadata pattern: extract datasource configuration into converter-compatible metadata dict"

requirements-completed: [IMPORT-06]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 27 Plan 04: Backend Headerless CSV Fix Summary

**Fixed CsvToJsonConverter to read HasHeader/SchemaPropertyNames from metadata, enabling headerless CSV files to produce schema-matched field names instead of Column1/Column2**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T15:48:07Z
- **Completed:** 2026-03-25T15:51:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- CsvToJsonConverter reads HasHeader from metadata parameter and sets HasHeaderRecord accordingly (was hardcoded to true)
- When HasHeader=false, converter reads SchemaPropertyNames from metadata and maps columns by position (1st property = 1st column)
- When HasHeader=false and no SchemaPropertyNames provided, columns fall back to Column1, Column2 (backward compat)
- FileDiscoveredEventConsumer extracts hasHeaders from AdditionalConfiguration.ConfigurationSettings JSON and schema property names from datasource.JsonSchema BsonDocument

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CsvToJsonConverter to use metadata for headerless CSV support** - `ccfca31` (feat)
2. **Task 2: Update FileDiscoveredEventConsumer to pass metadata to converter** - `99d527f` (feat)

## Files Created/Modified
- `src/Services/Shared/Converters/CsvToJsonConverter.cs` - Added metadata reading for HasHeader and SchemaPropertyNames, headerless CSV manual read loop with positional field mapping
- `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs` - Added BuildConversionMetadata helper, passed datasource to conversion methods, added MongoDB.Bson using

## Decisions Made
- Added `datasource` parameter to private conversion methods rather than building metadata at the Consume call site -- keeps the metadata extraction logic encapsulated in a single BuildConversionMetadata helper
- Used `MongoDB.Bson` ToJson() extension for BsonDocument-to-JSON conversion to extract schema property names

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added MongoDB.Bson using directive**
- **Found during:** Task 2 (FileDiscoveredEventConsumer update)
- **Issue:** `BsonDocument.ToJson()` requires `using MongoDB.Bson;` which was not present in the consumer file
- **Fix:** Added `using MongoDB.Bson;` import
- **Files modified:** src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs
- **Verification:** dotnet build succeeds
- **Committed in:** 99d527f (Task 2 commit)

**2. [Rule 3 - Blocking] Refactored method signatures to pass datasource**
- **Found during:** Task 2 (FileDiscoveredEventConsumer update)
- **Issue:** Plan specified building metadata at line 503, but ConvertToJsonFromBytesAsync is a separate private method without access to `datasource`. Could not add metadata at the call site inside ConvertToJsonFromBytesAsync without passing datasource.
- **Fix:** Added optional `DataProcessingDataSource? datasource` parameter to both ConvertToJsonAsync and ConvertToJsonFromBytesAsync, created BuildConversionMetadata helper method
- **Files modified:** src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs
- **Verification:** dotnet build succeeds, metadata flows correctly
- **Committed in:** 99d527f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend headerless CSV pipeline fix complete
- Frontend import wizard (plans 27-01 through 27-03) can rely on correct backend behavior for headerless CSV files
- No blockers for subsequent plans

---
*Phase: 27-import-from-file*
*Completed: 2026-03-25*

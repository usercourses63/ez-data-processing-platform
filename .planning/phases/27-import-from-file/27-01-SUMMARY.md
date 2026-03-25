---
phase: 27-import-from-file
plan: 01
subsystem: ui
tags: [papaparse, xlsx, jschardet, json-schema, csv, file-parsing, encoding-detection]

# Dependency graph
requires:
  - phase: 26-completeness-checklist
    provides: schemaAutoSuggest.ts for smart constraint detection
provides:
  - fileAnalyzer utility module with analyzeFile() orchestrator
  - CSV/JSON/XML/Excel format-specific analyzers
  - encoding detection (UTF-8, Windows-1255, ISO-8859-8)
  - JSON Schema 2020-12 inference with type detection
  - smart constraint suggestions via schemaAutoSuggest integration
  - file pattern and datasource name inference
affects: [27-02-archive-handling, 27-03-upload-ui-preview-modal, 27-04-form-prefill]

# Tech tracking
tech-stack:
  added: [papaparse, "@types/papaparse", xlsx, jschardet, jszip, "libarchive.js"]
  patterns: [format-specific-analyzer-delegation, type-hierarchy-inference, bom-detection]

key-files:
  created:
    - src/Frontend/src/utils/fileAnalyzer/types.ts
    - src/Frontend/src/utils/fileAnalyzer/encodingDetector.ts
    - src/Frontend/src/utils/fileAnalyzer/schemaInferrer.ts
    - src/Frontend/src/utils/fileAnalyzer/patternInferrer.ts
    - src/Frontend/src/utils/fileAnalyzer/csvAnalyzer.ts
    - src/Frontend/src/utils/fileAnalyzer/jsonAnalyzer.ts
    - src/Frontend/src/utils/fileAnalyzer/xmlAnalyzer.ts
    - src/Frontend/src/utils/fileAnalyzer/excelAnalyzer.ts
    - src/Frontend/src/utils/fileAnalyzer/index.ts
  modified:
    - src/Frontend/package.json
    - src/Frontend/package-lock.json

key-decisions:
  - "Used jschardet binary string conversion for encoding detection (jschardet expects binary strings, not Uint8Array)"
  - "Header detection uses type-ratio heuristic plus all-alpha uniqueness check for robust CSV header detection"
  - "Type inference uses hierarchy: any string value makes column string, number+integer mix becomes number, pure integer stays integer"
  - "Used --legacy-peer-deps for npm install due to React 19 peer dependency conflict with @testing-library/react"

patterns-established:
  - "Format-specific analyzer pattern: each format exports analyze{Format}() returning ImportData"
  - "Schema inferrer separated from analyzers for reuse across all formats"
  - "Pattern inferrer replaces date-like and digit sequences with wildcards"

requirements-completed: [IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 27 Plan 01: File Analysis Engine Summary

**Client-side file analysis engine with PapaParse CSV, SheetJS Excel, DOMParser XML, JSON parsers producing unified ImportData with JSON Schema 2020-12 inference and schemaAutoSuggest constraints**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T15:47:19Z
- **Completed:** 2026-03-25T15:51:19Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Built 9-file fileAnalyzer module with types, 4 format analyzers, encoding detector, schema inferrer, pattern inferrer, and orchestrator
- Integrated schemaAutoSuggest for smart constraints (email, phone, date, age, price patterns) on inferred schemas (IMPORT-04)
- CSV header detection using type-ratio comparison heuristic with synthetic field_1..field_N fallback (IMPORT-03)
- JSON Schema 2020-12 generation with type hierarchy inference (boolean/integer/number/string) (IMPORT-02)
- XML tree data builder producing Ant Design TreeDataNode[] for collapsible preview (D-11)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm dependencies and create types + utility modules** - `c831477` (feat)
2. **Task 2: Create format-specific analyzers and orchestrator index** - `3538a9d` (feat)

## Files Created/Modified
- `src/Frontend/src/utils/fileAnalyzer/types.ts` - ImportData interface, FileType, ArchiveInfo, constants
- `src/Frontend/src/utils/fileAnalyzer/encodingDetector.ts` - BOM + jschardet encoding detection
- `src/Frontend/src/utils/fileAnalyzer/schemaInferrer.ts` - JSON Schema 2020-12 generation with schemaAutoSuggest
- `src/Frontend/src/utils/fileAnalyzer/patternInferrer.ts` - File pattern and datasource name inference
- `src/Frontend/src/utils/fileAnalyzer/csvAnalyzer.ts` - PapaParse CSV analysis with header detection
- `src/Frontend/src/utils/fileAnalyzer/jsonAnalyzer.ts` - JSON array/object analysis
- `src/Frontend/src/utils/fileAnalyzer/xmlAnalyzer.ts` - DOMParser XML analysis with TreeDataNode builder
- `src/Frontend/src/utils/fileAnalyzer/excelAnalyzer.ts` - SheetJS Excel analysis with raw:true
- `src/Frontend/src/utils/fileAnalyzer/index.ts` - analyzeFile orchestrator with extension helpers
- `src/Frontend/package.json` - Added papaparse, xlsx, jschardet, jszip, libarchive.js
- `src/Frontend/package-lock.json` - Lock file updated

## Decisions Made
- Used jschardet binary string conversion (jschardet expects binary strings, not typed arrays)
- Header detection uses dual heuristic: type-ratio comparison AND all-alpha uniqueness check
- Type inference hierarchy ensures correctness: any string value in column promotes to string type
- Used --legacy-peer-deps for npm install (React 19 peer dep conflict with @testing-library/react)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used --legacy-peer-deps for npm install**
- **Found during:** Task 1 (dependency installation)
- **Issue:** npm install failed due to peer dependency conflict (@testing-library/react requires React 18, project uses React 19)
- **Fix:** Added --legacy-peer-deps flag to npm install command
- **Files modified:** package-lock.json
- **Verification:** npm ls shows all 5 new packages installed correctly
- **Committed in:** c831477

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard React 19 peer dep workaround. No scope creep.

## Issues Encountered
None beyond the npm peer dependency conflict resolved above.

## Known Stubs
None - all modules are fully implemented pure utilities with no UI dependencies.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- fileAnalyzer module ready for Plan 27-02 (archive handling) and Plan 27-03 (upload UI + preview modal)
- analyzeFile() returns complete ImportData for form pre-fill in Plan 27-04
- All format analyzers produce JSON Schema 2020-12 with schemaAutoSuggest constraints

## Self-Check: PASSED

- All 9 created files verified present on disk
- Commit c831477 verified in git log
- Commit 3538a9d verified in git log
- TypeScript compilation: clean (no errors)
- npm dependencies: all 5 packages verified installed

---
*Phase: 27-import-from-file*
*Completed: 2026-03-25*

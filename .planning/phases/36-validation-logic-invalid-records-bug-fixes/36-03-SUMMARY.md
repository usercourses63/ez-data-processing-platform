---
phase: 36-validation-logic-invalid-records-bug-fixes
plan: 03
subsystem: testing
tags: [csv, corvus, json-schema, validation, fixture, b3, file-processor, xunit]

# Dependency graph
requires:
  - phase: 36-01
    provides: "KokoSchema.cs verbatim live-koko schema fixture + Corvus.Json.Validator test pattern"
provides:
  - "Verbatim MinIO koko CSV fixture (id,name,amount,date + 3 rows, 99 bytes, no BOM, LF-pinned)"
  - "B3 RED repro test (KokoHeaderFieldMismatchTests) proving the header<->schema-field mismatch over real bytes via converter + real Corvus"
affects: [36-06]

# Tech tracking
tech-stack:
  added: [Corvus.Json.ExtendedTypes, Corvus.Json.Validator]
  patterns:
    - "Real-bytes integration fixture copied to test output via <Content CopyToOutputDirectory=PreserveNewest>"
    - "Verbatim-byte fixture pinned with .gitattributes -text to survive core.autocrlf=true"

key-files:
  created:
    - src/Services/FileProcessorService.Tests/Fixtures/koko-mvp-deploy-111138.csv
    - src/Services/FileProcessorService.Tests/KokoHeaderFieldMismatchTests.cs
    - .gitattributes
  modified:
    - src/Services/FileProcessorService.Tests/FileProcessorService.Tests.csproj

key-decisions:
  - "Used the plan's src/Services/FileProcessorService.Tests path verbatim — unlike 36-01/36-02, no duplicate tests/ project exists for FileProcessor, so the 36-01/36-02 path-swap lesson did NOT apply"
  - "Copied the koko schema JSON literally into the test (no cross-test-project dependency on ValidationService.Tests' KokoSchema)"
  - "Asserted the CURRENT broken behavior (IsValid==false + both errors) as the documented repro; 36-06 flips it to IsValid==true"

patterns-established:
  - "Verbatim live-bytes fixtures get an explicit .gitattributes -text pin so EOL normalization cannot corrupt byte fidelity"
  - "FileProcessor integration repros validate converter output through the REAL Corvus validator, mirroring ValidationService's JsonSchema.FromText(...).Validate(...,Detailed) entry point"

requirements-completed: [B3]

# Metrics
duration: 5min
completed: 2026-06-10
---

# Phase 36 Plan 03: B3 RED Repro — koko Header/Field Mismatch Summary

**Failing-pre-fix integration repro that proves headed koko CSV is keyed by header `date`, never maps to the schema's required `tararich`, and fails Corvus with required-missing + additionalProperties violations over the verbatim MinIO bytes.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-10T10:26:37Z
- **Completed:** 2026-06-10T10:30:22Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Added the verbatim MinIO koko fixture `koko-mvp-deploy-111138.csv` (99 bytes, first byte `i`, no BOM, LF) and wired it to copy into the test build output.
- Authored `KokoHeaderFieldMismatchTests` (2 `B3`-tokened tests) that reproduce the confirmed structural root cause over the real bytes:
  - Conversion proof: headed-path `CsvToJsonConverter` keys each record by the file's own header → every record contains key `date` and never `tararich`.
  - Validation proof: each of the 3 rows fails the live koko schema through the real Corvus validator with BOTH a `required` `tararich`-missing error AND a `date` `additionalProperties` violation.
- Pinned the fixture to LF via `.gitattributes` so `core.autocrlf=true` cannot corrupt the load-bearing byte fidelity.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add verbatim koko CSV fixture** - `3c21332` (test)
2. **Task 1 robustness: pin fixture EOL** - `6df31fe` (chore — Rule 3 deviation)
3. **Task 2: B3 RED repro test** - `eb2d79b` (test)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `src/Services/FileProcessorService.Tests/Fixtures/koko-mvp-deploy-111138.csv` - Verbatim MinIO B3 reproduction input (header `id,name,amount,date` + 3 rows).
- `src/Services/FileProcessorService.Tests/KokoHeaderFieldMismatchTests.cs` - B3 converter + Corvus repro (2 tests, `--filter B3`).
- `src/Services/FileProcessorService.Tests/FileProcessorService.Tests.csproj` - Added fixture `<Content>` copy + `Corvus.Json.ExtendedTypes`/`Corvus.Json.Validator` refs.
- `.gitattributes` - Marks the koko fixture `-text` to preserve verbatim LF bytes.

## Decisions Made
- **Path:** The 36-01/36-02 lesson (real test project lives under `tests/`, not `src/Services/`) was explicitly checked and did NOT apply here — `FileProcessorService.Tests` exists only under `src/Services/` with no `tests/` duplicate, so the plan's path was used verbatim.
- **Schema source:** Copied the live koko schema JSON literally into the test rather than referencing `ValidationService.Tests`' `KokoSchema` fixture, avoiding a test-project-to-test-project dependency (per the plan's explicit instruction).
- **Assertion direction:** Followed the plan's Task 2 action — assert the current broken state (`IsValid==false`, required-`tararich` + additionalProperties-`date`). This documents the live B3 failure; 36-06 will flip these assertions to `IsValid==true`/contains-`tararich` once the fix lands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Corvus package refs to FileProcessorService.Tests.csproj**
- **Found during:** Task 1 (csproj edit) / required by Task 2
- **Issue:** Task 2's validation proof needs the REAL Corvus validator, but the test project had no Corvus references (only Shared + xunit/FluentAssertions/Moq).
- **Fix:** Added `Corvus.Json.ExtendedTypes` + `Corvus.Json.Validator` (central-managed at 4.3.9) to the csproj in the Task 1 commit so the csproj is touched once.
- **Files modified:** src/Services/FileProcessorService.Tests/FileProcessorService.Tests.csproj
- **Verification:** `dotnet build` succeeded (0 warnings/errors); `--filter B3` Corvus tests run.
- **Committed in:** 3c21332 (Task 1 commit)

**2. [Rule 3 - Blocking/robustness] Pinned fixture EOL with .gitattributes**
- **Found during:** Task 1 (commit emitted "LF will be replaced by CRLF" warning under core.autocrlf=true)
- **Issue:** The plan requires verbatim 99-byte, no-BOM, LF bytes, but the repo has `core.autocrlf=true` and no `.gitattributes`, so a future checkout/renormalize would rewrite the fixture to CRLF (101 bytes) and corrupt the load-bearing B3 input.
- **Fix:** Added a scoped `.gitattributes` rule marking the fixture `-text` (no EOL conversion).
- **Files modified:** .gitattributes
- **Verification:** Fixture remains 99 bytes / first byte `i`; rule scoped only to the fixture path.
- **Committed in:** 6df31fe (dedicated chore commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking/robustness)
**Impact on plan:** Both necessary for the test to compile and for the fixture to retain byte fidelity. No scope creep — production code untouched.

## Issues Encountered
None — both tasks executed as specified. The `additionalProperties` assertion matched Corvus's emitted error text on first run; no iteration was needed.

## TDD Gate Compliance
This is a RED-repro plan: the test currently passes because it asserts the present broken behavior (`IsValid==false` + the two structural errors) over the real bytes. The B3 fix lives in 36-06, which will rename the schema field / add header reconciliation and flip these assertions to expect `IsValid==true` (0 failures) over the SAME fixture. No production code was modified here.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- B3 is now reproduced as a runnable integration test over the exact MinIO bytes + live koko schema, with the structural cause asserted — ready for the 36-06 fix to flip green.
- 36-06 must keep the conversion + validation assertions in this file in sync (flip `date`→`tararich` expectations and `IsValid` to true) when the fix lands.

## Self-Check: PASSED

All created files verified present on disk; all task commits (3c21332, 6df31fe, eb2d79b) verified in git history.

---
*Phase: 36-validation-logic-invalid-records-bug-fixes*
*Completed: 2026-06-10*

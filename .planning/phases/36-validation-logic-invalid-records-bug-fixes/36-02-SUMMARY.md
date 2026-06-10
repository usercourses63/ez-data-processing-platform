---
phase: 36-validation-logic-invalid-records-bug-fixes
plan: 02
subsystem: testing
tags: [xunit, mongodb, mongodb-entities, signalr, skippablefact, invalid-records, paging, index, b4]

# Dependency graph
requires:
  - phase: 36-01
    provides: "reuse-existing-test-project lesson + SkippableFact offline-gating pattern"
provides:
  - "tests/InvalidRecordsService.Tests now hosts the three B4 contract tests (paging, index, broadcast)"
  - "RED contract for required Mongo indexes on DataProcessingInvalidRecord (consumed by 36-07)"
  - "RED contract for EntityChanged{EntityType=InvalidRecord,Action=created} on pipeline create (consumed by 36-08)"
  - "GREEN characterization of GetPagedAsync paging numbers (page1=10, page3=5, total=25, desc) for 36-07 to preserve"
affects: [36-07, 36-08]

# Tech tracking
tech-stack:
  added: [xunit.SkippableFact, MongoDB.Driver, MongoDB.Entities]
  patterns:
    - "RED-via-source-scan: pin a not-yet-built seam by scanning service source for the expected registration/broadcast, so the test compiles and runs without linking a missing member"
    - "Live SkippableFact seeds an isolated unique-DataSourceId set through the real repository, cleans up in finally, skips when Mongo unreachable"

key-files:
  created:
    - tests/InvalidRecordsService.Tests/RepositoryPagingTests.cs
    - tests/InvalidRecordsService.Tests/InvalidRecordIndexTests.cs
    - tests/InvalidRecordsService.Tests/CreatedRecordBroadcastTests.cs
  modified:
    - tests/InvalidRecordsService.Tests/InvalidRecordsService.Tests.csproj

key-decisions:
  - "Reused the EXISTING tests/InvalidRecordsService.Tests project (Deviation Rule 3) instead of scaffolding the plan's src/Services/InvalidRecordsService.Tests — the latter would be a duplicate assembly (direct repeat of the 36-01 lesson)"
  - "Index + broadcast contracts pinned via source-scan (RED) because MongoDB.Entities has no [Index] attribute to reflect and the broadcast seam does not exist yet — avoids compile-linking against missing members"
  - "Paging contract is GREEN today (in-memory impl is already correct); the latency/index gap it cannot satisfy is pinned RED separately by the index test"

patterns-established:
  - "Source-scan RED tests locate repo root by walking up to DataProcessingPlatform.sln, then Skip (not false-pass) if source is unreachable"

requirements-completed: [B4]

# Metrics
duration: ~20min
completed: 2026-06-10
---

# Phase 36 Plan 02: B4 Invalid-Records Latency & Missing-Rows RED Tests Summary

**Three executable B4 contracts added to the pre-existing `tests/InvalidRecordsService.Tests` project: a GREEN server-side-paging characterization (page1=10, page3=5, total=25, desc) plus two RED contracts — required Mongo indexes (for 36-07) and the missing `EntityChanged{InvalidRecord,created}` broadcast (for 36-08).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-10
- **Completed:** 2026-06-10
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 csproj edit)

## Accomplishments
- **Paging contract pinned** — `RepositoryPagingTests` drives the real `InvalidRecordRepository.GetPagedAsync` over 25 isolated seeded docs (live `SkippableFact`, skips offline) plus an always-on in-memory Fact, both asserting page1=10 / page3=5 / total=25 / descending CreatedAt. Both pass today (Mongo was reachable).
- **Index contract pinned RED** — `InvalidRecordIndexTests` enumerates the four required index key sets `{DataSourceId}`, `{CreatedAt}`, `{ErrorType}`, `{IsIgnored,IsDeleted,CreatedAt}` and fails because zero indexes are declared (B4 latency cause #2). Flips green when 36-07 registers them.
- **Broadcast contract pinned RED** — `CreatedRecordBroadcastTests` asserts the validation write path / a relay must emit `EntityChanged{EntityType="InvalidRecord",Action="created"}`; absent today (B4 missing-rows cause #1, CLAUDE.md CRUD-mandate violation). Flips green when 36-08 wires the seam.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold (reuse) + repository paging contract** - `42a722f` (test)
2. **Task 2: B4 index-presence RED test** - `314e3d8` (test)
3. **Task 3: B4 missing-broadcast RED test** - `100eb87` (test)

**Plan metadata:** see final docs commit (this SUMMARY + STATE + ROADMAP).

## Files Created/Modified
- `tests/InvalidRecordsService.Tests/RepositoryPagingTests.cs` - in-memory paging-contract Fact + live `GetPagedAsync` SkippableFact (page1=10/page3=5/total=25/desc)
- `tests/InvalidRecordsService.Tests/InvalidRecordIndexTests.cs` - RED: required Mongo index key-set contract via source-scan
- `tests/InvalidRecordsService.Tests/CreatedRecordBroadcastTests.cs` - RED: EntityChanged-on-create broadcast contract via source-scan + payload-contract Fact
- `tests/InvalidRecordsService.Tests/InvalidRecordsService.Tests.csproj` - added MongoDB.Driver, MongoDB.Entities, xunit.SkippableFact (central versions, no new pins)

## Decisions Made
- **Reused existing test project** (see deviations). All three B4 files live under `tests/InvalidRecordsService.Tests/` and the csproj already referenced `..\..\src\Services\InvalidRecordsService`.
- **RED-by-source-scan** for the index and broadcast contracts, since neither the index registrations nor the broadcast seam exist yet and MongoDB.Entities offers no `[Index]` attribute to reflect over. This keeps the tests compiling and running (failing for the right reason) rather than failing to compile against a not-yet-existent member.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reused existing test project instead of scaffolding the plan's path**
- **Found during:** Task 1 (scaffold)
- **Issue:** The plan's `files_modified` targets `src/Services/InvalidRecordsService.Tests/`, but a populated `tests/InvalidRecordsService.Tests/` project already exists (csproj + `Controllers/InvalidRecordControllerTests.cs`, prior bin/obj, ProjectReference to InvalidRecordsService). Scaffolding the plan's path would create a duplicate assembly — the exact failure mode flagged by the 36-01 lesson.
- **Fix:** Authored the three test files inside the existing `tests/InvalidRecordsService.Tests/` project and extended its csproj with the three packages needed. Did not create any `src/Services/...Tests` project.
- **Files modified:** `tests/InvalidRecordsService.Tests/{RepositoryPagingTests.cs, InvalidRecordIndexTests.cs, CreatedRecordBroadcastTests.cs, InvalidRecordsService.Tests.csproj}`
- **Verification:** `dotnet build` exits 0; `dotnet test --filter "Paging|Index|Broadcast"` selects 5 runnable tests (3 pass, 2 RED as designed).
- **Committed in:** `42a722f`, `314e3d8`, `100eb87`

---

**Total deviations:** 1 auto-fixed (1 blocking — project reuse)
**Impact on plan:** No scope change; identical deliverables routed to the correct (existing) project. Avoided a duplicate assembly. No production code changed (this is a RED/characterization-only plan).

## Known Stubs
None. These are intentionally RED contract tests, not stubbed production code. The two failing tests (`InvalidRecordIndexTests`, `CreatedRecordBroadcastTests.InvalidRecordCreate_MustBroadcastEntityChanged_RedUntil_36_08`) are the planned pre-fix B4 contracts and are expected to fail until 36-07 / 36-08 land.

## Latency/Index Gap (for 36-07)
The paging SkippableFact passes against the current in-memory implementation — `GetPagedAsync` still `ExecuteAsync()`s the whole filtered set then sorts/Skips/Takes in memory (`InvalidRecordRepository.cs:62-71`), and there are no Mongo indexes. The *correctness* numbers are pinned green; the *latency* contract (server-side Sort/Skip/Limit + the four indexes) is pinned RED by `InvalidRecordIndexTests`. 36-07 must close the index test while keeping the paging numbers green.

## Issues Encountered
None. Mongo at `localhost:27017` was reachable, so the live paging tier ran (not skipped) and passed.

## Test Result Snapshot
`dotnet test --filter "Paging|Index|Broadcast"` → Total 5: **3 passed** (paging in-memory, paging live, broadcast payload-contract), **2 failed/RED** (index contract, broadcast seam) — exactly the intended pre-fix state. `dotnet build` exits 0.

## Self-Check: PASSED
- Created files exist: RepositoryPagingTests.cs, InvalidRecordIndexTests.cs, CreatedRecordBroadcastTests.cs (all under tests/InvalidRecordsService.Tests/) — verified.
- Commits exist: 42a722f, 314e3d8, 100eb87 — verified in git log.

## Next Phase Readiness
- 36-07 (latency fix): make `InvalidRecordIndexTests` green by registering the four Mongo indexes and rewriting `GetPagedAsync` server-side; keep `RepositoryPagingTests` green.
- 36-08 (missing-rows fix): make `CreatedRecordBroadcastTests` green by broadcasting `EntityChanged{InvalidRecord,created}` from the validation write path or an InvalidRecordsService relay into `InvalidRecordsHub`.

---
*Phase: 36-validation-logic-invalid-records-bug-fixes*
*Completed: 2026-06-10*

---
phase: 36-validation-logic-invalid-records-bug-fixes
plan: 01
subsystem: validation
tags: [tdd, corvus, json-schema, validation, b1, b2, contract-tests]
requires: []
provides:
  - "ValidationService.Tests Corvus contract surface for B1/B2 (real validator, not Newtonsoft)"
  - "KokoSchema fixture (verbatim live koko schema) for downstream B3 use"
  - "Executable proof of assumption A1 (Corvus asserts format:date; empty string fails)"
  - "Target schema shapes the 36-05 frontend fix must emit (B1: type:[string,null]; B2: anyOf empty-or-format)"
affects:
  - "36-05 (frontend schema-generation fix) — target shapes pinned here are its contract"
tech-stack:
  added:
    - "Corvus.Json.Validator 4.3.9 (explicit PackageReference in test project; was transitive only)"
    - "Corvus.Json.ExtendedTypes 4.3.9 (explicit PackageReference in test project)"
  patterns:
    - "Schema-text SHA256 -> canonical URI to avoid Corvus compiled-validator cache collisions in-process"
    - "Mirror ValidationService: JsonSchema.FromText(text, uri).Validate(jsonElement, ValidationLevel.Detailed)"
key-files:
  created:
    - "tests/ValidationService.Tests/Fixtures/KokoSchema.cs"
    - "tests/ValidationService.Tests/Services/CorvusOptionalFieldTests.cs"
    - "tests/ValidationService.Tests/Services/CorvusDateFormatTests.cs"
  modified:
    - "tests/ValidationService.Tests/DataProcessing.Validation.Tests.csproj"
decisions:
  - "Reused existing tests/ValidationService.Tests project instead of creating a duplicate under src/Services (RESEARCH 'no ValidationService.Tests' gap was stale)"
  - "A1 CONFIRMED TRUE: Corvus.Json.Validator asserts format:date — an empty string fails the format check"
  - "B1 target shape = optional field NOT in required[] + type:[string,null]; B2 target shape = anyOf [maxLength:0, format:date]"
metrics:
  duration: "~30 min"
  tasks: 3
  files: 4
  tests_added: 10
  completed: 2026-06-10
---

# Phase 36 Plan 01: Validation B1/B2 Corvus RED/Contract Tests Summary

Scaffolded the Corvus contract-test surface in `ValidationService.Tests` and authored 10 executable tests that pin the B1 (optional field empty/absent) and B2 (optional empty date) mechanisms against the REAL production validator (Corvus.Json.Validator), proving assumption A1 and locking the target schema shapes the 36-05 frontend fix must emit — all before any production fix.

## What Was Built

- **Corvus test surface (Task 1):** Added explicit `Corvus.Json.Validator` + `Corvus.Json.ExtendedTypes` package references to the existing `DataProcessing.Validation.Tests.csproj` so the new tests exercise the same validator entry point `ValidationService.cs` uses (`JsonSchema.FromText(...).Validate(record, ValidationLevel.Detailed)`) rather than the pre-existing `Newtonsoft.Json.Schema` re-implementation. Added `Fixtures/KokoSchema.cs` — the verbatim live `koko` schema (required `tararich`, `additionalProperties:false`) for downstream B3 use.
- **B1 contract (Task 2) — `CorvusOptionalFieldTests.cs` (4 tests):**
  - BROKEN shape characterization: optional field forced into `required[]` + `additionalProperties:false`; `{"id":1}` (note absent) → `IsValid==false` with a `required` error naming `note` (the "missing data" mechanism B1 must eliminate).
  - TARGET shape contract: `note` not-required + `type:["string","null"]`; absent, present-empty (`""`), and populated all → `IsValid==true`.
- **B2 contract (Task 3) — `CorvusDateFormatTests.cs` (6 tests):**
  - BROKEN shape: unconditional `format:date`; `{"date":""}` → `IsValid==false` with a date/format error → **proves A1**. Populated ISO date stays valid; malformed date stays invalid.
  - TARGET shape: `anyOf:[{maxLength:0},{format:date}]`; empty validates, populated valid date validates, malformed date still rejected.

## Key Findings

- **Assumption A1 CONFIRMED (executable proof):** Corvus.Json.Validator asserts `format:date` (not annotation-only) under `ValidationLevel.Detailed` — an empty string `""` fails. B2's mechanism is exactly as RESEARCH hypothesized.
- **.NET SDK:** `dotnet --version` = **10.0.100** (assumption A3 verified — .NET 10 SDK present, tests run).
- **Target shapes pinned for 36-05:** B1 → optional field absent from `required[]` and `type:["string","null"]`; B2 → `anyOf` of empty-string-or-`format:date`. Whichever shape 36-05 ships must satisfy these tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking/reality] Test project already existed at a different path**
- **Found during:** Task 1
- **Issue:** Plan (and 36-RESEARCH "Wave 0 Gaps") assumed NO `ValidationService.Tests` existed and specified creating `src/Services/ValidationService.Tests/ValidationService.Tests.csproj` + adding it to the sln. In reality a complete `tests/ValidationService.Tests/DataProcessing.Validation.Tests.csproj` already exists, is already in `DataProcessingPlatform.sln`, already references the ValidationService project, and contains prior tests. Creating a second same-named project/assembly would break the solution.
- **Fix:** Reused the existing `tests/ValidationService.Tests/` project. Added the new fixture under `Fixtures/` and the two test classes under `Services/`. No sln edit needed (already present).
- **Files:** all four key-files are under `tests/ValidationService.Tests/` (not `src/Services/`).
- **Commit:** 8bf4807

**2. [Rule 1 - Bug] Corvus validator-cache collision in the test harness**
- **Found during:** Task 2
- **Issue:** Initial `Validate` helper used a single fixed canonical URI for every schema. Corvus caches compiled validators by URI, so when multiple distinct schemas ran in one process the cache returned the wrong validator (the target schema bled into the broken-shape check → false pass/fail depending on run order; B1 broken-shape test failed only when run alongside the target tests).
- **Fix:** Derive the canonical URI from a SHA256 hash of the schema text (`urn:phase36:bN:{hash}`), mirroring how `ValidationService` uses a unique per-datasource URI. Identical schemas share one cache entry; distinct schemas never collide. B2 was authored with the same pattern from the start.
- **Files:** CorvusOptionalFieldTests.cs, CorvusDateFormatTests.cs
- **Commit:** d7d7b95

**3. [Rule 2 - Critical functionality] Explicit Corvus package references**
- **Found during:** Task 1
- **Issue:** The existing csproj only pulled Corvus transitively via the ValidationService ProjectReference, and its prior tests used `Newtonsoft.Json.Schema` (a re-implementation the plan explicitly warns against). The plan's must_have requires the csproj to contain `Corvus.Json.Validator` and that tests run the real validator.
- **Fix:** Added explicit `Corvus.Json.Validator` + `Corvus.Json.ExtendedTypes` PackageReferences (central-managed at 4.3.9). Satisfies the must_have and makes the real-validator dependency self-documenting.
- **Commit:** 8bf4807

### Note on CLAUDE.md
`CLAUDE.md` mandates `git add .` + `git push` and `task-orchestrator` MCP for task management. The orchestrator's explicit dirty-tree discipline (stage only this plan's files by path; the working tree carries ~1.5k pre-existing uncommitted changes) OVERRIDES the blanket `git add .` directive — staging was done file-by-file and nothing was pushed. task-orchestrator MCP was not used (executor context).

## Verification

- `dotnet build tests/ValidationService.Tests` → **exit 0** (only pre-existing NU1902/NU1903 transitive-CVE warnings, out of scope).
- `dotnet test --filter B1` → 4/4 pass. `--filter B2` → 6/6 pass. `--filter "B1|B2"` → 10/10 pass (no cross-class cache collision).
- Full project `dotnet test` → **100/100 pass** (90 pre-existing + 10 new), zero regressions.

## Commits

- `8bf4807` test(36-01): scaffold Corvus contract test surface + koko schema fixture
- `d7d7b95` test(36-01): B1 Corvus contract - optional field empty/absent must validate
- `2f34ad4` test(36-01): B2 Corvus contract - optional empty date + proves A1

## For the Next Plan

- 36-05 (frontend schema-generation fix) must make `generateJsonSchema` / `schemaAutoSuggest` emit shapes satisfying the TARGET tests here. Re-run `dotnet test --filter "B1|B2"` after the fix — the broken-shape tests remain as characterization; the target-shape tests are the acceptance gate.
- `KokoSchema.Json` is ready for the B3 converter+Corvus integration test (FileProcessorService.Tests) per RESEARCH B3.

## Self-Check: PASSED
- All 4 key files present on disk.
- All 3 task commits present in git history (8bf4807, d7d7b95, 2f34ad4).

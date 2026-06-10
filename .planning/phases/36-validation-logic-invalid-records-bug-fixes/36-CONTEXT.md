# Phase 36: Validation Logic & Invalid-Records Bug Fixes - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Source:** plan-phase synthesis from user bug report (express path) — user chose "research first" + "synthesize context"

<domain>
## Phase Boundary

Explore, root-cause, and fix **four user-reported bugs** in the validation pipeline and the Invalid Records experience, proving each fix against the **real MinIO test CSVs** and the **`koko`** data source, then locking the fixes in with a unit + integration + E2E test loop.

**In scope:** schema validation logic (optional vs. required handling, automatic date-format detection), the CSV→JSON conversion that feeds validation, the InvalidRecords API/query path, and the Invalid Records frontend page (display correctness + latency).

**Out of scope:** new features, schema-editor UX redesign, new connectors/protocols, and anything not needed to reproduce-and-fix B1–B4. No changes to the Phase-35 MinIO MVP behavior beyond what a validation fix requires (and that flow must still pass afterward).

**Reproduction fixtures:** the CSV files used in the file-simulator MinIO buckets (e.g. `ez-phase34-input`) and the `koko` data source + its schema (which defines `tararich` as required and a `date` field as optional). These are the live inputs to debug against.
</domain>

<decisions>
## Implementation Decisions

### Process (locked — this is how the phase runs)
- **Reproduce before fixing.** Every bug (B1–B4) must have a failing test or a documented live repro BEFORE the fix, with the exact responsible file + weak-point line identified in RESEARCH.
- **Map error → service → code → weak point.** For each bug, trace from the user-visible error to the responsible service, then to the specific code path, then to the root-cause line(s). Do not patch symptoms.
- **Debug with the real MinIO test files** and the `koko` source — not synthetic-only data — so the fix is proven against the data that actually fails today.
- **Fix → re-test → loop until green.** Review fix options, apply, re-run the relevant tests, iterate until the suite passes. No bug is "closed" without a regression test that fails before and passes after.
- **Run unit + integration + E2E** for the touched areas before sign-off. No regressions to the Phase-35 MinIO MVP flow.

### B1 — Optional field must not raise "missing data"
- An optional field with no value must NOT produce a required/"missing data" invalid-record error. The fix must distinguish "field is optional and absent/empty" (valid) from "field is required and absent" (invalid).

### B2 — Optional `date` field + empty value must pass
- The automatic date-format check must not fire on an **empty** value when the field is **optional**. Empty + optional = valid, even when the field name/type implies a date. (Auto date-format detection is expected behavior for *populated* date values; the bug is firing it on empty-optional.)

### B3 — `koko` / required `tararich` false-invalid (root-cause first)
- `tararich` is schema-defined as required and the rows DO contain data, yet records are invalid. The root cause must be found before fixing — candidate causes to investigate (research decides): CSV header/column-to-field mapping mismatch, whitespace/trim, BOM/encoding, Hebrew/RTL field-name matching, case sensitivity, or a required-check reading the wrong field. Fix the actual cause; add a test over the real `koko` data shape.

### B4 — Invalid Records page: show-all + latency
- The page must reliably show ALL existing invalid records (fix the missing-rows cause: query/filter/pagination/SignalR-refresh — research decides). Latency must be measurably reduced (record before/after numbers; fix the real cost: query/index/N+1/payload). Both correctness and latency are required.

### Claude's Discretion (research + planner decide)
- The precise root cause and minimal fix for each bug (the investigation determines this).
- Test split across unit/integration/E2E per bug, and which existing suites to extend vs. add.
- Whether any bug shares a root cause (e.g. B1 and B2 may both stem from the same optional/required-handling code path) and can be fixed together.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Validation logic (B1, B2, B3)
- `src/Services/ValidationService/Services/ValidationService.cs` — primary schema-validation implementation (optional/required handling + date-format detection live here; prime suspect for B1–B3)
- `src/Services/ValidationService/Services/IValidationService.cs` — validation contract
- `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs` — entry point that triggers validation in the pipeline
- `src/Services/Shared/Entities/DataProcessingSchema.cs` — schema entity (how required/optional + field types are modeled)
- `src/Services/Shared/Entities/DataProcessingValidationResult.cs` + `src/Services/ValidationService/Models/ValidationResult.cs` — how validation errors ("missing data") are produced
- Validation library: **Corvus.Json.Validator (JSON Schema 2020-12)** — referenced by ValidationService

### CSV → field mapping (B3 especially)
- `src/Services/Shared/Converters/CsvToJsonConverter.cs` — CSV→JSON conversion that shapes rows before validation (header→field mapping, trimming, encoding — likely relevant to `tararich` false-invalid)

### Invalid Records (B4)
- `src/Services/InvalidRecordsService/Controllers/InvalidRecordController.cs` — list/query API for invalid records
- `src/Services/InvalidRecordsService/Models/Requests/InvalidRecordListRequest.cs` — list request shape (filter/pagination)
- `src/Services/InvalidRecordsService/Hubs/InvalidRecordsHub.cs` — SignalR realtime updates for the page
- `src/Services/Shared/Entities/DataProcessingInvalidRecord.cs` — invalid-record entity (indexing/query cost)
- `src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx` — the Invalid Records page
- `src/Frontend/src/services/invalidrecords-api-client.ts` — page API client (query params, refresh)

### Project + test guidance
- `CLAUDE.md` — service architecture, SignalR `EntityChanged` contract, testing strategy (Vitest unit, Playwright E2E `baseURL http://localhost:7000`, webapp-testing python suite), `dotnet test` for backend integration
- `.planning/phases/35-minio-mvp-flow-end-to-end-ui/` — Phase-35 MinIO MVP flow (must still pass; source of the live MinIO test inputs)
</canonical_refs>

<specifics>
## Specific Ideas

- The `koko` data source is a concrete, reproducible failing case for B3 — its schema marks `tararich` as required; pull its actual schema + a failing row set from MinIO and debug against it.
- The validation environment is live: `minikube`/`ez-platform` is up (ValidationService + InvalidRecordsService running), and file-simulator MinIO holds the input CSVs — debugging can use the real running services + real files, not only unit fixtures.
- B1 and B2 likely share the optional/required code path in `ValidationService.cs` — investigate whether one fix covers both (date is just the auto-format variant of the same optional-handling gap).
- B4 has two distinct sub-problems (missing rows AND latency) — both must be fixed; capture before/after latency numbers as evidence.
</specifics>

<deferred>
## Deferred Ideas

- Broader validation-rule UX (e.g. per-field custom format rules in the schema editor) — out of scope unless a bug fix requires it.
- Invalid Records page feature additions (bulk workflows, export improvements) beyond the show-all + latency fix.
- Performance work on services other than the InvalidRecords query path.
</deferred>

---

*Phase: 36-validation-logic-invalid-records-bug-fixes*
*Context gathered: 2026-06-10 via plan-phase synthesis (user bug report)*

# Phase 36: Validation Logic & Invalid-Records Bug Fixes - Research

**Researched:** 2026-06-10
**Domain:** .NET 10 schema-validation pipeline (Corvus.Json JSON-Schema 2020-12) + CSV→JSON conversion + InvalidRecords API/query + React Invalid Records page
**Confidence:** HIGH (root causes confirmed against live cluster + real MinIO CSV + live `koko` schema)

## Summary

The validation pipeline does **not** decide required/optional or date-format in C#. `ValidationService.cs` is a thin pass-through that loads `dataSource.JsonSchema` and runs Corvus against each record (`ValidationService.cs:217`). All required/optional/format/`additionalProperties` semantics live **inside the persisted JSON Schema**, which is authored on the frontend during data-source import by `generateJsonSchema` (`schemaInferrer.ts:137`) + `schemaAutoSuggest.ts`. Therefore B1, B2 and B3 are *schema-generation / field-mapping* bugs, not Corvus bugs.

Live evidence nails B3: the real MinIO file `ez-phase34-input/mvp-deploy-111138.csv` has header `id,name,amount,date`, but the live `koko` schema (`_id 6a280d5cba225ef3a6bc07a6`) declares `required:[id,name,amount,tararich]` with `additionalProperties:false`. The CSV column is `date`; the schema field is `tararich`. They never match → every row is invalid (`tararich` missing + `date` is an unexpected additional property). B1 and B2 share one root cause: the schema generator models "optional" incorrectly — it derives `required[]` from *sample completeness* (not user intent) and applies `format:date`/`minLength`/numeric `type` to fields without permitting an empty/absent value, so an empty cell in an optional column (emitted as `""` by `CsvToJsonConverter`) fails.

B4 has two independent causes: (latency) `InvalidRecordRepository.GetPagedAsync` loads the **entire** matching collection into memory and paginates in C# (`InvalidRecordRepository.cs:63-71`), with **no MongoDB indexes** on the entity, and the page fires 3 such full-scan calls per filter change; (missing rows) the validation pipeline never broadcasts a SignalR `EntityChanged` when it creates invalid records (`ValidationService.cs:302-308`), so the page only updates on manual reload, and the UI shows `pageSize=10` grouped in Collapse panels where only the first group is expanded (`InvalidRecordsManagement.tsx:55,969`).

**Primary recommendation:** Fix at the schema-generation layer (optional/required + empty-value modeling), add a header↔schema-field reconciliation (or rename `tararich`→`date`), and rewrite `GetPagedAsync` to do server-side `Sort/Skip/Limit` + indexes + broadcast `EntityChanged` from the validation write path.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (process)
- **Reproduce before fixing.** Every bug (B1–B4) must have a failing test or documented live repro BEFORE the fix, with the responsible file + weak-point line.
- **Map error → service → code → weak point.** Trace user-visible error to service to code path to root-cause line(s). Do not patch symptoms.
- **Debug with the real MinIO test files** and the `koko` source — not synthetic-only data.
- **Fix → re-test → loop until green.** No bug closed without a regression test that fails before / passes after.
- **Run unit + integration + E2E** for touched areas. No regressions to the Phase-35 MinIO MVP flow.
- **B1:** an optional field with no value must NOT produce a required/"missing data" error. Distinguish "optional + absent/empty" (valid) from "required + absent" (invalid).
- **B2:** auto date-format check must not fire on an EMPTY value when the field is OPTIONAL. Empty + optional = valid. (Auto date-format is expected for *populated* date values.)
- **B3:** find the actual root cause of `tararich` false-invalid before fixing; add a test over the real `koko` data shape.
- **B4:** page must reliably show ALL invalid records; latency must be measurably reduced (record before/after numbers).

### Claude's Discretion (research + planner decide)
- Precise root cause + minimal fix per bug.
- Test split across unit/integration/E2E; which suites to extend vs add.
- Whether bugs share a root cause (e.g. B1+B2) and can be fixed together.

### Deferred Ideas (OUT OF SCOPE)
- Broader validation-rule UX (per-field custom format rules in schema editor) unless a fix requires it.
- Invalid Records page feature additions (bulk workflows, export improvements) beyond show-all + latency.
- Performance work on services other than the InvalidRecords query path.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| required/optional + format semantics | Frontend schema-gen (`schemaInferrer.ts`/`schemaAutoSuggest.ts`) | Persisted `dataSource.JsonSchema` (Mongo) | C# validator only *executes* the schema; the schema is authored client-side at import |
| CSV header → field-name mapping | Shared converter (`CsvToJsonConverter.cs`) + FileProcessor (`FileDiscoveredEventConsumer.cs`) | — | Headed CSV uses CSV header verbatim; SchemaPropertyNames only applied when headerless |
| Record validation execution | ValidationService (Corvus) | — | Pure pass-through over the stored schema |
| Invalid-record persistence + realtime | ValidationService write path + InvalidRecordsService | Hazelcast (not relevant) | Records written here must broadcast `EntityChanged` (currently do not) |
| Invalid-records list/query/pagination | InvalidRecordsService API/repo (Mongo) | — | Belongs server-side; currently done in-memory |
| Invalid-records display/refresh | Frontend page (`InvalidRecordsManagement.tsx`) | API client | Pagination/grouping/refresh logic |

## Canonical Pipeline (how a CSV becomes an invalid record)

```
MinIO CSV (ez-phase34-input/*.csv)
        │  FileDiscoveryService polls
        ▼
FileProcessorService — FileDiscoveredEventConsumer.cs
  • BuildConversionMetadata() : HasHeader, SchemaPropertyNames(headerless only), SchemaFieldTypes  (:454)
  • CsvToJsonConverter.ConvertToJsonAsync()  → JSON array of {header:value}        (:625)
  • stores JSON in Hazelcast "file-content", publishes ValidationRequestEvent
        ▼
ValidationService — ValidationRequestEventConsumer.cs
  • reads JSON from Hazelcast (:95)
  • ValidationService.ValidateFileContentAsync()
        - loads dataSource.JsonSchema (:70,121)   ← required/optional/format/additionalProperties live HERE
        - Corvus schema.Validate(record, Detailed) per record (:217)
        - StoreValidationResultsAsync(): writes DataProcessingInvalidRecord via SaveAsync (:302)  ← NO SignalR broadcast
        ▼
InvalidRecordsService — InvalidRecordController GET /api/v1/invalid-records
  • InvalidRecordRepository.GetPagedAsync(): loads ALL matches, in-memory Skip/Take (:63-71)
        ▼
Frontend InvalidRecordsManagement.tsx (pageSize=10, Collapse grouping, entity-changed listener)
```

Schema authoring path (separate, runs at import time):
```
Imported CSV sample → fileAnalyzer → schemaInferrer.generateJsonSchema()  (:137)
   • required[] = fields whose SAMPLE had no empty values   (:150-155)   ← B1
   • applySuggestions → schemaAutoSuggest.suggestConstraintsForField()
        - name includes "date"/"תאריך" → format:'date'      (:94-104)    ← B2
   • additionalProperties:false                              (:162)       ← compounds B3
→ persisted as dataSource.JsonSchema
```

---

## B1 — Optional field flagged "missing data"

**Responsible code (weak point):** `src/Frontend/src/utils/fileAnalyzer/schemaInferrer.ts:150-155`
```ts
// Mark as required if no null/undefined values
const hasEmpty = values.some((v) => v === null || v === undefined || v === '');
if (!hasEmpty && values.length > 0) {
  required.push(fieldName);          // ← required derived from SAMPLE completeness, not user intent
}
```
plus `schemaInferrer.ts:162` `additionalProperties: false`, and the C# error surface in `ValidationService.cs:225-229` (Corvus emits `the required property '<x>' was not present`), translated to "שדה חובה חסר / missing data" by `validationErrorTranslator.ts:94-95` (`required`/`properties` → "missing data").

**Root-cause hypothesis:** A field the user considers OPTIONAL is added to the schema's `required[]` array purely because the import sample rows happened to be fully populated. The persisted JSON Schema then lists it as required even though the UI/field intent is optional. Any later file/row where that column is empty or absent fails with a `required` ("missing data") error. (Mechanism note: `CsvToJsonConverter` emits an empty cell as `""` which is *present*, so a present-but-empty value satisfies `required` — the "missing data" verdict appears when the column is genuinely absent from the row, e.g. a short/trailing-empty row in headed mode, OR when an optional column was wrongly placed in `required[]` and a different file omits it. The fix must make optional truly optional regardless of sample shape.)

**Live evidence:** Confirmed/confirmable — the live `koko` schema marks **all four** fields required (`required:[id,name,amount,tararich]`) despite the import containing fully-populated samples; there is no path in `generateJsonSchema` that consults a user "optional" flag. To confirm the user-facing symptom directly, author/import a data source whose sample fully populates an intended-optional column, then feed a file with that column empty/absent.

**Minimal-fix direction (options):**
1. **(preferred)** Derive `required[]` from the user's explicit field `Required` flag (`SchemaField.Required`, `DataProcessingSchema.cs:28`), not from sample emptiness. Keep auto-inference only as a *suggestion* the user can override.
2. For any field NOT required, model emptiness explicitly: `type:["string","null"]` and/or `anyOf:[{const:""}, …]`, and have `CsvToJsonConverter` emit `null`/omit for empty optional cells instead of `""`.
3. Reconsider `additionalProperties:false` default (it converts any benign extra column into a hard failure).

**Reproduce (RED test):**
- Unit (frontend, Vitest): call `generateJsonSchema(['id','note'], [{id:'1',note:'x'},{id:'2',note:'y'}], true)` and assert `note` is NOT forced required when authored optional (after fix the generator must accept an optional-intent input). Co-locate with `src/Frontend/src/utils/__tests__/`.
- Unit (backend, xUnit): feed `{"id":1}` (optional `note` absent) + a schema where `note` is optional through Corvus and assert `IsValid==true`. New `ValidationService.Tests` project (none exists today).

**Test layers:** unit (schema generation) + integration (Corvus over the generated schema) + E2E (`invalid-records.spec.ts`) to confirm no "missing data" tag for the optional column.

---

## B2 — Optional `date` field + empty value → false error

**Responsible code (weak point):** `src/Frontend/src/utils/schemaAutoSuggest.ts:94-104`
```ts
// Date fields
if (nameLower.includes('date') || nameLower.includes('תאריך')) {
  suggestions.type = 'string';
  suggestions.format = 'date';      // ← asserted format, no allowance for empty/optional
  ...
}
```
Applied unconditionally via `applySuggestionsToSchema` (`schemaAutoSuggest.ts:275-277`) inside `inferPropertySchema` (`schemaInferrer.ts:233-235`). Corvus asserts `format` (confirmed: the InvalidRecords error parser handles `should have been'date' but was ''`, `InvalidRecordService.cs:199-205`), so an empty string `""` (what `CsvToJsonConverter.cs:93/123` emits for an empty cell) fails the `date` format check.

**Root-cause hypothesis:** Auto date-format detection adds `format:'date'` to any field whose name contains `date`/`תאריך`. For an OPTIONAL field with an EMPTY value, the generated schema has no escape hatch (no `["string","null"]`, no `if/then` on non-empty, no `anyOf` with empty `const`), and the converter supplies `""` (present, empty). Corvus then asserts `format:date` against `""` and errors — even though empty+optional should be valid. Same shared defect as B1: optional fields are not modeled to permit empty/absent.

**Live evidence:** The real MinIO CSV has a `date` column with valid ISO values (`2026-06-10`), so a *populated* date would pass — consistent with "auto date-format is expected for populated values; the bug is firing on empty-optional." The koko schema does not currently contain a `date`-named property (its field is `tararich`, plain string, no format), so B2 reproduces by importing/authoring an optional field literally named `date`/`תאריך` and feeding a row with that cell empty.

**Minimal-fix direction (options):**
1. When a field is optional, emit `type:["string","null"]` and have the converter map empty optional cells → `null` (covers B1+B2 together).
2. Wrap the format assertion so empty is allowed: `{"anyOf":[{"type":"string","maxLength":0},{"type":"string","format":"date"}]}` or `if`(non-empty)`then`(format) using 2020-12.
3. Keep `format:'date'` only for required/populated date fields.

**Reproduce (RED test):**
- Unit (backend, xUnit): schema `{properties:{date:{type:"string",format:"date"}}, required:[]}`; record `{"date":""}` → currently `IsValid==false` with `format`/"date" error; after fix `IsValid==true`.
- Unit (frontend, Vitest): assert `generateJsonSchema` produces an empty-tolerant shape for an optional `date` field.

**Test layers:** unit (schema-gen + Corvus) primary; E2E sanity that an optional-empty-date file produces 0 invalid records.

**Shared root cause with B1:** YES. Both stem from optional fields not permitting empty/absent values in the generated schema. A single fix to the optional-modeling path (`schemaInferrer.ts` + `schemaAutoSuggest.ts`, optionally `CsvToJsonConverter` empty→null) closes both. Plan them as one work item with two tests.

---

## B3 — `koko` / required `tararich` false-invalid (ROOT CAUSE CONFIRMED)

**Live ground truth (this session):**
- MinIO `ez-phase34-input/mvp-deploy-111138.csv` (99 bytes, clean UTF-8, **no BOM**, no extra whitespace):
  ```
  id,name,amount,date
  1,Alpha,100.50,2026-06-10
  2,Bravo,250.75,2026-06-10
  3,Charlie,99.99,2026-06-10
  ```
- Live `koko` schema (`_id 6a280d5cba225ef3a6bc07a6`, via `GET :5001/api/v1/datasource`):
  ```json
  { "type":"object",
    "properties":{ "id":{"type":"integer"}, "name":{"type":"string","minLength":2},
                   "amount":{"type":"number","minimum":0}, "tararich":{"type":"string"} },
    "required":["id","name","amount","tararich"],
    "additionalProperties":false }
  ```

**Root cause (CONFIRMED, not a guess):** The schema requires a field named **`tararich`**, but the CSV column is named **`date`**. Because the file HAS a header row, `CsvToJsonConverter` (header path, `CsvToJsonConverter.cs:73-80`) keys every record by the **CSV's own header names** (`id,name,amount,date`) and `SchemaPropertyNames` is applied **only when headerless** (`FileDiscoveredEventConsumer.cs:497-504`). So each record becomes `{id,name,amount,date}`. Validated against the koko schema this yields two failures per row:
1. `the required property 'tararich' was not present` → **B3's "tararich false-invalid"** (the data exists, but in a column named `date`, never mapped to `tararich`).
2. `date` is an unexpected property under `additionalProperties:false`.

It is **not** BOM, not encoding, not whitespace/trim, not RTL, not case sensitivity, and not "required-check reading the wrong field." It is a structural **schema-field-name ≠ CSV-header-name mismatch**, and headed CSV performs no header↔schema reconciliation. (`tararich` is a transliteration of תאריך = "date"; the schema field and the column are the same concept under two different names.)

**Why current stored invalid records look different:** The 4 existing `koko` invalid records in Mongo are from an older file `my-minio-test.csv` with `originalData {id,name,amount:"abc",tararich:"f"}` failing on `amount` type — a legitimate older shape. The *current* MinIO file (`…date`) is the live B3 reproduction once it flows through the pipeline.

**Minimal-fix direction (options — planner/discuss to choose):**
1. **Data-side (smallest):** rename schema field `tararich` → `date` so it matches the header (and re-evaluate `additionalProperties`). One-line schema change; matches the real file.
2. **Header reconciliation (code):** for headed CSV, detect header↔schema-property mismatches and either map by order to `SchemaPropertyNames` (risky for legit name-based files) or alias known synonyms — needs explicit, opt-in mapping config.
3. **Diagnostics:** when `additionalProperties:false` rejects a column whose name closely matches a required field, surface a clearer "header/field-name mismatch" error rather than a bare "required missing."

**Reproduce (RED test):**
- Integration (backend, xUnit, FileProcessorService.Tests — already exists): feed the exact 4-line CSV bytes through `CsvToJsonConverter.ConvertToJsonAsync(stream, {HasHeader:true})`, assert output records contain key `date` and NOT `tararich`; then run those records through Corvus with the koko schema and assert the `required 'tararich'` + additionalProperties failures. After the chosen fix, assert 0 failures.
- Use the literal bytes captured above as the fixture (matches the "real koko data shape" requirement in CONTEXT).

**Test layers:** integration (converter + Corvus against real bytes) primary; E2E MinIO MVP flow (`invalid-records.spec.ts` / Phase-35 flow) to confirm koko file ends valid.

---

## B4 — Invalid Records page: incomplete display + high latency

### Latency causes
1. **Full-collection in-memory pagination** — `src/Services/InvalidRecordsService/Repositories/InvalidRecordRepository.cs:62-71`:
   ```csharp
   var allMatchingRecords = await query.ExecuteAsync();   // loads EVERY matching doc
   var totalCount = allMatchingRecords.Count;
   var records = allMatchingRecords
       .OrderByDescending(r => r.CreatedAt)               // in-memory sort
       .Skip((request.Page - 1) * request.PageSize)       // in-memory paging
       .Take(request.PageSize).ToList();
   ```
   Every list request materializes the whole filtered set. `GetStatisticsAsync` (`:99-127`) and `GetActiveCountAsync` (`:150-165`) do the same full scan.
2. **No MongoDB indexes** on `DataProcessingInvalidRecord` (`DataProcessingInvalidRecord.cs` has no `[Index]`/index init; no index creation in `InvalidRecordsService/Program.cs`). Even a server-side sort on `CreatedAt` or filter on `DataSourceId` is a collection scan.
3. **3 full-scan calls per filter change from the UI** — `InvalidRecordsManagement.tsx` fires `fetchRecords` (page), `fetchStatistics` (`pageSize:1000`, `:157`), and `fetchFilteredStatistics` (`pageSize:1000`, `:198`) on every filter/page change (`useEffect :375-379`), each hitting `GetPagedAsync` → 3× whole-collection loads.
4. **MapToDtosAsync** does a second Mongo round-trip per call for data-source names (`InvalidRecordService.cs:113`) — batched (OK) but still per request.

**Fix direction:** rewrite `GetPagedAsync` to push filters into the Mongo query and use server-side `.Sort(CreatedAt desc).Skip().Limit()` + a separate `CountEstimatedAsync`/`CountAsync`; add indexes on `{DataSourceId}`, `{CreatedAt}`, `{ErrorType}`, `{IsIgnored,IsDeleted}` (compound for the common filter+sort); compute statistics with a Mongo aggregation (`$group`) instead of loading all docs; have the frontend stop fetching `pageSize:1000` for stats (derive counts server-side). Capture before/after P50/P95 (CONTEXT requires numbers).

### Missing-rows causes
1. **No realtime broadcast on pipeline-created invalid records** — `ValidationService.StoreValidationResultsAsync` (`ValidationService.cs:302-308`) writes `DataProcessingInvalidRecord` via `SaveAsync` with **no** SignalR `EntityChanged`. `InvalidRecordsHub` (`InvalidRecordsHub.cs`) only implements `OnConnectedAsync` — it broadcasts nothing. The only SignalR usage in the service is `RevalidationService.cs` (revalidation progress). The page listens for `entity-changed` with `entityType==='InvalidRecord'` (`InvalidRecordsManagement.tsx:351-362`) but that event is never emitted by the validation write path → newly produced invalid records do not appear until manual reload. This is the primary "doesn't always show all existing records" cause. (Per CLAUDE.md the `EntityChanged` broadcast is MANDATORY for CRUD — the validation write path violates this.)
2. **Collapsed grouping hides rows** — the page groups the current page's records by data source into AntD `Collapse` and only auto-expands the first group: `defaultActiveKey={Object.keys(groupedRecords).slice(0, 1)}` (`InvalidRecordsManagement.tsx:969`). Records in other groups are present but visually collapsed.
3. **Small page size** — `pageSize = 10` (`InvalidRecordsManagement.tsx:55`); with grouping this further fragments visibility.
4. **Status-filter contract mismatch (latent)** — `InvalidRecordListRequest.Status` comment lists `New, InProgress, Corrected, Ignored` (`InvalidRecordListRequest.cs:12`) but the repo switch only handles `reviewed/ignored/pending` (`InvalidRecordRepository.cs:48-59`); unmatched status silently applies no filter. Not the current cause (UI doesn't send status) but should be reconciled to prevent future drops.

**Fix direction:** broadcast `EntityChanged{EntityType:"InvalidRecord",Action:"created"}` from the validation write path (add `IHubContext` or publish an event InvalidRecordsService relays to its hub); expand all groups or remove grouping for completeness; raise/parameterize page size; align the status enum.

**Reproduce:**
- Integration (backend): seed N>pageSize invalid records, call `GET /api/v1/invalid-records` and assert server-side paging + `totalCount` correct and latency under target with indexes.
- E2E (`invalid-records.spec.ts` / `invalid-records-bulk.spec.ts`): process a file that yields invalid records and assert they appear **without manual reload** (after SignalR fix); assert all records across groups are reachable/visible.
- Latency: time `GET …?pageSize=10` before/after (record numbers).

**Test layers:** integration (repo paging + indexes + statistics aggregation) + unit (repo query builder) + E2E (realtime appearance + completeness).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Required/optional + format semantics | Custom C# field checks | The persisted JSON Schema executed by Corvus (already in place) | Single source of truth; fix at schema-generation, not by adding parallel C# logic |
| Pagination/sort | In-memory `Skip/Take` | Mongo `.Sort().Skip().Limit()` + `CountAsync` (MongoDB.Entities) | Avoids loading whole collection |
| Statistics aggregation | Load-all + LINQ `GroupBy` | Mongo aggregation `$group` | Server-side, index-friendly |
| Empty/optional value modeling | Trim/special-case in converter only | JSON-Schema `type:["string","null"]` / `anyOf` + empty→null | Declarative, validated consistently |

## Common Pitfalls

### Headed CSV ignores schema property names
Headed CSV keys records by the file's header verbatim; `SchemaPropertyNames` is applied only when headerless (`FileDiscoveredEventConsumer.cs:497-504`). A schema field name that differs from the header silently never matches → confusing "required X missing" + `additionalProperties` errors. (This IS B3.)

### `additionalProperties:false` turns name mismatches into hard failures
Default `additionalProperties:false` (`schemaInferrer.ts:162`) converts any benign extra/renamed column into an invalid record and masks the real cause (a missing required twin).

### Present-but-empty ≠ absent
JSON-Schema `required` checks *presence*, not non-emptiness. `CsvToJsonConverter` emits `""` for empty cells (present). So `minLength`/`format`/`type` (not `required`) are what fail on empty optional values — verification steps must distinguish these.

### CLAUDE.md mandates `EntityChanged` on all CRUD
The validation write path creates records without broadcasting — a direct CLAUDE.md violation and the B4 missing-rows cause.

## Project Constraints (from CLAUDE.md)
- Use `task-orchestrator` MCP via `mcp-exec` for task management (planner/execution concern).
- `kubectl` must be context-pinned: `kubectl --context=minikube -n ez-platform`; NEVER `kubectl config use-context`. Session A owns `minikube`/`ez-platform` only.
- Every CRUD controller MUST broadcast SignalR `EntityChanged` (relevant to B4 fix).
- Backend tests: `dotnet test` (xUnit + FluentAssertions + Moq). Frontend: Vitest unit + Playwright E2E (`baseURL http://localhost:7000`) + `webapp-testing` python suite. RTL/Hebrew error messages required.
- Performance targets: P99 API latency <500ms; file processing <1s/100 records (B4 latency budget reference).

## Validation Architecture

> nyquist_validation assumed enabled (no config flag disabling it found).

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | xUnit + FluentAssertions + Moq (`FileProcessorService.Tests.csproj`) |
| Backend quick run | `cd src/Services/FileProcessorService.Tests && dotnet test` |
| Frontend unit | Vitest (`src/Frontend/src/utils/__tests__/*.test.ts`) |
| Frontend E2E | Playwright (`src/Frontend/tests/e2e/`, baseURL `http://localhost:7000`) |
| Existing relevant suites | `FileProcessorService.Tests/CsvToJsonConverterHeaderlessTests.cs`; `tests/e2e/invalid-records*.spec.ts`; `utils/__tests__/validationErrorTranslator.test.ts` |
| Gap | **No `ValidationService.Tests` and no `InvalidRecordsService.Tests` projects exist** — Wave 0 must create them |

### Phase Requirements → Test Map
| Bug | Behavior | Test Type | Command | Suite |
|-----|----------|-----------|---------|-------|
| B1 | optional field, empty/absent → valid | unit | `dotnet test` (new ValidationService.Tests) + Vitest | new + `__tests__/` |
| B2 | optional date, empty → valid; populated date still checked | unit | `dotnet test` + Vitest | new + `schemaInferrer`/`schemaAutoSuggest` tests |
| B3 | real koko CSV bytes (`id,name,amount,date`) → valid after fix | integration | `dotnet test FileProcessorService.Tests` | extend `CsvToJsonConverter*Tests` |
| B4 latency | server-side paging + indexes; before/after numbers | integration | `dotnet test` (new InvalidRecordsService.Tests) | new |
| B4 missing-rows | new invalid records appear w/o reload; all groups visible | E2E | `npm run test:e2e` | `tests/e2e/invalid-records.spec.ts` |

### Reference fixtures
- Real CSV bytes captured this session (`id,name,amount,date` / 3 data rows) — use verbatim for B3.
- Live `koko` schema JSON (above) — use verbatim as the validation schema fixture.

### Sampling Rate
- Per task commit: targeted `dotnet test --filter` / `vitest run <file>`.
- Per wave merge: full `dotnet test` for touched services + `npm run test:e2e` for invalid-records specs.
- Phase gate: full backend + E2E green; Phase-35 MinIO MVP flow still green.

### Wave 0 Gaps
- [ ] Create `src/Services/ValidationService.Tests/` (xUnit) — covers B1/B2 Corvus behavior.
- [ ] Create `src/Services/InvalidRecordsService.Tests/` (xUnit) — covers B4 repo paging/indexes/statistics.
- [ ] Add real-bytes fixture to `FileProcessorService.Tests` for B3.
- [ ] Frontend unit tests for `schemaInferrer.generateJsonSchema` / `schemaAutoSuggest` optional handling.

## Environment Availability

| Dependency | Required By | Available | Version/Detail | Fallback |
|------------|------------|-----------|----------------|----------|
| minikube `ez-platform` cluster | live repro | ✓ | ValidationService/InvalidRecords/Mongo running | — |
| DataSourceManagement API :5001 | koko schema | ✓ | returned koko schema | — |
| InvalidRecords API :5007 | invalid records | ✓ | returned 4 koko records | — |
| MinIO :30900 (172.26.51.82) | real CSV bytes | ✓ | `ez-phase34-input/mvp-deploy-111138.csv` fetched | — |
| aws CLI | MinIO fetch | ✓ | AWSCLIv2 | — |
| kubectl | cluster reads | ✓ | chocolatey kubectl | — |
| dotnet 10 SDK | backend tests | assumed ✓ | not probed this session | verify in Wave 0 |
| mongosh | direct Mongo reads | ✗ | not installed | use :5007/:5001 APIs (sufficient) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Corvus.Json.Validator asserts `format` (not annotation-only) so empty `""` fails `format:date` | B2 | If format is annotation-only, B2's mechanism differs — but `InvalidRecordService.cs:199` parsing of "should have been 'date'" strongly implies assertion. Confirm with a unit test. |
| A2 | koko's persisted schema was produced by the import path (`generateJsonSchema`), not hand-edited | B1/B3 | If hand-edited via SchemaBuilderNew, the required[]/name authoring lives there too; check that path during planning. |
| A3 | dotnet 10 SDK present for `dotnet test` | Validation Arch | Wave 0 must verify; tests can't run otherwise. |
| A4 | The current MinIO `…date.csv` is the file that reproduces B3 live (vs older `my-minio-test.csv` records in Mongo) | B3 | Low — the bytes + schema mismatch are deterministic regardless of which file triggered the stored records. |

## Open Questions (RESOLVED)

1. **B3 intended fix:** rename schema field `tararich`→`date` (data) vs add header↔field reconciliation (code)? Recommendation: the data rename is smallest and matches the real file, but reconciliation prevents recurrence for all sources. **(RESOLVED — deferred to the `checkpoint:decision` gate in plan 36-06 Task 1; the executor confirms direction with the user at execution time.)**
2. **Optional modeling shape (B1/B2):** `type:["string","null"]` + empty→null in converter, vs `anyOf`/`if-then` keeping `""`? Recommendation: `["string","null"]` + converter empty→null is the cleanest single fix for both. **(RESOLVED — left to planner/executor discretion in plan 36-05; the 36-01 Corvus target test pins whichever shape ships, and 36-05 Task 3 reconciles backend+frontend on the shipped shape.)**
3. **Does SchemaBuilderNew (manual edit) reproduce B1?** It auto-populates patterns from format (`SchemaBuilderNew.tsx:54-59`) but its required[] authoring wasn't fully traced. **(RESOLVED — traced in plan 36-05 Task 1: `SchemaBuilderNew.tsx:54-59` added to read_first; the action confirms-or-excludes that path and documents the disposition in the SUMMARY so SC-2 holds regardless of schema origin.)**

## Sources

### Primary (HIGH — inspected this session)
- Live `koko` schema via `GET http://localhost:5001/api/v1/datasource` (`_id 6a280d5cba225ef3a6bc07a6`).
- Live invalid records via `GET http://localhost:5007/api/v1/invalid-records?dataSourceId=6a280d5cba225ef3a6bc07a6`.
- Real CSV bytes `s3://ez-phase34-input/mvp-deploy-111138.csv` (MinIO 172.26.51.82:30900).
- Code: `ValidationService.cs`, `ValidationRequestEventConsumer.cs`, `CsvToJsonConverter.cs`, `DataProcessingSchema.cs`, `schemaInferrer.ts`, `schemaAutoSuggest.ts`, `InvalidRecordRepository.cs`, `InvalidRecordService.cs`, `InvalidRecordController.cs`, `InvalidRecordsHub.cs`, `DataProcessingInvalidRecord.cs`, `InvalidRecordsManagement.tsx`, `invalidrecords-api-client.ts`, `FileDiscoveredEventConsumer.cs`, `validationErrorTranslator.ts`.

### Secondary (MEDIUM)
- CLAUDE.md (architecture, SignalR EntityChanged mandate, testing strategy, perf targets).
- `CsvToJsonConverterHeaderlessTests.cs` (confirms xUnit/FluentAssertions/Moq + converter behavior).

## Metadata
**Confidence breakdown:**
- B3 root cause: HIGH — confirmed by real CSV bytes + live schema (deterministic mismatch).
- B1/B2 root cause: HIGH (code) / MEDIUM (exact user-facing trigger) — located the generation defect; precise repro is constructive (koko has no optional field).
- B4 latency + missing-rows: HIGH — code-evident (in-memory paging, no indexes, no broadcast, collapsed grouping).
**Research date:** 2026-06-10
**Valid until:** ~2026-07-10 (stable internal code; re-verify live schema/file if the cluster data changes).

## RESEARCH COMPLETE

---
phase: 36-validation-logic-invalid-records-bug-fixes
plan: 05
subsystem: frontend-schema-generation
tags: [tdd-green, vitest, corvus, schema-inference, optional-fields, date-format, B1, B2]
requires:
  - "36-04 RED specs (schemaInferrer.optional, schemaAutoSuggest.optionalDate) — the contract this fix turns green"
  - "36-01 Corvus target shapes (TargetOptionalSchema type:[string,null]; TargetDateSchema anyOf[maxLength:0,format:date])"
provides:
  - "generateJsonSchema 4th { optionalFields } arg — required[] derived from optional intent, not sample completeness (B1)"
  - "Optional non-date field modeled empty-tolerant as type:[<type>,'null'] (B1)"
  - "Optional format field (date/תאריך) emitted empty-tolerant as anyOf:[{maxLength:0},{format}] via applySuggestionsToSchema (B2)"
  - "Shipped frontend optional/date shapes equal the 36-01 Corvus contract verbatim"
affects:
  - "Import wizard analyzers (csv/excel/json/xml) and ImportPreviewModal — callers of generateJsonSchema (backward-compatible, no change required)"
  - "36-06 (B3 backend GREEN) — independent; this closes the B1/B2 schema-generation root cause"
tech-stack:
  added: []
  patterns:
    - "Optional intent threaded as a backward-compatible 4th options arg ({ optionalFields: string[] }); when omitted, pre-36 sample-completeness behavior is preserved exactly"
    - "Empty-tolerant escape-hatch is format-aware: format fields → anyOf empty-or-format; plain fields → type union with null"
    - "applySuggestionsToSchema gained an optional 3rd { optional } arg; the date/format empty-tolerance lives at the suggestion layer, the null-tolerance + required-intent at the generator layer"
key-files:
  created: []
  modified:
    - "src/Frontend/src/utils/fileAnalyzer/schemaInferrer.ts"
    - "src/Frontend/src/utils/schemaAutoSuggest.ts"
decisions:
  - "Kept additionalProperties:false (schemaInferrer.ts:162) unchanged — B1 does not require relaxing it (optional fields are declared properties, so empty/absent validates against the union/anyOf); broadening it is schema-editor UX, explicitly deferred"
  - "Non-date optional fields modeled as type:[<inferredType>,'null'] (generalizes the 36-01 string case while preserving the inferred type); date/format optional fields use the anyOf empty-or-format shape so empty validates while populated stays format-checked"
  - "SchemaBuilderNew.tsx (manual editor) confirmed OUT OF SCOPE for B1 (RESEARCH Q3) — see Manual Editor Disposition below"
metrics:
  duration: ~6 min
  completed: 2026-06-10
  tasks: 3
  files: 2
---

# Phase 36 Plan 05: B1/B2 Frontend Schema-Generator GREEN Fix Summary

Closed the shared B1+B2 root cause at the schema-authoring layer: `generateJsonSchema` now derives `required[]` from explicit optional **intent** (a new `{ optionalFields }` arg) instead of sample completeness, and models optional fields empty-tolerant — a plain optional field as `type:[<type>,"null"]` and an optional `date`/`תאריך` field as `anyOf:[{maxLength:0},{format:"date"}]`. The four 36-04 RED specs are now GREEN, the two no-regression guards stay green, and the 36-01 backend Corvus contract (10/10) agrees with the shipped shapes verbatim.

## What Was Built

- **Task 1 (B1) — `schemaInferrer.ts`** (commit `bc4972b`): `generateJsonSchema` gained a backward-compatible 4th `options?: { optionalFields?: string[] }` argument (`GenerateJsonSchemaOptions`). Any field in `optionalFields` is excluded from `required[]` regardless of sample completeness and, via a new `isOptional` parameter threaded into `inferPropertySchema`, modeled empty-tolerant as `type:[<inferredType>,"null"]` (e.g. `note` → `["string","null"]`, the 36-01 `TargetOptionalSchema`). When no intent is supplied, the prior sample-completeness heuristic is preserved exactly — all existing callers (csv/excel/json/xml analyzers, ImportPreviewModal) are unaffected.
- **Task 2 (B2) — `schemaAutoSuggest.ts` + `schemaInferrer.ts` call-site** (commit `283e07f`): `applySuggestionsToSchema` gained an optional 3rd `{ optional }` arg (`ApplySuggestionsOptions`). For an optional field that ends up with an asserted `format` (date/תאריך/email/uri/uuid), it now emits the empty-tolerant `anyOf:[{type:"string",maxLength:0}, {<format branch>}]` (the 36-01 `TargetDateSchema`) so an empty value validates while a populated value is still format-checked. A required/populated date keeps strict `format:"date"` (no regression). `inferPropertySchema` threads the optional signal into the call; the threading and the signature widening landed in one commit to keep `tsc` green.
- **Task 3 — backend contract verification** (no code change): the shipped frontend shapes are byte-for-byte the 36-01 Corvus target placeholders, so no backend assertion update was required. `dotnet test --filter "B1|B2"` → **10/10 pass**.

## Manual Editor Disposition (RESEARCH Q3 — SchemaBuilderNew.tsx)

`SchemaBuilderNew.tsx` is **out of scope** for B1, and SC-2 ("optional field → no missing-data error") already holds for the manual path. Rationale (traced `:1-120`):
- It renders `jsonjoy-builder`'s `JsonSchemaEditor`; the user authors `properties`/`required[]` **explicitly via the editor UI toggles**. It never calls `generateJsonSchema` and never derives `required[]` from sample data — so the B1 sample-completeness defect cannot occur there.
- Its only auto-population, `autoPopulatePatterns` (`:42-77`), adds a regex `pattern` for a chosen `format`; it does not touch `required[]` and does not assert emptiness. A user who wants a field optional simply leaves it out of the editor's required set.

Because the defect is structurally absent from the manual editor, no change was made to it and it was not added to `files_modified`.

## Why additionalProperties:false was left unchanged

The B1 fix works correctly with the existing `additionalProperties:false` default (`schemaInferrer.ts:162`): an optional field is still a **declared property**, so an empty/absent value validates against its `["string","null"]` / `anyOf` shape without engaging `additionalProperties`. Relaxing `additionalProperties` is a separate concern (it compounds B3's header↔field-name mismatch, addressed in the B3 plans) and broadening it here would be schema-editor UX — explicitly deferred by CONTEXT/RESEARCH.

## Verification

- **B1 + B2 specs:** `cd src/Frontend && npm run test:unit -- schemaInferrer.optional schemaAutoSuggest.optionalDate` → **6/6 pass** (4 previously-RED assertions now green, 2 no-regression guards still green).
- **No-regression (callers + suggest):** full `npm run test:unit` → **245/245 pass** across 18 files (includes `vite-build-output.test.ts` build check and the existing `schemaAutoSuggest.test.ts` 34-test suite — `applySuggestionsToSchema`'s new arg is optional, 2-arg callers behave identically).
- **Backend Corvus contract:** `dotnet test tests/ValidationService.Tests --filter "B1|B2"` → **10/10 pass** (project lives at `tests/ValidationService.Tests/`, not the plan's `src/Services/...` path — confirmed by 36-01). Shipped shape equals the backend target shape; broken-shape characterization tests remain as-is.

## Deviations from Plan

### [Rule 3 - Reality/path] Backend test project path

- **Found during:** Task 3
- **Issue:** The plan's verify command referenced `src/Services/ValidationService.Tests`. The project actually lives at `tests/ValidationService.Tests/DataProcessing.Validation.Tests.csproj` (documented in the 36-01 summary). 
- **Fix:** Ran the filter against the real csproj path. No source change.

### [Note - Task boundary] B2 threading commit spans two files
The plan assigned Task 2 to `schemaAutoSuggest.ts` only. The optional-signal threading at the `inferPropertySchema` call site (one line in `schemaInferrer.ts`) was committed together with the `applySuggestionsToSchema` signature widening so that `tsc` stays green at the commit boundary (a 3-arg call to a 2-arg function would otherwise fail the build). Both files are listed in the plan's `files_modified`; the plan's Task 2 action explicitly anticipates threading "through applySuggestionsToSchema/inferPropertySchema."

### Note on CLAUDE.md
CLAUDE.md mandates `git add .` + `git push` and `task-orchestrator` MCP. The orchestrator's explicit dirty-tree discipline (stage only this plan's files by path; the working tree carries ~1.5k pre-existing uncommitted changes) OVERRIDES the blanket `git add .` — staging was file-by-file and nothing was pushed. task-orchestrator MCP was not used (executor context).

## Known Stubs

None. Both changes are wired production code paths with passing unit + contract coverage.

## Self-Check: PASSED

- FOUND: src/Frontend/src/utils/fileAnalyzer/schemaInferrer.ts (modified)
- FOUND: src/Frontend/src/utils/schemaAutoSuggest.ts (modified)
- FOUND commit bc4972b (Task 1, B1)
- FOUND commit 283e07f (Task 2, B2)
- B1+B2 frontend specs: 6/6 green; full frontend unit suite: 245/245 green
- Backend Corvus B1|B2 contract: 10/10 green
</content>
</invoke>

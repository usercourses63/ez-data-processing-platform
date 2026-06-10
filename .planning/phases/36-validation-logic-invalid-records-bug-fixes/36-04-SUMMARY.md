---
phase: 36-validation-logic-invalid-records-bug-fixes
plan: 04
subsystem: frontend-schema-generation
tags: [tdd-red, vitest, schema-inference, optional-fields, date-format, B1, B2]
requires:
  - "36-01 Corvus target shapes (TargetOptionalSchema, TargetDateSchema) — the empty-tolerant contract"
provides:
  - "B1 RED frontend spec: generateJsonSchema must derive required[] from optional intent, not sample completeness"
  - "B2 RED frontend spec: optional date empty-tolerant (anyOf), populated date still format-checked"
  - "Documented 36-05 signature change: generateJsonSchema gains 4th options arg { optionalFields: string[] }"
affects:
  - "36-05 (GREEN): must implement the optionalFields parameter + empty-tolerant modeling to turn these specs green"
tech-stack:
  added: []
  patterns:
    - "RED specs alias the production export to the POST-FIX signature via `as unknown as` so esbuild transpiles (no type-check) and the spec documents the exact contract"
    - "Frontend empty-tolerant shapes mirror the 36-01 Corvus C# target schemas verbatim (type:[string,null] / anyOf[maxLength:0, format:date])"
key-files:
  created:
    - "src/Frontend/src/utils/fileAnalyzer/__tests__/schemaInferrer.optional.test.ts"
    - "src/Frontend/src/utils/__tests__/schemaAutoSuggest.optionalDate.test.ts"
  modified: []
decisions:
  - "Both specs drive generateJsonSchema (not suggestConstraintsForField in isolation) because optionality + suggestions combine in inferPropertySchema to form the final property — testing the generator pins the user-facing output"
  - "Optional intent is modeled as a 4th `{ optionalFields: string[] }` argument (per-field flag alternative rejected for spec clarity); 36-05 is free to choose required-flag vs optional-list as long as these assertions pass"
metrics:
  duration: ~3 min
  completed: 2026-06-10
  tasks: 2
  files: 2
---

# Phase 36 Plan 04: B1/B2 Frontend RED Specs Summary

Two failing Vitest specs pin the corrected frontend schema-generation behavior for B1 (optional field must not be forced required) and B2 (optional date must be empty-tolerant while populated dates stay format-checked) — both RED today against `generateJsonSchema`/`schemaAutoSuggest`, defining exactly what the 36-05 fix must make green.

## What Was Built

- **Task 1 (B1 RED)** — `schemaInferrer.optional.test.ts`: drives `generateJsonSchema(['id','note'], <fully-populated rows>, false, { optionalFields: ['note'] })` and asserts the 36-05 contract: `note` is NOT in `required[]`, `note`'s property is empty-tolerant `type: ["string","null"]`, and `id` remains required. Aligned with `CorvusOptionalFieldTests.TargetOptionalSchema` (36-01).
- **Task 2 (B2 RED)** — `schemaAutoSuggest.optionalDate.test.ts`: drives `generateJsonSchema(['date'], <valid ISO dates>, true, { optionalFields: ['date'] })` and asserts an optional `date` field is empty-tolerant `anyOf:[{type:"string",maxLength:0},{type:"string",format:"date"}]` and not required; a separate case with no `optionalFields` asserts a required date keeps strict `format:"date"`. Aligned with `CorvusDateFormatTests.TargetDateSchema` (36-01).

## RED Confirmation (specs fail against current code)

Run: `cd src/Frontend && npm run test:unit -- schemaInferrer.optional schemaAutoSuggest.optionalDate`

Result: **2 test files failed, 4 tests failed, 2 tests passed (6 total).**

| Spec | Assertion | Status today | Why |
|------|-----------|--------------|-----|
| B1 | optional `note` not in `required[]` | RED (fail) | `schemaInferrer.ts:150-155` derives required[] from sample completeness; `note` is fully populated → forced required |
| B1 | optional `note` is `type:["string","null"]` | RED (fail) | generator emits bare `{ type: "string" }`; no empty-tolerant modeling |
| B1 | required `id` in `required[]` | green (pass) | no-regression guard — id is fully populated, stays required |
| B2 | optional `date` is `anyOf[maxLength:0, format:date]` | RED (fail) | `schemaAutoSuggest.ts:93-104` stamps bare `format:"date"`; no anyOf / empty escape hatch (`dateProp.anyOf` is `undefined`) |
| B2 | optional `date` not in `required[]` | RED (fail) | same sample-completeness defect as B1 |
| B2 | required/populated `date` keeps `format:"date"` | green (pass) | no-regression guard — intended auto-suggest preserved |

The 4 RED assertions encode the corrected behavior; the 2 passing assertions are no-regression guards that protect the intended required-field and populated-date behavior. This is the expected RED state for a TDD plan whose GREEN counterpart is 36-05.

## Signature Change 36-05 Must Make (handoff contract)

`generateJsonSchema` is today `(fieldNames, rows, applySuggestions)` with **no optional-intent input**. 36-05 must add a 4th argument carrying optionality intent. These specs model it as:

```ts
generateJsonSchema(fieldNames, rows, applySuggestions, { optionalFields?: string[] })
```

Required behavior for any field listed in `optionalFields`:
1. Exclude it from `required[]` **regardless of sample completeness** (fixes the `schemaInferrer.ts:150-155` heuristic).
2. Model it empty-tolerant:
   - non-date optional field → `type: ["string","null"]`
   - date/`תאריך` optional field → `anyOf: [{ type:"string", maxLength:0 }, { type:"string", format:"date" }]` (replace the unconditional `format:"date"` from `schemaAutoSuggest.ts:93-104`)
3. Fields NOT listed keep today's behavior (sample-completeness required + strict `format:"date"` for dates).

36-05 may instead implement a required-flag/required-list as long as it satisfies these assertions; the empty-tolerant shapes are fixed by the 36-01 Corvus target tests and must match.

## Deviations from Plan

None — plan executed exactly as written. Both files created at the planned paths; both verify commands run and are RED as specified.

## Known Stubs

None. These are test-only artifacts; no UI/data wiring involved.

## Self-Check: PASSED

- FOUND: src/Frontend/src/utils/fileAnalyzer/__tests__/schemaInferrer.optional.test.ts
- FOUND: src/Frontend/src/utils/__tests__/schemaAutoSuggest.optionalDate.test.ts
- FOUND commit 65d3e9c (B1 RED spec)
- FOUND commit 2907ba5 (B2 RED spec)

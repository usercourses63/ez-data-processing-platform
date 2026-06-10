/**
 * Phase 36-04, Bug B2 — RED spec (frontend schema-generation).
 *
 * Pins the CORRECTED behavior the 36-05 fix MUST make true. These assertions FAIL today:
 * `schemaAutoSuggest.suggestConstraintsForField` adds `format:'date'` unconditionally to any
 * field whose name contains `date`/`תאריך` (schemaAutoSuggest.ts:93-104), and
 * `applySuggestionsToSchema` (`:265-292`) stamps it onto the property inside
 * `inferPropertySchema` (schemaInferrer.ts:233-235) with NO escape hatch for empty/optional.
 * The CSV converter emits `""` for an empty cell, which Corvus then fails against `format:date`
 * (confirmed by the 36-01 A1 contract) — so an OPTIONAL empty date is wrongly invalid.
 *
 * TARGET shape (aligned with the 36-01 Corvus contract — see
 * tests/ValidationService.Tests/Services/CorvusDateFormatTests.cs `TargetDateSchema`):
 *   - an OPTIONAL date field is empty-tolerant:
 *       anyOf: [ { type: "string", maxLength: 0 }, { type: "string", format: "date" } ]
 *     so an empty string is valid while a populated value is still format-checked
 *   - a REQUIRED/populated date field keeps strict `format: "date"` (no regression of the
 *     intended auto-suggest)
 *
 * Required SIGNATURE CHANGE 36-05 must make: same as Task 1 (B1) — generateJsonSchema gains a
 * 4th `options` argument `{ optionalFields: string[] }`. A `date`/`תאריך` field listed in
 * `optionalFields` must be emitted empty-tolerant (the anyOf shape above) and excluded from
 * `required[]`; a date field NOT listed keeps strict `format:'date'`.
 *
 * RED because that 4th argument does not exist yet, so an optional date still gets a bare
 * `{ type: "string", format: "date" }` (no empty escape hatch) and is forced into required[].
 *
 * Run just this spec: `npm run test:unit -- schemaAutoSuggest.optionalDate`
 */
import { describe, expect, test } from 'vitest';

import { generateJsonSchema } from '../fileAnalyzer/schemaInferrer';

type GeneratedSchema = {
  $schema?: string;
  type: string;
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
};

type GenerateJsonSchemaWithOptionality = (
  fieldNames: string[],
  rows: Record<string, any>[],
  applySuggestions: boolean,
  options?: { optionalFields?: string[] }
) => GeneratedSchema;

const generate = generateJsonSchema as unknown as GenerateJsonSchemaWithOptionality;

describe('generateJsonSchema — B2 optional date empty-tolerance (RED until 36-05)', () => {
  // A column literally named `date`, populated with valid ISO dates in the sample.
  const dateRows = [{ date: '2026-06-10' }, { date: '2026-06-09' }];

  describe('OPTIONAL date field', () => {
    test('is empty-tolerant: anyOf permits an empty string OR a format:date value', () => {
      const schema = generate(['date'], dateRows, true, { optionalFields: ['date'] });
      const dateProp = schema.properties.date;

      // Aligns with CorvusDateFormatTests.TargetDateSchema:
      //   { "anyOf": [ { "type":"string","maxLength":0 }, { "type":"string","format":"date" } ] }
      expect(dateProp.anyOf).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'string', maxLength: 0 }),
          expect.objectContaining({ type: 'string', format: 'date' }),
        ])
      );
    });

    test('is NOT forced into required[] even though the sample is fully populated', () => {
      const schema = generate(['date'], dateRows, true, { optionalFields: ['date'] });

      expect(schema.required ?? []).not.toContain('date');
    });
  });

  describe('REQUIRED / populated date field', () => {
    test('keeps strict format:date enforcement (no regression of the auto-suggest)', () => {
      // No optionalFields → `date` is required; the intended date-format check is preserved.
      const schema = generate(['date'], dateRows, true);

      expect(schema.properties.date.format).toBe('date');
      expect(schema.required ?? []).toContain('date');
    });
  });
});

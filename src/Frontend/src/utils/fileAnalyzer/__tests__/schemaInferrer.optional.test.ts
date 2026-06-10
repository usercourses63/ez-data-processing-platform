/**
 * Phase 36-04, Bug B1 — RED spec (frontend schema-generation).
 *
 * Pins the CORRECTED behavior the 36-05 fix MUST make true. These assertions FAIL today
 * against `generateJsonSchema` (schemaInferrer.ts:137-164), whose `required[]` is derived
 * from SAMPLE completeness (`:150-155`), not from the user's optional/required intent. A
 * field the user marked OPTIONAL is wrongly forced into `required[]` whenever the import
 * sample rows happen to be fully populated — so a later file with that column empty/absent
 * fails with a `required` ("missing data") error.
 *
 * TARGET shape (aligned with the 36-01 Corvus contract — see
 * tests/ValidationService.Tests/Services/CorvusOptionalFieldTests.cs `TargetOptionalSchema`):
 *   - the intended-optional field is NOT in `required[]`
 *   - the intended-optional property is empty-tolerant: `type: ["string", "null"]`
 *   - a genuinely-required field still appears in `required[]`
 *
 * Required SIGNATURE CHANGE 36-05 must make (documented for the green plan):
 *   generateJsonSchema today is `(fieldNames, rows, applySuggestions)` with NO optional-intent
 *   input. 36-05 must add a 4th `options` argument carrying the user's optionality intent —
 *   here modeled as `{ optionalFields: string[] }`. Any field listed in `optionalFields` must
 *   be (a) excluded from `required[]` regardless of sample completeness and (b) modeled
 *   empty-tolerant (`type: ["string","null"]`). Fields not listed keep today's behavior.
 *
 * RED because that 4th argument does not exist yet (it is ignored), so an intended-optional,
 * sample-complete field is still forced required with a bare `{ type: "string" }` property.
 *
 * Run just this spec: `npm run test:unit -- schemaInferrer.optional`
 */
import { describe, expect, test } from 'vitest';

import { generateJsonSchema } from '../schemaInferrer';

/**
 * The POST-FIX signature 36-05 must implement. We alias the production export to this shape
 * so the spec documents (and exercises) the exact contract the green plan must satisfy.
 */
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

describe('generateJsonSchema — B1 optional intent (RED until 36-05)', () => {
  // Fixture: both columns fully populated in the sample, so today's sample-completeness
  // heuristic forces BOTH into required[]. `note` is the intended-OPTIONAL column; `id` is
  // the intended-REQUIRED column.
  const fieldNames = ['id', 'note'];
  const rows = [
    { id: '1', note: 'x' },
    { id: '2', note: 'y' },
  ];

  test('an intended-optional, sample-complete field is NOT forced into required[]', () => {
    const schema = generate(fieldNames, rows, false, { optionalFields: ['note'] });

    expect(schema.required ?? []).not.toContain('note');
  });

  test('a genuinely-required field still appears in required[]', () => {
    const schema = generate(fieldNames, rows, false, { optionalFields: ['note'] });

    expect(schema.required ?? []).toContain('id');
  });

  test('the optional property is empty-tolerant (type ["string","null"], the 36-01 agreed shape)', () => {
    const schema = generate(fieldNames, rows, false, { optionalFields: ['note'] });

    // Aligns with CorvusOptionalFieldTests.TargetOptionalSchema: { "note": { "type": ["string","null"] } }
    expect(schema.properties.note.type).toEqual(['string', 'null']);
  });
});

import { describe, expect, test } from 'vitest';

import {
  applySuggestionsToSchema,
  getSuggestionSummary,
  suggestConstraintsForField,
} from '../schemaAutoSuggest';

describe('suggestConstraintsForField', () => {
  describe('email fields', () => {
    test.each(['email', 'userEmail', 'דוא"ל', 'מייל-לקוח'])(
      'flags "%s" as email format with high confidence',
      (fieldName) => {
        const result = suggestConstraintsForField(fieldName);
        expect(result.type).toBe('string');
        expect(result.format).toBe('email');
        const emailConstraint = result.constraints.find((c) => c.value === 'email');
        expect(emailConstraint?.confidence).toBe('high');
      }
    );
  });

  describe('phone fields', () => {
    test('Israeli phone pattern + minLength 10 for English "phone" field', () => {
      const result = suggestConstraintsForField('phone');
      expect(result.type).toBe('string');
      expect(result.pattern).toBe('^05\\d{8}$');
      const minLength = result.constraints.find((c) => c.constraint === 'minLength');
      expect(minLength?.value).toBe(10);
    });

    test('also matches Hebrew "טלפון"', () => {
      const result = suggestConstraintsForField('טלפון');
      expect(result.pattern).toBe('^05\\d{8}$');
    });
  });

  describe('Israeli ID number fields', () => {
    test('"id_תעודת" gets 9-digit pattern + min/max length 9', () => {
      const result = suggestConstraintsForField('id_תעודת');
      expect(result.pattern).toBe('^\\d{9}$');
      expect(result.constraints.filter((c) => c.value === 9 && c.confidence === 'high')).toHaveLength(2);
    });

    test('plain "id" alone does NOT get ID-number constraints (needs Hebrew context)', () => {
      const result = suggestConstraintsForField('id');
      expect(result.pattern).toBeUndefined();
    });
  });

  describe('age fields', () => {
    test('"age" gets integer type with min 0 and max 120', () => {
      const result = suggestConstraintsForField('age');
      expect(result.type).toBe('integer');
      const min = result.constraints.find((c) => c.constraint === 'minimum');
      const max = result.constraints.find((c) => c.constraint === 'maximum');
      expect(min?.value).toBe(0);
      expect(max?.value).toBe(120);
    });
  });

  describe('price / amount / cost fields', () => {
    test.each(['price', 'amount', 'cost', 'מחיר', 'סכום', 'עלות'])(
      '"%s" gets number type with minimum 0 + multipleOf 0.01',
      (fieldName) => {
        const result = suggestConstraintsForField(fieldName);
        expect(result.type).toBe('number');
        expect(result.constraints.find((c) => c.constraint === 'minimum')?.value).toBe(0);
        expect(result.constraints.find((c) => c.constraint === 'multipleOf')?.value).toBe(0.01);
      }
    );
  });

  describe('percentage fields', () => {
    test('"percent" gets number type with min 0, max 100', () => {
      const result = suggestConstraintsForField('percent');
      expect(result.type).toBe('number');
      expect(result.constraints.find((c) => c.constraint === 'minimum')?.value).toBe(0);
      expect(result.constraints.find((c) => c.constraint === 'maximum')?.value).toBe(100);
    });

    test('"%" alone matches the percentage heuristic', () => {
      const result = suggestConstraintsForField('discount_%');
      expect(result.constraints.find((c) => c.constraint === 'maximum')?.value).toBe(100);
    });
  });

  describe('URL fields', () => {
    test.each(['url', 'link', 'website'])('"%s" gets uri format', (fieldName) => {
      const result = suggestConstraintsForField(fieldName);
      expect(result.format).toBe('uri');
    });
  });

  describe('UUID fields', () => {
    test('"uuid" gets uuid format', () => {
      expect(suggestConstraintsForField('uuid').format).toBe('uuid');
    });

    test('"uniqueId" also gets uuid format (id + unique heuristic)', () => {
      expect(suggestConstraintsForField('uniqueId').format).toBe('uuid');
    });
  });

  describe('boolean flag fields', () => {
    test.each(['isActive', 'hasChildren', 'האם_פעיל', 'סטטוס'])(
      '"%s" gets boolean type',
      (fieldName) => {
        expect(suggestConstraintsForField(fieldName).type).toBe('boolean');
      }
    );
  });

  describe('multiple matching heuristics', () => {
    test('field matching both name and age accumulates constraints from both', () => {
      // "ageName" matches both "age" (integer + min/max) and "name" (minLength 2)
      // The later branch (name) overwrites type from 'integer' back to 'string'.
      const result = suggestConstraintsForField('ageName');
      // Lock current behavior: name's `type='string'` runs after age's `type='integer'`
      expect(result.type).toBe('string');
      // Both sets of constraints should be present
      expect(result.constraints.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('fields with no matching heuristic', () => {
    test('returns base shape with empty constraints', () => {
      const result = suggestConstraintsForField('xyzzy');
      expect(result.fieldName).toBe('xyzzy');
      expect(result.constraints).toEqual([]);
      expect(result.type).toBeUndefined();
    });
  });
});

describe('getSuggestionSummary', () => {
  test('joins type / format / pattern / constraint count with commas', () => {
    const summary = getSuggestionSummary({
      fieldName: 'email',
      type: 'string',
      format: 'email',
      constraints: [{ constraint: 'format', value: 'email', reason: '', reasonHebrew: '', confidence: 'high' }],
    });
    expect(summary).toContain('Type: string');
    expect(summary).toContain('Format: email');
    expect(summary).toContain('1 constraint suggestions');
  });

  test('returns empty string when there is nothing to summarize', () => {
    expect(getSuggestionSummary({ fieldName: 'x', constraints: [] })).toBe('');
  });
});

describe('applySuggestionsToSchema', () => {
  test('adds type / format / pattern when schema does not already have them', () => {
    const schema = {};
    const result = applySuggestionsToSchema(schema, {
      fieldName: 'email',
      type: 'string',
      format: 'email',
      constraints: [],
    });
    expect(result.type).toBe('string');
    expect(result.format).toBe('email');
  });

  test('preserves existing schema fields (never overwrites)', () => {
    const schema = { type: 'number', format: 'currency' };
    const result = applySuggestionsToSchema(schema, {
      fieldName: 'price',
      type: 'string',
      format: 'email',
      constraints: [],
    });
    expect(result.type).toBe('number');
    expect(result.format).toBe('currency');
  });

  test('applies only high-confidence constraints', () => {
    const result = applySuggestionsToSchema(
      {},
      {
        fieldName: 'age',
        constraints: [
          { constraint: 'minimum', value: 0, reason: '', reasonHebrew: '', confidence: 'high' },
          { constraint: 'maximum', value: 120, reason: '', reasonHebrew: '', confidence: 'medium' },
        ],
      }
    );
    expect(result.minimum).toBe(0);
    expect(result.maximum).toBeUndefined();
  });

  test('does not mutate the input schema (returns a new object)', () => {
    const schema = { type: 'string' };
    const result = applySuggestionsToSchema(schema, {
      fieldName: 'name',
      constraints: [{ constraint: 'minLength', value: 2, reason: '', reasonHebrew: '', confidence: 'high' }],
    });
    expect(result).not.toBe(schema);
    expect(schema).toEqual({ type: 'string' });
    expect(result.minLength).toBe(2);
  });
});

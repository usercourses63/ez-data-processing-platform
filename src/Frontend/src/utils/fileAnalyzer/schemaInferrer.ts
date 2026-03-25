/**
 * Schema Inferrer
 * Infers JSON Schema 2020-12 from parsed data with type detection
 * and smart constraint suggestions via schemaAutoSuggest.
 */

import { suggestConstraintsForField, applySuggestionsToSchema } from '../schemaAutoSuggest';
import type { InferredType, FieldConstraintSummary } from './types';
import { TYPE_INFERENCE_SAMPLE_SIZE } from './types';

/** JSON Schema 2020-12 URI */
const SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

/**
 * Infer the type of a single string value.
 * Returns the most specific type that matches.
 */
export function inferTypeFromValue(value: string): 'string' | 'integer' | 'number' | 'boolean' {
  if (value === '' || value === null || value === undefined) {
    return 'string';
  }

  const trimmed = value.trim();

  // Boolean check: true/false/yes/no/0/1
  if (/^(true|false|yes|no)$/i.test(trimmed) || trimmed === '0' || trimmed === '1') {
    return 'boolean';
  }

  // Integer check: optional sign, digits only
  if (/^-?\d+$/.test(trimmed)) {
    return 'integer';
  }

  // Number check: optional sign, digits with decimal point
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return 'number';
  }

  return 'string';
}

/**
 * Infer the column type from a list of string values using majority-rules
 * with a type hierarchy.
 *
 * Type hierarchy (from most to least specific):
 * - All boolean -> boolean
 * - All integer -> integer
 * - Any number mixed with integer -> number
 * - Any string -> string
 */
export function inferColumnType(values: string[]): InferredType {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
  const sampleSize = Math.min(nonEmpty.length, TYPE_INFERENCE_SAMPLE_SIZE);
  const sample = nonEmpty.slice(0, sampleSize);

  if (sample.length === 0) {
    return { type: 'string', sampleCount: 0, confidence: 0 };
  }

  const typeCounts: Record<string, number> = {
    string: 0,
    integer: 0,
    number: 0,
    boolean: 0,
  };

  for (const value of sample) {
    const type = inferTypeFromValue(value);
    typeCounts[type]++;
  }

  // Apply type hierarchy
  // If any value is a plain string, the column is string
  if (typeCounts.string > 0) {
    return {
      type: 'string',
      sampleCount: sample.length,
      confidence: typeCounts.string / sample.length,
    };
  }

  // If all values are boolean
  if (typeCounts.boolean === sample.length) {
    return {
      type: 'boolean',
      sampleCount: sample.length,
      confidence: 1,
    };
  }

  // If mix of boolean and numeric, treat as string
  if (typeCounts.boolean > 0 && (typeCounts.integer > 0 || typeCounts.number > 0)) {
    return {
      type: 'string',
      sampleCount: sample.length,
      confidence: 0.5,
    };
  }

  // If any number (decimal) mixed with integer -> number
  if (typeCounts.number > 0) {
    return {
      type: 'number',
      sampleCount: sample.length,
      confidence: (typeCounts.number + typeCounts.integer) / sample.length,
    };
  }

  // All integer
  if (typeCounts.integer > 0) {
    return {
      type: 'integer',
      sampleCount: sample.length,
      confidence: typeCounts.integer / sample.length,
    };
  }

  // All boolean (already handled above, but as fallback)
  return {
    type: 'boolean',
    sampleCount: sample.length,
    confidence: typeCounts.boolean / sample.length,
  };
}

/**
 * Generate a JSON Schema 2020-12 from field names and row data.
 *
 * @param fieldNames - Ordered list of field/property names
 * @param rows - Array of row objects (field name -> string value)
 * @param applySuggestions - Whether to apply schemaAutoSuggest constraints (IMPORT-04)
 * @returns JSON Schema 2020-12 object
 */
export function generateJsonSchema(
  fieldNames: string[],
  rows: Record<string, string>[],
  applySuggestions: boolean
): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];

  for (const fieldName of fieldNames) {
    const values = rows.map((row) => String(row[fieldName] ?? ''));
    const inferred = inferColumnType(values);

    let propSchema: Record<string, unknown> = {
      type: inferred.type,
    };

    // Mark as required if no empty values in sample
    const hasEmptyValues = values.some((v) => v === '' || v === null || v === undefined);
    if (!hasEmptyValues && values.length > 0) {
      required.push(fieldName);
    }

    // Apply smart constraints from schemaAutoSuggest (IMPORT-04)
    if (applySuggestions) {
      const suggestions = suggestConstraintsForField(fieldName);
      propSchema = applySuggestionsToSchema(propSchema, suggestions);
    }

    properties[fieldName] = propSchema;
  }

  return {
    $schema: SCHEMA_2020_12,
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: false,
  };
}

/**
 * Build a field name -> inferred type map for preview display (D-10).
 */
export function buildFieldTypes(
  fieldNames: string[],
  rows: Record<string, string>[]
): Record<string, string> {
  const fieldTypes: Record<string, string> = {};

  for (const fieldName of fieldNames) {
    const values = rows.map((row) => String(row[fieldName] ?? ''));
    const inferred = inferColumnType(values);
    fieldTypes[fieldName] = inferred.type;
  }

  return fieldTypes;
}

/**
 * Build a field name -> constraint summary map from schemaAutoSuggest for preview display (D-10).
 */
export function buildFieldConstraints(fieldNames: string[]): Record<string, FieldConstraintSummary> {
  const fieldConstraints: Record<string, FieldConstraintSummary> = {};

  for (const fieldName of fieldNames) {
    const suggestions = suggestConstraintsForField(fieldName);
    fieldConstraints[fieldName] = {
      type: suggestions.type,
      format: suggestions.format,
      pattern: suggestions.pattern,
      constraints: suggestions.constraints.map((c) => ({
        constraint: c.constraint,
        value: c.value,
        reason: c.reason,
        confidence: c.confidence,
      })),
    };
  }

  return fieldConstraints;
}

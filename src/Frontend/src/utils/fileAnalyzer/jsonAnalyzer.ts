/**
 * JSON Analyzer
 * Parses JSON files, extracts field names, infers schema,
 * and produces ImportData for both array and single-object inputs.
 */

import type { ImportData } from './types';
import { PREVIEW_ROW_COUNT } from './types';
import { generateJsonSchema, buildFieldTypes, buildFieldConstraints } from './schemaInferrer';
import { inferFilePattern, inferDatasourceName } from './patternInferrer';

/**
 * Analyze a JSON file and produce an ImportData result.
 *
 * Handles both:
 * - Array of objects: `[{...}, {...}, ...]`
 * - Single object: `{...}` (wrapped into array of 1)
 *
 * @param text - Decoded JSON text content
 * @param filename - Original filename for pattern inference
 * @param encoding - Detected encoding name
 */
export function analyzeJson(text: string, filename: string, encoding: string): ImportData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`);
  }

  // Normalize to array of records
  let records: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error('JSON array is empty -- cannot infer schema');
    }
    records = parsed as Record<string, unknown>[];
  } else if (typeof parsed === 'object' && parsed !== null) {
    records = [parsed as Record<string, unknown>];
  } else {
    throw new Error('JSON must be an object or array of objects');
  }

  // Extract field names from the first record (top-level keys only)
  const firstRecord = records[0];
  const fieldNames = Object.keys(firstRecord);

  if (fieldNames.length === 0) {
    throw new Error('JSON record has no fields');
  }

  // Build preview rows (first 5 records, D-09) -- preserve original types
  const previewRows = records.slice(0, PREVIEW_ROW_COUNT);

  // Generate JSON Schema with auto-suggest (IMPORT-02, IMPORT-04)
  // Pass raw records (not stringified) so nested objects/arrays are correctly inferred
  const jsonSchema = generateJsonSchema(fieldNames, records, true);

  // Build field types for preview display (D-10) — shows object/array for nested types
  const fieldTypes = buildFieldTypes(fieldNames, records);
  const fieldConstraints = buildFieldConstraints(fieldNames);

  return {
    name: inferDatasourceName(filename),
    fileType: 'JSON',
    encoding,
    jsonSchema,
    filePattern: inferFilePattern(filename),
    previewRows,
    totalRowCount: records.length,
    fieldNames,
    fieldTypes,
    fieldConstraints,
  };
}

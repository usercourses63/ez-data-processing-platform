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

  // Convert values to strings for the schema inferrer
  const rowsAsStrings = records.map((record) => {
    const row: Record<string, string> = {};
    for (const key of fieldNames) {
      const value = record[key];
      if (value === null || value === undefined) {
        row[key] = '';
      } else if (typeof value === 'object') {
        row[key] = JSON.stringify(value);
      } else {
        row[key] = String(value);
      }
    }
    return row;
  });

  // Build preview rows (first 5 records, D-09) -- preserve original types for display
  const previewRows = records.slice(0, PREVIEW_ROW_COUNT).map((record) => {
    const row: Record<string, unknown> = {};
    for (const key of fieldNames) {
      row[key] = record[key];
    }
    return row;
  });

  // Generate JSON Schema with auto-suggest (IMPORT-02, IMPORT-04)
  const jsonSchema = generateJsonSchema(fieldNames, rowsAsStrings, true);

  // Build field types and constraints for preview display (D-10)
  const fieldTypes = buildFieldTypes(fieldNames, rowsAsStrings);
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

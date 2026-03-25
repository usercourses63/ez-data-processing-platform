/**
 * Excel Analyzer
 * Parses .xlsx files using SheetJS with typed values,
 * extracts field names, and infers schema.
 */

import * as XLSX from 'xlsx';
import type { ImportData } from './types';
import { PREVIEW_ROW_COUNT } from './types';
import { generateJsonSchema, buildFieldTypes, buildFieldConstraints } from './schemaInferrer';
import { inferFilePattern, inferDatasourceName } from './patternInferrer';

/**
 * Analyze an Excel .xlsx file and produce an ImportData result.
 *
 * Uses SheetJS with raw:true to preserve cell type metadata (Pitfall 5 from Research).
 * Takes the first sheet. Assumes first row is headers (SheetJS default).
 *
 * @param buffer - Raw ArrayBuffer of the .xlsx file
 * @param filename - Original filename for pattern inference
 */
export function analyzeExcel(buffer: ArrayBuffer, filename: string): ImportData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (workbook.SheetNames.length === 0) {
    throw new Error('Excel workbook has no sheets');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Parse with raw:true to get typed values
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true });

  if (rows.length === 0) {
    throw new Error('Excel sheet is empty');
  }

  // Extract field names from first row's keys
  const fieldNames = Object.keys(rows[0]);

  if (fieldNames.length === 0) {
    throw new Error('Excel sheet has no columns');
  }

  // Convert values to strings for the schema inferrer
  const rowsAsStrings = rows.map((row) => {
    const stringRow: Record<string, string> = {};
    for (const key of fieldNames) {
      const value = row[key];
      if (value === null || value === undefined) {
        stringRow[key] = '';
      } else if (value instanceof Date) {
        stringRow[key] = value.toISOString();
      } else {
        stringRow[key] = String(value);
      }
    }
    return stringRow;
  });

  // Build preview rows (first 5, D-09) -- preserve original typed values for display
  const previewRows = rows.slice(0, PREVIEW_ROW_COUNT).map((row) => {
    const preview: Record<string, unknown> = {};
    for (const key of fieldNames) {
      preview[key] = row[key];
    }
    return preview;
  });

  // Generate JSON Schema with auto-suggest (IMPORT-02, IMPORT-04)
  const jsonSchema = generateJsonSchema(fieldNames, rowsAsStrings, true);

  // Build field types and constraints for preview display (D-10)
  const fieldTypes = buildFieldTypes(fieldNames, rowsAsStrings);
  const fieldConstraints = buildFieldConstraints(fieldNames);

  return {
    name: inferDatasourceName(filename),
    fileType: 'Excel',
    encoding: 'UTF-8', // Excel is binary format; encoding is not applicable
    hasHeaders: true, // SheetJS default: first row is headers
    jsonSchema,
    filePattern: inferFilePattern(filename),
    previewRows,
    totalRowCount: rows.length,
    fieldNames,
    fieldTypes,
    fieldConstraints,
  };
}

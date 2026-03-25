/**
 * CSV Analyzer
 * Parses CSV files using PapaParse with automatic delimiter detection,
 * header detection, and schema inference.
 */

import Papa from 'papaparse';
import type { ImportData } from './types';
import { PREVIEW_ROW_COUNT } from './types';
import { generateJsonSchema, buildFieldTypes, buildFieldConstraints } from './schemaInferrer';
import { inferFilePattern, inferDatasourceName } from './patternInferrer';

/**
 * Detect whether the first row of CSV data contains headers.
 *
 * Heuristic (D-12): Compare the type distribution of the first row against
 * the average type distribution of subsequent data rows. If the first row
 * has significantly fewer numeric/boolean values, it is likely a header row.
 */
export function detectHasHeaders(rows: string[][]): boolean {
  if (rows.length < 2) {
    // With fewer than 2 rows, assume headers
    return true;
  }

  const firstRow = rows[0];
  const dataRows = rows.slice(1);

  // Count numeric/boolean values in the first row
  const firstRowNumericCount = firstRow.filter(isNumericOrBoolean).length;
  const firstRowRatio = firstRow.length > 0 ? firstRowNumericCount / firstRow.length : 0;

  // Calculate average numeric/boolean ratio across data rows (sample up to 10)
  const sampleRows = dataRows.slice(0, 10);
  let totalDataRatio = 0;
  for (const row of sampleRows) {
    const numericCount = row.filter(isNumericOrBoolean).length;
    totalDataRatio += row.length > 0 ? numericCount / row.length : 0;
  }
  const avgDataRatio = sampleRows.length > 0 ? totalDataRatio / sampleRows.length : 0;

  // If data rows have significantly more numeric/boolean values than the first row,
  // the first row is likely headers (text labels)
  // Threshold: data rows have at least 30% more numeric ratio than first row
  if (avgDataRatio - firstRowRatio >= 0.3) {
    return true;
  }

  // Additional check: if first row has all unique string values and no numbers,
  // it is likely headers
  if (firstRowNumericCount === 0 && avgDataRatio > 0.1) {
    return true;
  }

  // Check if first row values are all unique (header-like)
  const uniqueFirstRow = new Set(firstRow.map((v) => v.trim().toLowerCase()));
  if (uniqueFirstRow.size === firstRow.length && firstRow.length > 1) {
    // All unique - could be headers. Check if values look like labels
    const allAlpha = firstRow.every((v) => /^[a-zA-Z\u0590-\u05FF_\s]+$/.test(v.trim()));
    if (allAlpha) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a string value looks numeric or boolean.
 */
function isNumericOrBoolean(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return true;
  if (/^(true|false|yes|no)$/i.test(trimmed)) return true;
  return false;
}

/**
 * Analyze a CSV file and produce an ImportData result.
 *
 * @param text - Decoded CSV text content
 * @param filename - Original filename for pattern inference
 * @param encoding - Detected encoding name
 */
export function analyzeCsv(text: string, filename: string, encoding: string): ImportData {
  // Parse with PapaParse: header:false to get raw rows, preview 21 rows (1 header + 20 data)
  const parseResult = Papa.parse<string[]>(text, {
    header: false,
    preview: 21,
    dynamicTyping: false,
    skipEmptyLines: true,
  });

  const rawRows = parseResult.data;
  const detectedDelimiter = parseResult.meta.delimiter;

  if (rawRows.length === 0) {
    throw new Error('CSV file is empty or could not be parsed');
  }

  // Detect if first row is headers
  const hasHeaders = detectHasHeaders(rawRows);

  // Split into field names and data rows
  let fieldNames: string[];
  let dataRows: string[][];

  if (hasHeaders) {
    fieldNames = rawRows[0].map((h) => h.trim());
    dataRows = rawRows.slice(1);
  } else {
    // Generate synthetic field names: field_1, field_2, ... (IMPORT-03)
    const columnCount = rawRows[0].length;
    fieldNames = Array.from({ length: columnCount }, (_, i) => `field_${i + 1}`);
    dataRows = rawRows;
  }

  // Count total rows using a second parse with step callback
  let totalRowCount = 0;
  Papa.parse(text, {
    header: false,
    skipEmptyLines: true,
    step: () => {
      totalRowCount++;
    },
  });
  // Subtract header row from count if present
  if (hasHeaders) {
    totalRowCount = Math.max(0, totalRowCount - 1);
  }

  // Convert data rows to objects keyed by field name
  const dataRowObjects = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fieldNames.length; i++) {
      obj[fieldNames[i]] = row[i] ?? '';
    }
    return obj;
  });

  // Build preview rows (first 5 data rows, D-09)
  const previewRows = dataRowObjects.slice(0, PREVIEW_ROW_COUNT);

  // Generate JSON Schema with auto-suggest (IMPORT-02, IMPORT-04)
  const jsonSchema = generateJsonSchema(fieldNames, dataRowObjects, true);

  // Build field types and constraints for preview display (D-10)
  const fieldTypes = buildFieldTypes(fieldNames, dataRowObjects);
  const fieldConstraints = buildFieldConstraints(fieldNames);

  return {
    name: inferDatasourceName(filename),
    fileType: 'CSV',
    encoding,
    csvDelimiter: detectedDelimiter,
    hasHeaders,
    jsonSchema,
    filePattern: inferFilePattern(filename),
    previewRows,
    totalRowCount,
    fieldNames,
    fieldTypes,
    fieldConstraints,
  };
}

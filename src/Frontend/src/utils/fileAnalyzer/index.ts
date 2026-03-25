/**
 * File Analyzer - Main Orchestrator
 *
 * Entry point for the Import from File feature.
 * Delegates to format-specific analyzers based on file extension.
 *
 * Usage:
 *   import { analyzeFile } from '@/utils/fileAnalyzer';
 *   const importData = await analyzeFile(file);
 */

import type { ImportData } from './types';
import { MAX_FILE_SIZE_BYTES } from './types';
import { detectEncoding, decodeBuffer } from './encodingDetector';
import { analyzeCsv } from './csvAnalyzer';
import { analyzeJson } from './jsonAnalyzer';
import { analyzeXml } from './xmlAnalyzer';
import { analyzeExcel } from './excelAnalyzer';

// Re-export types and key functions for consumer convenience
export type { ImportData, ArchiveInfo, FileType, ArchiveType, XmlTreeNode, FieldConstraintSummary, InferredType } from './types';
export { MAX_FILE_SIZE_BYTES, PREVIEW_ROW_COUNT } from './types';
export { detectEncoding } from './encodingDetector';
export { generateJsonSchema, inferColumnType, inferTypeFromValue, buildFieldTypes, buildFieldConstraints } from './schemaInferrer';
export { inferFilePattern, inferDatasourceName } from './patternInferrer';
export { analyzeCsv, detectHasHeaders } from './csvAnalyzer';
export { analyzeJson } from './jsonAnalyzer';
export { analyzeXml, buildXmlTreeData } from './xmlAnalyzer';
export { analyzeExcel } from './excelAnalyzer';

/** Supported data file extensions */
const DATA_EXTENSIONS = new Set(['.csv', '.json', '.xml', '.xlsx', '.xls']);

/** Supported archive extensions */
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.tar.gz', '.rar', '.7z']);

/**
 * Get the file extension from a filename, handling .tar.gz special case.
 */
export function getFileExtension(filename: string): string {
  if (filename.toLowerCase().endsWith('.tar.gz')) {
    return '.tar.gz';
  }
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Check if an extension is a supported archive format.
 */
export function isArchiveExtension(ext: string): boolean {
  return ARCHIVE_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Check if an extension is a supported data or archive format.
 */
export function isSupportedExtension(ext: string): boolean {
  const lower = ext.toLowerCase();
  return DATA_EXTENSIONS.has(lower) || ARCHIVE_EXTENSIONS.has(lower);
}

/**
 * Analyze a data file and produce a unified ImportData structure.
 *
 * This is the main entry point for the Import from File feature.
 * It reads the file, detects encoding, and delegates to the appropriate
 * format-specific analyzer.
 *
 * @param file - The File object from the user's upload
 * @returns ImportData with all extracted information for form pre-fill
 * @throws Error if file is too large, unsupported, or malformed
 */
export async function analyzeFile(file: File): Promise<ImportData> {
  // File size check (10MB limit)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File size (${sizeMB}MB) exceeds the 10MB limit for client-side analysis. ` +
        'Please use a smaller sample file.'
    );
  }

  const ext = getFileExtension(file.name);

  if (!ext) {
    throw new Error('File has no extension. Supported formats: CSV, JSON, XML, Excel.');
  }

  // Archive files are handled separately (Plan 27-02)
  if (isArchiveExtension(ext)) {
    throw new Error(
      `Archive files (${ext}) are handled through the archive import flow. ` +
        'Please use the archive upload option.'
    );
  }

  if (!DATA_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file format: ${ext}. Supported formats: .csv, .json, .xml, .xlsx`
    );
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Excel files are binary -- pass ArrayBuffer directly
  if (ext === '.xlsx' || ext === '.xls') {
    return analyzeExcel(arrayBuffer, file.name);
  }

  // Text-based files: detect encoding and decode
  const buffer = new Uint8Array(arrayBuffer);
  const encoding = detectEncoding(buffer);
  const text = decodeBuffer(buffer, encoding);

  switch (ext) {
    case '.csv':
      return analyzeCsv(text, file.name, encoding);
    case '.json':
      return analyzeJson(text, file.name, encoding);
    case '.xml':
      return analyzeXml(text, file.name, encoding);
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

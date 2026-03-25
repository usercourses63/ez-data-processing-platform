/**
 * File Analyzer Types
 * Core types for the file analysis engine used by the Import from File feature.
 */

/** Supported data file types */
export type FileType = 'CSV' | 'JSON' | 'XML' | 'Excel';

/** Supported archive types */
export type ArchiveType = 'zip' | 'tar.gz' | 'rar' | '7z';

/**
 * Unified import data structure.
 * Produced by analyzeFile() and consumed by the preview modal and form pre-fill.
 * Matches D-06 and D-20 from CONTEXT.md.
 */
export interface ImportData {
  /** Suggested datasource name derived from filename */
  name: string;
  /** Detected file type */
  fileType: FileType;
  /** Detected file encoding (UTF-8, Windows-1255, ISO-8859-8, UTF-16) */
  encoding: string;
  /** Detected CSV delimiter (comma, semicolon, tab, pipe) */
  csvDelimiter?: string;
  /** Whether the CSV file has a header row */
  hasHeaders?: boolean;
  /** Inferred JSON Schema 2020-12 */
  jsonSchema: object;
  /** Inferred file name pattern (e.g., sales_*.csv) */
  filePattern: string;
  /** Whether the source is an archive file */
  isArchiveSource?: boolean;
  /** Archive type if applicable */
  archiveType?: ArchiveType;
  /** Archive password if user provided one */
  archivePassword?: string;
  /** Extraction pattern for files within the archive */
  extractionPattern?: string;
  /** First 5 rows of parsed data for preview (D-09) */
  previewRows: Record<string, unknown>[];
  /** Total number of data rows in the file */
  totalRowCount: number;
  /** Ordered list of field names */
  fieldNames: string[];
  /** Map of field name to inferred type for preview display (D-10) */
  fieldTypes: Record<string, string>;
  /** Map of field name to auto-suggested constraints from schemaAutoSuggest (D-10) */
  fieldConstraints: Record<string, FieldConstraintSummary>;
  /** Ant Design TreeDataNode[] for XML tree preview (D-11) */
  xmlTreeData?: XmlTreeNode[];
  /** Raw XML source text for browser-style preview */
  rawXmlSource?: string;
}

/** Summary of auto-suggested constraints for a single field */
export interface FieldConstraintSummary {
  type?: string;
  format?: string;
  pattern?: string;
  constraints: Array<{
    constraint: string;
    value: unknown;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

/** Ant Design TreeDataNode-compatible structure for XML preview */
export interface XmlTreeNode {
  title: string;
  key: string;
  children?: XmlTreeNode[];
  isLeaf?: boolean;
}

/** Information about an archive file */
export interface ArchiveInfo {
  /** List of file paths inside the archive */
  files: string[];
  /** Whether the archive is password-encrypted */
  isEncrypted: boolean;
  /** Type of archive */
  archiveType: ArchiveType;
}

/** Result from type inference for a column */
export interface InferredType {
  /** Primary inferred type */
  type: 'string' | 'integer' | 'number' | 'boolean';
  /** Number of samples analyzed */
  sampleCount: number;
  /** Proportion of non-empty values matching the inferred type */
  confidence: number;
}

/** Maximum file size for client-side parsing (10MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Number of preview rows to show in the modal (D-09) */
export const PREVIEW_ROW_COUNT = 5;

/** Number of rows to sample for type inference */
export const TYPE_INFERENCE_SAMPLE_SIZE = 20;

/**
 * Archive Handler
 * Handles .zip, .tar.gz, .rar, .7z files using a backend API for reliable
 * cross-format support, with JSZip as a client-side fallback for unencrypted .zip.
 *
 * Replaces the broken libarchive.js WASM approach with server-side SharpCompress.
 */
import JSZip from 'jszip';
import type { ArchiveType } from './types';

/** Information about a single file entry inside an archive */
export interface ArchiveFileEntry {
  /** File path within archive */
  name: string;
  /** Uncompressed size in bytes */
  size: number;
  /** Whether this entry is a directory */
  isDirectory: boolean;
}

/** Result of opening and inspecting an archive file */
export interface ArchiveResult {
  /** List of files in archive */
  files: ArchiveFileEntry[];
  /** Whether archive is password-protected */
  isEncrypted: boolean;
  /** Archive format type */
  archiveType: ArchiveType;
  /** Extract a single file from the archive, optionally with password */
  extractFile: (filename: string, password?: string) => Promise<ArrayBuffer>;
}

/** Data file extensions to look for inside archives */
const DATA_FILE_EXTENSIONS = ['.csv', '.json', '.xml', '.xlsx'];

/** Base URL for archive API (empty = relative, same origin) */
const API_BASE_URL = '';

/**
 * Detect archive type from file extension.
 * Handles the special .tar.gz case.
 */
function detectArchiveType(filename: string): ArchiveType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
  if (lower.endsWith('.rar')) return 'rar';
  if (lower.endsWith('.7z')) return '7z';
  return 'zip';
}

/**
 * Try opening a .zip file with JSZip (fast path for unencrypted .zip).
 * Returns null if the ZIP is encrypted or corrupted.
 */
async function tryJSZip(file: File): Promise<ArchiveResult | null> {
  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const files: ArchiveFileEntry[] = [];
    zip.forEach((relativePath, zipEntry) => {
      // JSZip internal _data is not typed but contains uncompressedSize
      const entryAny = zipEntry as unknown as Record<string, unknown>;
      const data = entryAny._data as { uncompressedSize?: number } | undefined;
      files.push({
        name: relativePath,
        size: data?.uncompressedSize ?? 0,
        isDirectory: zipEntry.dir,
      });
    });

    return {
      files,
      isEncrypted: false,
      archiveType: 'zip',
      extractFile: async (filename: string) => {
        const entry = zip.file(filename);
        if (!entry) {
          throw new Error(`File "${filename}" not found in archive`);
        }
        return await entry.async('arraybuffer');
      },
    };
  } catch {
    // JSZip fails on encrypted or unsupported zips - return null to fall through
    return null;
  }
}

/**
 * Analyze an archive file via the backend API.
 * Uses POST /api/v1/archive/analyze to list contents.
 */
async function handleArchiveViaBackend(
  file: File,
  password?: string
): Promise<ArchiveResult> {
  const archiveType = detectArchiveType(file.name);

  // Build form data for analyze endpoint
  const formData = new FormData();
  formData.append('file', file);
  if (password) {
    formData.append('password', password);
  }

  const analyzeResponse = await fetch(`${API_BASE_URL}/api/v1/archive/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!analyzeResponse.ok) {
    const errorBody = await analyzeResponse.text();
    let errorMessage = `Archive analysis failed (${analyzeResponse.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.message) {
        errorMessage = parsed.message;
      }
    } catch {
      // Use default message
    }
    throw new Error(errorMessage);
  }

  const data = await analyzeResponse.json() as {
    Files: Array<{ Name: string; Size: number; IsDirectory: boolean }>;
    ArchiveType: string;
    IsEncrypted: boolean;
  };

  const files: ArchiveFileEntry[] = data.Files.map((f) => ({
    name: f.Name,
    size: f.Size,
    isDirectory: f.IsDirectory,
  }));

  return {
    files,
    isEncrypted: data.IsEncrypted,
    archiveType: (data.ArchiveType as ArchiveType) || archiveType,
    extractFile: async (filename: string, pwd?: string) => {
      return extractFileViaBackend(file, filename, pwd || password);
    },
  };
}

/**
 * Extract a specific file from an archive via the backend API.
 * Uses POST /api/v1/archive/extract.
 */
async function extractFileViaBackend(
  archiveFile: File,
  filename: string,
  password?: string
): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append('file', archiveFile);
  formData.append('filename', filename);
  if (password) {
    formData.append('password', password);
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/archive/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `File extraction failed (${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.message) {
        errorMessage = parsed.message;
      }
    } catch {
      // Use default message
    }
    throw new Error(errorMessage);
  }

  return await response.arrayBuffer();
}

/** Check if an error message indicates encryption */
function isEncryptionError(message: string): boolean {
  const patterns = [
    'encrypted',
    'password',
    'passphrase',
    'Passphrase required',
    'decryption',
  ];
  const lower = message.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Handle an archive file.
 * Strategy: backend API first (handles all formats reliably),
 * falls back to JSZip for unencrypted .zip (works offline/without backend).
 *
 * @param file - The archive file to inspect
 * @param password - Optional password for encrypted archives
 * @returns ArchiveResult with file list and extraction capability
 */
export async function handleArchive(
  file: File,
  password?: string
): Promise<ArchiveResult> {
  const archiveType = detectArchiveType(file.name);

  // Try backend API first (handles all archive formats reliably)
  try {
    return await handleArchiveViaBackend(file, password);
  } catch (backendError) {
    console.warn(
      'Backend archive API unavailable, falling back to client-side:',
      backendError instanceof Error ? backendError.message : backendError
    );
  }

  // Fallback: for .zip without password, try JSZip client-side
  if (archiveType === 'zip' && !password) {
    const jszipResult = await tryJSZip(file);
    if (jszipResult) {
      return jszipResult;
    }
  }

  // No fallback available for non-zip or encrypted archives
  throw new Error(
    `Cannot process ${archiveType} archive: backend API is unavailable and ` +
      `client-side extraction is only supported for unencrypted .zip files.`
  );
}

/**
 * Filter archive entries to only data files.
 * Excludes directories, hidden files (starting with .), __MACOSX/ entries.
 * Per D-16: if exactly 1 data file, it will be auto-selected by the UI;
 * if multiple, UI shows selection.
 *
 * @param result - ArchiveResult from handleArchive
 * @returns Filtered list of data file entries
 */
export function getDataFilesFromArchive(
  result: ArchiveResult
): ArchiveFileEntry[] {
  return result.files.filter((entry) => {
    if (entry.isDirectory) return false;

    const name = entry.name;

    // Exclude hidden files and macOS resource forks
    if (name.startsWith('.') || name.includes('/.')) return false;
    if (name.startsWith('__MACOSX/') || name.includes('/__MACOSX/'))
      return false;

    // Check if extension is a supported data file
    const lower = name.toLowerCase();
    return DATA_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  });
}

/**
 * Extract a file from an archive and run it through the standard analysis pipeline.
 * Creates a File object from the extracted ArrayBuffer and calls the provided
 * analysis function, then decorates the result with archive metadata.
 *
 * @param result - ArchiveResult from handleArchive
 * @param selectedFile - Path of the file to extract within the archive
 * @param analyzeFileFn - The standard file analysis function to apply to the extracted file
 * @param password - Optional password for encrypted archives
 * @returns Analysis result augmented with archive metadata
 */
export async function extractAndAnalyze<T extends Record<string, unknown>>(
  result: ArchiveResult,
  selectedFile: string,
  analyzeFileFn: (file: File) => Promise<T>,
  password?: string
): Promise<T & {
  isArchiveSource: boolean;
  archiveType: ArchiveType;
  archivePassword?: string;
  extractionPattern?: string;
}> {
  // Extract the selected file as ArrayBuffer
  const arrayBuffer = await result.extractFile(selectedFile, password);

  // Derive filename from the archive path (use last segment)
  const fileName = selectedFile.includes('/')
    ? selectedFile.substring(selectedFile.lastIndexOf('/') + 1)
    : selectedFile;

  // Create a File object for the standard analysis pipeline
  const extractedFile = new File([arrayBuffer], fileName, {
    type: 'application/octet-stream',
  });

  // Run standard analysis
  const analysisResult = await analyzeFileFn(extractedFile);

  // Derive extraction pattern from selected filename
  // e.g., "data/report_2026.csv" -> "report_*.csv"
  const extractionPattern = deriveExtractionPattern(fileName);

  return {
    ...analysisResult,
    isArchiveSource: true,
    archiveType: result.archiveType,
    archivePassword: password || undefined,
    extractionPattern,
  };
}

/**
 * Derive an extraction pattern from a filename by wildcarding variable parts
 * (dates, numbers, sequences).
 */
function deriveExtractionPattern(filename: string): string {
  const extIdx = filename.lastIndexOf('.');
  if (extIdx === -1) return filename;

  const ext = filename.substring(extIdx);
  const base = filename.substring(0, extIdx);

  let pattern = base
    // Replace date-like patterns: YYYY-MM-DD, YYYYMMDD
    .replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, '*')
    // Replace standalone 4-digit years
    .replace(/\d{4}/g, '*')
    // Replace remaining number sequences (2+ digits)
    .replace(/\d{2,}/g, '*');

  // Collapse multiple consecutive wildcards
  pattern = pattern.replace(/\*+/g, '*');

  return `${pattern}${ext}`;
}

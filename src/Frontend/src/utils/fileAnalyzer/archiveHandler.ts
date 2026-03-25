/**
 * Archive Handler
 * Handles .zip, .tar.gz, .rar, .7z files using JSZip (unencrypted .zip)
 * and libarchive.js (encrypted .zip, .tar.gz, .rar, .7z).
 *
 * Per D-16 through D-19 from CONTEXT.md.
 */
import JSZip from 'jszip';
import { Archive } from 'libarchive.js';
import type { ArchiveType } from './types';

/** The reader type returned by Archive.open() */
type LibArchiveReader = Awaited<ReturnType<typeof Archive.open>>;

// Initialize libarchive.js with worker URL from the package dist
Archive.init({
  workerUrl: new URL(
    'libarchive.js/dist/worker-bundle.js',
    import.meta.url
  ).toString(),
});

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
 * Open an archive using libarchive.js (WASM-based).
 * Supports .zip (including encrypted), .tar.gz, .rar, .7z.
 */
async function openWithLibarchive(
  file: File,
  archiveType: ArchiveType,
  password?: string
): Promise<ArchiveResult> {
  let reader: LibArchiveReader | null = null;

  try {
    const opened = await Archive.open(file);
    reader = opened;

    // Check encryption status
    const encrypted = await opened.hasEncryptedData();
    const isEncrypted = encrypted === true;

    // If encrypted and password provided, set it
    if (isEncrypted && password) {
      await opened.usePassword(password);
    }

    // Get files list
    const filesObj = await opened.getFilesObject();
    const files: ArchiveFileEntry[] = [];

    // Recursively walk the files object structure
    function walkFilesObject(obj: Record<string, unknown>, prefix: string) {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}/${key}` : key;
        if (
          value &&
          typeof value === 'object' &&
          'name' in (value as Record<string, unknown>) &&
          'size' in (value as Record<string, unknown>)
        ) {
          // This is a CompressedFile
          const cf = value as { name: string; size: number };
          files.push({
            name: path,
            size: cf.size,
            isDirectory: false,
          });
        } else if (value && typeof value === 'object') {
          // This is a directory
          files.push({
            name: path + '/',
            size: 0,
            isDirectory: true,
          });
          walkFilesObject(value as Record<string, unknown>, path);
        }
      }
    }

    walkFilesObject(filesObj, '');

    // Keep reader alive for extraction; caller must manage lifecycle
    // Set reader to null so finally doesn't close it
    reader = null;

    return {
      files,
      isEncrypted,
      archiveType,
      extractFile: async (filename: string, pwd?: string) => {
        if (pwd) {
          await opened.usePassword(pwd);
        }
        const extracted = await opened.extractSingleFile(filename);
        const buffer = await extracted.arrayBuffer();
        return buffer;
      },
    };
  } catch (err) {
    // For encrypted archives where no password was provided, surface clearly
    const message = err instanceof Error ? err.message : String(err);
    if (
      isEncryptionError(message) &&
      !password
    ) {
      return {
        files: [],
        isEncrypted: true,
        archiveType,
        extractFile: async () => {
          throw new Error(
            'Archive is encrypted. Please provide a password to extract files.'
          );
        },
      };
    }
    throw err;
  } finally {
    // Only close if we still hold the reader (i.e., extraction wasn't set up)
    if (reader) {
      await reader.close();
    }
  }
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
 * For .zip: tries JSZip first (fast, no WASM), falls back to libarchive.js.
 * For .tar.gz, .rar, .7z: uses libarchive.js directly.
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

  // For .zip, try JSZip first (faster for unencrypted)
  if (archiveType === 'zip' && !password) {
    const jszipResult = await tryJSZip(file);
    if (jszipResult) {
      return jszipResult;
    }
    // JSZip failed - likely encrypted, fall through to libarchive.js
  }

  // Use libarchive.js for all other cases
  return openWithLibarchive(file, archiveType, password);
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

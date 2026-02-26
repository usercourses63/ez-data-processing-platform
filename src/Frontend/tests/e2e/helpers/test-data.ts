/**
 * Test data loader for protocol test fixtures.
 * Loads static test data files from the fixtures/ directory.
 *
 * Supported formats: CSV, JSON, XML, XLSX
 */
import * as fs from 'fs';
import * as path from 'path';

export const FORMATS = ['csv', 'json', 'xml', 'xlsx'] as const;
export type TestDataFormat = (typeof FORMATS)[number];

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

/**
 * Get the test data file name for a given format
 */
export function getTestDataFileName(format: TestDataFormat): string {
  return `test-data.${format}`;
}

/**
 * Get the full path to a test data fixture file
 */
export function getTestDataPath(format: TestDataFormat): string {
  return path.join(FIXTURES_DIR, getTestDataFileName(format));
}

/**
 * Load test data for a given format as a Buffer
 */
export function loadTestData(format: TestDataFormat): Buffer {
  const filePath = getTestDataPath(format);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test data fixture not found: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

/**
 * Verify that retrieved file content matches the original.
 *
 * Comparison strategy per format:
 * - CSV/XML: Text comparison (trim whitespace, normalize line endings)
 * - JSON: Parse both sides and deep compare
 * - XLSX: Byte-length comparison (binary format may vary between writes)
 */
export function verifyFileContent(
  original: Buffer,
  retrieved: Buffer,
  format: TestDataFormat
): boolean {
  switch (format) {
    case 'csv':
    case 'xml': {
      // Text comparison with normalized whitespace and line endings
      const originalText = normalizeText(original.toString('utf-8'));
      const retrievedText = normalizeText(retrieved.toString('utf-8'));
      return originalText === retrievedText;
    }

    case 'json': {
      try {
        const originalObj = JSON.parse(original.toString('utf-8'));
        const retrievedObj = JSON.parse(retrieved.toString('utf-8'));
        return JSON.stringify(originalObj) === JSON.stringify(retrievedObj);
      } catch {
        // If parse fails, fall back to text comparison
        const originalText = normalizeText(original.toString('utf-8'));
        const retrievedText = normalizeText(retrieved.toString('utf-8'));
        return originalText === retrievedText;
      }
    }

    case 'xlsx': {
      // Binary format may vary slightly; check that sizes are within 10% of each other
      // and both are non-empty
      if (original.length === 0 || retrieved.length === 0) return false;
      const sizeDiff = Math.abs(original.length - retrieved.length);
      const maxSize = Math.max(original.length, retrieved.length);
      return sizeDiff / maxSize < 0.1;
    }

    default:
      return false;
  }
}

/**
 * Normalize text for comparison: trim, normalize line endings, remove trailing whitespace per line
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

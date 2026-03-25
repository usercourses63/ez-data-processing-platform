/**
 * Encoding Detector
 * Detects file encoding using BOM markers and jschardet content analysis.
 * Supports UTF-8, Windows-1255, ISO-8859-8, UTF-16 (Hebrew encodings).
 */

import jschardet from 'jschardet';

/** Known encoding name mappings from jschardet to project conventions */
const ENCODING_MAP: Record<string, string> = {
  'utf-8': 'UTF-8',
  'ascii': 'UTF-8', // ASCII is a subset of UTF-8
  'utf-16le': 'UTF-16',
  'utf-16be': 'UTF-16',
  'windows-1255': 'Windows-1255',
  'iso-8859-8': 'ISO-8859-8',
  'iso-8859-8-i': 'ISO-8859-8',
  'windows-1252': 'Windows-1252',
  'iso-8859-1': 'ISO-8859-1',
};

/** Minimum confidence threshold for jschardet detection */
const MIN_CONFIDENCE = 0.5;

/** Maximum bytes to sample for content-based detection */
const SAMPLE_SIZE = 4096;

/**
 * Detect the encoding of a file from its raw bytes.
 * 1. Checks for BOM (Byte Order Mark) first.
 * 2. Falls back to jschardet content-based detection.
 * 3. Defaults to UTF-8 if detection confidence is too low.
 */
export function detectEncoding(buffer: Uint8Array): string {
  // Check BOM markers first
  const bom = detectBom(buffer);
  if (bom) {
    return bom;
  }

  // Use jschardet for content-based detection
  const sample = buffer.slice(0, Math.min(buffer.length, SAMPLE_SIZE));
  // jschardet expects a binary string
  const binaryString = Array.from(sample)
    .map((byte) => String.fromCharCode(byte))
    .join('');

  const result = jschardet.detect(binaryString);

  if (result && result.confidence >= MIN_CONFIDENCE && result.encoding) {
    const normalized = result.encoding.toLowerCase();
    return ENCODING_MAP[normalized] || result.encoding.toUpperCase();
  }

  // Default to UTF-8 if detection is inconclusive
  return 'UTF-8';
}

/**
 * Check for Byte Order Mark (BOM) at the start of the buffer.
 * Returns the encoding name if a BOM is found, null otherwise.
 */
function detectBom(buffer: Uint8Array): string | null {
  if (buffer.length < 2) {
    return null;
  }

  // UTF-8 BOM: EF BB BF
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'UTF-8';
  }

  // UTF-16 LE BOM: FF FE
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return 'UTF-16';
  }

  // UTF-16 BE BOM: FE FF
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return 'UTF-16';
  }

  return null;
}

/**
 * Decode a buffer to string using the detected encoding.
 * Maps project encoding names to TextDecoder label names.
 */
export function decodeBuffer(buffer: Uint8Array, encoding: string): string {
  const decoderLabel = getTextDecoderLabel(encoding);
  const decoder = new TextDecoder(decoderLabel);
  return decoder.decode(buffer);
}

/**
 * Map project encoding names to TextDecoder labels.
 */
function getTextDecoderLabel(encoding: string): string {
  const map: Record<string, string> = {
    'UTF-8': 'utf-8',
    'UTF-16': 'utf-16le',
    'Windows-1255': 'windows-1255',
    'ISO-8859-8': 'iso-8859-8',
    'Windows-1252': 'windows-1252',
    'ISO-8859-1': 'iso-8859-1',
  };
  return map[encoding] || 'utf-8';
}

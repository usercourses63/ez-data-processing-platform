import { describe, expect, test } from 'vitest';

import { decodeBuffer, detectEncoding } from '../encodingDetector';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

const ASCII_HELLO = 'Hello, world!';
const HEBREW_TEXT = 'שלום עולם'; // "Hello world" in Hebrew

describe('detectEncoding — BOM detection', () => {
  test('detects UTF-8 BOM (EF BB BF)', () => {
    const buf = bytes(0xef, 0xbb, 0xbf, 0x68, 0x69); // BOM + "hi"
    expect(detectEncoding(buf)).toBe('UTF-8');
  });

  test('detects UTF-16 LE BOM (FF FE)', () => {
    const buf = bytes(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00); // BOM + "hi" LE
    expect(detectEncoding(buf)).toBe('UTF-16');
  });

  test('detects UTF-16 BE BOM (FE FF)', () => {
    const buf = bytes(0xfe, 0xff, 0x00, 0x68, 0x00, 0x69); // BOM + "hi" BE
    expect(detectEncoding(buf)).toBe('UTF-16');
  });

  test('BOM detection wins over content-based detection', () => {
    // UTF-8 BOM followed by what would otherwise look like ASCII
    const buf = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(ASCII_HELLO)]);
    expect(detectEncoding(buf)).toBe('UTF-8');
  });
});

describe('detectEncoding — content-based fallback', () => {
  test('returns UTF-8 for plain ASCII content (jschardet maps ascii → UTF-8)', () => {
    const buf = new TextEncoder().encode(ASCII_HELLO);
    expect(detectEncoding(buf)).toBe('UTF-8');
  });

  test('returns UTF-8 for valid Hebrew UTF-8 content', () => {
    const buf = new TextEncoder().encode(HEBREW_TEXT);
    expect(detectEncoding(buf)).toBe('UTF-8');
  });

  test('returns UTF-8 default when buffer is too short to detect confidently', () => {
    // A 1-byte buffer: BOM check returns null (length < 2), jschardet runs but
    // confidence on 1 byte is below MIN_CONFIDENCE → defaults to UTF-8
    expect(detectEncoding(bytes(0x41))).toBe('UTF-8');
  });

  test('returns UTF-8 default for empty buffer', () => {
    expect(detectEncoding(new Uint8Array(0))).toBe('UTF-8');
  });
});

describe('decodeBuffer', () => {
  test('decodes a UTF-8 buffer', () => {
    const buf = new TextEncoder().encode(ASCII_HELLO);
    expect(decodeBuffer(buf, 'UTF-8')).toBe(ASCII_HELLO);
  });

  test('decodes a UTF-8 buffer with Hebrew content', () => {
    const buf = new TextEncoder().encode(HEBREW_TEXT);
    expect(decodeBuffer(buf, 'UTF-8')).toBe(HEBREW_TEXT);
  });

  test('falls back to utf-8 decoder for an unknown encoding name', () => {
    // getTextDecoderLabel returns 'utf-8' for unknown inputs; the resulting
    // TextDecoder still constructs and decodes the bytes.
    const buf = new TextEncoder().encode(ASCII_HELLO);
    expect(decodeBuffer(buf, 'ENCODING-THAT-DOES-NOT-EXIST')).toBe(ASCII_HELLO);
  });

  test('decodes UTF-16 LE bytes when label is UTF-16', () => {
    // "hi" in UTF-16 LE: 0x68 0x00 0x69 0x00
    const buf = bytes(0x68, 0x00, 0x69, 0x00);
    expect(decodeBuffer(buf, 'UTF-16')).toBe('hi');
  });
});

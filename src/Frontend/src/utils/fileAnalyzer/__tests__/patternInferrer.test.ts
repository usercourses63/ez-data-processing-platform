import { describe, expect, test } from 'vitest';

import { inferDatasourceName, inferFilePattern } from '../patternInferrer';

describe('inferFilePattern', () => {
  describe('ISO date patterns', () => {
    test('replaces YYYY-MM-DD with single wildcard', () => {
      expect(inferFilePattern('sales_2026-03-25.csv')).toBe('sales_*.csv');
    });

    test('replaces YYYY/MM/DD with single wildcard', () => {
      expect(inferFilePattern('report_2026/03/25.csv')).toBe('report_*.csv');
    });
  });

  describe('compact date patterns', () => {
    test('replaces YYYYMMDD with single wildcard', () => {
      expect(inferFilePattern('report_20260325.csv')).toBe('report_*.csv');
    });

    test('replaces 4-digit year (year-only filename) with wildcard', () => {
      expect(inferFilePattern('data_2026.json')).toBe('data_*.json');
    });

    test('replaces year 19xx as a year pattern (not generic digits)', () => {
      // 1999 hits the (?:19|20)\d{2} branch, not the d{2,} branch
      expect(inferFilePattern('archive_1999.zip')).toBe('archive_*.zip');
    });
  });

  describe('multi-segment digit replacement', () => {
    test('replaces only 2+ digit sequences; single digits stay literal', () => {
      // NOTE: source JSDoc claims the result is 'invoices_*_v*.xml' but the
      // regex rule is d{2,} — single digits never become wildcards. Locking
      // the actual (correct) behavior here. JSDoc example is inaccurate.
      expect(inferFilePattern('invoices_123_v2.xml')).toBe('invoices_*_v2.xml');
    });

    test('collapses adjacent wildcards when both segments are 2+ digits', () => {
      expect(inferFilePattern('data_123_456.csv')).toBe('data_*.csv');
    });
  });

  describe('files without extension', () => {
    test('returns the filename with patterns replaced but no extension appended', () => {
      expect(inferFilePattern('LOG_20260325')).toBe('LOG_*');
    });

    test('returns plain filenames unchanged', () => {
      expect(inferFilePattern('README')).toBe('README');
    });
  });

  describe('edge cases', () => {
    test('preserves filename with no date or digit pattern', () => {
      expect(inferFilePattern('customers.csv')).toBe('customers.csv');
    });

    test('preserves single digit (not replaced — rule is 2+ digits)', () => {
      expect(inferFilePattern('file_v1.txt')).toBe('file_v1.txt');
    });
  });
});

describe('inferDatasourceName', () => {
  test('strips a single-segment extension', () => {
    expect(inferDatasourceName('sales_2026.csv')).toBe('sales_2026');
  });

  test('strips a JSON extension', () => {
    expect(inferDatasourceName('report.json')).toBe('report');
  });

  test('strips .tar.gz as a compound extension (special case)', () => {
    expect(inferDatasourceName('data.tar.gz')).toBe('data');
  });

  test('returns the filename unchanged when there is no extension', () => {
    expect(inferDatasourceName('README')).toBe('README');
  });

  test('strips only the final extension when multiple dots are present (non-tar.gz case)', () => {
    expect(inferDatasourceName('archive.backup.zip')).toBe('archive.backup');
  });

  test('returns empty string for an empty filename', () => {
    expect(inferDatasourceName('')).toBe('');
  });
});

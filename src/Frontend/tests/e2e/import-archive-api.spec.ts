import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Backend Archive API Tests
 * Separated from UI tests to avoid Playwright request/page context interference.
 */

const TEST_DATA_DIR = path.resolve(__dirname, '../../test-data');

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(TEST_DATA_DIR, name));
}

test.describe('Backend Archive API', () => {
  test.describe('Format support', () => {
    test('ZIP: analyze lists all files', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'test.zip', mimeType: 'application/zip', buffer: readFixture('import-test-archive.zip') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.ArchiveType).toBe('zip');
      expect(data.IsEncrypted).toBe(false);
      const names = data.Files.map((f: { Name: string }) => f.Name);
      expect(names).toContain('archive-test.csv');
      expect(names).toContain('archive-test.json');
      expect(names).toContain('archive-test.xml');
    });

    test('TAR.GZ: analyze lists all files', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'test.tar.gz', mimeType: 'application/gzip', buffer: readFixture('import-test-archive.tar.gz') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.ArchiveType).toBe('tar.gz');
      expect(data.Files.length).toBe(3);
    });

    test('7Z: analyze lists all files', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'test.7z', mimeType: 'application/x-7z-compressed', buffer: readFixture('import-test-archive.7z') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.ArchiveType).toBe('7z');
      expect(data.Files.length).toBe(3);
    });

    test('RAR: analyze lists all files', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'test.rar', mimeType: 'application/x-rar-compressed', buffer: readFixture('import-test-archive.rar') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.ArchiveType).toBe('rar');
      expect(data.Files.length).toBe(3);
    });

    test('RAR: extract returns correct CSV content', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.rar', mimeType: 'application/x-rar-compressed', buffer: readFixture('import-test-archive.rar') },
          filename: 'archive-test.csv',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('Alice');
    });

    test('ZIP: extract returns correct CSV content', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.zip', mimeType: 'application/zip', buffer: readFixture('import-test-archive.zip') },
          filename: 'archive-test.csv',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('id,name,age,city');
    });

    test('TAR.GZ: extract returns correct JSON content', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.tar.gz', mimeType: 'application/gzip', buffer: readFixture('import-test-archive.tar.gz') },
          filename: 'archive-test.json',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('Alice');
    });

    test('7Z: extract returns correct XML content', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.7z', mimeType: 'application/x-7z-compressed', buffer: readFixture('import-test-archive.7z') },
          filename: 'archive-test.xml',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('<records>');
    });
  });

  test.describe('Encryption support', () => {
    test('Encrypted ZIP: detects encryption', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'enc.zip', mimeType: 'application/zip', buffer: readFixture('import-test-encrypted.zip') } },
      });
      const data = await response.json();
      expect(data.IsEncrypted).toBe(true);
    });

    test('Encrypted 7Z: detects encryption', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'enc.7z', mimeType: 'application/x-7z-compressed', buffer: readFixture('import-test-encrypted.7z') } },
      });
      const data = await response.json();
      expect(data.IsEncrypted).toBe(true);
    });

    test('Encrypted RAR: detects encryption', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'enc.rar', mimeType: 'application/x-rar-compressed', buffer: readFixture('import-test-encrypted.rar') } },
      });
      const data = await response.json();
      expect(data.IsEncrypted).toBe(true);
    });

    test('Encrypted RAR: extraction fails without password (400)', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.rar', mimeType: 'application/x-rar-compressed', buffer: readFixture('import-test-encrypted.rar') },
          filename: 'archive-test.csv',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('Encrypted RAR: extraction succeeds with password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.rar', mimeType: 'application/x-rar-compressed', buffer: readFixture('import-test-encrypted.rar') },
          filename: 'archive-test.csv', password: 'test123',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('Alice');
    });

    test('Encrypted ZIP: extraction fails without password (400)', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.zip', mimeType: 'application/zip', buffer: readFixture('import-test-encrypted.zip') },
          filename: 'archive-test.csv',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('Encrypted ZIP: extraction succeeds with password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.zip', mimeType: 'application/zip', buffer: readFixture('import-test-encrypted.zip') },
          filename: 'archive-test.csv', password: 'test123',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('Alice');
    });

    test('Encrypted 7Z: extraction succeeds with password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.7z', mimeType: 'application/x-7z-compressed', buffer: readFixture('import-test-encrypted.7z') },
          filename: 'archive-test.csv', password: 'test123',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('Alice');
    });
  });

  test.describe('Edge cases', () => {
    test('Nested paths: extract from subdirectory', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'nested.zip', mimeType: 'application/zip', buffer: readFixture('import-test-nested.zip') },
          filename: 'nested/subfolder/deep-data.csv',
        },
      });
      expect(response.ok()).toBeTruthy();
      expect(await response.text()).toContain('Alice');
    });

    test('Empty archive: lists files (no data files)', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'empty.zip', mimeType: 'application/zip', buffer: readFixture('import-test-empty.zip') } },
      });
      const data = await response.json();
      expect(data.Files.length).toBe(1);
      expect(data.Files[0].Name).toBe('readme.txt');
    });

    test('Non-existent entry: returns 404', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.zip', mimeType: 'application/zip', buffer: readFixture('import-test-archive.zip') },
          filename: 'does-not-exist.csv',
        },
      });
      expect(response.status()).toBe(404);
    });

    test('No file provided: returns 400', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'empty', mimeType: 'text/plain', buffer: Buffer.from('') } },
      });
      expect(response.status()).toBe(400);
    });
  });
});

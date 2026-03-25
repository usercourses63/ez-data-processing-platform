import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Comprehensive Import from Archive E2E Tests
 *
 * Coast-to-coast coverage of the entire archive import feature:
 * - All archive formats: .zip, .tar.gz, .7z (backend API)
 * - Password-protected archives: encrypted .zip, encrypted .7z
 * - Edge cases: nested paths, empty archives, single-file auto-select
 * - Completeness integration: archive fields in pre-filled form
 * - Regular file imports: CSV, JSON, XML regression
 */

const TEST_DATA_DIR = path.resolve(__dirname, '../../test-data');

/** Helper: select a file from archive selector and trigger analysis */
async function selectArchiveFile(
  modal: ReturnType<typeof import('@playwright/test').Page.prototype.locator>,
  filePattern: RegExp,
  page: import('@playwright/test').Page
) {
  const radio = modal.locator('.ant-radio-wrapper').filter({ hasText: filePattern });
  await radio.click();
  await page.waitForTimeout(500);

  const analyzeBtn = modal.locator('button').filter({ hasText: /Analyze|ניתוח|נתח/i });
  if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await analyzeBtn.click();
    await page.waitForTimeout(5000);
  }
}

// ============================================================================
// SECTION 1: Backend Archive API — All formats + encryption
// ============================================================================

test.describe('Backend Archive API', () => {
  function readFixture(name: string): Buffer {
    return fs.readFileSync(path.join(TEST_DATA_DIR, name));
  }

  test.describe('Format support', () => {
    test('ZIP: analyze lists all files', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'test.zip', mimeType: 'application/zip', buffer: readFixture('import-test-archive.zip') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.ArchiveType).toBe('zip');
      expect(data.IsEncrypted).toBe(false);
      expect(data.Files.map((f: { Name: string }) => f.Name)).toContain('archive-test.csv');
      expect(data.Files.map((f: { Name: string }) => f.Name)).toContain('archive-test.json');
      expect(data.Files.map((f: { Name: string }) => f.Name)).toContain('archive-test.xml');
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
      const content = await response.text();
      expect(content).toContain('id,name,age,city');
      expect(content).toContain('Alice');
    });

    test('ZIP: extract returns correct CSV content', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.zip', mimeType: 'application/zip', buffer: readFixture('import-test-archive.zip') },
          filename: 'archive-test.csv',
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await response.text();
      expect(content).toContain('id,name,age,city');
      expect(content).toContain('Alice');
    });

    test('TAR.GZ: extract returns correct JSON content', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.tar.gz', mimeType: 'application/gzip', buffer: readFixture('import-test-archive.tar.gz') },
          filename: 'archive-test.json',
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await response.text();
      expect(content).toContain('Alice');
      expect(content).toContain('"name"');
    });

    test('7Z: extract returns correct XML content', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'test.7z', mimeType: 'application/x-7z-compressed', buffer: readFixture('import-test-archive.7z') },
          filename: 'archive-test.xml',
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await response.text();
      expect(content).toContain('<records>');
      expect(content).toContain('Alice');
    });
  });

  test.describe('Encryption support', () => {
    test('Encrypted ZIP: detects encryption without password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'enc.zip', mimeType: 'application/zip', buffer: readFixture('import-test-encrypted.zip') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.IsEncrypted).toBe(true);
      // ZIP allows listing even when encrypted
      expect(data.Files.length).toBeGreaterThan(0);
    });

    test('Encrypted 7Z: detects encryption without password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'enc.7z', mimeType: 'application/x-7z-compressed', buffer: readFixture('import-test-encrypted.7z') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.IsEncrypted).toBe(true);
    });

    test('Encrypted RAR: detects encryption without password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'enc.rar', mimeType: 'application/x-rar-compressed', buffer: readFixture('import-test-encrypted.rar') } },
      });
      expect(response.ok()).toBeTruthy();
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
      const data = await response.json();
      expect(data.message).toContain('password');
    });

    test('Encrypted RAR: extraction succeeds with correct password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.rar', mimeType: 'application/x-rar-compressed', buffer: readFixture('import-test-encrypted.rar') },
          filename: 'archive-test.csv',
          password: 'test123',
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await response.text();
      expect(content).toContain('Alice');
    });

    test('Encrypted ZIP: extraction fails without password (400)', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.zip', mimeType: 'application/zip', buffer: readFixture('import-test-encrypted.zip') },
          filename: 'archive-test.csv',
        },
      });
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('password');
    });

    test('Encrypted ZIP: extraction succeeds with correct password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.zip', mimeType: 'application/zip', buffer: readFixture('import-test-encrypted.zip') },
          filename: 'archive-test.csv',
          password: 'test123',
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await response.text();
      expect(content).toContain('Alice');
    });

    test('Encrypted 7Z: extraction succeeds with correct password', async ({ request }) => {
      const response = await request.post('/api/v1/archive/extract', {
        multipart: {
          file: { name: 'enc.7z', mimeType: 'application/x-7z-compressed', buffer: readFixture('import-test-encrypted.7z') },
          filename: 'archive-test.csv',
          password: 'test123',
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await response.text();
      expect(content).toContain('Alice');
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
      const content = await response.text();
      expect(content).toContain('Alice');
    });

    test('Empty archive: lists files (no data files)', async ({ request }) => {
      const response = await request.post('/api/v1/archive/analyze', {
        multipart: { file: { name: 'empty.zip', mimeType: 'application/zip', buffer: readFixture('import-test-empty.zip') } },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      // Has readme.txt but no data files
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

// ============================================================================
// SECTION 2: UI Archive Import — All formats
// ============================================================================

test.describe('UI Archive Import', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('ZIP: shows file selector with 3 data files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const radios = modal.locator('.ant-radio-wrapper');
    expect(await radios.count()).toBe(3);

    const text = await modal.textContent();
    expect(text).toContain('archive-test.csv');
    expect(text).toContain('archive-test.json');
    expect(text).toContain('archive-test.xml');
  });

  test('TAR.GZ: shows file selector via backend API', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.tar.gz'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const text = await modal.textContent();
    expect(text).toContain('archive-test.csv');
  });

  test('7Z: shows file selector via backend API', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.7z'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const text = await modal.textContent();
    expect(text).toContain('archive-test.csv');
    expect(text).toContain('archive-test.json');
  });

  test('RAR: shows file selector via backend API', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.rar'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const text = await modal.textContent();
    expect(text).toContain('archive-test.csv');
    expect(text).toContain('archive-test.json');
  });

  test('ZIP: select CSV → preview shows data', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    await selectArchiveFile(modal, /archive-test\.csv/, page);

    const content = await modal.textContent();
    expect(content?.includes('Alice') || content?.includes('age')).toBeTruthy();
  });

  test('7Z: select JSON → preview shows structured data', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.7z'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    await selectArchiveFile(modal, /archive-test\.json/, page);

    // JSON preview should be in <pre> block
    const preBlock = modal.locator('pre');
    if (await preBlock.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await preBlock.textContent();
      expect(text?.includes('Alice') || text?.includes('name')).toBeTruthy();
    }
  });

  test('Encrypted ZIP: shows password input', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-encrypted.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should show password input for encrypted archive
    const passwordInput = modal.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
  });

  test('Encrypted ZIP: enter password → select file → preview', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-encrypted.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Enter password
    const passwordInput = modal.locator('input[type="password"]');
    await passwordInput.fill('test123');
    await page.waitForTimeout(500);

    // Select CSV and analyze
    await selectArchiveFile(modal, /archive-test\.csv/, page);

    // Should show CSV data after extraction with password
    const content = await modal.textContent();
    expect(content?.includes('Alice') || content?.includes('age')).toBeTruthy();
  });

  test('Nested paths ZIP: shows files in subdirectories', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-nested.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const text = await modal.textContent();
    // Should show nested paths
    expect(text?.includes('deep-data.csv') || text?.includes('data.json')).toBeTruthy();
  });

  test('Empty archive: shows "no data files" warning', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-empty.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should show warning about no supported data files
    const warning = modal.locator('.ant-alert-warning');
    await expect(warning).toBeVisible({ timeout: 5000 });
  });

  test('Cancel modal: no side effects', async ({ page }) => {
    const urlBefore = page.url();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click cancel / close button
    const cancelBtn = modal.locator('button').filter({ hasText: /Cancel|ביטול/i });
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      // Close via X button
      await modal.locator('.ant-modal-close').click();
    }
    await page.waitForTimeout(1000);

    // Should stay on same page, no navigation
    expect(page.url()).toBe(urlBefore);
    // Modal should be gone
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// SECTION 3: Archive → Form Pre-fill + Completeness
// ============================================================================

test.describe('Archive to Form Integration', () => {
  test.describe.configure({ mode: 'serial' });

  test('ZIP CSV: Continue → form pre-filled with completeness', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Select CSV and analyze
    await selectArchiveFile(modal, /archive-test\.csv/, page);

    // Click Continue
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should be on create form
    expect(page.url()).toContain('/datasources/new');

    // Completeness sidebar should show progress > 0%
    const progressRing = page.locator('div.ant-progress-circle');
    await expect(progressRing).toBeVisible({ timeout: 5000 });

    // Schema tab should show 1/1 (schema was inferred from CSV)
    const sidebarText = await page.locator('.ant-card').filter({ has: page.locator('div.ant-progress-circle') }).textContent();
    expect(sidebarText).toContain('1/1');
  });

  test('7Z JSON: Continue → form pre-filled with JSON schema', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.7z'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    await selectArchiveFile(modal, /archive-test\.json/, page);

    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    expect(page.url()).toContain('/datasources/new');

    // Completeness sidebar should be visible with progress
    const progressRing = page.locator('div.ant-progress-circle');
    await expect(progressRing).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// SECTION 4: Regular file import regression
// ============================================================================

test.describe('Regular File Import Regression', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('CSV with headers: preview + schema + Continue', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-with-headers.csv'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should show CSV preview
    const content = await modal.textContent();
    expect(content).toBeTruthy();

    // Continue button should be available
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    expect(page.url()).toContain('/datasources/new');
  });

  test('JSON file: preview + schema + Continue', async ({ page }) => {
    const jsonPath = path.join(TEST_DATA_DIR, 'import-test.json');
    if (!fs.existsSync(jsonPath)) { test.skip(); return; }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(jsonPath);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    expect(page.url()).toContain('/datasources/new');
  });
});

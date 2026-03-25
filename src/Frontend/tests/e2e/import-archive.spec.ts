import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Import from Archive E2E Tests
 *
 * Tests the "New Datasource from File" flow with archive files (.zip, .tar.gz).
 * Must be serial — multiple tests upload to the same page.
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

test.describe('Import from Archive', () => {
  // Serial: tests upload files to the same page — parallel causes interference
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('ZIP archive: lists files and allows selection', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should show radio buttons for data files
    const radios = modal.locator('.ant-radio-wrapper');
    const radioCount = await radios.count();
    expect(radioCount).toBeGreaterThanOrEqual(1);

    // Should list our test files
    const modalText = await modal.textContent();
    expect(modalText).toContain('archive-test.csv');
    expect(modalText).toContain('archive-test.json');
    expect(modalText).toContain('archive-test.xml');
  });

  test('ZIP archive: select CSV, analyze, and preview data', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    await selectArchiveFile(modal, /archive-test\.csv/, page);

    // After analysis, should show CSV data preview with actual data
    const modalContent = await modal.textContent();
    const hasPreview = modalContent?.includes('Alice') || modalContent?.includes('age') || modalContent?.includes('city');
    expect(hasPreview).toBeTruthy();
  });

  test('ZIP archive: select JSON, analyze, and preview data', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    await selectArchiveFile(modal, /archive-test\.json/, page);

    // JSON preview should show structured data
    const preBlock = modal.locator('pre');
    if (await preBlock.isVisible({ timeout: 5000 }).catch(() => false)) {
      const preText = await preBlock.textContent();
      expect(preText?.includes('Alice') || preText?.includes('name')).toBeTruthy();
    } else {
      const content = await modal.textContent();
      expect(content?.includes('Alice') || content?.includes('JSON')).toBeTruthy();
    }
  });

  test('TAR.GZ archive: lists files via backend API', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.tar.gz'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const modalText = await modal.textContent();
    expect(
      modalText?.includes('archive-test.csv') ||
      modalText?.includes('archive-test.json') ||
      modalText?.includes('archive-test.xml')
    ).toBeTruthy();
  });

  test('TAR.GZ archive: select and extract CSV via backend', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.tar.gz'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    await selectArchiveFile(modal, /archive-test\.csv/, page);

    const modalContent = await modal.textContent();
    const hasPreview = modalContent?.includes('Alice') || modalContent?.includes('age') || modalContent?.includes('city');
    expect(hasPreview).toBeTruthy();
  });

  test('Archive import: Continue creates pre-filled datasource form', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    await selectArchiveFile(modal, /archive-test\.csv/, page);

    // Continue button should be enabled after analysis
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should navigate to create form
    expect(page.url()).toContain('/datasources/new');

    // Form should be pre-filled — completeness sidebar should show progress > 0%
    const progressRing = page.locator('div.ant-progress-circle');
    await expect(progressRing).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Backend Archive API', () => {
  test('POST /api/v1/archive/analyze returns file list for tar.gz', async ({ request }) => {
    const fs = await import('fs');
    const archivePath = path.join(TEST_DATA_DIR, 'import-test-archive.tar.gz');
    if (!fs.existsSync(archivePath)) { test.skip(); return; }

    const response = await request.post('/api/v1/archive/analyze', {
      multipart: {
        file: {
          name: 'import-test-archive.tar.gz',
          mimeType: 'application/gzip',
          buffer: fs.readFileSync(archivePath),
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.ArchiveType).toBe('tar.gz');
    expect(data.Files.length).toBeGreaterThan(0);

    const fileNames = data.Files.map((f: { Name: string }) => f.Name);
    const hasDataFile = fileNames.some((n: string) =>
      n.includes('archive-test.csv') || n.includes('archive-test.json')
    );
    expect(hasDataFile).toBeTruthy();
  });

  test('POST /api/v1/archive/analyze returns file list for zip', async ({ request }) => {
    const fs = await import('fs');
    const archivePath = path.join(TEST_DATA_DIR, 'import-test-archive.zip');
    if (!fs.existsSync(archivePath)) { test.skip(); return; }

    const response = await request.post('/api/v1/archive/analyze', {
      multipart: {
        file: {
          name: 'import-test-archive.zip',
          mimeType: 'application/zip',
          buffer: fs.readFileSync(archivePath),
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.ArchiveType).toBe('zip');
    expect(data.IsEncrypted).toBe(false);

    const fileNames = data.Files.map((f: { Name: string }) => f.Name);
    expect(fileNames).toContain('archive-test.csv');
    expect(fileNames).toContain('archive-test.json');
    expect(fileNames).toContain('archive-test.xml');
  });

  test('POST /api/v1/archive/extract returns CSV content from zip', async ({ request }) => {
    const fs = await import('fs');
    const archivePath = path.join(TEST_DATA_DIR, 'import-test-archive.zip');
    if (!fs.existsSync(archivePath)) { test.skip(); return; }

    const response = await request.post('/api/v1/archive/extract', {
      multipart: {
        file: {
          name: 'import-test-archive.zip',
          mimeType: 'application/zip',
          buffer: fs.readFileSync(archivePath),
        },
        filename: 'archive-test.csv',
      },
    });

    expect(response.ok()).toBeTruthy();
    const content = await response.text();
    expect(content).toContain('id,name,age,city');
    expect(content).toContain('Alice');
  });

  test('POST /api/v1/archive/extract returns JSON content from tar.gz', async ({ request }) => {
    const fs = await import('fs');
    const archivePath = path.join(TEST_DATA_DIR, 'import-test-archive.tar.gz');
    if (!fs.existsSync(archivePath)) { test.skip(); return; }

    const response = await request.post('/api/v1/archive/extract', {
      multipart: {
        file: {
          name: 'import-test-archive.tar.gz',
          mimeType: 'application/gzip',
          buffer: fs.readFileSync(archivePath),
        },
        filename: 'archive-test.json',
      },
    });

    expect(response.ok()).toBeTruthy();
    const content = await response.text();
    expect(content).toContain('Alice');
    expect(content).toContain('name');
  });
});

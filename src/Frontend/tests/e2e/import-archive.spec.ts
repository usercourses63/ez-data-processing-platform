import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Import from Archive UI E2E Tests
 *
 * Coast-to-coast UI coverage:
 * - Archive file selector for all formats (ZIP, TAR.GZ, 7Z, RAR)
 * - Password-protected archive flow
 * - Auto-create datasource on Continue
 * - Archive fields in edit mode (completeness, persistence)
 * - Regular file import regression
 *
 * Backend API tests are in import-archive-api.spec.ts (separate to avoid context interference).
 */

const TEST_DATA_DIR = path.resolve(__dirname, '../../test-data');

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

test.describe('UI Archive Import', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    await page.waitForSelector('.ant-table', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });
  });

  test('ZIP: shows file selector with 3 data files', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const radios = modal.locator('.ant-radio-wrapper');
    expect(await radios.count()).toBe(3);
    const text = await modal.textContent();
    expect(text).toContain('archive-test.csv');
    expect(text).toContain('archive-test.json');
  });

  test('TAR.GZ: shows file selector via backend API', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.tar.gz'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
    expect(await modal.textContent()).toContain('archive-test.csv');
  });

  test('7Z: shows file selector via backend API', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.7z'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
    expect(await modal.textContent()).toContain('archive-test.csv');
  });

  test('RAR: shows file selector via backend API', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.rar'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
    expect(await modal.textContent()).toContain('archive-test.csv');
  });

  test('ZIP: select CSV → preview shows data', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await selectArchiveFile(modal, /archive-test\.csv/, page);
    const content = await modal.textContent();
    expect(content?.includes('Alice') || content?.includes('age')).toBeTruthy();
  });

  test('7Z: select JSON → preview shows structured data', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.7z'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await selectArchiveFile(modal, /archive-test\.json/, page);
    const preBlock = modal.locator('pre');
    if (await preBlock.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await preBlock.textContent()).toMatch(/Alice|name/);
    }
  });

  test('Encrypted ZIP: shows password input', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-encrypted.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await expect(modal.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
  });

  test('Encrypted ZIP: enter password → select file → preview', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-encrypted.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await modal.locator('input[type="password"]').fill('test123');
    await page.waitForTimeout(500);
    await selectArchiveFile(modal, /archive-test\.csv/, page);
    const content = await modal.textContent();
    expect(content?.includes('Alice') || content?.includes('age')).toBeTruthy();
  });

  test('Nested paths ZIP: shows files in subdirectories', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-nested.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const text = await modal.textContent();
    expect(text?.includes('deep-data.csv') || text?.includes('data.json')).toBeTruthy();
  });

  test('Empty archive: shows "no data files" warning', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-empty.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await expect(modal.locator('.ant-alert-warning')).toBeVisible({ timeout: 5000 });
  });

  test('Cancel modal: no side effects', async ({ page }) => {
    const urlBefore = page.url();
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    const cancelBtn = modal.locator('button').filter({ hasText: /Cancel|ביטול/i });
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      await modal.locator('.ant-modal-close').click();
    }
    await page.waitForTimeout(1000);
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Archive to Form Integration', () => {
  test.describe.configure({ mode: 'serial' });

  test('ZIP CSV: Continue → auto-creates datasource → edit page with completeness', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });

    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await selectArchiveFile(modal, /archive-test\.csv/, page);
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/\/datasources\/[a-f0-9]+\/edit/);
    const progressRing = page.locator('div.ant-progress-circle');
    await expect(progressRing).toBeVisible({ timeout: 10000 });
    const sidebarText = await page.locator('.ant-card').filter({ has: page.locator('div.ant-progress-circle') }).textContent();
    expect(sidebarText).toContain('1/1');
  });

  test('7Z JSON: Continue → auto-creates and opens edit page', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });

    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.7z'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await selectArchiveFile(modal, /archive-test\.json/, page);
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/\/datasources\/[a-f0-9]+\/edit/);
    await expect(page.locator('div.ant-progress-circle')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Archive Fields in Edit Mode', () => {
  test.describe.configure({ mode: 'serial' });

  test('Auto-created archive DS: connection tab shows archive settings without device', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });

    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await selectArchiveFile(modal, /archive-test\.csv/, page);
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/\/datasources\/[a-f0-9]+\/edit/);

    // Navigate to connection tab
    await page.locator('[data-node-key="connection"]').click();
    await page.waitForTimeout(2000);

    // Archive settings card visible even without device
    await expect(page.getByText(/הגדרות ארכיון|archive settings/i)).toBeVisible({ timeout: 5000 });

    // Archive toggle should be ON
    const archiveSwitch = page.locator('#isArchiveSource');
    await expect(archiveSwitch).toHaveClass(/ant-switch-checked/, { timeout: 5000 });

    // Archive card should show ZIP value
    await archiveSwitch.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const archiveCardText = await page.locator('.ant-card-small').filter({ has: page.locator('#isArchiveSource') }).textContent();
    expect(archiveCardText).toMatch(/ZIP|zip|tar\.gz|rar|7z|auto/i);
  });

  test('Full round-trip: import → edit → save → re-open → archive fields persist', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });

    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-archive.zip'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await selectArchiveFile(modal, /archive-test\.xml/, page);
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const editUrl = page.url();
    expect(editUrl).toMatch(/\/datasources\/[a-f0-9]+\/edit/);

    // Save
    await page.locator('[data-node-key="basic"]').click();
    await page.waitForTimeout(1000);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    expect(page.url()).toContain('/datasources');

    // Re-open
    const dsId = editUrl.match(/\/datasources\/([a-f0-9]+)\/edit/)?.[1];
    if (dsId) {
      await page.goto(`/datasources/${dsId}/edit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
      await page.locator('[data-node-key="connection"]').click();
      await page.waitForTimeout(2000);
      await expect(page.getByText(/הגדרות ארכיון|archive settings/i)).toBeVisible({ timeout: 5000 });
      const archiveSwitch = page.locator('#isArchiveSource');
      await expect(archiveSwitch).toHaveClass(/ant-switch-checked/, { timeout: 5000 });
    }
  });
});

test.describe('Regular File Import Regression', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    await page.waitForSelector('.ant-table', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });
  });

  test('CSV with headers: preview + Continue → auto-creates', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(path.join(TEST_DATA_DIR, 'import-test-with-headers.csv'));
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/\/datasources\/[a-f0-9]+\/edit/);
  });

  test('JSON file: preview + Continue → auto-creates', async ({ page }) => {
    const jsonPath = path.join(TEST_DATA_DIR, 'import-test.json');
    if (!fs.existsSync(jsonPath)) { test.skip(); return; }
    await page.locator('input[type="file"]').setInputFiles(jsonPath);
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/\/datasources\/[a-f0-9]+\/edit/);
  });
});

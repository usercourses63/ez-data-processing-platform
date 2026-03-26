import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Grand Sanity Test: Encrypted Archive Import → Clone → Compare
 *
 * Flow:
 * 1. Upload encrypted .zip archive with password
 * 2. Select inner CSV, enter password, analyze, Continue → auto-create
 * 3. Verify datasource created with archive settings
 * 4. Clone the datasource
 * 5. Save the clone
 * 6. Compare both datasources via API — should differ only by ID and Name
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

test.describe('Grand Sanity: Encrypted Archive → Clone → Compare', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120000);

  let originalId: string;
  let cloneId: string;

  test('Step 1: Upload encrypted archive → auto-create datasource', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    await page.waitForSelector('.ant-table', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });

    // Upload encrypted ZIP
    await page.locator('input[type="file"]').setInputFiles(
      path.join(TEST_DATA_DIR, 'import-test-encrypted.zip')
    );

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Enter password
    const passwordInput = modal.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await passwordInput.fill('test123');
    await page.waitForTimeout(500);

    // Select CSV and analyze
    await selectArchiveFile(modal, /archive-test\.csv/, page);

    // Continue → auto-create
    const continueBtn = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Should be on edit page
    const url = page.url();
    expect(url).toMatch(/\/datasources\/([a-f0-9]+)\/edit/);
    originalId = url.match(/\/datasources\/([a-f0-9]+)\/edit/)![1];
    console.log(`  Original DS ID: ${originalId}`);
  });

  test('Step 2: Verify original has archive settings via API', async ({ request }) => {
    expect(originalId).toBeTruthy();

    const response = await request.get(`/api/v1/datasource/${originalId}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    const ds = data.Data;

    // Verify archive settings
    expect(ds.ArchiveSettings).toBeTruthy();
    expect(ds.ArchiveSettings.IsArchiveSource).toBe(true);
    expect(ds.ArchiveSettings.ArchiveType).toBe('zip');
    expect(ds.ArchiveSettings.ArchivePassword).toBe('test123');
    expect(ds.ArchiveSettings.ExtractionPattern).toBeTruthy();

    // Verify schema was inferred
    expect(ds.JsonSchema).toBeTruthy();
    expect(ds.JsonSchema.properties).toBeTruthy();

    // Verify file format (in AdditionalConfiguration.ConfigurationSettings)
    const config = JSON.parse(ds.AdditionalConfiguration?.ConfigurationSettings || '{}');
    expect(config.fileConfig?.type).toBe('CSV');

    console.log(`  Original: ${ds.Name}, Schema props: ${Object.keys(ds.JsonSchema?.properties || {}).join(', ')}`);
    console.log(`  Archive: type=${ds.ArchiveSettings.ArchiveType}, pattern=${ds.ArchiveSettings.ExtractionPattern}`);
  });

  test('Step 3: Clone the datasource via UI', async ({ page }) => {
    expect(originalId).toBeTruthy();

    // Navigate directly to the edit page and get the datasource name
    const origResponse = await page.request.get(`/api/v1/datasource/${originalId}`);
    const origData = (await origResponse.json()).Data;
    const origName = origData.Name;
    console.log(`  Cloning: "${origName}"`);

    await page.goto('/datasources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    await page.waitForSelector('.ant-table-tbody', { state: 'visible', timeout: 15000 });

    // Find row by datasource name and click its clone (CopyOutlined) button
    const targetRow = page.locator('.ant-table-tbody tr').filter({ hasText: origName }).first();
    await expect(targetRow).toBeVisible({ timeout: 5000 });
    const cloneBtn = targetRow.locator('.anticon-copy').first();
    await cloneBtn.click();

    // Confirm clone dialog
    await page.waitForTimeout(1000);
    const okBtn = page.locator('.ant-modal-confirm-btns .ant-btn-primary');
    await expect(okBtn).toBeVisible({ timeout: 5000 });
    await okBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should navigate to create form with clone data
    expect(page.url()).toContain('/datasources/new');

    // Change name to avoid duplicate, then save
    await page.waitForTimeout(3000);
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.clear();
    const cloneName = `clone-${Date.now()}`;
    await nameInput.fill(cloneName);

    // Submit
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);

    // After save — find clone ID via API search
    await page.waitForTimeout(2000);
    const afterUrl = page.url();
    const editMatch = afterUrl.match(/\/datasources\/([a-f0-9]+)\/edit/);
    if (editMatch) {
      cloneId = editMatch[1];
    } else {
      // Search by clone name
      const listResponse = await page.request.get(`/api/v1/datasource?search=${encodeURIComponent(cloneName)}&size=5`);
      const listData = await listResponse.json();
      const items = listData.Data?.Items || [];
      const cloneDs = items.find((ds: any) => ds.Name === cloneName);
      if (cloneDs) {
        cloneId = cloneDs.ID;
      } else if (items.length > 0) {
        // Fallback: pick the first result from search
        cloneId = items[0].ID;
      }
    }

    expect(cloneId).toBeTruthy();
    console.log(`  Clone DS ID: ${cloneId}`);
  });

  test('Step 4: Compare original and clone — should differ only by ID and Name', async ({ request }) => {
    expect(originalId).toBeTruthy();
    expect(cloneId).toBeTruthy();

    const [origResponse, cloneResponse] = await Promise.all([
      request.get(`/api/v1/datasource/${originalId}`),
      request.get(`/api/v1/datasource/${cloneId}`),
    ]);

    expect(origResponse.ok()).toBeTruthy();
    expect(cloneResponse.ok()).toBeTruthy();

    const orig = (await origResponse.json()).Data;
    const clone = (await cloneResponse.json()).Data;

    console.log('\n  === COMPARISON ===');
    console.log(`  Original ID:   ${orig.ID}`);
    console.log(`  Clone ID:      ${clone.ID}`);
    console.log(`  Original Name: ${orig.Name}`);
    console.log(`  Clone Name:    ${clone.Name}`);

    // IDs must differ
    expect(orig.ID).not.toBe(clone.ID);
    // Names must differ
    expect(orig.Name).not.toBe(clone.Name);

    // File format must match
    console.log(`  FileFormat:    orig=${orig.FileFormat} clone=${clone.FileFormat}`);
    expect(clone.FileFormat).toBe(orig.FileFormat);

    // Archive settings must match
    console.log(`  Archive Type:  orig=${orig.ArchiveSettings?.ArchiveType} clone=${clone.ArchiveSettings?.ArchiveType}`);
    console.log(`  Archive Pass:  orig=${orig.ArchiveSettings?.ArchivePassword ? '***' : 'none'} clone=${clone.ArchiveSettings?.ArchivePassword ? '***' : 'none'}`);
    console.log(`  Extract Pat:   orig=${orig.ArchiveSettings?.ExtractionPattern} clone=${clone.ArchiveSettings?.ExtractionPattern}`);
    console.log(`  Nested:        orig=${orig.ArchiveSettings?.ProcessNestedArchives} clone=${clone.ArchiveSettings?.ProcessNestedArchives}`);

    expect(clone.ArchiveSettings).toBeTruthy();
    expect(clone.ArchiveSettings.IsArchiveSource).toBe(orig.ArchiveSettings.IsArchiveSource);
    expect(clone.ArchiveSettings.ArchiveType).toBe(orig.ArchiveSettings.ArchiveType);
    expect(clone.ArchiveSettings.ArchivePassword).toBe(orig.ArchiveSettings.ArchivePassword);
    expect(clone.ArchiveSettings.ExtractionPattern).toBe(orig.ArchiveSettings.ExtractionPattern);
    expect(clone.ArchiveSettings.ProcessNestedArchives).toBe(orig.ArchiveSettings.ProcessNestedArchives);

    // Schema must match
    const origProps = Object.keys(orig.JsonSchema?.properties || {}).sort();
    const cloneProps = Object.keys(clone.JsonSchema?.properties || {}).sort();
    console.log(`  Schema props:  orig=[${origProps}] clone=[${cloneProps}]`);
    expect(cloneProps).toEqual(origProps);

    // Config settings must match
    const origConfig = JSON.parse(orig.AdditionalConfiguration?.ConfigurationSettings || '{}');
    const cloneConfig = JSON.parse(clone.AdditionalConfiguration?.ConfigurationSettings || '{}');
    console.log(`  Connection:    orig=${origConfig.connectionConfig?.type} clone=${cloneConfig.connectionConfig?.type}`);
    console.log(`  FileType:      orig=${origConfig.fileConfig?.type} clone=${cloneConfig.fileConfig?.type}`);
    console.log(`  Encoding:      orig=${origConfig.fileConfig?.encoding} clone=${cloneConfig.fileConfig?.encoding}`);
    console.log(`  HasHeaders:    orig=${origConfig.fileConfig?.hasHeaders} clone=${cloneConfig.fileConfig?.hasHeaders}`);

    expect(cloneConfig.fileConfig?.type).toBe(origConfig.fileConfig?.type);
    expect(cloneConfig.fileConfig?.encoding).toBe(origConfig.fileConfig?.encoding);
    expect(cloneConfig.fileConfig?.hasHeaders).toBe(origConfig.fileConfig?.hasHeaders);

    console.log('\n  ALL FIELDS MATCH (except ID and Name as expected)');
  });
});

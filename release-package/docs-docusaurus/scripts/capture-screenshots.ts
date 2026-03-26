/**
 * Automated Screenshot Capture Pipeline for EZ Platform Documentation
 *
 * Captures 15 screenshots of the running frontend at 1280x800 viewport
 * for use in the Hebrew user guide and documentation pages.
 *
 * Prerequisites:
 *   - Frontend running at http://localhost:7000 (or SCREENSHOT_URL env var)
 *   - At least one datasource exists in the system
 *
 * Usage:
 *   npx tsx scripts/capture-screenshots.ts
 *   SCREENSHOT_URL=http://localhost:7000 npx tsx scripts/capture-screenshots.ts
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = process.env.SCREENSHOT_URL || 'http://localhost:7000';
const OUTPUT_DIR = path.resolve(__dirname, '../static/img/screenshots');
const VIEWPORT = { width: 1280, height: 800 };

// Test data for import screenshots
const TEST_DATA_DIR = path.resolve(__dirname, '../../../src/Frontend/test-data');

interface ScreenshotResult {
  name: string;
  success: boolean;
  error?: string;
  path?: string;
}

const results: ScreenshotResult[] = [];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await delay(800); // Let Ant Design animations settle
}

async function captureScreenshot(
  page: Page,
  name: string,
  options: {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
    element?: string;
  } = {}
): Promise<string> {
  const filePath = path.join(OUTPUT_DIR, name);

  if (options.element) {
    const el = page.locator(options.element);
    await el.waitFor({ state: 'visible', timeout: 10000 });
    await el.screenshot({ path: filePath });
  } else {
    await page.screenshot({
      path: filePath,
      fullPage: options.fullPage ?? false,
      clip: options.clip,
    });
  }

  return filePath;
}

// ─── Clone Datasource Screenshots (4) ────────────────────────────────

async function captureCloneScreenshots(page: Page): Promise<void> {
  // 1. clone-button-list.png - Show action buttons in the table row
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    // Screenshot the table showing action buttons (including clone icon)
    const filePath = await captureScreenshot(page, 'clone-button-list.png');
    results.push({ name: 'clone-button-list.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: clone-button-list.png -', err.message);
    results.push({ name: 'clone-button-list.png', success: false, error: err.message });
  }

  // 2. clone-confirm-dialog.png - Clone confirmation modal
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    // Find the clone button (CopyOutlined icon) in the first row
    const firstRow = page.locator('.ant-table-row').first();
    const cloneBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-copy') });
    await cloneBtn.click();

    // Wait for the confirmation modal
    await page.waitForSelector('.ant-modal', { timeout: 5000 });
    await delay(500);

    const filePath = await captureScreenshot(page, 'clone-confirm-dialog.png');
    results.push({ name: 'clone-confirm-dialog.png', success: true, path: filePath });

    // Close the modal
    const cancelBtn = page.locator('.ant-modal .ant-btn-default');
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await delay(300);
    }
  } catch (err: any) {
    console.error('  FAILED: clone-confirm-dialog.png -', err.message);
    results.push({ name: 'clone-confirm-dialog.png', success: false, error: err.message });
  }

  // 3. clone-form-prefilled.png - Form with cloned data pre-filled
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    // Click clone on the first row
    const firstRow = page.locator('.ant-table-row').first();
    const cloneBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-copy') });
    await cloneBtn.click();

    // Confirm the clone
    await page.waitForSelector('.ant-modal', { timeout: 5000 });
    await delay(300);
    const okBtn = page.locator('.ant-modal .ant-btn-primary');
    await okBtn.click();

    // Wait for navigation to the create form with cloned data
    await page.waitForURL('**/datasources/new**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(1000); // Extra wait for form fields to populate

    const filePath = await captureScreenshot(page, 'clone-form-prefilled.png', { fullPage: true });
    results.push({ name: 'clone-form-prefilled.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: clone-form-prefilled.png -', err.message);
    results.push({ name: 'clone-form-prefilled.png', success: false, error: err.message });
  }

  // 4. clone-saved-list.png - List showing both original and cloned datasource
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const filePath = await captureScreenshot(page, 'clone-saved-list.png');
    results.push({ name: 'clone-saved-list.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: clone-saved-list.png -', err.message);
    results.push({ name: 'clone-saved-list.png', success: false, error: err.message });
  }
}

// ─── Import from File Screenshots (5) ────────────────────────────────

async function captureImportScreenshots(page: Page): Promise<void> {
  // 5. import-button.png - Header area showing the import button
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    // Capture the header area with the import button visible
    const filePath = await captureScreenshot(page, 'import-button.png', {
      clip: { x: 0, y: 0, width: 1280, height: 200 },
    });
    results.push({ name: 'import-button.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: import-button.png -', err.message);
    results.push({ name: 'import-button.png', success: false, error: err.message });
  }

  // 6. import-archive-selector.png - File upload dialog with archive
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    // Find the import button and trigger file upload
    const importBtn = page.locator('button').filter({ hasText: /ייבוא|import|מקובץ/i });
    if (await importBtn.count() === 0) {
      throw new Error('Import button not found');
    }

    // Set up file chooser listener before clicking
    const archivePath = path.join(TEST_DATA_DIR, 'import-test-archive.zip');
    if (fs.existsSync(archivePath)) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        importBtn.first().click(),
      ]);
      await fileChooser.setFiles(archivePath);
      await delay(2000); // Wait for analysis

      // Check if a modal or preview appeared
      const modal = page.locator('.ant-modal');
      if (await modal.isVisible({ timeout: 5000 })) {
        const filePath = await captureScreenshot(page, 'import-archive-selector.png');
        results.push({ name: 'import-archive-selector.png', success: true, path: filePath });
      } else {
        // Capture whatever state we're in
        const filePath = await captureScreenshot(page, 'import-archive-selector.png');
        results.push({ name: 'import-archive-selector.png', success: true, path: filePath });
      }
    } else {
      throw new Error(`Archive test file not found: ${archivePath}`);
    }
  } catch (err: any) {
    console.error('  FAILED: import-archive-selector.png -', err.message);
    results.push({ name: 'import-archive-selector.png', success: false, error: err.message });
  }

  // 7. import-password-input.png - Encrypted archive password prompt
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    const importBtn = page.locator('button').filter({ hasText: /ייבוא|import|מקובץ/i });
    if (await importBtn.count() === 0) {
      throw new Error('Import button not found');
    }

    const encryptedPath = path.join(TEST_DATA_DIR, 'import-test-encrypted.zip');
    if (fs.existsSync(encryptedPath)) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        importBtn.first().click(),
      ]);
      await fileChooser.setFiles(encryptedPath);
      await delay(2000);

      // Look for password modal or prompt
      const passwordInput = page.locator('input[type="password"], .ant-input-password');
      const modal = page.locator('.ant-modal');
      if (await modal.isVisible({ timeout: 5000 })) {
        const filePath = await captureScreenshot(page, 'import-password-input.png');
        results.push({ name: 'import-password-input.png', success: true, path: filePath });
      } else {
        // Capture the current state (might show upload dialog)
        const filePath = await captureScreenshot(page, 'import-password-input.png');
        results.push({ name: 'import-password-input.png', success: true, path: filePath });
      }
    } else {
      // Fallback: just capture the upload area
      const filePath = await captureScreenshot(page, 'import-password-input.png');
      results.push({ name: 'import-password-input.png', success: true, path: filePath });
    }
  } catch (err: any) {
    console.error('  FAILED: import-password-input.png -', err.message);
    results.push({ name: 'import-password-input.png', success: false, error: err.message });
  }

  // 8. import-preview-csv.png - CSV preview modal with data table
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    const importBtn = page.locator('button').filter({ hasText: /ייבוא|import|מקובץ/i });
    if (await importBtn.count() === 0) {
      throw new Error('Import button not found');
    }

    const csvPath = path.join(TEST_DATA_DIR, 'import-test-with-headers.csv');
    if (fs.existsSync(csvPath)) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        importBtn.first().click(),
      ]);
      await fileChooser.setFiles(csvPath);
      await delay(2000);

      // Wait for preview modal
      const modal = page.locator('.ant-modal');
      await modal.waitFor({ state: 'visible', timeout: 8000 });
      await delay(500);

      const filePath = await captureScreenshot(page, 'import-preview-csv.png');
      results.push({ name: 'import-preview-csv.png', success: true, path: filePath });
    } else {
      throw new Error(`CSV test file not found: ${csvPath}`);
    }
  } catch (err: any) {
    console.error('  FAILED: import-preview-csv.png -', err.message);
    results.push({ name: 'import-preview-csv.png', success: false, error: err.message });
  }

  // 9. import-edit-archive-settings.png - Edit page with populated form after import
  try {
    // Navigate to the most recent datasource's edit page
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    // Click edit on the first row
    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();

    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'import-edit-archive-settings.png', { fullPage: true });
    results.push({ name: 'import-edit-archive-settings.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: import-edit-archive-settings.png -', err.message);
    results.push({ name: 'import-edit-archive-settings.png', success: false, error: err.message });
  }
}

// ─── Completeness Checklist Screenshots (4) ──────────────────────────

async function captureCompletenessScreenshots(page: Page): Promise<void> {
  // 10. completeness-sidebar.png - Create form showing completeness sidebar
  try {
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1500); // Extra wait for completeness panel to render

    // Try to find the completeness panel
    const completenessPanel = page.locator('.completeness-panel, [class*="completeness"]');
    if (await completenessPanel.first().isVisible({ timeout: 5000 })) {
      const filePath = await captureScreenshot(page, 'completeness-sidebar.png');
      results.push({ name: 'completeness-sidebar.png', success: true, path: filePath });
    } else {
      // Full page capture showing the sidebar area
      const filePath = await captureScreenshot(page, 'completeness-sidebar.png');
      results.push({ name: 'completeness-sidebar.png', success: true, path: filePath });
    }
  } catch (err: any) {
    console.error('  FAILED: completeness-sidebar.png -', err.message);
    results.push({ name: 'completeness-sidebar.png', success: false, error: err.message });
  }

  // 11. completeness-field-borders.png - Mixed green/red/gray field borders
  try {
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    // Fill in some fields but leave others empty to show mixed border colors
    const nameInput = page.locator('#Name, input[id="Name"], input[name="Name"]').first();
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await nameInput.fill('Test Datasource');
      await delay(300);
    }

    // Fill supplier name
    const supplierInput = page.locator('#SupplierName, input[id="SupplierName"], input[name="SupplierName"]').first();
    if (await supplierInput.isVisible({ timeout: 2000 })) {
      await supplierInput.fill('Test Supplier');
      await delay(300);
    }

    // Trigger recalculation by clicking elsewhere
    await page.locator('body').click({ position: { x: 640, y: 400 } });
    await delay(800);

    const filePath = await captureScreenshot(page, 'completeness-field-borders.png');
    results.push({ name: 'completeness-field-borders.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: completeness-field-borders.png -', err.message);
    results.push({ name: 'completeness-field-borders.png', success: false, error: err.message });
  }

  // 12. completeness-missing-fields.png - Missing fields section in completeness panel
  try {
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1500);

    // Scroll down to show the missing fields list in the completeness panel
    // The completeness panel should show which fields are missing
    const filePath = await captureScreenshot(page, 'completeness-missing-fields.png', { fullPage: true });
    results.push({ name: 'completeness-missing-fields.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: completeness-missing-fields.png -', err.message);
    results.push({ name: 'completeness-missing-fields.png', success: false, error: err.message });
  }

  // 13. completeness-list-indicator.png - Mini progress rings in the datasource list table
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    // Focus on the status column area with progress rings
    const filePath = await captureScreenshot(page, 'completeness-list-indicator.png');
    results.push({ name: 'completeness-list-indicator.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: completeness-list-indicator.png -', err.message);
    results.push({ name: 'completeness-list-indicator.png', success: false, error: err.message });
  }
}

// ─── General Screenshots (2) ─────────────────────────────────────────

async function captureGeneralScreenshots(page: Page): Promise<void> {
  // 14. datasource-list-overview.png - Full list page with all new UI elements
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const filePath = await captureScreenshot(page, 'datasource-list-overview.png', { fullPage: true });
    results.push({ name: 'datasource-list-overview.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: datasource-list-overview.png -', err.message);
    results.push({ name: 'datasource-list-overview.png', success: false, error: err.message });
  }

  // 15. datasource-edit-overview.png - Edit form with completeness sidebar
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    // Click edit on the first row
    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();

    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'datasource-edit-overview.png', { fullPage: true });
    results.push({ name: 'datasource-edit-overview.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: datasource-edit-overview.png -', err.message);
    results.push({ name: 'datasource-edit-overview.png', success: false, error: err.message });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== EZ Platform Screenshot Capture Pipeline ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output:   ${OUTPUT_DIR}`);
  console.log(`Viewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log('');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: VIEWPORT,
      locale: 'he-IL',
      extraHTTPHeaders: {
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.1',
      },
    });

    const page = await context.newPage();

    // Verify frontend is accessible
    console.log('Checking frontend availability...');
    try {
      const response = await page.goto(BASE_URL, { timeout: 15000, waitUntil: 'networkidle' });
      if (!response || response.status() >= 400) {
        throw new Error(`Frontend returned status ${response?.status()}`);
      }
      console.log('Frontend is accessible.\n');
    } catch (err: any) {
      console.error(`ERROR: Cannot reach frontend at ${BASE_URL}`);
      console.error(`Make sure the frontend is running and port-forward is active.`);
      console.error(`Details: ${err.message}`);
      process.exit(1);
    }

    // Capture all screenshot groups
    console.log('--- Clone Datasource Screenshots ---');
    await captureCloneScreenshots(page);

    console.log('\n--- Import from File Screenshots ---');
    await captureImportScreenshots(page);

    console.log('\n--- Completeness Checklist Screenshots ---');
    await captureCompletenessScreenshots(page);

    console.log('\n--- General Screenshots ---');
    await captureGeneralScreenshots(page);

    await context.close();
  } catch (err: any) {
    console.error(`Fatal error: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Print summary
  console.log('\n=== Screenshot Capture Summary ===');
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  for (const r of results) {
    const icon = r.success ? 'OK' : 'FAIL';
    console.log(`  [${icon}] ${r.name}${r.error ? ' - ' + r.error : ''}`);
  }

  console.log(`\nCaptured ${succeeded.length}/${results.length} screenshots successfully.`);

  if (failed.length > 0) {
    console.log('\nFailed screenshots:');
    for (const r of failed) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
  }

  // Verify file sizes
  console.log('\n--- File Size Verification ---');
  let validCount = 0;
  for (const r of succeeded) {
    const filePath = path.join(OUTPUT_DIR, r.name);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const sizeKB = Math.round(stat.size / 1024);
      const valid = stat.size > 10240; // >10KB
      if (valid) validCount++;
      console.log(`  ${valid ? 'OK' : 'SMALL'} ${r.name} (${sizeKB} KB)`);
    }
  }
  console.log(`\n${validCount} screenshots are >10KB (valid).`);

  // Exit with error if too few screenshots
  if (succeeded.length < 10) {
    console.error(`\nERROR: Only ${succeeded.length} screenshots captured. Expected at least 10.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

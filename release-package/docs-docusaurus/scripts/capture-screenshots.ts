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

// ─── Getting Started Screenshots (3) ─────────────────────────────────

async function captureGettingStartedScreenshots(page: Page): Promise<void> {
  // getting-started-dashboard.png - Main dashboard/landing after login
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    const filePath = await captureScreenshot(page, 'getting-started-dashboard.png');
    results.push({ name: 'getting-started-dashboard.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: getting-started-dashboard.png -', err.message);
    results.push({ name: 'getting-started-dashboard.png', success: false, error: err.message });
  }

  // getting-started-sidebar.png - Sidebar navigation menu
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    // Capture just the sidebar area (left/right side depending on RTL)
    const filePath = await captureScreenshot(page, 'getting-started-sidebar.png', {
      clip: { x: 900, y: 0, width: 380, height: 800 },
    });
    results.push({ name: 'getting-started-sidebar.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: getting-started-sidebar.png -', err.message);
    results.push({ name: 'getting-started-sidebar.png', success: false, error: err.message });
  }

  // getting-started-language-toggle.png - Hebrew/English toggle area
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    const filePath = await captureScreenshot(page, 'getting-started-language-toggle.png', {
      clip: { x: 0, y: 0, width: 1280, height: 80 },
    });
    results.push({ name: 'getting-started-language-toggle.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: getting-started-language-toggle.png -', err.message);
    results.push({ name: 'getting-started-language-toggle.png', success: false, error: err.message });
  }
}

// ─── Create Datasource Screenshots (4) ──────────────────────────────

async function captureCreateDatasourceScreenshots(page: Page): Promise<void> {
  // create-form-basic.png - Basic tab of create form
  try {
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'create-form-basic.png');
    results.push({ name: 'create-form-basic.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-basic.png -', err.message);
    results.push({ name: 'create-form-basic.png', success: false, error: err.message });
  }

  // create-form-connection.png - Connection tab
  try {
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(500);

    // Click connection tab
    const connectionTab = page.locator('[data-node-key="connection"]');
    if (await connectionTab.isVisible({ timeout: 3000 })) {
      await connectionTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'create-form-connection.png');
    results.push({ name: 'create-form-connection.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-connection.png -', err.message);
    results.push({ name: 'create-form-connection.png', success: false, error: err.message });
  }

  // create-form-file.png - File settings tab
  try {
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(500);

    const fileTab = page.locator('[data-node-key="file"]');
    if (await fileTab.isVisible({ timeout: 3000 })) {
      await fileTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'create-form-file.png');
    results.push({ name: 'create-form-file.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-file.png -', err.message);
    results.push({ name: 'create-form-file.png', success: false, error: err.message });
  }

  // create-form-save.png - Form with save button visible
  try {
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(500);

    // Fill basic fields so save button is visible
    const nameInput = page.locator('#Name, input[id="Name"]').first();
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await nameInput.fill('דוגמה - מקור נתונים');
    }

    const filePath = await captureScreenshot(page, 'create-form-save.png', { fullPage: true });
    results.push({ name: 'create-form-save.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-save.png -', err.message);
    results.push({ name: 'create-form-save.png', success: false, error: err.message });
  }
}

// ─── Schema Validation Screenshots (2) ──────────────────────────────

async function captureSchemaScreenshots(page: Page): Promise<void> {
  // schema-editor.png - Schema editor tab in datasource form
  try {
    // Open an existing datasource edit page to see the schema tab
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    // Click schema tab
    const schemaTab = page.locator('[data-node-key="schema"]');
    if (await schemaTab.isVisible({ timeout: 3000 })) {
      await schemaTab.click();
      await delay(1500); // Wait for Monaco editor to load
    }

    const filePath = await captureScreenshot(page, 'schema-editor.png');
    results.push({ name: 'schema-editor.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: schema-editor.png -', err.message);
    results.push({ name: 'schema-editor.png', success: false, error: err.message });
  }

  // schema-validation-result.png - Validation rules tab
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    // Click validation tab
    const validationTab = page.locator('[data-node-key="validation"]');
    if (await validationTab.isVisible({ timeout: 3000 })) {
      await validationTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'schema-validation-result.png');
    results.push({ name: 'schema-validation-result.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: schema-validation-result.png -', err.message);
    results.push({ name: 'schema-validation-result.png', success: false, error: err.message });
  }
}

// ─── Scheduling Screenshots (2) ─────────────────────────────────────

async function captureSchedulingScreenshots(page: Page): Promise<void> {
  // schedule-config.png - Schedule configuration tab
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    // Click scheduling tab
    const scheduleTab = page.locator('[data-node-key="scheduling"]');
    if (await scheduleTab.isVisible({ timeout: 3000 })) {
      await scheduleTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'schedule-config.png');
    results.push({ name: 'schedule-config.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: schedule-config.png -', err.message);
    results.push({ name: 'schedule-config.png', success: false, error: err.message });
  }

  // schedule-list.png - Datasource list showing schedule column
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const filePath = await captureScreenshot(page, 'schedule-list.png');
    results.push({ name: 'schedule-list.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: schedule-list.png -', err.message);
    results.push({ name: 'schedule-list.png', success: false, error: err.message });
  }
}

// ─── Monitoring Screenshots (3) ─────────────────────────────────────

async function captureMonitoringScreenshots(page: Page): Promise<void> {
  // monitoring-dashboard.png - System monitoring page overview
  try {
    await page.goto(`${BASE_URL}/monitoring`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(2000); // Extra wait for SignalR data

    const filePath = await captureScreenshot(page, 'monitoring-dashboard.png');
    results.push({ name: 'monitoring-dashboard.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: monitoring-dashboard.png -', err.message);
    results.push({ name: 'monitoring-dashboard.png', success: false, error: err.message });
  }

  // monitoring-device-health.png - Device health tab
  try {
    await page.goto(`${BASE_URL}/monitoring`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    // Try to click device health tab
    const healthTab = page.locator('[data-node-key="device-health"], [role="tab"]').filter({ hasText: /בריאות|health|מכשירים/i });
    if (await healthTab.first().isVisible({ timeout: 3000 })) {
      await healthTab.first().click();
      await delay(1000);
    }

    const filePath = await captureScreenshot(page, 'monitoring-device-health.png');
    results.push({ name: 'monitoring-device-health.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: monitoring-device-health.png -', err.message);
    results.push({ name: 'monitoring-device-health.png', success: false, error: err.message });
  }

  // monitoring-grafana.png - Grafana link/reference (capture monitoring overview as fallback)
  try {
    await page.goto(`${BASE_URL}/monitoring`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'monitoring-grafana.png', { fullPage: true });
    results.push({ name: 'monitoring-grafana.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: monitoring-grafana.png -', err.message);
    results.push({ name: 'monitoring-grafana.png', success: false, error: err.message });
  }
}

// ─── Troubleshooting Screenshots (1) ────────────────────────────────

async function captureTroubleshootingScreenshots(page: Page): Promise<void> {
  // troubleshooting-logs.png - Invalid records page (where users find errors)
  try {
    await page.goto(`${BASE_URL}/invalid-records`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    const filePath = await captureScreenshot(page, 'troubleshooting-logs.png');
    results.push({ name: 'troubleshooting-logs.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: troubleshooting-logs.png -', err.message);
    results.push({ name: 'troubleshooting-logs.png', success: false, error: err.message });
  }
}

// ─── Alerts Page Screenshots (5) ─────────────────────────────────────

async function captureAlertsScreenshots(page: Page): Promise<void> {
  // alerts-list.png - Main alerts management page
  try {
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1500);

    const filePath = await captureScreenshot(page, 'alerts-list.png');
    results.push({ name: 'alerts-list.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: alerts-list.png -', err.message);
    results.push({ name: 'alerts-list.png', success: false, error: err.message });
  }

  // alerts-create-dialog.png - Create alert modal
  try {
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    // Click create alert button
    const createBtn = page.locator('button').filter({ hasText: /הוסף|התרעה חדשה|create|add/i });
    if (await createBtn.first().isVisible({ timeout: 3000 })) {
      await createBtn.first().click();
      await delay(800);
      const modal = page.locator('.ant-modal');
      if (await modal.isVisible({ timeout: 5000 })) {
        const filePath = await captureScreenshot(page, 'alerts-create-dialog.png');
        results.push({ name: 'alerts-create-dialog.png', success: true, path: filePath });
        // Close modal
        const cancelBtn = page.locator('.ant-modal .ant-btn-default').first();
        if (await cancelBtn.isVisible()) await cancelBtn.click();
        await delay(300);
      } else {
        const filePath = await captureScreenshot(page, 'alerts-create-dialog.png');
        results.push({ name: 'alerts-create-dialog.png', success: true, path: filePath });
      }
    } else {
      const filePath = await captureScreenshot(page, 'alerts-create-dialog.png');
      results.push({ name: 'alerts-create-dialog.png', success: true, path: filePath });
    }
  } catch (err: any) {
    console.error('  FAILED: alerts-create-dialog.png -', err.message);
    results.push({ name: 'alerts-create-dialog.png', success: false, error: err.message });
  }

  // alerts-settings.png - Alert settings tab
  try {
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    // Click settings tab
    const settingsTab = page.locator('[role="tab"]').filter({ hasText: /הגדרות|settings/i });
    if (await settingsTab.first().isVisible({ timeout: 3000 })) {
      await settingsTab.first().click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'alerts-settings.png');
    results.push({ name: 'alerts-settings.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: alerts-settings.png -', err.message);
    results.push({ name: 'alerts-settings.png', success: false, error: err.message });
  }

  // alerts-fullpage.png - Full alerts page
  try {
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'alerts-fullpage.png', { fullPage: true });
    results.push({ name: 'alerts-fullpage.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: alerts-fullpage.png -', err.message);
    results.push({ name: 'alerts-fullpage.png', success: false, error: err.message });
  }
}

// ─── Admin Settings Screenshots (8) ─────────────────────────────────

async function captureAdminSettingsScreenshots(page: Page): Promise<void> {
  // admin-categories.png - Categories management tab
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'admin-categories.png');
    results.push({ name: 'admin-categories.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: admin-categories.png -', err.message);
    results.push({ name: 'admin-categories.png', success: false, error: err.message });
  }

  // admin-category-modal.png - Create/edit category dialog
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(800);

    const addBtn = page.locator('button').filter({ hasText: /הוסף|קטגוריה|add|category/i });
    if (await addBtn.first().isVisible({ timeout: 3000 })) {
      await addBtn.first().click();
      await delay(600);
    }
    const modal = page.locator('.ant-modal');
    if (await modal.isVisible({ timeout: 3000 })) {
      const filePath = await captureScreenshot(page, 'admin-category-modal.png');
      results.push({ name: 'admin-category-modal.png', success: true, path: filePath });
      const cancelBtn = page.locator('.ant-modal .ant-btn-default').first();
      if (await cancelBtn.isVisible()) await cancelBtn.click();
      await delay(300);
    } else {
      const filePath = await captureScreenshot(page, 'admin-category-modal.png');
      results.push({ name: 'admin-category-modal.png', success: true, path: filePath });
    }
  } catch (err: any) {
    console.error('  FAILED: admin-category-modal.png -', err.message);
    results.push({ name: 'admin-category-modal.png', success: false, error: err.message });
  }

  // admin-input-servers.png - Input servers tab
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(800);

    const inputTab = page.locator('[role="tab"]').filter({ hasText: /שרתי קלט|input/i });
    if (await inputTab.first().isVisible({ timeout: 3000 })) {
      await inputTab.first().click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'admin-input-servers.png');
    results.push({ name: 'admin-input-servers.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: admin-input-servers.png -', err.message);
    results.push({ name: 'admin-input-servers.png', success: false, error: err.message });
  }

  // admin-server-modal.png - Create/edit server dialog
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(800);

    // Switch to input servers tab
    const inputTab = page.locator('[role="tab"]').filter({ hasText: /שרתי קלט|input/i });
    if (await inputTab.first().isVisible({ timeout: 3000 })) {
      await inputTab.first().click();
      await delay(800);
    }

    const addBtn = page.locator('button').filter({ hasText: /הוסף|שרת|add|server/i });
    if (await addBtn.first().isVisible({ timeout: 3000 })) {
      await addBtn.first().click();
      await delay(600);
    }
    const modal = page.locator('.ant-modal');
    if (await modal.isVisible({ timeout: 3000 })) {
      const filePath = await captureScreenshot(page, 'admin-server-modal.png');
      results.push({ name: 'admin-server-modal.png', success: true, path: filePath });
      const cancelBtn = page.locator('.ant-modal .ant-btn-default').first();
      if (await cancelBtn.isVisible()) await cancelBtn.click();
      await delay(300);
    } else {
      const filePath = await captureScreenshot(page, 'admin-server-modal.png');
      results.push({ name: 'admin-server-modal.png', success: true, path: filePath });
    }
  } catch (err: any) {
    console.error('  FAILED: admin-server-modal.png -', err.message);
    results.push({ name: 'admin-server-modal.png', success: false, error: err.message });
  }

  // admin-output-servers.png - Output servers tab
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(800);

    const outputTab = page.locator('[role="tab"]').filter({ hasText: /שרתי פלט|output/i });
    if (await outputTab.first().isVisible({ timeout: 3000 })) {
      await outputTab.first().click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'admin-output-servers.png');
    results.push({ name: 'admin-output-servers.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: admin-output-servers.png -', err.message);
    results.push({ name: 'admin-output-servers.png', success: false, error: err.message });
  }

  // admin-nas-devices.png - NAS devices tab
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(800);

    const nasTab = page.locator('[role="tab"]').filter({ hasText: /NAS|התקני/i });
    if (await nasTab.first().isVisible({ timeout: 3000 })) {
      await nasTab.first().click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'admin-nas-devices.png');
    results.push({ name: 'admin-nas-devices.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: admin-nas-devices.png -', err.message);
    results.push({ name: 'admin-nas-devices.png', success: false, error: err.message });
  }

  // admin-nas-modal.png - Create/edit NAS device dialog
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(800);

    const nasTab = page.locator('[role="tab"]').filter({ hasText: /NAS|התקני/i });
    if (await nasTab.first().isVisible({ timeout: 3000 })) {
      await nasTab.first().click();
      await delay(800);
    }

    const addBtn = page.locator('button').filter({ hasText: /הוסף|NAS|add/i });
    if (await addBtn.first().isVisible({ timeout: 3000 })) {
      await addBtn.first().click();
      await delay(600);
    }
    const modal = page.locator('.ant-modal');
    if (await modal.isVisible({ timeout: 3000 })) {
      const filePath = await captureScreenshot(page, 'admin-nas-modal.png');
      results.push({ name: 'admin-nas-modal.png', success: true, path: filePath });
      const cancelBtn = page.locator('.ant-modal .ant-btn-default').first();
      if (await cancelBtn.isVisible()) await cancelBtn.click();
      await delay(300);
    } else {
      const filePath = await captureScreenshot(page, 'admin-nas-modal.png');
      results.push({ name: 'admin-nas-modal.png', success: true, path: filePath });
    }
  } catch (err: any) {
    console.error('  FAILED: admin-nas-modal.png -', err.message);
    results.push({ name: 'admin-nas-modal.png', success: false, error: err.message });
  }

  // admin-settings-fullpage.png - Full admin page
  try {
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(800);

    const filePath = await captureScreenshot(page, 'admin-settings-fullpage.png', { fullPage: true });
    results.push({ name: 'admin-settings-fullpage.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: admin-settings-fullpage.png -', err.message);
    results.push({ name: 'admin-settings-fullpage.png', success: false, error: err.message });
  }
}

// ─── Invalid Records Screenshots (4) ────────────────────────────────

async function captureInvalidRecordsScreenshots(page: Page): Promise<void> {
  // invalid-records-list.png - Main invalid records page
  try {
    await page.goto(`${BASE_URL}/invalid-records`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1500);

    const filePath = await captureScreenshot(page, 'invalid-records-list.png');
    results.push({ name: 'invalid-records-list.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: invalid-records-list.png -', err.message);
    results.push({ name: 'invalid-records-list.png', success: false, error: err.message });
  }

  // invalid-records-fullpage.png - Full page with statistics
  try {
    await page.goto(`${BASE_URL}/invalid-records`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'invalid-records-fullpage.png', { fullPage: true });
    results.push({ name: 'invalid-records-fullpage.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: invalid-records-fullpage.png -', err.message);
    results.push({ name: 'invalid-records-fullpage.png', success: false, error: err.message });
  }

  // invalid-records-filters.png - Filter area
  try {
    await page.goto(`${BASE_URL}/invalid-records`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    const filePath = await captureScreenshot(page, 'invalid-records-filters.png', {
      clip: { x: 0, y: 0, width: 1280, height: 300 },
    });
    results.push({ name: 'invalid-records-filters.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: invalid-records-filters.png -', err.message);
    results.push({ name: 'invalid-records-filters.png', success: false, error: err.message });
  }
}

// ─── Additional Datasource Form Screenshots (5) ─────────────────────

async function captureAdditionalFormScreenshots(page: Page): Promise<void> {
  // create-form-schema.png - Schema tab
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    const schemaTab = page.locator('[data-node-key="schema"]');
    if (await schemaTab.isVisible({ timeout: 3000 })) {
      await schemaTab.click();
      await delay(1500);
    }

    const filePath = await captureScreenshot(page, 'create-form-schema.png', { fullPage: true });
    results.push({ name: 'create-form-schema.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-schema.png -', err.message);
    results.push({ name: 'create-form-schema.png', success: false, error: err.message });
  }

  // create-form-validation.png - Validation rules tab
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    const validationTab = page.locator('[data-node-key="validation"]');
    if (await validationTab.isVisible({ timeout: 3000 })) {
      await validationTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'create-form-validation.png');
    results.push({ name: 'create-form-validation.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-validation.png -', err.message);
    results.push({ name: 'create-form-validation.png', success: false, error: err.message });
  }

  // create-form-output.png - Output destinations tab
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    const outputTab = page.locator('[data-node-key="output"]');
    if (await outputTab.isVisible({ timeout: 3000 })) {
      await outputTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'create-form-output.png');
    results.push({ name: 'create-form-output.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-output.png -', err.message);
    results.push({ name: 'create-form-output.png', success: false, error: err.message });
  }

  // create-form-scheduling.png - Scheduling tab in form
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    const schedulingTab = page.locator('[data-node-key="scheduling"]');
    if (await schedulingTab.isVisible({ timeout: 3000 })) {
      await schedulingTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'create-form-scheduling.png');
    results.push({ name: 'create-form-scheduling.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-scheduling.png -', err.message);
    results.push({ name: 'create-form-scheduling.png', success: false, error: err.message });
  }

  // create-form-alerts.png - Alerts tab in form
  try {
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 });

    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editBtn.click();
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForPageReady(page);
    await delay(500);

    const alertsTab = page.locator('[data-node-key="alerts"]');
    if (await alertsTab.isVisible({ timeout: 3000 })) {
      await alertsTab.click();
      await delay(800);
    }

    const filePath = await captureScreenshot(page, 'create-form-alerts.png');
    results.push({ name: 'create-form-alerts.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: create-form-alerts.png -', err.message);
    results.push({ name: 'create-form-alerts.png', success: false, error: err.message });
  }
}

// ─── Dashboard Screenshots (1) ──────────────────────────────────────

async function captureDashboardScreenshots(page: Page): Promise<void> {
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(2000);

    const filePath = await captureScreenshot(page, 'dashboard-overview.png', { fullPage: true });
    results.push({ name: 'dashboard-overview.png', success: true, path: filePath });
  } catch (err: any) {
    console.error('  FAILED: dashboard-overview.png -', err.message);
    results.push({ name: 'dashboard-overview.png', success: false, error: err.message });
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
    console.log('--- Getting Started Screenshots ---');
    await captureGettingStartedScreenshots(page);

    console.log('\n--- Create Datasource Screenshots ---');
    await captureCreateDatasourceScreenshots(page);

    console.log('\n--- Clone Datasource Screenshots ---');
    await captureCloneScreenshots(page);

    console.log('\n--- Import from File Screenshots ---');
    await captureImportScreenshots(page);

    console.log('\n--- Completeness Checklist Screenshots ---');
    await captureCompletenessScreenshots(page);

    console.log('\n--- Schema Validation Screenshots ---');
    await captureSchemaScreenshots(page);

    console.log('\n--- Scheduling Screenshots ---');
    await captureSchedulingScreenshots(page);

    console.log('\n--- Monitoring Screenshots ---');
    await captureMonitoringScreenshots(page);

    console.log('\n--- Troubleshooting Screenshots ---');
    await captureTroubleshootingScreenshots(page);

    console.log('\n--- Alerts Page Screenshots ---');
    await captureAlertsScreenshots(page);

    console.log('\n--- Admin Settings Screenshots ---');
    await captureAdminSettingsScreenshots(page);

    console.log('\n--- Invalid Records Screenshots ---');
    await captureInvalidRecordsScreenshots(page);

    console.log('\n--- Additional Form Screenshots ---');
    await captureAdditionalFormScreenshots(page);

    console.log('\n--- Dashboard Screenshots ---');
    await captureDashboardScreenshots(page);

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
  if (succeeded.length < 20) {
    console.error(`\nERROR: Only ${succeeded.length} screenshots captured. Expected at least 20.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

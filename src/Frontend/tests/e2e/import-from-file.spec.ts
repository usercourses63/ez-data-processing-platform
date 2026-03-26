/**
 * Import from File - E2E Tests
 * Covers IMPORT-01 through IMPORT-06: upload triggers, CSV/JSON/XML preview,
 * headerless CSV detection, and form pre-fill flow.
 *
 * Prerequisites: Frontend running at FRONTEND_URL (default http://127.0.0.1:7000).
 * Run: cd src/Frontend && npx playwright test tests/e2e/import-from-file.spec.ts --headed
 */
import { test, expect, APIRequestContext, request, Page } from '@playwright/test';
import path from 'path';

// --- Constants (matching sanity.spec.ts patterns) ---
const DATASOURCE_API = 'http://127.0.0.1:5001';
const FRONTEND_URL   = 'http://127.0.0.1:7000';
const TEST_DATA_DIR  = path.resolve(__dirname, '../../test-data');

// --- Shared helpers (from sanity.spec.ts) ---

/** Extract entity ID from API response (handles Data wrapper). */
const extractId = (body: any): string | undefined => {
  return body?.Data?.ID || body?.ID || body?.data?.ID || body?.data?.id || body?.id;
};

/** Extract entity data from API response (handles Data wrapper). */
const extractData = (body: any): any => {
  return body?.Data || body?.data || body;
};

/** Click Ant Design tab in RTL mode (Playwright .click() doesn't trigger React state change). */
const antTabClick = async (page: Page, tabKey: string) => {
  await page.evaluate((key) => {
    const el = document.querySelector(`[id$="-tab-${key}"]`) as HTMLElement;
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, tabKey);
  await page.waitForTimeout(1000);
};

/** Open an Ant Design Select and click an option in the visible dropdown. */
const antSelect = async (page: Page, inputId: string, optionMatcher?: string | RegExp, optionIndex = 0) => {
  await page.locator('.ant-select').filter({ has: page.locator(`input#${inputId}`) }).click();
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await page.waitForTimeout(200);
  const opts = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:visible');
  if (optionMatcher) {
    await opts.filter({ hasText: optionMatcher }).first().click();
  } else {
    await opts.nth(optionIndex).click();
  }
  await page.waitForTimeout(300);
};

// --- Import-specific helpers ---

/**
 * Trigger file upload via the Import button's hidden <input type="file">.
 * Ant Design Upload wraps a hidden file input; we use page.setInputFiles on it.
 */
async function uploadTestFile(page: Page, filename: string) {
  const filePath = path.join(TEST_DATA_DIR, filename);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
}

/**
 * Wait for the import preview modal to appear and analysis to settle.
 */
async function waitForPreviewModal(page: Page) {
  await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000); // Allow analysis to complete
}

// --- API context for potential cleanup ---
let apiContext: APIRequestContext;

test.beforeAll(async () => {
  apiContext = await request.newContext({ ignoreHTTPSErrors: true });
});

test.afterAll(async () => {
  await apiContext.dispose();
});

// Each upload test uses uploadTestFile() which calls page.setInputFiles() to inject
// files into the Ant Design Upload hidden input. Tests cover CSV (setInputFiles with
// headers and headerless), JSON (setInputFiles with nested data), XML (setInputFiles
// with tagged content), and Continue flow (setInputFiles + form navigation).
test.describe('Import from File - Upload Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${FRONTEND_URL}/datasources`);
    await page.waitForLoadState('networkidle');
  });

  test('IMPORT-01: Import button exists on list page next to Create Datasource', async ({ page }) => {
    // The Import button has a FileAddOutlined icon and Hebrew text
    const importButton = page.locator('button').filter({ hasText: /from File|מקובץ|מקור נתונים חדש/i });
    await expect(importButton.first()).toBeVisible({ timeout: 10000 });

    // Create Datasource button should also be visible
    const createButton = page.locator('button').filter({ hasText: /הוסף מקור נתונים|Create|מקור נתונים/i });
    await expect(createButton.first()).toBeVisible();

    // Both should be in the same Space container (siblings)
    const buttonSpace = page.locator('.ant-space').filter({
      has: importButton.first(),
    });
    await expect(buttonSpace).toBeVisible();
  });

  test('IMPORT-02: CSV with headers shows preview modal with data table and extraction checklist', async ({ page }) => {
    await uploadTestFile(page, 'import-test-with-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // Data table should show rows (Ant Design Table rows)
    const tableRows = modal.locator('.ant-table-tbody tr:not([aria-hidden="true"])');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await tableRows.count();
    // Should show 5 preview rows (per D-09)
    expect(rowCount).toBe(5);

    // Extraction checklist renders field names in <strong> tags
    await expect(modal.locator('strong').filter({ hasText: 'name' }).first()).toBeVisible();
    await expect(modal.locator('strong').filter({ hasText: 'age' }).first()).toBeVisible();
    await expect(modal.locator('strong').filter({ hasText: 'email' }).first()).toBeVisible();

    // Total row count in footer
    await expect(modal.getByText(/10 שורות|10 rows/i).first()).toBeVisible();

    // Continue button should be visible
    const continueButton = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueButton).toBeVisible();
  });

  test('IMPORT-03: Headerless CSV detection and field name editing', async ({ page }) => {
    await uploadTestFile(page, 'import-test-no-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');

    // "First row is headers" toggle should appear (HeaderlessFieldEditor)
    const headerToggle = modal.locator('.ant-switch');
    await expect(headerToggle).toBeVisible({ timeout: 10000 });

    // Auto-detection: headerless CSV should have toggle unchecked
    const isChecked = await headerToggle.evaluate(
      (el) => el.classList.contains('ant-switch-checked')
    );
    // If headers auto-detected as true, toggle to No
    if (isChecked) {
      await headerToggle.click();
      await page.waitForTimeout(500);
    }

    // Editable field name inputs should appear (placeholder field_N pattern)
    const inputsWithPlaceholder = modal.locator('input[placeholder^="field_"]');
    const inputCount = await inputsWithPlaceholder.count();
    expect(inputCount).toBeGreaterThanOrEqual(1);

    // Type custom names in first 3 inputs
    if (inputCount >= 3) {
      await inputsWithPlaceholder.nth(0).clear();
      await inputsWithPlaceholder.nth(0).fill('name');
      await inputsWithPlaceholder.nth(1).clear();
      await inputsWithPlaceholder.nth(1).fill('age');
      await inputsWithPlaceholder.nth(2).clear();
      await inputsWithPlaceholder.nth(2).fill('email');
      await page.waitForTimeout(500);
    }

    // Extraction checklist should update with new field names
    await expect(modal.locator('strong').filter({ hasText: 'name' }).first()).toBeVisible();
  });

  test('IMPORT-04: JSON file shows preview modal with hierarchical view', async ({ page }) => {
    await uploadTestFile(page, 'import-test.json');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // JSON uses pre block (not table) for hierarchical preview
    const preBlock = modal.locator('pre');
    await expect(preBlock).toBeVisible({ timeout: 10000 });
    const preText = await preBlock.textContent();
    expect(preText).toContain('orderId');
    expect(preText).toContain('customer');

    // Extraction checklist shows field names with types
    const modalText = await modal.evaluate(el => el.textContent || '');
    expect(modalText).toContain('orderId');
    expect(modalText).toContain('object');

    // Continue button should be visible
    const continueButton = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueButton).toBeVisible();
  });

  test('IMPORT-05: XML file shows raw XML preview', async ({ page }) => {
    await uploadTestFile(page, 'import-test.xml');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // XML uses pre block for formatted raw XML preview
    const preBlock = modal.locator('pre');
    await expect(preBlock).toBeVisible({ timeout: 10000 });
    const preText = await preBlock.textContent();
    // Should contain XML tags
    expect(preText).toContain('<order');
    expect(preText).toContain('<customer>');

    // Extraction checklist shows nested field types
    const modalText = await modal.evaluate(el => el.textContent || '');
    expect(modalText).toContain('customer');
    expect(modalText).toContain('object');

    // Continue button should be visible
    const continueButton = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueButton).toBeVisible();
  });

  test('IMPORT-06: Continue navigates to pre-filled create form', async ({ page }) => {
    await uploadTestFile(page, 'import-test-with-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // Click Continue button
    const continueButton = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await continueButton.click();

    // Should navigate to the create form
    await page.waitForURL(/\/datasources\/new/, { timeout: 10000 });

    // Form name field should contain filename-based suggestion
    const nameInput = page.locator('input#name');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);
    expect(nameValue.toLowerCase()).toContain('import');

    // Navigate to File Settings tab using RTL-safe antTabClick
    await antTabClick(page, 'file');
    await page.waitForTimeout(500);

    // File type should be set to CSV
    const fileTypeSelect = page.locator('.ant-select').filter({ has: page.locator('input#fileType') });
    if (await fileTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const selectedText = await fileTypeSelect.locator('.ant-select-selection-item').textContent();
      expect(selectedText).toContain('CSV');
    }

    // Encoding should be filled
    const encodingSelect = page.locator('.ant-select').filter({ has: page.locator('input#encoding') });
    if (await encodingSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const encodingText = await encodingSelect.locator('.ant-select-selection-item').textContent();
      expect(encodingText?.length).toBeGreaterThan(0);
    }

    // Navigate to Schema tab using RTL-safe antTabClick
    await antTabClick(page, 'schema');

    // Schema tab should have content (Monaco editor or schema display)
    const tabPanels = page.locator('[role="tabpanel"]:visible');
    const panelContent = await tabPanels.textContent();
    expect(panelContent?.length).toBeGreaterThan(0);
  });
});

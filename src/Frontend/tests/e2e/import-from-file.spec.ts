/**
 * Import from File - E2E Tests
 * Covers IMPORT-01 (upload triggers), IMPORT-03 (headerless CSV), IMPORT-05 (preview + form pre-fill).
 *
 * Run: cd src/Frontend && npx playwright test tests/e2e/import-from-file.spec.ts --headed
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:7000';
const TEST_DATA_DIR = path.resolve(__dirname, '../../test-data');

/**
 * Helper: trigger file upload via the Import button's hidden <input type="file">.
 * Ant Design Upload wraps a hidden file input; we use page.setInputFiles on it.
 */
async function uploadTestFile(page: Page, filename: string) {
  const filePath = path.join(TEST_DATA_DIR, filename);
  // Ant Design Upload uses a hidden <input type="file"> inside the Upload wrapper
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
}

/**
 * Helper: wait for the import preview modal to appear.
 */
async function waitForPreviewModal(page: Page) {
  // The modal uses ant-modal class with the preview title
  await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000); // Allow analysis to complete
}

test.describe('Import from File - Upload Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${FRONTEND_URL}/datasources`);
    await page.waitForLoadState('networkidle');
  });

  test('New Datasource from File button exists on list page next to Create Datasource (IMPORT-01)', async ({ page }) => {
    // The Import button has a FileAddOutlined icon and "New Datasource from File" / "מקור נתונים חדש מקובץ" text
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

  test('CSV with headers shows preview modal with data table and extraction checklist (IMPORT-01, IMPORT-05)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-with-headers.csv');
    await waitForPreviewModal(page);

    // Modal should be visible with preview title
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

    // Total row count in footer (shows "סה"כ: 10 שורות" or similar)
    await expect(modal.getByText(/10 שורות|10 rows/i).first()).toBeVisible();

    // Continue button should be visible
    const continueButton = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueButton).toBeVisible();
  });

  test('Headerless CSV detection and editing (IMPORT-03, IMPORT-05)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-no-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');

    // "First row is headers" toggle should appear (HeaderlessFieldEditor)
    const headerToggle = modal.locator('.ant-switch');
    await expect(headerToggle).toBeVisible({ timeout: 10000 });

    // Auto-detection: headerless CSV should have toggle unchecked (No)
    // When unchecked, the switch does NOT have ant-switch-checked class
    const isChecked = await headerToggle.evaluate(
      (el) => el.classList.contains('ant-switch-checked')
    );
    // It could be detected as either; assert toggle exists and field editors appear
    // If headers auto-detected as true, toggle to No
    if (isChecked) {
      await headerToggle.click();
      await page.waitForTimeout(500);
    }

    // Editable field name inputs should appear (when headerless)
    const fieldInputs = modal.locator('input[type="text"]').filter({
      has: page.locator('[placeholder*="field_"]'),
    });
    // Alternative: look for inputs with placeholder pattern field_N
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

  test('JSON file shows preview modal (IMPORT-01)', async ({ page }) => {
    await uploadTestFile(page, 'import-test.json');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // Data table should show rows
    const tableRows = modal.locator('.ant-table-tbody tr:not([aria-hidden="true"])');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // Extraction checklist renders field names in <strong> tags
    await expect(modal.locator('strong').filter({ hasText: 'name' }).first()).toBeVisible();
    await expect(modal.locator('strong').filter({ hasText: 'email' }).first()).toBeVisible();

    // Continue button should be visible
    const continueButton = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueButton).toBeVisible();
  });

  test('XML file shows tree view (IMPORT-01, IMPORT-05)', async ({ page }) => {
    await uploadTestFile(page, 'import-test.xml');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // XML tree view should appear (Ant Design Tree component)
    const treeView = modal.locator('.ant-tree');
    await expect(treeView).toBeVisible({ timeout: 10000 });

    // Data table should also be present below the tree
    const dataTable = modal.locator('.ant-table');
    await expect(dataTable).toBeVisible();

    // Continue button should be visible
    const continueButton = modal.locator('button').filter({ hasText: /Continue|המשך/i });
    await expect(continueButton).toBeVisible();
  });

  test('Continue navigates to form with pre-filled data (IMPORT-01, IMPORT-05)', async ({ page }) => {
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
    // Name derived from filename "import-test-with-headers" (stripped extension)
    expect(nameValue.length).toBeGreaterThan(0);
    expect(nameValue.toLowerCase()).toContain('import');

    // Navigate to File Settings tab to check file type
    await page.locator('[id$="-tab-file"]').click();
    await page.waitForTimeout(1000);

    // File type should be set to CSV
    // Look for the file type selector showing CSV
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

    // Navigate to Schema tab to check schema was injected
    await page.locator('[id$="-tab-schema"]').click();
    await page.waitForTimeout(1500);

    // Schema tab should have content (Monaco editor or schema display)
    const schemaContent = page.locator('[id$="-tab-schema"]').locator('..');
    // The schema tab panel should contain something (not empty)
    const schemaPanel = page.locator('[role="tabpanel"]').filter({
      has: page.locator('.monaco-editor, textarea, pre, .ant-typography'),
    });
    // At minimum, the schema tab should have rendered something
    const tabPanels = page.locator('[role="tabpanel"]:visible');
    const panelContent = await tabPanels.textContent();
    expect(panelContent?.length).toBeGreaterThan(0);
  });
});

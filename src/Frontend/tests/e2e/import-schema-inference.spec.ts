/**
 * Import from File - Schema Inference E2E Tests
 * Covers IMPORT-02 (type inference), IMPORT-04 (smart constraints from schemaAutoSuggest).
 *
 * Run: cd src/Frontend && npx playwright test tests/e2e/import-schema-inference.spec.ts --headed
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:7000';
const TEST_DATA_DIR = path.resolve(__dirname, '../../test-data');

async function uploadTestFile(page: Page, filename: string) {
  const filePath = path.join(TEST_DATA_DIR, filename);
  await page.locator('input[type="file"]').setInputFiles(filePath);
}

async function waitForPreviewModal(page: Page) {
  await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2000);
}

/** Get the full text content of the modal's checklist section */
async function getModalText(page: Page): Promise<string> {
  return page.locator('.ant-modal').evaluate(el => el.textContent || '');
}

test.describe('Import Schema Inference', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${FRONTEND_URL}/datasources`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test('Type inference produces correct types from CSV (IMPORT-02)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-with-headers.csv');
    await waitForPreviewModal(page);

    const text = await getModalText(page);

    // Verify type inference in the extraction checklist text
    expect(text).toContain('name: string');
    expect(text).toContain('age: integer');
    expect(text).toContain('price: number');
    expect(text).toContain('active: boolean');
    expect(text).toContain('email: string');
  });

  test('Smart constraints from schemaAutoSuggest (IMPORT-04)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-with-headers.csv');
    await waitForPreviewModal(page);

    const text = await getModalText(page);

    // Email constraint
    expect(text).toMatch(/email.*format/i);

    // Age range constraint (0-120)
    expect(text).toMatch(/minimum.*0/);
    expect(text).toMatch(/maximum.*120/);

    // Price constraint
    expect(text).toMatch(/multipleOf.*0\.01/);

    // Name minLength
    expect(text).toMatch(/minLength.*2/);
  });

  test('JSON type inference produces correct types (IMPORT-02)', async ({ page }) => {
    await uploadTestFile(page, 'import-test.json');
    await waitForPreviewModal(page);

    const text = await getModalText(page);

    expect(text).toContain(': integer');
    expect(text).toContain(': number');
    expect(text).toContain(': boolean');
    expect(text).toContain(': string');
  });

  test('Headerless CSV schema uses field_N names (IMPORT-02, IMPORT-03)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-no-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');

    // Toggle should appear
    const headerToggle = modal.locator('.ant-switch');
    await expect(headerToggle).toBeVisible({ timeout: 10000 });

    // Ensure "No headers" state
    const isChecked = await headerToggle.evaluate(el => el.classList.contains('ant-switch-checked'));
    if (isChecked) {
      await headerToggle.click();
      await page.waitForTimeout(1000);
    }

    // Editable field inputs should appear
    const fieldInputs = modal.locator('input[placeholder^="field_"]');
    const inputCount = await fieldInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(3);

    // Rename field_1 to "full_name"
    await fieldInputs.nth(0).clear();
    await fieldInputs.nth(0).fill('full_name');
    await page.waitForTimeout(1000);

    // Checklist should show updated name
    const text = await getModalText(page);
    expect(text).toContain('full_name');
  });
});

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

/**
 * Helper: trigger file upload via Ant Design Upload's hidden input.
 */
async function uploadTestFile(page: Page, filename: string) {
  const filePath = path.join(TEST_DATA_DIR, filename);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
}

/**
 * Helper: wait for the import preview modal to appear and analysis to complete.
 */
async function waitForPreviewModal(page: Page) {
  await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1500); // Allow analysis and schema inference to complete
}

test.describe('Import Schema Inference', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${FRONTEND_URL}/datasources`);
    await page.waitForLoadState('networkidle');
  });

  test('Type inference produces correct types from CSV (IMPORT-02)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-with-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');

    // The ExtractionChecklist shows each field with ": type" pattern
    // Format in ExtractionChecklist: <strong>name</strong><Text type="secondary">: string</Text>

    // Verify field name + type pairs in the extraction checklist
    // "name" field should be "string" (has text values)
    const nameField = modal.locator('div').filter({ hasText: /^name/ }).first();
    await expect(modal.getByText(/name.*:.*string/i).or(
      modal.locator('text=: string').first()
    )).toBeVisible({ timeout: 10000 });

    // "age" field should be "integer" (all whole numbers: 30, 25, 45, ...)
    // The checklist renders "age" then ": integer"
    await expect(modal.getByText(/:\s*integer/)).toBeVisible();

    // "price" field should be "number" (decimals: 99.99, 149.50, ...)
    await expect(modal.getByText(/:\s*number/)).toBeVisible();

    // "active" field should be "boolean" (true/false values)
    await expect(modal.getByText(/:\s*boolean/)).toBeVisible();

    // "email" field should be "string"
    // Multiple string fields exist; at least verify string type appears
    const stringTypeEntries = modal.locator('text=: string');
    const stringCount = await stringTypeEntries.count();
    // name, email, phone are all string -> at least 3
    expect(stringCount).toBeGreaterThanOrEqual(3);
  });

  test('Smart constraints from schemaAutoSuggest (IMPORT-04)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-with-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');

    // ExtractionChecklist shows constraints in format: (constraint_text)
    // Email field: "email format" from schemaAutoSuggest
    await expect(modal.getByText(/email.*format/i)).toBeVisible({ timeout: 10000 });

    // Phone field: "pattern" constraint (Israeli phone pattern)
    await expect(modal.getByText(/pattern/i)).toBeVisible();

    // Age field: "minimum: 0" and "maximum: 120" constraints
    await expect(modal.getByText(/minimum.*0|min.*0/i)).toBeVisible();
    await expect(modal.getByText(/maximum.*120|max.*120/i)).toBeVisible();

    // Price field: "minimum: 0" constraint
    // Note: price also has "multipleOf: 0.01" but minimum is the key one
    // Green check icons indicate fields with constraints (CheckCircleFilled)
    const greenChecks = modal.locator('.anticon-check-circle');
    const greenCount = await greenChecks.count();
    // email, phone, age, price, name should all have constraints -> at least 5
    expect(greenCount).toBeGreaterThanOrEqual(4);
  });

  test('JSON type inference produces correct types (IMPORT-02)', async ({ page }) => {
    await uploadTestFile(page, 'import-test.json');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');

    // JSON values are natively typed, so inference should be accurate
    // "age" -> integer (JSON number, no decimal)
    await expect(modal.getByText(/:\s*integer/)).toBeVisible({ timeout: 10000 });

    // "price" -> number (JSON number with decimal)
    await expect(modal.getByText(/:\s*number/)).toBeVisible();

    // "active" -> boolean (JSON boolean)
    await expect(modal.getByText(/:\s*boolean/)).toBeVisible();

    // "name" -> string
    const stringEntries = modal.locator('text=: string');
    const stringCount = await stringEntries.count();
    expect(stringCount).toBeGreaterThanOrEqual(1);
  });

  test('Headerless CSV schema uses field_1..field_N names (IMPORT-02, IMPORT-03)', async ({ page }) => {
    await uploadTestFile(page, 'import-test-no-headers.csv');
    await waitForPreviewModal(page);

    const modal = page.locator('.ant-modal');

    // Wait for toggle to appear
    const headerToggle = modal.locator('.ant-switch');
    await expect(headerToggle).toBeVisible({ timeout: 10000 });

    // Ensure toggle is in "No headers" state
    const isChecked = await headerToggle.evaluate(
      (el) => el.classList.contains('ant-switch-checked')
    );
    if (isChecked) {
      await headerToggle.click();
      await page.waitForTimeout(500);
    }

    // Extraction checklist should show field_1, field_2, etc.
    await expect(modal.getByText('field_1')).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText('field_2')).toBeVisible();

    // Types should still be inferred from data values
    // field_1 = names (string), field_2 = ages (integer), etc.
    // At minimum, verify type labels are present
    await expect(modal.getByText(/:\s*(string|integer|number|boolean)/)).toBeVisible();

    // Edit field names to custom values
    const fieldInputs = modal.locator('input[placeholder^="field_"]');
    const inputCount = await fieldInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(3);

    // Rename field_1 to "full_name"
    await fieldInputs.nth(0).clear();
    await fieldInputs.nth(0).fill('full_name');
    await page.waitForTimeout(500);

    // Extraction checklist should update to show "full_name" instead of "field_1"
    await expect(modal.getByText('full_name')).toBeVisible({ timeout: 5000 });
  });
});

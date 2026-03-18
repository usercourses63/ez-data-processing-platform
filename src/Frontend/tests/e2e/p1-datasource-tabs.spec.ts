/**
 * Suite P1: Datasource Form Tab Coverage
 * Tests: DS-003, DS-004, DS-005, DS-006, DS-007, DS-008, DS-014, DS-016
 *
 * Strategy: API-first — create a datasource via API, then navigate to its edit form
 * and interact with each tab. No API fallbacks: if the tab fails to render, the test fails.
 *
 * Tests:
 *   DS-003 — ConnectionTab: Kafka protocol shows topic + consumer group fields
 *   DS-004 — OutputTab: "Add destination" button opens DestinationEditorModal
 *   DS-005 — OutputTab: Kafka type option available in destination modal
 *   DS-006 — OutputTab: SFTP type option available in destination modal
 *   DS-007 — OutputTab: HTTP type option available in destination modal
 *   DS-008 — OutputTab: Modal cancel works; multiple invocations possible
 *   DS-014 — FileSettingsTab: CSV type shows delimiter + hasHeaders controls
 *   DS-016 — ValidationTab: Renders skip-invalid switch + max-errors input
 */
import { test, expect } from './support';
import { EZ_API_BASE, getDataSources } from './helpers/ez-api-client';
import { clickAntTab, selectAntOption } from './support/helpers/ant-design-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';

test.describe.configure({ mode: 'serial' });

test.describe('@P1 @Datasource Datasource Form Tab Coverage', () => {
  let datasourceId: string;
  let editUrl: string;
  let createdByTest = false;

  test.beforeAll(async ({ request }) => {
    // Prefer an existing datasource (created by P0 suite or demo data)
    const existing = await getDataSources(request);
    if (existing.length > 0) {
      datasourceId = existing[0].ID;
    } else {
      // Create a minimal datasource via API for tab testing
      const catRes = await request.get(`${EZ_API_BASE}/api/v1/Categories`);
      expect(catRes.ok(), 'Categories API must respond').toBeTruthy();
      const categories = await catRes.json();
      const categoryId = categories[0]?.ID;
      expect(categoryId, 'Need at least one category in DB').toBeTruthy();

      const res = await request.post(`${EZ_API_BASE}/api/v1/datasources`, {
        data: {
          Name: `P1-TabTest-${Date.now()}`,
          Description: 'Created for P1 tab coverage tests',
          SupplierName: 'P1 Test Supplier',
          CategoryId: categoryId,
          FilePattern: '*.csv',
          IsActive: true,
          ConnectionString: 'local:///data/input/',
          ConnectionConfig: { Type: 'local', BasePath: '/data/input/' },
          FileConfig: { Type: 'CSV' },
        },
      });
      expect(res.ok(), `Datasource POST must succeed (got ${res.status()})`).toBeTruthy();
      const body = await res.json();
      datasourceId = body?.ID || body?.Data?.ID || body?.data?.ID;
      expect(datasourceId, 'Datasource ID must be returned').toBeTruthy();
      createdByTest = true;
    }

    editUrl = `${BASE_URL}/datasources/${datasourceId}/edit`;
  });

  test.afterAll(async ({ request }) => {
    // Only delete datasources we created; leave existing ones intact
    if (createdByTest && datasourceId) {
      await request
        .delete(`${EZ_API_BASE}/api/v1/datasources/${datasourceId}`)
        .catch(() => {});
    }
  });

  // ── DS-014: FileSettingsTab ────────────────────────────────────────────────
  test('DS-014: FileSettingsTab shows CSV delimiter and hasHeaders when CSV selected', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'file');
    await page.waitForLoadState('networkidle');

    // FileSettingsTab headline alert
    await expect(page.getByText('הגדרות פורמט הקובץ')).toBeVisible({ timeout: 8000 });

    // File type select (Form.Item name="fileType" → input#fileType)
    const fileTypeSelect = page.locator('.ant-select:has(input#fileType)');
    await expect(fileTypeSelect).toBeVisible({ timeout: 5000 });

    // Select CSV
    await selectAntOption(page, fileTypeSelect, 'CSV');

    // CSV-specific controls must appear
    await expect(page.getByText('מפריד (Delimiter)')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('שורת כותרות')).toBeVisible({ timeout: 5000 });

    // hasHeaders switch is interactable
    const headersSwitch = page.locator('.ant-switch').first();
    await expect(headersSwitch).toBeVisible({ timeout: 3000 });
    const before = await headersSwitch.evaluate(el => el.classList.contains('ant-switch-checked'));
    await headersSwitch.click();
    const after = await headersSwitch.evaluate(el => el.classList.contains('ant-switch-checked'));
    expect(after).not.toBe(before);
  });

  // ── DS-016: ValidationTab ─────────────────────────────────────────────────
  test('DS-016: ValidationTab renders skip-invalid switch and max-errors input', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'validation');
    await page.waitForLoadState('networkidle');

    // ValidationTab headline alert
    await expect(page.getByText('כללי אימות נתונים')).toBeVisible({ timeout: 8000 });

    // Skip invalid records switch label
    await expect(page.getByText('דלג על רשומות לא תקינות')).toBeVisible({ timeout: 5000 });

    // Max errors allowed label
    await expect(page.getByText('מקסימום שגיאות מותרות')).toBeVisible({ timeout: 5000 });

    // skipInvalidRecords switch toggles
    const skipSwitch = page.locator('.ant-switch').first();
    await expect(skipSwitch).toBeVisible({ timeout: 5000 });
    const before = await skipSwitch.evaluate(el => el.classList.contains('ant-switch-checked'));
    await skipSwitch.click();
    const after = await skipSwitch.evaluate(el => el.classList.contains('ant-switch-checked'));
    expect(after).not.toBe(before);

    // maxErrorsAllowed input is present
    const maxInput = page.locator('input[id*="maxErrors"], .ant-input-number input').first();
    await expect(maxInput).toBeVisible({ timeout: 3000 });
    await maxInput.fill('50');
    await expect(maxInput).toHaveValue('50');
  });

  // ── DS-003: ConnectionTab — Kafka ─────────────────────────────────────────
  test('DS-003: ConnectionTab shows Kafka topic + consumer group when Kafka selected', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'connection');
    await page.waitForLoadState('networkidle');

    // Connection type select (Form.Item name="connectionType")
    const connectionTypeSelect = page.locator('.ant-select:has(input#connectionType)');
    await expect(connectionTypeSelect).toBeVisible({ timeout: 8000 });

    // Select Kafka
    await selectAntOption(page, connectionTypeSelect, 'Kafka');

    // Kafka-specific divider and fields must appear
    await expect(page.getByText(/הגדרות Kafka/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^Topic$/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Consumer Group/i)).toBeVisible({ timeout: 5000 });

    // Topic input must be fillable
    const topicInput = page.locator('input#kafkaTopic');
    await expect(topicInput).toBeVisible({ timeout: 3000 });
    await topicInput.fill('test-input-topic');
    await expect(topicInput).toHaveValue('test-input-topic');
  });

  // ── DS-004: OutputTab — "Add destination" button ──────────────────────────
  test('DS-004: OutputTab renders destination list and Add button', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'output');
    await page.waitForLoadState('networkidle');

    // Add destination button must be visible
    const addBtn = page.getByRole('button', { name: /הוסף יעד/i });
    await expect(addBtn).toBeVisible({ timeout: 8000 });
  });

  // ── DS-005/006/007: OutputTab — destination type selection ────────────────
  test('DS-005/DS-006/DS-007: DestinationEditorModal offers Kafka, SFTP, HTTP types', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'output');
    await page.waitForLoadState('networkidle');

    // Open destination editor modal
    await page.getByRole('button', { name: /הוסף יעד/i }).click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });

    // Name field
    const nameField = page.locator('.ant-modal-content').getByRole('textbox').first();
    await expect(nameField).toBeVisible({ timeout: 3000 });
    await nameField.fill('P1 Test Output');

    // Protocol type select — open dropdown
    const typeSelect = page.locator('.ant-modal-content .ant-select').first();
    await typeSelect.click();
    await page.waitForTimeout(300); // Ant Design dropdown animation

    // All required destination types must be available
    const kafkaOpt = page.locator('.ant-select-item-option').filter({ hasText: 'Kafka' });
    await expect(kafkaOpt).toBeVisible({ timeout: 3000 });

    const sftpOpt = page.locator('.ant-select-item-option').filter({ hasText: 'SFTP' });
    await expect(sftpOpt).toBeVisible({ timeout: 3000 });

    const httpOpt = page.locator('.ant-select-item-option').filter({ hasText: 'HTTP' });
    await expect(httpOpt).toBeVisible({ timeout: 3000 });

    // DS-005: select Kafka and verify server section appears
    await kafkaOpt.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    // After selecting Kafka, a server selection section should appear
    await expect(page.locator('.ant-modal-content').getByText(/בחר שרת|שרתי פלט|No.*server|אין שרתים/i)).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.getByRole('button', { name: /ביטול|cancel/i }).click();
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 5000 });
  });

  // ── DS-008: OutputTab — multiple destinations ─────────────────────────────
  test('DS-008: OutputTab modal can be reopened for multiple destination additions', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'output');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: /הוסף יעד/i });

    // Open and cancel once
    await addBtn.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /ביטול|cancel/i }).click();
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 3000 });

    // Open and cancel again — verifies modal state resets correctly
    await addBtn.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });
    const nameField = page.locator('.ant-modal-content').getByRole('textbox').first();
    await expect(nameField).toHaveValue(''); // Modal starts fresh
    await page.getByRole('button', { name: /ביטול|cancel/i }).click();
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 3000 });
  });
});

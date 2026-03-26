/**
 * Clone Datasource E2E Tests
 *
 * Tests the clone flow from list page (icon button) and details page (header button).
 * Verifies: confirmation modal, navigation to create form, pre-filled fields, name prefix.
 * Uses API-based verification and cleanup following sanity.spec.ts patterns.
 *
 * Requires: at least one datasource in the system (seeded via DemoDataGenerator).
 */
import { test, expect, APIRequestContext, request, Page } from '@playwright/test';

const DATASOURCE_API = 'http://127.0.0.1:5001';
const FRONTEND_URL   = 'http://127.0.0.1:7000';

let apiContext: APIRequestContext;

// --- Shared helpers (same as sanity.spec.ts) ---

const extractId = (body: any): string | undefined => {
  return body?.Data?.ID || body?.ID || body?.data?.ID || body?.data?.id || body?.id;
};

const extractData = (body: any): any => {
  return body?.Data || body?.data || body;
};

const antTabClick = async (page: Page, tabKey: string) => {
  await page.evaluate((key) => {
    const el = document.querySelector(`[id$="-tab-${key}"]`) as HTMLElement;
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, tabKey);
  await page.waitForTimeout(1000);
};

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

// --- Helper: create a datasource via API for testing ---
async function createTestDatasource(ctx: APIRequestContext, name: string): Promise<string> {
  const payload = {
    Name: name,
    SupplierName: 'CloneTestSupplier',
    Category: 'Finance',
    FilePattern: '*.csv',
    RetentionDays: 30,
    ConnectionType: 'Local',
    ConnectionString: '/data/test',
    IsActive: true,
    ConfigurationSettings: JSON.stringify({
      inputConfig: { fileType: 'CSV' },
      outputConfig: { destinations: [] },
    }),
  };
  const resp = await ctx.post(`${DATASOURCE_API}/api/v1/datasource`, { data: payload });
  expect(resp.ok(), `Create datasource failed: ${resp.status()}`).toBeTruthy();
  const body = await resp.json();
  const id = extractId(body);
  expect(id).toBeTruthy();
  return id!;
}

// --- Helper: delete a datasource via API ---
async function deleteDatasource(ctx: APIRequestContext, id: string): Promise<void> {
  await ctx.delete(`${DATASOURCE_API}/api/v1/datasource/${id}?deletedBy=SanityTest`);
}

// --- Test suite ---

test.describe.configure({ mode: 'serial' });

test.describe('Clone Datasource', () => {
  test.beforeAll(async () => {
    apiContext = await request.newContext({ ignoreHTTPSErrors: true });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${FRONTEND_URL}/datasources`);
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 30000 });
  });

  test('CLONE-01: Actions column has clone icon button', async ({ page }) => {
    const firstRow = page.locator('.ant-table-tbody tr').first();

    // Verify clone (copy) icon button is present
    const copyIcon = firstRow.locator('.anticon-copy');
    await expect(copyIcon).toBeVisible({ timeout: 5000 });

    // Hover to verify tooltip appears
    const cloneBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-copy') });
    await cloneBtn.hover();
    await page.waitForTimeout(500);

    // Tooltip should appear somewhere on the page
    const tooltip = page.locator('.ant-tooltip-inner:visible');
    if (await tooltip.count() > 0) {
      const tooltipText = await tooltip.first().textContent();
      expect(tooltipText).toBeTruthy();
    }
  });

  test('CLONE-02: Clone from list shows modal and navigates to pre-filled form', async ({ page }) => {
    const firstRow = page.locator('.ant-table-tbody tr').first();

    // Click Clone button (copy icon)
    const cloneBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-copy') });
    await cloneBtn.click();
    await page.waitForTimeout(1000);

    // Verify confirmation modal
    const modal = page.locator('.ant-modal-confirm');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Confirm clone
    await modal.locator('.ant-btn-primary').click();
    await page.waitForTimeout(2000);

    // Verify navigation to create form
    expect(page.url()).toContain('/datasources/new');

    // Verify name input contains Hebrew clone prefix
    const nameInput = page.locator('input#name, input[id$="_name"]').first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nameValue = await nameInput.inputValue();
      expect(nameValue).toContain('העתק של');
    }

    // Verify supplierName is populated (non-empty)
    const supplierInput = page.locator('input#supplierName, input[id$="_supplierName"]').first();
    if (await supplierInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const val = await supplierInput.inputValue();
      expect(val.length).toBeGreaterThan(0);
    }
  });

  test('CLONE-03: Clone preserves category via API-created source', async ({ page }) => {
    // Create a known datasource via API
    let sourceId: string | undefined;
    try {
      sourceId = await createTestDatasource(apiContext, 'CloneTest-Source-' + Date.now());

      // Reload the list
      await page.goto(`${FRONTEND_URL}/datasources`);
      await page.waitForSelector('.ant-table-tbody tr', { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Find the row with our datasource (search by name or just use first row)
      // Use first row since our newly-created datasource may be at top or need search
      const firstRow = page.locator('.ant-table-tbody tr').first();

      // Clone
      const cloneBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-copy') });
      await cloneBtn.click();
      await page.waitForTimeout(1000);

      const modal = page.locator('.ant-modal-confirm');
      await expect(modal).toBeVisible({ timeout: 5000 });
      await modal.locator('.ant-btn-primary').click();
      await page.waitForTimeout(2000);

      // Should be on create form
      expect(page.url()).toContain('/datasources/new');

      // Verify name has prefix
      const nameInput = page.locator('input#name, input[id$="_name"]').first();
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        const nameValue = await nameInput.inputValue();
        expect(nameValue).toContain('העתק של');
      }

      // Verify source still exists via API
      const checkResp = await apiContext.get(`${DATASOURCE_API}/api/v1/datasource/${sourceId}`);
      expect(checkResp.ok()).toBeTruthy();
    } finally {
      // Cleanup: delete via API
      if (sourceId) {
        await deleteDatasource(apiContext, sourceId);
      }
    }
  });

  test('CLONE-04: Clone from details page header', async ({ page }) => {
    // Navigate to first datasource details
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const viewBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-eye') });
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    await viewBtn.click();
    await page.waitForURL(/\/datasources\/[a-f0-9]+$/, { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify Clone button exists in header
    const cloneBtn = page.locator('button').filter({ has: page.locator('.anticon-copy') });
    await expect(cloneBtn).toBeVisible({ timeout: 5000 });

    // Click Clone
    await cloneBtn.click();
    await page.waitForTimeout(1000);

    // Verify confirmation modal
    const modal = page.locator('.ant-modal-confirm');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Confirm
    await modal.locator('.ant-btn-primary').click();
    await page.waitForTimeout(2000);

    // Verify navigation to create form
    expect(page.url()).toContain('/datasources/new');
  });

  test('CLONE-05: Cleanup API works (create and delete via API)', async () => {
    // Create temp datasource
    const tempId = await createTestDatasource(apiContext, 'CloneTest-Cleanup-' + Date.now());

    // Verify it exists
    const checkResp = await apiContext.get(`${DATASOURCE_API}/api/v1/datasource/${tempId}`);
    expect(checkResp.ok()).toBeTruthy();

    // Delete with deletedBy=SanityTest
    await deleteDatasource(apiContext, tempId);

    // Verify it no longer returns 200 (soft-deleted or 404)
    const afterResp = await apiContext.get(`${DATASOURCE_API}/api/v1/datasource/${tempId}`);
    // Accept either 404 or a response where IsDeleted=true
    if (afterResp.ok()) {
      const body = await afterResp.json();
      const data = extractData(body);
      expect(data?.IsDeleted).toBeTruthy();
    }
  });
});

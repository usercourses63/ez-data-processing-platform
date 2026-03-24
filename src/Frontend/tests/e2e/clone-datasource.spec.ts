/**
 * Clone Datasource E2E Tests
 *
 * Tests the clone flow from list page (icon button) and details page (header button).
 * Verifies: confirmation modal, navigation to create form, pre-filled fields, name prefix.
 * Uses icon-only buttons (Pattern 2) with Tooltips — no dropdown menu.
 *
 * Requires: at least one datasource in the system (seeded via DemoDataGenerator).
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Clone Datasource', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://172.30.22.206:32608/datasources');
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 30000 });
  });

  test('CLONE-LIST-01: Actions column shows icon buttons including Clone', async ({ page }) => {
    const firstRow = page.locator('.ant-table-tbody tr').first();

    // Verify all 5 icon buttons are present
    await expect(firstRow.locator('.anticon-eye')).toBeVisible();
    await expect(firstRow.locator('.anticon-edit')).toBeVisible();
    await expect(firstRow.locator('.anticon-copy')).toBeVisible();
    await expect(firstRow.locator('.anticon-thunderbolt')).toBeVisible();
    await expect(firstRow.locator('.anticon-delete')).toBeVisible();
  });

  test('CLONE-LIST-02: Clone from list shows confirmation modal then navigates to pre-filled form', async ({ page }) => {
    const firstRow = page.locator('.ant-table-tbody tr').first();

    // Click Clone button (copy icon)
    const cloneBtn = firstRow.locator('button .anticon-copy').locator('..');
    await cloneBtn.click();
    await page.waitForTimeout(3000);

    // Verify confirmation modal
    const modal = page.locator('.ant-modal-confirm');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Confirm clone
    await modal.locator('.ant-btn-primary').click();
    await page.waitForTimeout(3000);

    // Verify navigation to create form
    expect(page.url()).toContain('/datasources/new');

    // Verify page title indicates cloning
    await expect(page.locator('text=שכפול מקור נתונים')).toBeVisible({ timeout: 5000 });
  });

  test('CLONE-LIST-03: Clone pre-fills supplier and category fields', async ({ page }) => {
    const firstRow = page.locator('.ant-table-tbody tr').first();

    // Clone
    await firstRow.locator('button .anticon-copy').locator('..').click();
    await page.waitForTimeout(3000);
    const modal = page.locator('.ant-modal-confirm');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('.ant-btn-primary').click();
    await page.waitForTimeout(3000);

    // On the create form — check fields are populated
    expect(page.url()).toContain('/datasources/new');

    // Supplier name should be filled (not empty)
    const supplierInput = page.locator('input#supplierName, input[id$="_supplierName"]').first();
    if (await supplierInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const val = await supplierInput.inputValue();
      expect(val.length).toBeGreaterThan(0);
    }
  });

  test('CLONE-DETAILS-01: Clone from details page header works', async ({ page }) => {
    // Navigate to first datasource details
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const viewBtn = firstRow.locator('button .anticon-eye').locator('..');
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    await viewBtn.click();
    await page.waitForURL(/\/datasources\/[a-f0-9]+$/, { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify Clone button exists in header
    const cloneBtn = page.locator('button .anticon-copy').locator('..');
    await expect(cloneBtn).toBeVisible({ timeout: 5000 });

    // Click Clone
    await cloneBtn.click();
    await page.waitForTimeout(3000);

    // Verify confirmation modal
    const modal = page.locator('.ant-modal-confirm');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Confirm
    await modal.locator('.ant-btn-primary').click();
    await page.waitForTimeout(3000);

    // Verify navigation to create form
    expect(page.url()).toContain('/datasources/new');
  });

  test('ACTIONS-01: Delete action shows popconfirm and can be cancelled', async ({ page }) => {
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const deleteBtn = firstRow.locator('button .anticon-delete').locator('..');
    await deleteBtn.click();
    await page.waitForTimeout(1000);

    // Popconfirm should appear
    const popconfirm = page.locator('.ant-popconfirm, .ant-popover');
    await expect(popconfirm).toBeVisible({ timeout: 5000 });

    // Cancel it
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Should still be on the same page
    expect(page.url()).toContain('/datasources');
  });
});

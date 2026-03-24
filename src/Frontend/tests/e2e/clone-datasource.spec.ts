/**
 * Clone Datasource E2E Tests
 *
 * Tests the clone flow from both list page (overflow dropdown) and details page (header button).
 * Verifies: confirmation modal, navigation to create form, pre-filled fields, name prefix.
 *
 * Requires: at least one datasource in the system (seeded via DemoDataGenerator).
 */
import { test, expect } from '@playwright/test';

test.describe('Clone Datasource', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForSelector('.ant-table-tbody', { timeout: 15000 });
  });

  test('CLONE-LIST-01: Actions column shows overflow dropdown with Clone option', async ({ page }) => {
    // Verify View and Edit are inline buttons in the first row
    const firstRow = page.locator('.ant-table-tbody tr').first();
    await expect(firstRow.locator('button', { hasText: /צפה|View/ })).toBeVisible();
    await expect(firstRow.locator('button', { hasText: /ערוך|Edit/ })).toBeVisible();

    // Click the overflow (MoreOutlined) dropdown trigger
    const moreButton = firstRow.locator('button .anticon-more').locator('..');
    await expect(moreButton).toBeVisible();
    await moreButton.click();

    // Verify dropdown menu appears with Clone, Trigger, and Delete options
    const dropdown = page.locator('.ant-dropdown-menu');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('.ant-dropdown-menu-item', { hasText: /שכפל|Clone/ })).toBeVisible();
    await expect(dropdown.locator('.ant-dropdown-menu-item', { hasText: /הפעל|Trigger/ })).toBeVisible();
    await expect(dropdown.locator('.ant-dropdown-menu-item', { hasText: /מחק|Delete/ })).toBeVisible();

    // Close dropdown by clicking elsewhere
    await page.click('body', { position: { x: 0, y: 0 } });
  });

  test('CLONE-LIST-02: Clone from list shows confirmation modal then navigates to pre-filled form', async ({ page }) => {
    // Get the name of the first datasource for verification
    const firstRow = page.locator('.ant-table-tbody tr').first();

    // Open overflow menu and click Clone
    const moreButton = firstRow.locator('button .anticon-more').locator('..');
    await moreButton.click();
    await page.locator('.ant-dropdown-menu-item', { hasText: /שכפל|Clone/ }).click();

    // Verify confirmation modal appears
    const modal = page.locator('.ant-modal-confirm');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Confirm the clone
    await modal.locator('.ant-btn-primary').click();

    // Verify navigation to create form
    await page.waitForURL(/\/datasources\/new/, { timeout: 10000 });

    // Verify name is prefixed with clone prefix
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toMatch(/^(העתק של |Copy of )/);

    // Verify schedule is disabled
    const scheduleEnabledSwitch = page.locator('#scheduleEnabled');
    // The switch should be unchecked (disabled)
    if (await scheduleEnabledSwitch.count() > 0) {
      await expect(scheduleEnabledSwitch).not.toBeChecked();
    }
  });

  test('CLONE-DETAILS-01: Clone from details page header works', async ({ page }) => {
    // Navigate to first datasource details by clicking View
    const firstRow = page.locator('.ant-table-tbody tr').first();
    await firstRow.locator('button', { hasText: /צפה|View/ }).click();
    await page.waitForURL(/\/datasources\/[^/]+$/, { timeout: 10000 });

    // Verify Clone button exists in header
    const cloneBtn = page.locator('button', { hasText: /שכפל|Clone/ });
    await expect(cloneBtn).toBeVisible({ timeout: 5000 });

    // Click Clone and verify confirmation modal
    await cloneBtn.click();
    const modal = page.locator('.ant-modal-confirm');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Confirm the clone
    await modal.locator('.ant-btn-primary').click();

    // Verify navigation to create form with pre-filled data
    await page.waitForURL(/\/datasources\/new/, { timeout: 10000 });

    // Verify name is prefixed
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toMatch(/^(העתק של |Copy of )/);
  });
});

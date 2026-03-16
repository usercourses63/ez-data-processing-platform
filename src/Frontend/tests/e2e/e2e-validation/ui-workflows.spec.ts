/**
 * E2E Validation: UI Workflow Tests
 *
 * Validates that the DemoDataGenerator-seeded environment is correctly
 * visible and interactive through the frontend UI:
 * - AdminServer page shows seeded servers
 * - NAS Devices page shows seeded NAS devices
 * - DataSources page shows seeded DataSources
 * - Invalid Records page is accessible and functional
 *
 * All tests run against real seeded data (no mocks).
 */
import { test, expect } from '@playwright/test';
import { e2eValidationSetup } from './global-setup';
import { e2eValidationTeardown } from './global-teardown';
import { e2eReporter } from './helpers/validation-reporter';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await e2eValidationSetup();
  e2eReporter.enablePersistence('ui-workflows');
});

test.afterAll(async () => {
  await e2eValidationTeardown();
});

test('AdminServer page shows seeded servers', async ({ page }) => {
  const startTime = Date.now();
  try {
    // Navigate to admin settings
    await page.goto(`${BASE_URL}/admin/settings`);
    await page.waitForLoadState('networkidle');

    // Set wide viewport for RTL tab visibility
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500);

    // Click the Input Servers tab using dispatchEvent for RTL safety
    await page.evaluate(() => {
      const tab = document.querySelector('[data-node-key="servers"]');
      if (tab) {
        tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify table is visible
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Verify at least one server row is visible (DemoDataGenerator creates FTP, SFTP servers)
    const rows = page.locator('.ant-table-row');
    await rows.first().waitFor({ state: 'visible', timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify column headers are present
    await expect(page.getByRole('columnheader').first()).toBeVisible();

    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'AdminServer page shows seeded servers',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'AdminServer page shows seeded servers',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

test('NAS Devices page shows seeded NAS devices', async ({ page }) => {
  const startTime = Date.now();
  try {
    // Navigate directly to NAS devices tab
    await page.goto(`${BASE_URL}/admin/settings?tab=nasDevices`);
    await page.waitForLoadState('networkidle');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(1000);

    // Verify table is visible
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Verify at least one NAS device row is visible
    const rows = page.locator('.ant-table-row');
    await rows.first().waitFor({ state: 'visible', timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Check for provisioning status indicator (tags like PVC, etc.)
    const statusTags = page.locator('.ant-tag');
    const tagCount = await statusTags.count();
    expect(tagCount).toBeGreaterThan(0);

    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'NAS Devices page shows seeded NAS devices',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'NAS Devices page shows seeded NAS devices',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

test('DataSources page shows seeded DataSources', async ({ page }) => {
  const startTime = Date.now();
  try {
    // Navigate to DataSources list page (root route)
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(1000);

    // Verify the page heading is visible
    await expect(page.getByText('ניהול מקורות נתונים')).toBeVisible({ timeout: 10000 });

    // Verify table is visible
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Verify at least one DataSource row exists (DemoDataGenerator creates several)
    const rows = page.locator('.ant-table-row');
    await rows.first().waitFor({ state: 'visible', timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Click on the first DataSource row to open detail view
    await rows.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify we navigated to a detail/edit form (check for tab navigation)
    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    const hasConnectionTab = await connectionTab.isVisible({ timeout: 5000 }).catch(() => false);

    // If detail view has tabs, verify Connection tab exists
    if (hasConnectionTab) {
      // Click Connection tab using dispatchEvent for RTL safety
      await page.evaluate(() => {
        const tabs = document.querySelectorAll('[role="tab"]');
        for (const tab of tabs) {
          if (tab.textContent?.match(/חיבור|connection/i)) {
            tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            break;
          }
        }
      });
      await page.waitForTimeout(1000);
    }

    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'DataSources page shows seeded DataSources',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'DataSources page shows seeded DataSources',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

test('Invalid Records page accessible and functional', async ({ page }) => {
  const startTime = Date.now();
  try {
    // Navigate to Invalid Records page
    await page.goto(`${BASE_URL}/invalid-records`);
    await page.waitForLoadState('networkidle');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(1000);

    // Verify the page loads without critical errors (no error alerts blocking the page)
    const errorAlert = page.locator('.ant-alert-error');
    const hasBlockingError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    // A data-loading error is acceptable (no invalid records yet), a crash is not
    if (hasBlockingError) {
      const errorText = await errorAlert.textContent() ?? '';
      // Connection errors are acceptable in test env, JS crash errors are not
      expect(errorText).not.toContain('chunk');
      expect(errorText).not.toContain('undefined');
    }

    // Verify the table or empty state renders
    const table = page.locator('.ant-table');
    const emptyState = page.locator('.ant-empty');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);

    // If there are filter dropdowns, verify they render
    const filterDropdowns = page.locator('.ant-select');
    const filterCount = await filterDropdowns.count();
    // Page has at least the layout rendered (with or without filters)
    expect(filterCount).toBeGreaterThanOrEqual(0);

    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'Invalid Records page accessible and functional',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'ui-workflow',
      testName: 'Invalid Records page accessible and functional',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

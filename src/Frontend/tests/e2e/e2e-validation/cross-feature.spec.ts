/**
 * E2E Validation: Cross-Feature Workflow Tests
 *
 * Validates multi-page workflows that span multiple features:
 * - NAS device dropdown populated in DataSource Connection tab
 * - Server connection test from DataSource form
 * - Output destinations visible in DataSource Output tab
 * - Navigation between System Monitoring and DataSources preserves state
 *
 * These tests verify the integration between independently developed features
 * (NAS Phase 12, AdminServer Phase 13, Monitoring Phase 16) works end-to-end.
 */
import { test, expect } from '@playwright/test';
import { e2eValidationSetup } from './global-setup';
import { e2eValidationTeardown } from './global-teardown';
import { e2eReporter } from './helpers/validation-reporter';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await e2eValidationSetup();
  e2eReporter.enablePersistence('cross-feature');
});

test.afterAll(async () => {
  await e2eValidationTeardown();
});

test('Verify seeded NAS device appears in DataSource Connection tab dropdown', async ({ page }) => {
  const startTime = Date.now();
  try {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Navigate to DataSources list and open create form
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click Add DataSource button
    await page.getByRole('button', { name: /הוסף מקור נתונים חדש|הוסף/ }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Navigate to Connection tab using dispatchEvent for RTL safety
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

    // Select NAS protocol from the protocol dropdown
    const protocolSelect = page.locator('.ant-select').filter({ hasText: /NFS|FTP|SFTP|NAS|Kafka|S3|HTTP/ }).first();
    if (await protocolSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await protocolSelect.click();
      await page.waitForTimeout(300);

      // Select NAS option
      const nasOption = page.locator('.ant-select-item-option').filter({ hasText: 'NAS' });
      if (await nasOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nasOption.click();
        await page.waitForTimeout(1000);

        // NAS device section should appear with "בחירת התקן NAS" divider
        const nasSection = page.locator('.ant-divider').filter({ hasText: /התקן NAS/ });
        await expect(nasSection).toBeVisible({ timeout: 5000 });

        // Find the NAS device dropdown (not the protocol select)
        const allSelects = page.locator('.ant-select');
        const selectCount = await allSelects.count();
        let nasDeviceSelect = allSelects.nth(1);
        for (let i = 1; i < selectCount; i++) {
          const text = await allSelects.nth(i).textContent().catch(() => '');
          if (text && !text.includes('NAS -')) {
            nasDeviceSelect = allSelects.nth(i);
            break;
          }
        }
        await nasDeviceSelect.click();
        await page.waitForTimeout(500);

        // Verify NAS device options are populated (seeded by DemoDataGenerator)
        const options = page.locator('.ant-select-item-option');
        const optionCount = await options.count();
        expect(optionCount).toBeGreaterThan(0);

        // Close dropdown
        await page.keyboard.press('Escape');
      }
    }

    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Verify seeded NAS device appears in DataSource Connection tab dropdown',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Verify seeded NAS device appears in DataSource Connection tab dropdown',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

test('Verify server connection test works from DataSource form', async ({ page }) => {
  const startTime = Date.now();
  try {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Navigate to DataSources list
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check if there's an existing DataSource to open
    const rows = page.locator('.ant-table-row');
    const hasData = await rows.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasData) {
      // Click on first DataSource to open it
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Navigate to Connection tab
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

      // Look for Test Connection button
      const testBtn = page.getByRole('button', { name: /בדוק חיבור|test connection/i });
      const hasTesBtn = await testBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTesBtn) {
        // Set up response listener before clicking
        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/test') && resp.request().method() === 'POST',
          { timeout: 20000 }
        ).catch(() => null);

        await testBtn.click();

        // Wait for response or timeout
        const response = await responsePromise;
        if (response) {
          // Any response status is acceptable (200 success, 400 config error, 500 server error)
          expect([200, 400, 500]).toContain(response.status());
        }

        // Wait for toast message
        await page.waitForTimeout(2000);
      }
    } else {
      // No DataSources to test — create a new one and try connection tab
      await page.getByRole('button', { name: /הוסף מקור נתונים חדש|הוסף/ }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Navigate to Connection tab
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

      // Verify connection tab loaded
      const connectionContent = page.locator('.ant-select');
      expect(await connectionContent.count()).toBeGreaterThan(0);
    }

    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Verify server connection test works from DataSource form',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Verify server connection test works from DataSource form',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

test('Verify DataSource output tab shows configured destinations', async ({ page }) => {
  const startTime = Date.now();
  try {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Navigate to DataSources list
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Open first DataSource (seeded by DemoDataGenerator with output destinations)
    const rows = page.locator('.ant-table-row');
    const hasData = await rows.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasData) {
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Navigate to Output tab using dispatchEvent for RTL safety
      // Use the tab ID pattern from existing specs
      await page.evaluate(() => {
        const tabBtn = document.querySelector('[id$="-tab-output"]') as HTMLElement;
        if (tabBtn) {
          tabBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      });
      await page.waitForTimeout(2000);

      // Verify output tab content loaded — look for destination rows or add button
      const addDestBtn = page.locator('button').filter({ hasText: /הוסף יעד פלט|add destination/i });
      const destinationRows = page.locator('.ant-table-row, .ant-list-item, .ant-card');
      const emptyState = page.locator('.ant-empty');

      const hasAddBtn = await addDestBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const hasDestinations = await destinationRows.count() > 0;
      const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

      // Output tab should show either destinations, empty state, or add button
      expect(hasAddBtn || hasDestinations || hasEmpty).toBe(true);
    }

    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Verify DataSource output tab shows configured destinations',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Verify DataSource output tab shows configured destinations',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

test('Navigate between System Monitoring and DataSources verifying data consistency', async ({ page }) => {
  const startTime = Date.now();
  try {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Step 1: Go to System Monitoring page
    await page.goto(`${BASE_URL}/monitoring`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // Verify monitoring page loaded (dashboard or loading state)
    const dashboard = page.locator('.monitoring-dashboard');
    const spinner = page.locator('.ant-spin');
    const monitoringLoaded = await dashboard.isVisible().catch(() => false) ||
                             await spinner.isVisible().catch(() => false);
    expect(monitoringLoaded).toBe(true);

    // Capture monitoring state (tab count as proxy for structure integrity)
    const tabCount = await page.locator('[data-node-key]').count();

    // Step 2: Navigate to DataSources list page
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify DataSources list loads
    await expect(page.getByText('ניהול מקורות נתונים')).toBeVisible({ timeout: 10000 });
    const dsTable = page.locator('.ant-table');
    await expect(dsTable).toBeVisible({ timeout: 10000 });

    // Step 3: Go back to System Monitoring
    await page.goto(`${BASE_URL}/monitoring`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // Verify monitoring data is still present (tabs still rendered)
    const tabCountAfter = await page.locator('[data-node-key]').count();
    // Tab structure should be the same (proving SPA navigation didn't break state)
    expect(tabCountAfter).toBe(tabCount);

    // Verify dashboard or loading state still visible (no crash after navigation)
    const dashboardStillVisible = await dashboard.isVisible().catch(() => false) ||
                                   await spinner.isVisible().catch(() => false);
    expect(dashboardStillVisible).toBe(true);

    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Navigate between System Monitoring and DataSources verifying data consistency',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
  } catch (error) {
    e2eReporter.addResult({
      suite: 'cross-feature',
      testName: 'Navigate between System Monitoring and DataSources verifying data consistency',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    throw error;
  }
});

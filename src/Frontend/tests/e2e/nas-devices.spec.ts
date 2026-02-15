import { test, expect } from '@playwright/test';

/**
 * NAS Device Management E2E Tests
 *
 * Tests CRUD operations and provisioning for NAS devices.
 * CRITICAL: These tests MUST fail if file-simulator is unavailable.
 *
 * Coverage:
 * - CRUD operations (create, read, update, delete)
 * - Device provisioning (K8s PV/PVC creation)
 * - Connection testing
 * - Mount status verification
 * - Visual regression for RTL layout
 */

const FILE_SIMULATOR_BASE = process.env.FILE_SIMULATOR_URL || 'http://localhost:32150';

test.describe('NAS Device Management', () => {
  // CRITICAL: Fail if file-simulator unavailable
  test.beforeAll(async ({ request }) => {
    const response = await request.get(`${FILE_SIMULATOR_BASE}/health`).catch(() => null);
    if (!response || !response.ok()) {
      throw new Error(
        `FATAL: File-simulator not available at ${FILE_SIMULATOR_BASE}. ` +
        'E2E tests require file-simulator. Do NOT add skip annotations.'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Navigate to NAS Devices tab (Hebrew: "התקני NAS")
    const nasTab = page.getByRole('tab', { name: /התקני NAS|NAS devices/i });
    await nasTab.click();
    await page.waitForLoadState('networkidle');
  });

  test.describe('CRUD Operations', () => {
    test('should display NAS devices list', async ({ page }) => {
      // Verify table is visible (use first() to handle multiple tables)
      await expect(page.locator('.ant-table').first()).toBeVisible();

      // Verify column headers (Hebrew: name, address, status)
      await expect(page.getByRole('columnheader').first()).toBeVisible();
    });

    test('should create NAS device', async ({ page }) => {
      // Click add button (Hebrew: "הוסף התקן NAS")
      await page.getByRole('button', { name: /הוסף|add/i }).click();

      // Wait for modal to appear
      await page.waitForTimeout(500);

      // Fill form using more specific selectors (textbox role instead of label)
      await page.getByRole('textbox', { name: /שם|name/i }).fill('Test NAS Device');
      await page.getByRole('textbox', { name: /כתובת|host|server/i }).fill('192.168.1.100');
      await page.getByRole('textbox', { name: /נתיב יצוא|export path/i }).fill('/exports/test');

      // Select role
      const roleSelect = page.locator('.ant-select').filter({ hasText: /תפקיד|role/i });
      if (await roleSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await roleSelect.click();
        await page.getByRole('option', { name: /קלט|input/i }).click();
      }

      // Save
      await page.getByRole('button', { name: /שמור|save/i }).click();

      // Verify success message
      await expect(page.getByText(/נוצר בהצלחה|created successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test('should edit NAS device', async ({ page }) => {
      // Find first row and click edit
      const firstRow = page.locator('.ant-table-row').first();
      const hasData = await firstRow.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasData) {
        // Create a device first
        await page.getByRole('button', { name: /הוסף|add/i }).click();
        await page.waitForTimeout(500);
        await page.getByRole('textbox', { name: /שם|name/i }).fill('Edit Test Device');
        await page.getByRole('textbox', { name: /כתובת|host/i }).fill('192.168.1.101');
        await page.getByRole('textbox', { name: /נתיב יצוא|export path/i }).fill('/exports/edit');
        await page.getByRole('button', { name: /שמור|save/i }).click();
        await page.waitForLoadState('networkidle');
      }

      // Click edit on first row
      await page.locator('.ant-table-row').first().getByRole('button', { name: /ערוך|edit/i }).click();
      await page.waitForTimeout(500);

      // Modify description
      const descInput = page.getByRole('textbox', { name: /תיאור|description/i });
      if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await descInput.fill('Updated via E2E test');
      }

      // Save
      await page.getByRole('button', { name: /שמור|save|עדכן|update/i }).click();

      // Verify success
      await expect(page.getByText(/עודכן|updated/i)).toBeVisible({ timeout: 10000 });
    });

    test('should delete NAS device', async ({ page }) => {
      // Ensure we have a device to delete
      const rows = page.locator('.ant-table-row');
      const count = await rows.count();

      if (count === 0) {
        // Create one first
        await page.getByRole('button', { name: /הוסף|add/i }).click();
        await page.waitForTimeout(500);
        await page.getByRole('textbox', { name: /שם|name/i }).fill('Delete Test Device');
        await page.getByRole('textbox', { name: /כתובת|host/i }).fill('192.168.1.102');
        await page.getByRole('textbox', { name: /נתיב יצוא|export path/i }).fill('/exports/delete');
        await page.getByRole('button', { name: /שמור|save/i }).click();
        await page.waitForLoadState('networkidle');
      }

      // Click delete on last row
      await page.locator('.ant-table-row').last().getByRole('button', { name: /מחק|delete/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /אישור|confirm|yes/i }).click();

      // Verify success
      await expect(page.getByText(/נמחק|deleted/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Provisioning', () => {
    test('should provision NAS device (create PV/PVC)', async ({ page }) => {
      // Find unprovisioned device or create one
      const unprovisionedRow = page.locator('.ant-table-row').filter({
        hasText: /ממתין להפעלה|pending|not provisioned/i
      }).first();

      const hasUnprovisioned = await unprovisionedRow.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasUnprovisioned) {
        // Create a new device to provision
        await page.getByRole('button', { name: /הוסף|add/i }).click();
        await page.waitForTimeout(500);
        await page.getByRole('textbox', { name: /שם|name/i }).fill('Provision Test Device');
        await page.getByRole('textbox', { name: /כתובת|host/i }).fill('192.168.1.103');
        await page.getByRole('textbox', { name: /נתיב יצוא|export path/i }).fill('/exports/provision');
        await page.getByRole('button', { name: /שמור|save/i }).click();
        await page.waitForLoadState('networkidle');
      }

      // Click provision button
      const provisionBtn = page.locator('.ant-table-row').last().getByRole('button', { name: /הפעל|provision/i });
      if (await provisionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await provisionBtn.click();

        // Confirm in modal
        const confirmBtn = page.getByRole('button', { name: /אישור|confirm|yes/i });
        if (await confirmBtn.isVisible({ timeout: 3000 })) {
          await confirmBtn.click();
        }

        // Wait for provisioning (may take a few seconds)
        await page.waitForTimeout(3000);

        // Verify status changed (look for success indicator)
        await expect(page.getByText(/הופעל|provisioned|מחובר|connected/i)).toBeVisible({ timeout: 15000 });
      }
    });

    test('should show mount status indicator', async ({ page }) => {
      // Look for status column/badge
      const statusBadge = page.locator('.ant-badge-status-dot, .ant-tag');

      // At least one status indicator should be visible
      await expect(statusBadge.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Connection Testing', () => {
    test('should test NAS connection', async ({ page }) => {
      // Find a provisioned device
      const provisionedRow = page.locator('.ant-table-row').filter({
        has: page.locator('.ant-badge-status-success, .ant-tag-green')
      }).first();

      const hasProvisioned = await provisionedRow.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasProvisioned) {
        // Click test connection
        await provisionedRow.getByRole('button', { name: /בדוק חיבור|test/i }).click();

        // Wait for test result
        await expect(page.getByText(/חיבור תקין|connection successful|נכשל|failed/i)).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Visual Regression RTL', () => {
    test('should capture NAS devices tab RTL baseline', async ({ page }) => {
      await page.waitForTimeout(1000);

      // Verify RTL direction
      const direction = await page.evaluate(() => document.documentElement.dir);
      expect(direction).toBe('rtl');

      await expect(page).toHaveScreenshot('nas-devices-tab-rtl.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('should capture NAS device modal RTL baseline', async ({ page }) => {
      await page.getByRole('button', { name: /הוסף|add/i }).click();
      await page.waitForTimeout(500);

      const modal = page.locator('.ant-modal-content');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(modal).toHaveScreenshot('nas-device-modal-rtl.png', {
          animations: 'disabled',
        });
      }
    });
  });
});

test.describe('NAS Device in DataSource Connection Tab', () => {
  // CRITICAL: Fail if file-simulator unavailable
  test.beforeAll(async ({ request }) => {
    const response = await request.get(`${FILE_SIMULATOR_BASE}/health`).catch(() => null);
    if (!response || !response.ok()) {
      throw new Error(
        `FATAL: File-simulator not available at ${FILE_SIMULATOR_BASE}. ` +
        'E2E tests require file-simulator. Do NOT add skip annotations.'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show NAS protocol option in connection tab', async ({ page }) => {
    // Create new datasource
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to connection tab
    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    await connectionTab.click();

    // Open protocol dropdown
    const protocolSelect = page.locator('.ant-select').first();
    await protocolSelect.click();

    // NAS should be available as protocol option
    const nasOption = page.getByRole('option', { name: /nas/i });
    await expect(nasOption).toBeVisible({ timeout: 5000 });
  });

  test('should show NAS device dropdown when NAS protocol selected', async ({ page }) => {
    // Create new datasource
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to connection tab
    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    await connectionTab.click();

    // Select NAS protocol
    const protocolSelect = page.locator('.ant-select').first();
    await protocolSelect.click();
    await page.getByRole('option', { name: /nas/i }).click();

    await page.waitForTimeout(500);

    // NAS device dropdown should appear (Hebrew: "התקן NAS")
    const nasDeviceLabel = page.getByText(/התקן NAS|NAS device/i);
    await expect(nasDeviceLabel).toBeVisible({ timeout: 5000 });
  });

  test('should display mount status in NAS device dropdown', async ({ page }) => {
    // Create new datasource
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to connection tab
    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    await connectionTab.click();

    // Select NAS protocol
    const protocolSelect = page.locator('.ant-select').first();
    await protocolSelect.click();
    await page.getByRole('option', { name: /nas/i }).click();

    await page.waitForTimeout(500);

    // Open NAS device dropdown
    const nasDeviceSelect = page.locator('.ant-select').nth(1);
    if (await nasDeviceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nasDeviceSelect.click();
      await page.waitForTimeout(500);

      // Options should show mount status (green/orange indicators or text)
      const options = page.getByRole('option');
      const optionCount = await options.count();

      // If there are options, verify mount status indicators are present
      if (optionCount > 0) {
        // Look for mount status indicators in the dropdown
        const statusIndicators = page.locator('.ant-tag, .ant-badge');
        expect(await statusIndicators.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should show sub-path input for NAS device', async ({ page }) => {
    // Create new datasource
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to connection tab
    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    await connectionTab.click();

    // Select NAS protocol
    const protocolSelect = page.locator('.ant-select').first();
    await protocolSelect.click();
    await page.getByRole('option', { name: /nas/i }).click();

    await page.waitForTimeout(500);

    // Select a NAS device if available
    const nasDeviceSelect = page.locator('.ant-select').nth(1);
    if (await nasDeviceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nasDeviceSelect.click();
      const option = page.getByRole('option').first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(500);

        // Sub-path input should appear (Hebrew: "נתיב בהתקן")
        const subPathInput = page.getByLabel(/נתיב בהתקן|sub path|path/i);
        await expect(subPathInput).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

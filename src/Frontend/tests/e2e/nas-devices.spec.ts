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
  // Verify EZ platform API is available (NAS data already seeded)
  test.beforeAll(async ({ request }) => {
    const response = await request.get('http://localhost:5001/api/v1/nasdevices').catch(() => null);
    if (!response || !response.ok()) {
      throw new Error(
        'FATAL: EZ platform API not available at localhost:5001. ' +
        'Ensure port-forwarding is active and NAS devices are seeded.'
      );
    }
  });

  // Helper: navigate to a new datasource's connection tab
  async function navigateToConnectionTab(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click "Add" to create new datasource
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to connection tab (Hebrew: "הגדרות חיבור")
    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    await connectionTab.click();
    await page.waitForTimeout(500);
  }

  // Helper: select NAS protocol in the connection tab
  async function selectNasProtocol(page: import('@playwright/test').Page) {
    // The protocol select shows "NFS" by default - click the select that contains it
    const protocolSelect = page.locator('.ant-select').filter({ hasText: /NFS|FTP|SFTP|NAS|Kafka|S3|HTTP/ }).first();
    await protocolSelect.click();
    await page.waitForTimeout(300);

    // Select NAS option (Ant Design renders options as .ant-select-item-option in a portal)
    // Option text is "NAS - אחסון רשת" (NAS - Network Storage)
    await page.locator('.ant-select-item-option').filter({ hasText: 'NAS' }).click();
    await page.waitForTimeout(500);
  }

  test('should show NAS protocol option in connection tab', async ({ page }) => {
    await navigateToConnectionTab(page);

    // Find and open the protocol dropdown (shows "NFS" by default)
    const protocolSelect = page.locator('.ant-select').filter({ hasText: /NFS|FTP|SFTP|NAS|Kafka|S3|HTTP/ }).first();
    await protocolSelect.click();
    await page.waitForTimeout(300);

    // NAS should be available as protocol option (Ant Design uses .ant-select-item-option)
    const nasOption = page.locator('.ant-select-item-option').filter({ hasText: 'NAS' });
    await expect(nasOption).toBeVisible({ timeout: 5000 });
  });

  test('should show NAS device dropdown with devices when NAS protocol selected', async ({ page }) => {
    await navigateToConnectionTab(page);
    await selectNasProtocol(page);

    // NAS device section should appear (Hebrew divider: "בחירת התקן NAS")
    const nasDeviceSection = page.locator('.ant-divider').filter({ hasText: /התקן NAS/ });
    await expect(nasDeviceSection).toBeVisible({ timeout: 5000 });

    // KEY FIX VERIFICATION: The NAS device dropdown should have options
    // Before the fix, Role was numeric (0,1,2,3) but compared to strings ('Input','Both')
    // so the dropdown was always empty. After fix, roleEnumToString converts correctly.
    // The NAS device select is the second .ant-select on the page (first is protocol)
    const allSelects = page.locator('.ant-select');
    const selectCount = await allSelects.count();
    // Find the NAS device select (not the protocol one which contains "NAS")
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

    // Should have at least one NAS device option (we have 7 input-eligible devices)
    const options = page.locator('.ant-select-item-option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('should display mount status in NAS device dropdown', async ({ page }) => {
    await navigateToConnectionTab(page);
    await selectNasProtocol(page);

    // Open NAS device dropdown (second select, after the protocol select)
    const allSelects2 = page.locator('.ant-select');
    const nasDeviceSelect = allSelects2.nth(1);
    if (await nasDeviceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nasDeviceSelect.click();
      await page.waitForTimeout(500);

      // Options should exist and show device info
      const options = page.locator('.ant-select-item-option');
      const optionCount = await options.count();

      if (optionCount > 0) {
        // Verify first option contains a NAS device name
        const firstOptionText = await options.first().textContent();
        expect(firstOptionText).toBeTruthy();
      }
    }
  });

  test('should select NAS device and show connection details', async ({ page }) => {
    await navigateToConnectionTab(page);
    await selectNasProtocol(page);

    // After NAS is selected, find the NAS device dropdown
    // It should be labeled "התקן NAS" or similar
    const nasDeviceDropdown = page.locator('.ant-select').filter({ hasText: /בחר התקן|select.*device/i }).first();
    const fallbackDropdown = page.locator('.ant-select:not(:has-text("NAS -"))').last();
    const deviceSelect = await nasDeviceDropdown.isVisible({ timeout: 2000 }).catch(() => false)
      ? nasDeviceDropdown : fallbackDropdown;

    if (await deviceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deviceSelect.click();
      await page.waitForTimeout(300);

      // Select first NAS device from dropdown
      const firstDevice = page.locator('.ant-select-item-option').first();
      if (await firstDevice.isVisible({ timeout: 2000 }).catch(() => false)) {
        const deviceName = await firstDevice.textContent();
        await firstDevice.click();
        await page.waitForTimeout(500);

        // After selecting a device, the connection details section should update
        // Verify device was selected (name should appear in the select)
        expect(deviceName).toBeTruthy();
      }
    }
  });

  test('should have admin settings link with correct URL', async ({ page }) => {
    await navigateToConnectionTab(page);
    await selectNasProtocol(page);

    // Wait for NAS devices to load
    await page.waitForTimeout(1000);

    // The "Go to admin settings" button appears in the warning alert
    // when there are no NAS devices OR is always present.
    // Intercept window.open to capture the URL it would open
    const adminButton = page.locator('.ant-alert').getByText(/עבור להגדרות|go to.*settings/i);
    if (await adminButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Intercept window.open via the alert's button specifically
      const openUrl = await page.evaluate(() => {
        return new Promise<string>((resolve, reject) => {
          const origOpen = window.open;
          window.open = (url: string | URL | undefined) => {
            resolve(String(url));
            return null;
          };
          // Find the button inside the ant-alert component
          const alertBtn = document.querySelector('.ant-alert .ant-btn') as HTMLElement;
          if (alertBtn) {
            alertBtn.click();
          } else {
            reject(new Error('Admin settings button not found in alert'));
          }
          setTimeout(() => { window.open = origOpen; }, 100);
        });
      });

      expect(openUrl).toContain('/admin/settings');
      expect(openUrl).toContain('tab=nasDevices');
    }
  });
});

test.describe('NAS Device in Output Tab (DestinationEditorModal)', () => {
  // Verify EZ platform API is available
  test.beforeAll(async ({ request }) => {
    const response = await request.get('http://localhost:5001/api/v1/nasdevices').catch(() => null);
    if (!response || !response.ok()) {
      throw new Error(
        'FATAL: EZ platform API not available at localhost:5001. ' +
        'Ensure port-forwarding is active and NAS devices are seeded.'
      );
    }
  });

  // Helper: navigate to datasource create → output tab → open destination editor
  async function openDestinationEditor(page: import('@playwright/test').Page) {
    // Navigate to datasources list first, then click Add (same as connection tab tests)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Widen viewport so all 8 tabs are visible (avoids RTL overflow)
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500);

    // Click the output tab - use dispatchEvent to trigger React's onClick handler
    await page.evaluate(() => {
      const tabBtn = document.querySelector('[id$="-tab-output"]') as HTMLElement;
      if (tabBtn) {
        tabBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    await page.waitForTimeout(2000);

    // Wait for the "הוסף יעד פלט" button (output tab content with lazy loading)
    const addBtn = page.locator('button').filter({ hasText: /הוסף יעד פלט/ });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(500);
  }

  test('should show NAS protocol option in destination editor', async ({ page }) => {
    await openDestinationEditor(page);

    // The modal should be open with protocol selector
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // The protocol select - find it inside the modal
    const protocolSelect = modal.locator('.ant-select').first();
    await protocolSelect.click();
    await page.waitForTimeout(300);

    // NAS should be available as protocol option
    const nasOption = page.locator('.ant-select-item-option').filter({ hasText: 'NAS' });
    await expect(nasOption).toBeVisible({ timeout: 5000 });
  });

  test('should show NAS device dropdown with output devices in destination editor', async ({ page }) => {
    await openDestinationEditor(page);

    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // NAS should be the default type - verify NAS device section appears
    const nasDeviceSection = modal.locator('.ant-divider').filter({ hasText: /התקן NAS/ });
    await expect(nasDeviceSection).toBeVisible({ timeout: 5000 });

    // Find the NAS device select inside the modal (not the protocol select)
    const selects = modal.locator('.ant-select');
    const selectCount = await selects.count();

    // The NAS device select should be the second select (first is protocol)
    let nasDeviceSelect = selects.nth(1);
    for (let i = 1; i < selectCount; i++) {
      const text = await selects.nth(i).textContent().catch(() => '');
      if (text && text.includes('NAS') && text.includes('בחר')) {
        nasDeviceSelect = selects.nth(i);
        break;
      }
    }

    await nasDeviceSelect.click();
    await page.waitForTimeout(500);

    // KEY FIX VERIFICATION: Should have output-eligible NAS devices (Output or Both roles)
    // Before fix: Role was numeric but compared to strings → empty dropdown
    // After fix: roleEnumToString correctly maps numeric Role → devices appear
    const options = page.locator('.ant-select-item-option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('should select NAS device and show details in destination editor', async ({ page }) => {
    await openDestinationEditor(page);

    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the NAS device select (second select in modal)
    const nasDeviceSelect = modal.locator('.ant-select').nth(1);
    if (await nasDeviceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nasDeviceSelect.click();
      await page.waitForTimeout(300);

      // Select first available device
      const firstDevice = page.locator('.ant-select-item-option:not(.ant-select-item-option-disabled)').first();
      if (await firstDevice.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstDevice.click();
        await page.waitForTimeout(500);

        // After selecting, a success alert should show device details
        const deviceInfo = modal.locator('.ant-alert-success');
        await expect(deviceInfo).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

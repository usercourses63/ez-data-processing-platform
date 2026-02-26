/**
 * Playwright page helpers for UI interactions with the EZ platform.
 * Handles Ant Design RTL quirks, tab click issues, and form interactions.
 *
 * Known gotchas addressed:
 * - Ant Design tab .click() doesn't trigger React state change in RTL
 * - Select components drop values set before options load
 * - Card tabs with icons have leading spaces in textContent
 * - RTL overflow pushes tabs offscreen at narrow viewports
 */
import { Page, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';

// ============================================================
// Server Management UI
// ============================================================

export interface ServerUIData {
  name: string;
  type: string;
  host: string;
  port: number;
  direction?: string;
  credentials?: {
    username: string;
    password: string;
  };
  basePath?: string;
}

/**
 * Add an admin server via the System Settings UI.
 * Navigates to Settings -> Input Servers tab, opens the Add dialog, fills the form, and saves.
 */
export async function addServerViaUI(page: Page, server: ServerUIData): Promise<void> {
  // Navigate to admin settings
  await page.goto(`${BASE_URL}/admin/settings`);
  await page.waitForLoadState('networkidle');

  // Set wide viewport to prevent RTL tab overflow
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(500);

  // Click the Input Servers tab - use data-node-key to avoid RTL click issues
  const serversTab = page.locator('[data-node-key="servers"]');
  if (await serversTab.count() > 0) {
    await clickAntTab(page, '[data-node-key="servers"]');
  } else {
    // Fallback: try role-based selector
    const tab = page.getByRole('tab', { name: /שרתי קלט|input servers/i });
    await clickAntTab(page, tab);
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Click Add button
  const addButton = page.getByRole('button', { name: /הוסף שרת|add server/i });
  await addButton.click();
  await page.waitForTimeout(500);

  // Wait for modal to appear
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Fill server name
  const nameInput = modal.locator('#Name, input[id="Name"]');
  if (await nameInput.count() > 0) {
    await nameInput.fill(server.name);
  }

  // Select server type
  const typeSelect = modal.locator('#ServerType, [id="ServerType"]').first();
  if (await typeSelect.count() > 0) {
    await typeSelect.click();
    await page.waitForTimeout(300);
    const option = page.locator(`.ant-select-item-option[title="${server.type}"]`).first();
    if (await option.count() > 0) {
      await option.click();
    } else {
      // Try case-insensitive match
      const options = page.locator('.ant-select-item-option');
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text?.toLowerCase().includes(server.type.toLowerCase())) {
          await options.nth(i).click();
          break;
        }
      }
    }
    await page.waitForTimeout(300);
  }

  // Fill host
  const hostInput = modal.locator('#Host, input[id="Host"]');
  if (await hostInput.count() > 0) {
    await hostInput.fill(server.host);
  }

  // Fill port
  const portInput = modal.locator('#Port, input[id="Port"]');
  if (await portInput.count() > 0) {
    await portInput.fill(String(server.port));
  }

  // Fill base path if provided
  if (server.basePath) {
    const basePathInput = modal.locator('#BasePath, input[id="BasePath"]');
    if (await basePathInput.count() > 0) {
      await basePathInput.fill(server.basePath);
    }
  }

  // Fill credentials in TypeSpecificConfig if provided
  if (server.credentials) {
    const usernameInput = modal.locator('input[id*="Username"], input[id*="username"]');
    if (await usernameInput.count() > 0) {
      await usernameInput.fill(server.credentials.username);
    }
    const passwordInput = modal.locator('input[id*="Password"], input[id*="password"]');
    if (await passwordInput.count() > 0) {
      await passwordInput.fill(server.credentials.password);
    }
  }

  // Submit the form
  const submitButton = modal.locator('.ant-modal-footer .ant-btn-primary');
  await submitButton.click();
  await page.waitForTimeout(2000);
}

// ============================================================
// NAS Device Management UI
// ============================================================

export interface NasDeviceUIData {
  name: string;
  host: string;
  exportPath: string;
  port?: number;
  role?: string;
  description?: string;
}

/**
 * Add a NAS device via the System Settings UI.
 */
export async function addNasDeviceViaUI(page: Page, device: NasDeviceUIData): Promise<void> {
  // Navigate to admin settings NAS tab
  await page.goto(`${BASE_URL}/admin/settings`);
  await page.waitForLoadState('networkidle');

  // Set wide viewport
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(500);

  // Click the NAS Devices tab
  const nasTab = page.locator('[data-node-key="nasDevices"]');
  if (await nasTab.count() > 0) {
    await clickAntTab(page, '[data-node-key="nasDevices"]');
  } else {
    const tab = page.getByRole('tab', { name: /התקני NAS|NAS devices/i });
    await clickAntTab(page, tab);
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Click Add NAS Device button
  const addButton = page.getByRole('button', { name: /הוסף התקן NAS|add NAS/i });
  await addButton.click();
  await page.waitForTimeout(500);

  // Wait for modal
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Fill required fields
  const nameInput = modal.locator('#Name, input[id="Name"]');
  if (await nameInput.count() > 0) {
    await nameInput.fill(device.name);
  }

  const hostInput = modal.locator('#Host, input[id="Host"]');
  if (await hostInput.count() > 0) {
    await hostInput.fill(device.host);
  }

  const exportPathInput = modal.locator('#ExportPath, input[id="ExportPath"]');
  if (await exportPathInput.count() > 0) {
    await exportPathInput.fill(device.exportPath);
  }

  // Select role if provided
  if (device.role) {
    const roleSelect = modal.locator('#Role, [id="Role"]').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.click();
      await page.waitForTimeout(300);
      const option = page.locator(`.ant-select-item-option`).filter({ hasText: device.role });
      if (await option.count() > 0) {
        await option.first().click();
      }
      await page.waitForTimeout(300);
    }
  }

  // Submit
  const submitButton = modal.locator('.ant-modal-footer .ant-btn-primary');
  await submitButton.click();
  await page.waitForTimeout(2000);
}

/**
 * Provision a NAS device via the UI by clicking its provision button in the table.
 */
export async function provisionNasViaUI(page: Page, deviceName: string): Promise<void> {
  // Find the row containing the device name
  const row = page.locator('.ant-table-row').filter({ hasText: deviceName });
  await expect(row).toBeVisible({ timeout: 5000 });

  // Click the provision button in that row
  const provisionButton = row.getByRole('button', { name: /הפעלה|provision/i });
  if (await provisionButton.count() > 0) {
    await provisionButton.click();
    await page.waitForTimeout(1000);

    // Confirm the provision dialog if one appears
    const confirmButton = page.locator('.ant-modal-confirm-btns .ant-btn-primary, .ant-popconfirm-buttons .ant-btn-primary');
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }
    await page.waitForTimeout(3000);
  }
}

/**
 * Delete a server via the UI
 */
export async function deleteServerViaUI(page: Page, serverName: string): Promise<void> {
  await page.goto(`${BASE_URL}/admin/settings`);
  await page.waitForLoadState('networkidle');
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(500);

  // Navigate to servers tab
  const serversTab = page.locator('[data-node-key="servers"]');
  if (await serversTab.count() > 0) {
    await clickAntTab(page, '[data-node-key="servers"]');
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Find row and click delete
  const row = page.locator('.ant-table-row').filter({ hasText: serverName });
  if (await row.count() > 0) {
    const deleteButton = row.getByRole('button', { name: /מחק|delete/i });
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Confirm deletion
      const confirmButton = page.locator('.ant-modal-confirm-btns .ant-btn-primary, .ant-popconfirm-buttons .ant-btn-primary, .ant-btn-dangerous');
      if (await confirmButton.count() > 0) {
        await confirmButton.first().click();
      }
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Delete a NAS device via the UI
 */
export async function deleteNasDeviceViaUI(page: Page, deviceName: string): Promise<void> {
  await page.goto(`${BASE_URL}/admin/settings`);
  await page.waitForLoadState('networkidle');
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(500);

  // Navigate to NAS tab
  const nasTab = page.locator('[data-node-key="nasDevices"]');
  if (await nasTab.count() > 0) {
    await clickAntTab(page, '[data-node-key="nasDevices"]');
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Find row and click delete
  const row = page.locator('.ant-table-row').filter({ hasText: deviceName });
  if (await row.count() > 0) {
    const deleteButton = row.getByRole('button', { name: /מחק|delete/i });
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Confirm deletion
      const confirmButton = page.locator('.ant-modal-confirm-btns .ant-btn-primary, .ant-popconfirm-buttons .ant-btn-primary, .ant-btn-dangerous');
      if (await confirmButton.count() > 0) {
        await confirmButton.first().click();
      }
      await page.waitForTimeout(1000);
    }
  }
}

// ============================================================
// Ant Design Helpers (RTL-safe)
// ============================================================

/**
 * Click an Ant Design tab safely in RTL mode.
 * Standard .click() doesn't trigger React state change on Ant Design tabs.
 * Uses dispatchEvent with MouseEvent for reliable tab switching.
 */
async function clickAntTab(page: Page, selectorOrLocator: string | ReturnType<Page['locator']>): Promise<void> {
  if (typeof selectorOrLocator === 'string') {
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    }, selectorOrLocator);
  } else {
    await selectorOrLocator.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await page.waitForTimeout(500);
}

/**
 * Wait for Ant Design Select options to be loaded.
 * Useful when options come from async API calls (useQuery).
 */
export async function waitForSelectOptions(
  page: Page,
  selectSelector: string,
  timeoutMs: number = 5000
): Promise<void> {
  await page.locator(selectSelector).click();
  await page.waitForSelector('.ant-select-item-option', { timeout: timeoutMs });
  // Close the dropdown
  await page.keyboard.press('Escape');
}

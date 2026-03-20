import { test, expect } from '@playwright/test';

/**
 * Verification tests for NAS UX remaining work items.
 * Tests: status tags, delete deprovision, admin server sync, category sync.
 */

test.describe('NAS UX Verification Tests', () => {

  // ============ TEST 1: NAS Status Tags ============
  test.describe('Item 1: NAS Status Tags', () => {

    test('should show provision status tags next to device name', async ({ page }) => {
      await page.goto('/admin/settings?tab=nasDevices');
      await page.waitForLoadState('networkidle');
      await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

      const firstCell = page.locator('.ant-table-row').first().locator('td').first();
      const tags = firstCell.locator('.ant-tag');
      const tagCount = await tags.count();
      expect(tagCount).toBeGreaterThanOrEqual(1);

      const allTagTexts = await tags.allTextContents();
      console.log('[TEST 1] Status tags in first row:', allTagTexts);

      const hasExpectedTag = allTagTexts.some(t =>
        t.includes('PVC') || t.includes('PV') || t.includes('מוקצה') || t.includes('Provisioned')
      );
      expect(hasExpectedTag).toBe(true);
    });

    test('should show connection status tags (connected/disconnected)', async ({ page }) => {
      await page.goto('/admin/settings?tab=nasDevices');
      await page.waitForLoadState('networkidle');
      await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

      const allTags = page.locator('.ant-table-row td:first-child .ant-tag');
      const allTagTexts = await allTags.allTextContents();
      console.log('[TEST 1b] All name-column tags:', allTagTexts);

      const hasConnectionTag = allTagTexts.some(t =>
        t === 'מחובר' || t === 'לא מחובר' || t === 'Connected' || t === 'Disconnected'
      );
      expect(hasConnectionTag).toBe(true);
    });

    test('should show detailed PV/PVC status in status column', async ({ page }) => {
      await page.goto('/admin/settings?tab=nasDevices');
      await page.waitForLoadState('networkidle');
      await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

      const statusTags = page.locator('.ant-table-row td:nth-child(6) .ant-tag');
      const statusTexts = await statusTags.allTextContents();
      console.log('[TEST 1c] Status column tags:', statusTexts);

      const hasPvTag = statusTexts.some(t => t.includes('PV'));
      expect(hasPvTag).toBe(true);
    });
  });

  // ============ TEST 2: Delete popconfirm ============
  test.describe('Item 2: Delete shows confirmation', () => {

    test('should show delete confirmation popover in Hebrew', async ({ page }) => {
      await page.goto('/admin/settings?tab=nasDevices');
      await page.waitForLoadState('networkidle');
      await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

      const initialRows = await page.locator('.ant-table-row').count();
      console.log('[TEST 2] Initial row count:', initialRows);

      const lastRow = page.locator('.ant-table-row').last();
      const deleteBtn = lastRow.locator('button').filter({ has: page.locator('.anticon-delete') });
      await deleteBtn.click();
      await page.waitForTimeout(500);

      const popconfirm = page.locator('.ant-popover').filter({ hasText: /מחיקת|מחק|delete/i });
      await expect(popconfirm).toBeVisible({ timeout: 3000 });
      console.log('[TEST 2] Delete popconfirm appeared');

      // Cancel
      await page.locator('body').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);

      const finalRows = await page.locator('.ant-table-row').count();
      expect(finalRows).toBe(initialRows);
      console.log('[TEST 2] Row count unchanged after cancel');
    });
  });

  // ============ TEST 3: Admin Servers SignalR ============
  test.describe('Item 4: Admin Servers EntityChanged', () => {

    test('should auto-refresh server list when server created via API', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');

      const consoleMessages: string[] = [];
      page.on('console', msg => {
        if (msg.text().includes('[EntitySync]')) {
          consoleMessages.push(msg.text());
        }
      });

      const serversTab = page.getByRole('tab', { name: /שרתי קלט|input servers/i });
      await serversTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      console.log('[TEST 3] Input Servers tab loaded');

      // Create server via API
      const testName = 'SignalR-Test-' + Date.now();
      const createResponse = await page.request.post('http://localhost:5001/api/v1/servers', {
        data: {
          Name: testName,
          ServerType: 'ftp',
          Direction: 0,
          Host: '192.168.1.99',
          Port: 21,
          BasePath: '/test',
          IsActive: true,
          ConnectionTimeoutSeconds: 30,
          RetryCount: 3
        }
      });

      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      console.log('[TEST 3] Created server:', created.ID);

      // Wait for SignalR
      await page.waitForTimeout(3000);

      console.log('[TEST 3] EntitySync messages:', consoleMessages);
      const hasServerBroadcast = consoleMessages.some(m => m.includes('AdminServer'));
      console.log('[TEST 3] AdminServer broadcast received:', hasServerBroadcast);
      expect(hasServerBroadcast).toBe(true);

      // Cleanup
      if (created.ID) {
        await page.request.delete('http://localhost:5001/api/v1/servers/' + created.ID);
        await page.waitForTimeout(2000);

        const deleteMessages = consoleMessages.filter(m => m.includes('AdminServer') && m.includes('deleted'));
        console.log('[TEST 3] Delete broadcast received:', deleteMessages.length > 0);
      }
    });
  });

  // ============ TEST 4: Categories SignalR ============
  test.describe('Item 5: Categories EntityChanged', () => {

    test('should auto-refresh categories when category created via API', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');

      const consoleMessages: string[] = [];
      page.on('console', msg => {
        if (msg.text().includes('[EntitySync]')) {
          consoleMessages.push(msg.text());
        }
      });

      const categoriesTab = page.getByRole('tab', { name: /קטגוריות|categories/i });
      await categoriesTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      console.log('[TEST 4] Categories tab loaded');

      const testName = 'Sync-Test-' + Date.now();
      const createResponse = await page.request.post('http://localhost:5001/api/v1/categories', {
        data: {
          Name: testName,
          NameEn: testName,
          Description: 'SignalR sync test',
          SortOrder: 999,
          IsActive: true
        }
      });

      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      console.log('[TEST 4] Created category:', created.ID);

      await page.waitForTimeout(3000);

      console.log('[TEST 4] EntitySync messages:', consoleMessages);
      const hasCategoryBroadcast = consoleMessages.some(m => m.includes('Category'));
      console.log('[TEST 4] Category broadcast received:', hasCategoryBroadcast);
      expect(hasCategoryBroadcast).toBe(true);

      // Cleanup
      if (created.ID) {
        await page.request.delete('http://localhost:5001/api/v1/categories/' + created.ID);
        await page.waitForTimeout(2000);

        const deleteMessages = consoleMessages.filter(m => m.includes('Category') && m.includes('deleted'));
        console.log('[TEST 4] Delete broadcast received:', deleteMessages.length > 0);
      }
    });
  });

  // ============ TEST 5: Deprovision API ============
  test.describe('Item 3: Deprovision API', () => {

    test('should return 404 for nonexistent device deprovision', async ({ page }) => {
      const response = await page.request.delete('http://localhost:5001/api/v1/nasdevices/nonexistent-id/provision');
      console.log('[TEST 5] Deprovision API status:', response.status());
      expect(response.status()).toBe(404);
    });
  });
});

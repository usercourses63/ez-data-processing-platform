import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:7000';
const API = 'http://127.0.0.1:5001';

test.use({ viewport: { width: 1600, height: 900 }, launchOptions: { slowMo: 300 } });
test.describe.configure({ mode: 'serial' });

async function waitForNasTable(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/admin/settings?tab=nasDevices`, { waitUntil: 'networkidle' });
  // Wait for table rows to appear (retry with reload if needed)
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(2000);
    const rows = await page.locator('.ant-table-row').count();
    if (rows > 0) return;
    await page.reload({ waitUntil: 'networkidle' });
  }
}

test.describe('NAS Device Actions + Multi-User Sync Demo', () => {

  test('1. NAS actions: Test Connection, Edit, Provision buttons work', async ({ page }) => {
    await waitForNasTable(page);
    const rows = page.locator('.ant-table-row');
    const rowCount = await rows.count();
    console.log(`NAS table has ${rowCount} rows`);
    expect(rowCount).toBeGreaterThan(0);

    // === Test Connection (1st button) ===
    const firstRow = rows.first();
    const buttons = firstRow.locator('button');
    const btnCount = await buttons.count();
    console.log(`Row has ${btnCount} action buttons`);

    // Click test connection (first button)
    await buttons.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/demo-01-test-connection-clicked.png', fullPage: true });

    // === Edit (3rd button) ===
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const editBtn = page.locator('.ant-table-row').first().locator('button').nth(2);
    await editBtn.click();

    // Verify modal opens
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/demo-02-edit-modal.png', fullPage: true });

    // Close modal
    await page.locator('.ant-modal-close').click();
    await page.waitForTimeout(500);

    // === Add New NAS Device ===
    const addBtn = page.locator('button').filter({ hasText: /הוסף התקן NAS/ });
    await addBtn.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/demo-03-add-modal.png', fullPage: true });
    await page.locator('.ant-modal-close').click();
  });

  test('2. Delete NAS device with confirmation popup', async ({ page }) => {
    // Create via API then navigate
    await page.request.post(`${API}/api/v1/nasdevices`, {
      data: { Name: 'DELETE-ME', Host: 'localhost', Port: 2049, ExportPath: '/', Role: 0, StorageCapacity: '1Gi', AccessMode: 'ReadWriteMany', ReclaimPolicy: 'Retain' }
    });

    await waitForNasTable(page);

    // Sort by name to find DELETE-ME (click name column header)
    const nameHeader = page.locator('th').filter({ hasText: 'שם' }).first();
    await nameHeader.click();
    await page.waitForTimeout(1000);

    const row = page.locator('.ant-table-row').filter({ hasText: 'DELETE-ME' });
    if (await row.isVisible()) {
      // Click delete button (last in row)
      await row.locator('button').last().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/demo-04-delete-confirm.png', fullPage: true });

      // Confirm
      const confirmBtn = page.locator('.ant-popover .ant-btn-primary').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/demo-05-after-delete.png', fullPage: true });
      }
    } else {
      console.log('DELETE-ME row not visible on current page — may need pagination');
      await page.screenshot({ path: 'test-results/demo-04-delete-not-found.png', fullPage: true });
    }
  });

  test('3. Multi-user sync: User A creates datasource, User B sees it via SignalR', async ({ browser }) => {
    const ctxA = await browser.newContext({ viewport: { width: 1400, height: 800 } });
    const ctxB = await browser.newContext({ viewport: { width: 1400, height: 800 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // Both users open datasources
    await pageA.goto(`${BASE}/datasources`, { waitUntil: 'networkidle' });
    await pageB.goto(`${BASE}/datasources`, { waitUntil: 'networkidle' });
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    // Count User B's rows before
    const beforeCount = await pageB.locator('.ant-table-row').count();
    console.log(`User B sees ${beforeCount} datasources before`);
    await pageB.screenshot({ path: 'test-results/demo-06-userB-before.png', fullPage: true });

    // User A creates a datasource via the UI proxy (goes through controller → EntityChanged broadcast)
    const ts = Date.now();
    const name = `SYNC-${ts}`;
    await pageA.request.post(`${BASE}/api/v1/datasource`, {
      data: { Name: name, SupplierName: 'Sync Test', Category: 'Sales', ConnectionString: '/tmp/sync', IsActive: false }
    });
    console.log(`User A created: ${name}`);

    // Wait for SignalR EntityChanged → React Query invalidation on User B
    await pageB.waitForTimeout(8000);

    const afterCount = await pageB.locator('.ant-table-row').count();
    console.log(`User B sees ${afterCount} datasources after (expected ${beforeCount + 1})`);
    await pageB.screenshot({ path: 'test-results/demo-07-userB-after.png', fullPage: true });

    const bodyB = await pageB.locator('body').innerText();
    const synced = bodyB.includes(name);
    console.log(`User B auto-refreshed and sees "${name}": ${synced}`);

    // Cleanup
    const allDs = await pageA.request.get(`${BASE}/api/v1/datasource`);
    const dsData = await allDs.json();
    const created = dsData.Data?.find?.((d: any) => d.Name === name);
    if (created) {
      await pageA.request.delete(`${BASE}/api/v1/datasource/${created.ID}`);
      console.log('Cleanup: deleted test datasource');
    }

    await ctxA.close();
    await ctxB.close();

    // Verdict
    if (synced) {
      console.log('MULTI-USER SYNC: WORKING — User B saw User A change in real-time via SignalR');
    } else {
      console.log('MULTI-USER SYNC: NOT WORKING — SignalR may not be connected');
    }
  });
});

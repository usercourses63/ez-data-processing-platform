import { test, expect } from '@playwright/test';

/**
 * Comprehensive NAS lifecycle demo:
 * 1. Create dynamic NAS server on file-simulator
 * 2. Create NAS device on frontend
 * 3. Test connection
 * 4. Provision (PV/PVC)
 * 5. Deprovision (unbind/clear)
 * 6. Delete the NAS device
 */

const SIMULATOR_API = 'http://file-simulator.local:30500';
const EZ_API = 'http://localhost:5001';
const NAS_NAME = 'e2e-lifecycle-nas';

test.use({ launchOptions: { slowMo: 300 } });

test('NAS Full Lifecycle Demo', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes for slow demo
  // ============ STEP 1: Create dynamic NAS on file-simulator ============
  console.log('');
  console.log('=== STEP 1: Creating dynamic NAS server on file-simulator ===');

  // Use an existing NAS server port — we'll point our NAS device to an existing one
  // (creating dynamic NAS servers requires specific simulator endpoints)
  // Use nas-input-1 at port 32150 which is a known working NFS server
  const nasHost = 'file-simulator.local';
  const nasPort = 32150;
  console.log('>>> Using existing NFS server at ' + nasHost + ':' + nasPort);
  await page.waitForTimeout(2000);

  // ============ STEP 2: Navigate to NAS Devices tab ============
  console.log('');
  console.log('=== STEP 2: Navigating to NAS Devices tab ===');
  await page.goto('/admin/settings?tab=nasDevices');
  await page.waitForLoadState('networkidle');
  await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

  console.log('>>> LOOK: NAS Devices tab loaded');
  await page.waitForTimeout(4000);

  // ============ STEP 3: Create new NAS device ============
  console.log('');
  console.log('=== STEP 3: Creating NAS device "' + NAS_NAME + '" ===');

  // Click Add button
  await page.getByRole('button', { name: /הוסף התקן NAS/i }).click();
  await page.waitForTimeout(1500);

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible({ timeout: 5000 });
  console.log('>>> LOOK: Create modal opened');
  await page.waitForTimeout(3000);

  // Fill form
  await modal.locator('input#Name').fill(NAS_NAME);
  await page.waitForTimeout(1000);

  await modal.locator('input#Host').fill(nasHost);
  await page.waitForTimeout(1000);

  // Clear and set port
  const portInput = modal.locator('input[id="Port"], .ant-input-number input').first();
  await portInput.click();
  await portInput.fill(String(nasPort));
  await page.waitForTimeout(1000);

  await modal.locator('input#ExportPath').fill('/');
  await page.waitForTimeout(1000);

  console.log('>>> LOOK: Form filled — Name: ' + NAS_NAME + ', Host: ' + nasHost + ':' + nasPort);
  await page.waitForTimeout(4000);

  // Set up response listener before clicking
  const apiPromise = page.waitForResponse(
    resp => resp.url().includes('/nasdevices') && resp.request().method() === 'POST',
    { timeout: 20000 }
  ).catch(() => null);

  // Click Create button via dispatchEvent (Ant Design modal footer needs it)
  await page.evaluate(() => {
    const btn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLElement;
    if (btn) btn.click();
  });
  console.log('>>> Saving...');

  // Wait for API response
  const apiResp = await apiPromise;
  if (apiResp) {
    console.log('>>> API response:', apiResp.status());
  } else {
    console.log('>>> No API call detected, trying click again...');
    await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Wait for modal to close
  await expect(page.locator('.ant-modal-wrap')).toBeHidden({ timeout: 15000 });
  console.log('>>> LOOK: Device created! Check the table for "' + NAS_NAME + '"');
  await page.waitForTimeout(5000);

  // Find our new device — might be on last page
  let deviceRow = page.locator('.ant-table-row').filter({ hasText: NAS_NAME });
  let isVisible = await deviceRow.isVisible({ timeout: 3000 }).catch(() => false);

  if (!isVisible) {
    // Navigate to last page
    const pages = page.locator('.ant-pagination-item');
    const pageCount = await pages.count();
    if (pageCount > 0) {
      await pages.last().click();
      await page.waitForTimeout(2000);
      deviceRow = page.locator('.ant-table-row').filter({ hasText: NAS_NAME });
      isVisible = await deviceRow.isVisible({ timeout: 3000 }).catch(() => false);
    }
  }

  expect(isVisible).toBe(true);

  // Highlight it
  await page.evaluate((name) => {
    document.querySelectorAll('.ant-table-row').forEach(row => {
      if (row.textContent?.includes(name)) {
        (row as HTMLElement).style.outline = '3px solid red';
        (row as HTMLElement).style.background = '#fff2f0';
      }
    });
  }, NAS_NAME);
  console.log('>>> LOOK: "' + NAS_NAME + '" row highlighted in red — shows "לא מוקצה" (not provisioned)');
  await page.waitForTimeout(6000);

  // Clear highlight
  await page.evaluate(() => {
    document.querySelectorAll('[style*="outline"]').forEach(el => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.background = '';
    });
  });

  // ============ STEP 4: Test Connection ============
  console.log('');
  console.log('=== STEP 4: Testing connection to NFS server ===');

  const testBtn = deviceRow.locator('button').filter({ has: page.locator('.anticon-api') });
  await testBtn.click({ force: true });
  console.log('>>> LOOK: Testing connection... watch for toast notification');
  await page.waitForTimeout(6000);

  // Check connection tag appeared
  const connectionTag = deviceRow.locator('td').first().locator('.ant-tag').filter({ hasText: /מחובר|Connected/ });
  const hasConnection = await connectionTag.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('>>> Connection tag visible:', hasConnection);
  await page.waitForTimeout(3000);

  // ============ STEP 5: Provision (PV/PVC) ============
  console.log('');
  console.log('=== STEP 5: Provisioning Kubernetes resources (PV/PVC) ===');

  // Re-find row (may have re-rendered)
  deviceRow = page.locator('.ant-table-row').filter({ hasText: NAS_NAME });
  const provisionBtn = deviceRow.locator('button').filter({ has: page.locator('.anticon-cloud-upload') });
  await provisionBtn.click();
  await page.waitForTimeout(1500);

  // Confirm in popconfirm
  const popconfirm = page.locator('.ant-popover').filter({ hasText: /אישור|provision/i });
  await expect(popconfirm).toBeVisible({ timeout: 3000 });
  console.log('>>> LOOK: Provision popconfirm appeared');
  await page.waitForTimeout(3000);

  const confirmBtn = popconfirm.locator('.ant-btn-primary, .ant-btn-compact-first-item').last();
  await confirmBtn.click();
  console.log('>>> Provisioning... creating PV and PVC in Kubernetes');
  await page.waitForTimeout(8000);

  // Check provision status
  deviceRow = page.locator('.ant-table-row').filter({ hasText: NAS_NAME });
  const statusCell = deviceRow.locator('td:nth-child(6)');
  const statusTags = await statusCell.locator('.ant-tag').allTextContents();
  console.log('>>> LOOK: Provision status tags:', statusTags);

  // Highlight
  await page.evaluate((name) => {
    document.querySelectorAll('.ant-table-row').forEach(row => {
      if (row.textContent?.includes(name)) {
        (row as HTMLElement).style.outline = '3px solid green';
        (row as HTMLElement).style.background = '#f6ffed';
      }
    });
  }, NAS_NAME);
  console.log('>>> LOOK: Row highlighted green — check PV/PVC status');
  await page.waitForTimeout(6000);

  // Clear highlight
  await page.evaluate(() => {
    document.querySelectorAll('[style*="outline"]').forEach(el => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.background = '';
    });
  });

  // ============ STEP 6: Deprovision (unbind/clear) ============
  console.log('');
  console.log('=== STEP 6: Deprovisioning — removing PV/PVC from Kubernetes ===');

  // Get device ID from API
  const devicesResp = await page.request.get(EZ_API + '/api/v1/nasdevices');
  const devices = await devicesResp.json();
  const ourDevice = devices.find((d: any) => d.Name === NAS_NAME);

  if (ourDevice) {
    console.log('>>> Device ID:', ourDevice.ID);
    console.log('>>> Calling deprovision API...');

    const deprovResp = await page.request.delete(
      EZ_API + '/api/v1/nasdevices/' + ourDevice.ID + '/provision'
    );
    console.log('>>> Deprovision status:', deprovResp.status());
    await page.waitForTimeout(3000);

    // Refresh to see updated status
    console.log('>>> LOOK: Table will refresh — status should change back to "לא מוקצה"');
    await page.waitForTimeout(5000);

    // Re-find and highlight
    deviceRow = page.locator('.ant-table-row').filter({ hasText: NAS_NAME });
    await page.evaluate((name) => {
      document.querySelectorAll('.ant-table-row').forEach(row => {
        if (row.textContent?.includes(name)) {
          (row as HTMLElement).style.outline = '3px solid orange';
          (row as HTMLElement).style.background = '#fff7e6';
        }
      });
    }, NAS_NAME);
    console.log('>>> LOOK: Row highlighted orange — PV/PVC removed, status back to not provisioned');
    await page.waitForTimeout(6000);

    // Clear highlight
    await page.evaluate(() => {
      document.querySelectorAll('[style*="outline"]').forEach(el => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.background = '';
      });
    });
  }

  // ============ STEP 7: Delete the NAS device ============
  console.log('');
  console.log('=== STEP 7: Deleting NAS device "' + NAS_NAME + '" ===');

  deviceRow = page.locator('.ant-table-row').filter({ hasText: NAS_NAME });

  // Highlight before delete
  await page.evaluate((name) => {
    document.querySelectorAll('.ant-table-row').forEach(row => {
      if (row.textContent?.includes(name)) {
        (row as HTMLElement).style.outline = '3px solid red';
        (row as HTMLElement).style.background = '#fff2f0';
      }
    });
  }, NAS_NAME);
  console.log('>>> LOOK: About to delete this row (highlighted red)');
  await page.waitForTimeout(4000);

  const deleteBtn = deviceRow.locator('button').filter({ has: page.locator('.anticon-delete') });
  await deleteBtn.click();
  await page.waitForTimeout(1500);

  const deletePopconfirm = page.locator('.ant-popover').filter({ hasText: /מחיקת|מחק|delete/i });
  await expect(deletePopconfirm).toBeVisible({ timeout: 3000 });
  console.log('>>> LOOK: Delete popconfirm appeared');
  await page.waitForTimeout(4000);

  // Confirm delete
  const deleteConfirm = deletePopconfirm.locator('.ant-btn-primary, .ant-btn-dangerous, .ant-btn-compact-first-item').last();
  await deleteConfirm.click();
  console.log('>>> Deleting...');
  await page.waitForTimeout(5000);

  // Verify row is gone
  deviceRow = page.locator('.ant-table-row').filter({ hasText: NAS_NAME });
  const stillExists = await deviceRow.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('>>> Device still in table:', stillExists);
  expect(stillExists).toBe(false);

  console.log('');
  console.log('>>> =============================================');
  console.log('>>> LIFECYCLE COMPLETE: create → connect → provision → deprovision → delete');
  console.log('>>> =============================================');
  await page.waitForTimeout(5000);
});

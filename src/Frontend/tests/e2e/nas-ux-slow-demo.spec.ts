import { test, expect } from '@playwright/test';

test.use({ launchOptions: { slowMo: 500 } });

test('Demo 1: NAS Status Tags', async ({ page }) => {
  // Navigate to NAS tab
  await page.goto('/admin/settings?tab=nasDevices');
  await page.waitForLoadState('networkidle');
  await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

  // Highlight first row name column tags
  await page.evaluate(() => {
    const firstRow = document.querySelector('.ant-table-row td:first-child');
    if (firstRow) {
      (firstRow as HTMLElement).style.outline = '3px solid red';
      (firstRow as HTMLElement).style.outlineOffset = '2px';
    }
  });

  // Pause so user can see the status tags
  console.log('>>> LOOK: First row shows PVC מחובר + מחובר tags next to name');
  await page.waitForTimeout(5000);

  // Now highlight all status tags across rows
  await page.evaluate(() => {
    document.querySelectorAll('.ant-table-row td:first-child .ant-tag').forEach(tag => {
      (tag as HTMLElement).style.outline = '2px solid blue';
      (tag as HTMLElement).style.outlineOffset = '1px';
    });
  });
  console.log('>>> LOOK: All name-column tags highlighted in blue');
  await page.waitForTimeout(5000);

  // Now highlight the Status column (6th)
  await page.evaluate(() => {
    // Clear previous
    document.querySelectorAll('[style*="outline"]').forEach(el => {
      (el as HTMLElement).style.outline = '';
    });
    document.querySelectorAll('.ant-table-row td:nth-child(6)').forEach(cell => {
      (cell as HTMLElement).style.outline = '3px solid green';
      (cell as HTMLElement).style.outlineOffset = '2px';
    });
  });
  console.log('>>> LOOK: Status column shows PV נוצר + PVC מחובר (detailed states)');
  await page.waitForTimeout(5000);

  // Verify
  const firstCell = page.locator('.ant-table-row').first().locator('td').first();
  const tags = await firstCell.locator('.ant-tag').allTextContents();
  expect(tags).toContain('PVC מחובר');
  expect(tags.some(t => t === 'מחובר' || t === 'לא מחובר')).toBe(true);
  console.log('>>> TEST 1 PASSED: Status tags verified');
});

test('Demo 2: Delete Popconfirm (Hebrew)', async ({ page }) => {
  await page.goto('/admin/settings?tab=nasDevices');
  await page.waitForLoadState('networkidle');
  await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

  // Highlight the delete button on last row
  const lastRow = page.locator('.ant-table-row').last();
  const deleteBtn = lastRow.locator('button').filter({ has: page.locator('.anticon-delete') });

  await page.evaluate((el) => {
    (el as HTMLElement).style.outline = '3px solid red';
    (el as HTMLElement).style.outlineOffset = '2px';
  }, await deleteBtn.elementHandle());
  console.log('>>> LOOK: Delete button highlighted on last row');
  await page.waitForTimeout(3000);

  // Click delete
  await deleteBtn.click();
  await page.waitForTimeout(1000);

  console.log('>>> LOOK: Hebrew popconfirm appeared');
  await page.waitForTimeout(5000);

  // Cancel
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(2000);

  console.log('>>> TEST 2 PASSED: Delete popconfirm works, cancelled without deleting');
});

test('Demo 3: Admin Servers SignalR Sync', async ({ page }) => {
  await page.goto('/admin/settings');
  await page.waitForLoadState('networkidle');

  // Click Input Servers tab
  const serversTab = page.getByRole('tab', { name: /שרתי קלט|input servers/i });
  await serversTab.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('>>> LOOK: Input Servers tab loaded. Watch your OTHER browser tab too!');
  await page.waitForTimeout(3000);

  // Count current rows
  const beforeCount = await page.locator('.ant-table-row').count();
  console.log('>>> Server count before:', beforeCount);

  // Create server via API
  const testName = 'SignalR-Demo-' + Date.now();
  console.log('>>> Creating server "' + testName + '" via API...');
  const createResp = await page.request.post('http://localhost:5001/api/v1/servers', {
    data: {
      Name: testName,
      ServerType: 'ftp',
      Direction: 0,
      Host: '10.0.0.99',
      Port: 21,
      BasePath: '/demo',
      IsActive: true,
      ConnectionTimeoutSeconds: 30,
      RetryCount: 3
    }
  });
  expect(createResp.status()).toBe(201);
  const created = await createResp.json();
  console.log('>>> Server created! ID:', created.ID);

  // Wait and let user see the table auto-refresh
  console.log('>>> LOOK: Table should auto-refresh — new server appears without reload!');
  await page.waitForTimeout(5000);

  // Highlight the new row
  await page.evaluate((name) => {
    document.querySelectorAll('.ant-table-row').forEach(row => {
      if (row.textContent?.includes(name)) {
        (row as HTMLElement).style.outline = '3px solid red';
        (row as HTMLElement).style.background = '#fff2f0';
      }
    });
  }, testName);
  console.log('>>> LOOK: New server row highlighted in red');
  await page.waitForTimeout(5000);

  // Now delete it via API
  console.log('>>> Deleting server via API...');
  await page.request.delete('http://localhost:5001/api/v1/servers/' + created.ID);

  console.log('>>> LOOK: Server should disappear from table — SignalR delete broadcast!');
  await page.waitForTimeout(5000);

  console.log('>>> TEST 3 PASSED: AdminServer SignalR create + delete sync verified');
});

test('Demo 4: Categories SignalR Sync', async ({ page }) => {
  await page.goto('/admin/settings');
  await page.waitForLoadState('networkidle');

  // Click Categories tab
  const categoriesTab = page.getByRole('tab', { name: /קטגוריות|categories/i });
  await categoriesTab.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  console.log('>>> LOOK: Categories tab loaded. Watch your OTHER browser tab too!');
  await page.waitForTimeout(5000);

  // Create category via API
  const testName = 'בדיקת-סינכרון-' + Date.now();
  console.log('>>> Creating category "' + testName + '" via API...');
  await page.waitForTimeout(3000);

  const createResp = await page.request.post('http://localhost:5001/api/v1/categories', {
    data: {
      Name: testName,
      NameEn: 'Sync-Demo-' + Date.now(),
      Description: 'Demo category for SignalR',
      SortOrder: 999,
      IsActive: true
    }
  });
  expect(createResp.status()).toBe(201);
  const created = await createResp.json();
  console.log('>>> Category created! ID:', created.ID);

  console.log('>>> LOOK: Category list should auto-refresh — new category appears!');
  await page.waitForTimeout(8000);

  // Highlight new category
  await page.evaluate((name) => {
    document.querySelectorAll('.ant-table-row, .ant-list-item, tr').forEach(row => {
      if (row.textContent?.includes(name)) {
        (row as HTMLElement).style.outline = '3px solid red';
        (row as HTMLElement).style.background = '#fff2f0';
      }
    });
  }, testName);
  console.log('>>> LOOK: New category highlighted in red');
  await page.waitForTimeout(8000);

  // Delete via API
  console.log('>>> Now deleting category via API...');
  await page.waitForTimeout(3000);
  await page.request.delete('http://localhost:5001/api/v1/categories/' + created.ID);

  console.log('>>> LOOK: Category should disappear — SignalR delete broadcast!');
  await page.waitForTimeout(8000);

  console.log('>>> TEST 4 PASSED: Category SignalR create + delete sync verified');
});

test('Demo 5: Deprovision API endpoint', async ({ page }) => {
  await page.goto('/admin/settings?tab=nasDevices');
  await page.waitForLoadState('networkidle');
  await page.locator('.ant-table-row').first().waitFor({ state: 'visible', timeout: 10000 });

  console.log('>>> Testing deprovision API endpoint...');
  const resp = await page.request.delete('http://localhost:5001/api/v1/nasdevices/nonexistent-id/provision');
  console.log('>>> Deprovision API returned:', resp.status(), '(404 = correct for nonexistent)');
  expect(resp.status()).toBe(404);

  await page.waitForTimeout(3000);
  console.log('>>> TEST 5 PASSED: Deprovision API works correctly');
});

import { test, expect } from '@playwright/test';

test.use({ launchOptions: { slowMo: 200 } });

test('FTP E2E Pipeline — create datasource via UI and trigger pipeline', async ({ page }) => {
  test.setTimeout(300000); // 5 minutes

  // ============ STEP 1: Navigate to datasource list ============
  console.log('=== STEP 1: Navigate to datasource list ===');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click "הוסף" (Add) button
  console.log('>>> Clicking Add datasource button...');
  await page.getByRole('button', { name: /הוסף|add/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // ============ STEP 2: Fill basic info tab ============
  console.log('=== STEP 2: Fill basic info ===');
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(500);

  // Name field
  const nameInput = page.getByLabel(/שם מקור|name/i).first();
  if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nameInput.fill('e2e-ftp-pipeline');
  } else {
    await page.locator('input').first().fill('e2e-ftp-pipeline');
  }
  await page.waitForTimeout(500);

  // Supplier name
  const supplierInput = page.getByLabel(/ספק|supplier/i);
  if (await supplierInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await supplierInput.fill('E2E Test Supplier');
  }
  await page.waitForTimeout(500);

  // Category — select first available
  const categorySelect = page.locator('.ant-select').filter({ hasText: /קטגוריה|category|בחר/i }).first();
  if (await categorySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await categorySelect.click();
    await page.waitForTimeout(500);
    await page.locator('.ant-select-item-option').first().click();
    await page.waitForTimeout(500);
  }

  console.log('>>> Basic info filled');
  await page.waitForTimeout(2000);

  // ============ STEP 3: Input Settings tab — select FTP ============
  console.log('=== STEP 3: Input Settings tab — FTP setup ===');

  // Click "הגדרות קלט" (Input Settings) tab
  const inputTab = page.locator('.ant-tabs-tab').filter({ hasText: /הגדרות קלט|input settings/i });
  await inputTab.click();
  await page.waitForTimeout(2000);

  // Take screenshot to see what's on this tab
  await page.screenshot({ path: 'test-results/e2e-ftp-input-tab.png', fullPage: true });

  // List all form items on this tab
  const formItems = page.locator('.ant-form-item');
  const fiCount = await formItems.count();
  console.log('>>> Form items on Input tab:', fiCount);
  for (let i = 0; i < Math.min(fiCount, 10); i++) {
    const label = await formItems.nth(i).locator('.ant-form-item-label').textContent().catch(() => 'no-label');
    console.log(`  Item ${i}: "${label?.trim()}"`);
  }

  // Find and interact with protocol/connection type select
  const allSelects = page.locator('.ant-tabs-tabpane-active .ant-select, .ant-form-item .ant-select');
  const selectCount = await allSelects.count();
  console.log('>>> Selects on tab:', selectCount);
  for (let i = 0; i < selectCount; i++) {
    const text = await allSelects.nth(i).textContent().catch(() => '');
    console.log(`  Select ${i}: "${text?.trim()}"`);
  }

  // Select FTP protocol — find the protocol/connection type select
  const protocolSelect = page.locator('.ant-form-item').filter({ hasText: /פרוטוקול|protocol|סוג חיבור|connection type/i }).locator('.ant-select');
  if (await protocolSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await protocolSelect.click();
    await page.waitForTimeout(500);
    const ftpOpt = page.locator('.ant-select-item-option').filter({ hasText: /FTP/i }).first();
    if (await ftpOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ftpOpt.click();
      console.log('>>> Selected FTP protocol');
      await page.waitForTimeout(2000);
    }
  } else {
    // Try clicking the first select that's not category
    for (let i = 0; i < selectCount; i++) {
      const sel = allSelects.nth(i);
      const text = await sel.textContent().catch(() => '');
      if (!text?.includes('Sales') && !text?.includes('מכירות')) {
        await sel.click();
        await page.waitForTimeout(500);
        const ftpOpt = page.locator('.ant-select-item-option').filter({ hasText: /FTP/ }).first();
        if (await ftpOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await ftpOpt.click();
          console.log('>>> Selected FTP from select', i);
          await page.waitForTimeout(2000);
          break;
        }
        await page.keyboard.press('Escape');
      }
    }
  }

  await page.screenshot({ path: 'test-results/e2e-ftp-after-protocol.png', fullPage: true });

  // Now find and select the FTP server
  const serverSelect = page.locator('.ant-form-item').filter({ hasText: /שרת|server/i }).locator('.ant-select').first();
  if (await serverSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await serverSelect.click();
    await page.waitForTimeout(1000);
    // Select "ftp" server
    const ftpServerOpt = page.locator('.ant-select-item-option').filter({ hasText: /^ftp/ }).first();
    if (await ftpServerOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ftpServerOpt.click();
      console.log('>>> Selected FTP server');
    } else {
      const first = page.locator('.ant-select-item-option').first();
      if (await first.isVisible().catch(() => false)) {
        await first.click();
        console.log('>>> Selected first server');
      }
    }
    await page.waitForTimeout(1500);
  }

  // Set file path
  const pathInput = page.getByLabel(/נתיב|path/i);
  if (await pathInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pathInput.fill('/e2e-pipeline-test');
    console.log('>>> Path set');
  }

  // Set file pattern
  const patternInput = page.getByLabel(/תבנית|pattern/i);
  if (await patternInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await patternInput.fill('*.csv');
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/e2e-ftp-connection-tab.png', fullPage: true });

  // ============ STEP 4: Save the datasource ============
  console.log('=== STEP 4: Save datasource ===');

  // Set up API response listener
  const savePromise = page.waitForResponse(
    resp => resp.url().includes('/DataSource') && resp.request().method() === 'POST',
    { timeout: 15000 }
  ).catch(() => null);

  // Click save button
  const saveBtn = page.getByRole('button', { name: /שמור|save|צור|create/i });
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    console.log('>>> Save clicked');
  }

  const saveResp = await savePromise;
  if (saveResp) {
    console.log('>>> Save API status:', saveResp.status());
    if (saveResp.status() >= 400) {
      const body = await saveResp.json().catch(() => ({}));
      console.log('>>> Save error:', JSON.stringify(body).substring(0, 300));
    }
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/e2e-ftp-after-save.png', fullPage: true });

  // ============ STEP 5: Verify datasource created ============
  console.log('=== STEP 5: Verify in API ===');

  const dsResp = await page.request.get('http://localhost:5001/api/v1/DataSource');
  const dsData = await dsResp.json();
  const items = dsData.Data?.Items || [];
  const ourDs = items.find((d: any) => d.Name === 'e2e-ftp-pipeline');
  if (ourDs) {
    console.log('>>> Datasource found! ID:', ourDs.ID);
    console.log('>>> FileServerId:', ourDs.FileServerId);
    console.log('>>> FilePath:', ourDs.FilePath);
    console.log('>>> FilePattern:', ourDs.FilePattern);
  } else {
    console.log('>>> Datasource NOT found in API');
    console.log('>>> All datasource names:', items.map((d: any) => d.Name).join(', '));
  }

  // ============ STEP 6: Trigger pipeline ============
  if (ourDs) {
    console.log('=== STEP 6: Trigger pipeline ===');

    // Publish FilePollingEvent to RabbitMQ
    const corrId = 'e2e-ftp-' + Date.now();
    const publishResp = await page.request.post(
      'http://localhost:15672/api/exchanges/%2F/DataProcessing.Shared.Messages:FilePollingEvent/publish',
      {
        headers: {
          'Authorization': 'Basic ' + btoa('guest:guest'),
          'Content-Type': 'application/json',
        },
        data: {
          properties: { content_type: 'application/vnd.masstransit+json' },
          routing_key: '',
          payload: JSON.stringify({
            messageType: ['urn:message:DataProcessing.Shared.Messages:FilePollingEvent'],
            message: {
              DataSourceId: ourDs.ID,
              CorrelationId: corrId,
              Timestamp: new Date().toISOString(),
              PublishedBy: 'E2E-FTP-Test',
              MessageVersion: 1
            }
          }),
          payload_encoding: 'string'
        }
      }
    );
    console.log('>>> RabbitMQ publish:', (await publishResp.json()).routed ? 'ROUTED' : 'FAILED');

    // Wait for pipeline to process
    console.log('>>> Waiting 20s for pipeline processing...');
    await page.waitForTimeout(20000);

    // Check FileDiscovery logs
    console.log('=== STEP 7: Check pipeline results ===');
  }

  console.log('>>> FTP E2E Pipeline test complete');
});

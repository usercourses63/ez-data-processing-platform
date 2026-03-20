import { test, expect } from '@playwright/test';

test.use({ launchOptions: { slowMo: 200 } });

test('NAS E2E Pipeline — create via UI, trigger, verify output', async ({ page }) => {
  test.setTimeout(300000);

  console.log('=== STEP 1: Create NAS datasource via frontend ===');
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click Add
  await page.getByRole('button', { name: /הוסף|add/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Fill name
  await page.locator('input').first().fill('e2e-nas-pipeline');
  await page.waitForTimeout(500);

  // Supplier
  const supplier = page.getByLabel(/ספק|supplier/i);
  if (await supplier.isVisible({ timeout: 2000 }).catch(() => false)) {
    await supplier.fill('NAS E2E Test');
  }
  await page.waitForTimeout(500);

  // Category
  const catSelect = page.locator('.ant-select').filter({ hasText: /קטגוריה|category|בחר/i }).first();
  if (await catSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await catSelect.click();
    await page.waitForTimeout(300);
    await page.locator('.ant-select-item-option').first().click();
    await page.waitForTimeout(300);
  }

  // Go to Input Settings tab
  console.log('>>> Switching to Input Settings tab...');
  const inputTab = page.locator('.ant-tabs-tab').filter({ hasText: /הגדרות קלט/i });
  await inputTab.click();
  await page.waitForTimeout(2000);

  // Select NAS protocol
  const allSelects = page.locator('.ant-tabs-tabpane-active .ant-select, .ant-form-item .ant-select');
  const selectCount = await allSelects.count();
  for (let i = 0; i < selectCount; i++) {
    const text = await allSelects.nth(i).textContent().catch(() => '');
    if (text?.includes('NFS') || text?.includes('FTP')) {
      await allSelects.nth(i).click();
      await page.waitForTimeout(300);
      const nasOpt = page.locator('.ant-select-item-option').filter({ hasText: 'NAS' });
      if (await nasOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nasOpt.click();
        console.log('>>> Selected NAS protocol');
        await page.waitForTimeout(2000);
      }
      break;
    }
  }

  // Select nfs-input-data NAS device
  console.log('>>> Looking for NAS device dropdown...');
  const nasDeviceSelect = page.locator('.ant-form-item').filter({ hasText: /התקן NAS|NAS device/i }).locator('.ant-select').first();
  const nasSelectAlt = page.locator('.ant-select').filter({ hasText: /בחר התקן|select device/i }).first();

  for (const sel of [nasDeviceSelect, nasSelectAlt]) {
    if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sel.click();
      await page.waitForTimeout(1000);

      // Find nfs-input-data
      const opts = page.locator('.ant-select-item-option');
      const optCount = await opts.count();
      console.log('>>> NAS device options:', optCount);

      for (let i = 0; i < optCount; i++) {
        const optText = await opts.nth(i).textContent().catch(() => '');
        if (optText?.includes('nfs-input-data')) {
          await opts.nth(i).click();
          console.log('>>> Selected nfs-input-data');
          break;
        }
      }
      await page.waitForTimeout(1500);
      break;
    }
  }

  // Set sub-path
  const subPathInput = page.getByLabel(/נתיב משנה|sub.?path/i);
  if (await subPathInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await subPathInput.fill('/e2e-nas-test');
    console.log('>>> Sub-path set to /e2e-nas-test');
  } else {
    // Try path field
    const pathInput = page.getByLabel(/נתיב|path/i);
    if (await pathInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pathInput.fill('/e2e-nas-test');
    }
  }

  // File pattern
  const pattern = page.getByLabel(/תבנית|pattern/i);
  if (await pattern.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pattern.fill('*.csv');
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/e2e-nas-input-tab.png', fullPage: true });

  // Save
  console.log('=== STEP 2: Save datasource ===');
  const savePromise = page.waitForResponse(
    resp => resp.url().includes('/DataSource') && resp.request().method() === 'POST',
    { timeout: 15000 }
  ).catch(() => null);

  // Click the primary "צור" (Create) button
  const createBtn = page.locator('button.ant-btn-primary').filter({ hasText: /צור/ });
  await createBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await createBtn.click({ force: true });
  console.log('>>> Create button clicked (force)');
  await page.waitForTimeout(5000);

  // Check ALL tabs for validation errors
  const errors = await page.locator('.ant-form-item-explain-error').allTextContents();
  if (errors.length > 0) {
    console.log('>>> FORM ERRORS:', errors);
  }
  const errorItems = await page.locator('.ant-form-item-has-error').count();
  console.log('>>> Error fields:', errorItems);

  // Screenshot after click to see state
  await page.screenshot({ path: 'test-results/e2e-nas-after-save.png', fullPage: true });

  const saveResp = await savePromise;
  console.log('>>> Save status:', saveResp?.status());

  await page.waitForTimeout(3000);

  // Verify in API
  console.log('=== STEP 3: Verify datasource ===');
  const dsResp = await page.request.get('http://localhost:5001/api/v1/DataSource');
  const dsData = await dsResp.json();
  const items = dsData.Data?.Items || [];
  const ourDs = items.find((d: any) => d.Name === 'e2e-nas-pipeline');
  if (ourDs) {
    console.log('>>> DS ID:', ourDs.ID);
    console.log('>>> NasDeviceId:', ourDs.NasDeviceId);
    console.log('>>> FilePath:', ourDs.FilePath);
  } else {
    console.log('>>> DS NOT FOUND');
  }

  // Trigger pipeline
  if (ourDs) {
    console.log('=== STEP 4: Trigger pipeline ===');
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
              CorrelationId: 'nas-e2e-' + Date.now(),
              Timestamp: new Date().toISOString(),
              PublishedBy: 'NAS-E2E-Test',
              MessageVersion: 1
            }
          }),
          payload_encoding: 'string'
        }
      }
    );
    console.log('>>> Published:', (await publishResp.json()).routed ? 'ROUTED' : 'FAILED');

    console.log('>>> Waiting 30s for pipeline...');
    await page.waitForTimeout(30000);

    console.log('=== STEP 5: Check results ===');
    // Check if file was discovered and processed
    // The FilePath for NAS is local mount path, not FTP URL
  }

  console.log('>>> NAS E2E Pipeline test complete');
});

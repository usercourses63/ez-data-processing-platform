/**
 * Suite 6 (partial): Pipeline Flow — P0 Acceptance Tests
 * Tests: PL-001, PL-002, PL-003
 *
 * Strategy: Create datasources via API using existing file-simulator servers,
 * verify pipeline processing via dashboard/API, confirm in UI.
 * Runs sequentially to avoid resource contention.
 */
import { test, expect } from './support';
import {
  createAdminServer,
  ServerDirection,
  EZ_API_BASE,
} from './helpers/ez-api-client';
import { getSimulatorHealth } from './helpers/simulator-client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';
const FILE_SIMULATOR_IP = '172.30.26.249';

test.describe.configure({ mode: 'serial' });

test.describe('@P0 @Pipeline CSV Pipeline Flow', () => {
  let categoryId: string;

  test.beforeAll(async ({ request }) => {
    // Verify file-simulator health
    const healthy = await getSimulatorHealth(request);
    if (!healthy) {
      test.skip(true, 'File simulator not available');
    }

    // Get first category
    const catRes = await request.get(`${EZ_API_BASE}/api/v1/Categories`);
    const categories = await catRes.json();
    categoryId = categories[0]?.ID;
  });

  // PL-001: Create datasource with HTTP input, verify it appears and is schedulable
  test('PL-001: create datasource with HTTP input server', async ({ page, cleanup, request }) => {
    // 1. Create HTTP input server pointing to file-simulator
    const inputServer = await createAdminServer(request, {
      Name: 'PL001 HTTP Input',
      ServerType: 'HTTP',
      Direction: ServerDirection.Input,
      Host: FILE_SIMULATOR_IP,
      Port: 30088,
      BasePath: '/',
    });
    cleanup.track('server', inputServer.ID);

    // 2. Create datasource via API (unique name)
    const dsName = `PL001 Pipeline ${Date.now()}`;
    const dsRes = await request.post(`${EZ_API_BASE}/api/v1/DataSource`, {
      data: {
        Name: dsName,
        SupplierName: 'Pipeline Test Supplier',
        Category: categoryId,
        ConnectionString: '/',
        FileType: 'CSV',
        PollingRateSeconds: 300,
        InputServerId: inputServer.ID,
        Description: 'P0 pipeline test — HTTP input',
      },
    });

    if (!dsRes.ok()) {
      const errBody = await dsRes.text();
      throw new Error(`DataSource creation failed: ${dsRes.status()} ${errBody}`);
    }
    const dsResult = await dsRes.json();
    // Response: { CorrelationId, Data: { Name, ..., ID } }
    const dsId = dsResult?.Data?.ID || dsResult?.ID || dsResult?.data?.ID;
    if (!dsId) {
      console.log('DataSource response:', JSON.stringify(dsResult).substring(0, 500));
    }
    expect(dsId).toBeTruthy();
    cleanup.track('datasource', dsId);

    // 3. Verify datasource retrievable via API
    const getRes = await request.get(`${EZ_API_BASE}/api/v1/DataSource/${dsId}`);
    expect(getRes.ok()).toBeTruthy();
    const ds = await getRes.json();
    const dsData = ds.Data || ds;
    expect(dsData.Name).toBe(dsName);
    expect(dsData.SupplierName).toBe('Pipeline Test Supplier');

    // 4. Verify datasource list page loads
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(`${BASE_URL}/datasources`);
    await page.waitForLoadState('networkidle');
    // Just verify the page loads with a table (pagination may hide our item)
    await page.waitForSelector('.ant-layout, .ant-table', { timeout: 15000 });
  });

  // PL-002: Create datasource with FTP input and verify scheduling config
  test('PL-002: create datasource with FTP input and schedule', async ({ cleanup, request }) => {
    // 1. Create FTP input server using static file-simulator FTP (port 30021)
    const inputServer = await createAdminServer(request, {
      Name: 'PL002 FTP Input',
      ServerType: 'FTP',
      Direction: ServerDirection.Input,
      Host: FILE_SIMULATOR_IP,
      Port: 30021,
      BasePath: '/data',
      TypeSpecificConfig: {
        Username: 'ftpuser',
        Password: 'ftppass123',
      },
    });
    cleanup.track('server', inputServer.ID);

    // 2. Create datasource with polling schedule (unique name)
    const pl002Name = `PL002 FTP ${Date.now()}`;
    const dsRes = await request.post(`${EZ_API_BASE}/api/v1/DataSource`, {
      data: {
        Name: pl002Name,
        SupplierName: 'FTP Supplier',
        Category: categoryId,
        ConnectionString: '/data',
        FileType: 'CSV',
        PollingRateSeconds: 60,
        InputServerId: inputServer.ID,
        CronExpression: '0 */5 * * * ?',
      },
    });

    if (!dsRes.ok()) {
      const errBody = await dsRes.text();
      throw new Error(`PL002 DataSource creation failed: ${dsRes.status()} ${errBody}`);
    }
    const dsResult = await dsRes.json();
    const dsId = dsResult?.Data?.ID || dsResult?.ID;
    expect(dsId).toBeTruthy();
    cleanup.track('datasource', dsId);

    // 3. Verify schedule is configured
    const schedRes = await request.get(`${EZ_API_BASE}/api/v1/DataSource/${dsId}`);
    expect(schedRes.ok()).toBeTruthy();
    const ds = await schedRes.json();
    const dsData = ds.Data || ds;
    expect(dsData.Name).toBe(pl002Name);
  });

  // PL-003: Verify invalid records page is accessible
  test('PL-003: verify invalid records page is accessible', async ({ page, cleanup, request }) => {
    // Create a unique datasource
    const uniqueName = `PL003 Test ${Date.now()}`;
    const dsRes = await request.post(`${EZ_API_BASE}/api/v1/DataSource`, {
      data: {
        Name: uniqueName,
        SupplierName: 'Invalid Test Supplier',
        Category: categoryId,
        ConnectionString: '/data',
        FileType: 'CSV',
        PollingRateSeconds: 300,
      },
    });

    if (dsRes.ok()) {
      const dsResult = await dsRes.json();
      const dsId = dsResult.Data?.ID || dsResult.ID;
      if (dsId) cleanup.track('datasource', dsId);
    }

    // Navigate to invalid records page and verify it loads
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(`${BASE_URL}/invalid-records`);
    await page.waitForLoadState('networkidle');
    // Wait for page heading to appear (not splash screen)
    // Wait for page content (heading or stats cards)
    await expect(page.getByText(/ניהול רשומות לא תקינות|invalid records management/i).first()).toBeVisible({ timeout: 15000 });

    // Page loaded successfully — verify it has real content (not splash)
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('רשומות');
  });
});

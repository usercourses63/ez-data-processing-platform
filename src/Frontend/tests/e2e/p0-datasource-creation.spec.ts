/**
 * Suite 5 (partial): Datasource Creation — P0 Acceptance Tests
 * Tests: DS-019, DS-020
 *
 * Strategy: True UI-only test — the form is filled via browser interactions.
 * No API fallback. If the UI form fails, the test fails.
 *
 * beforeAll: creates a temp FTP server for server selection in the connection tab.
 * afterAll: deletes the temp FTP server.
 */
import { test, expect } from './support';
import {
  EZ_API_BASE,
  createAdminServer,
  deleteServer,
  getDataSources,
  ServerDirection,
} from './helpers/ez-api-client';
import { selectAntOption, clickAntTab } from './support/helpers/ant-design-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';

test.describe.configure({ mode: 'serial' });

test.describe('@P0 @Datasource Complete Datasource Creation', () => {
  let categoryName: string;   // Hebrew category name (used as form value)
  let tempServerId: string;   // Temp FTP server created for this suite
  let tempServerName: string;
  let datasourceId: string;
  let dsName: string;

  test.beforeAll(async ({ request }) => {
    // Get first available category — value used in the category Select is the Hebrew name
    const catRes = await request.get(`${EZ_API_BASE}/api/v1/Categories`);
    expect(catRes.ok(), 'Categories API must respond').toBeTruthy();
    const categories = await catRes.json();
    categoryName = categories[0]?.Name; // e.g., "מכירות"
    expect(categoryName, 'Need at least one category in DB').toBeTruthy();

    // Create a temp FTP server — the connection tab requires selecting a server
    tempServerName = `P0-DS-Suite-FTP-${Date.now()}`;
    const server = await createAdminServer(request, {
      Name: tempServerName,
      ServerType: 'ftp',
      Direction: ServerDirection.Input,
      Host: '172.30.26.249',
      Port: 21,
      IsActive: true,
    });
    tempServerId = server.ID;
  });

  test.afterAll(async ({ request }) => {
    if (tempServerId) {
      await deleteServer(request, tempServerId).catch(() => {});
    }
  });

  // DS-019: Create datasource via UI form — no API fallback
  test('DS-019: create datasource via UI form', async ({ page, cleanup, request }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(`${BASE_URL}/datasources/new`);
    await page.waitForLoadState('networkidle');

    // ── Basic Info tab ────────────────────────────────────────────────────────
    dsName = `P0 DS ${Date.now()}`;
    await page.getByRole('textbox', { name: /שם מקור הנתונים/i }).fill(dsName);
    await page.getByRole('textbox', { name: /שם הספק/i }).fill('P0 Test Supplier');
    await page.getByRole('textbox', { name: /תיאור/i }).fill('Created by P0 acceptance test');

    // Select a valid category (DEFAULT_FORM_VALUES has 'financial' which is not a real Hebrew name)
    // Ant Design Form.Item name="category" generates input#category inside the Select wrapper
    const categorySelect = page.locator('.ant-select:has(input#category)');
    await selectAntOption(page, categorySelect, categoryName);

    // ── Connection tab ────────────────────────────────────────────────────────
    await clickAntTab(page, 'connection');
    await page.waitForLoadState('networkidle');

    // Select FTP as the connection protocol (Form.Item name="connectionType" → input#connectionType)
    const protocolSelect = page.locator('.ant-select:has(input#connectionType)');
    await selectAntOption(page, protocolSelect, 'FTP');

    // Wait for server list to load (getInputServers query), then select temp server
    // Form.Item name="inputServerId" → input#inputServerId
    const serverSelect = page.locator('.ant-select:has(input#inputServerId)');
    await expect(serverSelect).toBeVisible({ timeout: 10000 });

    // Select the temp FTP server created in beforeAll
    await selectAntOption(page, serverSelect, tempServerName);

    // Fill required path field (shown after server is selected for FTP/SFTP/S3 protocols)
    // Form.Item name="filePath" → input#filePath
    await expect(page.locator('#filePath')).toBeVisible({ timeout: 5000 });
    await page.locator('#filePath').fill('/data/input/');

    // ── Submit ────────────────────────────────────────────────────────────────
    // The Create button is outside the tabs (Form level), always visible
    await page.getByRole('button', { name: /צור|create/i }).click();

    // Successful creation navigates away from /datasources/new to /datasources
    await page.waitForURL('**/datasources', { timeout: 15000 });

    // Assert no error banner remained (guards against silent redirects on error)
    await expect(page.locator('.ant-alert-error')).not.toBeVisible();

    // Verify the datasource exists in the API
    const sources = await getDataSources(request);
    const created = sources.find((ds: any) => ds.Name === dsName);
    expect(created, `Datasource "${dsName}" not found in API after UI creation`).toBeTruthy();
    datasourceId = created.ID;
    // Note: cleanup.track deferred to DS-020 so the datasource persists for that test
  });

  // DS-020: View datasource in list and details — depends on DS-019 producing a datasourceId
  test('DS-020: view datasource in list', async ({ page, cleanup, request }) => {
    test.skip(!datasourceId, 'DS-019 must succeed before DS-020 can run');
    // Track for cleanup — deleted after this test completes
    cleanup.track('datasource', datasourceId);

    await page.setViewportSize({ width: 1400, height: 1100 });

    // Verify datasource still exists in API
    const sources = await getDataSources(request);
    const found = sources.find((ds: any) => ds.Name === dsName);
    expect(found, `Datasource "${dsName}" must still exist in API before UI check`).toBeTruthy();

    // Navigate to datasources list and look for the entry
    await page.goto(`${BASE_URL}/datasources`);
    await page.waitForLoadState('networkidle');

    // Wait for the list to contain the created datasource
    // (may be on any page; use the reload button or API-based navigation if not immediately visible)
    const dsText = page.getByText(dsName).first();
    if (!await dsText.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Navigate directly to the detail page by ID as fallback
      await page.goto(`${BASE_URL}/datasources/${datasourceId}`);
      await page.waitForLoadState('networkidle');
    } else {
      // Click the entry to open the detail view
      await dsText.click();
      await page.waitForLoadState('networkidle');
    }

    // Verify basic info is displayed in the detail view
    await expect(page.getByText(dsName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('P0 Test Supplier')).toBeVisible({ timeout: 5000 });
  });
});

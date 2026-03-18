/**
 * Suite P1: Datasource Edit Flows
 * Tests: DSE-001, DSE-002, DSE-003
 *
 * Strategy: API-first — create a datasource + prerequisite server via API,
 * then navigate to the edit form and perform UI interactions.
 * No API fallbacks — if the UI fails, the test fails.
 *
 * Tests:
 *   DSE-001 — Edit basic info (name, description) and save
 *   DSE-002 — Connection tab: change connection type to a different protocol
 *   DSE-003 — Output tab: add a destination, verify it appears, remove it
 */
import { test, expect } from './support';
import { EZ_API_BASE, getDataSources, createAdminServer, deleteServer, ServerDirection } from './helpers/ez-api-client';
import { clickAntTab, selectAntOption } from './support/helpers/ant-design-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';

test.describe.configure({ mode: 'serial' });

test.describe('@P1 @Datasource Datasource Edit Flows', () => {
  let datasourceId: string;
  let editUrl: string;
  let tempFtpServerId: string;
  let tempSftpOutputServerId: string;
  let tempSftpOutputServerName: string;
  let createdByTest = false;

  test.beforeAll(async ({ request }) => {
    // Create an FTP input server for DSE-002 (connection-type switching)
    const ftpServer = await createAdminServer(request, {
      Name: `P1-Edit-FTP-${Date.now()}`,
      ServerType: 'ftp',
      Direction: ServerDirection.Input,
      Host: '172.30.26.249',
      Port: 21,
      IsActive: true,
    });
    tempFtpServerId = ftpServer.ID;

    // Create an SFTP output server for DSE-003 (deterministic destination add)
    // Must be Direction.Output so it appears in /api/v1/servers/output
    tempSftpOutputServerName = `P1-Edit-SFTP-Out-${Date.now()}`;
    const sftpServer = await createAdminServer(request, {
      Name: tempSftpOutputServerName,
      ServerType: 'sftp',
      Direction: ServerDirection.Output,
      Host: '172.30.26.249',
      Port: 22,
      IsActive: true,
    });
    tempSftpOutputServerId = sftpServer.ID;

    // Use an existing datasource if available, or create one
    const existing = await getDataSources(request);
    if (existing.length > 0) {
      datasourceId = existing[0].ID;
    } else {
      const catRes = await request.get(`${EZ_API_BASE}/api/v1/Categories`);
      expect(catRes.ok(), 'Categories API must respond').toBeTruthy();
      const categories = await catRes.json();
      const categoryId = categories[0]?.ID;
      expect(categoryId, 'Need at least one category').toBeTruthy();

      const res = await request.post(`${EZ_API_BASE}/api/v1/datasources`, {
        data: {
          Name: `P1-EditTest-${Date.now()}`,
          Description: 'Datasource for edit flow tests',
          SupplierName: 'P1 Edit Supplier',
          CategoryId: categoryId,
          FilePattern: '*.csv',
          IsActive: true,
          ConnectionString: 'local:///data/input/',
          ConnectionConfig: { Type: 'local', BasePath: '/data/input/' },
          FileConfig: { Type: 'CSV' },
        },
      });
      expect(res.ok(), `Datasource POST must succeed (got ${res.status()})`).toBeTruthy();
      const body = await res.json();
      datasourceId = body?.ID || body?.Data?.ID || body?.data?.ID;
      expect(datasourceId, 'Datasource ID must be returned').toBeTruthy();
      createdByTest = true;
    }

    editUrl = `${BASE_URL}/datasources/${datasourceId}/edit`;
  });

  test.afterAll(async ({ request }) => {
    if (tempFtpServerId) {
      await deleteServer(request, tempFtpServerId).catch(() => {});
    }
    if (tempSftpOutputServerId) {
      await deleteServer(request, tempSftpOutputServerId).catch(() => {});
    }
    if (createdByTest && datasourceId) {
      await request
        .delete(`${EZ_API_BASE}/api/v1/datasources/${datasourceId}`)
        .catch(() => {});
    }
  });

  // ── DSE-001: Edit basic info ──────────────────────────────────────────────
  test('DSE-001: edit basic info — name and description are editable and save navigates away', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    // Basic tab is the default — verify name field is present
    const nameInput = page.getByRole('textbox', { name: /שם מקור הנתונים/i });
    await expect(nameInput).toBeVisible({ timeout: 8000 });

    // Read current name and update it
    const originalName = await nameInput.inputValue();
    const updatedName = `${originalName.replace(/ \(edited\)$/, '')} (edited)`;
    await nameInput.fill(updatedName);

    // Update description
    const descInput = page.getByRole('textbox', { name: /תיאור/i });
    await expect(descInput).toBeVisible({ timeout: 3000 });
    await descInput.fill('Updated description from DSE-001 test');

    // Submit via Save button
    const saveBtn = page.getByRole('button', { name: /שמור|save/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    // Successful save should navigate away from /edit
    await page.waitForURL(/datasources/, { timeout: 15000 });
    await expect(page.locator('.ant-alert-error')).not.toBeVisible();
  });

  // ── DSE-002: Change connection type ───────────────────────────────────────
  test('DSE-002: ConnectionTab — switch from current type to FTP server selection', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'connection');
    await page.waitForLoadState('networkidle');

    // Connection type select
    const connectionTypeSelect = page.locator('.ant-select:has(input#connectionType)');
    await expect(connectionTypeSelect).toBeVisible({ timeout: 8000 });

    // Switch to FTP
    await selectAntOption(page, connectionTypeSelect, 'FTP');

    // Server selection dropdown must appear
    const serverSelect = page.locator('.ant-select:has(input#inputServerId)');
    await expect(serverSelect).toBeVisible({ timeout: 10000 });

    // The temp FTP server created in beforeAll should be available
    await selectAntOption(page, serverSelect, 'P1-Edit-FTP-');

    // File path field should appear after server selection
    const filePath = page.locator('#filePath');
    await expect(filePath).toBeVisible({ timeout: 5000 });
    await filePath.fill('/data/input/');

    // No error banner
    await expect(page.locator('.ant-alert-error')).not.toBeVisible();
  });

  // ── DSE-003: Add and remove output destination ────────────────────────────
  test('DSE-003: OutputTab — add SFTP destination and verify it appears, then remove it', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    await clickAntTab(page, 'output');
    await page.waitForLoadState('networkidle');

    // Record initial destination row count
    const initialRows = await page.locator('.ant-table-row').count();

    // Open the destination editor modal
    const addBtn = page.getByRole('button', { name: /הוסף יעד/i });
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();

    // Modal must open
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });

    // Fill destination name
    const destName = `DSE-003-SFTP-${Date.now()}`;
    const nameField = page.locator('.ant-modal-content').getByRole('textbox').first();
    await expect(nameField).toBeVisible({ timeout: 3000 });
    await nameField.fill(destName);

    // Select SFTP as the destination type
    const typeSelect = page.locator('.ant-modal-content .ant-select').first();
    await selectAntOption(page, typeSelect, 'SFTP');

    // Server selector must appear for SFTP type
    const serverSelect = page.locator('.ant-modal-content .ant-select:has(input#outputServerId)');
    await expect(serverSelect).toBeVisible({ timeout: 8000 });

    // Select the pre-created SFTP output server
    await selectAntOption(page, serverSelect, tempSftpOutputServerName);

    // Path field must appear after server selection
    const pathField = page.locator('.ant-modal-content #path, .ant-modal-content input[id*="path"]').first();
    await expect(pathField).toBeVisible({ timeout: 5000 });
    await pathField.fill('/data/output/');

    // Save the destination via modal footer שמור button
    const saveBtn = page.locator('.ant-modal-footer').getByRole('button', { name: /שמור/i });
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click();

    // Modal must close after save
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 8000 });

    // New destination row must appear in the table
    await expect(page.getByText(destName)).toBeVisible({ timeout: 5000 });
    const newRowCount = await page.locator('.ant-table-row').count();
    expect(newRowCount).toBeGreaterThan(initialRows);

    // Delete the destination — find the row containing destName and click its delete button
    const destRow = page.locator('.ant-table-row').filter({ hasText: destName });
    await expect(destRow).toBeVisible({ timeout: 3000 });
    const deleteBtn = destRow.locator('button[aria-label*="delete"], button[aria-label*="מחק"], .anticon-delete').first();
    await deleteBtn.click();

    // Destination row must be removed
    await expect(page.getByText(destName)).not.toBeVisible({ timeout: 5000 });
    const finalRowCount = await page.locator('.ant-table-row').count();
    expect(finalRowCount).toBe(initialRows);
  });
});

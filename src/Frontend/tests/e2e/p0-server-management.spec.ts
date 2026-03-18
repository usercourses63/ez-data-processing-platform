/**
 * Suite 2: Server Management — P0 Acceptance Tests
 * Tests: SRV-001 to SRV-010
 *
 * Covers: Create/test/edit/toggle/delete for all server types via UI.
 * Follows patterns from existing admin-server.spec.ts.
 * Requires: File-simulator-suite running, port forwarding active.
 */
import { test, expect } from './support';
import {
  createAdminServer,
  deleteServer,
  testServerConnection,
  getServerById,
  ServerDirection,
} from './helpers/ez-api-client';

const FILE_SIMULATOR_IP = '172.30.26.249';

test.describe('@P0 @Servers Server Management', () => {

  // Navigate to Input Servers tab before each UI test
  async function goToInputServers(page: any) {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
    const serversTab = page.getByRole('tab', { name: /שרתי קלט|input servers/i });
    await serversTab.click();
    await page.waitForLoadState('networkidle');
  }

  async function goToOutputServers(page: any) {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
    const outputTab = page.getByRole('tab', { name: /שרתי פלט|output servers/i });
    await outputTab.click();
    await page.waitForLoadState('networkidle');
  }

  // SRV-001: Create FTP input server
  test('SRV-001: create FTP input server via UI', async ({ page, cleanup, request }) => {
    await goToInputServers(page);

    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForTimeout(500);

    await page.locator('#Name').fill('P0 FTP Server');

    const typeSelect = page.locator('.ant-select').filter({ hasText: /סוג שרת|בחר סוג|server type/i }).first();
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.locator('.ant-select-item-option').filter({ hasText: /^FTP$/ }).click();
    }

    await page.locator('#Host').fill(FILE_SIMULATOR_IP);
    await page.locator('#Port').fill('21');

    await page.getByRole('button', { name: /צור|create|שמור|save/i }).click();
    await page.waitForTimeout(2000);

    // Verify success — modal closes or success notification
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 10000 });

    // Track for cleanup
    const response = await request.get('http://localhost:5001/api/v1/servers');
    const servers = await response.json();
    const created = servers.find((s: any) => s.Name === 'P0 FTP Server');
    if (created) cleanup.track('server', created.ID);
  });

  // SRV-002: Create SFTP input server
  test('SRV-002: create SFTP input server via UI', async ({ page, cleanup, request }) => {
    await goToInputServers(page);

    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForTimeout(500);

    await page.locator('#Name').fill('P0 SFTP Server');

    const typeSelect = page.locator('.ant-select').filter({ hasText: /סוג שרת|בחר סוג|server type/i }).first();
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.locator('.ant-select-item-option').filter({ hasText: /^SFTP$/ }).click();
    }

    await page.locator('#Host').fill(FILE_SIMULATOR_IP);
    await page.locator('#Port').fill('22');

    await page.getByRole('button', { name: /צור|create|שמור|save/i }).click();
    await page.waitForTimeout(2000);

    // Verify success — modal closes or success notification
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 10000 });

    const response = await request.get('http://localhost:5001/api/v1/servers');
    const servers = await response.json();
    const created = servers.find((s: any) => s.Name === 'P0 SFTP Server');
    if (created) cleanup.track('server', created.ID);
  });

  // SRV-003: Create HTTP/WebDAV server
  test('SRV-003: create HTTP/WebDAV server via UI', async ({ page, cleanup, request }) => {
    await goToInputServers(page);

    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForTimeout(500);

    await page.locator('#Name').fill('P0 HTTP Server');

    const typeSelect = page.locator('.ant-select').filter({ hasText: /סוג שרת|בחר סוג|server type/i }).first();
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.locator('.ant-select-item-option').filter({ hasText: /WebDAV/ }).click();
    }

    await page.locator('#Host').fill(FILE_SIMULATOR_IP);
    await page.locator('#Port').fill('8080');

    await page.getByRole('button', { name: /צור|create|שמור|save/i }).click();
    await page.waitForTimeout(2000);

    // Verify success — modal closes or success notification
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 10000 });

    const response = await request.get('http://localhost:5001/api/v1/servers');
    const servers = await response.json();
    const created = servers.find((s: any) => s.Name === 'P0 HTTP Server');
    if (created) cleanup.track('server', created.ID);
  });

  // SRV-004: Create Kafka server (Both direction)
  test('SRV-004: create Kafka server via UI', async ({ page, cleanup, request }) => {
    await goToInputServers(page);

    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForTimeout(500);

    await page.locator('#Name').fill('P0 Kafka Server');

    const typeSelect = page.locator('.ant-select').filter({ hasText: /סוג שרת|בחר סוג|server type/i }).first();
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.locator('.ant-select-item-option').filter({ hasText: /^Kafka$/ }).click();
    }

    // Kafka-specific: bootstrap servers
    const bootstrapInput = page.locator('[id*="BootstrapServers"], [id*="bootstrapServers"]').first();
    if (await bootstrapInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bootstrapInput.fill(`${FILE_SIMULATOR_IP}:30094`);
    } else {
      // Fallback to host/port
      await page.locator('#Host').fill(FILE_SIMULATOR_IP);
      await page.locator('#Port').fill('30094');
    }

    await page.getByRole('button', { name: /צור|create|שמור|save/i }).click();
    await page.waitForTimeout(2000);

    // Verify success — modal closes or success notification
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 10000 });

    const response = await request.get('http://localhost:5001/api/v1/servers');
    const servers = await response.json();
    const created = servers.find((s: any) => s.Name === 'P0 Kafka Server');
    if (created) cleanup.track('server', created.ID);
  });

  // SRV-005: Create S3 server (may fail if S3-specific required fields not met)
  test('SRV-005: create S3 server via UI', async ({ page, cleanup, request }) => {
    test.slow(); // S3 form may have extra required fields
    await goToInputServers(page);

    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForTimeout(500);

    await page.locator('#Name').fill('P0 S3 Server');

    const typeSelect = page.locator('.ant-select').filter({ hasText: /סוג שרת|בחר סוג|server type/i }).first();
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.locator('.ant-select-item-option').filter({ hasText: /S3/ }).click();
    }

    // S3 requires Host
    await page.locator('#Host').fill(`${FILE_SIMULATOR_IP}`);

    // S3-specific fields (bucket may be in TypeSpecificConfig)
    const bucketInput = page.locator('[id*="Bucket"], [id*="bucket"]').first();
    if (await bucketInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bucketInput.fill('test-bucket');
    }

    await page.getByRole('button', { name: /צור|create|שמור|save/i }).click();
    await page.waitForTimeout(2000);

    // Verify success — modal closes or success notification
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 10000 });

    const response = await request.get('http://localhost:5001/api/v1/servers');
    const servers = await response.json();
    const created = servers.find((s: any) => s.Name === 'P0 S3 Server');
    if (created) cleanup.track('server', created.ID);
  });

  // SRV-006: Create Folder output server
  test('SRV-006: create Folder output server via UI', async ({ page, cleanup, request }) => {
    await goToOutputServers(page);

    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForTimeout(500);

    await page.locator('#Name').fill('P0 Folder Output');

    const typeSelect = page.locator('.ant-select').filter({ hasText: /סוג שרת|בחר סוג|server type/i }).first();
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.locator('.ant-select-item-option').filter({ hasText: /^Output Folder$/ }).click();
    }

    const basePath = page.locator('#BasePath');
    if (await basePath.isVisible({ timeout: 3000 }).catch(() => false)) {
      await basePath.fill('/tmp/ez-output');
    }

    await page.getByRole('button', { name: /צור|create|שמור|save/i }).click();
    await page.waitForTimeout(2000);

    // Verify success — modal closes or success notification
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 10000 });

    const response = await request.get('http://localhost:5001/api/v1/servers');
    const servers = await response.json();
    const created = servers.find((s: any) => s.Name === 'P0 Folder Output');
    if (created) cleanup.track('server', created.ID);
  });

  // SRV-007: Test server connection (API-level, fast)
  // Uses HTTP server which is the simplest to connect (no auth needed)
  test('SRV-007: test server connection succeeds', async ({ cleanup, request }) => {
    const server = await createAdminServer(request, {
      Name: 'P0 ConnTest Server',
      ServerType: 'HTTP',
      Direction: ServerDirection.Input,
      Host: FILE_SIMULATOR_IP,
      Port: 30088, // NodePort for file-simulator HTTP
      BasePath: '/',
    });
    cleanup.track('server', server.ID);

    const result = await testServerConnection(request, server.ID);
    expect(result.Success).toBe(true);
  });

  // SRV-008: Toggle server active/inactive
  test('SRV-008: toggle server active status via UI', async ({ page, cleanup, request }) => {
    const server = await createAdminServer(request, {
      Name: 'P0 Toggle Server',
      ServerType: 'FTP',
      Direction: ServerDirection.Input,
      Host: FILE_SIMULATOR_IP,
      Port: 21,
      BasePath: '/data',
    });
    cleanup.track('server', server.ID);

    await goToInputServers(page);

    // Find the toggle switch in the server's row
    const row = page.locator('.ant-table-row').filter({ hasText: 'P0 Toggle Server' });
    await expect(row).toBeVisible({ timeout: 10000 });

    const toggle = row.locator('.ant-switch');
    if (await toggle.count() > 0) {
      await toggle.click();
      await page.waitForTimeout(1000);

      const updated = await getServerById(request, server.ID);
      expect(updated.IsActive).toBe(false);
    }
  });

  // SRV-009: Edit server
  test('SRV-009: edit server name via UI', async ({ page, cleanup, request }) => {
    const server = await createAdminServer(request, {
      Name: 'P0 Edit Server',
      ServerType: 'FTP',
      Direction: ServerDirection.Input,
      Host: FILE_SIMULATOR_IP,
      Port: 21,
      BasePath: '/data',
    });
    cleanup.track('server', server.ID);

    await goToInputServers(page);

    const row = page.locator('.ant-table-row').filter({ hasText: 'P0 Edit Server' });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click edit button
    const editBtn = row.getByRole('button', { name: /עריכה|edit/i });
    if (await editBtn.count() > 0) {
      await editBtn.click();
    } else {
      // Fallback: click any edit icon in the row
      const editIcon = row.locator('[aria-label*="edit"], .anticon-edit').first();
      await editIcon.click();
    }
    await page.waitForTimeout(500);

    // Update name
    const nameInput = page.locator('#Name');
    await nameInput.clear();
    await nameInput.fill('P0 Edited Server');

    await page.getByRole('button', { name: /שמור|save|עדכן|update|צור|create/i }).click();
    await page.waitForTimeout(2000);

    // Verify updated in list
    await expect(page.getByText('P0 Edited Server')).toBeVisible({ timeout: 10000 });
  });

  // SRV-010: Delete server
  test('SRV-010: delete server via UI', async ({ page, request }) => {
    const server = await createAdminServer(request, {
      Name: 'P0 Delete Server',
      ServerType: 'FTP',
      Direction: ServerDirection.Input,
      Host: FILE_SIMULATOR_IP,
      Port: 21,
      BasePath: '/data',
    });
    // Don't track — we're deleting in the test

    await goToInputServers(page);

    const row = page.locator('.ant-table-row').filter({ hasText: 'P0 Delete Server' });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click delete button
    const deleteBtn = row.getByRole('button', { name: /מחיקה|delete/i });
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
    } else {
      const deleteIcon = row.locator('[aria-label*="delete"], .anticon-delete').first();
      await deleteIcon.click();
    }
    await page.waitForTimeout(500);

    // Confirm deletion
    const confirmBtn = page.getByRole('button', { name: /אישור|confirm|ok|כן|yes/i });
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(2000);

    // Verify removed
    await expect(page.getByText('P0 Delete Server')).not.toBeVisible({ timeout: 10000 });
  });
});

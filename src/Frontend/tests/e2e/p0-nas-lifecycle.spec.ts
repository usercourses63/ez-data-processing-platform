/**
 * Suite 3: NAS Device Lifecycle — P0 Acceptance Tests
 * Tests: NAS-001 to NAS-006
 *
 * Full lifecycle: Create → Provision PV/PVC → Mount → Verify → Edit → Cleanup
 * Strategy: API-first for reliability. UI interaction tested in existing nas-devices.spec.ts.
 * Requires: File-simulator-suite NFS server running.
 */
import { test, expect } from './support';
import {
  createNasDevice,
  provisionNasDevice,
  testNasConnection,
  deprovisionNasDevice,
  deleteNasDevice,
  getNasDevices,
  waitForMountReady,
  waitForDeploymentReady,
  NasDeviceRole,
  EZ_API_BASE,
} from './helpers/ez-api-client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';
const NFS_HOST = '172.30.26.249';
const NFS_NODEPORT = 32150;

test.describe.configure({ mode: 'serial' });

test.describe('@P0 @NAS NAS Device Lifecycle', () => {

  // NAS-001: Create NAS device
  test('NAS-001: create NAS device and verify via API', async ({ cleanup, request }) => {
    const device = await createNasDevice(request, {
      Name: 'P0 NAS Device',
      Host: NFS_HOST,
      Port: NFS_NODEPORT,
      ExportPath: '/',
      Role: NasDeviceRole.Input,
      MountOptions: ['nfsvers=4', 'nolock'],
    });
    cleanup.track('nasDevice', device.ID);

    expect(device.ID).toBeTruthy();
    expect(device.Name).toBe('P0 NAS Device');
    expect(device.Host).toBe(NFS_HOST);

    // Verify retrievable
    const devices = await getNasDevices(request);
    const found = devices.find((d: any) => d.ID === device.ID);
    expect(found).toBeTruthy();
  });

  // NAS-002: Provision PV/PVC and verify binding
  test('NAS-002: provision PV/PVC and verify binding', async ({ cleanup, request }) => {
    test.setTimeout(180000); // 3 min: provision (120s) + binding check + buffer
    const device = await createNasDevice(request, {
      Name: 'P0 Provision NAS',
      Host: NFS_HOST,
      Port: NFS_NODEPORT,
      ExportPath: '/',
      Role: NasDeviceRole.Input,
      MountOptions: ['nfsvers=4', 'nolock'],
    });
    cleanup.track('nasDevice', device.ID);

    await provisionNasDevice(request, device.ID, {
      CreatePv: true,
      CreatePvc: true,
      WaitForBinding: true,
      TimeoutSeconds: 120,
    });

    const devices = await getNasDevices(request);
    const provisioned = devices.find((d: any) => d.ID === device.ID);
    expect(provisioned).toBeTruthy();
    expect(provisioned!.IsPvCreated).toBe(true);
    expect(provisioned!.IsPvcBound).toBe(true);
    expect(provisioned!.IsProvisioned).toBe(true);
  });

  // NAS-003: Mount and verify connection
  test('NAS-003: mount NAS and verify connection', async ({ cleanup, request }) => {
    test.setTimeout(300000); // 5 min: provision + rollout + mount check + connection test

    const device = await createNasDevice(request, {
      Name: 'P0-Mount-NAS',
      Host: NFS_HOST,
      Port: NFS_NODEPORT,
      ExportPath: '/',
      Role: NasDeviceRole.Input,
      MountOptions: ['nfsvers=4', 'nolock'],
    });
    cleanup.track('nasDevice', device.ID);

    await provisionNasDevice(request, device.ID, {
      CreatePv: true,
      CreatePvc: true,
      WaitForBinding: true,
      TimeoutSeconds: 120,
    });

    // Wait for the datasource-management deployment to roll out the new pod
    // (provisioning patches the deployment with a new volume mount)
    await waitForDeploymentReady(request, 120000);

    // Use the device's actual MountPath (e.g. /mnt/P0-Mount-NAS), not its ID
    await waitForMountReady(request, device.MountPath, 90000);

    const result = await testNasConnection(request, device.ID);
    expect((result as any).Success).toBe(true);
  });

  // NAS-004: Use NAS as datasource input — verify selectable in UI
  test('NAS-004: NAS device selectable in datasource form', async ({ page, cleanup, request }) => {
    const device = await createNasDevice(request, {
      Name: 'P0 Selectable NAS',
      Host: NFS_HOST,
      Port: NFS_NODEPORT,
      ExportPath: '/',
      Role: NasDeviceRole.Input,
      MountOptions: ['nfsvers=4', 'nolock'],
    });
    cleanup.track('nasDevice', device.ID);

    await provisionNasDevice(request, device.ID, {
      CreatePv: true,
      CreatePvc: true,
      WaitForBinding: true,
      TimeoutSeconds: 120,
    });

    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto(`${BASE_URL}/datasources/new`);
    await page.waitForLoadState('networkidle');

    const nasSelect = page.locator('.ant-select').filter({ hasText: /NAS|התקן/i }).first();
    if (await nasSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nasSelect.click();
      await page.waitForTimeout(500);
      const options = page.locator('.ant-select-item-option');
      const count = await options.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text?.includes('P0 Selectable NAS')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });

  // NAS-005: Edit NAS device
  test('NAS-005: edit NAS device via API', async ({ cleanup, request }) => {
    const device = await createNasDevice(request, {
      Name: 'P0 Edit NAS',
      Host: NFS_HOST,
      Port: NFS_NODEPORT,
      ExportPath: '/',
      Role: NasDeviceRole.Input,
      Description: 'original',
    });
    cleanup.track('nasDevice', device.ID);

    const updateRes = await request.put(`${EZ_API_BASE}/api/v1/nasdevices/${device.ID}`, {
      data: {
        Name: 'P0 Edit NAS',
        Host: NFS_HOST,
        Port: NFS_NODEPORT,
        ExportPath: '/',
        Role: NasDeviceRole.Input,
        Description: 'Updated via P0 test',
      },
    });
    expect(updateRes.ok()).toBeTruthy();

    const devices = await getNasDevices(request);
    const updated = devices.find((d: any) => d.ID === device.ID);
    expect(updated?.Description).toContain('Updated');
  });

  // NAS-006: Deprovision and delete
  test('NAS-006: deprovision and delete NAS device', async ({ request }) => {
    test.setTimeout(180000); // 3 min: provision + deprovision + delete
    const device = await createNasDevice(request, {
      Name: 'P0 Cleanup NAS',
      Host: NFS_HOST,
      Port: NFS_NODEPORT,
      ExportPath: '/',
      Role: NasDeviceRole.Input,
    });

    await provisionNasDevice(request, device.ID, {
      CreatePv: true,
      CreatePvc: true,
      WaitForBinding: true,
      TimeoutSeconds: 120,
    });

    await deprovisionNasDevice(request, device.ID);
    await new Promise(r => setTimeout(r, 5000));

    await deleteNasDevice(request, device.ID);

    const devicesAfter = await getNasDevices(request);
    const found = devicesAfter.find((d: any) => d.ID === device.ID && !d.IsDeleted);
    expect(found).toBeFalsy();
  });
});

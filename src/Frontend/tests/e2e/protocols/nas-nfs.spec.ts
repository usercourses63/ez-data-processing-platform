/**
 * NAS/NFS Protocol E2E Tests
 *
 * Tests file operations against EXISTING seeded NAS devices.
 * NAS devices are pre-provisioned by DemoDataGenerator + admin provisioning.
 * This test does NOT create, provision, or delete NAS devices — it only
 * verifies that the already-mounted NFS paths support file operations.
 *
 * Strategy: Uses a folder-type AdminServer pointing to the NAS mount path
 * inside the DSM pod. The LocalFileConnector handles list/read/write.
 *
 * Prerequisites:
 * - DemoDataGenerator has seeded NAS devices
 * - NAS devices are provisioned (PV/PVC bound, mounted in DSM pod)
 * - DSM pod has /mnt/nas, /mnt/nas-input-1, etc. mounted
 */
import { test, expect } from '@playwright/test';
import {
  getSimulatorHealth,
} from '../helpers/simulator-client';
import {
  createAdminServer,
  testNasConnection,
  getNasDevices,
  listFiles,
  readFile,
  writeFile,
  deleteServer,
  EZ_API_BASE,
  ServerDirection,
  NasDeviceResponse,
} from '../helpers/ez-api-client';
import { FORMATS, loadTestData, verifyFileContent, TestDataFormat } from '../helpers/test-data';
import { matrixReporter } from '../helpers/report-generator';

// Enable file-based persistence so results survive Playwright worker isolation
matrixReporter.enablePersistence('nas-nfs');

const PROTOCOL = 'NAS/NFS';

/**
 * Find a seeded NAS device that is provisioned and ready.
 * Prefers devices with 'input' in the name, falls back to any provisioned device.
 */
async function findProvisionedNasDevice(
  request: import('@playwright/test').APIRequestContext
): Promise<NasDeviceResponse | null> {
  const devices = await getNasDevices(request);
  // Prefer an input device (has data written by DemoDataGenerator)
  const inputDevice = devices.find(d => d.IsProvisioned && d.Name.toLowerCase().includes('input'));
  if (inputDevice) return inputDevice;
  // Fall back to any provisioned device
  return devices.find(d => d.IsProvisioned) || null;
}

// ============================================================
// NAS/NFS Tests — Using Pre-Seeded Devices
// ============================================================

test.describe('NAS/NFS - Seeded Devices', () => {
  let nasDevice: NasDeviceResponse | null = null;
  let folderServerId: string | null = null;

  test.beforeAll(async ({ request }, testInfo) => {
    testInfo.setTimeout(60000);

    // 1. Check simulator health
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for NAS/NFS tests').toBeTruthy();

    // 2. Find a provisioned NAS device from seeded data
    nasDevice = await findProvisionedNasDevice(request);
    if (!nasDevice) {
      console.warn('[nas-nfs.spec] No provisioned NAS device found. Run DemoDataGenerator and provision NAS devices first.');
      return;
    }

    console.log(`[nas-nfs.spec] Using seeded NAS device: ${nasDevice.Name} (${nasDevice.ID})`);
    console.log(`[nas-nfs.spec] Mount path: ${nasDevice.MountPath}, Host: ${nasDevice.Host}:${nasDevice.Port}`);

    // 3. Create a temporary folder-type AdminServer pointing to the NAS mount path
    //    This allows file operations via the LocalFileConnector
    const folderServer = await createAdminServer(request, {
      Name: `e2e-nas-folder-${Date.now()}`,
      ServerType: 'folder',
      Direction: ServerDirection.Both,
      Host: 'localhost',
      Port: 0,
      BasePath: nasDevice.MountPath,
    });
    folderServerId = folderServer.ID;
    console.log(`[nas-nfs.spec] Created folder server ${folderServerId} → ${nasDevice.MountPath}`);
  });

  test('TestConnection - seeded NAS device', async ({ request }) => {
    test.skip(!nasDevice, 'No provisioned NAS device available');
    test.setTimeout(30000);

    let passed = false;
    let errorMessage: string | undefined;
    let durationMs: number | undefined;

    try {
      const result = await testNasConnection(request, nasDevice!.ID) as any;
      passed = result.Success === true || result.IsReachable === true || result.success === true;
      errorMessage = result.ErrorMessage || result.errorMessage;
      durationMs = result.ConnectionTimeMs || result.connectionTimeMs;
    } catch (err: any) {
      errorMessage = err.message;
    }

    matrixReporter.addResult(PROTOCOL, 'all', 'TestConnection', passed, errorMessage, durationMs);
    expect(passed, `NAS TestConnection failed: ${errorMessage}`).toBeTruthy();
  });

  for (const format of FORMATS) {
    test(`Write + List + Read - ${format}`, async ({ request }) => {
      test.skip(!nasDevice || !folderServerId, 'No provisioned NAS device or folder server');
      test.setTimeout(60000);

      const timestamp = Date.now();
      const fileName = `e2e-test-${timestamp}.${format}`;
      const testData = loadTestData(format as TestDataFormat);

      // WRITE
      let writePassed = false;
      let writeError: string | undefined;
      try {
        await writeFile(request, folderServerId!, fileName, testData);
        writePassed = true;
      } catch (err: any) {
        writeError = err.message;
      }
      matrixReporter.addResult(PROTOCOL, format, 'Write', writePassed, writeError);
      expect(writePassed, `NAS Write ${format} failed: ${writeError}`).toBeTruthy();

      // LIST
      let listPassed = false;
      let listError: string | undefined;
      try {
        const files = await listFiles(request, folderServerId!, undefined, '*');
        const found = files.some(f => f.FileName === fileName || f.FullPath.includes(fileName));
        listPassed = found;
        if (!found) {
          listError = `File ${fileName} not found in listing. Got: ${files.map(f => f.FileName).join(', ')}`;
        }
      } catch (err: any) {
        listError = err.message;
      }
      matrixReporter.addResult(PROTOCOL, format, 'List', listPassed, listError);
      expect(listPassed, `NAS List ${format} failed: ${listError}`).toBeTruthy();

      // READ
      let readPassed = false;
      let readError: string | undefined;
      try {
        const retrieved = await readFile(request, folderServerId!, fileName);
        readPassed = verifyFileContent(testData, retrieved, format as TestDataFormat);
        if (!readPassed) {
          readError = `Content verification failed for ${format} (original=${testData.length}B, retrieved=${retrieved.length}B)`;
        }
      } catch (err: any) {
        readError = err.message;
      }
      matrixReporter.addResult(PROTOCOL, format, 'Read', readPassed, readError);
      expect(readPassed, `NAS Read ${format} failed: ${readError}`).toBeTruthy();
    });
  }

  test.afterAll(async ({ request }) => {
    // Only clean up the temporary folder server — never touch the seeded NAS device
    if (folderServerId) {
      try {
        await deleteServer(request, folderServerId);
        console.log(`[nas-nfs.spec] Cleaned up folder server ${folderServerId}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Cleanup failed for folder server: ${err}`);
      }
    }
  });
});

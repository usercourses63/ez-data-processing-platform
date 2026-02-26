/**
 * NAS/NFS Protocol E2E Tests
 *
 * Tests file operations (TestConnection, List, Read, Write) against
 * NAS/NFS servers on the file-simulator cluster.
 *
 * NAS/NFS is the most complex protocol to test because it requires
 * Kubernetes PV/PVC provisioning before file operations can work.
 * The NfsConnector reads from the PVC mount path inside the pod.
 *
 * Strategy: NFS operations go through the filesystem via PVC-mounted paths.
 * Since FileOperationsController only works with AdminServer IDs, we create
 * an AdminServer of type 'folder' with BasePath set to the NAS device's
 * mount path. The LocalFileConnector (folder type) can then list/read/write
 * from the NFS-mounted path inside the pod.
 *
 * Capability matrix:
 *   TestConnection: YES (via NAS device test-connection endpoint)
 *   List:           YES (via folder AdminServer on NFS mount path)
 *   Read:           YES (via folder AdminServer on NFS mount path)
 *   Write:          YES (via folder AdminServer on NFS mount path)
 *
 * Scenario A: Static NAS devices (pre-existing on simulator)
 * Scenario B: Dynamic NAS devices (created via simulator API, registered in EZ)
 */
import { test, expect } from '@playwright/test';
import {
  getSimulatorHealth,
  getSimulatorServers,
  getConnectionInfo,
  filterServersByProtocol,
  createDynamicNas,
  deleteSimulatorServer,
  SimulatorServer,
} from '../helpers/simulator-client';
import {
  createAdminServer,
  testServerConnection,
  createNasDevice,
  provisionNasDevice,
  deprovisionNasDevice,
  testNasConnection,
  getNasDevices,
  deleteNasDevice,
  listFiles,
  readFile,
  writeFile,
  deleteServer,
  waitForDeploymentReady,
  AdminServerResponse,
  NasDeviceResponse,
  EZ_API_BASE,
  ServerDirection,
  NasDeviceRole,
} from '../helpers/ez-api-client';
import { addNasDeviceViaUI } from '../helpers/ui-helpers';
import { FORMATS, loadTestData, getTestDataFileName, verifyFileContent, TestDataFormat } from '../helpers/test-data';
import { matrixReporter } from '../helpers/report-generator';

// Enable file-based persistence so results survive Playwright worker isolation
matrixReporter.enablePersistence('nas-nfs');

const PROTOCOL = 'NAS/NFS';
const SIMULATOR_HOST = '172.17.89.141';

/**
 * Wait for a NAS device to be provisioned (PVC bound and mounted).
 * Polls every 5 seconds up to the specified timeout.
 */
async function waitForProvisioning(
  request: import('@playwright/test').APIRequestContext,
  deviceId: string,
  timeoutMs: number = 90000
): Promise<boolean> {
  const maxAttempts = Math.ceil(timeoutMs / 5000);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await request.get(`${EZ_API_BASE}/api/v1/nasdevices/${deviceId}`);
      if (response.ok()) {
        const device = await response.json();
        // Backend returns IsProvisioned (bool) and IsPvcBound (bool), not a string status
        const isProvisioned = device.IsProvisioned === true;
        const isPvcBound = device.IsPvcBound === true;
        console.log(`[nas-nfs.spec] Provisioning poll ${i + 1}/${maxAttempts}: IsProvisioned=${isProvisioned}, IsPvcBound=${isPvcBound}`);
        if (isProvisioned && isPvcBound) {
          return true;
        }
      }
    } catch (err) {
      console.warn(`[nas-nfs.spec] Provisioning poll error: ${err}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.error(`[nas-nfs.spec] Provisioning timed out after ${timeoutMs}ms for device ${deviceId}`);
  return false;
}

/**
 * Get NAS device by ID directly
 */
async function getNasDeviceById(
  request: import('@playwright/test').APIRequestContext,
  deviceId: string
): Promise<NasDeviceResponse> {
  const response = await request.get(`${EZ_API_BASE}/api/v1/nasdevices/${deviceId}`);
  if (!response.ok()) {
    throw new Error(`Failed to get NAS device ${deviceId}: ${response.status()}`);
  }
  return response.json();
}

// ============================================================
// Scenario A: Static NAS Devices
// ============================================================

test.describe('NAS/NFS - Scenario A: Static Devices', () => {
  let nasServers: SimulatorServer[];
  let nasServer: SimulatorServer;
  let nasDeviceId: string | null = null;
  let folderServerId: string | null = null;
  let mountPath: string;
  let createdNasDevice = false;

  test.beforeAll(async ({ request }) => {
    // 1. Check simulator health - MUST fail if unavailable
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for NAS/NFS tests').toBeTruthy();

    // 2. Discover static NAS servers
    const allServers = await getSimulatorServers(request);
    nasServers = filterServersByProtocol(allServers, 'nas');
    if (nasServers.length === 0) {
      nasServers = filterServersByProtocol(allServers, 'nfs');
    }
    expect(nasServers.length, 'At least one static NAS/NFS server must exist on simulator').toBeGreaterThan(0);

    nasServer = nasServers[0];
    console.log(`[nas-nfs.spec] Using static NAS server: ${nasServer.name} (${nasServer.clusterIp}:${nasServer.port})`);

    // 3. Check if NAS device already registered in EZ
    const existingDevices = await getNasDevices(request);
    const existingDevice = existingDevices.find(
      (d) =>
        d.Host === SIMULATOR_HOST ||
        d.Host === nasServer.clusterIp ||
        d.Name.toLowerCase().includes('static')
    );

    if (existingDevice && existingDevice.IsProvisioned && existingDevice.IsPvcBound) {
      nasDeviceId = existingDevice.ID;
      mountPath = existingDevice.MountPath || `/mnt/${existingDevice.Name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      console.log(`[nas-nfs.spec] Reusing existing provisioned NAS device: ${existingDevice.Name} (${nasDeviceId})`);
    } else {
      // Delete stale E2E device if exists but not properly provisioned
      if (existingDevice) {
        console.log(`[nas-nfs.spec] Found stale NAS device ${existingDevice.Name} (provisioned=${existingDevice.IsProvisioned}, pvcBound=${existingDevice.IsPvcBound}), deleting...`);
        try {
          await deprovisionNasDevice(request, existingDevice.ID);
        } catch { /* ignore */ }
        try {
          await deleteNasDevice(request, existingDevice.ID);
        } catch { /* ignore */ }
      }
      // 4. Create NAS device in EZ
      const timestamp = Date.now();
      const exportPath = `/exports/${nasServer.name}`;
      const device = await createNasDevice(request, {
        Name: `E2E-NAS-Static-${timestamp}`,
        Host: SIMULATOR_HOST,
        Port: nasServer.nodePort || 2049,
        ExportPath: exportPath,
        Role: NasDeviceRole.Both,
        Description: 'E2E static NAS device for protocol testing',
      });

      nasDeviceId = device.ID;
      createdNasDevice = true;
      mountPath = device.MountPath || `/mnt/${device.Name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      console.log(`[nas-nfs.spec] Created NAS device: ${device.Name} (${nasDeviceId})`);

      // 5. Provision the NAS device (create PV/PVC)
      console.log(`[nas-nfs.spec] Provisioning NAS device ${nasDeviceId}...`);
      try {
        await provisionNasDevice(request, nasDeviceId, {
          Namespace: 'ez-platform',
          CreatePv: true,
          CreatePvc: true,
          WaitForBinding: true,
          TimeoutSeconds: 60,
        });
      } catch (err) {
        console.warn(`[nas-nfs.spec] Provision call returned error (may still be provisioning): ${err}`);
      }

      // 6. Wait for provisioning to complete
      const provisioned = await waitForProvisioning(request, nasDeviceId, 90000);
      if (!provisioned) {
        console.warn('[nas-nfs.spec] Provisioning may not have completed; tests may fail');
      }

      // 7. Wait for deployment rollout to complete (provisioning patches deployment
      //    with new volume mount, triggering pod restart)
      console.log('[nas-nfs.spec] Waiting for deployment rollout after provisioning...');
      const ready = await waitForDeploymentReady(request, 90000);
      if (!ready) {
        console.warn('[nas-nfs.spec] Deployment rollout may not have completed; file ops may fail');
      }
    }

    // 8. Create a folder-type AdminServer pointing to the NAS mount path
    // This allows file operations via FileOperationsController
    const folderServer = await createAdminServer(request, {
      Name: `E2E-NAS-Folder-${Date.now()}`,
      ServerType: 'folder',
      Direction: ServerDirection.Both,
      Host: 'localhost',
      Port: 0,
      BasePath: mountPath,
    });
    folderServerId = folderServer.ID;
    console.log(`[nas-nfs.spec] Created folder server ${folderServerId} pointing to ${mountPath}`);
  });

  test('TestConnection - static NAS', async ({ request }) => {
    test.setTimeout(60000);
    expect(nasDeviceId, 'NAS device must be registered before TestConnection').toBeTruthy();

    let passed = false;
    let errorMessage: string | undefined;
    let durationMs: number | undefined;

    try {
      const result = await testNasConnection(request, nasDeviceId!) as any;
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
      test.setTimeout(120000); // 2 min for NAS (provisioning delays)
      expect(folderServerId, 'Folder server must be created before file operations').toBeTruthy();

      const timestamp = Date.now();
      const fileName = `test-data-${timestamp}.${format}`;
      const testData = loadTestData(format as TestDataFormat);

      // WRITE via folder server pointing to NAS mount
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
        const found = files.some((f) => f.FileName === fileName || f.FullPath.includes(fileName));
        listPassed = found;
        if (!found) {
          listError = `File ${fileName} not found in listing. Got: ${files.map((f) => f.FileName).join(', ')}`;
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
    // Clean up folder server (always)
    if (folderServerId) {
      try {
        await deleteServer(request, folderServerId);
        console.log(`[nas-nfs.spec] Cleaned up folder server ${folderServerId}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Cleanup failed for folder server: ${err}`);
      }
    }
    // Deprovision and delete NAS device if we created it
    if (createdNasDevice && nasDeviceId) {
      try {
        console.log(`[nas-nfs.spec] Deprovisioning static NAS device ${nasDeviceId}...`);
        await deprovisionNasDevice(request, nasDeviceId);
        console.log(`[nas-nfs.spec] Deprovisioned static NAS device ${nasDeviceId}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Deprovision failed for static NAS device: ${err}`);
      }
      try {
        await deleteNasDevice(request, nasDeviceId);
        console.log(`[nas-nfs.spec] Deleted static NAS device ${nasDeviceId}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Delete failed for static NAS device: ${err}`);
      }
    }
  });
});

// ============================================================
// Scenario B: Dynamic NAS Devices
// ============================================================

test.describe('NAS/NFS - Scenario B: Dynamic Devices', () => {
  let dynamicNasServer: SimulatorServer | null = null;
  let nasDeviceId: string | null = null;
  let folderServerId: string | null = null;
  let mountPath: string;
  const dynamicNasName = `e2e-dynamic-nas-${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    // 1. Check simulator health
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for dynamic NAS tests').toBeTruthy();

    // 2. Create dynamic NAS server on simulator
    console.log(`[nas-nfs.spec] Creating dynamic NAS server: ${dynamicNasName}`);
    dynamicNasServer = await createDynamicNas(request, dynamicNasName, 'data/dynamic');
    expect(dynamicNasServer, 'Dynamic NAS server must be created on simulator').toBeTruthy();
    console.log(
      `[nas-nfs.spec] Dynamic NAS created: ${dynamicNasServer.name} ` +
      `(${dynamicNasServer.clusterIp}:${dynamicNasServer.port}, NodePort=${dynamicNasServer.nodePort})`
    );

    // Wait for NAS server to be ready on simulator
    await new Promise((r) => setTimeout(r, 5000));

    // 3. Register NAS device in EZ via API (more reliable than UI for provisioning flow)
    const timestamp = Date.now();
    const exportPath = `/exports/${dynamicNasName}`;
    const device = await createNasDevice(request, {
      Name: `E2E-NAS-Dynamic-${timestamp}`,
      Host: SIMULATOR_HOST,
      Port: dynamicNasServer.nodePort || 2049,
      ExportPath: exportPath,
      Role: NasDeviceRole.Both,
      Description: `E2E dynamic NAS device from simulator (${dynamicNasName})`,
    });

    nasDeviceId = device.ID;
    mountPath = device.MountPath || `/mnt/${device.Name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    console.log(`[nas-nfs.spec] Created NAS device in EZ: ${device.Name} (${nasDeviceId})`);

    // 4. Provision via API (more reliable than UI)
    console.log(`[nas-nfs.spec] Provisioning dynamic NAS device ${nasDeviceId}...`);
    try {
      await provisionNasDevice(request, nasDeviceId, {
        Namespace: 'ez-platform',
        CreatePv: true,
        CreatePvc: true,
        WaitForBinding: true,
        TimeoutSeconds: 60,
      });
    } catch (err) {
      console.warn(`[nas-nfs.spec] Provision call returned error (may still be provisioning): ${err}`);
    }

    // 5. Wait for provisioning (PVC binding + pod mount can take up to 60s)
    const provisioned = await waitForProvisioning(request, nasDeviceId, 90000);
    if (!provisioned) {
      console.warn('[nas-nfs.spec] Dynamic NAS provisioning may not have completed; tests may fail');
    }

    // 6. Wait for deployment rollout after provisioning
    console.log('[nas-nfs.spec] Waiting for deployment rollout after dynamic NAS provisioning...');
    const ready = await waitForDeploymentReady(request, 90000);
    if (!ready) {
      console.warn('[nas-nfs.spec] Deployment rollout may not have completed; file ops may fail');
    }

    // 7. Create folder-type AdminServer for file operations on the NAS mount
    const folderServer = await createAdminServer(request, {
      Name: `E2E-NAS-Dynamic-Folder-${timestamp}`,
      ServerType: 'folder',
      Direction: ServerDirection.Both,
      Host: 'localhost',
      Port: 0,
      BasePath: mountPath,
    });
    folderServerId = folderServer.ID;
    console.log(`[nas-nfs.spec] Created dynamic folder server ${folderServerId} at ${mountPath}`);
  });

  test('TestConnection - dynamic NAS', async ({ request }) => {
    test.setTimeout(60000);
    expect(nasDeviceId, 'Dynamic NAS device must be registered before TestConnection').toBeTruthy();

    let passed = false;
    let errorMessage: string | undefined;
    let durationMs: number | undefined;

    try {
      const result = await testNasConnection(request, nasDeviceId!) as any;
      passed = result.Success === true || result.IsReachable === true || result.success === true;
      errorMessage = result.ErrorMessage || result.errorMessage;
      durationMs = result.ConnectionTimeMs || result.connectionTimeMs;
    } catch (err: any) {
      errorMessage = err.message;
    }

    matrixReporter.addResult(`${PROTOCOL} (dynamic)`, 'all', 'TestConnection', passed, errorMessage, durationMs);
    expect(passed, `Dynamic NAS TestConnection failed: ${errorMessage}`).toBeTruthy();
  });

  for (const format of FORMATS) {
    test(`Write + List + Read - ${format} (dynamic)`, async ({ request }) => {
      test.setTimeout(120000); // 2 min for NAS
      expect(folderServerId, 'Dynamic folder server must be created before file operations').toBeTruthy();

      const timestamp = Date.now();
      const fileName = `test-data-dynamic-${timestamp}.${format}`;
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
      matrixReporter.addResult(`${PROTOCOL} (dynamic)`, format, 'Write', writePassed, writeError);
      expect(writePassed, `Dynamic NAS Write ${format} failed: ${writeError}`).toBeTruthy();

      // LIST
      let listPassed = false;
      let listError: string | undefined;
      try {
        const files = await listFiles(request, folderServerId!, undefined, '*');
        const found = files.some((f) => f.FileName === fileName || f.FullPath.includes(fileName));
        listPassed = found;
        if (!found) {
          listError = `File ${fileName} not found in listing. Got: ${files.map((f) => f.FileName).join(', ')}`;
        }
      } catch (err: any) {
        listError = err.message;
      }
      matrixReporter.addResult(`${PROTOCOL} (dynamic)`, format, 'List', listPassed, listError);
      expect(listPassed, `Dynamic NAS List ${format} failed: ${listError}`).toBeTruthy();

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
      matrixReporter.addResult(`${PROTOCOL} (dynamic)`, format, 'Read', readPassed, readError);
      expect(readPassed, `Dynamic NAS Read ${format} failed: ${readError}`).toBeTruthy();
    });
  }

  test.afterAll(async ({ request }) => {
    // Clean up folder server
    if (folderServerId) {
      try {
        await deleteServer(request, folderServerId);
        console.log(`[nas-nfs.spec] Cleaned up dynamic folder server ${folderServerId}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Cleanup failed for dynamic folder server: ${err}`);
      }
    }

    // Deprovision NAS device (removes mounts, PVC, PV) then delete
    if (nasDeviceId) {
      try {
        console.log(`[nas-nfs.spec] Deprovisioning dynamic NAS device ${nasDeviceId}...`);
        await deprovisionNasDevice(request, nasDeviceId);
        console.log(`[nas-nfs.spec] Deprovisioned dynamic NAS device ${nasDeviceId}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Deprovision failed for dynamic NAS device: ${err}`);
      }
      try {
        await deleteNasDevice(request, nasDeviceId);
        console.log(`[nas-nfs.spec] Deleted dynamic NAS device ${nasDeviceId}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Cleanup failed for dynamic NAS device: ${err}`);
      }
    }

    // Delete dynamic NAS from simulator (best-effort)
    if (dynamicNasServer) {
      try {
        await deleteSimulatorServer(request, dynamicNasName);
        console.log(`[nas-nfs.spec] Deleted dynamic NAS from simulator: ${dynamicNasName}`);
      } catch (err) {
        console.warn(`[nas-nfs.spec] Cleanup failed for simulator NAS: ${err}`);
      }
    }
  });
});

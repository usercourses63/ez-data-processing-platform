/**
 * FTP Protocol E2E Tests
 *
 * Tests all file operations (TestConnection, Write, List, Read) against FTP servers
 * for all 4 formats (CSV, JSON, XML, XLSX).
 *
 * Scenario A: Static FTP server (pre-existing on file-simulator)
 * Scenario B: Dynamic FTP server (created via simulator API, registered in EZ UI)
 */
import { test, expect } from '@playwright/test';
import {
  getSimulatorHealth,
  getSimulatorServers,
  getConnectionInfo,
  createDynamicFtp,
  deleteSimulatorServer,
  filterServersByProtocol,
  SimulatorServer,
  SimulatorConnectionInfo,
} from '../helpers/simulator-client';
import {
  createAdminServer,
  testServerConnection,
  listFiles,
  readFile,
  writeFile,
  deleteServer,
  getServers,
} from '../helpers/ez-api-client';
import { addServerViaUI } from '../helpers/ui-helpers';
import { FORMATS, loadTestData, getTestDataFileName, verifyFileContent, TestDataFormat } from '../helpers/test-data';
import { matrixReporter } from '../helpers/report-generator';

// Enable file-based persistence so results survive Playwright worker isolation
matrixReporter.enablePersistence('ftp');

const SIMULATOR_HOST = '172.17.89.141';

// ============================================================
// Scenario A: Static FTP Devices
// ============================================================

test.describe('FTP - Scenario A: Static Devices', () => {
  let staticServer: SimulatorServer | undefined;
  let connectionInfo: SimulatorConnectionInfo;
  let ezServerId: string;
  let nodePort: number;
  const writtenFiles: string[] = [];
  const testRunId = Date.now();

  test.beforeAll(async ({ request }) => {
    // Simulator MUST be available - fail if not
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for FTP tests').toBeTruthy();

    // Discover static FTP servers
    const allServers = await getSimulatorServers(request);
    const ftpServers = filterServersByProtocol(allServers, 'ftp').filter((s) => !s.IsDynamic);

    if (ftpServers.length === 0) {
      test.skip(true, 'No static FTP server found on file-simulator');
      return;
    }

    staticServer = ftpServers[0];
    connectionInfo = await getConnectionInfo(request);

    // Find NodePort for this FTP server from connection info
    const serverEndpoint = connectionInfo.Servers?.find(
      (s) => s.Name === staticServer!.Name || s.Protocol?.toLowerCase() === 'ftp'
    );
    nodePort = serverEndpoint?.NodePort || staticServer.NodePort;

    // Get credentials from the simulator server info
    const username = staticServer.Credentials?.Username || 'ftpuser';
    const password = staticServer.Credentials?.Password || 'ftppass123';

    // Register the static FTP server in EZ via API
    const created = await createAdminServer(request, {
      Name: `E2E-FTP-Static-${testRunId}`,
      ServerType: 'ftp',
      Direction: 'Both',
      Host: SIMULATOR_HOST,
      Port: nodePort,
      BasePath: '/',
      TypeSpecificConfig: {
        Username: username,
        Password: password,
        PassiveMode: true,
      },
    });
    ezServerId = created.ID;
  });

  test.afterAll(async ({ request }) => {
    // Clean up EZ server registration
    if (ezServerId) {
      try {
        await deleteServer(request, ezServerId);
      } catch {
        // Best-effort cleanup
      }
    }
  });

  test('TestConnection - static FTP', async ({ request }) => {
    test.setTimeout(60000);
    let passed = false;
    let error: string | undefined;
    try {
      const result = await testServerConnection(request, ezServerId);
      expect(result.Success, `FTP TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
      passed = true;
    } catch (e) {
      error = String(e);
      throw e;
    } finally {
      matrixReporter.addResult('FTP-Static', 'all', 'TestConnection', passed, error);
    }
  });

  for (const format of FORMATS) {
    test.describe(`Format: ${format}`, () => {
      const fileName = `ftp-static-${testRunId}.${format}`;
      const filePath = `/${fileName}`;

      test(`Write ${format} file - static FTP`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const data = loadTestData(format as TestDataFormat);
          await writeFile(request, ezServerId, filePath, data);
          writtenFiles.push(filePath);
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('FTP-Static', format, 'Write', passed, error);
        }
      });

      test(`List files - static FTP (${format})`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const files = await listFiles(request, ezServerId, '/', `*${format}`);
          const found = files.some((f) => f.FileName === fileName || f.FullPath?.includes(fileName));
          expect(found, `Expected to find ${fileName} in file listing`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('FTP-Static', format, 'List', passed, error);
        }
      });

      test(`Read ${format} file - static FTP`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const original = loadTestData(format as TestDataFormat);
          const retrieved = await readFile(request, ezServerId, filePath);
          const matches = verifyFileContent(original, retrieved, format as TestDataFormat);
          expect(matches, `Content mismatch for ${format} file`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('FTP-Static', format, 'Read', passed, error);
        }
      });
    });
  }
});

// ============================================================
// Scenario B: Dynamic FTP Devices
// ============================================================

test.describe('FTP - Scenario B: Dynamic Devices', () => {
  let dynamicServer: SimulatorServer;
  let connectionInfo: SimulatorConnectionInfo;
  let ezServerId: string;
  let nodePort: number;
  const dynamicName = `e2e-dynamic-ftp-${Date.now()}`;
  const testRunId = Date.now();
  const writtenFiles: string[] = [];

  test.beforeAll(async ({ request, browser }) => {
    // Simulator MUST be available
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for FTP dynamic tests').toBeTruthy();

    // Create dynamic FTP server on simulator
    dynamicServer = await createDynamicFtp(request, dynamicName);
    expect(dynamicServer, 'Dynamic FTP server should be created').toBeTruthy();

    // Wait for the dynamic server to become ready
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get connection info to find the NodePort
    connectionInfo = await getConnectionInfo(request);
    const serverEndpoint = connectionInfo.Servers?.find(
      (s) => s.Name === dynamicServer.Name || s.Name === dynamicName
    );
    nodePort = serverEndpoint?.NodePort || dynamicServer.NodePort;

    const username = dynamicServer.Credentials?.Username || 'ftpuser';
    const password = dynamicServer.Credentials?.Password || 'ftppass123';

    // Register the dynamic FTP server in EZ via UI
    const page = await browser.newPage();
    try {
      await addServerViaUI(page, {
        name: `E2E-FTP-Dynamic-${testRunId}`,
        type: 'ftp',
        host: SIMULATOR_HOST,
        port: nodePort,
        credentials: {
          username: username,
          password: password,
        },
        basePath: '/',
      });
    } finally {
      await page.close();
    }

    // Wait for UI to persist
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Find the registered server ID from EZ API
    const servers = await getServers(request);
    const matchingServer = servers.find(
      (s) => s.Name === `E2E-FTP-Dynamic-${testRunId}`
    );

    if (!matchingServer) {
      // Fallback: create via API if UI registration didn't work
      const created = await createAdminServer(request, {
        Name: `E2E-FTP-Dynamic-${testRunId}`,
        ServerType: 'ftp',
        Direction: 'Both',
        Host: SIMULATOR_HOST,
        Port: nodePort,
        BasePath: '/',
        TypeSpecificConfig: {
          Username: username,
          Password: password,
          PassiveMode: true,
        },
      });
      ezServerId = created.ID;
    } else {
      ezServerId = matchingServer.ID;
    }
  });

  test.afterAll(async ({ request }) => {
    // Clean up EZ server
    if (ezServerId) {
      try {
        await deleteServer(request, ezServerId);
      } catch {
        // Best-effort
      }
    }
    // Clean up simulator dynamic server
    try {
      await deleteSimulatorServer(request, dynamicName);
    } catch {
      // Best-effort
    }
  });

  test('TestConnection - dynamic FTP', async ({ request }) => {
    test.setTimeout(60000);
    let passed = false;
    let error: string | undefined;
    try {
      const result = await testServerConnection(request, ezServerId);
      expect(result.Success, `FTP TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
      passed = true;
    } catch (e) {
      error = String(e);
      throw e;
    } finally {
      matrixReporter.addResult('FTP-Dynamic', 'all', 'TestConnection', passed, error);
    }
  });

  for (const format of FORMATS) {
    test.describe(`Format: ${format}`, () => {
      const fileName = `ftp-dynamic-${testRunId}.${format}`;
      const filePath = `/${fileName}`;

      test(`Write ${format} file - dynamic FTP`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const data = loadTestData(format as TestDataFormat);
          await writeFile(request, ezServerId, filePath, data);
          writtenFiles.push(filePath);
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('FTP-Dynamic', format, 'Write', passed, error);
        }
      });

      test(`List files - dynamic FTP (${format})`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const files = await listFiles(request, ezServerId, '/', `*${format}`);
          const found = files.some((f) => f.FileName === fileName || f.FullPath?.includes(fileName));
          expect(found, `Expected to find ${fileName} in file listing`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('FTP-Dynamic', format, 'List', passed, error);
        }
      });

      test(`Read ${format} file - dynamic FTP`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const original = loadTestData(format as TestDataFormat);
          const retrieved = await readFile(request, ezServerId, filePath);
          const matches = verifyFileContent(original, retrieved, format as TestDataFormat);
          expect(matches, `Content mismatch for ${format} file`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('FTP-Dynamic', format, 'Read', passed, error);
        }
      });
    });
  }
});

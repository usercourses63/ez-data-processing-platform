/**
 * SFTP Protocol E2E Tests
 *
 * Tests all file operations (TestConnection, Write, List, Read) against SFTP servers
 * for all 4 formats (CSV, JSON, XML, XLSX).
 *
 * Scenario A: Static SFTP server (pre-existing on file-simulator)
 * Scenario B: Dynamic SFTP server (created via simulator API, registered in EZ UI)
 */
import { test, expect } from '@playwright/test';
import {
  getSimulatorHealth,
  getSimulatorServers,
  getConnectionInfo,
  createDynamicSftp,
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
  ServerDirection,
} from '../helpers/ez-api-client';
import { addServerViaUI } from '../helpers/ui-helpers';
import { FORMATS, loadTestData, getTestDataFileName, verifyFileContent, TestDataFormat } from '../helpers/test-data';
import { matrixReporter } from '../helpers/report-generator';

// Enable file-based persistence so results survive Playwright worker isolation
matrixReporter.enablePersistence('sftp');

const SIMULATOR_HOST = '172.17.89.141';

// ============================================================
// Scenario A: Static SFTP Devices
// ============================================================

test.describe('SFTP - Scenario A: Static Devices', () => {
  let staticServer: SimulatorServer | undefined;
  let connectionInfo: SimulatorConnectionInfo;
  let ezServerId: string;
  let nodePort: number;
  let basePath: string;
  const writtenFiles: string[] = [];
  const testRunId = Date.now();

  test.beforeAll(async ({ request }) => {
    // Simulator MUST be available - fail if not
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for SFTP tests').toBeTruthy();

    // Discover static SFTP servers
    const allServers = await getSimulatorServers(request);
    const sftpServers = filterServersByProtocol(allServers, 'sftp').filter((s) => !s.isDynamic);

    if (sftpServers.length === 0) {
      test.skip(true, 'No static SFTP server found on file-simulator');
      return;
    }

    staticServer = sftpServers[0];
    connectionInfo = await getConnectionInfo(request);

    // Find NodePort for this SFTP server from connection info
    const serverEndpoint = connectionInfo.servers?.find(
      (s) => s.name === staticServer!.name || s.protocol?.toLowerCase() === 'sftp'
    );
    nodePort = serverEndpoint?.port || staticServer.nodePort;

    // Determine base path from connection info or use default
    basePath = '/upload';

    // Get credentials from the simulator server info
    const username = staticServer.credentials?.username || 'sftpuser';
    const password = staticServer.credentials?.password || 'sftppass123';

    // Register the static SFTP server in EZ via API
    const created = await createAdminServer(request, {
      Name: `E2E-SFTP-Static-${testRunId}`,
      ServerType: 'sftp',
      Direction: ServerDirection.Both,
      Host: SIMULATOR_HOST,
      Port: nodePort,
      BasePath: basePath,
      TypeSpecificConfig: {
        Username: username,
        Password: password,
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

  test('TestConnection - static SFTP', async ({ request }) => {
    test.setTimeout(60000);
    let passed = false;
    let error: string | undefined;
    try {
      const result = await testServerConnection(request, ezServerId);
      expect(result.Success, `SFTP TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
      passed = true;
    } catch (e) {
      error = String(e);
      throw e;
    } finally {
      matrixReporter.addResult('SFTP-Static', 'all', 'TestConnection', passed, error);
    }
  });

  for (const format of FORMATS) {
    test.describe(`Format: ${format}`, () => {
      const fileName = `sftp-static-${testRunId}.${format}`;
      // Paths are relative to server BasePath (/upload)
      const filePath = fileName;

      test(`Write ${format} file - static SFTP`, async ({ request }) => {
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
          matrixReporter.addResult('SFTP-Static', format, 'Write', passed, error);
        }
      });

      test(`List files - static SFTP (${format})`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          // Pass null to list from BasePath root
          const files = await listFiles(request, ezServerId, undefined, `*${format}`);
          const found = files.some((f) => f.FileName === fileName || f.FullPath?.includes(fileName));
          expect(found, `Expected to find ${fileName} in file listing`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('SFTP-Static', format, 'List', passed, error);
        }
      });

      test(`Read ${format} file - static SFTP`, async ({ request }) => {
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
          matrixReporter.addResult('SFTP-Static', format, 'Read', passed, error);
        }
      });
    });
  }
});

// ============================================================
// Scenario B: Dynamic SFTP Devices
// ============================================================

test.describe('SFTP - Scenario B: Dynamic Devices', () => {
  let dynamicServer: SimulatorServer;
  let connectionInfo: SimulatorConnectionInfo;
  let ezServerId: string;
  let nodePort: number;
  const dynamicName = `e2e-dynamic-sftp-${Date.now()}`;
  const testRunId = Date.now();
  const writtenFiles: string[] = [];

  test.beforeAll(async ({ request, browser }) => {
    // Simulator MUST be available
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for SFTP dynamic tests').toBeTruthy();

    // Create dynamic SFTP server on simulator
    dynamicServer = await createDynamicSftp(request, dynamicName);
    expect(dynamicServer, 'Dynamic SFTP server should be created').toBeTruthy();

    // Wait for the dynamic server to become ready
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get connection info to find the NodePort
    connectionInfo = await getConnectionInfo(request);
    const serverEndpoint = connectionInfo.servers?.find(
      (s) => s.name === dynamicServer.name || s.name === dynamicName
    );
    nodePort = serverEndpoint?.port || dynamicServer.nodePort;

    const username = dynamicServer.credentials?.username || 'sftpuser';
    const password = dynamicServer.credentials?.password || 'sftppass123';

    // Register the dynamic SFTP server in EZ via UI
    const page = await browser.newPage();
    try {
      await addServerViaUI(page, {
        name: `E2E-SFTP-Dynamic-${testRunId}`,
        type: 'sftp',
        host: SIMULATOR_HOST,
        port: nodePort,
        credentials: {
          username: username,
          password: password,
        },
        basePath: '/upload',
      });
    } finally {
      await page.close();
    }

    // Wait for UI to persist
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Find the registered server ID from EZ API
    const servers = await getServers(request);
    const matchingServer = servers.find(
      (s) => s.Name === `E2E-SFTP-Dynamic-${testRunId}`
    );

    // Always create via API to ensure TypeSpecificConfig credentials are stored
    // (UI registration may not persist credentials in TypeSpecificConfig)
    if (matchingServer) {
      // Clean up UI-created server (may lack credentials)
      await deleteServer(request, matchingServer.ID).catch(() => {});
    }
    const created = await createAdminServer(request, {
      Name: `E2E-SFTP-Dynamic-${testRunId}`,
      ServerType: 'sftp',
      Direction: ServerDirection.Both,
      Host: SIMULATOR_HOST,
      Port: nodePort,
      BasePath: '/upload',
      TypeSpecificConfig: {
        Username: username,
        Password: password,
      },
    });
    ezServerId = created.ID;
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

  test('TestConnection - dynamic SFTP', async ({ request }) => {
    test.setTimeout(60000);
    let passed = false;
    let error: string | undefined;
    try {
      const result = await testServerConnection(request, ezServerId);
      expect(result.Success, `SFTP TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
      passed = true;
    } catch (e) {
      error = String(e);
      throw e;
    } finally {
      matrixReporter.addResult('SFTP-Dynamic', 'all', 'TestConnection', passed, error);
    }
  });

  for (const format of FORMATS) {
    test.describe(`Format: ${format}`, () => {
      const fileName = `sftp-dynamic-${testRunId}.${format}`;
      // Paths are relative to server BasePath (/upload)
      const filePath = fileName;

      test(`Write ${format} file - dynamic SFTP`, async ({ request }) => {
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
          matrixReporter.addResult('SFTP-Dynamic', format, 'Write', passed, error);
        }
      });

      test(`List files - dynamic SFTP (${format})`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const files = await listFiles(request, ezServerId, undefined, `*${format}`);
          const found = files.some((f) => f.FileName === fileName || f.FullPath?.includes(fileName));
          expect(found, `Expected to find ${fileName} in file listing`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('SFTP-Dynamic', format, 'List', passed, error);
        }
      });

      test(`Read ${format} file - dynamic SFTP`, async ({ request }) => {
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
          matrixReporter.addResult('SFTP-Dynamic', format, 'Read', passed, error);
        }
      });
    });
  }
});

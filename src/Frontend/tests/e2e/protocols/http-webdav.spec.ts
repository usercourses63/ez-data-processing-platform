/**
 * HTTP/WebDAV Protocol E2E Tests
 *
 * Tests all file operations (TestConnection, Write, List, Read) against HTTP/WebDAV servers
 * for all 4 formats (CSV, JSON, XML, XLSX).
 *
 * Scenario A: Static HTTP server (pre-existing on file-simulator)
 * Scenario B: Not applicable - file-simulator does not support dynamic HTTP server creation
 */
import { test, expect } from '@playwright/test';
import {
  getSimulatorHealth,
  getSimulatorServers,
  getConnectionInfo,
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
} from '../helpers/ez-api-client';
import { FORMATS, loadTestData, getTestDataFileName, verifyFileContent, TestDataFormat } from '../helpers/test-data';
import { matrixReporter } from '../helpers/report-generator';

const SIMULATOR_HOST = '172.17.89.141';

// ============================================================
// Scenario A: Static HTTP/WebDAV Devices
// ============================================================

test.describe('HTTP/WebDAV - Scenario A: Static Devices', () => {
  let staticServer: SimulatorServer | undefined;
  let connectionInfo: SimulatorConnectionInfo;
  let ezServerId: string;
  let nodePort: number;
  const writtenFiles: string[] = [];
  const testRunId = Date.now();

  test.beforeAll(async ({ request }) => {
    // Simulator MUST be available - fail if not
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for HTTP/WebDAV tests').toBeTruthy();

    // Discover static HTTP servers
    const allServers = await getSimulatorServers(request);
    const httpServers = filterServersByProtocol(allServers, 'http').filter((s) => !s.IsDynamic);

    // Also check for 'webdav' protocol label in case the simulator uses that
    if (httpServers.length === 0) {
      const webdavServers = filterServersByProtocol(allServers, 'webdav').filter((s) => !s.IsDynamic);
      if (webdavServers.length > 0) {
        staticServer = webdavServers[0];
      }
    } else {
      staticServer = httpServers[0];
    }

    expect(staticServer, 'No static HTTP/WebDAV server found on file-simulator. HTTP tests require a pre-existing HTTP server.').toBeTruthy();

    connectionInfo = await getConnectionInfo(request);

    // Find NodePort for this HTTP server from connection info
    const serverEndpoint = connectionInfo.Servers?.find(
      (s) =>
        s.Name === staticServer!.Name ||
        s.Protocol?.toLowerCase() === 'http' ||
        s.Protocol?.toLowerCase() === 'webdav'
    );
    nodePort = serverEndpoint?.NodePort || staticServer!.NodePort;

    // Get credentials if the HTTP server requires auth
    const username = staticServer!.Credentials?.Username;
    const password = staticServer!.Credentials?.Password;

    // Build TypeSpecificConfig with auth if present
    const typeSpecificConfig: Record<string, unknown> = {};
    if (username && password) {
      typeSpecificConfig.Username = username;
      typeSpecificConfig.Password = password;
      typeSpecificConfig.AuthType = 'basic';
    }

    // Register the static HTTP server in EZ via API
    const created = await createAdminServer(request, {
      Name: `E2E-HTTP-Static-${testRunId}`,
      ServerType: 'http',
      Direction: 'Both',
      Host: SIMULATOR_HOST,
      Port: nodePort,
      BasePath: '/',
      TypeSpecificConfig: Object.keys(typeSpecificConfig).length > 0 ? typeSpecificConfig : undefined,
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

  test('TestConnection - static HTTP', async ({ request }) => {
    test.setTimeout(60000);
    let passed = false;
    let error: string | undefined;
    try {
      const result = await testServerConnection(request, ezServerId);
      expect(result.Success, `HTTP TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
      passed = true;
    } catch (e) {
      error = String(e);
      throw e;
    } finally {
      matrixReporter.addResult('HTTP-Static', 'all', 'TestConnection', passed, error);
    }
  });

  for (const format of FORMATS) {
    test.describe(`Format: ${format}`, () => {
      const fileName = `http-static-${testRunId}.${format}`;
      // HTTP write uses PUT to the file URL path on the server
      const filePath = `/files/${fileName}`;

      test(`Write ${format} file via HTTP PUT - static`, async ({ request }) => {
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
          matrixReporter.addResult('HTTP-Static', format, 'Write', passed, error);
        }
      });

      test(`List files via HTTP - static (${format})`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const files = await listFiles(request, ezServerId, '/files', `*${format}`);
          const found = files.some((f) => f.FileName === fileName || f.FullPath?.includes(fileName));
          expect(found, `Expected to find ${fileName} in HTTP file listing`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('HTTP-Static', format, 'List', passed, error);
        }
      });

      test(`Read ${format} file via HTTP GET - static`, async ({ request }) => {
        test.setTimeout(60000);
        let passed = false;
        let error: string | undefined;
        try {
          const original = loadTestData(format as TestDataFormat);
          const retrieved = await readFile(request, ezServerId, filePath);
          const matches = verifyFileContent(original, retrieved, format as TestDataFormat);
          expect(matches, `Content mismatch for ${format} file via HTTP`).toBeTruthy();
          passed = true;
        } catch (e) {
          error = String(e);
          throw e;
        } finally {
          matrixReporter.addResult('HTTP-Static', format, 'Read', passed, error);
        }
      });
    });
  }
});

// ============================================================
// Scenario B: Dynamic HTTP/WebDAV Devices
// ============================================================

test.describe('HTTP/WebDAV - Scenario B: Dynamic Devices', () => {
  test('SKIPPED: File-simulator does not support dynamic HTTP server creation', () => {
    // HTTP/WebDAV servers are pre-configured in the file-simulator.
    // Dynamic creation via POST /api/servers/http is not supported.
    // Scenario A covers all file operations against static HTTP servers.
    //
    // The file-simulator REST API provides:
    //   POST /api/servers/ftp   - dynamic FTP creation (supported)
    //   POST /api/servers/sftp  - dynamic SFTP creation (supported)
    //   POST /api/servers/nas   - dynamic NAS creation (supported)
    //   POST /api/servers/http  - NOT available
    //
    // If dynamic HTTP server creation is added to the simulator in the future,
    // this test should be expanded to mirror the Scenario B structure from
    // ftp.spec.ts and sftp.spec.ts.
    test.info().annotations.push({
      type: 'info',
      description: 'No dynamic HTTP server creation in simulator',
    });
  });
});

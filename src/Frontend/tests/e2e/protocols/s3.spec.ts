/**
 * S3 (MinIO) Protocol E2E Tests
 *
 * Tests file operations (TestConnection, List, Read, Write) against
 * S3-compatible (MinIO) servers on the file-simulator cluster.
 *
 * Scenario A: Static devices (pre-existing on simulator)
 * Scenario B: Not applicable (no dynamic S3 creation in simulator)
 *
 * Capability matrix:
 *   TestConnection: YES
 *   List:           YES
 *   Read:           YES
 *   Write:          YES
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
  AdminServerResponse,
  ServerDirection,
} from '../helpers/ez-api-client';
import { FORMATS, loadTestData, getTestDataFileName, verifyFileContent, TestDataFormat } from '../helpers/test-data';
import { matrixReporter } from '../helpers/report-generator';

// Enable file-based persistence so results survive Playwright worker isolation
matrixReporter.enablePersistence('s3');

const PROTOCOL = 'S3';
const SIMULATOR_HOST = '172.17.89.141';

// ============================================================
// Scenario A: Static S3/MinIO Devices
// ============================================================

test.describe('S3 - Scenario A: Static Devices', () => {
  let s3Servers: SimulatorServer[];
  let connectionInfo: SimulatorConnectionInfo;
  let createdServerId: string | null = null;
  let s3Server: SimulatorServer;
  let nodePort: number;

  test.beforeAll(async ({ request }) => {
    // 1. Check simulator health - MUST fail if unavailable
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for S3 tests').toBeTruthy();

    // 2. Discover static S3/MinIO servers
    const allServers = await getSimulatorServers(request);
    s3Servers = filterServersByProtocol(allServers, 's3');
    if (s3Servers.length === 0) {
      // Also check for 'minio' protocol label
      s3Servers = filterServersByProtocol(allServers, 'minio');
    }
    expect(s3Servers.length, 'At least one static S3/MinIO server must exist on simulator').toBeGreaterThan(0);

    s3Server = s3Servers[0];

    // 3. Get connection info for NodePort discovery
    connectionInfo = await getConnectionInfo(request);
    const s3Endpoint = connectionInfo.servers?.find(
      (s) => s.protocol.toLowerCase() === 's3' || s.protocol.toLowerCase() === 'minio'
    );
    nodePort = s3Endpoint?.nodePort || s3Server.nodePort;
    expect(nodePort, 'S3 NodePort must be discoverable').toBeGreaterThan(0);

    console.log(`[s3.spec] Using static S3 server: ${s3Server.name} at ${SIMULATOR_HOST}:${nodePort}`);
  });

  test('TestConnection - static S3', async ({ request }) => {
    test.setTimeout(60000);

    const timestamp = Date.now();
    const credentials = s3Server.credentials || { username: 'minioadmin', password: 'minioadmin123' };

    // Create AdminServer in EZ with S3 config
    const server: AdminServerResponse = await createAdminServer(request, {
      Name: `E2E-S3-Static-${timestamp}`,
      ServerType: 's3',
      Direction: ServerDirection.Both,
      Host: SIMULATOR_HOST,
      Port: nodePort,
      TypeSpecificConfig: {
        Region: 'us-east-1',
        UsePathStyle: true,
        Bucket: 'test-bucket',
        AccessKey: credentials.username,
        SecretKey: credentials.password,
        Endpoint: `http://${SIMULATOR_HOST}:${nodePort}`,
      },
    });

    createdServerId = server.ID;
    expect(createdServerId, 'Server must be created in EZ').toBeTruthy();

    // Test connection
    const result = await testServerConnection(request, createdServerId);
    const passed = result.Success === true;

    matrixReporter.addResult(PROTOCOL, 'all', 'TestConnection', passed, result.ErrorMessage, result.ConnectionTimeMs);
    expect(passed, `S3 TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
  });

  for (const format of FORMATS) {
    test(`Write + List + Read - ${format}`, async ({ request }) => {
      test.setTimeout(60000);
      expect(createdServerId, 'Server must be created before file operations').toBeTruthy();

      const timestamp = Date.now();
      const fileName = `test-data-${timestamp}.${format}`;
      const testData = loadTestData(format as TestDataFormat);

      // WRITE
      let writePassed = false;
      let writeError: string | undefined;
      try {
        await writeFile(request, createdServerId!, fileName, testData);
        writePassed = true;
      } catch (err: any) {
        writeError = err.message;
      }
      matrixReporter.addResult(PROTOCOL, format, 'Write', writePassed, writeError);
      expect(writePassed, `S3 Write ${format} failed: ${writeError}`).toBeTruthy();

      // LIST
      let listPassed = false;
      let listError: string | undefined;
      try {
        const files = await listFiles(request, createdServerId!, '/', '*');
        const found = files.some((f) => f.FileName === fileName || f.FullPath.includes(fileName));
        listPassed = found;
        if (!found) {
          listError = `File ${fileName} not found in listing. Got: ${files.map((f) => f.FileName).join(', ')}`;
        }
      } catch (err: any) {
        listError = err.message;
      }
      matrixReporter.addResult(PROTOCOL, format, 'List', listPassed, listError);
      expect(listPassed, `S3 List ${format} failed: ${listError}`).toBeTruthy();

      // READ
      let readPassed = false;
      let readError: string | undefined;
      try {
        const retrieved = await readFile(request, createdServerId!, fileName);
        readPassed = verifyFileContent(testData, retrieved, format as TestDataFormat);
        if (!readPassed) {
          readError = `Content verification failed for ${format} (original=${testData.length}B, retrieved=${retrieved.length}B)`;
        }
      } catch (err: any) {
        readError = err.message;
      }
      matrixReporter.addResult(PROTOCOL, format, 'Read', readPassed, readError);
      expect(readPassed, `S3 Read ${format} failed: ${readError}`).toBeTruthy();
    });
  }

  test.afterAll(async ({ request }) => {
    // Clean up: delete the test server from EZ
    if (createdServerId) {
      try {
        await deleteServer(request, createdServerId);
        console.log(`[s3.spec] Cleaned up server ${createdServerId}`);
      } catch (err) {
        console.warn(`[s3.spec] Cleanup failed for server ${createdServerId}: ${err}`);
      }
    }
  });
});

// ============================================================
// Scenario B: Dynamic S3 Devices
// ============================================================

test.describe('S3 - Scenario B: Dynamic Devices', () => {
  test('SKIPPED: File-simulator does not support dynamic S3 server creation', () => {
    test.info().annotations.push({
      type: 'info',
      description: 'No dynamic S3 creation endpoint in file-simulator. Only static MinIO server available.',
    });
    // This is expected - the simulator only supports dynamic FTP, SFTP, and NAS creation
    expect(true).toBeTruthy();
  });
});

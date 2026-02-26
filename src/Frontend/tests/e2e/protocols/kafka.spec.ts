/**
 * Kafka Protocol E2E Tests
 *
 * Tests connection capabilities against Kafka brokers.
 * Kafka is SPECIAL: KafkaConnector implements only IDataSourceConnector,
 * NOT IServerConnector. This means the FileOperationsController will return
 * 400 for file operations (List/Read/Write) on Kafka servers.
 *
 * Capability matrix:
 *   TestConnection: YES (via AdminServer test-connection endpoint)
 *   List:           N/A (KafkaConnector has no IServerConnector.ListFilesAsync)
 *   Read:           N/A (KafkaConnector has no IServerConnector.ReadFileAsync)
 *   Write:          N/A (KafkaConnector has no IServerConnector.WriteFileAsync)
 *
 * Scenarios:
 *   A-1: Local Kafka cluster (EZ cluster's own Kafka at localhost:9094)
 *   A-2: Simulator Kafka cluster (file-simulator cluster's Kafka via NodePort)
 *   B:   Not applicable (no dynamic Kafka creation in simulator)
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
  deleteServer,
  AdminServerResponse,
  EZ_API_BASE,
} from '../helpers/ez-api-client';
import { matrixReporter } from '../helpers/report-generator';

const PROTOCOL_LOCAL = 'Kafka (local)';
const PROTOCOL_SIMULATOR = 'Kafka (simulator)';
const SIMULATOR_HOST = '172.17.89.141';

// ============================================================
// Scenario A-1: Local Kafka Cluster
// ============================================================

test.describe('Kafka - Scenario A: Local Kafka Cluster', () => {
  let createdServerId: string | null = null;

  test('TestConnection - local Kafka', async ({ request }) => {
    test.setTimeout(60000);

    const timestamp = Date.now();

    // Create AdminServer pointing to local Kafka (EZ cluster's own Kafka)
    // localhost:9094 is the external listener accessible via port-forward
    const server: AdminServerResponse = await createAdminServer(request, {
      Name: `E2E-Kafka-Local-${timestamp}`,
      ServerType: 'kafka',
      Direction: 'Input',
      Host: 'localhost',
      Port: 9094,
      KafkaConfig: {
        BootstrapServers: 'localhost:9094',
        SecurityProtocol: 'PLAINTEXT',
      },
    });

    createdServerId = server.ID;
    expect(createdServerId, 'Kafka server must be created in EZ').toBeTruthy();

    // Test connection
    const result = await testServerConnection(request, createdServerId);
    const passed = result.Success === true;

    matrixReporter.addResult(PROTOCOL_LOCAL, 'all', 'TestConnection', passed, result.ErrorMessage, result.ConnectionTimeMs);
    expect(passed, `Kafka local TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
  });

  test('Verify Kafka does not support file operations', async ({ request }) => {
    test.setTimeout(30000);
    expect(createdServerId, 'Kafka server must be created before testing file ops').toBeTruthy();

    // Attempt listFiles on Kafka server -- expect failure (400 or error)
    // because KafkaConnector does not implement IServerConnector
    let listFailed = false;
    let listErrorMessage: string | undefined;
    try {
      await listFiles(request, createdServerId!, '/', '*');
      // If we get here without error, it unexpectedly succeeded
      listFailed = false;
    } catch (err: any) {
      listFailed = true;
      listErrorMessage = err.message;
    }

    // Report as N/A, not FAIL -- Kafka intentionally doesn't support file ops
    matrixReporter.addResult(PROTOCOL_LOCAL, 'all', 'List', true, 'N/A - Kafka does not implement IServerConnector');
    matrixReporter.addResult(PROTOCOL_LOCAL, 'all', 'Read', true, 'N/A - Kafka does not implement IServerConnector');
    matrixReporter.addResult(PROTOCOL_LOCAL, 'all', 'Write', true, 'N/A - Kafka does not implement IServerConnector');

    // The test passes if file operations correctly fail
    expect(listFailed, 'Kafka file operations should not be supported via FileOperationsController').toBeTruthy();
    console.log(`[kafka.spec] Kafka file operations correctly rejected: ${listErrorMessage}`);
  });

  test.afterAll(async ({ request }) => {
    if (createdServerId) {
      try {
        await deleteServer(request, createdServerId);
        console.log(`[kafka.spec] Cleaned up local Kafka server ${createdServerId}`);
      } catch (err) {
        console.warn(`[kafka.spec] Cleanup failed for local Kafka server ${createdServerId}: ${err}`);
      }
    }
  });
});

// ============================================================
// Scenario A-2: Simulator Kafka Cluster
// ============================================================

test.describe('Kafka - Scenario A: Simulator Kafka Cluster', () => {
  let kafkaServers: SimulatorServer[];
  let connectionInfo: SimulatorConnectionInfo;
  let createdServerId: string | null = null;
  let kafkaServer: SimulatorServer;
  let nodePort: number;

  test.beforeAll(async ({ request }) => {
    // 1. Check simulator health
    const healthy = await getSimulatorHealth(request);
    expect(healthy, 'File-simulator must be reachable for Kafka simulator tests').toBeTruthy();

    // 2. Discover Kafka servers on simulator
    const allServers = await getSimulatorServers(request);
    kafkaServers = filterServersByProtocol(allServers, 'kafka');
    expect(kafkaServers.length, 'At least one Kafka server must exist on simulator').toBeGreaterThan(0);

    kafkaServer = kafkaServers[0];

    // 3. Get connection info for NodePort
    connectionInfo = await getConnectionInfo(request);
    const kafkaEndpoint = connectionInfo.Servers?.find(
      (s) => s.Protocol.toLowerCase() === 'kafka'
    );
    nodePort = kafkaEndpoint?.NodePort || kafkaServer.NodePort;
    expect(nodePort, 'Kafka NodePort must be discoverable').toBeGreaterThan(0);

    console.log(`[kafka.spec] Using simulator Kafka: ${kafkaServer.Name} at ${SIMULATOR_HOST}:${nodePort}`);
  });

  test('TestConnection - simulator Kafka', async ({ request }) => {
    test.setTimeout(60000);

    const timestamp = Date.now();

    // Create AdminServer pointing to simulator Kafka
    const server: AdminServerResponse = await createAdminServer(request, {
      Name: `E2E-Kafka-Simulator-${timestamp}`,
      ServerType: 'kafka',
      Direction: 'Input',
      Host: SIMULATOR_HOST,
      Port: nodePort,
      KafkaConfig: {
        BootstrapServers: `${SIMULATOR_HOST}:${nodePort}`,
        SecurityProtocol: 'PLAINTEXT',
      },
    });

    createdServerId = server.ID;
    expect(createdServerId, 'Simulator Kafka server must be created in EZ').toBeTruthy();

    // Test connection
    const result = await testServerConnection(request, createdServerId);
    const passed = result.Success === true;

    matrixReporter.addResult(PROTOCOL_SIMULATOR, 'all', 'TestConnection', passed, result.ErrorMessage, result.ConnectionTimeMs);
    expect(passed, `Kafka simulator TestConnection failed: ${result.ErrorMessage}`).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    // Report file operations as N/A for simulator Kafka too
    matrixReporter.addResult(PROTOCOL_SIMULATOR, 'all', 'List', true, 'N/A - Kafka does not implement IServerConnector');
    matrixReporter.addResult(PROTOCOL_SIMULATOR, 'all', 'Read', true, 'N/A - Kafka does not implement IServerConnector');
    matrixReporter.addResult(PROTOCOL_SIMULATOR, 'all', 'Write', true, 'N/A - Kafka does not implement IServerConnector');

    if (createdServerId) {
      try {
        await deleteServer(request, createdServerId);
        console.log(`[kafka.spec] Cleaned up simulator Kafka server ${createdServerId}`);
      } catch (err) {
        console.warn(`[kafka.spec] Cleanup failed for simulator Kafka server ${createdServerId}: ${err}`);
      }
    }
  });
});

// ============================================================
// Scenario B: Dynamic Kafka Devices
// ============================================================

test.describe('Kafka - Scenario B: Dynamic Devices', () => {
  test('SKIPPED: File-simulator does not support dynamic Kafka server creation', () => {
    test.info().annotations.push({
      type: 'info',
      description: 'No dynamic Kafka creation endpoint in file-simulator. Only static Kafka cluster available.',
    });
    expect(true).toBeTruthy();
  });
});

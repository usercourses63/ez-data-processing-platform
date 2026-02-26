/**
 * Global setup for protocol test suite.
 *
 * Pre-flight connectivity checks:
 * 1. File-simulator health (cross-cluster Hyper-V)
 * 2. EZ API health (local cluster port-forward)
 * 3. File-operations endpoint availability
 * 4. Simulator server discovery summary
 *
 * Also cleans up any stale persisted results from previous runs.
 */
import { request } from '@playwright/test';
import { MatrixReporter } from '../helpers/report-generator';

async function globalSetup() {
  // Only run pre-flight checks when protocol tests are selected.
  // Detected via PROTOCOL_TESTS env var or --project=protocols in CLI args.
  const isProtocolRun =
    process.env.PROTOCOL_TESTS === 'true' ||
    process.argv.some((arg) => arg.includes('protocols'));
  if (!isProtocolRun) {
    return;
  }

  const SIMULATOR_BASE = process.env.FILE_SIMULATOR_URL || 'http://172.17.89.141:30500';
  const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';

  // Clean up stale persisted results from previous runs
  MatrixReporter.cleanPersistedResults();
  console.log('[Global Setup] Cleaned stale persisted result fragments');

  const ctx = await request.newContext();

  // Check file-simulator health
  console.log(`[Global Setup] Checking file-simulator at ${SIMULATOR_BASE}...`);
  const simHealth = await ctx.get(`${SIMULATOR_BASE}/health`).catch(() => null);
  if (!simHealth || !simHealth.ok()) {
    throw new Error(
      `FATAL: File-simulator unavailable at ${SIMULATOR_BASE}. Protocol tests require file-simulator.`
    );
  }
  console.log('[Global Setup] File-simulator: HEALTHY');

  // Check EZ API health
  console.log(`[Global Setup] Checking EZ API at ${EZ_API_BASE}...`);
  const ezHealth = await ctx.get(`${EZ_API_BASE}/health`).catch(() => null);
  if (!ezHealth || !ezHealth.ok()) {
    throw new Error(
      `FATAL: EZ API unavailable at ${EZ_API_BASE}. Protocol tests require EZ backend.`
    );
  }
  console.log('[Global Setup] EZ API: HEALTHY');

  // Check file-operations endpoint exists (from Plan 01)
  console.log('[Global Setup] Verifying file-operations endpoint...');
  const fileOpsCheck = await ctx
    .post(`${EZ_API_BASE}/api/v1/file-operations/nonexistent/list`, {
      data: { Pattern: '*' },
    })
    .catch(() => null);
  // Expect 404 (server not found) not 405 (route not found)
  if (fileOpsCheck && fileOpsCheck.status() === 405) {
    throw new Error(
      'FATAL: File-operations endpoint not deployed. Rebuild DataSourceManagementService.'
    );
  }
  console.log('[Global Setup] File-operations endpoint: AVAILABLE');

  // Discover simulator servers for test summary
  const serversResp = await ctx.get(`${SIMULATOR_BASE}/api/servers`);
  const servers = await serversResp.json();
  const protocols = [...new Set(servers.map((s: any) => s.Protocol))];
  console.log(`[Global Setup] Simulator protocols available: ${protocols.join(', ')}`);
  console.log(`[Global Setup] Total simulator servers: ${servers.length}`);

  await ctx.dispose();

  console.log('[Global Setup] All pre-flight checks passed. Starting protocol tests...');
}

export default globalSetup;

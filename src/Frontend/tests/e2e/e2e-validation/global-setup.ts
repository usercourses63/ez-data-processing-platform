/**
 * E2E Validation global setup module.
 * Called from test.beforeAll() in spec files (not Playwright globalSetup,
 * which is already used by the protocols project).
 *
 * Responsibilities:
 * 1. Clean stale persisted results
 * 2. Health-check file-simulator and EZ API (throw on failure)
 * 3. Seed environment via DemoDataGenerator with --use-simulator --upload-files
 */
import { request } from '@playwright/test';
import { execSync } from 'child_process';
import { E2EValidationReporter } from './helpers/validation-reporter';

const SIMULATOR_BASE = process.env.FILE_SIMULATOR_URL || 'http://file-simulator.local:30500';
const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';

export async function e2eValidationSetup(): Promise<void> {
  // Clean stale results from previous runs
  E2EValidationReporter.cleanPersistedResults();

  const ctx = await request.newContext();

  // Check file-simulator health
  console.log(`[e2e-validation] Checking file-simulator at ${SIMULATOR_BASE}...`);
  const simHealth = await ctx.get(`${SIMULATOR_BASE}/health`).catch(() => null);
  if (!simHealth || !simHealth.ok()) {
    await ctx.dispose();
    throw new Error(`FATAL: File-simulator unavailable at ${SIMULATOR_BASE}`);
  }
  console.log('[e2e-validation] File-simulator: HEALTHY');

  // Check EZ API health
  console.log(`[e2e-validation] Checking EZ API at ${EZ_API_BASE}...`);
  const ezHealth = await ctx.get(`${EZ_API_BASE}/health`).catch(() => null);
  if (!ezHealth || !ezHealth.ok()) {
    await ctx.dispose();
    throw new Error(`FATAL: EZ API unavailable at ${EZ_API_BASE}`);
  }
  console.log('[e2e-validation] EZ API: HEALTHY');

  await ctx.dispose();

  // Seed environment via DemoDataGenerator
  // Uses --use-simulator --upload-files to create servers, upload files, create DataSources
  const simulatorUrl = SIMULATOR_BASE;
  console.log('[e2e-validation] Seeding environment via DemoDataGenerator...');
  try {
    execSync(
      `dotnet run --project tools/DemoDataGenerator -- --use-simulator --upload-files --create-servers --direct-connection --simulator-url ${simulatorUrl}`,
      {
        timeout: 120000,
        stdio: 'inherit',
        cwd: process.env.PROJECT_ROOT || 'C:\\Users\\UserC\\source\\repos\\EZ',
      }
    );
    console.log('[e2e-validation] DemoDataGenerator seeding complete');
  } catch (err) {
    throw new Error(`FATAL: DemoDataGenerator seeding failed: ${err}`);
  }
}

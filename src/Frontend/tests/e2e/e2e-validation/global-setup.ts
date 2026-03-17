/**
 * E2E Validation global setup module.
 * Called from test.beforeAll() in spec files (not Playwright globalSetup,
 * which is already used by the protocols project).
 *
 * Responsibilities:
 * 1. Clean stale persisted results
 * 2. Health-check file-simulator and EZ API (throw on failure)
 * 3. Seed environment via DemoDataGenerator with --use-simulator --upload-files
 *
 * Set SKIP_SEEDING=true to skip DemoDataGenerator (if environment is already seeded).
 */
import { request } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { E2EValidationReporter } from './helpers/validation-reporter';

const SIMULATOR_BASE = process.env.FILE_SIMULATOR_URL || 'http://file-simulator.local:30500';
const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';
const PROJECT_ROOT = process.env.PROJECT_ROOT || 'C:\\Users\\UserC\\source\\repos\\EZ';
const LOCK_FILE = path.join(PROJECT_ROOT, 'test-results', '.e2e-validation-seeded');

export async function e2eValidationSetup(): Promise<void> {
  // File-based lock survives across worker processes — seed only once per test run
  const alreadySeeded = process.env.SKIP_SEEDING === 'true' || fs.existsSync(LOCK_FILE);

  if (!alreadySeeded) {
    // Clean stale results from previous runs
    E2EValidationReporter.cleanPersistedResults();
  }

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

  if (alreadySeeded) {
    console.log('[e2e-validation] Environment already seeded — skipping DemoDataGenerator');
    return;
  }

  // Seed environment via DemoDataGenerator
  const simulatorUrl = SIMULATOR_BASE;
  console.log('[e2e-validation] Seeding environment via DemoDataGenerator...');
  try {
    execSync(
      `dotnet run --project tools/DemoDataGenerator -- --use-simulator --upload-files --create-servers --direct-connection --simulator-url ${simulatorUrl}`,
      {
        timeout: 180000,
        stdio: 'inherit',
        cwd: PROJECT_ROOT,
      }
    );
    console.log('[e2e-validation] DemoDataGenerator seeding complete');
  } catch (err) {
    throw new Error(`FATAL: DemoDataGenerator seeding failed: ${err}`);
  }

  // Write lock file so subsequent spec files skip seeding
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
}

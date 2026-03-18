/**
 * E2E Validation global teardown module.
 * Called from test.afterAll() in spec files.
 *
 * Responsibilities:
 * 1. Load all persisted result fragments from spec files
 * 2. Generate combined E2E validation report
 * 3. Clean up persisted fragments
 */
import * as fs from 'fs';
import * as path from 'path';
import { E2EValidationReporter } from './helpers/validation-reporter';

const PROJECT_ROOT = process.env.PROJECT_ROOT || 'C:\\Users\\UserC\\source\\repos\\EZ';
const LOCK_FILE = path.join(PROJECT_ROOT, 'test-results', '.e2e-validation-seeded');

export async function e2eValidationTeardown(): Promise<void> {
  // Load all persisted results from all spec files
  const reporter = new E2EValidationReporter();
  reporter.loadAllPersistedResults();

  if (reporter['results'].length > 0) {
    const reportPath = reporter.writeReport();
    console.log(`[e2e-validation] Validation report: ${reportPath}`);
  } else {
    console.log('[e2e-validation] No results collected — skipping report generation');
  }

  // Clean up persisted fragments and seeding lock file
  E2EValidationReporter.cleanPersistedResults();
  try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ }
}

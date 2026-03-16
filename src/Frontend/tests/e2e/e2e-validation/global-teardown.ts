/**
 * E2E Validation global teardown module.
 * Called from test.afterAll() in spec files.
 *
 * Responsibilities:
 * 1. Load all persisted result fragments from spec files
 * 2. Generate combined E2E validation report
 * 3. Clean up persisted fragments
 */
import { E2EValidationReporter } from './helpers/validation-reporter';

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

  // Clean up persisted fragments
  E2EValidationReporter.cleanPersistedResults();
}

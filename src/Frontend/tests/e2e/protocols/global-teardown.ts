/**
 * Global teardown for protocol test suite.
 *
 * Collects all persisted test results from individual protocol test files
 * and generates the final protocol x format matrix report as markdown.
 *
 * Results are persisted to disk by each test file via matrixReporter.enablePersistence().
 * This teardown loads all fragment files, combines them, and writes the report.
 *
 * Output: src/Frontend/test-results/protocol-matrix-report.md
 */
import { MatrixReporter } from '../helpers/report-generator';
import * as path from 'path';

async function globalTeardown() {
  // Only generate report when protocol tests were executed.
  const isProtocolRun =
    process.env.PROTOCOL_TESTS === 'true' ||
    process.argv.some((arg) => arg.includes('protocols'));
  if (!isProtocolRun) {
    return;
  }

  const reporter = new MatrixReporter();

  // Load all persisted result fragments from test files
  reporter.loadAllPersistedResults();

  const resultCount = reporter.getResults().length;
  console.log(`[Global Teardown] Collected ${resultCount} total test results`);

  if (resultCount === 0) {
    console.warn('[Global Teardown] WARNING: No test results collected. Report will be empty.');
    console.warn(
      '[Global Teardown] This may indicate all tests were skipped or persistence was not enabled.'
    );
  }

  // Write the final matrix report
  const reportPath = path.resolve(__dirname, '..', '..', '..', 'test-results', 'protocol-matrix-report.md');
  console.log(`[Global Teardown] Writing protocol matrix report to ${reportPath}`);
  reporter.writeReport(reportPath);
  console.log('[Global Teardown] Report generated successfully');

  // Print summary to console
  const markdown = reporter.generateMarkdown();
  console.log('\n' + '='.repeat(80));
  console.log('PROTOCOL x FORMAT MATRIX REPORT');
  console.log('='.repeat(80));
  console.log(markdown);

  // Clean up persisted fragments (report is now written)
  MatrixReporter.cleanPersistedResults();
}

export default globalTeardown;

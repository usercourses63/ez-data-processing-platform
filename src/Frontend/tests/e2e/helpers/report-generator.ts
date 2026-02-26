/**
 * Protocol x format matrix report generator.
 * Collects test results across protocol test files and produces
 * a markdown summary table.
 *
 * File-based persistence: Each test file's results are saved to a temp JSON
 * file in test-results/.protocol-results/. This solves Playwright's worker
 * isolation where the singleton instance does not share state across
 * separate Node.js processes. Global teardown loads all temp files to
 * produce the combined matrix report.
 *
 * Output: src/Frontend/test-results/protocol-matrix-report.md
 */
import * as fs from 'fs';
import * as path from 'path';

/** Directory where per-test-file result fragments are persisted */
const RESULTS_DIR = path.resolve(__dirname, '..', '..', '..', 'test-results', '.protocol-results');

export interface TestResult {
  protocol: string;
  format: string;
  operation: 'TestConnection' | 'List' | 'Read' | 'Write';
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export class MatrixReporter {
  private results: TestResult[] = [];
  private persistenceTag: string | null = null;

  /**
   * Enable automatic file-based persistence for this reporter instance.
   * Every addResult call will append to a JSON file identified by the tag.
   * Call this in test file beforeAll() to set the protocol tag.
   */
  enablePersistence(tag: string): void {
    this.persistenceTag = tag;
    // Ensure results directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }
  }

  /**
   * Add a test result to the matrix
   */
  addResult(
    protocol: string,
    format: string,
    operation: 'TestConnection' | 'List' | 'Read' | 'Write',
    passed: boolean,
    error?: string,
    durationMs?: number
  ): void {
    const result: TestResult = { protocol, format, operation, passed, error, durationMs };
    this.results.push(result);

    // Auto-persist to disk if persistence is enabled
    if (this.persistenceTag) {
      this.appendResultToDisk(result);
    }
  }

  /**
   * Get all collected results (in-memory only)
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * Save all in-memory results to a JSON file.
   * Used by test files in afterAll() as a final flush.
   */
  saveResults(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2), 'utf-8');
    console.log(`[report-generator] Saved ${this.results.length} results to: ${filePath}`);
  }

  /**
   * Load results from a JSON file into this reporter.
   */
  loadResults(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      console.warn(`[report-generator] Results file not found: ${filePath}`);
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const loaded: TestResult[] = JSON.parse(content);
    this.results.push(...loaded);
    console.log(`[report-generator] Loaded ${loaded.length} results from: ${filePath}`);
  }

  /**
   * Load all result fragment files from the persistence directory.
   * Used by global-teardown to collect results across all test files.
   */
  loadAllPersistedResults(): void {
    if (!fs.existsSync(RESULTS_DIR)) {
      console.warn(`[report-generator] Persistence directory not found: ${RESULTS_DIR}`);
      return;
    }
    const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'));
    let totalLoaded = 0;
    for (const file of files) {
      const filePath = path.join(RESULTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      try {
        const loaded: TestResult[] = JSON.parse(content);
        this.results.push(...loaded);
        totalLoaded += loaded.length;
      } catch (err) {
        console.warn(`[report-generator] Failed to parse ${file}: ${err}`);
      }
    }
    console.log(
      `[report-generator] Loaded ${totalLoaded} total results from ${files.length} fragment files`
    );
  }

  /**
   * Clean up persisted result fragment files.
   * Called by global-setup to ensure a fresh run, and by global-teardown after report generation.
   */
  static cleanPersistedResults(): void {
    if (!fs.existsSync(RESULTS_DIR)) return;
    const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      fs.unlinkSync(path.join(RESULTS_DIR, file));
    }
    if (files.length > 0) {
      console.log(`[report-generator] Cleaned ${files.length} persisted result files`);
    }
  }

  /**
   * Generate a markdown report of the protocol x format matrix
   */
  generateMarkdown(): string {
    const lines: string[] = [];
    const timestamp = new Date().toISOString();

    lines.push('# Protocol x Format Test Matrix Report');
    lines.push('');
    lines.push(`**Generated:** ${timestamp}`);
    lines.push(`**Total Results:** ${this.results.length}`);
    lines.push('');

    // Build the main matrix table
    lines.push('## Results Matrix');
    lines.push('');
    lines.push('| Protocol | Format | TestConnection | List | Read | Write | Status |');
    lines.push('|----------|--------|----------------|------|------|-------|--------|');

    // Group by protocol + format
    const protocolFormats = this.getProtocolFormatGroups();

    let totalPass = 0;
    let totalFail = 0;

    for (const [key, ops] of protocolFormats) {
      const [protocol, format] = key.split('::');
      const testConn = this.formatOp(ops.get('TestConnection'));
      const list = this.formatOp(ops.get('List'));
      const read = this.formatOp(ops.get('Read'));
      const write = this.formatOp(ops.get('Write'));

      // Row status: any FAIL = FAIL
      const allOps = [ops.get('TestConnection'), ops.get('List'), ops.get('Read'), ops.get('Write')];
      const hasFailure = allOps.some((r) => r !== undefined && !r.passed);
      const hasAnyResult = allOps.some((r) => r !== undefined);
      const status = !hasAnyResult ? 'N/A' : hasFailure ? 'FAIL' : 'PASS';

      if (status === 'PASS') totalPass++;
      if (status === 'FAIL') totalFail++;

      lines.push(`| ${protocol} | ${format} | ${testConn} | ${list} | ${read} | ${write} | ${status} |`);
    }

    // Summary
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Passed:** ${totalPass}`);
    lines.push(`- **Failed:** ${totalFail}`);
    lines.push(`- **Total Combinations:** ${totalPass + totalFail}`);
    lines.push('');

    // Failures detail section
    const failures = this.results.filter((r) => !r.passed);
    if (failures.length > 0) {
      lines.push('## Failures');
      lines.push('');
      for (const f of failures) {
        lines.push(`- **${f.protocol}** / ${f.format} / ${f.operation}: ${f.error || 'Unknown error'}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Report generated by protocol-matrix-reporter at ${timestamp}*`);

    return lines.join('\n');
  }

  /**
   * Write the report to disk
   */
  writeReport(outputPath?: string): string {
    const defaultPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'test-results',
      'protocol-matrix-report.md'
    );
    const filePath = outputPath || defaultPath;

    // Ensure output directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = this.generateMarkdown();
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`[report-generator] Matrix report written to: ${filePath}`);
    return filePath;
  }

  /**
   * Reset all collected results
   */
  reset(): void {
    this.results = [];
  }

  // ===== Private helpers =====

  /**
   * Append a single result to the persisted JSON file for this tag.
   * Each tag gets its own file: .protocol-results/{tag}.json
   */
  private appendResultToDisk(result: TestResult): void {
    if (!this.persistenceTag) return;

    const filePath = path.join(RESULTS_DIR, `${this.persistenceTag}.json`);

    // Read existing results if file exists
    let existing: TestResult[] = [];
    if (fs.existsSync(filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        existing = [];
      }
    }

    existing.push(result);
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
  }

  private getProtocolFormatGroups(): Map<string, Map<string, TestResult>> {
    const groups = new Map<string, Map<string, TestResult>>();

    for (const result of this.results) {
      const key = `${result.protocol}::${result.format}`;
      if (!groups.has(key)) {
        groups.set(key, new Map());
      }
      groups.get(key)!.set(result.operation, result);
    }

    return groups;
  }

  private formatOp(result: TestResult | undefined): string {
    if (!result) return 'N/A';
    return result.passed ? 'PASS' : 'FAIL';
  }
}

/**
 * Singleton instance for cross-file accumulation.
 * Protocol test files import this and add results during execution.
 *
 * IMPORTANT: Due to Playwright worker isolation, each test file runs in a
 * separate Node.js process. Call matrixReporter.enablePersistence('protocol-name')
 * in beforeAll() so results are automatically saved to disk. The global
 * teardown collects all persisted fragments to produce the final report.
 */
export const matrixReporter = new MatrixReporter();

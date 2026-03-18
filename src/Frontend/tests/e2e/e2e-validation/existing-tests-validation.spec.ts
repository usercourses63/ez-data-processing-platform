/**
 * Existing Tests Validation Orchestrator
 *
 * Runs all existing Playwright specs (11 files, chromium project) and
 * backend integration tests against the file-simulator environment.
 * Captures results and produces the final E2E-VALIDATION-REPORT.md.
 *
 * Phase 18 Plan 04 — validates zero skips for file-simulator unavailability.
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { e2eValidationSetup } from './global-setup';
import { e2eReporter, E2EValidationReporter } from './helpers/validation-reporter';

const PROJECT_ROOT = process.env.PROJECT_ROOT || 'C:\\Users\\UserC\\source\\repos\\EZ';
const FILE_SIMULATOR_IP = process.env.FILE_SIMULATOR_IP || '172.25.201.3';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await e2eValidationSetup();
  e2eReporter.enablePersistence('existing-validation');
});

test('Run existing Playwright chromium tests', async () => {
  const startTime = Date.now();
  try {
    // Run all existing chromium project tests (11 spec files)
    // Use --reporter=json to capture structured results
    const result = execSync(
      'npx playwright test --project=chromium --reporter=json',
      {
        cwd: `${PROJECT_ROOT}/src/Frontend`,
        timeout: 300000, // 5 min
        encoding: 'utf-8',
        env: {
          ...process.env,
          FILE_SIMULATOR_URL: process.env.FILE_SIMULATOR_URL || 'http://file-simulator.local:30500',
        },
      }
    );
    // Parse JSON results and add to reporter
    try {
      const json = JSON.parse(result);
      for (const suite of json.suites || []) {
        for (const spec of suite.specs || []) {
          e2eReporter.addResult({
            suite: 'existing-playwright',
            testName: `${suite.title} > ${spec.title}`,
            passed: spec.ok,
            durationMs: spec.tests?.[0]?.results?.[0]?.duration,
            error: spec.ok ? undefined : spec.tests?.[0]?.results?.[0]?.error?.message?.substring(0, 200),
            category: 'ui',
          });
        }
      }
    } catch {
      // JSON parse might fail if output has extra text
      e2eReporter.addResult({
        suite: 'existing-playwright',
        testName: 'chromium project (all)',
        passed: true,
        durationMs: Date.now() - startTime,
        category: 'ui',
      });
    }
  } catch (err: any) {
    // Non-zero exit = some tests failed
    e2eReporter.addResult({
      suite: 'existing-playwright',
      testName: 'chromium project (all)',
      passed: false,
      error: `Exit code non-zero: ${err.message?.substring(0, 200)}`,
      durationMs: Date.now() - startTime,
      category: 'ui',
    });
    // Don't throw - we want to continue to collect all results
    console.error(`[existing-validation] Chromium tests had failures: ${err.message?.substring(0, 200)}`);
  }
});

test('Run backend integration tests with file-simulator', async () => {
  const startTime = Date.now();
  try {
    const result = execSync(
      'dotnet test tests/IntegrationTests/DataProcessing.IntegrationTests.csproj --logger "trx" --results-directory test-results/backend -v n',
      {
        cwd: PROJECT_ROOT,
        timeout: 300000, // 5 min
        encoding: 'utf-8',
        env: {
          ...process.env,
          FILE_SIMULATOR_IP: FILE_SIMULATOR_IP,
        },
      }
    );
    e2eReporter.addResult({
      suite: 'existing-backend',
      testName: 'Integration tests (all)',
      passed: true,
      durationMs: Date.now() - startTime,
      category: 'backend',
    });
  } catch (err: any) {
    e2eReporter.addResult({
      suite: 'existing-backend',
      testName: 'Integration tests (all)',
      passed: false,
      error: `dotnet test failed: ${err.message?.substring(0, 200)}`,
      durationMs: Date.now() - startTime,
      category: 'backend',
    });
    console.error(`[existing-validation] Backend tests had failures: ${err.message?.substring(0, 200)}`);
  }
});

test('Generate final E2E validation report', async () => {
  // Load all persisted results from all spec files (plans 01-04)
  const finalReporter = new E2EValidationReporter();
  finalReporter.loadAllPersistedResults();

  const reportPath = finalReporter.writeReport(
    `${PROJECT_ROOT}/test-results/E2E-VALIDATION-REPORT.md`
  );
  console.log(`[existing-validation] Final report: ${reportPath}`);

  // Verify report was written
  const fs = require('fs');
  expect(fs.existsSync(reportPath)).toBeTruthy();

  // Log summary
  const content = fs.readFileSync(reportPath, 'utf-8');
  const passMatch = content.match(/\*\*Passed:\*\* (\d+)/);
  const failMatch = content.match(/\*\*Failed:\*\* (\d+)/);
  if (passMatch && failMatch) {
    console.log(`[existing-validation] FINAL: ${passMatch[1]} passed, ${failMatch[1]} failed`);
  }

  // Clean up persisted fragments
  E2EValidationReporter.cleanPersistedResults();
});

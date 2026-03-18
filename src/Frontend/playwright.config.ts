import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for EZ Data Processing Platform
 * @see https://playwright.dev/docs/test-configuration
 *
 * Features:
 * - Visual regression testing with toHaveScreenshot()
 * - RTL layout verification (Hebrew UI)
 * - Multi-browser support (Chromium, Firefox, WebKit)
 * - Mobile viewport testing
 */
export default defineConfig({
  // Global setup/teardown for protocol test suite
  // Pre-flight health checks + matrix report generation
  // Gated internally: only runs when --project=protocols or PROTOCOL_TESTS=true
  globalSetup: require.resolve('./tests/e2e/protocols/global-setup'),
  globalTeardown: require.resolve('./tests/e2e/protocols/global-teardown'),

  // Test directory
  testDir: './tests/e2e',

  // Snapshot directory for visual regression baselines
  snapshotDir: './tests/e2e/snapshots',

  // Snapshot path template - organize by test file and project
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{projectName}/{arg}{ext}',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],

  // Output directory for test artifacts (screenshots, videos, traces)
  outputDir: './test-results',

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    // Default to port 7000 for K8s port-forwarded frontend, fallback to 3000 for local dev
    baseURL: process.env.BASE_URL || 'http://localhost:7000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'on-first-retry',

    // Default timeout for actions
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Global timeout for each test
  timeout: 60000,

  // Expect configuration with snapshot settings
  expect: {
    timeout: 10000,

    // Visual regression snapshot settings
    toHaveScreenshot: {
      // Allow 30% pixel difference for dynamic content (timestamps, live data)
      maxDiffPixelRatio: 0.3,

      // Threshold for individual pixel color difference
      threshold: 0.2,

      // Animation handling
      animations: 'disabled',

      // Scale images for consistent comparison across displays
      scale: 'device',
    },

    // Page screenshot settings
    toMatchSnapshot: {
      // Allow 30% difference for RTL layout variations
      maxDiffPixelRatio: 0.3,
      threshold: 0.2,
    },
  },

  // Configure projects - chromium only
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Protocol file operations testing (chromium only, sequential, 2min timeout)
    {
      name: 'protocols',
      testDir: './tests/e2e/protocols',
      use: {
        ...devices['Desktop Chrome'],
        // Longer action timeout for cross-cluster network operations
        actionTimeout: 30000,
        navigationTimeout: 60000,
      },
      timeout: 120000, // 2 min per test (network operations across clusters)
      fullyParallel: false, // Sequential to avoid resource contention
    },

    // E2E validation suite — full pipeline flow tests (sequential, 3min timeout)
    {
      name: 'e2e-validation',
      testDir: './tests/e2e/e2e-validation',
      use: {
        ...devices['Desktop Chrome'],
        actionTimeout: 30000,
        navigationTimeout: 60000,
      },
      timeout: 180000, // 3 min per test (pipeline flow with polling)
      fullyParallel: false, // Sequential — tests depend on seeded state
    },
  ],

  // Run local dev server before starting the tests
  // Disabled by default - K8s port-forward on 7000 is typically active
  // Set RUN_WEBSERVER=true to start local dev server instead
  webServer: process.env.RUN_WEBSERVER ? {
    command: 'npm start',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,
});

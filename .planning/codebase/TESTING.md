# Testing Patterns

**Analysis Date:** 2026-02-02

## Test Framework

**Runner:**
- Frontend: Playwright `@playwright/test` v1.49.0
- Config: `src/Frontend/playwright.config.ts`
- Backend: Integration tests use xUnit/.NET test frameworks (project structure indicates testing via `*.Tests` projects)

**Assertion Library:**
- Playwright: Native `expect()` API with TypeScript support
- Backend: NUnit/xUnit assertions (inferred from service structure)

**Run Commands:**
```bash
# Frontend E2E tests - all browsers
npm run test:e2e

# Watch mode with UI
npm run test:e2e:ui

# Headed mode (visible browser)
npm run test:e2e:headed

# View report
npm run test:e2e:report
```

## Test File Organization

**Location (Frontend):**
- Base directory: `src/Frontend/tests/e2e/`
- Files: `datasource.spec.ts`, `invalid-records.spec.ts`, `metrics.spec.ts`, `alerts.spec.ts`
- Path pattern: `tests/e2e/[feature].spec.ts`

**Naming (Frontend):**
- Feature-based: one spec file per major feature
- Suffix: `.spec.ts` (Playwright convention)
- File structure: Group related tests in single spec file

**Structure (Frontend):**
```
tests/
├── e2e/
│   ├── datasource.spec.ts
│   ├── invalid-records.spec.ts
│   ├── metrics.spec.ts
│   └── alerts.spec.ts
├── fixtures/
└── README.md
```

**Backend:**
- Integration tests in service-specific `*.Tests` projects
- Located alongside service code (project structure suggests `[ServiceName].Tests` folders)
- Pattern: `src/Services/[ServiceName].Tests/`

## Test Structure

**Test Suite Organization (Playwright):**
```typescript
// From datasource.spec.ts (lines 9-15)
test.describe('DataSource Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the data sources page
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display the data sources list', async ({ page }) => {
    // Test implementation
  });
});
```

**Patterns:**
- `test.describe()`: Group related tests
- `test.beforeEach()`: Setup before each test
- `test()`: Individual test case
- Test naming: descriptive "should" phrases (line 17, 25, 33, etc.)

**Setup/Teardown:**
- `beforeEach`: Navigate to page, wait for load state (lines 10-15)
- `afterEach`: Implicit cleanup via browser context isolation
- No explicit teardown in provided examples; Playwright handles cleanup

**Assertion Pattern:**
```typescript
// Role-based locators (recommended)
await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();

// Test ID locators
await expect(page.getByTestId('datasource-filter')).toBeTruthy();

// Text-based locators
await expect(page.getByText('ניהול מקורות נתונים')).toBeVisible();
```

## Mocking

**Framework:** Playwright does not use Jest/Vitest mocks
- **Network interception:** `page.waitForResponse()` for monitoring API calls
- **Local storage:** Via `page.context().storageState()`
- **Test data fixtures:** Fixture files in `tests/fixtures/` (referenced in lines 254, 264)

**Patterns (Network Mocking):**
```typescript
// Wait for API response
await page.waitForResponse(resp => resp.url().includes('/api/data'));

// Monitor requests
page.on('request', req => requests.push(req.url()));

// Wait for network idle
await page.waitForLoadState('networkidle');
```

**Test Data Fixtures:**
```typescript
// From README.md lines 254-270
export const testDataSource = {
  name: 'E2E Test Source',
  description: 'Created by automated tests',
  type: 'local-file',
  path: '/data/test',
  format: 'csv'
};

test('should create datasource', async ({ page }) => {
  await page.getByLabel(/name/i).fill(testDataSource.name);
});
```

**What to Mock:**
- API responses: intercept with `page.waitForResponse()`
- External services: test against real services in staging (recommended per README)
- Network conditions: via Playwright device emulation

**What NOT to Mock:**
- UI interactions (always simulate real user clicks)
- Form validation (always test actual form behavior)
- Navigation (always verify URL changes)

## Fixtures and Factories

**Test Data:**
- Location: `tests/fixtures/` directory (implicit, referenced in README lines 254-261)
- Pattern: Object literals with test data constants
- Reusability: Import fixtures in multiple test files

**Example Structure (from README):**
```typescript
// fixtures/datasources.ts
export const testDataSource = {
  name: 'E2E Test Source',
  description: 'Created by automated tests',
  type: 'local-file',
  path: '/data/test',
  format: 'csv'
};
```

**Cleanup Pattern:**
```typescript
// From README lines 274-277
test.afterEach(async ({ page }) => {
  // Clean up test data via API
  await page.request.delete('/api/datasources?name=E2E*');
});
```

## Coverage

**Requirements:** No coverage target enforced
- Playwright tests are E2E, not unit tests
- Coverage metrics not tracked in visible config
- Focus on critical user journeys (6 main E2E scenarios per CLAUDE.md)

**View Coverage:**
- HTML report: `npm run test:e2e:report`
- JSON output: configured to `test-results/results.json` (playwright.config.ts line 26)

## Test Types

**Unit Tests:**
- Not explicitly configured in frontend
- Backend services likely have unit tests in `*.Tests` projects
- For this analysis, focus is on E2E and integration

**Integration Tests (Frontend E2E):**
- Scope: Full user workflows across multiple pages
- Approach: Test actual browser navigation, form submission, API calls
- Examples: datasource.spec.ts tests full CRUD flow with multiple tabs

**E2E Tests (Playwright):**
- Framework: `@playwright/test`
- Configuration: `playwright.config.ts` (7 test projects for cross-browser testing)
- Test matrix:
  - Chromium (Desktop)
  - Firefox (Desktop)
  - Safari (Desktop)
  - Chrome Mobile (Pixel 5)
  - Safari Mobile (iPhone 12)

**6 Main E2E Scenarios (from CLAUDE.md):**
1. **E2E-001:** Basic pipeline (FileDiscovery → Validation → Output)
2. **E2E-002:** Large file processing (100+ records)
3. **E2E-003:** Invalid records handling
4. **E2E-004:** Multi-destination output (Folder + Kafka)
5. **E2E-005:** Scheduled polling verification
6. **E2E-006:** Error recovery & retry logic

## Common Patterns

**Async Testing:**
```typescript
// From datasource.spec.ts lines 25-31
test('should navigate to create new data source', async ({ page }) => {
  await page.getByRole('button', { name: /הוסף מקור נתונים חדש|הוסף/ }).click();
  await expect(page).toHaveURL(/create|new/);
});

// With network wait
await page.waitForResponse(resp => resp.url().includes('/api/'));
```

**Waiting Strategies (from README lines 139-152):**
```typescript
// Wait for element visibility
await expect(page.getByText(/loaded/i)).toBeVisible({ timeout: 30000 });

// Wait for navigation
await page.waitForURL(/\/details/);

// Wait for API response
await page.waitForResponse(resp => resp.url().includes('/api/data'));

// Wait for network idle
await page.waitForLoadState('networkidle');
```

**Locator Best Practices:**

1. **Role-based (most accessible):**
```typescript
// From README lines 120-125
await page.getByRole('button', { name: /submit/i });
await page.getByRole('heading', { name: /title/i });
await page.getByRole('tab', { name: /settings/i });
```

2. **Test IDs (complex components):**
```typescript
// From README lines 128-130
await page.getByTestId('datasource-filter');
await page.locator('[data-testid="metric-type-select"]');
```

3. **Text-based with regex (flexible):**
```typescript
// From README lines 133-136
await page.getByText(/create|add|new/i);
await page.getByLabel(/name/i);
```

**Playwright Configuration (playwright.config.ts):**
- Parallel execution: `fullyParallel: true` (line 12)
- Retries on CI: `retries: process.env.CI ? 2 : 0` (line 18)
- Single worker on CI: `workers: process.env.CI ? 1 : undefined` (line 21)
- Global timeout: 60 seconds per test (line 52)
- Action timeout: 10 seconds (line 45)
- Navigation timeout: 30 seconds (line 48)
- Expect timeout: 10 seconds (line 56)

**Video/Screenshots Configuration (playwright.config.ts lines 35-42):**
```typescript
trace: 'on-first-retry',        // Trace on first retry
screenshot: 'only-on-failure',  // Screenshots on failure
video: 'on-first-retry',        // Video on first retry
```

## Error Testing

**Pattern (E2E approach):**
```typescript
// From datasource.spec.ts - testing error states
test('should handle validation errors', async ({ page }) => {
  // Submit form without required fields
  await page.getByRole('button', { name: /save|submit/i }).click();

  // Verify error message displayed
  await expect(page.getByText(/required|error/i)).toBeVisible();
});
```

**Error Scenarios (from test structure):**
- Invalid connection configuration (connection test failures)
- Missing required fields (form validation)
- Duplicate data source names (API validation)
- Invalid JSON schemas (schema validation)
- Network timeouts (connection test edge cases)

**Debugging Failed Tests (from README lines 196-213):**

1. **Trace Viewer:**
```bash
npx playwright test --trace on
npx playwright show-trace test-results/*/trace.zip
```

2. **Debug Mode:**
```bash
npx playwright test --debug
npx playwright test --debug-on-fail
```

3. **Screenshots/Videos:**
- Configured in `playwright.config.ts`
- Output: `test-results/` directory

## Test Environment Configuration

**Base URL:**
```typescript
// playwright.config.ts line 33
baseURL: process.env.BASE_URL || 'http://localhost:3000'
```

**Environment Overrides (from README lines 78-92):**
```bash
# Local development (default)
npx playwright test

# Staging environment
BASE_URL=https://staging.ez-platform.com npx playwright test

# Production (read-only tests)
BASE_URL=https://ez-platform.com npx playwright test --grep @smoke
```

**CI/CD Integration (from README lines 157-194):**
- GitHub Actions matrix testing
- Install dependencies: `npm ci`
- Install browsers: `npx playwright install --with-deps`
- Run tests with CI flag: `CI=true npx playwright test`
- Upload artifacts on failure

## Performance Testing Patterns

**Page Load Performance (from README lines 225-233):**
```typescript
test('should load dashboard quickly', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/metrics/dashboard');
  await page.waitForSelector('.recharts-wrapper');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(5000); // 5 seconds max
});
```

**Network Request Optimization (from README lines 237-247):**
```typescript
test('should not make excessive API calls', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', req => requests.push(req.url()));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const apiCalls = requests.filter(r => r.includes('/api/'));
  expect(apiCalls.length).toBeLessThan(20);
});
```

## Test Data Management

**Fixture Pattern:**
- Location: `tests/fixtures/` directory
- Import in test files: `import { testDataSource } from '../fixtures/datasources'`
- Reuse across multiple test files
- Constants for consistent data

**Cleanup Strategy:**
```typescript
test.afterEach(async ({ page }) => {
  // Delete test data via API
  await page.request.delete('/api/datasources?name=E2E*');
});
```

## Current Test Coverage Status

**E2E Tests (All Passing):**
- 6 main scenarios (per CLAUDE.md)
- 4 test files implemented: datasource.spec.ts, invalid-records.spec.ts, metrics.spec.ts, alerts.spec.ts
- Cross-browser testing: Chromium, Firefox, Safari, Mobile Chrome, Mobile Safari

**Known Test Gaps (per CLAUDE.md):**
- Multiple file formats: Only CSV fully tested (XML, Excel, JSON not covered)
- High load testing: Max tested 100 records (10,000+ not tested)
- Multi-destination scaling: Only 2 destinations tested (4+ not tested)

**Test Readiness:**
- Hebrew UI support verified (lines 19, 27, 71, etc. in datasource.spec.ts)
- RTL layout testing via Ant Design components
- Mobile viewports included in test matrix

---

*Testing analysis: 2026-02-02*

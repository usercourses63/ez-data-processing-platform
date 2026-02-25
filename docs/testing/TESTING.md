---
sidebar_position: 3
last-verified: 2026-02-02
status: current
description: Complete testing guide for EZ Platform - E2E-first strategy, running tests, patterns, and coverage
---

# Testing Guide

> Complete testing documentation for EZ Platform - test strategy, running tests, patterns, and coverage analysis

---

## Overview

EZ Platform follows an **E2E-first testing strategy** that prioritizes end-to-end user journey validation over unit testing. This approach ensures real-world workflow validation while minimizing test maintenance overhead.

### Test Pyramid (E2E-First)

```
        ┌──────────────────┐
        │ E2E Tests (60%) │  ← Primary focus (6 scenarios - ALL PASSING)
        └──────────────────┘
             ┌────────────┐
             │ Integration│  ← Critical paths (83 tests - ALL PASSING)
             │ Tests (25%)│
             └────────────┘
                  ┌────┐
                  │Unit│  ← Critical logic (25 tests)
                  │15% │
                  └────┘
```

### Test Suites

| Suite | Framework | Location | Focus |
|-------|-----------|----------|-------|
| E2E | Playwright | `src/Frontend/tests/e2e/` | User workflows |
| Integration | xUnit/.NET | `src/Services/*.Tests/` | Service integration |
| Unit | xUnit/.NET | `src/Services/*.Tests/` | Critical business logic |

### 6 Main E2E Scenarios

| ID | Description | Records | Status |
|----|-------------|---------|--------|
| E2E-001 | Complete Pipeline (FileDiscovery → Validation → Output) | 100 | ✅ PASS |
| E2E-002 | Large File Processing | 100+ | ✅ PASS |
| E2E-003 | Invalid Records Handling | 50 | ✅ PASS |
| E2E-004 | Multi-Destination Output (Folder + Kafka) | 100 | ✅ PASS |
| E2E-005 | Scheduled Polling Verification | - | ✅ PASS |
| E2E-006 | Error Recovery & Retry Logic | - | ✅ PASS |

---

## Operations

This section covers running tests and CI/CD integration.

### Running E2E Tests

```bash
# Navigate to frontend
cd src/Frontend

# Run all E2E tests
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with interactive UI
npm run test:e2e:ui

# View test report
npm run test:e2e:report

# Run specific test file
npx playwright test datasource.spec.ts

# Run with tag filter
npx playwright test --grep @smoke
```

### Running Backend Tests

```bash
# Run all tests for a service
cd src/Services/FileProcessorService.Tests
dotnet test

# Run with verbose output
dotnet test -v detailed

# Run specific test class
dotnet test --filter "ClassName=FileProcessorTests"

# Generate coverage report
dotnet test --collect:"XPlat Code Coverage"
```

### CI/CD Integration

**GitHub Actions workflow:**

```yaml
steps:
  - name: Install dependencies
    run: npm ci
    working-directory: src/Frontend

  - name: Install Playwright browsers
    run: npx playwright install --with-deps
    working-directory: src/Frontend

  - name: Run E2E tests
    run: CI=true npm run test:e2e
    working-directory: src/Frontend
    env:
      BASE_URL: ${{ vars.STAGING_URL }}

  - name: Upload artifacts on failure
    if: failure()
    uses: actions/upload-artifact@v3
    with:
      name: playwright-report
      path: src/Frontend/test-results/
```

### Environment Configuration

```bash
# Local development (default)
npx playwright test

# Staging environment
BASE_URL=https://staging.ez-platform.com npx playwright test

# Production (read-only smoke tests)
BASE_URL=https://ez-platform.com npx playwright test --grep @smoke
```

### Prerequisites

Before running tests, ensure:

1. **Services running:** All microservices deployed and healthy
2. **Port forwarding active:** `scripts/start-port-forwards.ps1`
3. **Demo data generated:** `cd tools/DemoDataGenerator && dotnet run`
4. **Frontend accessible:** http://localhost:7000

### Debugging Failed Tests

**Trace viewer:**
```bash
npx playwright test --trace on
npx playwright show-trace test-results/*/trace.zip
```

**Debug mode:**
```bash
npx playwright test --debug
npx playwright test --debug-on-fail
```

**Screenshots/Videos:**
- Output location: `test-results/`
- Configured in `playwright.config.ts`
- Screenshots: only on failure
- Videos: on first retry

---

## Development

This section covers writing tests and test patterns.

### Test File Organization

**Frontend E2E tests:**
```
src/Frontend/tests/
├── e2e/
│   ├── datasource.spec.ts      # Data source CRUD workflows
│   ├── invalid-records.spec.ts # Invalid record handling
│   ├── metrics.spec.ts         # Metrics configuration
│   └── alerts.spec.ts          # Alert rule management
├── fixtures/
│   └── datasources.ts          # Test data constants
└── README.md
```

**Backend integration tests:**
```
src/Services/[ServiceName].Tests/
├── Controllers/
│   └── [Controller]Tests.cs
├── Services/
│   └── [Service]Tests.cs
├── Fixtures/
│   └── TestFixtures.cs
└── [ServiceName]Tests.csproj
```

### E2E Test Structure Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('DataSource Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display the data sources list', async ({ page }) => {
    await expect(page.getByText('ניהול מקורות נתונים')).toBeVisible();
    await expect(page.getByTestId('datasource-list')).toBeTruthy();
  });

  test('should create new data source', async ({ page }) => {
    // Navigate to create form
    await page.getByRole('button', { name: /הוסף מקור נתונים חדש/ }).click();
    await expect(page).toHaveURL(/create|new/);

    // Fill form
    await page.getByLabel(/name/i).fill('E2E Test Source');
    await page.getByRole('button', { name: /save|submit/i }).click();

    // Verify success
    await expect(page.getByText(/success|saved/i)).toBeVisible();
  });
});
```

### Locator Best Practices

**1. Role-based (preferred - most accessible):**
```typescript
await page.getByRole('button', { name: /submit/i });
await page.getByRole('heading', { name: /title/i });
await page.getByRole('tab', { name: /settings/i });
```

**2. Test IDs (for complex components):**
```typescript
await page.getByTestId('datasource-filter');
await page.locator('[data-testid="metric-type-select"]');
```

**3. Text-based with regex (flexible for i18n):**
```typescript
await page.getByText(/create|add|new/i);
await page.getByLabel(/name/i);
```

### Waiting Strategies

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

### Test Fixtures

**Creating fixtures:**
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

**Using fixtures:**
```typescript
import { testDataSource } from '../fixtures/datasources';

test('should create datasource', async ({ page }) => {
  await page.getByLabel(/name/i).fill(testDataSource.name);
  await page.getByLabel(/description/i).fill(testDataSource.description);
});
```

**Cleanup pattern:**
```typescript
test.afterEach(async ({ page }) => {
  // Clean up test data via API
  await page.request.delete('/api/datasources?name=E2E*');
});
```

### Backend Test Pattern

```csharp
public class FileProcessorTests : IClassFixture<TestWebApplicationFactory<Program>>
{
    private readonly TestWebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public FileProcessorTests(TestWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task ProcessFile_ValidCsv_ReturnsSuccess()
    {
        // Arrange
        var content = "id,name\n1,test";
        var request = new ProcessFileRequest { Content = content, Format = "csv" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/process", request);

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<ProcessResult>();
        Assert.NotNull(result);
        Assert.True(result.IsSuccess);
    }
}
```

### Mocking Patterns

**Network monitoring (Playwright):**
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

**What to mock:**
- API responses: intercept with `page.waitForResponse()`
- External services: test against real services in staging (recommended)

**What NOT to mock:**
- UI interactions (always simulate real user clicks)
- Form validation (always test actual form behavior)
- Navigation (always verify URL changes)

---

## Architecture

This section covers test strategy, coverage, and quality metrics.

### E2E-First Rationale

**Why E2E-first?**
1. **User journey validation:** Tests actual user workflows
2. **Integration confidence:** Catches service interaction bugs
3. **Lower maintenance:** Fewer tests to maintain vs. unit test pyramid
4. **Refactoring freedom:** Tests behavior, not implementation

**Trade-offs:**
- Slower execution (mitigated by parallel execution)
- Flaky tests possible (mitigated by proper waiting strategies)
- Debugging harder (mitigated by traces and screenshots)

### Coverage Status

**E2E Scenarios (All Passing):**

| Scenario | Coverage |
|----------|----------|
| Data Source CRUD | ✅ Full workflow |
| Schema Management | ✅ Create, assign, validate |
| File Processing | ✅ CSV, XML, Excel, JSON |
| Validation | ✅ Valid/invalid split |
| Multi-Destination | ✅ 4 destinations, 4 formats |
| Error Recovery | ✅ Graceful failure handling |
| High Load | ✅ 10,000 records verified |

**Known Gaps (Documented):**

| Gap | Status | Notes |
|-----|--------|-------|
| Multiple file formats | ✅ Remediated | JSON, XML, Excel verified |
| High load (10K records) | ✅ Remediated | 1,408 records/sec throughput |
| 4+ destinations | ✅ Remediated | All formats verified |
| SFTP failure handling | ✅ Remediated | Graceful failure confirmed |

### Test Matrix

**Browser coverage:**
| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chromium | ✅ | ✅ (Pixel 5) |
| Firefox | ✅ | - |
| Safari | ✅ | ✅ (iPhone 12) |

**Configuration (playwright.config.ts):**
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
]
```

### Playwright Configuration

**Key settings (playwright.config.ts):**

| Setting | Value | Purpose |
|---------|-------|---------|
| `fullyParallel` | true | Run tests in parallel |
| `retries` (CI) | 2 | Retry failed tests |
| `workers` (CI) | 1 | Single worker for stability |
| `timeout` | 60s | Per-test timeout |
| `actionTimeout` | 10s | Per-action timeout |
| `navigationTimeout` | 30s | Navigation timeout |
| `trace` | on-first-retry | Capture traces on failure |
| `screenshot` | only-on-failure | Screenshot on failure |
| `video` | on-first-retry | Video on first retry |

### Performance Testing

**Page load verification:**
```typescript
test('should load dashboard quickly', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/metrics/dashboard');
  await page.waitForSelector('.recharts-wrapper');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(5000); // 5 seconds max
});
```

**High load results (GAP-2 remediation):**

| Metric | Value |
|--------|-------|
| Records processed | 10,000 |
| Processing time | ~7.1 seconds |
| Throughput | ~1,408 records/second |
| Memory issues | None |

### Hebrew/RTL Testing

**Verification points:**
- UI renders correctly in RTL mode
- Hebrew text displays properly
- Form inputs work in RTL context
- Navigation respects RTL layout

**Test examples:**
```typescript
// Hebrew UI verification
await expect(page.getByText('ניהול מקורות נתונים')).toBeVisible();
await expect(page.getByRole('button', { name: /הוסף מקור נתונים חדש/ })).toBeVisible();
```

### Test Data Management

**Test data locations:**
```
test-data/
├── E2E-001/          # Pipeline tests
├── E2E-002/          # Large file tests
├── E2E-003/          # Invalid records tests
├── E2E-004/          # Multi-destination tests
├── E2E-GAP1-*/       # Format verification
├── E2E-GAP2-*/       # High load verification
├── E2E-GAP3-*/       # Multi-destination scaling
└── E2E-GAP4-*/       # SFTP failure handling
```

**Pre-generated test files (TestDataGenerator):**
```
tools/TestDataGenerator/TestFiles/
├── E2E-003/
│   ├── transactions-150.csv
│   ├── transactions-150.xml
│   └── transactions-150.json
├── E2E-006/
│   └── large-file-10000.csv
```

### Quality Gates

**Pre-merge requirements:**
- All E2E tests pass
- No regressions in existing scenarios
- Code review completed
- Documentation updated (if applicable)

**Monitoring in production:**
- Business metrics via Prometheus
- Error tracking via InvalidRecordsService
- Distributed tracing via Jaeger

---

*Last verified: 2026-02-02*

*Consolidated from:*
- .planning/codebase/TESTING.md
- docs/testing/E2E-GAP-ANALYSIS-REPORT.md
- docs/testing/file-simulator-setup.md
- CLAUDE.md (Testing section)

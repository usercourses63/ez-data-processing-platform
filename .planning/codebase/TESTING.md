# Testing Patterns

**Analysis Date:** 2026-01-28

## Test Framework

**Frontend Runner:**
- Framework: Playwright 1.49.0
- Config: `src/Frontend/playwright.config.ts`
- Assertion Library: Playwright assertions (built-in)
- Testing Library integration: `@testing-library/react` 14.1.2 (available but E2E uses Playwright)

**Backend Runner:**
- Framework: xUnit (NuGet package)
- Config: `.csproj` files specify xUnit runner
- Assertion Library: FluentAssertions (for readable assertions)
- Integration test fixtures: Custom fixture classes with `IAsyncLifetime`

**Run Commands:**

Frontend:
```bash
npm run test:e2e              # Run all E2E tests
npm run test:e2e:headed      # Run with browser visible
npm run test:e2e:ui          # Interactive UI mode
npm run test:e2e:report      # View HTML report
```

Backend:
```bash
cd tests/ValidationService.Tests
dotnet test                   # Run unit tests

cd tests/IntegrationTests
dotnet test                   # Run integration tests with fixtures
```

## Test File Organization

**Frontend Location:**
- Base: `src/Frontend/tests/e2e/`
- Pattern: `[feature].spec.ts`
- Current files: `datasource.spec.ts`, `alerts.spec.ts`, `invalid-records.spec.ts`, `metrics.spec.ts`

**Backend Unit Tests Location:**
- `tests/ValidationService.Tests/Services/` - Validation logic tests
  - `JsonSchemaValidationTests.cs` - Schema validation and record extraction
  - `FieldValidationRulesTests.cs` - Field-level validation patterns
- `tests/OutputService.Tests/Handlers/` - Output handler tests
- `tests/Shared.Tests/Converters/` - Format converter tests

**Backend Integration Tests Location:**
- Base: `tests/IntegrationTests/`
- Organization by concern:
  - `Alerts/` - Alert rule functionality
  - `CachingPerformance/` - Hazelcast cache tests
  - `DataPersistence/` - MongoDB tests
  - `ErrorHandling/` - Error scenarios
  - `Fixtures/` - Shared test infrastructure
  - `Observability/` - Correlation ID, tracing
  - `OutputHandlers/` - Output destination tests
  - `ServiceIntegration/` - Kafka flow, health checks

**Test Naming:**
- Frontend: Descriptive test descriptions with `test('should ...')`
- Backend: Descriptive method names like `ExtractRecords_FromJsonArray_ReturnsAllRecords`
- Pattern (Backend): `[Method]_[Scenario]_[Expected]`

## Test Structure

**Frontend E2E Structure (Playwright):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('DataSource Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display the data sources list', async ({ page }) => {
    // Check page title/heading (Hebrew: "ניהול מקורות נתונים")
    await expect(page.getByText('ניהול מקורות נתונים')).toBeVisible();

    // Verify table component exists
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('should fill out basic info tab', async ({ page }) => {
    // Arrange: Navigate and wait
    await page.getByRole('button', { name: /הוסף מקור נתונים חדש|הוסף/ }).click();
    await page.waitForLoadState('networkidle');

    // Act: Fill form
    const nameInput = page.locator('input').first();
    await nameInput.fill('Test DataSource');

    // Assert: Verify
    await expect(nameInput).toHaveValue('Test DataSource');
  });
});
```

**Patterns:**
- `test.beforeEach` for setup before each test
- `test.describe` for grouping related tests
- Ant Design selector patterns: `.ant-table`, `.ant-select`, `.ant-table-selection`
- Playwright locators: `getByText()`, `getByRole()`, `locator()`, `getByLabel()`
- Hebrew content selectors via regex: `/הוסף מקור נתונים חדש|הוסף/`
- Waiters: `waitForLoadState('networkidle')` for network stabilization

**Backend Unit Test Structure (xUnit + FluentAssertions):**
```csharp
[Fact]
public void ExtractRecords_FromJsonArray_ReturnsAllRecords()
{
    // Arrange
    var jsonData = JToken.Parse("""
    [
        { "name": "John", "age": 30 },
        { "name": "Jane", "age": 25 }
    ]
    """);

    // Act
    var records = ExtractRecordsFromJson(jsonData);

    // Assert
    records.Should().HaveCount(2);
    records[0]["name"]?.ToString().Should().Be("John");
    records[1]["name"]?.ToString().Should().Be("Jane");
}

[Theory]
[InlineData("TXN-20251201-000001", true)]
[InlineData("INVALID-ID", false)]
public void TransactionIdField_WithPattern_ValidatesCorrectly(string transactionId, bool expectedValid)
{
    // Arrange: Schema and record setup
    var schema = JSchema.Parse("""...""");
    var record = JObject.Parse($$"""{ "TransactionId": "{{transactionId}}" }""");

    // Act
    var isValid = record.IsValid(schema);

    // Assert
    isValid.Should().Be(expectedValid);
}
```

**Patterns:**
- `[Fact]` for single-case tests
- `[Theory]` with `[InlineData]` for parameterized tests
- AAA pattern: Arrange, Act, Assert (explicit comments)
- FluentAssertions for readable assertions: `.Should().Be()`, `.Should().Contain()`, `.Should().HaveCount()`
- Triple-quoted strings for JSON fixtures
- String interpolation with `$$` for inline data

**Backend Integration Test Structure (xUnit + Fixtures):**
```csharp
[Collection("Integration")]
public class KafkaFlowTests : IClassFixture<KafkaFixture>, IAsyncLifetime
{
    private readonly KafkaFixture _kafka;
    private IConsumer<string, string>? _consumer;

    public KafkaFlowTests(KafkaFixture kafka)
    {
        _kafka = kafka;
    }

    public async Task InitializeAsync()
    {
        // Verify service availability
        var isAvailable = await _kafka.IsKafkaAvailableAsync();
        if (!isAvailable) throw new InvalidOperationException("Service not available");
    }

    public Task DisposeAsync()
    {
        _consumer?.Close();
        _consumer?.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    [Trait("Category", "INT-001")]
    public async Task FileDiscovery_PublishesFileDiscoveredMessage_ToKafka()
    {
        // Arrange
        var topic = TestConfiguration.KafkaTopics.FileDiscovered;
        _consumer = _kafka.CreateConsumer(topic);

        // Act
        await _kafka.ProduceAsync(topic, uniqueId, JsonSerializer.Serialize(testMessage));

        // Assert
        var result = await ConsumeByKeyAsync(_consumer, uniqueId, TimeSpan.FromSeconds(10));
        result.Should().NotBeNull();
    }
}
```

**Patterns:**
- `[Collection("Integration")]` to group integration tests
- `IClassFixture<T>` for dependency injection
- `IAsyncLifetime` for async setup/teardown
- `InitializeAsync()` to verify service availability (check port-forwarding)
- `DisposeAsync()` for cleanup
- `[Trait]` for test categorization (e.g., `INT-001`, `INT-002`)
- Configuration via `TestConfiguration` class with environment variable overrides

## Mocking

**Framework:**
- Frontend: Playwright mocking via `page.route()` (implicit, not used in current tests)
- Backend: No mocking framework; uses test fixtures with real services

**Patterns (Backend - Real Dependencies):**
- Integration tests use real MongoDB, Kafka, Hazelcast, and HTTP clients
- Fixtures provide connection setup: `MongoDbFixture`, `KafkaFixture`, `HazelcastFixture`
- Services tested against actual infrastructure (K8s port-forwarded)
- Test configuration: `TestConfiguration.cs` provides connection strings and timeouts

**Fixture Classes (Backend Integration):**

Location: `tests/IntegrationTests/Fixtures/`

Files:
- `ApiClientFixture.cs` - HTTP client for API testing
- `KafkaFixture.cs` - Kafka producer/consumer setup
- `MongoDbFixture.cs` - MongoDB connection management
- `HazelcastFixture.cs` - Hazelcast cache setup

**What to Mock:**
- External services when unavailable (handled via fixture availability checks)
- Hard-to-reproduce scenarios (e.g., network failures)

**What NOT to Mock:**
- Database operations (use real MongoDB in tests)
- Message broker operations (use real Kafka)
- Cache operations (use real Hazelcast)
- HTTP calls to other services (use real API clients with port-forwarded endpoints)

**Rationale:** E2E-first approach (60% focus) requires testing real interactions.

## Fixtures and Factories

**Test Data (Backend):**

Location: Inline in test methods using triple-quoted JSON

Example from `JsonSchemaValidationTests.cs`:
```csharp
var jsonData = JToken.Parse("""
[
    { "name": "John", "age": 30 },
    { "name": "Jane", "age": 25 }
]
""");
```

**Test Data Files (Frontend E2E):**

Location: `test-data/` directory in repo
- `E2E-001/` - Basic pipeline test data
- `E2E-003/` - Invalid records handling data
- `E2E-004/` - Multi-destination output data
- `E2E-005/` - Scheduled polling data
- `E2E-006/` - Error recovery data

Configuration: `TestConfiguration.cs` defines paths:
```csharp
public static string E2E001DataPath => Path.Combine(TestDataBasePath, "E2E-001");
```

**Fixtures (Backend Integration):**

Fixture Classes in `tests/IntegrationTests/Fixtures/`:
- `ApiClientFixture` - Methods: `CreateDatasourceAsync()`, `GetDatasourceAsync()`, `GetInvalidRecordsAsync()`
- `KafkaFixture` - Methods: `CreateConsumer()`, `ProduceAsync()`, `IsKafkaAvailableAsync()`
- `MongoDbFixture` - MongoDB connection and database access
- `HazelcastFixture` - Cache operations for caching tests

Initialization:
```csharp
public class KafkaFlowTests : IClassFixture<KafkaFixture>, IAsyncLifetime
{
    public async Task InitializeAsync()
    {
        var isAvailable = await _kafka.IsKafkaAvailableAsync();
        if (!isAvailable)
            throw new InvalidOperationException("Kafka unavailable - check port-forwarding");
    }
}
```

## Coverage

**Requirements:**
- Frontend E2E: 6 scenarios (all passing as of v0.1.1-rc3)
  1. E2E-001: Basic pipeline (FileDiscovery → Validation → Output)
  2. E2E-002: Large file processing (100+ records)
  3. E2E-003: Invalid records handling
  4. E2E-004: Multi-destination output (Folder + Kafka)
  5. E2E-005: Scheduled polling verification
  6. E2E-006: Error recovery & retry logic

- Backend:
  - Integration tests: 83 tests (all passing)
  - Unit tests: 25 tests (critical logic only)

**Target distribution (E2E-first):**
```
E2E Tests (60%) ← Primary focus
Integration Tests (25%) ← Critical paths
Unit Tests (15%) ← Critical logic
```

**Known Coverage Gaps:**
- Multiple file formats (XML, Excel, JSON) - Only CSV fully tested
- High load testing (10,000+ records) - Max tested: 100 records
- Multi-destination scaling (4+ destinations) - Only 2 destinations tested

**View Coverage (Frontend):**
```bash
# No explicit coverage tool configured
# E2E tests are manually validated via Playwright reports
npm run test:e2e:report
```

**View Coverage (Backend):**
```bash
# No explicit coverage reporting; tests run via xUnit
dotnet test --verbosity detailed
```

## Test Types

**Frontend E2E Tests (Playwright):**
- Scope: Full user workflows from UI interaction to backend
- Approach: Browser automation with Playwright
- Location: `src/Frontend/tests/e2e/`
- Configuration: `src/Frontend/playwright.config.ts`
- Browsers tested: Chromium, Firefox, WebKit + mobile viewports
- Assertion: Playwright built-in assertions and locators

Example: `datasource.spec.ts` - Tests DataSource CRUD operations
```typescript
test('should configure connection settings', async ({ page }) => {
  // Navigate to create form
  await page.getByRole('button', { name: /הוסף/ }).click();

  // Select connection type
  const typeSelect = page.locator('.ant-select').first();
  await typeSelect.click();
  const localOption = page.getByRole('option', { name: /local|מקומי/i });
  await localOption.click();

  // Fill path and verify
  const pathInput = page.locator('input[type="text"]').first();
  await pathInput.fill('/data/input');
});
```

**Backend Integration Tests (xUnit):**
- Scope: Service-to-service communication, database operations, message flows
- Approach: Real service instances connected via port-forwarding
- Location: `tests/IntegrationTests/`
- Categories (via `[Trait]`):
  - INT-001: FileDiscovery → FileProcessor flow
  - INT-002: FileProcessor → ValidationService flow
  - INT-003: ValidationService → OutputService flow
  - INT-004: Kafka message format validation
  - DA-01 to DA-04: Database persistence tests
  - CA-01, CA-02: Hazelcast caching tests

Example: `KafkaFlowTests.cs` - Tests Kafka message flow
```csharp
[Fact]
[Trait("Category", "INT-001")]
public async Task FileDiscovery_PublishesFileDiscoveredMessage_ToKafka()
{
    var topic = TestConfiguration.KafkaTopics.FileDiscovered;
    _consumer = _kafka.CreateConsumer(topic);

    var testMessage = new {
        DatasourceId = uniqueId,
        FilePath = "/data/test/sample.csv",
        FileSize = 1024L
    };

    await _kafka.ProduceAsync(topic, uniqueId, JsonSerializer.Serialize(testMessage));
    var result = await ConsumeByKeyAsync(_consumer, uniqueId, TimeSpan.FromSeconds(10));
    result.Should().NotBeNull();
}
```

**Backend Unit Tests (xUnit):**
- Scope: Business logic in isolation (validation rules, data extraction)
- Approach: Direct function calls with test data, no external dependencies
- Location: `tests/ValidationService.Tests/Services/`
- Files:
  - `JsonSchemaValidationTests.cs` - Schema validation, record extraction
  - `FieldValidationRulesTests.cs` - Field-level validation patterns

Example: `FieldValidationRulesTests.cs` - Tests transaction ID validation
```csharp
[Theory]
[InlineData("TXN-20251201-000001", true)]
[InlineData("INVALID-ID", false)]
public void TransactionIdField_WithPattern_ValidatesCorrectly(string transactionId, bool expectedValid)
{
    var schema = JSchema.Parse("""
    {
        "type": "object",
        "properties": {
            "TransactionId": { "type": "string", "pattern": "^TXN-[0-9]{8}-[0-9]{6}$" }
        }
    }
    """);

    var record = JObject.Parse($$"""{ "TransactionId": "{{transactionId}}" }""");
    var isValid = record.IsValid(schema);
    isValid.Should().Be(expectedValid);
}
```

## Common Patterns

**Async Testing (Frontend Playwright):**
```typescript
test('should load data asynchronously', async ({ page }) => {
  await page.goto('/');

  // Wait for network to settle
  await page.waitForLoadState('networkidle');

  // Wait for specific element
  await expect(page.locator('.ant-table')).toBeVisible();

  // Wait with timeout
  const element = page.locator('button', { hasText: 'Save' });
  await element.click({ timeout: 10000 });
});
```

**Async Testing (Backend xUnit):**
```csharp
[Fact]
public async Task ProcessAsync_WithValidInput_ReturnsSuccess()
{
    // Arrange
    var input = new ProcessRequest { /* ... */ };

    // Act
    var result = await _service.ProcessAsync(input);

    // Assert
    result.Should().NotBeNull();
    result.IsSuccess.Should().BeTrue();
}
```

**Error Testing (Frontend Playwright):**
```typescript
test('should display error message on API failure', async ({ page }) => {
  // Navigate to trigger error condition
  await page.goto('/datasource/invalid-id');

  // Verify error display
  await expect(page.getByText(/error|خطأ/i)).toBeVisible();

  // Verify recovery button
  await page.getByRole('button', { name: /retry|أعد/ }).click();
});
```

**Error Testing (Backend xUnit):**
```csharp
[Fact]
public async Task GetById_WithInvalidId_ReturnsNotFoundError()
{
    // Act
    var result = await _service.GetByIdAsync("invalid-id", correlationId);

    // Assert
    result.IsSuccess.Should().BeFalse();
    result.Error?.StatusCode.Should().Be(404);
    result.Error?.Message.Should().Contain("not found");
}
```

**Page Object Model (Frontend Playwright - Optional pattern):**
```typescript
// Not explicitly used in current tests, but available approach:
export class DataSourcePage {
  constructor(private page: Page) {}

  async navigateTo() {
    await this.page.goto('/datasources');
  }

  async fillBasicInfo(name: string, description: string) {
    await this.page.locator('input').first().fill(name);
    await this.page.locator('textarea').first().fill(description);
  }
}

// Usage in test:
const dataSourcePage = new DataSourcePage(page);
await dataSourcePage.navigateTo();
await dataSourcePage.fillBasicInfo('Test', 'Description');
```

## Test Configuration

**Frontend (Playwright config - `src/Frontend/playwright.config.ts`):**
- Test directory: `./tests/e2e`
- Base URL: `http://localhost:3000` (configurable via `BASE_URL` env var)
- Timeout: 60000ms per test
- Action timeout: 10000ms
- Navigation timeout: 30000ms
- Retries on CI: 2, local: 0
- Workers: Parallel on local, serial on CI
- Screenshots: On failure only
- Videos: On first retry
- Traces: On first retry
- Reporters: HTML, JSON, list format

**Backend (TestConfiguration.cs - `tests/IntegrationTests/TestConfiguration.cs`):**
- MongoDB connection: `mongodb://localhost:27017/?directConnection=true` with replica set bypass
- Kafka servers: `localhost:9094` (external listener for port-forwarding)
- Hazelcast address: `localhost:5701`
- Service URLs: Port-forwarded endpoints (5001-5009)
- Kafka topics: Defined as constants
- Test data paths: Configurable via `TEST_DATA_PATH` env var
- Timeouts: 30s default, 60s for Kafka, 2min for pipeline processing

**Environment Variables (Integration Tests):**
```
KAFKA_BOOTSTRAP_SERVERS=localhost:9094
MONGODB_CONNECTION_STRING=mongodb://localhost:27017/?directConnection=true
MONGODB_DATABASE=ez_platform
HAZELCAST_ADDRESS=localhost:5701
DATASOURCE_MGMT_URL=http://localhost:5001
VALIDATION_URL=http://localhost:5003
OUTPUT_URL=http://localhost:5009
INVALIDRECORDS_URL=http://localhost:5007
TEST_DATA_PATH=C:\Users\UserC\source\repos\EZ\test-data
```

## Running Tests Locally

**Prerequisites:**
- Frontend: Port 3000 or 3002 available (dev server)
- Backend: Port-forwarded K8s services (see `start-port-forwards.ps1`)
- Backend: MongoDB, Kafka, Hazelcast running in K8s

**Frontend E2E (Playwright):**
```bash
cd src/Frontend

# Install dependencies
npm install

# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run headed (visible browser)
npm run test:e2e:headed

# View results
npm run test:e2e:report
```

**Backend Integration Tests:**
```bash
# Start port-forwarding (PowerShell)
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"

# Run integration tests
cd tests/IntegrationTests
dotnet test

# Run specific category
dotnet test --filter "Category=INT-001"

# Verbose output
dotnet test --verbosity detailed
```

**Backend Unit Tests:**
```bash
cd tests/ValidationService.Tests
dotnet test

cd tests/OutputService.Tests
dotnet test

cd tests/Shared.Tests
dotnet test
```

---

*Testing analysis: 2026-01-28*

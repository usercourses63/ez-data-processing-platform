/**
 * @Sanity test suite
 * Fast (< 5 min), API-level sanity checks for a freshly deployed + seeded cluster.
 * Run with: npm run test:e2e:sanity
 * CI: runs after DemoDataGenerator seeding in sanity-deploy job.
 *
 * No NAS, no SFTP, no cross-cluster dependencies.
 */
import { test, expect, APIRequestContext, request } from '@playwright/test';

const DATASOURCE_API = 'http://localhost:5001';
const METRICS_API    = 'http://localhost:5002';
const VALIDATION_API = 'http://localhost:5003';
const SCHEDULING_API = 'http://localhost:5004';
const INVALID_API    = 'http://localhost:5007';
const FILEPROCESSOR_API = 'http://localhost:5008';
const OUTPUT_API     = 'http://localhost:5009';
const FRONTEND_URL   = 'http://localhost:7000';

// Services with accessible health endpoints (port-forwarded)
const HEALTH_ENDPOINTS = [
  { name: 'datasource-management', url: `${DATASOURCE_API}/health` },
  { name: 'metrics-configuration',  url: `${METRICS_API}/health` },
  { name: 'validation',              url: `${VALIDATION_API}/health` },
  { name: 'scheduling',              url: `${SCHEDULING_API}/health` },
  { name: 'invalidrecords',          url: `${INVALID_API}/health` },
  { name: 'fileprocessor',           url: `${FILEPROCESSOR_API}/health` },
  { name: 'output',                  url: `${OUTPUT_API}/health` },
];

let apiContext: APIRequestContext;

test.beforeAll(async () => {
  apiContext = await request.newContext({ ignoreHTTPSErrors: true });
});

test.afterAll(async () => {
  await apiContext.dispose();
});

// SANITY-01: All health endpoints respond 200 or 204
test('@Sanity SANITY-01: All service health endpoints respond', async () => {
  for (const svc of HEALTH_ENDPOINTS) {
    const response = await apiContext.get(svc.url);
    expect(
      response.status(),
      `${svc.name} health check failed (${svc.url})`
    ).toBeGreaterThanOrEqual(200);
    expect(
      response.status(),
      `${svc.name} health check unexpected status (${svc.url})`
    ).toBeLessThan(300);
  }
});

// SANITY-02: Seeded datasources visible in API
test('@Sanity SANITY-02: Seeded datasources are visible in DataSource API', async () => {
  const response = await apiContext.get(`${DATASOURCE_API}/api/v1/datasource`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  // DemoDataGenerator always creates > 0 datasources
  const items = Array.isArray(body) ? body : body?.data ?? body?.items ?? [];
  expect(items.length, 'Expected seeded datasources to exist').toBeGreaterThan(0);
});

// SANITY-03: Create and delete a datasource round-trip
test('@Sanity SANITY-03: Create and delete datasource round-trip', async () => {
  const createPayload = {
    Name: 'sanity-test-datasource',
    FilePath: '/tmp/sanity',
    FileType: 'CSV',
    Category: 'Sales',
    IsActive: false,
  };

  const createResponse = await apiContext.post(`${DATASOURCE_API}/api/v1/datasource`, {
    data: createPayload,
  });
  expect(createResponse.status(), 'Create datasource failed').toBe(201);

  const created = await createResponse.json();
  const id = created?.id ?? created?.Id ?? created?.data?.id ?? created?.data?.Id;
  expect(id, 'Created datasource must have an id').toBeTruthy();

  const deleteResponse = await apiContext.delete(`${DATASOURCE_API}/api/v1/datasource/${id}`);
  expect(deleteResponse.status(), `Delete datasource ${id} failed`).toBeOneOf([200, 204]);
});

// SANITY-04: Categories seeded
test('@Sanity SANITY-04: Seeded categories are visible in API', async () => {
  const response = await apiContext.get(`${DATASOURCE_API}/api/v1/categories`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  const items = Array.isArray(body) ? body : body?.data ?? body?.items ?? [];
  expect(items.length, 'Expected seeded categories to exist').toBeGreaterThan(0);
});

// SANITY-05: Metrics endpoint responsive
test('@Sanity SANITY-05: Metrics configuration endpoint is responsive', async () => {
  const response = await apiContext.get(`${METRICS_API}/api/v1/metrics`);
  expect(response.status(), 'Metrics endpoint should return 200').toBe(200);
});

// SANITY-06: Scheduling endpoint responsive
test('@Sanity SANITY-06: Scheduling endpoint is responsive', async () => {
  const response = await apiContext.get(`${SCHEDULING_API}/api/v1/schedule`);
  expect(response.status(), 'Scheduling endpoint should return 200').toBe(200);
});

// SANITY-07: Frontend loads and has correct title
test('@Sanity SANITY-07: Frontend loads and contains expected title', async ({ page }) => {
  const response = await page.goto(FRONTEND_URL);
  expect(response?.status(), 'Frontend HTTP status').toBe(200);
  const title = await page.title();
  expect(title, 'Page title should contain EZ').toContain('EZ');
});

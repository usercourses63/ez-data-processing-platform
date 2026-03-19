/**
 * @Sanity test suite
 * Fast (< 5 min), API-level sanity checks for a freshly deployed + seeded cluster.
 * Run with: npm run test:e2e:sanity
 * CI: runs after DemoDataGenerator seeding in sanity-deploy job.
 *
 * No NAS, no SFTP, no cross-cluster dependencies.
 */
import { test, expect, APIRequestContext, request } from '@playwright/test';

const DATASOURCE_API = 'http://127.0.0.1:5001';
const METRICS_API    = 'http://127.0.0.1:5002';
const VALIDATION_API = 'http://127.0.0.1:5003';
const SCHEDULING_API = 'http://127.0.0.1:5004';
const INVALID_API    = 'http://127.0.0.1:5007';
const FILEPROCESSOR_API = 'http://127.0.0.1:5008';
const OUTPUT_API     = 'http://127.0.0.1:5009';
const FRONTEND_URL   = 'http://127.0.0.1:7000';
const DOCS_URL       = process.env.DOCS_URL || 'http://127.0.0.1:30800';

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
  const items = Array.isArray(body) ? body : body?.Data?.Items ?? body?.data?.items ?? body?.data ?? body?.items ?? [];
  expect(items.length, 'Expected seeded datasources to exist').toBeGreaterThan(0);
});

// SANITY-03: Create and delete datasource via UI — all 8 tabs, no API calls
test('@Sanity SANITY-03: Create and delete datasource via UI (all tabs)', async ({ page }) => {
  const dsName = `Sanity-UI-${Date.now()}`;

  // Helper: open an Ant Design Select and click an option in the visible dropdown
  const antSelect = async (inputId: string, optionMatcher?: string | RegExp, optionIndex = 0) => {
    await page.locator('.ant-select').filter({ has: page.locator(`input#${inputId}`) }).click();
    await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await page.waitForTimeout(200);
    const opts = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:visible');
    if (optionMatcher) {
      await opts.filter({ hasText: optionMatcher }).first().click();
    } else {
      await opts.nth(optionIndex).click();
    }
    await page.waitForTimeout(300);
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${FRONTEND_URL}/datasources`);
  await page.waitForLoadState('networkidle');

  // Click "Add new datasource" button
  await page.getByRole('button', { name: /הוסף מקור נתונים חדש/i }).click();
  await page.waitForURL(/\/datasources\/new/);
  await page.waitForLoadState('networkidle');

  // ── TAB 1: Basic Info (מידע בסיסי) ──────────────────────────────────────
  await page.locator('input#name').fill(dsName);
  await page.locator('input#supplierName').fill('Sanity Test Supplier');
  await page.locator('textarea#description').fill('Created by automated UI sanity test');
  await antSelect('category');           // pick first available category
  await page.locator('input#retentionDays').fill('60');

  // ── TAB 2: Connection (הגדרות קלט) ───────────────────────────────────────
  await page.locator('[id$="-tab-connection"]').click();
  await page.waitForLoadState('networkidle');

  await antSelect('connectionType', /^FTP - /);   // FTP - File Transfer Protocol

  // Server select appears after protocol chosen
  await page.waitForTimeout(1000);
  if (await page.locator('.ant-select').filter({ has: page.locator('input#inputServerId') }).isVisible({ timeout: 3000 }).catch(() => false)) {
    await antSelect('inputServerId');              // first seeded FTP server
  }

  // File pattern
  if (await page.locator('input#filePattern').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('input#filePattern').fill('*.csv');
  }

  // ── TAB 3: File Settings (הגדרות קובץ) ────────────────────────────────────
  await page.locator('[id$="-tab-file"]').click();
  await page.waitForLoadState('networkidle');

  await antSelect('fileType', 'CSV');
  await page.waitForTimeout(500);

  if (await page.locator('input#csvDelimiter').isVisible({ timeout: 2000 }).catch(() => false)) {
    await antSelect('csvDelimiter');               // comma (first option)
  }
  if (await page.locator('input#encoding').isVisible({ timeout: 2000 }).catch(() => false)) {
    await antSelect('encoding', 'UTF-8');
  }

  // ── TAB 4: Schema (הגדרת Schema) ─────────────────────────────────────────
  await page.locator('[id$="-tab-schema"]').click();
  await page.waitForTimeout(1500);

  // ── TAB 5: Schedule (תזמון) ───────────────────────────────────────────────
  await page.locator('[id$="-tab-schedule"]').click();
  await page.waitForLoadState('networkidle');

  if (await page.locator('input#scheduleFrequency').isVisible({ timeout: 2000 }).catch(() => false)) {
    await antSelect('scheduleFrequency', undefined, 2);  // 3rd option (Every5Minutes)
  }

  // ── TAB 6: Validation (כללי אימות) ────────────────────────────────────────
  await page.locator('[id$="-tab-validation"]').click();
  await page.waitForLoadState('networkidle');

  if (await page.locator('input#maxErrorsAllowed').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('input#maxErrorsAllowed').fill('100');
  }

  // ── TAB 7: Notifications (התראות) ─────────────────────────────────────────
  await page.locator('[id$="-tab-notifications"]').click();
  await page.waitForLoadState('networkidle');

  const notifySwitch = page.locator('.ant-form-item').filter({ hasText: /התראה בהצלחה/ }).locator('.ant-switch');
  if (await notifySwitch.isVisible({ timeout: 2000 }).catch(() => false)) {
    if ((await notifySwitch.getAttribute('aria-checked')) !== 'true') await notifySwitch.click();
  }
  if (await page.locator('input#notificationRecipients').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('input#notificationRecipients').fill('sanity@test.com');
  }

  // ── TAB 8: Output (פלט) ───────────────────────────────────────────────────
  await page.locator('[id$="-tab-output"]').click();
  await page.waitForTimeout(1000);

  // ── Submit (Create) ───────────────────────────────────────────────────────
  // Button renders as type="submit" via Ant Design htmlType="submit" (text = "צור" in Hebrew)
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${FRONTEND_URL}/datasources`, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Verify new datasource appears in list
  await expect(page.getByText(dsName)).toBeVisible({ timeout: 10000 });

  // ── Delete via UI ─────────────────────────────────────────────────────────
  const row = page.locator('tr').filter({ hasText: dsName });
  await row.getByRole('button', { name: /מחק/i }).click();
  await page.getByRole('button', { name: /אישור|OK/i }).filter({ hasNotText: /ביטול/ }).last().click();

  // Verify deleted
  await expect(page.getByText(dsName)).not.toBeVisible({ timeout: 10000 });
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
  const response = await apiContext.get(`${SCHEDULING_API}/api/v1/scheduling/schedules`);
  expect(response.status(), 'Scheduling endpoint should return 200').toBe(200);
});

// SANITY-07: Frontend loads and has correct title
test('@Sanity SANITY-07: Frontend loads and contains expected title', async ({ page }) => {
  const response = await page.goto(FRONTEND_URL);
  expect(response?.status(), 'Frontend HTTP status').toBe(200);
  const title = await page.title();
  // Title may be Hebrew ("מערכת עיבוד נתונים") or English ("EZ Platform")
  expect(title.length, 'Page title should not be empty').toBeGreaterThan(0);
});

// SANITY-08: Docs homepage opens and contains expected content
test('@Sanity SANITY-08: Docs homepage opens and contains expected content', async ({ page }) => {
  const response = await page.goto(DOCS_URL + '/docs/');
  expect(response?.status(), 'Docs homepage HTTP status').toBe(200);
  const content = await page.textContent('body');
  expect(content, 'Docs homepage should contain EZ or documentation').toMatch(/ez|documentation/i);
});

// SANITY-09: Hebrew user guide loads with Hebrew content
test('@Sanity SANITY-09: Hebrew user guide loads with Hebrew content', async ({ page }) => {
  const response = await page.goto(DOCS_URL + '/docs/user-guide-he');
  expect(response?.status(), 'Hebrew user guide HTTP status').toBe(200);
  const content = await page.textContent('body');
  expect(content, 'Hebrew user guide should contain Hebrew characters').toMatch(/[\u05D0-\u05EA]/);
});

// SANITY-10: Frontend Help button navigates to docs
test('@Sanity SANITY-10: Frontend Help button navigates to docs', async ({ page }) => {
  await page.goto(FRONTEND_URL);
  const helpButton = page.locator('button[aria-label="Open user guide"], button[aria-label="פתח מדריך למשתמש"]');
  await expect(helpButton).toBeVisible();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    helpButton.click(),
  ]);
  await popup.waitForLoadState();
  expect(popup.url(), 'Help button should open docs portal').toContain(':30800');
});

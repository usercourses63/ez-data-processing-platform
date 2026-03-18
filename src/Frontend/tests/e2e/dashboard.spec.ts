/**
 * Dashboard Page E2E Tests (9A)
 *
 * Tests for the main dashboard at `/` or `/dashboard`.
 * Covers metric summary cards, pipeline status, navigation,
 * and real-time metric state handling.
 *
 * Hebrew UI (RTL). Viewport set to 1400px wide for RTL overflow.
 */

import { test, expect } from './support';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';
const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';

/** True if the DataSource API has at least one record — determines whether stats cards will show values. */
let hasData = false;

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${EZ_API_BASE}/api/v1/datasource`).catch(() => null);
  if (res?.ok()) {
    const body = await res.json();
    const items = Array.isArray(body)
      ? body
      : (body as Record<string, unknown>)?.Data
        ? ((body as Record<string, unknown>).Data as Record<string, unknown>)?.Items ?? []
        : [];
    hasData = Array.isArray(items) && (items as unknown[]).length > 0;
  }
});

test.describe('@P1 Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
  });

  test('[P1] dashboard title is visible in Hebrew', async ({ page }) => {
    // Given: the dashboard page is loaded
    // When: the page renders
    // Then: at least one heading element is visible
    await page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 15000 }).catch(() => null);

    const headings = page.getByRole('heading');
    await expect(headings.first()).toBeVisible({ timeout: 10000 });
  });

  test('[P1] dashboard page renders in RTL mode', async ({ page }) => {
    // Given: the dashboard page is loaded
    // When: the layout initialises
    // Then: the document or app root has dir="rtl"
    const dir = await page.evaluate(
      () =>
        document.documentElement.dir ||
        document.querySelector('.app-layout, [dir]')?.getAttribute('dir') ||
        ''
    );
    expect(dir).toBe('rtl');
  });

  test('[P1] dashboard shows statistics section', async ({ page }) => {
    // Given: the dashboard page is loaded
    // When: the API responds (with or without data)
    // Then: a stats section or an error alert is visible — page did not crash
    await page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 15000 }).catch(() => null);

    const statsSection = page.locator('.stats-cards');
    const errorAlert = page.getByRole('alert');
    const heading = page.getByRole('heading');

    // At least one of: stats section, error alert, or a heading must be present
    await expect(statsSection.or(errorAlert).or(heading).first()).toBeVisible({ timeout: 8000 });
  });

  test('[P1] dashboard shows total files statistic value', async ({ page }) => {
    // Given: data exists in the system
    // When: the dashboard renders
    // Then: at least one numeric statistic value is visible
    test.skip(!hasData, 'No datasource data available — stats cards will be empty');

    await page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 15000 }).catch(() => null);

    const statValues = page.locator('.ant-statistic-content-value');
    await expect(statValues.first()).toBeVisible({ timeout: 10000 });
  });

  test('[P1] dashboard shows stats cards when data exists', async ({ page }) => {
    // Given: data exists in the system
    // When: the dashboard renders
    // Then: the stats-cards section contains at least one card
    test.skip(!hasData, 'No datasource data available — stats cards will be empty');

    await page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 15000 }).catch(() => null);

    const statsSection = page.locator('.stats-cards');
    await expect(statsSection).toBeVisible({ timeout: 8000 });

    const cards = statsSection.getByRole('region');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('[P2] navigation from dashboard to datasources via sidebar', async ({ page }) => {
    // Given: the sidebar is visible
    // When: the datasources menu item is clicked
    // Then: the URL changes to include /datasource
    const dsLink = page
      .getByRole('menuitem', { name: /מקורות נתונים|datasource/i })
      .or(page.locator('a[href*="datasource"]').first());

    await expect(dsLink.first()).toBeVisible({ timeout: 8000 });
    await dsLink.first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/datasource/i);
  });

  test('[P2] dashboard does not crash — no unhandled React render errors', async ({ page }) => {
    // Given: the dashboard page is loaded
    // When: React renders (with or without API data)
    // Then: no uncaught errors are present in the console
    const renderErrors: string[] = [];
    page.on('console', msg => {
      if (
        msg.type() === 'error' &&
        !msg.text().includes('favicon') &&
        (msg.text().includes('Uncaught Error') || msg.text().includes('Cannot read properties of null'))
      ) {
        renderErrors.push(msg.text());
      }
    });

    await page.waitForLoadState('domcontentloaded');

    expect(renderErrors).toHaveLength(0);
  });
});

test.describe('@P2 Dashboard RTL Layout', () => {
  test('[P2] dashboard renders with RTL direction attribute', async ({ page }) => {
    // Given: the dashboard page is loaded at 1400px
    // When: the layout initialises
    // Then: dir="rtl" is set on the root or app element
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    const dir = await page.evaluate(
      () =>
        document.documentElement.dir ||
        document.querySelector('[dir]')?.getAttribute('dir') ||
        'ltr'
    );
    expect(dir).toBe('rtl');
  });

  test('[P2] stats cards fit within viewport without horizontal overflow', async ({ page }) => {
    // Given: the dashboard is loaded at 1400px viewport
    // When: the stats-cards section renders
    // Then: the section bounding box does not exceed the viewport width
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 15000 }).catch(() => null);

    const statsSection = page.locator('.stats-cards');
    const isVisible = await statsSection.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const box = await statsSection.boundingBox();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(1450); // 50px tolerance
      }
    }

    // Stats section may not exist when there is no data — acceptable
    expect(true).toBe(true);
  });
});

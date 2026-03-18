/**
 * Scheduling UI E2E Tests (9B)
 *
 * Tests for the Scheduling tab within the DataSource edit form.
 * Page: `/datasources/{id}/edit` → Schedule tab.
 *
 * The ScheduleTab renders:
 *   - "תדירות בדיקה" (polling frequency) Select
 *   - "תזמון פעיל" (schedule enabled) Switch
 *   - Custom cron expression Input (when frequency = 'custom')
 *   - Cron helper button
 *
 * Hebrew UI (RTL). Ant Design tab click workaround used.
 */

import { test, expect } from './support';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';
const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';

function extractItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  const data = (b?.Data ?? b?.data) as Record<string, unknown> | undefined;
  if (data) {
    const items = data?.Items ?? data?.items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

test.describe('@P1 Scheduling UI — DataSource Edit', () => {
  // Skip the entire suite if no datasources exist — schedule tab requires an existing datasource.
  test.beforeAll(async ({ request }) => {
    const res = await request.get(`${EZ_API_BASE}/api/v1/datasource`);
    const items = res.ok() ? extractItems(await res.json()) : [];
    if (items.length === 0) {
      test.skip();
    }
  });

  // Navigate to the first datasource edit form and open the Schedule tab before each test.
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/datasources`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /ערוך|edit/i }).first().click();
    await page.waitForLoadState('networkidle');

    const scheduleTabEl = page.locator('[data-node-key="schedule"]');
    await expect(scheduleTabEl).toBeVisible({ timeout: 8000 });
    await scheduleTabEl.evaluate(el =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    );
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  });

  test('[P1] scheduling tab content renders with frequency label', async ({ page }) => {
    // Given: the schedule tab is open
    // When: the tab panel mounts
    // Then: the scheduling configuration label is visible
    const scheduleContent = page.getByText(/הגדרות תזמון אוטומטי|תדירות בדיקה/i);
    await expect(scheduleContent).toBeVisible({ timeout: 8000 });
  });

  test('[P1] schedule frequency dropdown renders with options', async ({ page }) => {
    // Given: the schedule tab is open
    // When: the frequency combobox is clicked
    // Then: at least one option is visible in the dropdown
    await expect(page.getByText('תדירות בדיקה')).toBeVisible({ timeout: 8000 });

    const freqSelect = page.getByRole('combobox').first();
    await expect(freqSelect).toBeVisible({ timeout: 5000 });

    await freqSelect.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });

  test('[P1] schedule enable/disable switch is present and toggleable', async ({ page }) => {
    // Given: the schedule tab is open
    // When: the schedule switch is toggled
    // Then: its checked state changes
    await expect(page.getByText('תזמון פעיל')).toBeVisible({ timeout: 8000 });

    const scheduleSwitch = page.getByRole('switch').first();
    await expect(scheduleSwitch).toBeVisible({ timeout: 5000 });

    const initialChecked = await scheduleSwitch.evaluate(el =>
      el.classList.contains('ant-switch-checked')
    );

    await scheduleSwitch.click();
    await page.waitForLoadState('domcontentloaded');

    const afterChecked = await scheduleSwitch.evaluate(el =>
      el.classList.contains('ant-switch-checked')
    );
    expect(afterChecked).not.toBe(initialChecked);

    // Restore original state
    await scheduleSwitch.click();
    await page.waitForLoadState('domcontentloaded');
  });

  test('[P1] schedule tab shows cron expression input when custom frequency selected', async ({ page }) => {
    // Given: the schedule tab is open
    // When: "custom" frequency option is selected
    // Then: a text input for the cron expression becomes visible
    await expect(page.getByText('תדירות בדיקה')).toBeVisible({ timeout: 8000 });

    const freqSelect = page.getByRole('combobox').first();
    await expect(freqSelect).toBeVisible({ timeout: 5000 });

    await freqSelect.click();
    await page.waitForLoadState('domcontentloaded');

    const customOption = page.getByRole('option').filter({ hasText: /מותאם|custom/i });
    const hasCustom = await customOption.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasCustom) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Custom frequency option not available in this environment');
      return;
    }

    await customOption.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('[P2] schedule switch shows correct enabled/disabled label text', async ({ page }) => {
    // Given: the schedule tab is open
    // When: the switch is toggled on and off
    // Then: the inner text reads "מופעל" when on and "מושבת" when off
    await expect(page.getByText('תזמון פעיל')).toBeVisible({ timeout: 8000 });

    const scheduleSwitch = page.getByRole('switch').first();
    await expect(scheduleSwitch).toBeVisible({ timeout: 5000 });

    // Ensure enabled state
    const isChecked = await scheduleSwitch.evaluate(el =>
      el.classList.contains('ant-switch-checked')
    );
    if (!isChecked) {
      await scheduleSwitch.click();
      await page.waitForLoadState('domcontentloaded');
    }

    await expect(scheduleSwitch).toContainText('מופעל');

    await scheduleSwitch.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(scheduleSwitch).toContainText('מושבת');

    // Restore
    await scheduleSwitch.click();
    await page.waitForLoadState('domcontentloaded');
  });
});

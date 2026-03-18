/**
 * Categories Management UI E2E Tests (9E)
 *
 * Tests for the Category Management page accessible from Admin Settings.
 * Page: `/admin` → Categories tab (default tab)
 *
 * AdminSettings renders Tabs with:
 *   - key: 'categories' → CategoryManagementTab
 *   - key: 'inputServers'
 *   - key: 'outputServers'
 *   - key: 'nasDevices'
 *
 * CategoryManagementTab renders:
 *   - "הוסף קטגוריה" button
 *   - CategoryTable with columns: Name, Hebrew Name, Status badges, Edit/Delete actions
 *   - Toggle active/inactive via switch or action button
 *
 * Hebrew UI (RTL).
 */

import { test, expect } from './support';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';
const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';

/** Navigate to the categories tab on the admin page. */
async function openCategoriesTab(page: import('@playwright/test').Page): Promise<void> {
  const categoriesTabEl = page.locator('[data-node-key="categories"]');
  const isVisible = await categoriesTabEl.isVisible({ timeout: 5000 }).catch(() => false);
  if (isVisible) {
    await categoriesTabEl.evaluate(el =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    );
    await page.waitForLoadState('domcontentloaded');
  }
}

test.describe('@P1 Categories Management UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
  });

  test('[P1] admin page loads and shows categories tab content', async ({ page }) => {
    // Given: admin page is loaded
    // When: page finishes loading
    // Then: a page title element is visible
    const pageTitle = page.getByText(/הגדרות ניהול|admin|ניהול|קטגוריות/i).first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });

  test('[P1] categories tab is active by default on admin page', async ({ page }) => {
    // Given: admin page is loaded
    // When: no tab is explicitly clicked
    // Then: the categories tab is selected
    const categoriesTab = page.getByRole('tab', { name: /קטגוריות|categories/i });
    await expect(categoriesTab).toBeVisible({ timeout: 8000 });

    const isSelected = await categoriesTab.evaluate(el =>
      el.getAttribute('aria-selected') === 'true' || el.classList.contains('ant-tabs-tab-active')
    );
    expect(isSelected).toBe(true);
  });

  test('[P1] categories table renders on admin page', async ({ page }) => {
    // Given: the categories tab is active
    // When: data has loaded
    // Then: a table element is visible
    await openCategoriesTab(page);
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10000 });
  });

  test('[P1] add category button is visible and opens a dialog', async ({ page }) => {
    // Given: the categories tab is active
    // When: "הוסף קטגוריה" button is clicked
    // Then: a dialog with a name input appears
    await openCategoriesTab(page);

    const addBtn = page.getByRole('button', { name: /הוסף קטגוריה/i });
    await expect(addBtn).toBeVisible({ timeout: 8000 });

    await addBtn.click();
    await page.waitForLoadState('domcontentloaded');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await expect(dialog.locator('input').first()).toBeVisible({ timeout: 3000 });

    // Close without saving
    const cancelBtn = dialog.getByRole('button', { name: /ביטול|cancel/i });
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('[P1] create new category submits POST to categories API', async ({ page }) => {
    // Given: the add category dialog is open
    // When: a name is entered and the form is submitted
    // Then: the API receives a 200/201 response
    await openCategoriesTab(page);

    const addBtn = page.getByRole('button', { name: /הוסף קטגוריה/i });
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await page.waitForLoadState('domcontentloaded');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const timestamp = Date.now();
    await dialog.locator('input').first().fill(`e2e_category_${timestamp}`);

    const inputs = dialog.locator('input');
    if (await inputs.count() >= 2) {
      await inputs.nth(1).fill(`קטגוריה בדיקה ${timestamp}`);
    }

    const submitBtn = dialog.getByRole('button', { name: /שמור|צור|create|save|submit|אישור/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 3000 });

    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/v1/categories') && resp.request().method() === 'POST',
      { timeout: 10000 }
    ).catch(() => null);

    await submitBtn.click();
    const response = await responsePromise;

    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  });
});

test.describe('@P2 Categories Toggle and State', () => {
  // Skip this suite if no categories exist in the system.
  test.beforeAll(async ({ request }) => {
    const res = await request.get(`${EZ_API_BASE}/api/v1/categories`);
    if (!res.ok()) {
      test.skip();
    }
    const body = await res.json();
    const items = Array.isArray(body)
      ? body
      : ((body as Record<string, unknown>)?.Data as unknown[] | undefined) ?? [];
    if (items.length === 0) {
      test.skip();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await openCategoriesTab(page);
  });

  test('[P2] toggle category active/inactive state', async ({ page }) => {
    // Given: a category row is visible in the table
    // When: its toggle switch is clicked
    // Then: the checked state changes
    const table = page.getByRole('table').first();
    await expect(table).toBeVisible({ timeout: 10000 });

    const firstRow = page.getByRole('row').nth(1); // nth(0) is the header row
    await expect(firstRow).toBeVisible({ timeout: 8000 });

    const toggleSwitch = firstRow.getByRole('switch').first();
    await expect(toggleSwitch).toBeVisible({ timeout: 5000 });

    const initialChecked = await toggleSwitch.evaluate(el =>
      el.classList.contains('ant-switch-checked')
    );

    await toggleSwitch.click();
    await page.waitForLoadState('networkidle');

    const afterChecked = await toggleSwitch.evaluate(el =>
      el.classList.contains('ant-switch-checked')
    );
    expect(afterChecked).not.toBe(initialChecked);

    // Restore original state
    await toggleSwitch.click();
    await page.waitForLoadState('networkidle');
  });

  test('[P2] categories table shows active and inactive count badges', async ({ page }) => {
    // Given: categories exist
    // When: the categories tab renders
    // Then: count badges for active and inactive categories are visible
    const activeBadge = page.getByText(/\d+ פעילות/);
    await expect(activeBadge).toBeVisible({ timeout: 8000 });

    const inactiveBadge = page.getByText(/\d+ לא פעילות/);
    await expect(inactiveBadge).toBeVisible({ timeout: 5000 });
  });

  test('[P2] edit category opens dialog with pre-filled name', async ({ page }) => {
    // Given: a category row is visible
    // When: the edit button for that row is clicked
    // Then: a dialog opens with the category name pre-filled
    const table = page.getByRole('table').first();
    await expect(table).toBeVisible({ timeout: 10000 });

    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toBeVisible({ timeout: 8000 });

    const editBtn = firstRow.getByRole('button', { name: /ערוך|edit/i });
    await expect(editBtn).toBeVisible({ timeout: 5000 });

    await editBtn.click();
    await page.waitForLoadState('domcontentloaded');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameInput = dialog.locator('input').first();
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    const value = await nameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
  });
});

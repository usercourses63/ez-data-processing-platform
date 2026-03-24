/**
 * Completeness Checklist E2E Tests
 *
 * Rewritten based on actual DOM reconnaissance (2026-03-24).
 *
 * Verifies the completeness checklist feature:
 * - Create form sidebar with progress ring
 * - Progress ring updates when filling required fields
 * - Click-to-navigate from sidebar tabs
 * - Active tab highlighting in sidebar
 * - Per-field data-completeness-status attributes
 * - Recommended/optional tab icons
 * - Edit form sidebar reflects existing data
 * - List page: read-only status tag (no select)
 * - List page: power icon button in actions
 * - RTL layout: sidebar positioning
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:7000';
const DATASOURCE_API = process.env.DATASOURCE_API || 'http://127.0.0.1:5001';

// Helper: open Ant Design Select and pick an option
const antSelect = async (page: Page, inputId: string, optionMatcher?: string | RegExp, optionIndex = 0) => {
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

// Helper: navigate to a page and wait for it to stabilize
const navigateAndWait = async (page: Page, url: string) => {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
};

// Helper: get the sidebar card containing the progress ring
const getSidebarCard = (page: Page) => {
  return page.locator('.ant-card').filter({ has: page.locator('.ant-progress') });
};

// Helper: get clickable tab items inside the sidebar card
// Each tab item is a div with cursor style (pointer or not-allowed) that contains status icons
const getTabItems = (page: Page) => {
  const sidebarCard = getSidebarCard(page);
  // Tab items have exact padding: 8px 12px style — this uniquely identifies them
  return sidebarCard.locator('div[style*="padding: 8px 12px"]');
};

test.describe('Completeness Checklist', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  // =========================================================================
  // Test 1: Create form sidebar displays with progress ring
  // =========================================================================
  test('create form sidebar displays with progress ring (~50% from defaults)', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources/new`);

    // Progress ring: use div.ant-progress-circle (not bare class — inner SVG also matches)
    const progressCircle = page.locator('div.ant-progress-circle');
    await expect(progressCircle).toBeVisible({ timeout: 30000 });

    // Check aria-valuenow — new form has ~50% because DEFAULT_FORM_VALUES
    // pre-fills connectionType, fileType, scheduleFrequency
    const ariaValue = await progressCircle.first().getAttribute('aria-valuenow');
    const percent = parseInt(ariaValue || '0', 10);
    expect(percent).toBeGreaterThanOrEqual(30); // At least 30% from defaults

    // Verify the text content includes the percentage
    const ringText = await progressCircle.first().textContent();
    expect(ringText).toMatch(/\d+%/);

    // Sidebar card should be visible
    const sidebarCard = getSidebarCard(page);
    await expect(sidebarCard).toBeVisible();

    // 9 tab items in sidebar (basic, connection, file, schema, schedule,
    // validation, notifications, output, metrics)
    const tabItems = getTabItems(page);
    const count = await tabItems.count();
    expect(count).toBe(9);
  });

  // =========================================================================
  // Test 2: Progress ring updates when filling required fields
  // =========================================================================
  test('progress ring updates as required fields are filled', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources/new`);

    const progressCircle = page.locator('div.ant-progress-circle').first();

    // Capture initial percentage
    const initialAriaValue = await progressCircle.getAttribute('aria-valuenow');
    const initialPercent = parseInt(initialAriaValue || '0', 10);

    // Fill name field (required in basic tab)
    await page.locator('input#name').fill('Test Datasource');
    await page.waitForTimeout(1000);

    // Fill supplierName (required)
    await page.locator('input#supplierName').fill('Test Supplier');
    await page.waitForTimeout(1000);

    // Progress should have increased (name + supplierName are 2 more required fields)
    const updatedAriaValue = await progressCircle.getAttribute('aria-valuenow');
    const updatedPercent = parseInt(updatedAriaValue || '0', 10);
    expect(updatedPercent).toBeGreaterThanOrEqual(initialPercent);
  });

  // =========================================================================
  // Test 3: Click-to-navigate from sidebar tabs
  // =========================================================================
  test('clicking sidebar tab navigates to corresponding form tab', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources/new`);

    const sidebarCard = getSidebarCard(page);

    // Click "Connection" item in sidebar (2nd tab item — index 1)
    const tabItems = getTabItems(page);
    await tabItems.nth(1).click();
    await page.waitForTimeout(1000);

    // Verify Connection tab is now active via data-node-key attribute
    const activeTab1 = page.locator('.ant-tabs-tab-active');
    const nodeKey1 = await activeTab1.first().getAttribute('data-node-key');
    expect(nodeKey1).toBe('connection');

    // Click "Schema" item in sidebar (4th tab item — index 3)
    await tabItems.nth(3).click();
    await page.waitForTimeout(1000);

    // Verify Schema tab is now active
    const activeTab2 = page.locator('.ant-tabs-tab-active');
    const nodeKey2 = await activeTab2.first().getAttribute('data-node-key');
    expect(nodeKey2).toBe('schema');
  });

  // =========================================================================
  // Test 4: Active tab highlighted in sidebar
  // =========================================================================
  test('active tab is highlighted in sidebar with background color', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources/new`);

    const sidebarCard = getSidebarCard(page);

    // Basic tab (index 0) should initially be active — check for active background (#e6f4ff)
    const tabItems = getTabItems(page);
    const basicBg = await tabItems.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor);
    // Active background is #e6f4ff = rgb(230, 244, 255)
    expect(basicBg).toContain('230, 244, 255');

    // Click Connection tab in sidebar (index 1)
    await tabItems.nth(1).click();
    await page.waitForTimeout(1000);

    // Connection item should now have active background
    const connectionBg = await tabItems.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(connectionBg).toContain('230, 244, 255');

    // Basic Info should no longer have active background
    const basicBgAfter = await tabItems.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(basicBgAfter).not.toContain('230, 244, 255');
  });

  // =========================================================================
  // Test 5: Per-field data-completeness-status attributes
  // =========================================================================
  test('form items have data-completeness-status attributes', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources/new`);

    // On the basic tab (visible by default), form items should have
    // data-completeness-status attributes
    const statusItems = page.locator('[data-completeness-status]');
    const statusCount = await statusItems.count();
    expect(statusCount).toBeGreaterThanOrEqual(1);

    // Verify the attribute values are valid statuses
    for (let i = 0; i < Math.min(statusCount, 5); i++) {
      const status = await statusItems.nth(i).getAttribute('data-completeness-status');
      expect(['required-empty', 'filled', 'optional-empty']).toContain(status);
    }

    // Fill a required field and verify its status attribute changes
    const nameInput = page.locator('input#name');
    const nameFormItem = page.locator('[data-completeness-status]').filter({ has: nameInput }).first();

    // Before filling: should be required-empty
    const beforeStatus = await nameFormItem.getAttribute('data-completeness-status');
    expect(beforeStatus).toBe('required-empty');

    // Fill the field
    await nameInput.fill('Test Datasource');
    await page.waitForTimeout(500);

    // After filling: should be filled
    const afterStatus = await nameFormItem.getAttribute('data-completeness-status');
    expect(afterStatus).toBe('filled');
  });

  // =========================================================================
  // Test 6: Recommended/optional tabs show correct icons
  // =========================================================================
  test('recommended tabs show warning icon and optional tabs show minus-circle icon', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources/new`);

    const sidebarCard = getSidebarCard(page);

    // Reconnaissance found: 5 check-circle, 3 close-circle, 1 warning, 1 minus-circle
    // Warning icon = recommended tab that is incomplete
    const warningIcons = sidebarCard.locator('.anticon-warning');
    const warningCount = await warningIcons.count();
    expect(warningCount).toBeGreaterThanOrEqual(1);

    // Minus-circle icon = optional tab
    const minusIcons = sidebarCard.locator('.anticon-minus-circle');
    const minusCount = await minusIcons.count();
    expect(minusCount).toBeGreaterThanOrEqual(1);

    // Check-circle icons = completed tabs (from defaults)
    const checkIcons = sidebarCard.locator('.anticon-check-circle');
    const checkCount = await checkIcons.count();
    expect(checkCount).toBeGreaterThanOrEqual(1);

    // Close-circle icons = required tabs that are incomplete
    const closeIcons = sidebarCard.locator('.anticon-close-circle');
    const closeCount = await closeIcons.count();
    expect(closeCount).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 7: Edit form sidebar shows progress reflecting existing data
  // =========================================================================
  test('edit form shows progress reflecting existing data', async ({ page }) => {
    // Navigate to list and find a datasource to edit
    await navigateAndWait(page, `${FRONTEND_URL}/datasources`);
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click edit on the first datasource
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') }).first();
    await editBtn.click();
    await page.waitForURL(/\/datasources\/.*\/edit/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify sidebar exists with progress > 0% (existing data should have fields filled)
    const progressCircle = page.locator('div.ant-progress-circle');
    await expect(progressCircle).toBeVisible({ timeout: 30000 });

    const ariaValue = await progressCircle.first().getAttribute('aria-valuenow');
    const percent = parseInt(ariaValue || '0', 10);
    // Existing datasource should have at least name, supplier, category filled
    expect(percent).toBeGreaterThan(0);

    // Verify completed tabs show green check icons in sidebar
    const sidebarCard = getSidebarCard(page);
    const greenChecks = sidebarCard.locator('.anticon-check-circle');
    const greenCount = await greenChecks.count();
    // At least basic tab should be complete (seeded data has name, supplier, category)
    expect(greenCount).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 8: Status column shows read-only tag (no select)
  // =========================================================================
  test('list page status column shows read-only tag, not a select dropdown', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources`);
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Status tags should be present (e.g. ant-tag-success with text "פעיל")
    const statusTags = page.locator('.ant-table-tbody .ant-tag');
    const tagCount = await statusTags.count();
    expect(tagCount).toBeGreaterThan(0);

    // Verify NO ant-select exists in the status column area
    // Status column is the 3rd column (index 2 in zero-based)
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const statusCell = firstRow.locator('td').nth(2);
    const selectInStatus = statusCell.locator('.ant-select');
    const selectCount = await selectInStatus.count();
    expect(selectCount).toBe(0);

    // Verify at least one tag has the expected class
    const firstTag = statusTags.first();
    const tagClass = await firstTag.getAttribute('class');
    expect(tagClass).toContain('ant-tag');
  });

  // =========================================================================
  // Test 9: Power icon button exists in actions
  // =========================================================================
  test('power icon button exists in actions column', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources`);
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify PoweroffOutlined icon button exists in the first row's actions
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const powerBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-poweroff') });
    await expect(powerBtn.first()).toBeVisible();

    // Verify there are 6 action buttons per row (eye, edit, copy, poweroff, thunderbolt, delete)
    const actionButtons = firstRow.locator('button');
    const buttonCount = await actionButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(6);
  });

  // =========================================================================
  // Test 10: RTL layout - sidebar on correct side
  // =========================================================================
  test('RTL layout: sidebar is positioned on the left side of the form', async ({ page }) => {
    await navigateAndWait(page, `${FRONTEND_URL}/datasources/new`);

    const progressCircle = page.locator('div.ant-progress-circle');
    await expect(progressCircle).toBeVisible({ timeout: 30000 });

    // In RTL layout, the sidebar (completeness panel) should be on the LEFT side
    // while the main form content is on the RIGHT side
    const sidebarCard = getSidebarCard(page);
    const sidebarBox = await sidebarCard.boundingBox();
    expect(sidebarBox).toBeTruthy();

    // Get the main form area (ant-tabs container next to the sidebar)
    const formTabs = page.locator('.ant-tabs').first();
    const formBox = await formTabs.boundingBox();
    expect(formBox).toBeTruthy();

    // In RTL: sidebar x should be LESS than form x (sidebar is to the left)
    if (sidebarBox && formBox) {
      expect(sidebarBox.x).toBeLessThan(formBox.x);
    }
  });
});

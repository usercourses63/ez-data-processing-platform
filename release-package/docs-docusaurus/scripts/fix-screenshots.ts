/**
 * Fix screenshots that failed in the main capture script.
 * Uses more robust selectors and longer waits for Ant Design RTL components.
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = process.env.SCREENSHOT_URL || 'http://localhost:7000';
const OUTPUT_DIR = path.resolve(__dirname, '../static/img/screenshots');
const VIEWPORT = { width: 1280, height: 800 };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // Wait for the actual app content to render (not just the loading splash)
  try {
    await page.waitForSelector('.ant-layout, .ant-menu, [class*="sidebar"], [class*="Sidebar"]', { timeout: 15000 });
  } catch {
    // Fallback: just wait longer
    await delay(5000);
  }
  await delay(1500);
}

async function main(): Promise<void> {
  console.log('=== Fix Screenshots ===');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'he-IL',
    extraHTTPHeaders: { 'Accept-Language': 'he-IL,he;q=0.9,en;q=0.1' },
  });
  const page = await context.newPage();

  // Verify frontend - MUST wait for app to fully load past splash screen
  await page.goto(BASE_URL, { timeout: 30000, waitUntil: 'networkidle' });
  await waitForPageReady(page);
  console.log('Frontend OK - app loaded');

  // ─── 0. Getting Started Screenshots ───────────────────────────────
  try {
    console.log('Capturing getting-started screenshots...');
    // Dashboard (redirects to /datasources)
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table', { timeout: 15000 }).catch(() => {});
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'getting-started-dashboard.png') });
    console.log('  OK getting-started-dashboard.png');

    // Sidebar - capture the right side where sidebar is in RTL
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'getting-started-sidebar.png'), clip: { x: 900, y: 0, width: 380, height: 800 } });
    console.log('  OK getting-started-sidebar.png');

    // Language toggle - capture the header
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'getting-started-language-toggle.png'), clip: { x: 0, y: 0, width: 1280, height: 60 } });
    console.log('  OK getting-started-language-toggle.png');
  } catch (err: any) {
    console.error('  FAIL getting-started:', err.message);
  }

  // ─── 0b. Dashboard ────────────────────────────────────────────────
  try {
    console.log('Capturing dashboard...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'dashboard-overview.png'), fullPage: true });
    console.log('  OK dashboard-overview.png');
  } catch (err: any) {
    console.error('  FAIL dashboard:', err.message);
  }

  // ─── 0c. Monitoring ───────────────────────────────────────────────
  try {
    console.log('Capturing monitoring screenshots...');
    await page.goto(`${BASE_URL}/monitoring`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'monitoring-dashboard.png') });
    console.log('  OK monitoring-dashboard.png');

    // Device health tab
    const healthTab = page.locator('[role="tab"]').filter({ hasText: /בריאות|health|מכשירים/i });
    if (await healthTab.first().isVisible({ timeout: 3000 })) {
      await healthTab.first().click();
      await delay(1500);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'monitoring-device-health.png') });
    console.log('  OK monitoring-device-health.png');

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'monitoring-grafana.png'), fullPage: true });
    console.log('  OK monitoring-grafana.png');
  } catch (err: any) {
    console.error('  FAIL monitoring:', err.message);
  }

  // ─── 0d. Invalid Records ──────────────────────────────────────────
  try {
    console.log('Capturing invalid-records screenshots...');
    await page.goto(`${BASE_URL}/invalid-records`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'invalid-records-list.png') });
    console.log('  OK invalid-records-list.png');
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'invalid-records-fullpage.png'), fullPage: true });
    console.log('  OK invalid-records-fullpage.png');
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'invalid-records-filters.png'), clip: { x: 0, y: 0, width: 1280, height: 350 } });
    console.log('  OK invalid-records-filters.png');
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'troubleshooting-logs.png') });
    console.log('  OK troubleshooting-logs.png');
  } catch (err: any) {
    console.error('  FAIL invalid-records:', err.message);
  }

  // ─── 0e. General: Datasource list + edit ──────────────────────────
  try {
    console.log('Capturing general screenshots...');
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 }).catch(() => {});
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'datasource-list-overview.png'), fullPage: true });
    console.log('  OK datasource-list-overview.png');

    // Edit first datasource
    const firstRow = page.locator('.ant-table-row').first();
    const editBtn = firstRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      await page.waitForURL('**/edit**', { timeout: 10000 });
      await waitForPageReady(page);
      await delay(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'datasource-edit-overview.png'), fullPage: true });
      console.log('  OK datasource-edit-overview.png');

      // Schema tab from edit page
      const schemaTab = page.locator('[data-node-key="schema"]');
      if (await schemaTab.isVisible({ timeout: 2000 })) {
        await schemaTab.click();
        await delay(2000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'schema-editor.png') });
        console.log('  OK schema-editor.png');
      }

      // Validation tab
      const valTab = page.locator('[data-node-key="validation"]');
      if (await valTab.isVisible({ timeout: 2000 })) {
        await valTab.click();
        await delay(1000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'schema-validation-result.png') });
        console.log('  OK schema-validation-result.png');
      }

      // Scheduling tab
      const schedTab = page.locator('[data-node-key="scheduling"]');
      if (await schedTab.isVisible({ timeout: 2000 })) {
        await schedTab.click();
        await delay(1000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'schedule-config.png') });
        console.log('  OK schedule-config.png');
      }
    }

    // Schedule list = datasource list (shows schedule column)
    await page.goto(`${BASE_URL}/datasources`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await page.waitForSelector('.ant-table-row', { timeout: 15000 }).catch(() => {});
    await delay(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'schedule-list.png') });
    console.log('  OK schedule-list.png');
  } catch (err: any) {
    console.error('  FAIL general:', err.message);
  }

  // ─── 0f. Alerts page screenshots ──────────────────────────────────
  try {
    console.log('Capturing alerts page...');
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'alerts-list.png') });
    console.log('  OK alerts-list.png');
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'alerts-fullpage.png'), fullPage: true });
    console.log('  OK alerts-fullpage.png');

    // Settings tab
    const settingsTab = page.locator('[role="tab"]').filter({ hasText: /הגדרות|settings/i });
    if (await settingsTab.first().isVisible({ timeout: 3000 })) {
      await settingsTab.first().click();
      await delay(1000);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'alerts-settings.png') });
    console.log('  OK alerts-settings.png');
  } catch (err: any) {
    console.error('  FAIL alerts:', err.message);
  }

  // ─── 0g. Admin Settings tabs (no modals) ──────────────────────────
  try {
    console.log('Capturing admin tabs...');
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-categories.png') });
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-settings-fullpage.png'), fullPage: true });
    console.log('  OK admin-categories.png');

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    // Input servers (tab index 1)
    if (tabCount > 1) {
      await tabs.nth(1).click();
      await delay(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-input-servers.png') });
      console.log('  OK admin-input-servers.png');
    }

    // Output servers (tab index 2)
    if (tabCount > 2) {
      await tabs.nth(2).click();
      await delay(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-output-servers.png') });
      console.log('  OK admin-output-servers.png');
    }

    // NAS (last tab)
    if (tabCount > 3) {
      await tabs.nth(tabCount - 1).click();
      await delay(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-nas-devices.png') });
      console.log('  OK admin-nas-devices.png');
    }
  } catch (err: any) {
    console.error('  FAIL admin tabs:', err.message);
  }

  // ─── 1. Alerts: Create Dialog ─────────────────────────────────────
  try {
    console.log('Capturing alerts-create-dialog...');
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    // Try the "create first alert" button or the header button
    const createBtn = page.locator('button').filter({ hasText: /צור התרעה|יצירת התרעה/i });
    const count = await createBtn.count();
    console.log(`  Found ${count} create buttons`);
    if (count > 0) {
      await createBtn.first().click();
      await delay(1500);
    }

    // Wait for modal
    const modal = page.locator('.ant-modal-content');
    if (await modal.isVisible({ timeout: 5000 })) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'alerts-create-dialog.png') });
      console.log('  OK alerts-create-dialog.png');
      // Close
      await page.locator('.ant-modal-close').click().catch(() => {});
      await delay(500);
    } else {
      console.log('  WARN: Modal not visible, saving page state');
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'alerts-create-dialog.png') });
    }
  } catch (err: any) {
    console.error('  FAIL:', err.message);
  }

  // ─── 2. Admin Settings: Server Modal ──────────────────────────────
  try {
    console.log('Capturing admin-server-modal...');
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    // Click input servers tab - use role=tab
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    console.log(`  Found ${tabCount} tabs`);
    for (let i = 0; i < tabCount; i++) {
      const text = await tabs.nth(i).textContent();
      console.log(`    Tab ${i}: "${text}"`);
    }

    // Click the second tab (input servers)
    if (tabCount > 1) {
      await tabs.nth(1).click();
      await delay(1000);
    }

    // Click add server button
    const addBtn = page.locator('button').filter({ hasText: /הוסף שרת|הוספת שרת/i });
    const addCount = await addBtn.count();
    console.log(`  Found ${addCount} add buttons`);
    if (addCount > 0) {
      await addBtn.first().click();
      await delay(1000);
    }

    const modal = page.locator('.ant-modal-content');
    if (await modal.isVisible({ timeout: 5000 })) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-server-modal.png') });
      console.log('  OK admin-server-modal.png');
      await page.locator('.ant-modal-close').click().catch(() => {});
      await delay(500);
    } else {
      console.log('  WARN: Server modal not visible');
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-server-modal.png') });
    }
  } catch (err: any) {
    console.error('  FAIL:', err.message);
  }

  // ─── 3. Admin Settings: NAS Modal ─────────────────────────────────
  try {
    console.log('Capturing admin-nas-modal...');
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);

    // Click NAS tab (last tab)
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      await tabs.nth(tabCount - 1).click();
      await delay(1000);
    }

    // Click add NAS button
    const addBtn = page.locator('button').filter({ hasText: /הוסף התקן|הוספת התקן|NAS/i });
    const addCount = await addBtn.count();
    console.log(`  Found ${addCount} add NAS buttons`);
    if (addCount > 0) {
      await addBtn.first().click();
      await delay(1000);
    }

    const modal = page.locator('.ant-modal-content');
    if (await modal.isVisible({ timeout: 5000 })) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-nas-modal.png') });
      console.log('  OK admin-nas-modal.png');
      await page.locator('.ant-modal-close').click().catch(() => {});
      await delay(500);
    } else {
      console.log('  WARN: NAS modal not visible');
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'admin-nas-modal.png') });
    }
  } catch (err: any) {
    console.error('  FAIL:', err.message);
  }

  // ─── 4. Create Form Tabs (navigate to /datasources/new) ──────────
  try {
    console.log('Capturing create form tabs...');
    await page.goto(`${BASE_URL}/datasources/new`, { waitUntil: 'networkidle' });
    await waitForPageReady(page);
    await delay(1000);

    // Basic tab (default)
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-basic.png') });
    console.log('  OK create-form-basic.png');

    // Get all form tabs
    const formTabs = page.locator('.ant-tabs-tab');
    const ftCount = await formTabs.count();
    console.log(`  Found ${ftCount} form tabs`);
    for (let i = 0; i < ftCount; i++) {
      const text = await formTabs.nth(i).textContent();
      console.log(`    FormTab ${i}: "${text?.trim()}"`);
    }

    // Connection tab - click by data-node-key or by index
    const connTab = page.locator('[data-node-key="connection"]');
    if (await connTab.isVisible({ timeout: 2000 })) {
      await connTab.click();
    } else {
      // Try clicking by tab text
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: /חיבור|connection/i });
      if (await tab.first().isVisible({ timeout: 2000 })) {
        await tab.first().click();
      }
    }
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-connection.png') });
    console.log('  OK create-form-connection.png');

    // File tab
    const fileTab = page.locator('[data-node-key="file"]');
    if (await fileTab.isVisible({ timeout: 2000 })) {
      await fileTab.click();
    } else {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: /קובץ|file/i });
      if (await tab.first().isVisible({ timeout: 2000 })) await tab.first().click();
    }
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-file.png') });
    console.log('  OK create-form-file.png');

    // Schema tab
    const schemaTab = page.locator('[data-node-key="schema"]');
    if (await schemaTab.isVisible({ timeout: 2000 })) {
      await schemaTab.click();
    } else {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: /סכמה|schema/i });
      if (await tab.first().isVisible({ timeout: 2000 })) await tab.first().click();
    }
    await delay(2000); // Monaco needs time
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-schema.png'), fullPage: true });
    console.log('  OK create-form-schema.png');

    // Scheduling tab
    const schedTab = page.locator('[data-node-key="scheduling"]');
    if (await schedTab.isVisible({ timeout: 2000 })) {
      await schedTab.click();
    } else {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: /תזמון|scheduling/i });
      if (await tab.first().isVisible({ timeout: 2000 })) await tab.first().click();
    }
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-scheduling.png') });
    console.log('  OK create-form-scheduling.png');

    // Validation tab
    const valTab = page.locator('[data-node-key="validation"]');
    if (await valTab.isVisible({ timeout: 2000 })) {
      await valTab.click();
    } else {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: /אימות|validation/i });
      if (await tab.first().isVisible({ timeout: 2000 })) await tab.first().click();
    }
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-validation.png') });
    console.log('  OK create-form-validation.png');

    // Output tab
    const outTab = page.locator('[data-node-key="output"]');
    if (await outTab.isVisible({ timeout: 2000 })) {
      await outTab.click();
    } else {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: /פלט|output/i });
      if (await tab.first().isVisible({ timeout: 2000 })) await tab.first().click();
    }
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-output.png') });
    console.log('  OK create-form-output.png');

    // Alerts tab
    const alertTab = page.locator('[data-node-key="alerts"]');
    if (await alertTab.isVisible({ timeout: 2000 })) {
      await alertTab.click();
    } else {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: /התראות|alerts/i });
      if (await tab.first().isVisible({ timeout: 2000 })) await tab.first().click();
    }
    await delay(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-alerts.png') });
    console.log('  OK create-form-alerts.png');

    // Save button visible
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'create-form-save.png'), fullPage: true });
    console.log('  OK create-form-save.png');

  } catch (err: any) {
    console.error('  FAIL:', err.message);
  }

  await context.close();
  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);

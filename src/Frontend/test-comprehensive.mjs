import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://172.30.22.206:32608';
let pass = 0, fail = 0;

function report(n, ok, d) {
  if (ok) { pass++; console.log('  [PASS]', n, d || ''); }
  else { fail++; console.log('  [FAIL]', n, d || ''); }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// 1. CSV Import
console.log('=== 1. CSV Import ===');
await page.goto(BASE + '/datasources');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);
await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'test-data/import-test-with-headers.csv'));
await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 15000 });
await page.waitForTimeout(2000);
await page.locator('.ant-modal button').filter({ hasText: /Continue|המשך/i }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(6000);
let s = await page.evaluate(() => {
  const t = document.querySelectorAll('div[style*="cursor: pointer"], div[style*="cursor: not-allowed"]');
  return { schema: t[3]?.textContent };
});
report('CSV schema 1/1', s.schema?.includes('1/1'), s.schema);

// 2. JSON Import
console.log('\n=== 2. JSON Import ===');
await page.goto(BASE + '/datasources');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);
await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'test-data/import-test.json'));
await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 15000 });
await page.waitForTimeout(2000);
await page.locator('.ant-modal button').filter({ hasText: /Continue|המשך/i }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(6000);
s = await page.evaluate(() => {
  const t = document.querySelectorAll('div[style*="cursor: pointer"], div[style*="cursor: not-allowed"]');
  return { schema: t[3]?.textContent };
});
report('JSON schema 1/1', s.schema?.includes('1/1'), s.schema);

// 3. Edit: schema on load
console.log('\n=== 3. Edit schema on load ===');
await page.goto(BASE + '/datasources');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);
const rows = await page.locator('.ant-table-tbody tr').all();
for (const r of rows) {
  const p = await r.locator('.ant-progress').getAttribute('aria-valuenow');
  if (p === '100') { await r.locator('.anticon-edit').click(); break; }
}
await page.waitForLoadState('networkidle');
await page.waitForTimeout(6000);
s = await page.evaluate(() => {
  const t = document.querySelectorAll('div[style*="cursor: pointer"], div[style*="cursor: not-allowed"]');
  return { schema: t[3]?.textContent, pct: document.querySelector('div.ant-progress-circle')?.getAttribute('aria-valuenow') };
});
report('Edit schema 1/1', s.schema?.includes('1/1'), s.schema);
report('Edit 100%', s.pct === '100', s.pct + '%');

// 4. Schema tab: Add field stays
console.log('\n=== 4. Add field stays on schema ===');
const sidebar = page.locator('.ant-card').filter({ has: page.locator('div.ant-progress-circle') });
const stabs = sidebar.locator('div[style*="cursor: pointer"], div[style*="cursor: not-allowed"]');
await stabs.nth(3).click();
await page.waitForTimeout(2000);
const urlBefore = page.url();
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('\u05d4\u05d5\u05e1\u05e3 \u05e9\u05d3\u05d4')) { btn.click(); return; }
  }
});
await page.waitForTimeout(2000);

// The jsonjoy schema builder may open a dialog — close it if present
const dialog = page.locator('[role="dialog"][data-state="open"]');
if (await dialog.count() > 0) {
  console.log('  (jsonjoy dialog detected — closing it)');
  // Press Escape to close the dialog
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

const ak = await page.locator('.ant-tabs-tab-active').first().getAttribute('data-node-key');
report('Still on schema tab', ak === 'schema', ak);
report('No navigation', page.url() === urlBefore, page.url());

// 5. Update redirects to list
console.log('\n=== 5. Update redirects ===');
// Close any remaining dialogs/overlays
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await stabs.nth(0).click();
await page.waitForTimeout(1000);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(5000);
report('Redirected to list', page.url().includes('/datasources') && !page.url().includes('/edit'), page.url());

// 6. Status tooltip
console.log('\n=== 6. Status tooltip ===');
await page.waitForTimeout(2000);
const helpDiv = page.locator('.ant-table-tbody tr').first().locator('div[style*="cursor: help"]');
if (await helpDiv.count() > 0) {
  await helpDiv.first().hover();
  await page.waitForTimeout(1000);
  const tips = await page.locator('.ant-tooltip:visible').all();
  report('One tooltip visible', tips.length === 1, tips.length + ' tooltips');
  if (tips.length > 0) {
    const txt = await tips[0].textContent();
    report('Tooltip has text', txt?.trim().length > 3, txt?.substring(0, 60));
  }
}

// 7. Field borders on edit
console.log('\n=== 7. Field borders ===');
await page.goto(BASE + '/datasources');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);
for (const r of await page.locator('.ant-table-tbody tr').all()) {
  if (await r.locator('.ant-progress').getAttribute('aria-valuenow') === '100') { await r.locator('.anticon-edit').click(); break; }
}
await page.waitForLoadState('networkidle');
await page.waitForTimeout(6000);
const bc = await page.locator('[data-completeness-status]').count();
report('Basic tab borders', bc >= 3, bc + ' items');

console.log('\n=== RESULTS ===');
console.log('Passed:', pass, '/ Total:', pass + fail, '/ Failed:', fail);
console.log(fail === 0 ? 'ALL PASS' : 'FAILURES DETECTED');

await browser.close();
process.exit(fail > 0 ? 1 : 0);

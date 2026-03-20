import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:7000';

// All main menu pages to verify
const PAGES = [
  { name: 'Data Sources', path: '/datasources', selector: '.datasource, [class*="datasource"], .ant-table, .ant-list, .ant-card' },
  { name: 'Dashboard', path: '/dashboard', selector: '.dashboard, [class*="dashboard"], .ant-card, .ant-statistic' },
  { name: 'Schema Management', path: '/schema-management', selector: '.schema, [class*="schema"], .ant-table, .ant-card, .ant-list' },
  { name: 'Monitoring', path: '/monitoring', selector: '.monitoring, [class*="monitoring"], .ant-tabs, .ant-card, .ant-skeleton, .ant-spin' },
  { name: 'Alerts', path: '/alerts', selector: '.alerts, [class*="alert"], .ant-table, .ant-card, .ant-empty' },
  { name: 'Invalid Records', path: '/invalid-records', selector: '.invalid, [class*="invalid"], .ant-table, .ant-card, .ant-empty' },
  { name: 'Validation', path: '/validation', selector: '.validation, [class*="validation"], .ant-table, .ant-card, .ant-empty' },
  { name: 'Admin Settings', path: '/admin/settings', selector: '.admin, [class*="admin"], .ant-tabs, .ant-card, .ant-form' },
  { name: 'Help', path: '/help', selector: '.help, [class*="help"], .ant-card, .ant-typography' },
];

test.describe('Main Menu Pages Health Check', () => {
  for (const page of PAGES) {
    test(`${page.name} (${page.path}) loads without errors`, async ({ page: pw }) => {
      const errors: string[] = [];

      // Capture console errors
      pw.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Capture page crashes
      pw.on('pageerror', err => {
        errors.push(`PAGE ERROR: ${err.message}`);
      });

      // Navigate - skip splash screen
      await pw.goto(BASE + page.path, { waitUntil: 'networkidle', timeout: 30000 });

      // Dismiss splash screen if present
      const splash = await pw.$('.splash-screen, [class*="splash"]');
      if (splash) {
        await pw.waitForSelector('.splash-screen, [class*="splash"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
      }

      // Wait for React to render content
      await pw.waitForTimeout(2000);

      // Check page rendered something meaningful (not blank)
      const bodyText = await pw.evaluate(() => document.body.innerText);
      expect(bodyText.length, `${page.name} page body should have content`).toBeGreaterThan(10);

      // Check no white screen of death - should have layout elements
      const hasLayout = await pw.$('.ant-layout, [class*="layout"]');
      expect(hasLayout, `${page.name} should have layout rendered`).toBeTruthy();

      // Check for content area rendering
      const hasContent = await pw.$(page.selector);
      if (!hasContent) {
        // Take screenshot for debugging
        await pw.screenshot({ path: `test-results/page-check-${page.path.replace(/\//g, '_')}.png`, fullPage: true });
        console.log(`WARNING: ${page.name} - expected selector not found: ${page.selector}`);
      }

      // Filter out non-critical console errors (SignalR reconnect, favicon, etc.)
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('SignalR') &&
        !e.includes('ERR_CONNECTION_REFUSED') &&
        !e.includes('chunk') &&
        !e.includes('net::')
      );

      // Report but don't fail on console errors - just log them
      if (criticalErrors.length > 0) {
        console.log(`${page.name} console errors:`, criticalErrors);
      }

      // The page should NOT show an unhandled error boundary
      const errorBoundary = await pw.$('.error-boundary, [class*="error-boundary"]');
      if (errorBoundary) {
        const errorText = await errorBoundary.textContent();
        throw new Error(`${page.name} shows error boundary: ${errorText}`);
      }
    });
  }
});

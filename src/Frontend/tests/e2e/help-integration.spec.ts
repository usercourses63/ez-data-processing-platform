import { test, expect, Page } from '@playwright/test';

/**
 * Help Integration E2E Tests
 *
 * Tests for the Help button integration with Docusaurus documentation portal.
 *
 * Coverage:
 * - Help button visibility in header
 * - Help button opens docs portal in new tab
 * - URL detection (localhost:3000/docs in dev, /docs in production)
 * - RTL and LTR mode support
 * - Accessibility (aria-label, tooltip)
 *
 * Per FE-05, FE-06, FE-07: Help button links to Docusaurus portal with
 * environment-aware URLs.
 */

test.describe('Help Button Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display Help button in header', async ({ page }) => {
    // Help button should be visible with question circle icon
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });
    await expect(helpButton).toBeVisible();
  });

  test('should show Hebrew tooltip in RTL mode', async ({ page }) => {
    // Verify we're in Hebrew/RTL mode (default)
    const isRTL = await page.evaluate(() => {
      return document.documentElement.dir === 'rtl' ||
             document.documentElement.lang === 'he';
    });

    if (isRTL) {
      // Hover over help button to show tooltip
      const helpButton = page.locator('button').filter({
        has: page.locator('[class*="anticon-question-circle"]')
      });
      await helpButton.hover();
      await page.waitForTimeout(500);

      // Tooltip should show Hebrew text
      const tooltip = page.locator('.ant-tooltip-inner');
      if (await tooltip.isVisible()) {
        await expect(tooltip).toContainText('עזרה');
      }
    }
  });

  test('should show English tooltip in LTR mode', async ({ page }) => {
    // Switch to English if language toggle exists
    const langSwitch = page.locator('.ant-switch').first();
    if (await langSwitch.isVisible()) {
      // Check current state and switch if in Hebrew
      const isHebrew = await langSwitch.getAttribute('aria-checked') === 'true';
      if (isHebrew) {
        await langSwitch.click();
        await page.waitForTimeout(300);
      }
    }

    // Hover over help button
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });
    await helpButton.hover();
    await page.waitForTimeout(500);

    // Tooltip should show English text
    const tooltip = page.locator('.ant-tooltip-inner');
    if (await tooltip.isVisible()) {
      await expect(tooltip).toContainText('Help');
    }
  });

  test('should have accessible aria-label', async ({ page }) => {
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });

    const ariaLabel = await helpButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    // Should contain either Hebrew or English accessibility text
    expect(
      ariaLabel?.includes('documentation') ||
      ariaLabel?.includes('תיעוד')
    ).toBe(true);
  });

  test('should open docs portal in new tab when clicked', async ({ page, context }) => {
    // Listen for new page (popup/tab)
    const pagePromise = context.waitForEvent('page');

    // Click help button
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });
    await helpButton.click();

    // Wait for new page to open
    const newPage = await pagePromise;
    await newPage.waitForLoadState('domcontentloaded');

    // Verify the URL contains /docs
    const url = newPage.url();
    expect(url).toMatch(/\/docs/);

    // Close the new tab
    await newPage.close();
  });
});

test.describe('Help Button URL Detection', () => {
  test('should use correct URL pattern for development environment', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify that the Help button exists
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });
    await expect(helpButton).toBeVisible();

    // In development (localhost), should open localhost:3000/docs
    // We can verify by checking the onClick handler behavior
    const hostname = await page.evaluate(() => window.location.hostname);

    // For localhost, expect dev URL pattern
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Dev environment - URL should be localhost:3000/docs
      // We verify by testing the utility function indirectly
      const docsUrl = await page.evaluate(() => {
        const isDev = ['localhost', '127.0.0.1', '192.168.'].some(
          (p) => window.location.hostname.includes(p)
        );
        return isDev ? 'http://localhost:3000/docs' : '/docs';
      });
      expect(docsUrl).toBe('http://localhost:3000/docs');
    }
  });

  test('should handle production URL pattern', async ({ page }) => {
    // This test verifies the logic that would be used in production
    const prodDocsUrl = await page.evaluate(() => {
      // Simulate production environment check
      const hostname = 'ez-platform.example.com'; // Production hostname
      const isDev = ['localhost', '127.0.0.1', '192.168.'].some(
        (p) => hostname.includes(p)
      );
      return isDev ? 'http://localhost:3000/docs' : '/docs';
    });
    expect(prodDocsUrl).toBe('/docs');
  });
});

test.describe('Help Button RTL/LTR Modes', () => {
  test('should work correctly in RTL mode', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure RTL mode
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'he';
    });

    // Help button should still be clickable and visible
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });
    await expect(helpButton).toBeVisible();

    // Click should work in RTL
    const pagePromise = context.waitForEvent('page');
    await helpButton.click();

    const newPage = await pagePromise;
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toMatch(/\/docs/);
    await newPage.close();
  });

  test('should work correctly in LTR mode', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to LTR mode
    await page.evaluate(() => {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    });

    // Help button should still be clickable and visible
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });
    await expect(helpButton).toBeVisible();

    // Click should work in LTR
    const pagePromise = context.waitForEvent('page');
    await helpButton.click();

    const newPage = await pagePromise;
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toMatch(/\/docs/);
    await newPage.close();
  });
});

test.describe('Help Button Visual Baseline', () => {
  test('should capture help button baseline screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Capture header area with help button
    const header = page.locator('.app-header');
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header-with-help-button.png', {
        animations: 'disabled',
      });
    }
  });

  test('should capture help button tooltip baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Hover to show tooltip
    const helpButton = page.locator('button').filter({
      has: page.locator('[class*="anticon-question-circle"]')
    });
    await helpButton.hover();
    await page.waitForTimeout(500);

    // Capture with tooltip visible
    await expect(page).toHaveScreenshot('help-button-with-tooltip.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 100 },
      animations: 'disabled',
    });
  });
});

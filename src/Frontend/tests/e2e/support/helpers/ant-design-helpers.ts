/**
 * Ant Design interaction helpers for Playwright.
 * Handles RTL quirks, lazy tab rendering, form value restoration,
 * and Select component async loading issues.
 *
 * These workarounds are documented in project-context.md under
 * "Framework-Specific Rules > React / Ant Design".
 */
import { Page, Locator, expect } from '@playwright/test';

/**
 * Click an Ant Design tab reliably.
 * Standard .click() on Ant Design tabs does NOT trigger React state change.
 * Uses dispatchEvent workaround.
 *
 * @param page - Playwright page
 * @param tabKey - data-node-key value (e.g., 'output', 'schema', 'schedule')
 */
export async function clickAntTab(page: Page, tabKey: string): Promise<void> {
  const tabSelector = `[data-node-key="${tabKey}"]`;
  const tab = page.locator(tabSelector);
  await expect(tab).toBeVisible({ timeout: 5000 });

  // Use dispatchEvent because Ant Design tabs don't respond to standard click
  await tab.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  // Wait for tab panel to render
  await page.waitForTimeout(300);
}

/**
 * Select a value from an Ant Design Select component.
 * Handles the async options loading issue where values set before
 * options load are silently dropped.
 *
 * @param page - Playwright page
 * @param selectLocator - Locator for the Select component wrapper
 * @param optionText - Text of the option to select
 * @param timeoutMs - Max time to wait for options to load
 */
export async function selectAntOption(
  page: Page,
  selectLocator: Locator,
  optionText: string,
  timeoutMs = 10000
): Promise<void> {
  // Click to open dropdown
  await selectLocator.click();
  await page.waitForTimeout(300);

  // Wait for options to appear (handles async loading)
  const startTime = Date.now();
  let found = false;

  while (Date.now() - startTime < timeoutMs) {
    const options = page.locator('.ant-select-item-option');
    const count = await options.count();

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text?.includes(optionText)) {
        await options.nth(i).click();
        found = true;
        break;
      }
    }

    if (found) break;
    await page.waitForTimeout(300);
  }

  if (!found) {
    throw new Error(
      `Could not find option "${optionText}" in Select within ${timeoutMs}ms`
    );
  }

  await page.waitForTimeout(200);
}

/**
 * Wait for a lazy-loaded Ant Design tab panel to mount its Form.Items.
 * Form.setFieldsValue() silently discards values for unmounted items.
 *
 * @param page - Playwright page
 * @param formItemSelector - CSS selector for a Form.Item in the tab
 * @param timeoutMs - Max time to wait
 */
export async function waitForFormMount(
  page: Page,
  formItemSelector: string,
  timeoutMs = 5000
): Promise<void> {
  await page.waitForSelector(formItemSelector, { timeout: timeoutMs });
  // Extra wait for React to register Form.Item
  await page.waitForTimeout(200);
}

/**
 * Set viewport wide and tall enough to prevent RTL tab overflow
 * and ensure modal footers are visible without scrolling.
 * NAS form modal is ~990px tall — needs at least 1100px height.
 */
export async function setWideViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 1100 });
}

/**
 * Fill an Ant Design form field, handling potential lazy mounting.
 * Scrolls to the element first to ensure it's in view.
 */
export async function fillAntFormField(
  page: Page,
  fieldId: string,
  value: string
): Promise<void> {
  const field = page.locator(`#${fieldId}, [id="${fieldId}"]`).first();
  await field.scrollIntoViewIfNeeded();
  await field.fill(value);
}

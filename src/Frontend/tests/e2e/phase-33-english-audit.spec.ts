/**
 * Phase 33 — English-mode deployed-cluster audit.
 *
 * Audits the DEPLOYED frontend (frontend:v0.5.0-phase33, Helm release ez-platform,
 * served via port-forward http://localhost:7000) across 8 routes in English mode
 * (?lng=en), asserting per ROADMAP SC-05/06/07:
 *   - SC-07: each route renders ≤ 2 Hebrew text nodes (baseline: NOSCRIPT bilingual
 *            message + the 'עב' language-toggle label).
 *   - SC-06: zero external font-CDN requests (googleapis|gstatic|typekit|cdnfonts)
 *            — regression check on @fontsource/rubik self-hosting.
 *   - SC-05: window.EZ_CONFIG.docsUrl === 'http://192.168.49.2:30800' (browser-level).
 *
 * Run with: $env:BASE_URL='http://localhost:7000'; npx playwright test tests/e2e/phase-33-english-audit.spec.ts
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';

// D-02 channel lock — match the deployed sanity-suite Chrome channel.
test.use({ channel: 'chrome' });

// Routes discovered from src/Frontend/src/App.tsx <Routes> (Task 1 discovery).
// '/' Navigate-redirects to /datasources; we navigate to '/' and audit the rendered page.
const ROUTES: { slug: string; path: string }[] = [
  { slug: 'home-root', path: '/' },
  { slug: 'datasources-list', path: '/datasources' },
  { slug: 'datasources-new', path: '/datasources/new' },
  { slug: 'invalid-records', path: '/invalid-records' },
  { slug: 'alerts', path: '/alerts' },
  { slug: 'ai-assistant', path: '/ai-assistant' },
  { slug: 'admin-settings', path: '/admin/settings' },
  { slug: 'monitoring', path: '/monitoring' },
];

const EXPECTED_DOCS_URL = 'http://192.168.49.2:30800';
// Hebrew Unicode: base block א-ת plus ligatures/punctuation װ-״.
const HEBREW_REGEX = /[א-תװ-״]/;
const FONT_CDN_REGEX = /googleapis|gstatic|use\.typekit|fonts\.cdnfonts/;
const SCREENSHOT_DIR = 'tmp-screenshots/phase-33/en';
const MAX_HEBREW_LEAKS = 2;

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

for (const route of ROUTES) {
  test(`EN ${route.slug} — no Hebrew leaks, no external fonts`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    const externalFontRequests: string[] = [];
    const consoleErrors: string[] = [];
    page.on('request', (req) => {
      if (FONT_CDN_REGEX.test(req.url())) externalFontRequests.push(req.url());
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const nav = `/${route.path.replace(/^\//, '')}?lng=en`;
    await page.goto(nav, { waitUntil: 'domcontentloaded' });
    await page
      .waitForSelector('.ant-layout', { state: 'visible', timeout: 15000 })
      .catch(() => {/* some pages may not use ant-layout root; tolerate */});
    await page
      .waitForLoadState('networkidle', { timeout: 5000 })
      .catch(() => {/* tolerate polling pages */});

    await page.screenshot({ path: `${SCREENSHOT_DIR}/${route.slug}.png`, fullPage: true });

    const { count, samples } = await page.evaluate(({ pattern }) => {
      const HEB = new RegExp(pattern);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const p = (n as Text).parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          // Reject SCRIPT/STYLE, KEEP NOSCRIPT (intentional bilingual baseline).
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let count = 0;
      const samples: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const txt = (node.nodeValue ?? '').trim();
        if (txt && HEB.test(txt)) {
          count++;
          if (samples.length < 20) samples.push(txt.slice(0, 80));
        }
      }
      return { count, samples };
    }, { pattern: HEBREW_REGEX.source });

    test.info().annotations.push({ type: 'hebrew-count', description: String(count) });
    test.info().annotations.push({ type: 'hebrew-samples', description: JSON.stringify(samples) });
    test.info().annotations.push({ type: 'console-errors', description: JSON.stringify(consoleErrors) });

    expect.soft(externalFontRequests, `External font requests: ${externalFontRequests.join(', ')}`).toEqual([]);
    expect(count, `Hebrew leak samples: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(MAX_HEBREW_LEAKS);

    await context.close();
  });
}

test('window.EZ_CONFIG.docsUrl matches Helm-injected value', async ({ browser }) => {
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await page.goto('/?lng=en', { waitUntil: 'domcontentloaded' });
  const cfg = await page.evaluate(
    () => (window as unknown as { EZ_CONFIG?: { docsUrl?: string } }).EZ_CONFIG
  );
  expect(cfg, 'window.EZ_CONFIG should be defined').toBeDefined();
  expect(cfg?.docsUrl).toBe(EXPECTED_DOCS_URL);
  await context.close();
});

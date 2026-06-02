/**
 * Phase 33 — Hebrew-mode deployed-cluster regression audit.
 *
 * Mirror of phase-33-english-audit.spec.ts, run in Hebrew mode (?lng=he) against the
 * deployed frontend (http://localhost:7000). Asserts per ROADMAP SC-06/08:
 *   - SC-08: each route has document.documentElement.dir === 'rtl' AND lang === 'he'.
 *   - SC-08: englishLeaks (untranslated English-only labels, ≥4 Latin letters, not in
 *            ENGLISH_LEAK_WHITELIST, excluding .ltr-field/code/pre/dir=ltr contexts)
 *            stays ≤ ENGLISH_LEAK_BASELINE per route.
 *   - SC-06: zero external font-CDN requests sustained in Hebrew mode.
 *
 * Run with: $env:BASE_URL='http://localhost:7000'; npx playwright test tests/e2e/phase-33-hebrew-audit.spec.ts
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';

test.use({ channel: 'chrome' });

// Same ROUTES as phase-33-english-audit.spec.ts (copied literal — specs independent).
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
const FONT_CDN_REGEX = /googleapis|gstatic|use\.typekit|fonts\.cdnfonts/;
const SCREENSHOT_DIR = 'tmp-screenshots/phase-33/he';

// englishLeaks support (RESEARCH.md Pattern 3).
const ENGLISH_LEAK_REGEX = /\b[A-Za-z]{4,}\b/g;
const ENGLISH_LEAK_WHITELIST = new Set([
  'EZ', 'JSON', 'XML', 'CSV', 'NAS', 'FTP', 'SFTP', 'HTTP', 'HTTPS', 'PromQL',
  'Kafka', 'API', 'UTF', 'SignalR', 'MongoDB', 'OpenTelemetry', 'Prometheus',
  'Grafana', 'Jaeger', 'Elasticsearch', 'Hazelcast', 'Quartz', 'Helm', 'Docker',
  'Kubernetes', 'React', 'TypeScript', 'Vite', 'Antd', 'Rubik', 'EN', 'HE',
  'RTL', 'LTR',
]);
const ENGLISH_LEAK_BASELINE = 3;

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

for (const route of ROUTES) {
  test(`HE ${route.slug} — RTL, lang=he, zero external fonts, englishLeaks ≤ ${ENGLISH_LEAK_BASELINE}`, async ({ browser }) => {
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

    const nav = `/${route.path.replace(/^\//, '')}?lng=he`;
    await page.goto(nav, { waitUntil: 'domcontentloaded' });
    await page
      .waitForSelector('.ant-layout', { state: 'visible', timeout: 15000 })
      .catch(() => {/* tolerate */});
    await page
      .waitForLoadState('networkidle', { timeout: 5000 })
      .catch(() => {/* tolerate polling pages */});

    await page.screenshot({ path: `${SCREENSHOT_DIR}/${route.slug}.png`, fullPage: true });

    const { dir, lang } = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
    }));

    const lowerWhitelist = Array.from(ENGLISH_LEAK_WHITELIST).map((s) => s.toLowerCase());
    const { englishLeaks, leakSamples } = await page.evaluate(({ pattern, whitelist }) => {
      const re = new RegExp(pattern, 'g');
      const allowSet = new Set(whitelist);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const p = (n as Text).parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
          // Reject technical-LTR contexts (project convention for regex/paths/URLs/PromQL).
          if (p.closest('.ltr-field, code, pre, .ant-input[dir="ltr"], input[dir="ltr"]')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const leaks: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const txt = node.nodeValue ?? '';
        const matches = txt.match(re);
        if (matches) {
          for (const m of matches) {
            if (!allowSet.has(m.toLowerCase())) leaks.push(m);
          }
        }
      }
      return { englishLeaks: leaks.length, leakSamples: leaks.slice(0, 30) };
    }, { pattern: ENGLISH_LEAK_REGEX.source, whitelist: lowerWhitelist });

    test.info().annotations.push({ type: 'dir', description: dir });
    test.info().annotations.push({ type: 'lang', description: lang });
    test.info().annotations.push({ type: 'english-leaks-count', description: String(englishLeaks) });
    test.info().annotations.push({ type: 'english-leaks-samples', description: JSON.stringify(leakSamples) });
    test.info().annotations.push({ type: 'console-errors', description: JSON.stringify(consoleErrors) });

    expect(dir, `expected dir === 'rtl' on ${route.slug}, got '${dir}'`).toBe('rtl');
    expect(lang, `expected lang === 'he' on ${route.slug}, got '${lang}'`).toBe('he');

    expect.soft(
      englishLeaks,
      `englishLeaks on ${route.slug}: ${englishLeaks} (cap ${ENGLISH_LEAK_BASELINE}). Samples: ${JSON.stringify(leakSamples)}`
    ).toBeLessThanOrEqual(ENGLISH_LEAK_BASELINE);

    expect.soft(
      externalFontRequests,
      `External font requests on ${route.slug}: ${externalFontRequests.join(', ')}`
    ).toEqual([]);

    await context.close();
    void EXPECTED_DOCS_URL;
  });
}

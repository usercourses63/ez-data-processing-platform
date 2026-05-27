/**
 * Phase 33 — Static-shell unit tests.
 *
 * These tests guard the file-level decisions made in the four foundation commits
 * (f139193, 3d8fa19, 28586da, 2164d9d) against silent regression. They read the
 * actual repository files (index.html, public/config.js, src/index.tsx,
 * src/index.css, plus a recursive scan of src/) and assert structural
 * invariants without needing the deployed cluster or a browser.
 *
 * Mapped to ROADMAP success criteria:
 *   - SC-05  /config.js loads before the React bundle (runtime config wins)
 *   - SC-06  zero external font CDN references anywhere under src/
 *   - English-mode rendering fix (commit 28586da): no hardcoded direction:rtl
 *     on body; html[dir='ltr'] body uses a system font stack
 *   - Self-hosted Rubik (commit f139193): src/index.tsx imports @fontsource/rubik
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const projectRoot = resolve(__dirname, '../..');
const readRepoFile = (relPath: string): string =>
  readFileSync(join(projectRoot, relPath), 'utf8');

const FONT_CDN_REGEX = /googleapis|gstatic|use\.typekit|fonts\.cdnfonts/i;

describe('Phase 33: index.html static shell', () => {
  const html = readRepoFile('index.html');

  test('loads /config.js before any module bundle script (SC-05 prerequisite)', () => {
    const configIdx = html.indexOf('<script src="/config.js"></script>');
    const moduleIdx = html.indexOf('<script type="module"');
    expect(configIdx, '/config.js <script> tag must be present').toBeGreaterThan(-1);
    expect(moduleIdx, 'module bundle <script> tag must be present').toBeGreaterThan(-1);
    expect(configIdx, '/config.js must be parsed before the React bundle').toBeLessThan(moduleIdx);
  });

  test('has zero references to external font CDNs (SC-06)', () => {
    expect(html).not.toMatch(FONT_CDN_REGEX);
  });

  test('does NOT hardcode direction:rtl on body (regression on commit 28586da bug 2)', () => {
    // Strip the comment that explicitly references this fix so the explanatory
    // text inside doesn't trigger the regex.
    const inlineStyles = html.replace(/\/\*[\s\S]*?\*\//g, '');
    const bodyMatch = inlineStyles.match(/body\s*\{[^}]*\}/i);
    expect(bodyMatch, 'inline body{} rule must exist for the test to be meaningful').not.toBeNull();
    expect(bodyMatch![0]).not.toMatch(/direction\s*:\s*rtl/i);
    expect(bodyMatch![0]).not.toMatch(/text-align\s*:\s*right/i);
  });

  test('Ant Design RTL overrides are gated to html[dir=\'rtl\']', () => {
    // Plain `.ant-layout { direction: rtl }` without the qualifier was the original
    // bug — it forced RTL even in English mode.
    expect(html).toMatch(/html\[dir=['"]rtl['"]\]\s+\.ant-layout/);
  });

  test('bilingual <noscript> message (English + Hebrew)', () => {
    const noscriptMatch = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
    expect(noscriptMatch, '<noscript> tag must be present').not.toBeNull();
    const content = noscriptMatch![1];
    // English half: at least one ASCII word ≥ 4 letters
    expect(content).toMatch(/[A-Za-z]{4,}/);
    // Hebrew half: at least one character from the Hebrew block
    expect(content).toMatch(/[א-ת]/);
  });
});

describe('Phase 33: public/config.js dev stub', () => {
  const stub = readRepoFile('public/config.js');

  test('defines window.EZ_CONFIG so the fallback chain in docs-url.ts runs cleanly', () => {
    expect(stub).toMatch(/window\.EZ_CONFIG\s*=/);
  });

  test('dev stub is essentially empty so production entrypoint write wins', () => {
    // The dev stub must not pre-set docsUrl — the production entrypoint writes
    // the real value at container start. We accept comments + the single
    // assignment, no extra runtime logic.
    const codeOnly = stub.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    expect(codeOnly).toBe('window.EZ_CONFIG = {};');
  });
});

describe('Phase 33: src/index.tsx bundles self-hosted Rubik', () => {
  const entry = readRepoFile('src/index.tsx');

  test('imports @fontsource/rubik weights (replaces Google Fonts CDN, commit f139193)', () => {
    // At least one import of @fontsource/rubik must be present so Vite bundles
    // the WOFF2 files. Five weights are imported in the current entry; one
    // is the minimum bar.
    const importMatches = entry.match(/@fontsource\/rubik/g) ?? [];
    expect(importMatches.length, 'expected ≥1 @fontsource/rubik import').toBeGreaterThanOrEqual(1);
  });

  test('imports the i18n init module so LanguageDetector runs at boot', () => {
    expect(entry).toMatch(/import\s+['"]\.\/i18n['"]/);
  });

  test('has no references to fonts.googleapis or fonts.gstatic', () => {
    expect(entry).not.toMatch(FONT_CDN_REGEX);
  });
});

describe('Phase 33: src/index.css English-mode font fix (commit 28586da)', () => {
  const css = readRepoFile('src/index.css');

  test('html[dir=\'ltr\'] body declares a system font stack (zero external download)', () => {
    // Look for the rule whose selector targets ltr body and whose body contains
    // either -apple-system or BlinkMacSystemFont.
    const ltrRuleMatch = css.match(/html\[dir=['"]ltr['"]\]\s+body\s*\{[^}]*\}/i);
    expect(ltrRuleMatch, 'expected html[dir=\'ltr\'] body rule for English-mode font fix').not.toBeNull();
    const rule = ltrRuleMatch![0];
    expect(rule).toMatch(/-apple-system|BlinkMacSystemFont|system-ui/);
    // System fonts only — no Rubik in this rule (Rubik is the default cascade
    // for Hebrew; English mode explicitly overrides to system stack).
    expect(rule).not.toMatch(/Rubik/i);
  });

  test('default body rule does NOT hardcode direction:rtl (regression on commit 28586da)', () => {
    const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const defaultBodyMatch = cleaned.match(/(^|\})\s*body\s*\{[^}]*\}/);
    expect(defaultBodyMatch, 'default body{} rule must exist').not.toBeNull();
    expect(defaultBodyMatch![0]).not.toMatch(/direction\s*:\s*rtl/i);
  });

  test('has no references to fonts.googleapis or fonts.gstatic', () => {
    expect(css).not.toMatch(FONT_CDN_REGEX);
  });
});

describe('Phase 33: SC-06 unit-level guard — no external font CDN refs anywhere under src/', () => {
  const scannableExtensions = new Set(['.ts', '.tsx', '.css', '.html', '.js']);

  const collectScannableFiles = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'build' || name === 'test-results') continue;
      const full = join(dir, name);
      const s = statSync(full);
      if (s.isDirectory()) collectScannableFiles(full, out);
      else if (scannableExtensions.has(full.slice(full.lastIndexOf('.')))) out.push(full);
    }
    return out;
  };

  test('zero matches for googleapis|gstatic in production src/ files (test files excluded)', () => {
    const files = collectScannableFiles(join(projectRoot, 'src'));
    expect(files.length, 'expected to scan at least 50 files under src/').toBeGreaterThan(50);

    // Skip test files — they may legitimately reference the CDN patterns
    // (regex literals, anti-pattern docs, etc.). The point of this gate is
    // catching production code that imports/links external font URLs.
    const isTestFile = (f: string) =>
      /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f) ||
      /[\\/](__tests__|__integration__|test|tests)[\\/]/.test(f);

    const hits: { file: string; line: number; text: string }[] = [];
    for (const file of files) {
      if (isTestFile(file)) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((ln, i) => {
        if (FONT_CDN_REGEX.test(ln)) {
          hits.push({ file: file.slice(projectRoot.length + 1), line: i + 1, text: ln.trim() });
        }
      });
    }
    expect(hits, `unexpected font-CDN refs in production src/:\n${hits.map(h => `${h.file}:${h.line} ${h.text}`).join('\n')}`).toEqual([]);
  });
});

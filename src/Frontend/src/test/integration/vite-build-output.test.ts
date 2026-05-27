/**
 * Phase 33 integration test — Vite build output integrity.
 *
 * Seam under test: src/Frontend source → `npm run build` (tsc + vite build)
 * → build/ output (the artifact nginx serves in production).
 *
 * Real: vite build pipeline, the actual source tree
 * Fake: nothing — this verifies the real build output
 *
 * Maps to ROADMAP success criteria:
 *   - SC-01: build/assets/*.woff2 exists (≥ 1 file — Rubik bundled)
 *   - SC-05 prerequisite: build/index.html references /config.js BEFORE the
 *     module bundle script (Helm-injected window.EZ_CONFIG must populate
 *     before React boots)
 *   - SC-06: zero references to googleapis|gstatic|use.typekit|fonts.cdnfonts
 *     across the entire build/ output (no external font CDN fetches at runtime)
 *
 * Build runs once in beforeAll (~30-60s on a cold cache). Subsequent assertions
 * inspect the build/ output as static files.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { beforeAll, describe, expect, test } from 'vitest';

// __dirname = <repo>/src/Frontend/src/test/integration → Frontend root = 3 levels up
const FRONTEND_ROOT = resolve(__dirname, '../../..');
const BUILD_DIR = join(FRONTEND_ROOT, 'build');

const FONT_CDN_REGEX = /googleapis|gstatic|use\.typekit|fonts\.cdnfonts/i;

const collectFiles = (dir: string, exts: Set<string>, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) collectFiles(full, exts, out);
    else {
      const dot = full.lastIndexOf('.');
      const ext = dot === -1 ? '' : full.slice(dot);
      if (exts.has(ext)) out.push(full);
    }
  }
  return out;
};

describe('Phase 33 integration: Vite build output', () => {
  beforeAll(() => {
    // Run a fresh build. tsc + vite build, ~30-60s on cold cache. The previously
    // committed build/ may be stale (or built with different env), so always
    // re-build to test the SOURCE state, not whatever build/ happens to contain.
    execSync('npm run build', {
      cwd: FRONTEND_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Allow up to 3 minutes for cold-cache build (Monaco editor is large)
      timeout: 180_000,
      maxBuffer: 100 * 1024 * 1024,
    });
  }, 180_000);

  describe('build directory structure', () => {
    test('build/ directory exists after npm run build', () => {
      expect(existsSync(BUILD_DIR)).toBe(true);
    });

    test('build/index.html exists', () => {
      expect(existsSync(join(BUILD_DIR, 'index.html'))).toBe(true);
    });

    test('build/assets/ directory exists', () => {
      expect(existsSync(join(BUILD_DIR, 'assets'))).toBe(true);
    });
  });

  describe('SC-01: @fontsource/rubik WOFF2 bundled', () => {
    test('at least one .woff2 file in build/assets/', () => {
      const woff2 = collectFiles(join(BUILD_DIR, 'assets'), new Set(['.woff2']));
      expect(woff2.length, 'expected ≥1 WOFF2 file under build/assets/').toBeGreaterThanOrEqual(1);
    });

    test('WOFF2 filenames include "rubik" (Vite preserves the @fontsource/rubik origin)', () => {
      const woff2 = collectFiles(join(BUILD_DIR, 'assets'), new Set(['.woff2']));
      const rubikFiles = woff2.filter((f) => /rubik/i.test(f));
      expect(rubikFiles.length, `expected ≥1 rubik WOFF2 file; got: ${woff2.map((f) => f.split(/[/\\]/).pop()).join(', ')}`).toBeGreaterThanOrEqual(1);
    });
  });

  describe('SC-05 prerequisite: /config.js loads before the React bundle', () => {
    test('build/index.html references /config.js', () => {
      const html = readFileSync(join(BUILD_DIR, 'index.html'), 'utf8');
      expect(html).toContain('/config.js');
    });

    test('/config.js is parsed BEFORE the module bundle script tag', () => {
      const html = readFileSync(join(BUILD_DIR, 'index.html'), 'utf8');
      const configIdx = html.indexOf('/config.js');
      // Vite outputs bundle scripts as `<script type="module" crossorigin src="/assets/index-HASH.js">`
      const moduleScriptMatch = html.match(/<script\s+type="module"[^>]*src="\/assets\/[^"]+\.js"/);
      expect(configIdx, '/config.js must be referenced').toBeGreaterThan(-1);
      expect(moduleScriptMatch, 'module bundle script tag must exist').not.toBeNull();
      const moduleIdx = html.indexOf(moduleScriptMatch![0]);
      expect(configIdx, '/config.js must come before the React bundle module script').toBeLessThan(moduleIdx);
    });
  });

  describe('SC-06: zero external font CDN references in build output', () => {
    test('build/index.html has zero matches for googleapis|gstatic|use.typekit|fonts.cdnfonts', () => {
      const html = readFileSync(join(BUILD_DIR, 'index.html'), 'utf8');
      expect(html).not.toMatch(FONT_CDN_REGEX);
    });

    test('every .html / .css / .js file under build/ has zero font CDN refs', () => {
      const files = collectFiles(BUILD_DIR, new Set(['.html', '.css', '.js']));
      expect(files.length, 'expected at least one scannable file under build/').toBeGreaterThan(0);

      const hits: { file: string; sample: string }[] = [];
      for (const file of files) {
        // Skip source maps — they may embed sourcemap URLs that are not actual font CDN refs
        if (file.endsWith('.map')) continue;
        const content = readFileSync(file, 'utf8');
        if (FONT_CDN_REGEX.test(content)) {
          const sampleMatch = content.match(FONT_CDN_REGEX);
          hits.push({
            file: file.slice(FRONTEND_ROOT.length + 1),
            sample: sampleMatch?.[0] ?? '?',
          });
        }
      }
      expect(
        hits,
        `unexpected font CDN refs in build output:\n${hits.map((h) => `  ${h.file} — ${h.sample}`).join('\n')}`
      ).toEqual([]);
    });
  });
});

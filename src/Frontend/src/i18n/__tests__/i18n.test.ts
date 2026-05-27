import { describe, expect, test } from 'vitest';

import enTranslations from '../locales/en.json';
import heTranslations from '../locales/he.json';
import i18n from '../index';

const collectLeafKeys = (
  obj: Record<string, unknown>,
  prefix = '',
  out: Set<string> = new Set()
): Set<string> => {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      collectLeafKeys(value as Record<string, unknown>, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
};

describe('i18n configuration', () => {
  test('exposes both en and he resources', () => {
    expect(i18n.options.resources).toBeDefined();
    const resources = i18n.options.resources as Record<string, { translation: unknown }>;
    expect(resources.en).toBeDefined();
    expect(resources.he).toBeDefined();
    expect(resources.en.translation).toBeDefined();
    expect(resources.he.translation).toBeDefined();
  });

  test('fallbackLng is "en" (regression on phase 32 English parity work)', () => {
    expect(i18n.options.fallbackLng).toEqual(['en']);
  });

  test('does not hardcode lng (so LanguageDetector stays enabled)', () => {
    // i18next assigns this only when init() is called with lng: '...'.
    // Setup must omit it so the detector picks based on querystring/storage/navigator.
    expect(i18n.options.lng).toBeUndefined();
  });

  test('detection order matches the locked sequence for phase 33', () => {
    expect(i18n.options.detection?.order).toEqual([
      'querystring',
      'localStorage',
      'navigator',
      'htmlTag',
    ]);
  });

  test('querystring detection uses ?lng= parameter (phase 33 E2E specs rely on this)', () => {
    expect(i18n.options.detection?.lookupQuerystring).toBe('lng');
  });

  test('caches language choice to localStorage', () => {
    expect(i18n.options.detection?.caches).toEqual(['localStorage']);
  });

  test('interpolation does not HTML-escape (React renders trusted translations)', () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  test('react integration runs without suspense', () => {
    expect(i18n.options.react?.useSuspense).toBe(false);
  });
});

describe('locale parity (regression gate on commit 2164d9d English parity work)', () => {
  const enKeys = collectLeafKeys(enTranslations as Record<string, unknown>);
  const heKeys = collectLeafKeys(heTranslations as Record<string, unknown>);

  test('en.json has the expected key count (snapshot — phase 32 baseline)', () => {
    // Baseline locked at 1401 leaf keys after phase 32 English parity work.
    // Bumping this snapshot is intentional — make sure any new keys also land in he.json.
    expect(enKeys.size).toBeGreaterThanOrEqual(1401);
  });

  test('he.json has the expected key count (snapshot — phase 32 baseline)', () => {
    expect(heKeys.size).toBeGreaterThanOrEqual(1401);
  });

  test('every he.json key has a matching en.json key (English is the fallback)', () => {
    const missingInEn: string[] = [];
    heKeys.forEach((k) => {
      if (!enKeys.has(k)) missingInEn.push(k);
    });
    expect(missingInEn).toEqual([]);
  });

  test('every en.json key has a matching he.json key (no English-only labels)', () => {
    const missingInHe: string[] = [];
    enKeys.forEach((k) => {
      if (!heKeys.has(k)) missingInHe.push(k);
    });
    expect(missingInHe).toEqual([]);
  });
});

describe('critical translation keys present in both locales', () => {
  const criticalKeys = [
    'app.title',
    'navigation.dashboard',
    'navigation.datasources',
    'navigation.validation',
    'navigation.monitoring',
  ];

  test.each(criticalKeys)('en.%s is a non-empty string', (key) => {
    const value = key.split('.').reduce<unknown>(
      (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
      enTranslations
    );
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  test.each(criticalKeys)('he.%s is a non-empty string', (key) => {
    const value = key.split('.').reduce<unknown>(
      (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
      heTranslations
    );
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getComponentDocsUrl,
  getDocsBaseUrl,
  getDocsUrl,
  getHebrewUserGuideUrl,
  isDevelopment,
  isProduction,
  openDocsInNewTab,
} from '../docs-url';

const setHostname = (hostname: string) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname },
  });
};

const setEzConfig = (config: { docsUrl?: string } | undefined) => {
  if (config === undefined) {
    delete (window as { EZ_CONFIG?: unknown }).EZ_CONFIG;
  } else {
    (window as { EZ_CONFIG?: { docsUrl?: string } }).EZ_CONFIG = config;
  }
};

describe('docs-url utility', () => {
  let originalLocation: Location;
  let originalEzConfig: { docsUrl?: string } | undefined;

  beforeEach(() => {
    originalLocation = window.location;
    originalEzConfig = window.EZ_CONFIG;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    setEzConfig(originalEzConfig);
    vi.restoreAllMocks();
  });

  describe('isProduction / isDevelopment', () => {
    test.each([
      ['localhost', true],
      ['127.0.0.1', true],
      ['192.168.49.2', true],
      ['192.168.1.1', true],
      ['10.0.0.5', true],
      ['172.16.0.1', true],
      ['172.20.10.5', true],
      ['172.31.255.254', true],
    ])('treats %s as development (private network)', (hostname, expectedDev) => {
      setHostname(hostname);
      expect(isDevelopment()).toBe(expectedDev);
      expect(isProduction()).toBe(!expectedDev);
    });

    test.each([
      ['example.com'],
      ['docs.example.com'],
      ['172.15.0.1'], // just outside the 172.16-31 private range
      ['172.32.0.1'], // just outside the 172.16-31 private range
      ['8.8.8.8'],
    ])('treats %s as production (public network)', (hostname) => {
      setHostname(hostname);
      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('getDocsBaseUrl', () => {
    test('returns window.EZ_CONFIG.docsUrl when set (Helm-injected path — phase 33 SC-05)', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'http://192.168.49.2:30800' });
      expect(getDocsBaseUrl()).toBe('http://192.168.49.2:30800');
    });

    test('strips trailing slashes from configured URL', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'https://docs.example.com/' });
      expect(getDocsBaseUrl()).toBe('https://docs.example.com');
    });

    test('strips multiple trailing slashes', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'https://docs.example.com///' });
      expect(getDocsBaseUrl()).toBe('https://docs.example.com');
    });

    test('falls back to NodePort heuristic in development when EZ_CONFIG absent', () => {
      setHostname('localhost');
      setEzConfig(undefined);
      expect(getDocsBaseUrl()).toBe('http://localhost:30800');
    });

    test('falls back to NodePort heuristic with custom dev hostname', () => {
      setHostname('192.168.49.2');
      setEzConfig(undefined);
      expect(getDocsBaseUrl()).toBe('http://192.168.49.2:30800');
    });

    test('falls back to /docs in production when EZ_CONFIG absent', () => {
      setHostname('docs.example.com');
      setEzConfig(undefined);
      expect(getDocsBaseUrl()).toBe('/docs');
    });

    test('ignores empty-string EZ_CONFIG.docsUrl and falls through', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: '' });
      expect(getDocsBaseUrl()).toBe('http://localhost:30800');
    });

    test('EZ_CONFIG with no docsUrl key falls through', () => {
      setHostname('localhost');
      setEzConfig({});
      expect(getDocsBaseUrl()).toBe('http://localhost:30800');
    });
  });

  describe('getDocsUrl', () => {
    beforeEach(() => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'http://192.168.49.2:30800' });
    });

    test('returns base URL when no path given', () => {
      expect(getDocsUrl()).toBe('http://192.168.49.2:30800');
    });

    test('appends path with single slash separator', () => {
      expect(getDocsUrl('user-guide-he')).toBe('http://192.168.49.2:30800/user-guide-he');
    });

    test('strips leading slash from path to avoid double slashes', () => {
      expect(getDocsUrl('/user-guide-he')).toBe('http://192.168.49.2:30800/user-guide-he');
    });

    test('preserves nested path segments', () => {
      expect(getDocsUrl('components/schema-editor')).toBe(
        'http://192.168.49.2:30800/components/schema-editor'
      );
    });
  });

  describe('getHebrewUserGuideUrl', () => {
    test('returns base + /user-guide-he', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'http://192.168.49.2:30800' });
      expect(getHebrewUserGuideUrl()).toBe('http://192.168.49.2:30800/user-guide-he');
    });
  });

  describe('getComponentDocsUrl', () => {
    test('returns base + /components/{component}', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'http://192.168.49.2:30800' });
      expect(getComponentDocsUrl('schema-editor')).toBe(
        'http://192.168.49.2:30800/components/schema-editor'
      );
    });
  });

  describe('openDocsInNewTab (phase 33 SC-09 security check)', () => {
    test('opens window.open with _blank target', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'http://192.168.49.2:30800' });
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      openDocsInNewTab();
      expect(openSpy).toHaveBeenCalledWith(
        'http://192.168.49.2:30800',
        '_blank',
        'noopener,noreferrer'
      );
    });

    test('opens correct URL when path provided', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'http://192.168.49.2:30800' });
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      openDocsInNewTab('user-guide-he');
      expect(openSpy).toHaveBeenCalledWith(
        'http://192.168.49.2:30800/user-guide-he',
        '_blank',
        'noopener,noreferrer'
      );
    });

    test('uses noopener,noreferrer (reverse-tabnabbing protection)', () => {
      setHostname('localhost');
      setEzConfig({ docsUrl: 'http://192.168.49.2:30800' });
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      openDocsInNewTab();
      const features = openSpy.mock.calls[0][2];
      expect(features).toContain('noopener');
      expect(features).toContain('noreferrer');
    });
  });
});

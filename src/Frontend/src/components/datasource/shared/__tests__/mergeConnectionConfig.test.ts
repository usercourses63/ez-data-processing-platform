import { describe, test, expect } from 'vitest';
import { mergeConnectionConfig } from '../helpers';

/**
 * Bug #2 (TASK B) regression tests: updating a datasource's schema must NOT wipe the stored
 * connection (input server) reference, even when the lazy Connection tab hasn't hydrated and the
 * form submits a missing or empty `inputServerId`.
 */
describe('mergeConnectionConfig', () => {
  const existing = {
    type: 'FTP',
    host: 'ftp.example.com',
    inputServerId: 'srv-123',
    nasDeviceId: 'nas-9',
    nasSubPath: 'inbound',
  };
  const dataSource = { FileServerId: 'srv-from-entity', NasDeviceId: 'nas-from-entity' };

  test('keeps the stored inputServerId when the form submits undefined (tab never mounted)', () => {
    const result = mergeConnectionConfig({}, existing, dataSource);
    expect(result.inputServerId).toBe('srv-123');
  });

  test('keeps the stored inputServerId when the form submits an empty string (tab not hydrated)', () => {
    const result = mergeConnectionConfig({ inputServerId: '' }, existing, dataSource);
    expect(result.inputServerId).toBe('srv-123');
  });

  test('falls back to the authoritative FileServerId when neither form nor stored config has it', () => {
    const result = mergeConnectionConfig({ inputServerId: '' }, {}, dataSource);
    expect(result.inputServerId).toBe('srv-from-entity');
  });

  test('honors a genuinely changed inputServerId from the form', () => {
    const result = mergeConnectionConfig({ inputServerId: 'srv-new' }, existing, dataSource);
    expect(result.inputServerId).toBe('srv-new');
  });

  test('applies the same protection to nasDeviceId', () => {
    expect(mergeConnectionConfig({ nasDeviceId: '' }, existing, dataSource).nasDeviceId).toBe('nas-9');
    expect(mergeConnectionConfig({ nasDeviceId: '' }, {}, dataSource).nasDeviceId).toBe('nas-from-entity');
    expect(mergeConnectionConfig({ nasDeviceId: 'nas-new' }, existing, dataSource).nasDeviceId).toBe('nas-new');
  });

  test('preserves other stored connection fields when the form omits them', () => {
    const result = mergeConnectionConfig({}, existing, dataSource);
    expect(result.type).toBe('FTP');
    expect(result.host).toBe('ftp.example.com');
    expect(result.nasSubPath).toBe('inbound');
  });

  test('defaults filePattern to *.* when absent everywhere', () => {
    expect(mergeConnectionConfig({}, {}, dataSource).filePattern).toBe('*.*');
  });

  test('does not throw when dataSource is undefined and yields undefined inputServerId', () => {
    const result = mergeConnectionConfig({ inputServerId: '' }, {});
    expect(result.inputServerId).toBeUndefined();
  });
});

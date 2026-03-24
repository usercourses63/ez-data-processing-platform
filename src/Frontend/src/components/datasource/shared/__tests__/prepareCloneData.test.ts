import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { prepareCloneData } from '../helpers';

// Mock crypto.randomUUID
const originalRandomUUID = crypto.randomUUID;
beforeEach(() => {
  let counter = 0;
  crypto.randomUUID = (() => `mock-uuid-${++counter}`) as any;
});
afterEach(() => {
  crypto.randomUUID = originalRandomUUID;
});

describe('prepareCloneData', () => {
  const minimalDataSource = {
    Name: 'Test DS',
    SupplierName: 'Supplier A',
    Category: 'Sales',
    FilePattern: '*.csv',
  };

  const fullDataSource = {
    ...minimalDataSource,
    Description: 'Test description',
    JsonSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    ArchiveSettings: { IsArchiveSource: true, ArchiveType: 'zip', ArchivePassword: 'secret' },
    Output: {
      DefaultOutputFormat: 'json',
      IncludeInvalidRecords: true,
      Destinations: [
        { Id: 'dest-1', Name: 'Kafka Out', Type: 'kafka', Enabled: true },
        { Id: 'dest-2', Name: 'FTP Out', Type: 'ftp', Enabled: false },
      ],
    },
    AdditionalConfiguration: {
      RetentionDays: 60,
    },
  };

  const parsedConfig = {
    connectionConfig: { type: 'FTP', host: 'ftp.example.com', port: 21, inputServerId: 'srv-1' },
    fileConfig: { type: 'CSV', delimiter: ';', hasHeaders: true, encoding: 'UTF-8' },
    validationRules: { skipInvalidRecords: true, maxErrorsAllowed: 50 },
    notificationSettings: { onSuccess: true, onFailure: true, recipients: ['a@b.com'] },
  };

  test('prefixes name with Hebrew prefix when language is he', () => {
    const result = prepareCloneData(minimalDataSource, null, 'he');
    expect(result.name).toMatch(/^העתק של Test DS \(/);
  });

  test('prefixes name with English prefix when language is en', () => {
    const result = prepareCloneData(minimalDataSource, null, 'en');
    expect(result.name).toMatch(/^Copy of Test DS \(/);
  });

  test('generates unique suffix for each call', () => {
    // Restore real randomUUID for this test
    crypto.randomUUID = originalRandomUUID;
    const result1 = prepareCloneData(minimalDataSource, null, 'en');
    const result2 = prepareCloneData(minimalDataSource, null, 'en');
    expect(result1.name).not.toBe(result2.name);
  });

  test('does not include schedule fields (schedule is disabled)', () => {
    const result = prepareCloneData(fullDataSource, parsedConfig, 'en');
    // ClonePayload should not carry schedule — form sets scheduleEnabled: false separately
    expect((result as any).scheduleFrequency).toBeUndefined();
    expect((result as any).scheduleEnabled).toBeUndefined();
  });

  test('regenerates UUIDs for output destinations', () => {
    const result = prepareCloneData(fullDataSource, null, 'en');
    expect(result.outputConfig?.destinations).toHaveLength(2);
    expect(result.outputConfig?.destinations?.[0].id).toBe('mock-uuid-1');
    expect(result.outputConfig?.destinations?.[1].id).toBe('mock-uuid-2');
    // Original IDs should NOT be present
    expect(result.outputConfig?.destinations?.[0].id).not.toBe('dest-1');
  });

  test('carries over connection config from parsedConfig', () => {
    const result = prepareCloneData(fullDataSource, parsedConfig, 'en');
    expect(result.connectionConfig?.type).toBe('FTP');
    expect(result.connectionConfig?.host).toBe('ftp.example.com');
    expect(result.connectionConfig?.inputServerId).toBe('srv-1');
  });

  test('carries over file config from parsedConfig', () => {
    const result = prepareCloneData(fullDataSource, parsedConfig, 'en');
    expect(result.fileConfig?.type).toBe('CSV');
    expect(result.fileConfig?.delimiter).toBe(';');
    expect(result.fileConfig?.hasHeaders).toBe(true);
  });

  test('carries over validation rules', () => {
    const result = prepareCloneData(fullDataSource, parsedConfig, 'en');
    expect(result.validationRules?.skipInvalidRecords).toBe(true);
    expect(result.validationRules?.maxErrorsAllowed).toBe(50);
  });

  test('carries over notification settings including recipients', () => {
    const result = prepareCloneData(fullDataSource, parsedConfig, 'en');
    expect(result.notificationSettings?.onSuccess).toBe(true);
    expect(result.notificationSettings?.recipients).toEqual(['a@b.com']);
  });

  test('carries over JSON schema', () => {
    const result = prepareCloneData(fullDataSource, null, 'en');
    expect(result.jsonSchema).toEqual(fullDataSource.JsonSchema);
  });

  test('carries over archive settings', () => {
    const result = prepareCloneData(fullDataSource, null, 'en');
    expect(result.archiveSettings).toEqual(fullDataSource.ArchiveSettings);
  });

  test('carries over retention days', () => {
    const result = prepareCloneData(fullDataSource, null, 'en');
    expect(result.retentionDays).toBe(60);
  });

  test('sets isActive to true', () => {
    const result = prepareCloneData(minimalDataSource, null, 'en');
    expect(result.isActive).toBe(true);
  });

  test('handles minimal datasource without crash', () => {
    const result = prepareCloneData({ Name: 'X' }, null, 'en');
    expect(result.name).toMatch(/^Copy of X/);
    expect(result.supplierName).toBe('');
    expect(result.category).toBe('');
    expect(result.filePattern).toBe('*.*');
    expect(result.retentionDays).toBe(30);
  });

  test('handles PascalCase API response for destinations', () => {
    const result = prepareCloneData(fullDataSource, null, 'en');
    // Destinations should be mapped from PascalCase to camelCase
    expect(result.outputConfig?.destinations?.[0].name).toBe('Kafka Out');
    expect(result.outputConfig?.destinations?.[0].type).toBe('kafka');
    expect(result.outputConfig?.destinations?.[1].enabled).toBe(false);
  });
});

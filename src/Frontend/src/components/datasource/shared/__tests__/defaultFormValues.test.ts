import { describe, test, expect } from 'vitest';
import { DEFAULT_FORM_VALUES } from '../constants';

/**
 * Regression guard: a new datasource's default protocol must be one the Connection tab can
 * actually use — i.e. an option offered in its dropdown AND present in its protocolToServerType
 * map. The default was 'NFS', which is neither, so every fresh create form opened in a
 * "no servers available / can't allocate input" dead-end. Keep the default within this set.
 */
const VALID_PROTOCOLS = ['FTP', 'SFTP', 'HTTP', 'Kafka', 'S3', 'NAS'];

describe('DEFAULT_FORM_VALUES.connectionType', () => {
  test('is a selectable, server-mappable protocol (must not regress to "NFS")', () => {
    expect(VALID_PROTOCOLS).toContain(DEFAULT_FORM_VALUES.connectionType);
  });
});

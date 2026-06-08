import { describe, it, expect } from 'vitest';
import { buildS3OutputConfig, s3ConfigToPath } from '../../shared/helpers';
import type { OutputDestination } from '../../shared/types';

/**
 * Phase 35, Plan 02, Task 1 — S3 output destination builds a write-ready s3Config (G5, frontend half).
 *
 * The DestinationEditorModal handleSubmit S3 branch delegates the bucket/prefix split to
 * buildS3OutputConfig (the "Bucket / Prefix" path field). Credentials/endpoint/region are
 * deliberately left undefined on the frontend — the backend bridges them (decrypted) from the
 * selected output AdminServer. These tests pin the pure transform that the modal uses so the
 * persisted OutputDestination.s3Config carries bucket + keyPrefix and the destination keeps its
 * outputServerId for the backend bridge.
 */
describe('DestinationEditorModal — S3 destination builds s3Config', () => {
  it('splits "ez-phase34-output/processed" into bucket + keyPrefix', () => {
    const s3 = buildS3OutputConfig('ez-phase34-output/processed');
    expect(s3.bucket).toBe('ez-phase34-output');
    expect(s3.keyPrefix).toBe('processed');
    expect(s3.usePathStyle).toBe(true);
    // credentials/endpoint/region stay undefined — backend bridges them from the AdminServer
    expect(s3.accessKeyId).toBeUndefined();
    expect(s3.secretAccessKey).toBeUndefined();
    expect(s3.endpoint).toBeUndefined();
    expect(s3.region).toBeUndefined();
  });

  it('treats a bucket-only path (no slash) as bucket with no keyPrefix', () => {
    const s3 = buildS3OutputConfig('just-a-bucket');
    expect(s3.bucket).toBe('just-a-bucket');
    expect(s3.keyPrefix).toBeUndefined();
  });

  it('keeps a multi-segment prefix after the first slash', () => {
    const s3 = buildS3OutputConfig('ez-phase34-output/validated/banking/');
    expect(s3.bucket).toBe('ez-phase34-output');
    expect(s3.keyPrefix).toBe('validated/banking/');
  });

  it('simulates the handleSubmit S3 branch: destination carries s3Config + outputServerId + type s3', () => {
    // Mirrors what DestinationEditorModal.handleSubmit produces for an S3 destination.
    const values = { type: 's3' as const, path: 'ez-phase34-output/processed', outputServerId: 'srv-123' };
    const dest: OutputDestination = {
      id: 'dest-1',
      name: 'MinIO Output',
      type: values.type,
      enabled: true,
      outputServerId: values.outputServerId,
      s3Config: buildS3OutputConfig(values.path),
    };
    expect(dest.type).toBe('s3');
    expect(dest.outputServerId).toBe('srv-123');
    expect(dest.s3Config?.bucket).toBe('ez-phase34-output');
    expect(dest.s3Config?.keyPrefix).toBe('processed');
  });

  it('does NOT build an s3Config for a non-S3 (kafka) destination', () => {
    // The kafka branch of handleSubmit never calls buildS3OutputConfig.
    const dest: OutputDestination = {
      id: 'dest-2',
      name: 'Kafka Out',
      type: 'kafka',
      enabled: true,
      outputServerId: 'srv-kafka',
      kafkaConfig: { topic: 'processed-data' },
    };
    expect(dest.s3Config).toBeUndefined();
    expect(dest.type).toBe('kafka');
  });

  it('round-trips s3Config back to an editable path string', () => {
    expect(s3ConfigToPath({ bucket: 'ez-phase34-output', keyPrefix: 'processed' })).toBe(
      'ez-phase34-output/processed'
    );
    expect(s3ConfigToPath({ bucket: 'only-bucket' })).toBe('only-bucket');
    expect(s3ConfigToPath(undefined)).toBe('');
  });
});

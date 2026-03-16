/**
 * Global setup for protocol test suite.
 *
 * Pre-flight connectivity checks:
 * 1. File-simulator health (cross-cluster Hyper-V)
 * 2. EZ API health (local cluster port-forward)
 * 3. File-operations endpoint availability
 * 4. Simulator server discovery summary
 * 5. S3/MinIO bucket creation (ensure test-bucket exists)
 *
 * Also cleans up any stale persisted results from previous runs.
 */
import { request } from '@playwright/test';
import { MatrixReporter } from '../helpers/report-generator';
import * as crypto from 'crypto';

async function globalSetup() {
  // Only run pre-flight checks when protocol tests are selected.
  // Detected via PROTOCOL_TESTS env var or --project=protocols in CLI args.
  const isProtocolRun =
    process.env.PROTOCOL_TESTS === 'true' ||
    process.argv.some((arg) => arg.includes('protocols'));
  if (!isProtocolRun) {
    return;
  }

  const SIMULATOR_BASE = process.env.FILE_SIMULATOR_URL || 'http://file-simulator.local:30500';
  const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';

  // Clean up stale persisted results from previous runs
  MatrixReporter.cleanPersistedResults();
  console.log('[Global Setup] Cleaned stale persisted result fragments');

  const ctx = await request.newContext();

  // Check file-simulator health
  console.log(`[Global Setup] Checking file-simulator at ${SIMULATOR_BASE}...`);
  const simHealth = await ctx.get(`${SIMULATOR_BASE}/health`).catch(() => null);
  if (!simHealth || !simHealth.ok()) {
    throw new Error(
      `FATAL: File-simulator unavailable at ${SIMULATOR_BASE}. Protocol tests require file-simulator.`
    );
  }
  console.log('[Global Setup] File-simulator: HEALTHY');

  // Check EZ API health
  console.log(`[Global Setup] Checking EZ API at ${EZ_API_BASE}...`);
  const ezHealth = await ctx.get(`${EZ_API_BASE}/health`).catch(() => null);
  if (!ezHealth || !ezHealth.ok()) {
    throw new Error(
      `FATAL: EZ API unavailable at ${EZ_API_BASE}. Protocol tests require EZ backend.`
    );
  }
  console.log('[Global Setup] EZ API: HEALTHY');

  // Check file-operations endpoint exists (from Plan 01)
  console.log('[Global Setup] Verifying file-operations endpoint...');
  const fileOpsCheck = await ctx
    .post(`${EZ_API_BASE}/api/v1/file-operations/nonexistent/list`, {
      data: { Pattern: '*' },
    })
    .catch(() => null);
  // Expect 404 (server not found) not 405 (route not found)
  if (fileOpsCheck && fileOpsCheck.status() === 405) {
    throw new Error(
      'FATAL: File-operations endpoint not deployed. Rebuild DataSourceManagementService.'
    );
  }
  console.log('[Global Setup] File-operations endpoint: AVAILABLE');

  // Discover simulator servers for test summary
  const serversResp = await ctx.get(`${SIMULATOR_BASE}/api/servers`);
  const servers = await serversResp.json();
  const protocols = [...new Set(servers.map((s: any) => s.protocol))];
  console.log(`[Global Setup] Simulator protocols available: ${protocols.join(', ')}`);
  console.log(`[Global Setup] Total simulator servers: ${servers.length}`);

  // Ensure S3/MinIO test-bucket exists
  const S3_HOST = 'file-simulator.local';
  const S3_PORT = 30900;
  const S3_ACCESS_KEY = 'minioadmin';
  const S3_SECRET_KEY = 'minioadmin123';
  const S3_BUCKET = 'test-bucket';

  try {
    console.log(`[Global Setup] Ensuring S3 bucket '${S3_BUCKET}' exists on MinIO...`);
    await ensureS3Bucket(S3_HOST, S3_PORT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET);
    console.log(`[Global Setup] S3 bucket '${S3_BUCKET}': READY`);
  } catch (err) {
    console.warn(`[Global Setup] S3 bucket creation failed (non-fatal): ${err}`);
  }

  await ctx.dispose();

  console.log('[Global Setup] All pre-flight checks passed. Starting protocol tests...');
}

/**
 * Ensure an S3 bucket exists on MinIO using AWS Signature V4.
 * Sends a HEAD request first; if 404, creates via PUT.
 */
async function ensureS3Bucket(
  host: string,
  port: number,
  accessKey: string,
  secretKey: string,
  bucket: string
): Promise<void> {
  const endpoint = `http://${host}:${port}`;

  // Check if bucket exists (HEAD /{bucket})
  const headResult = await s3Request('HEAD', endpoint, `/${bucket}`, accessKey, secretKey);
  if (headResult === 200) {
    console.log(`[Global Setup] S3 bucket '${bucket}' already exists`);
    return;
  }

  // Create bucket (PUT /{bucket})
  const putResult = await s3Request('PUT', endpoint, `/${bucket}`, accessKey, secretKey);
  if (putResult !== 200) {
    throw new Error(`Failed to create bucket: HTTP ${putResult}`);
  }
}

/**
 * Make an AWS Signature V4 signed request to S3/MinIO.
 * Returns the HTTP status code.
 */
function s3Request(
  method: string,
  endpoint: string,
  path: string,
  accessKey: string,
  secretKey: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, endpoint);
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dateOnly = dateStamp.substring(0, 8);
    const region = 'us-east-1';
    const service = 's3';
    const credentialScope = `${dateOnly}/${region}/${service}/aws4_request`;

    const payloadHash = crypto.createHash('sha256').update('').digest('hex');

    const canonicalHeaders =
      `host:${url.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${dateStamp}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      method,
      url.pathname,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStamp,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = getSignatureKey(secretKey, dateOnly, region, service);
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const http = require('http');
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
          Host: url.host,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': dateStamp,
          Authorization: authorization,
        },
        timeout: 10000,
      },
      (res: any) => resolve(res.statusCode)
    );
    req.on('error', reject);
    req.end();
  });
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

export default globalSetup;

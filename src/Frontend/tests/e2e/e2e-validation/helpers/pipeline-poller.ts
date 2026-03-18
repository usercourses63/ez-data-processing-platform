/**
 * Pipeline completion polling utility for E2E validation tests.
 * Polls output destinations to detect when pipeline processing completes,
 * and provides CSV parsing + field-level comparison utilities.
 */
import { APIRequestContext } from '@playwright/test';
import { listFiles, readFile, DiscoveredFile } from '../../helpers/ez-api-client';

/**
 * Poll an output server until the expected number of files appear.
 * Throws on timeout.
 */
export async function waitForPipelineOutput(
  request: APIRequestContext,
  outputServerId: string,
  expectedFileCount: number,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 3000
): Promise<DiscoveredFile[]> {
  const startTime = Date.now();
  let lastFiles: DiscoveredFile[] = [];
  while (Date.now() - startTime < timeoutMs) {
    try {
      lastFiles = await listFiles(request, outputServerId);
      if (lastFiles.length >= expectedFileCount) {
        return lastFiles;
      }
    } catch (err) {
      console.log(`[pipeline-poller] List files error (retrying): ${err}`);
    }
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
  throw new Error(
    `Pipeline output timeout after ${timeoutMs}ms: expected ${expectedFileCount} files, got ${lastFiles.length}`
  );
}

/**
 * Parse CSV content into an array of records (header-keyed objects).
 * Handles quoted fields with simple stripping of surrounding quotes.
 */
export function parseCsvContent(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = values[i] || ''; });
    return record;
  });
}

/**
 * Compare output file content against expected record count and field samples.
 * Returns a pass/fail result with details.
 */
export async function compareOutputWithInput(
  request: APIRequestContext,
  outputServerId: string,
  outputFilePath: string,
  expectedRecordCount: number,
  sampleFields: string[],
  expectedSamples: Record<string, string>[]
): Promise<{ passed: boolean; details: string }> {
  const content = await readFile(request, outputServerId, outputFilePath);
  const records = parseCsvContent(content.toString('utf-8'));

  if (records.length !== expectedRecordCount) {
    return { passed: false, details: `Record count mismatch: expected ${expectedRecordCount}, got ${records.length}` };
  }

  for (let i = 0; i < Math.min(expectedSamples.length, records.length); i++) {
    for (const field of sampleFields) {
      if (records[i]?.[field] !== expectedSamples[i]?.[field]) {
        return { passed: false, details: `Field mismatch at record ${i}, field ${field}: expected '${expectedSamples[i]?.[field]}', got '${records[i]?.[field]}'` };
      }
    }
  }

  return { passed: true, details: `${records.length} records verified, ${sampleFields.length} fields sampled across ${expectedSamples.length} records` };
}

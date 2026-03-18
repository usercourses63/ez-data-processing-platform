/**
 * Pipeline status poller — waits for a datasource pipeline to complete processing.
 * Uses the dashboard API to check processing status.
 *
 * Usage:
 *   import { waitForPipelineActivity } from '../support/helpers/pipeline-poller';
 *   await waitForPipelineActivity(request, datasourceId, { timeoutMs: 60000 });
 */
import { APIRequestContext } from '@playwright/test';
import { EZ_API_BASE } from '../../helpers/ez-api-client';

interface PipelineWaitOptions {
  /** Max time to wait in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Poll interval in milliseconds (default: 2000) */
  pollIntervalMs?: number;
  /** Minimum number of processed files to consider complete (default: 1) */
  minFilesProcessed?: number;
}

interface DashboardStats {
  totalFilesProcessed?: number;
  totalRecordsProcessed?: number;
  totalInvalidRecords?: number;
  lastProcessedAt?: string;
}

/**
 * Wait for pipeline activity on a datasource.
 * Polls the dashboard/metrics API until files are processed or timeout.
 */
export async function waitForPipelineActivity(
  request: APIRequestContext,
  datasourceId: string,
  options: PipelineWaitOptions = {}
): Promise<DashboardStats> {
  const {
    timeoutMs = 60000,
    pollIntervalMs = 2000,
    minFilesProcessed = 1,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Try dashboard API for datasource stats
      const response = await request.get(
        `${EZ_API_BASE}/api/v1/dashboard/datasource/${datasourceId}/stats`
      );

      if (response.ok()) {
        const stats: DashboardStats = await response.json();
        if (
          stats.totalFilesProcessed !== undefined &&
          stats.totalFilesProcessed >= minFilesProcessed
        ) {
          return stats;
        }
      }
    } catch {
      // API may not be available yet, continue polling
    }

    // Also check invalid records as a signal of pipeline completion
    try {
      const invalidResponse = await request.get(
        `${EZ_API_BASE}/api/v1/invalidrecords?dataSourceId=${datasourceId}&pageSize=1`
      );

      if (invalidResponse.ok()) {
        const invalidData = await invalidResponse.json();
        // If we find invalid records, pipeline has processed something
        if (Array.isArray(invalidData) && invalidData.length > 0) {
          return { totalInvalidRecords: invalidData.length };
        }
      }
    } catch {
      // continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Pipeline did not complete for datasource ${datasourceId} within ${timeoutMs}ms`
  );
}

/**
 * Trigger immediate polling for a datasource by calling the scheduling API.
 */
export async function triggerImmediatePoll(
  request: APIRequestContext,
  datasourceId: string
): Promise<void> {
  const response = await request.post(
    `${EZ_API_BASE}/api/v1/scheduling/trigger/${datasourceId}`
  );

  if (!response.ok()) {
    // Fallback: some versions use different endpoint
    const fallback = await request.post(
      `${EZ_API_BASE}/api/v1/datasources/${datasourceId}/trigger-poll`
    );
    if (!fallback.ok()) {
      console.warn(
        `[pipeline-poller] Failed to trigger immediate poll for ${datasourceId}: ${response.status()}`
      );
    }
  }
}

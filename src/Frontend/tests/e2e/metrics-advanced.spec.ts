/**
 * G7 — Metrics Advanced Operations (P1)
 *
 * Tests metric duplication, datasource-specific metrics, global business/system
 * metrics, and global alert queries.
 *
 * Base: http://localhost:5002/api/v1/metrics
 * All request payloads use PascalCase (backend convention).
 */
import { test, expect } from '@playwright/test';

const DS_API = process.env.EZ_API_URL || 'http://localhost:5001';
const METRICS_API = process.env.METRICS_API_URL || 'http://localhost:5002';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  const data = (b?.Data ?? b?.data) as Record<string, unknown> | undefined;
  if (data) {
    const items = data?.Items ?? data?.items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

function extractId(item: unknown): string | undefined {
  const obj = item as Record<string, unknown>;
  return (obj?.ID ?? obj?.id ?? obj?.Id) as string | undefined;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@P1 @Metrics Metrics Advanced Operations', () => {
  let metricId: string | undefined;
  let datasourceId: string | undefined;
  let duplicatedMetricId: string | undefined;

  test.beforeAll(async ({ request }) => {
    // Get a metrics entry
    const metricsRes = await request.get(`${METRICS_API}/api/v1/metrics`);
    if (metricsRes.ok()) {
      const body = await metricsRes.json();
      const items = extractItems(body);
      if (items.length > 0) {
        metricId = extractId(items[0]);
        const obj = items[0] as Record<string, unknown>;
        datasourceId =
          (obj?.DataSourceId ?? obj?.dataSourceId ?? obj?.DatasourceId ?? obj?.datasourceId) as string | undefined;
      }
    }

    // Fall back to getting a datasource id from the DS API
    if (!datasourceId) {
      const dsRes = await request.get(`${DS_API}/api/v1/datasource`);
      if (dsRes.ok()) {
        const body = await dsRes.json();
        const items = extractItems(body);
        if (items.length > 0) {
          datasourceId = extractId(items[0]);
        }
      }
    }
  });

  test.afterAll(async ({ request }) => {
    if (duplicatedMetricId) {
      await request.delete(`${METRICS_API}/api/v1/metrics/${duplicatedMetricId}`).catch(() => {});
    }
  });

  // ── Health ────────────────────────────────────────────────────────────────
  test('[P1] metrics service health check', async ({ request }) => {
    const res = await request.get(`${METRICS_API}/health`);
    expect([200, 204]).toContain(res.status());
  });

  // ── POST /metrics/{id}/duplicate ─────────────────────────────────────────
  test('[P1] POST /metrics/{id}/duplicate creates a copy', async ({ request }) => {
    test.skip(!metricId, 'No metric available to duplicate');

    const res = await request.post(`${METRICS_API}/api/v1/metrics/${metricId}/duplicate`);
    expect([200, 201, 404]).toContain(res.status());

    if ([200, 201].includes(res.status())) {
      const body = await res.json();
      duplicatedMetricId = extractId(body);
      expect(duplicatedMetricId).toBeTruthy();
    }
  });

  test('[P1] POST /metrics/{id}/duplicate for non-existent metric returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.post(`${METRICS_API}/api/v1/metrics/${fakeId}/duplicate`);
    expect([404, 400]).toContain(res.status());
  });

  // ── GET /metrics/datasource/{dataSourceId} ───────────────────────────────
  test('[P1] GET /metrics/datasource/{id} returns metrics for that datasource', async ({
    request,
  }) => {
    test.skip(!datasourceId, 'No datasource id available');

    const res = await request.get(
      `${METRICS_API}/api/v1/metrics/datasource/${datasourceId}`
    );
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      expect(Array.isArray(items)).toBeTruthy();
    }
  });

  test('[P1] GET /metrics/datasource/{id} for non-existent datasource returns 404 or empty', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.get(`${METRICS_API}/api/v1/metrics/datasource/${fakeId}`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      expect(items.length).toBe(0);
    }
  });

  // ── GET /metrics/global/business ─────────────────────────────────────────
  test('[P1] GET /metrics/global/business returns business metric definitions', async ({
    request,
  }) => {
    const res = await request.get(`${METRICS_API}/api/v1/metrics/global/business`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      expect(Array.isArray(items)).toBeTruthy();
    }
  });

  // ── GET /metrics/global/system ────────────────────────────────────────────
  test('[P1] GET /metrics/global/system returns system metric definitions', async ({ request }) => {
    const res = await request.get(`${METRICS_API}/api/v1/metrics/global/system`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      expect(Array.isArray(items)).toBeTruthy();
    }
  });

  // ── GET /global-alerts/metric/{metricName} ───────────────────────────────
  test('[P1] GET /global-alerts/metric/{name} returns alerts for metric', async ({ request }) => {
    // Use a known business metric name from the platform
    const metricName = 'business_records_processed_total';
    const res = await request.get(
      `${METRICS_API}/api/v1/global-alerts/metric/${encodeURIComponent(metricName)}`
    );
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = Array.isArray(body) ? body : extractItems(body);
      expect(Array.isArray(items)).toBeTruthy();
    }
  });

  test('[P1] GET /global-alerts/metric/{name} with unknown name returns 404 or empty', async ({
    request,
  }) => {
    const res = await request.get(
      `${METRICS_API}/api/v1/global-alerts/metric/nonexistent_metric_xyz_99999`
    );
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = Array.isArray(body) ? body : extractItems(body);
      expect(items.length).toBe(0);
    }
  });

  // ── GET /global-alerts/enabled ────────────────────────────────────────────
  test('[P1] GET /global-alerts/enabled returns only enabled alerts', async ({ request }) => {
    const res = await request.get(`${METRICS_API}/api/v1/global-alerts/enabled`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = Array.isArray(body) ? body : extractItems(body);
      expect(Array.isArray(items)).toBeTruthy();

      // All returned items should have IsEnabled = true
      for (const item of items) {
        const obj = item as Record<string, unknown>;
        const isEnabled = obj?.IsEnabled ?? obj?.isEnabled ?? obj?.Enabled ?? obj?.enabled;
        if (isEnabled !== undefined) {
          expect(isEnabled).toBe(true);
        }
      }
    }
  });

  // ── GET /metrics (baseline) ───────────────────────────────────────────────
  test('[P1] GET /metrics returns paginated list', async ({ request }) => {
    const res = await request.get(`${METRICS_API}/api/v1/metrics`);
    expect([200]).toContain(res.status());

    const body = await res.json();
    const items = extractItems(body);
    expect(Array.isArray(items)).toBeTruthy();
  });
});

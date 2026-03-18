/**
 * G1 — Scheduling API Tests (P0)
 *
 * Tests the full scheduling lifecycle for data sources:
 * create schedule → status → pause → resume → trigger → update → delete
 *
 * Base: http://localhost:5004/api/v1/scheduling
 * Requires: a data source to exist in DataSourceManagement (port 5001).
 *
 * All request payloads use PascalCase (backend convention).
 */
import { test, expect } from './support';
import { extractItems, extractId } from './helpers/api-utils';

const DS_API = process.env.EZ_API_URL || 'http://localhost:5001';
const SCHEDULING_API = process.env.SCHEDULING_API_URL || 'http://localhost:5004';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@P0 @Scheduling Scheduling API — lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  let datasourceId: string | undefined;
  let datasourceName: string | undefined;
  let supplierName: string | undefined;

  // ── Setup: resolve a datasource id, name, and supplier ──────────────────
  test.beforeAll(async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/datasource`);
    if (res.ok()) {
      const body = await res.json();
      const items = extractItems(body);
      if (items.length > 0) {
        const item = items[0] as Record<string, unknown>;
        datasourceId = extractId(item);
        datasourceName = (item.Name ?? item.name) as string | undefined;
        supplierName = (item.SupplierName ?? item.supplierName) as string | undefined;
        // Clean up any pre-existing schedule to start fresh
        if (datasourceId) {
          await request.delete(
            `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/schedule`
          ).catch(() => null);
        }
      }
    }
    if (!datasourceId) {
      console.warn('[scheduling-api] No datasource found — most tests will be skipped');
    }
  });

  // ── Health / connectivity ────────────────────────────────────────────────
  test('[P0] scheduling service health check', async ({ request }) => {
    const res = await request.get(`${SCHEDULING_API}/health`);
    // Accept 200 or common health variants
    expect([200, 204]).toContain(res.status());
  });

  // ── Create schedule ──────────────────────────────────────────────────────
  test('[P0] create schedule for datasource', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    const res = await request.post(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/schedule`,
      {
        data: {
          dataSourceName: datasourceName,
          supplierName: supplierName,
          pollingInterval: '00:05:00',
        },
      }
    );
    // 200 = created/updated, 201 = created, 409 = already exists (also acceptable)
    expect([200, 201, 409]).toContain(res.status());

    if (res.status() !== 409) {
      const body = await res.json();
      const bodyStr = JSON.stringify(body).toLowerCase();
      expect(bodyStr).toMatch(/datasource|schedule|polling/i);
    }
  });

  // ── GET status ──────────────────────────────────────────────────────────
  test('[P0] get schedule status for datasource', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    const res = await request.get(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/status`
    );
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const b = (body?.status ?? body?.schedule ?? body) as Record<string, unknown>;
      // Must contain some scheduling state info
      expect(
        b.isActive !== undefined ||
        b.isPaused !== undefined ||
        b.pollingInterval !== undefined ||
        b.dataSourceId !== undefined
      ).toBeTruthy();
    }
  });

  // ── Pause ───────────────────────────────────────────────────────────────
  test('[P0] pause schedule for datasource', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    const res = await request.post(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/pause`
    );
    expect([200, 204, 404]).toContain(res.status());
  });

  // ── Resume ──────────────────────────────────────────────────────────────
  test('[P0] resume schedule for datasource', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    const res = await request.post(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/resume`
    );
    expect([200, 204, 404]).toContain(res.status());
  });

  // ── Manual trigger ───────────────────────────────────────────────────────
  test('[P0] manually trigger datasource poll', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    const res = await request.post(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/trigger`
    );
    expect([200, 202, 204, 404]).toContain(res.status());
  });

  // ── Update schedule ──────────────────────────────────────────────────────
  test('[P0] update schedule polling rate', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    const res = await request.put(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/schedule`,
      {
        data: {
          newPollingInterval: '00:10:00',
        },
      }
    );
    expect([200, 204, 404]).toContain(res.status());
  });

  // ── Delete schedule ──────────────────────────────────────────────────────
  test('[P0] delete schedule for datasource', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    const res = await request.delete(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/schedule`
    );
    expect([200, 204, 404]).toContain(res.status());
  });

  // ── Error scenarios ──────────────────────────────────────────────────────
  test('[P0] get status for non-existent datasource returns 404', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.get(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${fakeId}/status`
    );
    expect([404, 400]).toContain(res.status());
  });

  test('[P0] create schedule with invalid payload returns 400', async ({ request }) => {
    test.skip(!datasourceId, 'No datasource available');

    // Send a non-TimeSpan value for pollingInterval to trigger schema validation error
    const res = await request.post(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${datasourceId}/schedule`,
      {
        data: {
          dataSourceName: datasourceName,
          supplierName: supplierName,
          pollingInterval: 'not-a-valid-timespan',
        },
      }
    );
    expect([400, 422]).toContain(res.status());
  });

  test('[P0] pause non-existent datasource returns 404 or 200', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request.post(
      `${SCHEDULING_API}/api/v1/scheduling/datasources/${fakeId}/pause`
    );
    // API may return 404 (not found) or 200 (idempotent no-op)
    expect([200, 404, 400]).toContain(res.status());
  });
});

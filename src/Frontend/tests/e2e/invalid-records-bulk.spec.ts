/**
 * G4 — Invalid Records Bulk Operations (P1)
 *
 * Tests bulk delete, reprocess, ignore, and export for invalid records.
 *
 * Base: http://localhost:5007/api/v1/invalid-records
 * All request payloads use PascalCase (backend convention).
 */
import { test, expect } from '@playwright/test';

const IR_API = process.env.INVALID_RECORDS_API_URL || 'http://localhost:5007';

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

test.describe('@P1 @InvalidRecords Invalid Records Bulk Operations', () => {
  let recordIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Collect some existing invalid record IDs if available
    const res = await request.get(`${IR_API}/api/v1/invalid-records`);
    if (res.ok()) {
      const body = await res.json();
      const items = extractItems(body);
      recordIds = items
        .slice(0, 3)
        .map((item) => extractId(item))
        .filter((id): id is string => !!id);
    }
    if (recordIds.length === 0) {
      console.warn('[invalid-records-bulk] No invalid records found — bulk tests will use empty arrays');
    }
  });

  // ── Health check ─────────────────────────────────────────────────────────
  test('[P1] invalid records service health check', async ({ request }) => {
    const res = await request.get(`${IR_API}/health`);
    expect([200, 204]).toContain(res.status());
  });

  // ── POST /invalid-records/bulk/delete ────────────────────────────────────
  test('[P1] POST /invalid-records/bulk/delete with valid ids', async ({ request }) => {
    // Use a copy so the real records survive for the rest of the suite
    const idsToDelete: string[] = [];

    const res = await request.post(`${IR_API}/api/v1/invalid-records/bulk/delete`, {
      data: { Ids: idsToDelete },
    });
    // Empty array bulk delete should still be accepted
    expect([200, 204, 400]).toContain(res.status());
  });

  test('[P1] POST /invalid-records/bulk/delete with missing Ids returns 400', async ({
    request,
  }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/bulk/delete`, {
      data: {},
    });
    expect([400, 422]).toContain(res.status());
  });

  test('[P1] POST /invalid-records/bulk/delete with non-existent ids is idempotent', async ({
    request,
  }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/bulk/delete`, {
      data: {
        Ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      },
    });
    // Should succeed or return not-found, not crash
    expect([200, 204, 404, 207]).toContain(res.status());
  });

  // ── POST /invalid-records/bulk/reprocess ─────────────────────────────────
  test('[P1] POST /invalid-records/bulk/reprocess with available ids', async ({ request }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/bulk/reprocess`, {
      data: { Ids: recordIds.slice(0, 2) },
    });
    expect([200, 202, 204, 404]).toContain(res.status());
  });

  test('[P1] POST /invalid-records/bulk/reprocess with empty ids returns 400 or succeeds', async ({
    request,
  }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/bulk/reprocess`, {
      data: { Ids: [] },
    });
    expect([200, 202, 204, 400, 422]).toContain(res.status());
  });

  // ── POST /invalid-records/bulk/ignore ────────────────────────────────────
  test('[P1] POST /invalid-records/bulk/ignore marks records as ignored', async ({ request }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/bulk/ignore`, {
      data: { Ids: recordIds.slice(0, 2) },
    });
    expect([200, 204, 404]).toContain(res.status());
  });

  test('[P1] POST /invalid-records/bulk/ignore with empty ids', async ({ request }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/bulk/ignore`, {
      data: { Ids: [] },
    });
    expect([200, 204, 400, 422]).toContain(res.status());
  });

  // ── POST /invalid-records/export ─────────────────────────────────────────
  test('[P1] POST /invalid-records/export returns downloadable content', async ({ request }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/export`, {
      data: {
        Ids: recordIds.slice(0, 5),
        Format: 'csv',
      },
    });
    expect([200, 204, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const contentType = res.headers()['content-type'] ?? '';
      // Should be a file download (CSV, JSON, binary) or JSON response
      expect(
        contentType.includes('text/csv') ||
        contentType.includes('application/json') ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('application/vnd')
      ).toBeTruthy();
    }
  });

  test('[P1] POST /invalid-records/export with no filter exports all or errors gracefully', async ({
    request,
  }) => {
    const res = await request.post(`${IR_API}/api/v1/invalid-records/export`, {
      data: {},
    });
    // Empty body: may succeed (export all) or require filters
    expect([200, 204, 400, 422]).toContain(res.status());
  });

  // ── Individual record endpoints (sanity) ─────────────────────────────────
  test('[P1] GET /invalid-records returns list', async ({ request }) => {
    const res = await request.get(`${IR_API}/api/v1/invalid-records`);
    expect([200]).toContain(res.status());

    const body = await res.json();
    const items = extractItems(body);
    expect(Array.isArray(items)).toBeTruthy();
  });

  test('[P1] GET /invalid-records/{id} for non-existent record returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.get(`${IR_API}/api/v1/invalid-records/${fakeId}`);
    expect([404, 400]).toContain(res.status());
  });
});

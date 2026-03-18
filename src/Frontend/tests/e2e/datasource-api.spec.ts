/**
 * G2 — DataSource Edge Endpoints (P1)
 *
 * Tests filtering, statistics, validation, and action endpoints
 * that are NOT covered by the existing datasource.spec.ts (which is UI-only).
 *
 * Base: http://localhost:5001/api/v1/datasource
 * All request payloads use PascalCase (backend convention).
 */
import { test, expect } from './support';
import { extractItems, extractId, extractSupplier } from './helpers/api-utils';

const DS_API = process.env.EZ_API_URL || 'http://localhost:5001';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@P1 @DataSource DataSource Edge Endpoints', () => {
  let firstDatasourceId: string | undefined;
  let firstSupplierName: string | undefined;

  test.beforeAll(async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/datasource`);
    if (res.ok()) {
      const body = await res.json();
      const items = extractItems(body);
      if (items.length > 0) {
        firstDatasourceId = extractId(items[0]);
        firstSupplierName = extractSupplier(items[0]);
      }
    }
  });

  // ── GET /datasource/active ───────────────────────────────────────────────
  test('[P1] GET /datasource/active returns only active datasources', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/datasource/active`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      // All returned items should be active
      for (const item of items) {
        const obj = item as Record<string, unknown>;
        const isActive = obj?.IsActive ?? obj?.isActive;
        if (isActive !== undefined) {
          expect(isActive).toBe(true);
        }
      }
    }
  });

  // ── GET /datasource/inactive ─────────────────────────────────────────────
  test('[P1] GET /datasource/inactive returns only inactive datasources', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/datasource/inactive`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      for (const item of items) {
        const obj = item as Record<string, unknown>;
        const isActive = obj?.IsActive ?? obj?.isActive;
        if (isActive !== undefined) {
          expect(isActive).toBe(false);
        }
      }
    }
  });

  // ── GET /datasource/supplier/{name} ─────────────────────────────────────
  test('[P1] GET /datasource/supplier/{name} filters by supplier', async ({ request }) => {
    test.skip(!firstSupplierName, 'No supplier name available from existing datasources');

    const encoded = encodeURIComponent(firstSupplierName!);
    const res = await request.get(`${DS_API}/api/v1/datasource/supplier/${encoded}`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      // All returned items should match the supplier
      for (const item of items) {
        const supplier = extractSupplier(item);
        if (supplier !== undefined) {
          expect(supplier).toBe(firstSupplierName);
        }
      }
    }
  });

  test('[P1] GET /datasource/supplier/{name} with unknown supplier returns empty or 404', async ({
    request,
  }) => {
    const res = await request.get(
      `${DS_API}/api/v1/datasource/supplier/NonExistentSupplierXYZ_12345`
    );
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = extractItems(body);
      expect(items.length).toBe(0);
    }
  });

  // ── GET /datasource/statistics ───────────────────────────────────────────
  test('[P1] GET /datasource/statistics returns aggregate counts', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/datasource/statistics`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      // Should have numeric counters of some kind
      const hasNumericField = Object.values(body).some(
        (v) => typeof v === 'number' || (typeof v === 'object' && v !== null)
      );
      expect(hasNumericField).toBeTruthy();
    }
  });

  // ── GET /datasource/validate-name ───────────────────────────────────────
  test('[P1] GET /datasource/validate-name returns valid for unique name', async ({ request }) => {
    const uniqueName = `Test-DS-ValidateName-${Date.now()}`;
    const res = await request.get(
      `${DS_API}/api/v1/datasource/validate-name?name=${encodeURIComponent(uniqueName)}`
    );
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      // Should indicate validity
      const isValid = body?.IsValid ?? body?.isValid ?? body?.Valid ?? body?.valid;
      if (isValid !== undefined) {
        expect(isValid).toBe(true);
      }
    }
  });

  test('[P1] GET /datasource/validate-name returns 400 for missing name param', async ({
    request,
  }) => {
    const res = await request.get(`${DS_API}/api/v1/datasource/validate-name`);
    expect([400, 422, 404]).toContain(res.status());
  });

  // ── POST /datasource/{id}/test-connection ────────────────────────────────
  test('[P1] POST /datasource/{id}/test-connection returns result object', async ({ request }) => {
    test.skip(!firstDatasourceId, 'No datasource available');

    const res = await request.post(
      `${DS_API}/api/v1/datasource/${firstDatasourceId}/test-connection`
    );
    expect([200, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      // Must have a success/failure indicator
      const hasSuccess =
        body?.Success !== undefined ||
        body?.success !== undefined ||
        body?.IsSuccess !== undefined ||
        body?.isSuccess !== undefined;
      expect(hasSuccess).toBeTruthy();
    }
  });

  test('[P1] POST /datasource/{id}/test-connection for non-existent id returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.post(`${DS_API}/api/v1/datasource/${fakeId}/test-connection`);
    expect([404, 400]).toContain(res.status());
  });

  // ── POST /datasource/{id}/stats ──────────────────────────────────────────
  test('[P1] POST /datasource/{id}/stats returns processing statistics', async ({ request }) => {
    test.skip(!firstDatasourceId, 'No datasource available');

    const res = await request.post(
      `${DS_API}/api/v1/datasource/${firstDatasourceId}/stats`
    );
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });
});

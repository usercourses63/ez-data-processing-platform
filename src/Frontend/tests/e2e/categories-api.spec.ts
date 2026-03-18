/**
 * G5 — Categories API (P1)
 *
 * Tests full CRUD, reorder, toggle-active, and usage-count endpoints.
 *
 * Base: http://localhost:5001/api/v1/categories
 * All request payloads use PascalCase (backend convention).
 * Created categories are cleaned up in afterAll.
 */
import { test, expect } from './support';

const DS_API = process.env.EZ_API_URL || 'http://localhost:5001';
const CATEGORIES_BASE = `${DS_API}/api/v1/categories`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractId(item: unknown): string | undefined {
  const obj = item as Record<string, unknown>;
  return (obj?.ID ?? obj?.id ?? obj?.Id) as string | undefined;
}

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

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@P1 @Categories Categories API', () => {
  test.describe.configure({ mode: 'serial' });

  let createdCategoryId: string | undefined;
  let secondCategoryId: string | undefined;

  test.afterAll(async ({ request }) => {
    const ids = [createdCategoryId, secondCategoryId].filter(Boolean) as string[];
    for (const id of ids) {
      await request.delete(`${CATEGORIES_BASE}/${id}`).catch(() => {});
    }
  });

  // ── GET / (list) ─────────────────────────────────────────────────────────
  test('[P1] GET /categories returns list', async ({ request }) => {
    const res = await request.get(CATEGORIES_BASE);
    expect([200]).toContain(res.status());

    const body = await res.json();
    const items = extractItems(body);
    expect(Array.isArray(items)).toBeTruthy();
  });

  // ── POST / (create) ──────────────────────────────────────────────────────
  test('[P1] POST /categories creates a new category', async ({ request }) => {
    const name = `Test Category ${uniqueSuffix()}`;
    const res = await request.post(CATEGORIES_BASE, {
      data: {
        Name: name,
        Description: 'Created by automated API test',
        IsActive: true,
      },
    });
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    createdCategoryId = extractId(body);
    expect(createdCategoryId).toBeTruthy();

    const obj = body as Record<string, unknown>;
    const returnedName = obj?.Name ?? obj?.name;
    expect(returnedName).toBe(name);
  });

  test('[P1] POST /categories with duplicate name returns 409 or 400', async ({ request }) => {
    test.skip(!createdCategoryId, 'No created category available');

    // Get the name of the category we just created
    const getRes = await request.get(`${CATEGORIES_BASE}/${createdCategoryId}`);
    if (!getRes.ok()) return;
    const obj = await getRes.json() as Record<string, unknown>;
    const existingName = obj?.Name ?? obj?.name;

    const res = await request.post(CATEGORIES_BASE, {
      data: {
        Name: existingName,
        Description: 'Duplicate attempt',
        IsActive: true,
      },
    });
    expect([400, 409, 422]).toContain(res.status());
  });

  test('[P1] POST /categories with missing Name returns 400', async ({ request }) => {
    const res = await request.post(CATEGORIES_BASE, {
      data: {
        Description: 'Missing name',
        IsActive: true,
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // ── GET /{id} ─────────────────────────────────────────────────────────────
  test('[P1] GET /categories/{id} returns specific category', async ({ request }) => {
    test.skip(!createdCategoryId, 'No created category available');

    const res = await request.get(`${CATEGORIES_BASE}/${createdCategoryId}`);
    expect([200]).toContain(res.status());

    const body = await res.json() as Record<string, unknown>;
    const returnedId = extractId(body);
    expect(returnedId).toBe(createdCategoryId);
  });

  test('[P1] GET /categories/{id} for non-existent id returns 404', async ({ request }) => {
    const res = await request.get(`${CATEGORIES_BASE}/00000000-0000-0000-0000-000000000000`);
    expect([404, 400]).toContain(res.status());
  });

  // ── PUT /{id} ─────────────────────────────────────────────────────────────
  test('[P1] PUT /categories/{id} updates category fields', async ({ request }) => {
    test.skip(!createdCategoryId, 'No created category available');

    const updatedName = `Updated Category ${uniqueSuffix()}`;
    const res = await request.put(`${CATEGORIES_BASE}/${createdCategoryId}`, {
      data: {
        Name: updatedName,
        Description: 'Updated by automated test',
        IsActive: true,
      },
    });
    expect([200, 204]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      const returnedName = body?.Name ?? body?.name;
      expect(returnedName).toBe(updatedName);
    }
  });

  test('[P1] PUT /categories/{id} for non-existent id returns 404', async ({ request }) => {
    const res = await request.put(`${CATEGORIES_BASE}/00000000-0000-0000-0000-000000000000`, {
      data: { Name: 'Ghost', Description: '', IsActive: false },
    });
    expect([404, 400]).toContain(res.status());
  });

  // ── PATCH /{id}/toggle-active ─────────────────────────────────────────────
  test('[P1] PATCH /categories/{id}/toggle-active flips IsActive', async ({ request }) => {
    test.skip(!createdCategoryId, 'No created category available');

    // Get current state
    const beforeRes = await request.get(`${CATEGORIES_BASE}/${createdCategoryId}`);
    expect(beforeRes.ok()).toBeTruthy();
    const before = await beforeRes.json() as Record<string, unknown>;
    const beforeActive = before?.IsActive ?? before?.isActive;

    const res = await request.patch(`${CATEGORIES_BASE}/${createdCategoryId}/toggle-active`);
    expect([200, 204]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      const afterActive = body?.IsActive ?? body?.isActive;
      if (beforeActive !== undefined && afterActive !== undefined) {
        expect(afterActive).toBe(!beforeActive);
      }
    } else {
      // 204: verify via GET
      const afterRes = await request.get(`${CATEGORIES_BASE}/${createdCategoryId}`);
      if (afterRes.ok()) {
        const after = await afterRes.json() as Record<string, unknown>;
        const afterActive = after?.IsActive ?? after?.isActive;
        if (beforeActive !== undefined && afterActive !== undefined) {
          expect(afterActive).toBe(!beforeActive);
        }
      }
    }
  });

  // ── GET /{id}/usage-count ─────────────────────────────────────────────────
  test('[P1] GET /categories/{id}/usage-count returns numeric count', async ({ request }) => {
    test.skip(!createdCategoryId, 'No created category available');

    const res = await request.get(`${CATEGORIES_BASE}/${createdCategoryId}/usage-count`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const count =
        typeof body === 'number'
          ? body
          : (body as Record<string, unknown>)?.Count ??
            (body as Record<string, unknown>)?.count ??
            (body as Record<string, unknown>)?.UsageCount;
      expect(typeof count === 'number' || count !== undefined).toBeTruthy();
    }
  });

  // ── POST /reorder ─────────────────────────────────────────────────────────
  test('[P1] POST /categories/reorder with ordered ids', async ({ request }) => {
    // Create a second category to reorder with the first
    const res2 = await request.post(CATEGORIES_BASE, {
      data: {
        Name: `Reorder Test Category ${uniqueSuffix()}`,
        Description: 'Second category for reorder test',
        IsActive: true,
      },
    });
    if (res2.ok()) {
      const body2 = await res2.json();
      secondCategoryId = extractId(body2);
    }

    test.skip(!createdCategoryId || !secondCategoryId, 'Need 2 categories for reorder test');

    const res = await request.post(`${CATEGORIES_BASE}/reorder`, {
      data: {
        OrderedIds: [secondCategoryId!, createdCategoryId!],
      },
    });
    expect([200, 204, 400]).toContain(res.status());
  });

  test('[P1] POST /categories/reorder with empty array returns 400 or succeeds', async ({
    request,
  }) => {
    const res = await request.post(`${CATEGORIES_BASE}/reorder`, {
      data: { OrderedIds: [] },
    });
    expect([200, 204, 400, 422]).toContain(res.status());
  });

  // ── DELETE /{id} ──────────────────────────────────────────────────────────
  test('[P1] DELETE /categories/{id} removes the category', async ({ request }) => {
    // Create a throwaway category to delete
    const createRes = await request.post(CATEGORIES_BASE, {
      data: {
        Name: `Delete Me ${uniqueSuffix()}`,
        Description: 'To be deleted',
        IsActive: true,
      },
    });
    if (!createRes.ok()) {
      test.skip(true, 'Could not create category to delete');
      return;
    }
    const created = await createRes.json();
    const idToDelete = extractId(created);
    expect(idToDelete).toBeTruthy();

    const delRes = await request.delete(`${CATEGORIES_BASE}/${idToDelete}`);
    expect([200, 204]).toContain(delRes.status());

    // Verify it's gone
    const getRes = await request.get(`${CATEGORIES_BASE}/${idToDelete}`);
    expect([404, 400]).toContain(getRes.status());
  });

  test('[P1] DELETE /categories/{id} for non-existent id returns 404', async ({ request }) => {
    const res = await request.delete(`${CATEGORIES_BASE}/00000000-0000-0000-0000-000000000000`);
    expect([404, 400]).toContain(res.status());
  });
});

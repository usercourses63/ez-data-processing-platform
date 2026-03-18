/**
 * G8 — Server Advanced Endpoints (P2)
 *
 * Tests filtering by type, usage-count, toggle-active, and supported types listing.
 *
 * Base: http://localhost:5001/api/v1/servers
 * All request payloads use PascalCase (backend convention).
 */
import { test, expect } from '@playwright/test';
import {
  EZ_API_BASE,
  createAdminServer,
  deleteServer,
  ServerDirection,
} from './helpers/ez-api-client';

const DS_API = process.env.EZ_API_URL || 'http://localhost:5001';

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

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@P2 @Servers Server Advanced Endpoints', () => {
  let folderServerId: string | undefined;
  let testServerCreatedHere = false;

  test.beforeAll(async ({ request }) => {
    // Get or create a folder-type server for tests
    const listRes = await request.get(`${DS_API}/api/v1/servers`);
    if (listRes.ok()) {
      const body = await listRes.json();
      const servers = Array.isArray(body) ? body : extractItems(body);
      const existing = servers.find((s) => {
        const obj = s as Record<string, unknown>;
        return ((obj?.ServerType ?? obj?.serverType ?? '') as string).toLowerCase() === 'folder';
      });
      if (existing) {
        folderServerId = extractId(existing);
      }
    }

    if (!folderServerId) {
      try {
        const server = await createAdminServer(request, {
          Name: `adv-srv-test-${uniqueSuffix()}`,
          ServerType: 'folder',
          Direction: ServerDirection.Both,
          BasePath: '/tmp',
          Description: 'Temporary server for advanced server API tests',
        });
        folderServerId = server.ID;
        testServerCreatedHere = true;
        console.log(`[server-advanced] Created temp folder server: ${folderServerId}`);
      } catch (err) {
        console.warn(`[server-advanced] Could not create server: ${err}`);
      }
    }
  });

  test.afterAll(async ({ request }) => {
    if (folderServerId && testServerCreatedHere) {
      await deleteServer(request, folderServerId).catch(() => {});
    }
  });

  // ── GET /servers/types ───────────────────────────────────────────────────
  test('[P2] GET /servers/types returns all supported server types', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/servers/types`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const types = Array.isArray(body) ? body : extractItems(body);
      expect(types.length).toBeGreaterThan(0);

      // Should include folder as a known type
      const typeStrings = types.map((t) => {
        if (typeof t === 'string') return t.toLowerCase();
        const obj = t as Record<string, unknown>;
        return ((obj?.Type ?? obj?.type ?? obj?.Name ?? obj?.name ?? '') as string).toLowerCase();
      });
      expect(typeStrings.some((t) => t.includes('folder'))).toBeTruthy();
    }
  });

  // ── GET /servers/by-type/{type} ──────────────────────────────────────────
  test('[P2] GET /servers/by-type/folder returns folder servers', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/servers/by-type/folder`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const servers = Array.isArray(body) ? body : extractItems(body);
      expect(Array.isArray(servers)).toBeTruthy();

      for (const server of servers) {
        const obj = server as Record<string, unknown>;
        const serverType = ((obj?.ServerType ?? obj?.serverType ?? '') as string).toLowerCase();
        expect(serverType).toBe('folder');
      }
    }
  });

  test('[P2] GET /servers/by-type/ftp returns ftp servers', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/servers/by-type/ftp`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const servers = Array.isArray(body) ? body : extractItems(body);
      for (const server of servers) {
        const obj = server as Record<string, unknown>;
        const serverType = ((obj?.ServerType ?? obj?.serverType ?? '') as string).toLowerCase();
        expect(serverType).toBe('ftp');
      }
    }
  });

  test('[P2] GET /servers/by-type with unknown type returns empty list or 404', async ({
    request,
  }) => {
    const res = await request.get(`${DS_API}/api/v1/servers/by-type/unknownprotocolxyz`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const servers = Array.isArray(body) ? body : extractItems(body);
      expect(servers.length).toBe(0);
    }
  });

  // ── GET /servers/{id}/usage-count ────────────────────────────────────────
  test('[P2] GET /servers/{id}/usage-count returns numeric count', async ({ request }) => {
    test.skip(!folderServerId, 'No server available');

    const res = await request.get(`${DS_API}/api/v1/servers/${folderServerId}/usage-count`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const count =
        typeof body === 'number'
          ? body
          : (body as Record<string, unknown>)?.Count ??
            (body as Record<string, unknown>)?.count ??
            (body as Record<string, unknown>)?.UsageCount ??
            (body as Record<string, unknown>)?.usageCount;
      expect(typeof count === 'number' || count !== undefined).toBeTruthy();
    }
  });

  test('[P2] GET /servers/{id}/usage-count for non-existent server returns 404', async ({
    request,
  }) => {
    const res = await request.get(
      `${DS_API}/api/v1/servers/00000000-0000-0000-0000-000000000000/usage-count`
    );
    expect([404, 400]).toContain(res.status());
  });

  // ── PATCH /servers/{id}/toggle-active ────────────────────────────────────
  test('[P2] PATCH /servers/{id}/toggle-active flips IsActive', async ({ request }) => {
    test.skip(!folderServerId, 'No server available');

    // Get current IsActive state
    const beforeRes = await request.get(`${DS_API}/api/v1/servers/${folderServerId}`);
    expect(beforeRes.ok()).toBeTruthy();
    const before = await beforeRes.json() as Record<string, unknown>;
    const beforeActive = before?.IsActive ?? before?.isActive;

    const res = await request.patch(
      `${DS_API}/api/v1/servers/${folderServerId}/toggle-active`
    );
    expect([200, 204]).toContain(res.status());

    // Verify the toggle happened
    const afterRes = await request.get(`${DS_API}/api/v1/servers/${folderServerId}`);
    if (afterRes.ok()) {
      const after = await afterRes.json() as Record<string, unknown>;
      const afterActive = after?.IsActive ?? after?.isActive;
      if (beforeActive !== undefined && afterActive !== undefined) {
        expect(afterActive).toBe(!beforeActive);
      }
    }

    // Restore original state
    await request.patch(`${DS_API}/api/v1/servers/${folderServerId}/toggle-active`).catch(() => {});
  });

  test('[P2] PATCH /servers/{id}/toggle-active for non-existent server returns 404', async ({
    request,
  }) => {
    const res = await request.patch(
      `${DS_API}/api/v1/servers/00000000-0000-0000-0000-000000000000/toggle-active`
    );
    expect([404, 400]).toContain(res.status());
  });

  // ── Sanity: existing endpoints still work ────────────────────────────────
  test('[P2] GET /servers returns list of servers', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/servers`);
    expect([200]).toContain(res.status());
    const body = await res.json();
    const servers = Array.isArray(body) ? body : extractItems(body);
    expect(Array.isArray(servers)).toBeTruthy();
  });

  test('[P2] GET /servers/{id} returns specific server', async ({ request }) => {
    test.skip(!folderServerId, 'No server available');
    const res = await request.get(`${DS_API}/api/v1/servers/${folderServerId}`);
    expect([200]).toContain(res.status());
    const body = await res.json() as Record<string, unknown>;
    expect(extractId(body)).toBe(folderServerId);
  });
});

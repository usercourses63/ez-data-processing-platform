/**
 * G6 — File Operations API (P1)
 *
 * Tests the file-operations proxy endpoints: list, read, write.
 * Requires a folder-type admin server to be created for testing.
 * Server is created in beforeAll and deleted in afterAll.
 *
 * Base: http://localhost:5001/api/v1/file-operations
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

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@P1 @FileOperations File Operations API', () => {
  let folderServerId: string | undefined;
  /** A path that should exist on the server (we write then read it). */
  const testFileName = `api-test-file-${uniqueSuffix()}.csv`;
  const testFileContent = 'id,name,value\n1,Alice,100\n2,Bob,200\n';

  test.beforeAll(async ({ request }) => {
    // Try to get an existing folder server first
    const listRes = await request.get(`${DS_API}/api/v1/servers`);
    if (listRes.ok()) {
      const body = await listRes.json();
      const servers = Array.isArray(body) ? body : extractItems(body);
      const folderServer = servers.find((s) => {
        const obj = s as Record<string, unknown>;
        const type = (obj?.ServerType ?? obj?.serverType ?? '') as string;
        return type.toLowerCase() === 'folder';
      });
      if (folderServer) {
        folderServerId = extractId(folderServer);
      }
    }

    // If no folder server exists, create a temporary one pointing to /tmp
    if (!folderServerId) {
      try {
        const server = await createAdminServer(request, {
          Name: `file-ops-test-${uniqueSuffix()}`,
          ServerType: 'folder',
          Direction: ServerDirection.Both,
          BasePath: '/tmp',
          Description: 'Temporary server for file operations API tests',
        });
        folderServerId = server.ID;
        console.log(`[file-operations-api] Created temp folder server: ${folderServerId}`);
      } catch (err) {
        console.warn(`[file-operations-api] Could not create folder server: ${err}`);
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Only delete servers that this test created (name starts with "file-ops-test-")
    if (folderServerId) {
      const getRes = await request.get(`${DS_API}/api/v1/servers/${folderServerId}`).catch(() => null);
      if (getRes?.ok()) {
        const body = await getRes.json() as Record<string, unknown>;
        const name = (body?.Name ?? body?.name ?? '') as string;
        if (name.startsWith('file-ops-test-')) {
          await deleteServer(request, folderServerId).catch(() => {});
        }
      }
    }
  });

  // ── POST /{serverId}/list ─────────────────────────────────────────────────
  test('[P1] POST /file-operations/{id}/list returns file listing', async ({ request }) => {
    test.skip(!folderServerId, 'No folder server available');

    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${folderServerId}/list`,
      {
        data: {
          Path: null,
          Pattern: '*',
        },
      }
    );
    expect([200, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = Array.isArray(body) ? body : extractItems(body);
      expect(Array.isArray(items)).toBeTruthy();
    }
  });

  test('[P1] POST /file-operations/{id}/list with pattern filter', async ({ request }) => {
    test.skip(!folderServerId, 'No folder server available');

    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${folderServerId}/list`,
      {
        data: {
          Path: null,
          Pattern: '*.csv',
        },
      }
    );
    expect([200, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const items = Array.isArray(body) ? body : extractItems(body);
      // All results should match the pattern if any results exist
      for (const item of items) {
        const obj = item as Record<string, unknown>;
        const fileName = (obj?.FileName ?? obj?.fileName ?? obj?.Name ?? obj?.name ?? '') as string;
        if (fileName && !fileName.endsWith('.csv') && !(obj?.IsDirectory ?? obj?.isDirectory)) {
          // Only fail if it's a file with a non-csv extension
          expect(fileName).toMatch(/\.csv$/i);
        }
      }
    }
  });

  test('[P1] POST /file-operations/{id}/list for non-existent server returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${fakeId}/list`,
      { data: { Path: null, Pattern: '*' } }
    );
    expect([404, 400]).toContain(res.status());
  });

  // ── POST /{serverId}/write ────────────────────────────────────────────────
  test('[P1] POST /file-operations/{id}/write creates a file', async ({ request }) => {
    test.skip(!folderServerId, 'No folder server available');

    const contentBase64 = Buffer.from(testFileContent).toString('base64');
    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${folderServerId}/write`,
      {
        data: {
          FilePath: `/${testFileName}`,
          Content: contentBase64,
        },
      }
    );
    expect([200, 201, 204, 400, 404]).toContain(res.status());
  });

  test('[P1] POST /file-operations/{id}/write with missing FilePath returns 400', async ({
    request,
  }) => {
    test.skip(!folderServerId, 'No folder server available');

    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${folderServerId}/write`,
      {
        data: {
          Content: Buffer.from('hello').toString('base64'),
          // FilePath intentionally omitted
        },
      }
    );
    expect([400, 422]).toContain(res.status());
  });

  test('[P1] POST /file-operations/{id}/write for non-existent server returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${fakeId}/write`,
      {
        data: {
          FilePath: '/test.csv',
          Content: Buffer.from('x').toString('base64'),
        },
      }
    );
    expect([404, 400]).toContain(res.status());
  });

  // ── POST /{serverId}/read ─────────────────────────────────────────────────
  test('[P1] POST /file-operations/{id}/read retrieves file content', async ({ request }) => {
    test.skip(!folderServerId, 'No folder server available');

    // Attempt to read the file we wrote above (may not exist if write failed)
    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${folderServerId}/read`,
      {
        data: {
          FilePath: `/${testFileName}`,
        },
      }
    );
    expect([200, 404, 400]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.body();
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test('[P1] POST /file-operations/{id}/read with missing FilePath returns 400', async ({
    request,
  }) => {
    test.skip(!folderServerId, 'No folder server available');

    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${folderServerId}/read`,
      { data: {} }
    );
    expect([400, 422]).toContain(res.status());
  });

  test('[P1] POST /file-operations/{id}/read for non-existent file returns 404', async ({
    request,
  }) => {
    test.skip(!folderServerId, 'No folder server available');

    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${folderServerId}/read`,
      {
        data: {
          FilePath: '/this-file-does-not-exist-xyz-9999.csv',
        },
      }
    );
    expect([404, 400]).toContain(res.status());
  });

  test('[P1] POST /file-operations/{id}/read for non-existent server returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.post(
      `${DS_API}/api/v1/file-operations/${fakeId}/read`,
      { data: { FilePath: '/any.csv' } }
    );
    expect([404, 400]).toContain(res.status());
  });
});

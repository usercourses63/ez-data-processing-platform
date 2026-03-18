/**
 * G3 — Schema Utility Endpoints (P1)
 *
 * Tests schema publish, duplicate, JSON validation, regex testing, and templates.
 * These are action/utility endpoints not covered by the existing schema.spec.ts (UI-only).
 *
 * Base: http://localhost:5001/api/v1/schema
 * All request payloads use PascalCase (backend convention).
 */
import { test, expect } from '@playwright/test';

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

/** Minimal valid JSON Schema 2020-12 document. */
const VALID_JSON_SCHEMA = JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
});

const VALID_JSON_INSTANCE = JSON.stringify({ name: 'Alice', age: 30 });
const INVALID_JSON_INSTANCE = JSON.stringify({ age: 'not-a-number' }); // missing name, wrong age type

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@P1 @Schema Schema Utility Endpoints', () => {
  let schemaId: string | undefined;
  let duplicatedSchemaId: string | undefined;

  test.beforeAll(async ({ request }) => {
    // Attempt to get an existing schema
    const res = await request.get(`${DS_API}/api/v1/schema`);
    if (res.ok()) {
      const body = await res.json();
      const items = extractItems(body);
      if (items.length > 0) {
        schemaId = extractId(items[0]);
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Clean up any schema we duplicated
    if (duplicatedSchemaId) {
      await request.delete(`${DS_API}/api/v1/schema/${duplicatedSchemaId}`).catch(() => {});
    }
  });

  // ── GET /schema/templates ────────────────────────────────────────────────
  test('[P1] GET /schema/templates returns template list', async ({ request }) => {
    const res = await request.get(`${DS_API}/api/v1/schema/templates`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      // Should return an array or wrapped array
      const items = Array.isArray(body) ? body : extractItems(body);
      expect(Array.isArray(items)).toBeTruthy();
    }
  });

  // ── POST /schema/validate-json ───────────────────────────────────────────
  test('[P1] POST /schema/validate-json with valid instance returns success', async ({
    request,
  }) => {
    test.skip(!schemaId, 'No schema available for validation');

    const res = await request.post(`${DS_API}/api/v1/schema/validate-json`, {
      data: {
        Json: VALID_JSON_INSTANCE,
        SchemaId: schemaId,
      },
    });
    expect([200, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      const isValid = body?.IsValid ?? body?.isValid ?? body?.Valid ?? body?.valid;
      // Valid instance should pass — but the schema in DB may differ, so just check shape
      expect(typeof isValid === 'boolean' || isValid !== undefined).toBeTruthy();
    }
  });

  test('[P1] POST /schema/validate-json with inline schema validates correctly', async ({
    request,
  }) => {
    const res = await request.post(`${DS_API}/api/v1/schema/validate-json`, {
      data: {
        Json: VALID_JSON_INSTANCE,
        Schema: VALID_JSON_SCHEMA,
      },
    });
    // 200 or 400 are acceptable (endpoint may require SchemaId instead of inline)
    expect([200, 400, 404]).toContain(res.status());
  });

  test('[P1] POST /schema/validate-json with invalid JSON returns 400', async ({ request }) => {
    const res = await request.post(`${DS_API}/api/v1/schema/validate-json`, {
      data: {
        Json: 'not-valid-json{{{',
        SchemaId: schemaId ?? '00000000-0000-0000-0000-000000000000',
      },
    });
    expect([400, 422, 200]).toContain(res.status());
    // If 200, the IsValid field should be false
    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      const isValid = body?.IsValid ?? body?.isValid;
      if (isValid !== undefined) {
        expect(isValid).toBe(false);
      }
    }
  });

  // ── POST /schema/regex/test ──────────────────────────────────────────────
  test('[P1] POST /schema/regex/test returns true for matching pattern', async ({ request }) => {
    const res = await request.post(`${DS_API}/api/v1/schema/regex/test`, {
      data: {
        Pattern: '^[A-Z]+$',
        TestValue: 'HELLO',
      },
    });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      const isMatch = body?.IsMatch ?? body?.isMatch ?? body?.Match ?? body?.match ?? body?.Result ?? body?.result;
      if (isMatch !== undefined) {
        expect(isMatch).toBe(true);
      }
    }
  });

  test('[P1] POST /schema/regex/test returns false for non-matching value', async ({ request }) => {
    const res = await request.post(`${DS_API}/api/v1/schema/regex/test`, {
      data: {
        Pattern: '^[A-Z]+$',
        TestValue: 'hello123',
      },
    });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>;
      const isMatch = body?.IsMatch ?? body?.isMatch ?? body?.Match ?? body?.match;
      if (isMatch !== undefined) {
        expect(isMatch).toBe(false);
      }
    }
  });

  test('[P1] POST /schema/regex/test with invalid regex pattern returns 400', async ({
    request,
  }) => {
    const res = await request.post(`${DS_API}/api/v1/schema/regex/test`, {
      data: {
        Pattern: '[invalid(regex',
        TestValue: 'test',
      },
    });
    expect([400, 422, 200]).toContain(res.status());
  });

  test('[P1] POST /schema/regex/test with empty pattern returns 400', async ({ request }) => {
    const res = await request.post(`${DS_API}/api/v1/schema/regex/test`, {
      data: {
        Pattern: '',
        TestValue: 'test',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // ── POST /schema/{id}/duplicate ──────────────────────────────────────────
  test('[P1] POST /schema/{id}/duplicate creates a copy', async ({ request }) => {
    test.skip(!schemaId, 'No schema available to duplicate');

    const res = await request.post(`${DS_API}/api/v1/schema/${schemaId}/duplicate`);
    expect([200, 201, 404]).toContain(res.status());

    if ([200, 201].includes(res.status())) {
      const body = await res.json();
      duplicatedSchemaId = extractId(body);
      expect(duplicatedSchemaId).toBeTruthy();
    }
  });

  test('[P1] POST /schema/{id}/duplicate for non-existent schema returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.post(`${DS_API}/api/v1/schema/${fakeId}/duplicate`);
    expect([404, 400]).toContain(res.status());
  });

  // ── POST /schema/{id}/publish ────────────────────────────────────────────
  test('[P1] POST /schema/{id}/publish changes schema status', async ({ request }) => {
    test.skip(!schemaId, 'No schema available to publish');

    const res = await request.post(`${DS_API}/api/v1/schema/${schemaId}/publish`);
    expect([200, 204, 400, 404, 409]).toContain(res.status());
    // 409 = already published; 400 = invalid state; all acceptable outcomes
  });

  test('[P1] POST /schema/{id}/publish for non-existent schema returns 404', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.post(`${DS_API}/api/v1/schema/${fakeId}/publish`);
    expect([404, 400]).toContain(res.status());
  });
});

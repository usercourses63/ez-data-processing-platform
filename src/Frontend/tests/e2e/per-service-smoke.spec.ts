/**
 * Per-service smoke spec.
 *
 * One test per backend service. Each test does the cheapest possible round-trip
 * to confirm the service is alive and (for services with REST controllers) its
 * main list endpoint responds with a parseable envelope. Total runtime: ~10–15s.
 *
 * Purpose: a fast deployment-validation gate. After `helm upgrade` you run this
 * one file first — if it goes red, fix the cluster before running the deep specs.
 * If it goes green, the deeper specs (datasource.spec.ts, pipeline specs, etc.)
 * are worth running.
 *
 * Service classification:
 *
 *   REST + health  → /health AND /api/v1/<list> round-trip
 *   Health only    → /health only (service is a Kafka consumer with no REST API)
 *   Skip + reason  → no documented HTTP port-forward, or no controllers exist
 *
 * Port-forwards required (see scripts/start-port-forwards.ps1):
 *   5001 datasource-management
 *   5002 metrics-configuration
 *   5003 validation
 *   5004 scheduling
 *   5007 invalidrecords
 *   5008 fileprocessor
 *   5009 output
 */
import { test, expect } from '@playwright/test';

type ServiceCheck = {
  name: string;
  port: number;
  /** Canonical list endpoint, or null if the service has no REST controllers. */
  listEndpoint: string | null;
};

const SERVICES: ServiceCheck[] = [
  { name: 'datasource-management', port: 5001, listEndpoint: '/api/v1/datasource' },
  { name: 'metrics-configuration', port: 5002, listEndpoint: '/api/v1/metrics' },
  { name: 'validation',            port: 5003, listEndpoint: null },
  { name: 'scheduling',            port: 5004, listEndpoint: '/api/v1/scheduling' },
  { name: 'invalidrecords',        port: 5007, listEndpoint: '/api/v1/invalid-records' },
  { name: 'fileprocessor',         port: 5008, listEndpoint: null },
  { name: 'output',                port: 5009, listEndpoint: null },
];

const HEALTH_TIMEOUT = 8000;
const ENDPOINT_TIMEOUT = 10000;

for (const svc of SERVICES) {
  const tag = svc.listEndpoint ? 'REST' : 'consumer';

  test(`@smoke ${svc.name} (${tag}) — /health responds 2xx`, async ({ request }) => {
    const url = `http://127.0.0.1:${svc.port}/health`;
    const response = await request.get(url, { timeout: HEALTH_TIMEOUT });
    expect(
      response.status(),
      `${svc.name} /health on port ${svc.port} returned ${response.status()} — is the port-forward up? (scripts/start-port-forwards.ps1)`
    ).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });

  if (svc.listEndpoint) {
    test(`@smoke ${svc.name} (REST) — ${svc.listEndpoint} returns parseable response`, async ({ request }) => {
      const url = `http://127.0.0.1:${svc.port}${svc.listEndpoint}`;
      const response = await request.get(url, { timeout: ENDPOINT_TIMEOUT });
      expect(
        response.status(),
        `${svc.name} ${svc.listEndpoint} returned ${response.status()}`
      ).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);

      // Parse — fail loudly if the body is not valid JSON.
      const body = await response.json();
      expect(body, `${svc.name} ${svc.listEndpoint} returned a non-JSON body`).toBeDefined();

      // Accept any of the known envelope shapes used across the codebase:
      //   { isSuccess: true, data: ... }     — canonical ApiResponse<T>
      //   { Data: { Items: [...] } }          — legacy MongoDB.Entities wrapper
      //   [...]                                — direct array
      //   { items: [...] } / { data: [...] } — minor variants
      const looksLikeEnvelope =
        Array.isArray(body) ||
        body?.isSuccess !== undefined ||
        body?.Data !== undefined ||
        body?.data !== undefined ||
        body?.items !== undefined;
      expect(
        looksLikeEnvelope,
        `${svc.name} response did not match any known envelope shape. Got keys: ${Object.keys(body ?? {}).join(', ')}`
      ).toBe(true);
    });
  }
}

// File-discovery service: no HTTP port documented in CLAUDE.md or
// scripts/start-port-forwards.ps1. It's a RabbitMQ/Kafka consumer that runs
// background workers; its file-polling behavior is covered end-to-end by
// p0-pipeline-flow.spec.ts and v030-e2e-ftp-pipeline.spec.ts.
test.skip('@smoke file-discovery — no documented HTTP port (covered by pipeline specs)', () => {});

// DataSourceChat service: scaffold only — Program.cs registers MapControllers()
// but no controllers exist in src/Services/DataSourceChatService/. Until the
// service grows a real REST surface, there is nothing meaningful to smoke-test
// beyond /health (and its port — 5006 per launchSettings — is not in the
// project's port-forward list, so it is not reachable from this spec).
test.skip('@smoke datasource-chat — scaffold-only, no controllers + no port-forward', () => {});

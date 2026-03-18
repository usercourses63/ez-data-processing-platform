/**
 * EZ Platform - k6 Smoke Test
 *
 * Validates SLOs defined in CLAUDE.md:
 *   - P99 API latency < 500ms
 *   - P95 API latency < 300ms
 *   - Error rate < 1%
 *
 * Duration: 30 seconds, 5 virtual users
 *
 * Usage:
 *   k6 run tests/performance/smoke.js
 *   k6 run tests/performance/smoke.js -e BASE_URL=http://localhost:5001
 *   k6 run tests/performance/smoke.js -e BASE_URL=http://localhost:5001 -e METRICS_URL=http://localhost:5002 -e VALIDATION_URL=http://localhost:5003
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Environment variables ──────────────────────────────────────────────────
const BASE_URL        = __ENV.BASE_URL        || 'http://localhost:5001';
const METRICS_URL     = __ENV.METRICS_URL     || 'http://localhost:5002';
const VALIDATION_URL  = __ENV.VALIDATION_URL  || 'http://localhost:5003';

// ── Custom metrics ─────────────────────────────────────────────────────────
const datasourceApiErrors = new Rate('datasource_api_errors');
const metricsApiErrors    = new Rate('metrics_api_errors');
const validationApiErrors = new Rate('validation_api_errors');

// ── Test configuration ─────────────────────────────────────────────────────
export const options = {
  vus: 5,
  duration: '30s',

  thresholds: {
    // SLO: P99 latency < 500ms (from CLAUDE.md)
    'http_req_duration{percentile:99}': ['p(99)<500'],
    // SLO: P95 latency < 300ms (tighter bound for smoke test confidence)
    'http_req_duration{percentile:95}': ['p(95)<300'],
    // SLO: error rate < 1%
    'http_req_failed': ['rate<0.01'],
    // Per-service error rates
    'datasource_api_errors': ['rate<0.01'],
    'metrics_api_errors':    ['rate<0.01'],
    'validation_api_errors': ['rate<0.01'],
  },
};

// ── Shared request parameters ──────────────────────────────────────────────
const params = {
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
  timeout: '10s',
};

// ── Test body for test-connection endpoint ─────────────────────────────────
// Minimal payload — the service validates the schema, we just need a 400/422
// response (not a 5xx), which proves the service is alive and parsing correctly.
const testConnectionPayload = JSON.stringify({
  Type: 'Local',
  ConnectionDetails: {
    Path: '/tmp/nonexistent-smoke-test-path',
  },
});

// ── Main VU function ───────────────────────────────────────────────────────
export default function () {

  // ── DataSourceManagement (port 5001) ────────────────────────────────────
  group('DataSourceManagement', function () {

    // GET /health
    const healthRes = http.get(`${BASE_URL}/health`, params);
    const healthOk = check(healthRes, {
      'health status 200 or 204': (r) => r.status === 200 || r.status === 204,
    });
    datasourceApiErrors.add(!healthOk);

    sleep(0.1);

    // GET /api/v1/datasources
    const listRes = http.get(`${BASE_URL}/api/v1/datasources`, params);
    const listOk = check(listRes, {
      'list datasources 200': (r) => r.status === 200,
    });
    datasourceApiErrors.add(!listOk);

    sleep(0.1);

    // POST /api/v1/datasources/test-connection
    // Expects 400/422 (invalid path) — any non-5xx means the endpoint is alive.
    const testConnRes = http.post(
      `${BASE_URL}/api/v1/datasources/test-connection`,
      testConnectionPayload,
      params,
    );
    const testConnOk = check(testConnRes, {
      'test-connection not 5xx': (r) => r.status < 500,
    });
    datasourceApiErrors.add(!testConnOk);
  });

  sleep(0.2);

  // ── MetricsConfiguration (port 5002) ────────────────────────────────────
  group('MetricsConfiguration', function () {
    const healthRes = http.get(`${METRICS_URL}/health`, params);
    const healthOk = check(healthRes, {
      'metrics health 200 or 204': (r) => r.status === 200 || r.status === 204,
    });
    metricsApiErrors.add(!healthOk);
  });

  sleep(0.2);

  // ── ValidationService (port 5003) ───────────────────────────────────────
  group('ValidationService', function () {
    const healthRes = http.get(`${VALIDATION_URL}/health`, params);
    const healthOk = check(healthRes, {
      'validation health 200 or 204': (r) => r.status === 200 || r.status === 204,
    });
    validationApiErrors.add(!healthOk);
  });

  sleep(0.3);
}

// ── Lifecycle hooks ────────────────────────────────────────────────────────
export function handleSummary(data) {
  const passed = Object.values(data.metrics)
    .every((m) => !m.thresholds || Object.values(m.thresholds).every((t) => !t.ok === false));

  console.log('\n=== EZ Platform SLO Smoke Test Summary ===');
  console.log(`P99 latency: ${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) ?? 'N/A'} ms  (SLO: <500ms)`);
  console.log(`P95 latency: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) ?? 'N/A'} ms  (SLO: <300ms)`);
  console.log(`Error rate:  ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%  (SLO: <1%)`);
  console.log(`Total requests: ${data.metrics.http_reqs?.values?.count ?? 'N/A'}`);
  console.log('==========================================\n');

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

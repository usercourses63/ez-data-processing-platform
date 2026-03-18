/**
 * EZ Platform - k6 Load Test
 *
 * Full load test for manual execution — NOT run in CI.
 * Validates SLOs under sustained traffic:
 *   - P99 API latency < 500ms
 *   - P95 API latency < 300ms
 *   - Error rate < 1%
 *
 * Profile:
 *   0-60s:   ramp from 0 to 50 VUs
 *   60-180s: sustain 50 VUs
 *   180-210s: ramp down to 0
 *
 * Usage (requires running EZ Platform stack with port-forwards active):
 *
 *   k6 run tests/performance/load.js
 *
 *   # Override service URLs:
 *   k6 run tests/performance/load.js \
 *     -e BASE_URL=http://localhost:5001 \
 *     -e METRICS_URL=http://localhost:5002 \
 *     -e VALIDATION_URL=http://localhost:5003
 *
 *   # Output results to JSON for post-processing:
 *   k6 run tests/performance/load.js --out json=results/load-$(date +%Y%m%d-%H%M%S).json
 *
 *   # Run with Grafana Cloud k6 (requires K6_CLOUD_TOKEN):
 *   k6 cloud tests/performance/load.js
 *
 * Prerequisites:
 *   - k6 installed (see tests/performance/README.md)
 *   - EZ Platform deployed and port-forwards running:
 *       powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Environment variables ──────────────────────────────────────────────────
const BASE_URL        = __ENV.BASE_URL        || 'http://localhost:5001';
const METRICS_URL     = __ENV.METRICS_URL     || 'http://localhost:5002';
const VALIDATION_URL  = __ENV.VALIDATION_URL  || 'http://localhost:5003';

// ── Custom metrics ─────────────────────────────────────────────────────────
const datasourceApiErrors = new Rate('datasource_api_errors');
const metricsApiErrors    = new Rate('metrics_api_errors');
const validationApiErrors = new Rate('validation_api_errors');
const datasourceListTime  = new Trend('datasource_list_duration_ms');
const totalRequests       = new Counter('total_requests');

// ── Load test configuration ────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '60s',  target: 50 },   // Ramp up to 50 VUs over 60s
    { duration: '120s', target: 50 },   // Sustain 50 VUs for 2 minutes
    { duration: '30s',  target: 0  },   // Ramp down to 0 over 30s
  ],

  thresholds: {
    // SLO: P99 latency < 500ms (from CLAUDE.md)
    'http_req_duration{percentile:99}': ['p(99)<500'],
    // SLO: P95 latency < 300ms
    'http_req_duration{percentile:95}': ['p(95)<300'],
    // SLO: error rate < 1%
    'http_req_failed': ['rate<0.01'],
    // Per-service error rates
    'datasource_api_errors': ['rate<0.01'],
    'metrics_api_errors':    ['rate<0.01'],
    'validation_api_errors': ['rate<0.01'],
    // DataSource list endpoint specific latency
    'datasource_list_duration_ms': ['p(99)<500'],
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

const testConnectionPayload = JSON.stringify({
  Type: 'Local',
  ConnectionDetails: {
    Path: '/tmp/nonexistent-load-test-path',
  },
});

// ── Main VU function ───────────────────────────────────────────────────────
export default function () {

  // ── DataSourceManagement (port 5001) ────────────────────────────────────
  group('DataSourceManagement', function () {

    // GET /health
    const healthRes = http.get(`${BASE_URL}/health`, params);
    totalRequests.add(1);
    const healthOk = check(healthRes, {
      'health 200 or 204': (r) => r.status === 200 || r.status === 204,
    });
    datasourceApiErrors.add(!healthOk);

    sleep(0.1);

    // GET /api/v1/datasources — track its own trend metric
    const listStart = Date.now();
    const listRes = http.get(`${BASE_URL}/api/v1/datasources`, params);
    totalRequests.add(1);
    datasourceListTime.add(Date.now() - listStart);
    const listOk = check(listRes, {
      'list datasources 200': (r) => r.status === 200,
    });
    datasourceApiErrors.add(!listOk);

    sleep(0.1);

    // POST /api/v1/datasources/test-connection
    const testConnRes = http.post(
      `${BASE_URL}/api/v1/datasources/test-connection`,
      testConnectionPayload,
      params,
    );
    totalRequests.add(1);
    const testConnOk = check(testConnRes, {
      'test-connection not 5xx': (r) => r.status < 500,
    });
    datasourceApiErrors.add(!testConnOk);
  });

  sleep(0.2);

  // ── MetricsConfiguration (port 5002) ────────────────────────────────────
  group('MetricsConfiguration', function () {
    const healthRes = http.get(`${METRICS_URL}/health`, params);
    totalRequests.add(1);
    const healthOk = check(healthRes, {
      'metrics health 200 or 204': (r) => r.status === 200 || r.status === 204,
    });
    metricsApiErrors.add(!healthOk);
  });

  sleep(0.2);

  // ── ValidationService (port 5003) ───────────────────────────────────────
  group('ValidationService', function () {
    const healthRes = http.get(`${VALIDATION_URL}/health`, params);
    totalRequests.add(1);
    const healthOk = check(healthRes, {
      'validation health 200 or 204': (r) => r.status === 200 || r.status === 204,
    });
    validationApiErrors.add(!healthOk);
  });

  sleep(0.3);
}

// ── Lifecycle hooks ────────────────────────────────────────────────────────
export function handleSummary(data) {
  console.log('\n=== EZ Platform SLO Load Test Summary ===');
  console.log(`Peak VUs:    50`);
  console.log(`Duration:    ~3.5 minutes (60s ramp + 120s sustain + 30s ramp-down)`);
  console.log(`P99 latency: ${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) ?? 'N/A'} ms  (SLO: <500ms)`);
  console.log(`P95 latency: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) ?? 'N/A'} ms  (SLO: <300ms)`);
  console.log(`Error rate:  ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%  (SLO: <1%)`);
  console.log(`Total requests: ${data.metrics.http_reqs?.values?.count ?? 'N/A'}`);
  console.log(`DS list P99: ${data.metrics.datasource_list_duration_ms?.values?.['p(99)']?.toFixed(2) ?? 'N/A'} ms`);
  console.log('==========================================\n');

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

# EZ Platform Performance Tests

k6 load tests that validate the SLOs defined in CLAUDE.md.

## SLOs Under Test

| SLO | Threshold | Source |
|-----|-----------|--------|
| P99 API latency | < 500ms | CLAUDE.md Performance Targets |
| P95 API latency | < 300ms | Additional smoke-test bound |
| Error rate | < 1% | CLAUDE.md Performance Targets |

## Installing k6

### Linux / GitHub Actions (Ubuntu)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### macOS
```bash
brew install k6
```

### Windows
```powershell
winget install k6 --source winget
# or download MSI from https://dl.k6.io/msi/k6-latest-amd64.msi
```

### Docker (no install required)
```bash
docker run --rm -i grafana/k6 run - < tests/performance/smoke.js
```

## Prerequisites

The EZ Platform stack must be running with port-forwards active:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1
```

Default ports used by these tests:

| Service | Port |
|---------|------|
| DataSourceManagement | 5001 |
| MetricsConfiguration | 5002 |
| ValidationService | 5003 |

## Running the Smoke Test (CI / quick check)

```bash
# Default (localhost port-forwards)
k6 run tests/performance/smoke.js

# Override service URLs
k6 run tests/performance/smoke.js \
  -e BASE_URL=http://localhost:5001 \
  -e METRICS_URL=http://localhost:5002 \
  -e VALIDATION_URL=http://localhost:5003

# Using the convenience script
bash scripts/run-performance-tests.sh

# Custom BASE_URL via convenience script
BASE_URL=http://172.30.22.206:31205 bash scripts/run-performance-tests.sh
```

**Smoke test profile:** 5 VUs, 30 seconds.

## Running the Load Test (manual)

```bash
# Default (localhost port-forwards)
k6 run tests/performance/load.js

# Save results to JSON for analysis
mkdir -p results
k6 run tests/performance/load.js \
  --out json=results/load-$(date +%Y%m%d-%H%M%S).json

# Override all service URLs
k6 run tests/performance/load.js \
  -e BASE_URL=http://localhost:5001 \
  -e METRICS_URL=http://localhost:5002 \
  -e VALIDATION_URL=http://localhost:5003
```

**Load test profile:** ramp 0→50 VUs over 60s, sustain 50 VUs for 120s, ramp down over 30s (~3.5 minutes total).

## Interpreting Results

k6 prints a summary after each run. Key lines to check:

```
✓ http_req_duration............... p(99)=123ms   p(95)=87ms
✓ http_req_failed................. 0.00%
```

A `✓` means the threshold passed; `✗` means an SLO violation.

## CI Integration

The smoke test runs automatically in GitHub Actions on push/PR to `main` via the `performance` job in `.github/workflows/ci.yml`. It uses `continue-on-error: true` because the CI environment does not spin up the full Kubernetes stack — the job records whether SLOs would pass but does not block the pipeline when the stack is unavailable.

Results are uploaded as the `k6-smoke-results` artifact (retained 30 days).

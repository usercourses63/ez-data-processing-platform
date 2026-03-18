#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# EZ Platform - Performance Smoke Test Runner
#
# Runs the k6 smoke test against the running EZ Platform stack.
#
# Usage:
#   bash scripts/run-performance-tests.sh
#   BASE_URL=http://localhost:5001 bash scripts/run-performance-tests.sh
#
# Environment variables:
#   BASE_URL        DataSourceManagement API  (default: http://localhost:5001)
#   METRICS_URL     MetricsConfiguration API  (default: http://localhost:5002)
#   VALIDATION_URL  ValidationService API     (default: http://localhost:5003)
#
# Prerequisites:
#   - k6 installed (see tests/performance/README.md)
#   - EZ Platform running with port-forwards active
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5001}"
METRICS_URL="${METRICS_URL:-http://localhost:5002}"
VALIDATION_URL="${VALIDATION_URL:-http://localhost:5003}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SMOKE_SCRIPT="${REPO_ROOT}/tests/performance/smoke.js"
RESULTS_DIR="${REPO_ROOT}/k6-results"

# ── Verify k6 is installed ────────────────────────────────────────────────────
if ! command -v k6 &>/dev/null; then
  echo "ERROR: k6 is not installed."
  echo "  macOS:  brew install k6"
  echo "  Linux:  see tests/performance/README.md"
  echo "  Windows: winget install k6 --source winget"
  exit 1
fi

echo "========================================"
echo "EZ Platform - k6 Performance Smoke Test"
echo "========================================"
echo "BASE_URL:        ${BASE_URL}"
echo "METRICS_URL:     ${METRICS_URL}"
echo "VALIDATION_URL:  ${VALIDATION_URL}"
echo "k6 version:      $(k6 version)"
echo ""

mkdir -p "${RESULTS_DIR}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RESULT_JSON="${RESULTS_DIR}/smoke-${TIMESTAMP}.json"
RESULT_TXT="${RESULTS_DIR}/smoke-${TIMESTAMP}.txt"

echo "Running smoke test (5 VUs, 30s)..."
echo ""

k6 run "${SMOKE_SCRIPT}" \
  -e BASE_URL="${BASE_URL}" \
  -e METRICS_URL="${METRICS_URL}" \
  -e VALIDATION_URL="${VALIDATION_URL}" \
  --out "json=${RESULT_JSON}" \
  2>&1 | tee "${RESULT_TXT}"

EXIT_CODE="${PIPESTATUS[0]}"

echo ""
echo "========================================"
if [ "${EXIT_CODE}" -eq 0 ]; then
  echo "RESULT: ALL SLO THRESHOLDS PASSED"
else
  echo "RESULT: ONE OR MORE SLO THRESHOLDS FAILED (exit code ${EXIT_CODE})"
fi
echo "Results saved to: ${RESULTS_DIR}/"
echo "========================================"

exit "${EXIT_CODE}"

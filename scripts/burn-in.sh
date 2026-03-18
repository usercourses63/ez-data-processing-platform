#!/bin/bash
# burn-in.sh — Run the Playwright P0 suite N times with --retries=0
# to surface flaky tests before merging to main.
#
# Usage: bash scripts/burn-in.sh [iterations]
#   iterations  Number of full P0 runs (default: 3)
#
# Exits with code 1 if any run fails. Each run produces an isolated
# Playwright report so failures can be correlated to specific attempts.
#
# Environment variables:
#   BASE_URL           Frontend URL (default: http://localhost:7000)
#   EZ_API_URL         API URL (default: http://localhost:5001)
#   SCHEDULING_API_URL Scheduling URL (default: http://localhost:5004)

set -euo pipefail

ITERATIONS="${1:-3}"
FRONTEND_DIR="src/Frontend"

export BASE_URL="${BASE_URL:-http://localhost:7000}"
export EZ_API_URL="${EZ_API_URL:-http://localhost:5001}"
export SCHEDULING_API_URL="${SCHEDULING_API_URL:-http://localhost:5004}"

echo "============================================================"
echo "EZ Platform — P0 Burn-In"
echo "Iterations:         $ITERATIONS"
echo "BASE_URL:           $BASE_URL"
echo "EZ_API_URL:         $EZ_API_URL"
echo "SCHEDULING_API_URL: $SCHEDULING_API_URL"
echo "Note: --retries=0 — flaky tests WILL fail (by design)"
echo "============================================================"

# Ensure Playwright is installed
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing npm dependencies..."
  (cd "$FRONTEND_DIR" && npm ci)
fi
(cd "$FRONTEND_DIR" && npx playwright install chromium --with-deps 2>/dev/null)

PASS=0
FAIL=0
FAILED_RUNS=()

for i in $(seq 1 "$ITERATIONS"); do
  echo ""
  echo "─── Run $i / $ITERATIONS ────────────────────────────────────────────"
  REPORT_DIR="playwright-report-burn-in-run${i}"

  if (cd "$FRONTEND_DIR" && \
      npx playwright test --grep @P0 \
        --retries=0 \
        --output="test-results-burn-in-run${i}" \
        --reporter=html,line \
        2>&1); then
    echo "Run $i: PASS"
    ((PASS++)) || true
  else
    echo "Run $i: FAIL"
    ((FAIL++)) || true
    FAILED_RUNS+=("$i")
    # Copy report for this run so it isn't overwritten by next run
    if [[ -d "$FRONTEND_DIR/playwright-report" ]]; then
      cp -r "$FRONTEND_DIR/playwright-report" "$FRONTEND_DIR/$REPORT_DIR" 2>/dev/null || true
    fi
  fi
done

echo ""
echo "============================================================"
echo "Burn-In Results: $PASS/$ITERATIONS passed"
if [[ ${#FAILED_RUNS[@]} -gt 0 ]]; then
  echo "Failed runs: ${FAILED_RUNS[*]}"
  echo "Reports saved in: src/Frontend/playwright-report-burn-in-run{n}/"
  echo "============================================================"
  exit 1
fi
echo "All $ITERATIONS runs passed — suite is stable."
echo "============================================================"

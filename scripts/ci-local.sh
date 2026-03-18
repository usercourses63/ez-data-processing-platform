#!/bin/bash
# ci-local.sh — Mirror the GitHub Actions CI environment locally
# Usage: bash scripts/ci-local.sh [p0|unit|all]
#
# Runs the same commands CI runs so "it works in CI" failures are caught early.
# Requires: dotnet, node, npm, kubectl (for k8s-dependent E2E)
#
# Environment variables (override defaults):
#   BASE_URL           Frontend URL (default: http://localhost:7000)
#   EZ_API_URL         DataSourceManagement API (default: http://localhost:5001)
#   SCHEDULING_API_URL Scheduling API (default: http://localhost:5004)

set -euo pipefail

MODE="${1:-all}"
FRONTEND_DIR="src/Frontend"

export BASE_URL="${BASE_URL:-http://localhost:7000}"
export EZ_API_URL="${EZ_API_URL:-http://localhost:5001}"
export SCHEDULING_API_URL="${SCHEDULING_API_URL:-http://localhost:5004}"

echo "============================================================"
echo "EZ Platform — CI Local Runner"
echo "Mode: $MODE"
echo "BASE_URL:           $BASE_URL"
echo "EZ_API_URL:         $EZ_API_URL"
echo "SCHEDULING_API_URL: $SCHEDULING_API_URL"
echo "============================================================"
echo ""

# ── Preflight checks ──────────────────────────────────────────────────────────
echo "[ Preflight ] Checking tool availability..."
command -v dotnet >/dev/null || { echo "ERROR: dotnet not found"; exit 1; }
command -v node   >/dev/null || { echo "ERROR: node not found"; exit 1; }
command -v npm    >/dev/null || { echo "ERROR: npm not found"; exit 1; }
echo "  dotnet: $(dotnet --version)"
echo "  node:   $(node --version)"
echo "  npm:    $(npm --version)"

# ── .NET unit tests ───────────────────────────────────────────────────────────
run_unit_tests() {
  echo ""
  echo "[ Unit Tests ] Running all .NET test projects..."

  declare -A PROJECTS=(
    ["Shared"]="tests/Shared.Tests/DataProcessing.Shared.Tests.csproj"
    ["Integration"]="tests/IntegrationTests/DataProcessing.IntegrationTests.csproj"
    ["ValidationService"]="tests/ValidationService.Tests/DataProcessing.Validation.Tests.csproj"
    ["OutputService"]="tests/OutputService.Tests/DataProcessing.Output.Tests.csproj"
    ["SchedulingService"]="tests/SchedulingService.Tests/DataProcessing.Scheduling.Tests.csproj"
    ["DataSourceManagement"]="tests/DataSourceManagement.Tests/DataProcessing.DataSourceManagement.Tests.csproj"
    ["InvalidRecordsService"]="tests/InvalidRecordsService.Tests/InvalidRecordsService.Tests.csproj"
    ["MetricsConfiguration"]="tests/MetricsConfiguration.Tests/MetricsConfiguration.Tests.csproj"
  )

  FAILED=()
  for name in "${!PROJECTS[@]}"; do
    proj="${PROJECTS[$name]}"
    if [[ ! -f "$proj" ]]; then
      echo "  SKIP $name (project not found at $proj)"
      continue
    fi
    echo "  → $name..."
    filter_arg=""
    if [[ "$name" == "Integration" ]]; then
      filter_arg="--filter TestCategory!=Infrastructure"
    fi
    if dotnet test "$proj" \
        --no-restore \
        --configuration Release \
        $filter_arg \
        --logger "console;verbosity=minimal" \
        --results-directory "TestResults/$name" 2>&1; then
      echo "    PASS"
    else
      echo "    FAIL"
      FAILED+=("$name")
    fi
  done

  if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo ""
    echo "FAILED test projects: ${FAILED[*]}"
    return 1
  fi
  echo "All .NET tests passed."
}

# ── Playwright P0 E2E tests ───────────────────────────────────────────────────
run_p0_tests() {
  echo ""
  echo "[ E2E P0 ] Installing Playwright Chromium + running P0 smoke suite..."

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "  → npm ci..."
    (cd "$FRONTEND_DIR" && npm ci)
  fi

  echo "  → Installing Chromium..."
  (cd "$FRONTEND_DIR" && npx playwright install chromium --with-deps)

  echo "  → Running @P0 tests..."
  (cd "$FRONTEND_DIR" && npm run test:e2e:p0)
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$MODE" in
  unit)    run_unit_tests ;;
  p0)      run_p0_tests ;;
  all)
    run_unit_tests
    run_p0_tests
    ;;
  *)
    echo "Usage: $0 [unit|p0|all]"
    exit 1
    ;;
esac

echo ""
echo "============================================================"
echo "CI local run complete."
echo "============================================================"

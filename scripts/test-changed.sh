#!/bin/bash
# test-changed.sh — Run tests for files changed since origin/main
# Usage: bash scripts/test-changed.sh [--backend] [--frontend] [--all]
#
# With no args: auto-detects what changed and runs relevant tests.
# --backend: force run all .NET tests
# --frontend: force run Playwright P0 suite
# --all: run everything

set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-origin/main}"
FRONTEND_DIR="src/Frontend"
DOTNET_VERSION="10.0.x"

# Parse flags
RUN_BACKEND=false
RUN_FRONTEND=false
RUN_ALL=false

for arg in "$@"; do
  case "$arg" in
    --backend)  RUN_BACKEND=true ;;
    --frontend) RUN_FRONTEND=true ;;
    --all)      RUN_ALL=true ;;
  esac
done

# Auto-detect if no flags provided
if [[ "$RUN_BACKEND" == "false" && "$RUN_FRONTEND" == "false" && "$RUN_ALL" == "false" ]]; then
  CHANGED=$(git diff --name-only "$BASE_BRANCH"...HEAD 2>/dev/null || git diff --name-only HEAD~1...HEAD)

  if echo "$CHANGED" | grep -qE '^src/Services/|^tests/|\.csproj$|Directory\.Packages\.props'; then
    RUN_BACKEND=true
  fi

  if echo "$CHANGED" | grep -qE '^src/Frontend/'; then
    RUN_FRONTEND=true
  fi

  if [[ "$RUN_BACKEND" == "false" && "$RUN_FRONTEND" == "false" ]]; then
    echo "No test-relevant changes detected (backend or frontend). Exiting."
    exit 0
  fi
fi

if [[ "$RUN_ALL" == "true" ]]; then
  RUN_BACKEND=true
  RUN_FRONTEND=true
fi

# ── Backend (.NET) ────────────────────────────────────────────────────────────
if [[ "$RUN_BACKEND" == "true" ]]; then
  echo ""
  echo "=== Running .NET tests for changed service(s) ==="

  TEST_PROJECTS=(
    "tests/Shared.Tests/DataProcessing.Shared.Tests.csproj"
    "tests/IntegrationTests/DataProcessing.IntegrationTests.csproj"
    "tests/ValidationService.Tests/DataProcessing.Validation.Tests.csproj"
    "tests/OutputService.Tests/DataProcessing.Output.Tests.csproj"
    "tests/SchedulingService.Tests/DataProcessing.Scheduling.Tests.csproj"
    "tests/DataSourceManagement.Tests/DataProcessing.DataSourceManagement.Tests.csproj"
    "tests/InvalidRecordsService.Tests/InvalidRecordsService.Tests.csproj"
    "tests/MetricsConfiguration.Tests/MetricsConfiguration.Tests.csproj"
  )

  FAILED=()
  for proj in "${TEST_PROJECTS[@]}"; do
    if [[ -f "$proj" ]]; then
      name=$(basename "$(dirname "$proj")")
      echo "  → $name"
      # IntegrationTests: skip infrastructure-dependent tests
      filter=""
      if [[ "$proj" == *"IntegrationTests"* ]]; then
        filter="--filter TestCategory!=Infrastructure"
      fi
      if ! dotnet test "$proj" --no-restore --configuration Release $filter \
          --logger "console;verbosity=minimal" 2>&1; then
        FAILED+=("$name")
      fi
    fi
  done

  if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo ""
    echo "FAILED: ${FAILED[*]}"
    exit 1
  fi
  echo "All .NET tests passed."
fi

# ── Frontend (Playwright P0) ───────────────────────────────────────────────────
if [[ "$RUN_FRONTEND" == "true" ]]; then
  echo ""
  echo "=== Running Playwright P0 smoke suite ==="

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "  → Installing npm dependencies..."
    (cd "$FRONTEND_DIR" && npm ci)
  fi

  (cd "$FRONTEND_DIR" && npm run test:e2e:p0)
fi

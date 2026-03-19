#!/bin/bash
set -euo pipefail

# ============================================================================
# EZ Platform - Local Sanity Deploy & Test Script
# Performs a full clean deploy from dist/ artifacts and runs the sanity test
# suite twice in headed browser mode to verify consistency.
#
# Usage:
#   bash scripts/sanity-test.sh [/path/to/deployment-package]
#
# If no path is given, the script auto-detects the latest dist/deployment-*/
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="ez-platform"

# ---------------------------------------------------------------------------
# Step 1 - Auto-detect deployment package
# ---------------------------------------------------------------------------
PKG_DIR="${1:-}"

if [ -z "$PKG_DIR" ]; then
  PKG_DIR=$(ls -dt "$REPO_ROOT"/dist/deployment-*/ 2>/dev/null | head -1)
fi

if [ -z "$PKG_DIR" ]; then
  echo "ERROR: No deployment package found in dist/"
  echo "Run these commands first:"
  echo "  bash scripts/build-all-images.sh"
  echo "  bash scripts/assemble-package.sh"
  exit 1
fi

if [ ! -d "$PKG_DIR/images/services" ]; then
  echo "ERROR: $PKG_DIR/images/services does not exist. Invalid deployment package."
  exit 1
fi

echo "==> Using deployment package: $PKG_DIR"

# ---------------------------------------------------------------------------
# Step 2 - Cleanup trap
# ---------------------------------------------------------------------------
PIDS=()
cleanup() {
  echo "==> Cleaning up background port-forwards..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Step 3 - Delete namespace
# ---------------------------------------------------------------------------
echo "==> Deleting namespace $NAMESPACE..."
kubectl delete namespace "$NAMESPACE" --ignore-not-found --timeout=120s --wait=true

# ---------------------------------------------------------------------------
# Step 4 - Remove cached application images from minikube
# ---------------------------------------------------------------------------
echo "==> Removing cached ez-platform images from minikube..."
for img in $(minikube image ls 2>/dev/null | grep "ez-platform/" || true); do
  minikube image rm "$img" 2>/dev/null || true
done

# ---------------------------------------------------------------------------
# Step 5 - Load service images (parallel)
# ---------------------------------------------------------------------------
echo "==> Loading service images into minikube (parallel)..."
LOAD_PIDS=()
for tar in "$PKG_DIR"/images/services/*.tar; do
  [ -f "$tar" ] && { echo "  Loading $tar ..."; minikube image load "$tar" & LOAD_PIDS+=($!); }
done
for pid in "${LOAD_PIDS[@]}"; do
  wait "$pid" || { echo "ERROR: image load failed"; exit 1; }
done

# ---------------------------------------------------------------------------
# Step 6 - Load infrastructure images (parallel)
# ---------------------------------------------------------------------------
if [ -d "$PKG_DIR/images/infrastructure" ]; then
  INFRA_TARS=("$PKG_DIR"/images/infrastructure/*.tar)
  if [ -e "${INFRA_TARS[0]}" ]; then
    echo "==> Loading infrastructure images into minikube (parallel)..."
    LOAD_PIDS=()
    for tar in "${INFRA_TARS[@]}"; do
      [ -f "$tar" ] && { echo "  Loading $tar ..."; minikube image load "$tar" & LOAD_PIDS+=($!); }
    done
    for pid in "${LOAD_PIDS[@]}"; do
      wait "$pid" || { echo "ERROR: infrastructure image load failed"; exit 1; }
    done
  fi
fi

# ---------------------------------------------------------------------------
# Step 7 - Helm deploy
# ---------------------------------------------------------------------------
echo "==> Deploying via Helm..."
helm upgrade --install ez-platform "$REPO_ROOT/helm/ez-platform" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --values "$REPO_ROOT/helm/ez-platform/values-local.yaml" \
  --wait \
  --timeout 15m

# ---------------------------------------------------------------------------
# Step 8 - Wait for pods
# ---------------------------------------------------------------------------
echo "==> Waiting for all pods to be Ready..."
kubectl wait --for=condition=Ready pod --all -n "$NAMESPACE" --timeout=300s || {
  echo "Pod readiness timeout:"
  kubectl get pods -n "$NAMESPACE"
  exit 1
}

# ---------------------------------------------------------------------------
# Step 9 - Start port-forwards (background)
# ---------------------------------------------------------------------------
echo "==> Starting port-forwards..."
kubectl port-forward svc/datasource-management 5001:5001 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/metrics-configuration 5002:5002 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/validation 5003:5003 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/scheduling 5004:5004 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/invalidrecords 5007:5007 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/fileprocessor 5008:5008 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/output 5009:5009 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/frontend 7000:8080 -n "$NAMESPACE" &
PIDS+=($!)
kubectl port-forward svc/docs 30800:80 -n "$NAMESPACE" &
PIDS+=($!)
sleep 10

# ---------------------------------------------------------------------------
# Step 10 - Seed with DemoDataGenerator
# ---------------------------------------------------------------------------
echo "==> Seeding cluster with DemoDataGenerator..."
dotnet run --project "$REPO_ROOT/tools/DemoDataGenerator" -- --direct-connection --api-url http://localhost:5001

# ---------------------------------------------------------------------------
# Step 11 - Ensure Playwright installed
# ---------------------------------------------------------------------------
echo "==> Ensuring Playwright chromium is installed..."
cd "$REPO_ROOT/src/Frontend"
npx playwright install chromium

# ---------------------------------------------------------------------------
# Step 12 - Run sanity tests twice
# ---------------------------------------------------------------------------
echo "==> Running sanity tests (Run 1 of 2)..."
RUN1_EXIT=0
npm run test:e2e:sanity:headed || RUN1_EXIT=$?

echo "==> Running sanity tests (Run 2 of 2)..."
RUN2_EXIT=0
npm run test:e2e:sanity:headed || RUN2_EXIT=$?

# ---------------------------------------------------------------------------
# Step 13 - Print summary
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "  SANITY TEST RESULTS"
echo "========================================"
echo "Run 1: $([ $RUN1_EXIT -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "Run 2: $([ $RUN2_EXIT -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
if [ $RUN1_EXIT -eq 0 ] && [ $RUN2_EXIT -eq 0 ]; then
  echo "OVERALL: PASSED"
else
  echo "OVERALL: FAILED"
fi
echo "========================================"
exit $(( RUN1_EXIT + RUN2_EXIT > 0 ? 1 : 0 ))

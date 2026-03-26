#!/usr/bin/env bash
# Clean Deploy Pipeline for EZ Platform
# Full wipe + Helm install + seed + port-forward
# Usage: bash scripts/clean-deploy.sh [--skip-seed] [--skip-portforward] [--yes]

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
NAMESPACE="${EZ_NAMESPACE:-ez-platform}"
HELM_RELEASE="ez-platform"
HELM_CHART="./helm/ez-platform"
VALUES_FILE="helm/ez-platform/values.yaml"
# Production deploy: use only values.yaml (no dev overrides)
# For dev: set EZ_VALUES_DEV=helm/ez-platform/values-dev.yaml
VALUES_DEV_FILE="${EZ_VALUES_DEV:-}"
PORT_FORWARD_SCRIPT="scripts/start-port-forwards.ps1"
DEMO_DATA_DIR="tools/DemoDataGenerator"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Flags
SKIP_SEED=false
SKIP_PORTFORWARD=false
AUTO_YES=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Track which phase we're in for error reporting
CURRENT_PHASE=""

# ============================================================================
# Utility Functions
# ============================================================================

log_phase() {
  CURRENT_PHASE="$1"
  echo -e "\n${CYAN}========================================${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${CYAN}========================================${NC}"
}

log_ok() {
  echo -e "${GREEN}  [OK] $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}  [WARN] $1${NC}"
}

log_err() {
  echo -e "${RED}  [ERROR] $1${NC}"
}

log_info() {
  echo -e "  $1"
}

cleanup_on_exit() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo ""
    log_err "Clean deploy FAILED during: $CURRENT_PHASE"
    log_err "Exit code: $exit_code"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check pod status:  kubectl get pods -n $NAMESPACE"
    echo "  - Check events:      kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
    echo "  - Check pod logs:    kubectl logs -f <pod-name> -n $NAMESPACE"
    echo "  - Retry deploy:      bash scripts/clean-deploy.sh --yes --skip-seed"
  fi
}

trap cleanup_on_exit EXIT

# ============================================================================
# Parse Arguments
# ============================================================================

for arg in "$@"; do
  case $arg in
    --skip-seed)
      SKIP_SEED=true
      ;;
    --skip-portforward)
      SKIP_PORTFORWARD=true
      ;;
    --yes|-y)
      AUTO_YES=true
      ;;
    --help|-h)
      echo "Usage: bash scripts/clean-deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-seed          Skip DemoDataGenerator seeding"
      echo "  --skip-portforward   Skip port forwarding setup"
      echo "  --yes, -y            Skip confirmation prompt"
      echo "  --help, -h           Show this help message"
      echo ""
      echo "This script performs a full clean deploy of EZ Platform:"
      echo "  Phase 1: Pre-flight checks (kubectl, helm, dotnet, minikube)"
      echo "  Phase 2: Namespace wipe (delete + recreate ez-platform)"
      echo "  Phase 3: Helm install (from values.yaml + values-dev.yaml)"
      echo "  Phase 4: Wait for pods (infrastructure first, then all)"
      echo "  Phase 5: MongoDB replica set init (idempotent)"
      echo "  Phase 6: Port forwarding (via start-port-forwards.ps1)"
      echo "  Phase 7: Seed data (DemoDataGenerator --direct-connection)"
      echo "  Phase 8: Summary (pod count, access URLs, next steps)"
      exit 0
      ;;
    *)
      log_err "Unknown argument: $arg"
      echo "Use --help for usage information."
      exit 1
      ;;
  esac
done

# Move to project root
cd "$PROJECT_ROOT"

# ============================================================================
# Phase 1: Pre-flight Checks
# ============================================================================
log_phase "[Phase 1/8] Pre-flight checks"

PREFLIGHT_OK=true

# Check kubectl
if command -v kubectl &>/dev/null; then
  log_ok "kubectl found: $(kubectl version --client --short 2>/dev/null || kubectl version --client -o json 2>/dev/null | grep -o '"gitVersion":"[^"]*"' | head -1)"
else
  log_err "kubectl not found. Install kubectl first."
  PREFLIGHT_OK=false
fi

# Check helm
if command -v helm &>/dev/null; then
  log_ok "helm found: $(helm version --short 2>/dev/null)"
else
  log_err "helm not found. Install helm first."
  PREFLIGHT_OK=false
fi

# Check dotnet (needed for seeding)
if [ "$SKIP_SEED" = false ]; then
  if command -v dotnet &>/dev/null; then
    log_ok "dotnet found: $(dotnet --version 2>/dev/null)"
  else
    log_warn "dotnet not found. Seeding will be skipped."
    SKIP_SEED=true
  fi
else
  log_info "Skipping dotnet check (--skip-seed)"
fi

# Check minikube is running
if minikube status --format='{{.Host}}' 2>/dev/null | grep -q "Running"; then
  log_ok "minikube is running"
else
  log_err "minikube is not running. Start it with: minikube start"
  PREFLIGHT_OK=false
fi

# Check Helm chart exists
if [ -f "$VALUES_FILE" ] && [ -f "$VALUES_DEV_FILE" ]; then
  log_ok "Helm chart found at $HELM_CHART"
else
  log_err "Helm chart not found. Expected $VALUES_FILE and $VALUES_DEV_FILE"
  PREFLIGHT_OK=false
fi

if [ "$PREFLIGHT_OK" = false ]; then
  log_err "Pre-flight checks failed. Fix the issues above and retry."
  exit 1
fi

# Confirmation prompt
if [ "$AUTO_YES" = false ]; then
  echo ""
  echo -e "${YELLOW}WARNING: This will DELETE all data in the '$NAMESPACE' namespace.${NC}"
  echo -e "${YELLOW}All pods, services, PVCs, and data will be destroyed.${NC}"
  read -r -p "Continue? [y/N] " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo ""
log_ok "Pre-flight checks passed. Starting clean deploy..."

# ============================================================================
# Phase 2: Namespace Wipe
# ============================================================================
log_phase "[Phase 2/8] Namespace wipe"

# Uninstall any existing Helm release first (prevents orphaned resources)
if helm status "$HELM_RELEASE" -n "$NAMESPACE" &>/dev/null; then
  log_info "Uninstalling existing Helm release '$HELM_RELEASE'..."
  helm uninstall "$HELM_RELEASE" -n "$NAMESPACE" --wait --timeout 120s 2>/dev/null || true
  log_ok "Helm release uninstalled"
fi

# Clean up cluster-scoped PVs in Released state (from previous namespace)
# PVs are cluster-scoped — namespace delete does NOT remove them.
# Released PVs with Retain policy block new PVCs with the same names from binding.
RELEASED_PVS=$(kubectl get pv --no-headers 2>/dev/null | awk '$5=="Released" {print $1}')
if [ -n "$RELEASED_PVS" ]; then
  RELEASED_COUNT=$(echo "$RELEASED_PVS" | wc -l)
  log_info "Cleaning up $RELEASED_COUNT Released PVs (cluster-scoped, left from previous deploy)..."
  echo "$RELEASED_PVS" | while read PV; do kubectl delete pv "$PV" --force 2>/dev/null; done
  log_ok "Released PVs cleaned up"
fi

# Delete namespace
log_info "Deleting namespace '$NAMESPACE'..."
kubectl delete namespace "$NAMESPACE" --ignore-not-found --wait=true --timeout=120s 2>/dev/null || true

# Wait for namespace to be fully gone
log_info "Waiting for namespace to be fully removed..."
WAIT_COUNT=0
MAX_WAIT=60
while kubectl get namespace "$NAMESPACE" &>/dev/null; do
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    log_err "Namespace '$NAMESPACE' still exists after ${MAX_WAIT}s. May need manual intervention."
    log_info "Try: kubectl delete namespace $NAMESPACE --force --grace-period=0"
    exit 1
  fi
  sleep 2
done
log_ok "Namespace '$NAMESPACE' deleted"

# Recreate namespace
log_info "Creating namespace '$NAMESPACE'..."
kubectl create namespace "$NAMESPACE"
log_ok "Namespace '$NAMESPACE' created"

# ============================================================================
# Phase 3: Helm Install
# ============================================================================
log_phase "[Phase 3/8] Helm install"

log_info "Installing Helm release '$HELM_RELEASE' from $HELM_CHART..."

HELM_CMD=(helm install "$HELM_RELEASE" "$HELM_CHART" -n "$NAMESPACE" -f "$VALUES_FILE")
if [[ -n "$VALUES_DEV_FILE" && -f "$VALUES_DEV_FILE" ]]; then
  HELM_CMD+=(-f "$VALUES_DEV_FILE")
  log_info "Values: $VALUES_FILE + $VALUES_DEV_FILE"
else
  log_info "Values: $VALUES_FILE (production)"
fi
HELM_CMD+=(--set "global.namespace=$NAMESPACE" --wait=false --timeout 600s)

if "${HELM_CMD[@]}"; then
  log_ok "Helm install submitted"
else
  log_err "Helm install failed. Check chart templates and values."
  log_info "Debug: helm install --dry-run --debug $HELM_RELEASE $HELM_CHART -n $NAMESPACE -f $VALUES_FILE ${VALUES_DEV_FILE:+-f $VALUES_DEV_FILE}"
  exit 1
fi

# ============================================================================
# Phase 4: Wait for Pods
# ============================================================================
log_phase "[Phase 4/8] Waiting for pods"

# Wait for infrastructure first
log_info "Waiting for MongoDB..."
if kubectl wait --for=condition=ready pod -l app=mongodb -n "$NAMESPACE" --timeout=300s 2>/dev/null; then
  log_ok "MongoDB is ready"
else
  log_warn "MongoDB wait timed out. Checking status..."
  kubectl get pods -l app=mongodb -n "$NAMESPACE" 2>/dev/null || true
fi

log_info "Waiting for Kafka..."
if kubectl wait --for=condition=ready pod -l app=kafka -n "$NAMESPACE" --timeout=300s 2>/dev/null; then
  log_ok "Kafka is ready"
else
  log_warn "Kafka wait timed out. Checking status..."
  kubectl get pods -l app=kafka -n "$NAMESPACE" 2>/dev/null || true
fi

log_info "Waiting for Hazelcast..."
if kubectl wait --for=condition=ready pod -l app=hazelcast -n "$NAMESPACE" --timeout=300s 2>/dev/null; then
  log_ok "Hazelcast is ready"
else
  log_warn "Hazelcast wait timed out. Checking status..."
  kubectl get pods -l app=hazelcast -n "$NAMESPACE" 2>/dev/null || true
fi

# Wait for all pods
log_info "Waiting for all pods to be ready (up to 10 minutes)..."
if kubectl wait --for=condition=ready pod --all -n "$NAMESPACE" --timeout=600s 2>/dev/null; then
  log_ok "All pods are ready"
else
  log_warn "Some pods may not be ready. Checking status..."
fi

# Print pod status
echo ""
log_info "Pod status:"
kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null || true

# Check for non-Running pods
NOT_RUNNING=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -v "Running" | grep -v "Completed" || true)
if [ -n "$NOT_RUNNING" ]; then
  echo ""
  log_warn "Pods not in Running state:"
  echo "$NOT_RUNNING"
  echo ""
  log_info "Checking logs for non-running pods..."
  while IFS= read -r line; do
    POD_NAME=$(echo "$line" | awk '{print $1}')
    log_info "--- Logs for $POD_NAME ---"
    kubectl logs "$POD_NAME" -n "$NAMESPACE" --tail=20 2>/dev/null || true
  done <<< "$NOT_RUNNING"
fi

# ============================================================================
# Phase 5: MongoDB Replica Set Init
# ============================================================================
log_phase "[Phase 5/8] MongoDB replica set initialization"

# Check if replica set is already initialized
RS_STATUS=$(kubectl exec -n "$NAMESPACE" mongodb-0 -- mongosh --quiet --eval "try { rs.status().ok } catch(e) { 0 }" 2>/dev/null || echo "0")

if [ "$RS_STATUS" = "1" ]; then
  log_ok "MongoDB replica set already initialized"
else
  log_info "Initializing MongoDB replica set..."
  if kubectl exec -n "$NAMESPACE" mongodb-0 -- mongosh --quiet --eval \
    'rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb-0.mongodb:27017"}]})' 2>/dev/null; then
    log_ok "MongoDB replica set initialized"
    # Wait for RS to stabilize
    log_info "Waiting for replica set to elect primary..."
    sleep 5
    RS_CHECK=$(kubectl exec -n "$NAMESPACE" mongodb-0 -- mongosh --quiet --eval "rs.status().ok" 2>/dev/null || echo "0")
    if [ "$RS_CHECK" = "1" ]; then
      log_ok "MongoDB replica set is healthy"
    else
      log_warn "Replica set may still be stabilizing"
    fi
  else
    log_warn "MongoDB replica set init failed. May need manual intervention."
    log_info "Try: kubectl exec -it mongodb-0 -n $NAMESPACE -- mongosh --eval 'rs.initiate()'"
  fi
fi

# ============================================================================
# Phase 6: Port Forwarding
# ============================================================================
log_phase "[Phase 6/8] Port forwarding"

if [ "$SKIP_PORTFORWARD" = true ]; then
  log_info "Skipping port forwarding (--skip-portforward)"
else
  # Kill existing port forwards
  log_info "Cleaning up existing port forwards..."
  taskkill //F //IM kubectl.exe 2>/dev/null || true
  sleep 2

  log_info "Starting port forwards via $PORT_FORWARD_SCRIPT..."
  powershell.exe -ExecutionPolicy Bypass -File "$PORT_FORWARD_SCRIPT" &
  PF_PID=$!

  # Wait for port forwards to establish
  log_info "Waiting for port forwards to establish (10s)..."
  sleep 10

  # Verify key ports are responding
  HEALTH_OK=false
  for attempt in 1 2 3; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://127.0.0.1:5001/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      log_ok "DataSourceManagement API responding (HTTP $HTTP_CODE)"
      HEALTH_OK=true
      break
    else
      log_info "Attempt $attempt: API returned HTTP $HTTP_CODE, retrying in 5s..."
      sleep 5
    fi
  done

  if [ "$HEALTH_OK" = false ]; then
    log_warn "DataSourceManagement API not yet responding. Port forwards may need more time."
    log_info "Check manually: curl http://127.0.0.1:5001/health"
  fi

  # Check frontend
  FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://127.0.0.1:7000 2>/dev/null || echo "000")
  if [ "$FRONTEND_CODE" = "200" ] || [ "$FRONTEND_CODE" = "304" ]; then
    log_ok "Frontend responding (HTTP $FRONTEND_CODE)"
  else
    log_warn "Frontend returned HTTP $FRONTEND_CODE"
  fi
fi

# ============================================================================
# Phase 7: Seed Data
# ============================================================================
log_phase "[Phase 7/8] Seed data"

if [ "$SKIP_SEED" = true ]; then
  log_info "Skipping data seeding (--skip-seed)"
else
  if [ -d "$DEMO_DATA_DIR" ]; then
    # Include simulator flags for NAS/server creation if simulator is available
    SIMULATOR_URL="${FILE_SIMULATOR_URL:-http://172.30.26.249:30500}"
    SIMULATOR_FLAGS=""
    if curl -s --connect-timeout 3 "$SIMULATOR_URL/health" 2>/dev/null | grep -q "Healthy"; then
      SIMULATOR_FLAGS="--use-simulator --create-servers --provision-nas --api-url=http://127.0.0.1:5001 --simulator-url $SIMULATOR_URL"
      log_info "File simulator detected at $SIMULATOR_URL — including server/NAS creation + provisioning"
    else
      log_warn "File simulator not available — seeding without servers/NAS"
    fi

    log_info "Running DemoDataGenerator with --direct-connection $SIMULATOR_FLAGS..."
    pushd "$DEMO_DATA_DIR" > /dev/null

    if dotnet run -- --direct-connection $SIMULATOR_FLAGS; then
      log_ok "DemoDataGenerator completed successfully"
    else
      log_warn "DemoDataGenerator exited with errors. Data may be partially seeded."
    fi

    popd > /dev/null

    # Verify seeding
    log_info "Verifying seeded data..."
    SEED_RESPONSE=$(curl -s --connect-timeout 5 http://127.0.0.1:5001/api/v1/datasource 2>/dev/null || echo "")
    if [ -n "$SEED_RESPONSE" ]; then
      # Try to count items
      ITEM_COUNT=$(echo "$SEED_RESPONSE" | grep -o '"ID"' | wc -l 2>/dev/null || echo "?")
      log_ok "API returning datasource data ($ITEM_COUNT items detected)"
    else
      log_warn "Could not verify seeded data via API"
    fi
  else
    log_warn "DemoDataGenerator not found at $DEMO_DATA_DIR. Skipping seeding."
  fi
fi

# ============================================================================
# Phase 8: Summary
# ============================================================================
log_phase "[Phase 8/8] Deploy Summary"

echo ""

# Pod count
TOTAL_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
RUNNING_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || echo "0")
echo -e "  Pods: ${GREEN}$RUNNING_PODS${NC} running / $TOTAL_PODS total"

# Namespace status
echo -e "  Namespace: ${GREEN}$NAMESPACE${NC}"

# Helm release
HELM_STATUS=$(helm status "$HELM_RELEASE" -n "$NAMESPACE" --short 2>/dev/null || echo "unknown")
echo -e "  Helm release: $HELM_RELEASE ($HELM_STATUS)"

echo ""
echo -e "${CYAN}Access URLs:${NC}"
echo "  Frontend:              http://localhost:7000"
echo "  DataSource API:        http://localhost:5001/api/v1/datasource"
echo "  Invalid Records API:   http://localhost:5007/api/v1/invalid-records"
echo "  Metrics API:           http://localhost:5002/api/v1/metrics"
echo "  Grafana:               http://localhost:3001"
echo "  Jaeger:                http://localhost:16686"
echo "  Prometheus (System):   http://localhost:9090"
echo "  Prometheus (Business): http://localhost:9091"
echo "  Docs Portal:           http://localhost:30800"

echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Verify frontend:    open http://localhost:7000"
echo "  2. Run sanity tests:   cd src/Frontend && npx playwright test --project=sanity"
echo "  3. Run OCP compliance: bash scripts/verify-ocp-compliance.sh"

echo ""
echo -e "${GREEN}Clean deploy complete!${NC}"

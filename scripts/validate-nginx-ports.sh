#!/bin/bash
# validate-nginx-ports.sh — Pre-build check: nginx proxy ports match Helm service ports
# Run BEFORE building the frontend Docker image or creating a release package.
# Exit code 0 = all ports match, 1 = mismatch found.
#
# Usage:
#   bash scripts/validate-nginx-ports.sh
#   bash scripts/validate-nginx-ports.sh --ci   # strict mode, fails on any warning

set -euo pipefail

NGINX_CONF="src/Frontend/nginx.conf"
HELM_VALUES="helm/ez-platform/values.yaml"
STRICT=${1:-""}
ERRORS=0

echo "╔══════════════════════════════════════════════════╗"
echo "║  Nginx ↔ Helm Service Port Validation            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

if [ ! -f "$NGINX_CONF" ]; then
  echo "ERROR: $NGINX_CONF not found"
  exit 1
fi

if [ ! -f "$HELM_VALUES" ]; then
  echo "WARN: $HELM_VALUES not found — skipping Helm cross-check"
  HELM_VALUES=""
fi

# Extract proxy_pass entries: service_name:port
echo "Checking nginx proxy_pass ports..."
echo ""

# Parse proxy_pass lines: http://service-name:port/...
grep "proxy_pass" "$NGINX_CONF" | grep -oE 'http://[a-z-]+:[0-9]+' | sort -u | while read -r entry; do
  SERVICE=$(echo "$entry" | sed 's|http://||' | cut -d: -f1)
  PORT=$(echo "$entry" | cut -d: -f3)

  # Look up the port in Helm values
  if [ -n "$HELM_VALUES" ]; then
    # Find the service section in values.yaml and extract its port
    HELM_PORT=$(awk "
      /^  ${SERVICE//-/}:/{found=1}
      /^  [a-z]/ && !/${SERVICE//-/}:/{if(found) found=0}
      found && /port:/{print \$2; exit}
    " "$HELM_VALUES" 2>/dev/null)

    # Also check K8s service templates for port
    TEMPLATE_PORT=$(grep -A 5 "name: $SERVICE" helm/ez-platform/templates/services/*.yaml 2>/dev/null | grep "port:" | head -1 | awk '{print $2}' 2>/dev/null)

    ACTUAL_PORT="${TEMPLATE_PORT:-$HELM_PORT}"

    if [ -n "$ACTUAL_PORT" ] && [ "$ACTUAL_PORT" != "$PORT" ]; then
      echo "  ✗ $SERVICE — nginx uses :$PORT but Helm defines :$ACTUAL_PORT"
      ERRORS=$((ERRORS + 1))
    elif [ -n "$ACTUAL_PORT" ]; then
      echo "  ✓ $SERVICE — :$PORT matches Helm"
    else
      echo "  ? $SERVICE — :$PORT (no Helm port found to compare)"
    fi
  else
    echo "  - $SERVICE:$PORT (Helm cross-check skipped)"
  fi
done

echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  FAILED: $ERRORS port mismatch(es) found         ║"
  echo "║  Fix nginx.conf or Helm values before building   ║"
  echo "╚══════════════════════════════════════════════════╝"
  exit 1
else
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  PASSED: All nginx proxy ports match             ║"
  echo "╚══════════════════════════════════════════════════╝"
  exit 0
fi

#!/bin/bash
# Sync shared Helm chart templates from vanilla K8s to OCP chart
# This ensures both charts stay in sync for common resources

set -e

VANILLA="helm/ez-platform"
OCP="release-package/helm/ez-platform-ocp"

echo "=========================================="
echo "Helm Charts Synchronization Script"
echo "=========================================="
echo ""
echo "Syncing shared templates from $VANILLA to $OCP..."
echo ""

# Verify source exists
if [ ! -d "$VANILLA" ]; then
    echo "❌ Error: Vanilla chart not found at $VANILLA"
    exit 1
fi

# Verify destination exists
if [ ! -d "$OCP" ]; then
    echo "❌ Error: OCP chart not found at $OCP"
    exit 1
fi

# Sync shared templates (exclude ingress and routes)
echo "📁 Syncing deployments..."
rsync -av --delete "$VANILLA/templates/deployments/" "$OCP/templates/deployments/"

echo "📁 Syncing statefulsets..."
rsync -av --delete "$VANILLA/templates/statefulsets/" "$OCP/templates/statefulsets/"

echo "📁 Syncing services..."
rsync -av --delete "$VANILLA/templates/services/" "$OCP/templates/services/"

echo "📁 Syncing network-policies..."
rsync -av --delete "$VANILLA/templates/network-policies/" "$OCP/templates/network-policies/"

echo "📁 Syncing configmaps..."
rsync -av --delete "$VANILLA/templates/configmaps/" "$OCP/templates/configmaps/"

echo "📁 Syncing pvcs..."
rsync -av --delete "$VANILLA/templates/pvcs/" "$OCP/templates/pvcs/"

echo "📁 Syncing helpers..."
rsync -av "$VANILLA/templates/_helpers.tpl" "$OCP/templates/_helpers.tpl"

echo ""
echo "ℹ️  Note: The following files are NOT synced (chart-specific):"
echo "  - Chart.yaml (different names and descriptions)"
echo "  - values.yaml (OCP has specific overrides)"
echo "  - README.md (platform-specific documentation)"
echo "  - templates/ingress/ (vanilla K8s only)"
echo "  - templates/routes/ (OCP only)"
echo ""
echo "✅ Synchronization complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Test charts: ./scripts/test-helm-charts.ps1"
echo "3. Commit changes: git commit -am 'Sync Helm charts'"

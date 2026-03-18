#!/bin/bash
set -euo pipefail

VERSION="${1:-v0.0.0}"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
PKG_NAME="deployment-${VERSION}-${TIMESTAMP}"
OUTPUT_BASE="${2:-dist}"
PKG_DIR="${OUTPUT_BASE}/${PKG_NAME}"

echo "Assembling deployment package: $PKG_NAME"

# Require dist/images/ populated by prior scripts
if [ ! -d "${OUTPUT_BASE}/images/services" ]; then
  echo "ERROR: ${OUTPUT_BASE}/images/services not found. Run build-all-images.sh first." >&2
  exit 1
fi

mkdir -p "$PKG_DIR/images/services"
mkdir -p "$PKG_DIR/images/infrastructure"

# Copy image tars
cp "${OUTPUT_BASE}/images/services/"*.tar "$PKG_DIR/images/services/" || true
cp "${OUTPUT_BASE}/images/infrastructure/"*.tar "$PKG_DIR/images/infrastructure/" || true

# Copy Helm chart
mkdir -p "$PKG_DIR/helm"
cp -r helm/ez-platform "$PKG_DIR/helm/"

# Copy values file
cp helm/ez-platform/values-local.yaml "$PKG_DIR/values-local.yaml"

# Copy install scripts
cp release-package/install.ps1 "$PKG_DIR/install.ps1"

# Create bash installer (install.sh) — simplified wrapper
cat > "$PKG_DIR/install.sh" << 'INSTALL_SH'
#!/bin/bash
set -euo pipefail
NAMESPACE="${1:-ez-platform}"
TIMEOUT="${2:-15m}"
echo "Loading EZ Platform images into cluster..."
for tar in images/services/*.tar images/infrastructure/*.tar; do
  echo "  Loading $tar ..."
  minikube image load "$tar"
done
echo "Deploying via Helm..."
helm upgrade --install ez-platform ./helm/ez-platform \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --values values-local.yaml \
  --wait \
  --timeout "$TIMEOUT"
echo "Deployment complete. Run: kubectl get pods -n $NAMESPACE"
INSTALL_SH
chmod +x "$PKG_DIR/install.sh"

# Copy IMAGE-MANIFEST.txt
cp release-package/IMAGE-MANIFEST.txt "$PKG_DIR/IMAGE-MANIFEST.txt"

# Update version in manifest
sed -i "s/:v0\.[0-9]\+\.[0-9]\+/:${VERSION}/g" "$PKG_DIR/IMAGE-MANIFEST.txt" 2>/dev/null || true

# Copy DEPLOYMENT-GUIDE.md if present
if [ -f "release-package/README.md" ]; then
  cp release-package/README.md "$PKG_DIR/DEPLOYMENT-GUIDE.md"
fi

echo "Package assembled at: $PKG_DIR"
echo "Contents:"
find "$PKG_DIR" -type f | sort

# Record the package name for CI artifact upload
echo "PKG_NAME=$PKG_NAME" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
echo "PKG_DIR=$PKG_DIR" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true

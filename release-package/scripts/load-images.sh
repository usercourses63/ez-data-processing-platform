#!/bin/bash
# Load all EZ Platform Docker images from .tar files
# Run from release-package directory
#
# ⚠️  LEGACY SCRIPT WARNING ⚠️
# This bash script is maintained for Linux compatibility only.
# For Windows deployments, use PowerShell equivalents.
# PowerShell scripts are the primary and recommended method.
#

set -e

echo "Loading EZ Platform Docker Images"
echo "=================================="

IMAGE_DIR="images"
LOADED=0
FAILED=0

if [ ! -d "$IMAGE_DIR" ]; then
    echo "ERROR: images/ directory not found"
    exit 1
fi

echo "Loading images from $IMAGE_DIR/"
echo ""

for tarfile in "$IMAGE_DIR"/*.tar; do
    if [ -f "$tarfile" ]; then
        filename=$(basename "$tarfile")
        echo "Loading $filename..."

        if docker load -i "$tarfile"; then
            echo "  ✅ SUCCESS"
            ((LOADED++))
        else
            echo "  ❌ FAILED"
            ((FAILED++))
        fi
    fi
done

echo ""
echo "=================================="
echo "Load Complete!"
echo "Loaded: $LOADED images"
echo "Failed: $FAILED images"

if [ $FAILED -gt 0 ]; then
    echo "WARNING: Some images failed to load"
    exit 1
fi

echo ""
echo "Verify loaded images:"
docker images | grep -E "v0.1.0-beta|mongo|rabbitmq|kafka|hazelcast|elasticsearch|prometheus|grafana|jaeger|otel|fluent"

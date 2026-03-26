#!/usr/bin/env bash
set -e

APP_NAME="docs-viewer"
BUILD_DIR="dist"

echo "[Build] Cleaning previous builds..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "[Build] Verifying Docusaurus build folder exists..."
if [ ! -d "build" ]; then
    echo "[ERROR] 'build' folder not found!"
    echo "        Run 'npm run build' in your Docusaurus project first,"
    echo "        then copy the 'build' folder here."
    exit 1
fi

build_target() {
    local OS=$1
    local ARCH=$2
    local EXT=$3
    echo "[Build] Compiling for $OS/$ARCH..."
    GOOS=$OS GOARCH=$ARCH go build \
        -ldflags="-s -w" \
        -o "$BUILD_DIR/${APP_NAME}-${OS}-${ARCH}${EXT}" \
        .
}

build_target windows amd64 ".exe"
build_target linux   amd64 ""
build_target linux   arm64 ""
build_target darwin  amd64 ""
build_target darwin  arm64 ""

echo ""
echo "[Build] Done! Binaries in ./$BUILD_DIR/"
ls -lh "$BUILD_DIR/"

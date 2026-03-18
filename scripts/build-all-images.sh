#!/bin/bash
set -euo pipefail

VERSION="${1:-v0.0.0}"
COMMIT_SHA="${2:-unknown}"
SHORT_SHA="${COMMIT_SHA:0:7}"
OUTPUT_DIR="${3:-dist/images/services}"

echo "Building EZ Platform Docker images"
echo "Version:   $VERSION"
echo "Commit:    $COMMIT_SHA"
echo "Output:    $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"

# 10 application services: name|dockerfile|image
SERVICES=(
  "datasource-management|docker/DataSourceManagementService.Dockerfile|ez-platform/datasource-management"
  "validation|docker/ValidationService.Dockerfile|ez-platform/validation"
  "fileprocessor|docker/FileProcessorService.Dockerfile|ez-platform/fileprocessor"
  "filediscovery|docker/FileDiscoveryService.Dockerfile|ez-platform/filediscovery"
  "scheduling|docker/SchedulingService.Dockerfile|ez-platform/scheduling"
  "output|docker/OutputService.Dockerfile|ez-platform/output"
  "metrics-configuration|docker/MetricsConfigurationService.Dockerfile|ez-platform/metrics-configuration"
  "invalidrecords|docker/InvalidRecordsService.Dockerfile|ez-platform/invalidrecords"
  "frontend|docker/Frontend.Dockerfile|ez-platform/frontend"
  "docusaurus|docker/Docusaurus.Dockerfile|ez-platform/docusaurus"
)

FAILED=()

for svc_line in "${SERVICES[@]}"; do
  IFS='|' read -r svc_name dockerfile image <<< "$svc_line"
  echo "[$svc_name] Building $image:$VERSION ..."

  if ! docker build \
    --file "$dockerfile" \
    --tag "$image:$VERSION" \
    --build-arg VERSION="$VERSION" \
    --build-arg COMMIT_SHA="$COMMIT_SHA" \
    --build-arg SHORT_SHA="$SHORT_SHA" \
    .; then
    FAILED+=("$svc_name")
    echo "[$svc_name] FAILED" >&2
    continue
  fi

  TAR_NAME="${svc_name}.tar"
  echo "[$svc_name] Saving to $OUTPUT_DIR/$TAR_NAME ..."
  docker save "$image:$VERSION" -o "$OUTPUT_DIR/$TAR_NAME"
  echo "[$svc_name] Done."
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "FAILED services: ${FAILED[*]}" >&2
  exit 1
fi

echo "All 10 images built and saved to $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"

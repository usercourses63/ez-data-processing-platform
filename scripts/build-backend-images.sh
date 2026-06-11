#!/usr/bin/env bash
# Phase-33 bring-up: build the 8 backend service images directly with docker
# (pwsh 7 unavailable, so we skip build-all-images.ps1). Frontend already built
# as frontend:v0.5.0-phase33. Tags match chart default: ez-platform/<name>:latest
set -u
cd "$(dirname "$0")/.." || exit 1

VERSION="${VERSION:-v0.5.0}"
COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
LOG=scripts/.phase33-build.log
: > "$LOG"

declare -a NAMES=(datasource-management validation fileprocessor filediscovery scheduling output metrics-configuration invalidrecords)
declare -a FILES=(
  docker/DataSourceManagementService.Dockerfile
  docker/ValidationService.Dockerfile
  docker/FileProcessorService.Dockerfile
  docker/FileDiscoveryService.Dockerfile
  docker/SchedulingService.Dockerfile
  docker/OutputService.Dockerfile
  docker/MetricsConfigurationService.Dockerfile
  docker/InvalidRecordsService.Dockerfile
)

fail=0
for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"; file="${FILES[$i]}"
  echo "===== [$((i+1))/8] building ez-platform/${name}:latest ($file) =====" | tee -a "$LOG"
  start=$(date +%s)
  if docker build \
        --build-arg VERSION="${VERSION#v}" \
        --build-arg COMMIT_SHA="$COMMIT_SHA" \
        -f "$file" \
        -t "ez-platform/${name}:latest" \
        -t "ez-platform/${name}:${VERSION}" \
        . >> "$LOG" 2>&1; then
    echo "OK ${name} ($(( $(date +%s) - start ))s)" | tee -a "$LOG"
  else
    echo "FAIL ${name} (exit $?)" | tee -a "$LOG"
    fail=$((fail+1))
  fi
done

echo "===== BUILD COMPLETE: $((8-fail))/8 succeeded, $fail failed =====" | tee -a "$LOG"
exit $fail

#!/bin/bash
set -euo pipefail

OUTPUT_DIR="${1:-dist/images/infrastructure}"

echo "Pulling EZ Platform infrastructure images"
echo "Output: $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"

# 11 infrastructure images from IMAGE-MANIFEST.txt
IMAGES=(
  "mongo:8.0"
  "rabbitmq:3.12-management-alpine"
  "confluentinc/cp-kafka:7.5.0"
  "confluentinc/cp-zookeeper:7.5.0"
  "hazelcast/hazelcast:5.6"
  "docker.elastic.co/elasticsearch/elasticsearch:8.17.0"
  "prom/prometheus:v2.51.0"
  "grafana/grafana:10.4.0"
  "jaegertracing/all-in-one:1.54"
  "otel/opentelemetry-collector-contrib:0.96.0"
  "fluent/fluent-bit:3.0"
)

FAILED=()

for image in "${IMAGES[@]}"; do
  # Derive safe filename: replace / and : with -
  safe_name="${image//\//-}"
  safe_name="${safe_name//:/-}"
  tar_file="$OUTPUT_DIR/${safe_name}.tar"

  echo "[infra] Pulling $image ..."
  if ! docker pull "$image"; then
    FAILED+=("$image")
    echo "[infra] FAILED to pull $image" >&2
    continue
  fi

  echo "[infra] Saving to $tar_file ..."
  docker save "$image" -o "$tar_file"
  echo "[infra] Saved $image -> ${safe_name}.tar"
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "FAILED images: ${FAILED[*]}" >&2
  exit 1
fi

echo "All 11 infrastructure images saved to $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"

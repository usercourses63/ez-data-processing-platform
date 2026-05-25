#!/bin/sh
# Runtime config injection for the React frontend.
# Reads env vars set by Helm/Kubernetes and writes a config.js file that
# is loaded by index.html before the React bundle. The bundle reads
# window.EZ_CONFIG.* at runtime instead of being rebuilt per environment.
set -e

CONFIG_JS=/usr/share/nginx/html/config.js

# Escape backslashes and double quotes for safe JS string embedding.
escape_js() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

DOCS_URL_ESCAPED=$(escape_js "${EZ_DOCS_URL:-}")

cat > "$CONFIG_JS" <<EOF
// Generated at container start by docker-entrypoint.sh — do not commit edits.
window.EZ_CONFIG = {
  docsUrl: "${DOCS_URL_ESCAPED}"
};
EOF

exec nginx -g 'daemon off;'

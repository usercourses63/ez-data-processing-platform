#!/bin/sh
# Runtime configuration injection for the React frontend.
#
#  1. Renders /etc/nginx/conf.d/default.conf from nginx.conf.template, injecting
#     the backend service URLs supplied by the deployment YAML (env vars) plus a
#     DNS resolver. proxy_pass uses nginx variables, so upstream hostnames are
#     resolved per-request via the resolver instead of at nginx startup — a
#     backend that is not yet up no longer blocks the frontend pod from booting.
#  2. Writes window.EZ_CONFIG (config.js), loaded by index.html before the
#     React bundle so the bundle reads runtime config instead of being rebuilt
#     per environment.
set -e

# ---------------------------------------------------------------------------
# 1) Backend URLs — injected from the frontend deployment YAML (env vars).
#    Defaults preserve the in-cluster Service names, so the image still works
#    with zero extra configuration.
# ---------------------------------------------------------------------------
export BACKEND_DATASOURCE_URL="${BACKEND_DATASOURCE_URL:-http://datasource-management:5001}"
export BACKEND_INVALIDRECORDS_URL="${BACKEND_INVALIDRECORDS_URL:-http://invalidrecords:5007}"
export BACKEND_METRICS_URL="${BACKEND_METRICS_URL:-http://metrics-configuration:5002}"
export BACKEND_SCHEDULING_URL="${BACKEND_SCHEDULING_URL:-http://scheduling:5004}"

# ---------------------------------------------------------------------------
# 2) DNS resolver for request-time upstream resolution.
#    Override with NGINX_RESOLVER; otherwise use the first nameserver from
#    /etc/resolv.conf (kube-dns in Kubernetes/OCP), falling back to Docker's
#    embedded DNS (127.0.0.11).
# ---------------------------------------------------------------------------
if [ -z "${NGINX_RESOLVER:-}" ]; then
  NGINX_RESOLVER=$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf 2>/dev/null || true)
fi
export NGINX_RESOLVER="${NGINX_RESOLVER:-127.0.0.11}"

# ---------------------------------------------------------------------------
# 3) Render the nginx server config from the template. Only our own ${...}
#    placeholders are substituted — nginx's own $variables (e.g. $host,
#    $request_uri, $backend) are left untouched by listing the vars explicitly.
# ---------------------------------------------------------------------------
TEMPLATE=/etc/nginx/templates/default.conf.template
OUT=/etc/nginx/conf.d/default.conf
envsubst '${NGINX_RESOLVER} ${BACKEND_DATASOURCE_URL} ${BACKEND_INVALIDRECORDS_URL} ${BACKEND_METRICS_URL} ${BACKEND_SCHEDULING_URL}' \
  < "$TEMPLATE" > "$OUT"

echo "[entrypoint] nginx upstreams: datasource=$BACKEND_DATASOURCE_URL invalidrecords=$BACKEND_INVALIDRECORDS_URL metrics=$BACKEND_METRICS_URL scheduling=$BACKEND_SCHEDULING_URL resolver=$NGINX_RESOLVER"

# ---------------------------------------------------------------------------
# 4) Runtime front-end config (window.EZ_CONFIG) consumed by index.html.
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# 5) Validate the rendered config, then hand off to nginx. nginx -t succeeds
#    even when backends are unreachable because variable proxy_pass defers DNS.
# ---------------------------------------------------------------------------
nginx -t

exec nginx -g 'daemon off;'

# Docusaurus Documentation Portal
# Multi-stage build with version injection
#
# Build: docker build -f docker/Docusaurus.Dockerfile --build-arg VERSION=v0.2.0 -t ez-platform/docusaurus:v0.2.0 .
# Run:   docker run -p 8080:8080 ez-platform/docusaurus:v0.2.0

# Global ARGs
ARG NODE_VERSION=20
ARG VERSION=0.0.0
ARG COMMIT_SHA=unknown

# Build stage
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Redeclare ARGs for this stage (Docker requirement)
ARG VERSION
ARG COMMIT_SHA

# Copy package files first for layer caching
COPY release-package/docs-docusaurus/package*.json ./

# Install dependencies (npm ci for CI reproducibility)
RUN npm ci

# Copy source files
COPY release-package/docs-docusaurus/ ./

# Inject version into docusaurus.config.js
# Update the title line: title: 'EZ Platform v0.1.1-rc1' -> title: 'EZ Platform vX.X.X'
RUN sed -i "s/title: 'EZ Platform v[^']*'/title: 'EZ Platform ${VERSION}'/" docusaurus.config.js

# Debug: verify injection worked
RUN echo "Version injected:" && grep "title:" docusaurus.config.js

# Build Docusaurus site
RUN npm run build

# Production stage - OCP compatible Nginx
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Redeclare ARGs for labels
ARG VERSION
ARG COMMIT_SHA

# OCI labels
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"
LABEL org.opencontainers.image.title="EZ Platform Documentation"
LABEL org.opencontainers.image.description="Docusaurus documentation portal for EZ Platform"
LABEL org.opencontainers.image.vendor="EZ Platform Team"

# Create the writable temp dirs nginx needs and drop the default server config.
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    rm -rf /usr/share/nginx/html/* && \
    rm -f /etc/nginx/conf.d/default.conf

# Copy nginx main configuration (with writable PID path under /tmp)
COPY release-package/docs-docusaurus/nginx-main.conf /etc/nginx/nginx.conf

# Copy built Docusaurus site from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx server configuration for SPA routing (port 8080)
COPY release-package/docs-docusaurus/nginx.conf /etc/nginx/conf.d/default.conf

# OCP arbitrary-UID compliance: make every runtime-writable path group-0 owned and
# group-writable (g=u mirrors group perms to owner perms).
RUN chgrp -R 0 /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && \
    chmod -R g=u /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx

# Non-privileged port for OCP compliance
EXPOSE 8080

# Numeric, non-zero USER so Kubernetes runAsNonRoot can validate it (OCP overrides the actual UID)
USER 1001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

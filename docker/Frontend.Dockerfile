# Frontend Dockerfile
# Multi-stage build: Node build + Nginx serve with version injection

# Version injection (CI/CD)
ARG VERSION=0.0.0
ARG COMMIT_SHA=unknown

FROM node:20-alpine AS build
WORKDIR /app

# Redeclare ARGs for build stage
ARG VERSION
ARG COMMIT_SHA

# Copy package files
COPY src/Frontend/package*.json ./

# Install dependencies (use --legacy-peer-deps for React 19)
RUN npm install --legacy-peer-deps

# Copy source code
COPY src/Frontend/ ./

# Set version env vars for Vite build (read by vite.config.ts via process.env)
ENV VERSION=${VERSION}
ENV COMMIT_SHA=${COMMIT_SHA}

# Debug: List public folder to verify docs exist
RUN ls -la ./public/docs/ || echo "docs folder missing!"

# Build React app
RUN npm run build

# Debug: List build folder to check if docs were copied
RUN ls -la ./build/docs/ || echo "docs not in build!"

# Production image
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Redeclare ARGs for runtime stage labels
ARG VERSION
ARG COMMIT_SHA
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"

# Remove default nginx static files
RUN rm -rf ./*

# Copy built app from build stage
COPY --from=build /app/build .

# Copy help documentation directly from source (public/docs -> build/docs)
COPY --from=build /app/public/docs/USER-GUIDE-HE.md ./docs/USER-GUIDE-HE.md

# Create the writable temp dirs nginx needs
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp

# Copy nginx main configuration (writable PID path: pid /tmp/nginx.pid + temp paths under /tmp)
COPY src/Frontend/nginx-main.conf /etc/nginx/nginx.conf

# Copy nginx server configuration (keep docker/nginx.conf so the proxy upstreams that
# scripts/validate-nginx-ports.sh checks stay intact)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy runtime-config entrypoint (generates /usr/share/nginx/html/config.js from env vars)
COPY src/Frontend/docker-entrypoint.sh /docker-entrypoint.sh

# OCP arbitrary-UID compliance: make every runtime-writable path group-0 owned and
# group-writable (g=u mirrors group perms to owner perms), then mark the entrypoint executable.
RUN chgrp -R 0 /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && \
    chmod -R g=u /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && \
    chmod +x /docker-entrypoint.sh

# Expose non-privileged port 8080 (OCP compatible)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1

# Numeric, non-zero USER so Kubernetes runAsNonRoot can validate it (OCP overrides the actual UID)
USER 1001

# Start via runtime-config entrypoint (writes config.js then execs nginx)
CMD ["/docker-entrypoint.sh"]

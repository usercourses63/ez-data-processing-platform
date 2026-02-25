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

# Inject version information into version.ts
RUN sed -i "s/__VERSION__/${VERSION}/g" src/version.ts && \
    sed -i "s/__COMMIT_SHA__/${COMMIT_SHA}/g" src/version.ts

# Debug: verify version injection
RUN echo "Version injection result:" && cat src/version.ts

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

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Build the documentation
RUN npm run build

# Production stage - OCP compatible
FROM nginx:alpine

# Create non-root user for OCP compatibility and clear default content
RUN addgroup -g 1001 -S nginx-group && \
    adduser -u 1001 -S nginx-user -G nginx-group && \
    mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    chown -R nginx-user:nginx-group /tmp && \
    chown -R nginx-user:nginx-group /var/cache/nginx && \
    chown -R nginx-user:nginx-group /var/log/nginx && \
    rm -rf /usr/share/nginx/html/* && \
    chown -R nginx-user:nginx-group /usr/share/nginx/html && \
    rm -f /etc/nginx/conf.d/default.conf

# Copy nginx main configuration (with writable PID path)
COPY --chown=nginx-user:nginx-group nginx-main.conf /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder --chown=nginx-user:nginx-group /app/build /usr/share/nginx/html

# Copy custom nginx server config for port 8080
COPY --chown=nginx-user:nginx-group nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (OCP compatible - non-privileged port)
EXPOSE 8080

# Run as non-root user (OCP requirement)
USER nginx-user

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

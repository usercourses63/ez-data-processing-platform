# Production Dockerfile for React Frontend
# OCP-compatible: runs as non-root user on non-privileged port 8080
FROM nginx:alpine

# Create non-root user for OCP compatibility
RUN addgroup -g 1001 -S nginx-group && \
    adduser -u 1001 -S nginx-user -G nginx-group && \
    # Create necessary directories with correct permissions
    mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    chown -R nginx-user:nginx-group /tmp && \
    chown -R nginx-user:nginx-group /var/cache/nginx && \
    chown -R nginx-user:nginx-group /var/log/nginx && \
    chown -R nginx-user:nginx-group /usr/share/nginx/html && \
    # Remove default config
    rm -f /etc/nginx/conf.d/default.conf

# Copy nginx main configuration (with writable PID path)
COPY --chown=nginx-user:nginx-group nginx-main.conf /etc/nginx/nginx.conf

# Copy built React app to nginx html directory
COPY --chown=nginx-user:nginx-group build /usr/share/nginx/html

# Copy nginx server configuration
COPY --chown=nginx-user:nginx-group nginx.conf /etc/nginx/conf.d/default.conf

# Copy runtime-config entrypoint (generates /usr/share/nginx/html/config.js from env vars)
COPY --chown=nginx-user:nginx-group docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Switch to non-root user
USER nginx-user

# Expose non-privileged port 8080 (OCP compatible)
EXPOSE 8080

# Start via runtime-config entrypoint (which then execs nginx)
CMD ["/docker-entrypoint.sh"]

# Production Dockerfile for React Frontend
# OCP-compatible: runs as non-root user on non-privileged port 8080
FROM nginx:alpine

# Create non-root user for OCP compatibility
RUN addgroup -g 1001 -S nginx-group && \
    adduser -u 1001 -S nginx-user -G nginx-group && \
    # Create necessary directories with correct permissions
    mkdir -p /var/cache/nginx/client_temp && \
    mkdir -p /var/run && \
    chown -R nginx-user:nginx-group /var/cache/nginx && \
    chown -R nginx-user:nginx-group /var/run && \
    chown -R nginx-user:nginx-group /usr/share/nginx/html && \
    # Remove default config
    rm -f /etc/nginx/conf.d/default.conf

# Copy built React app to nginx html directory
COPY --chown=nginx-user:nginx-group build /usr/share/nginx/html

# Copy nginx configuration
COPY --chown=nginx-user:nginx-group nginx.conf /etc/nginx/conf.d/default.conf

# Switch to non-root user
USER nginx-user

# Expose non-privileged port 8080 (OCP compatible)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

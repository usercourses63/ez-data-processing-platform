# Production Dockerfile for React Frontend
# OCP restricted-v2 compatible: runs as an arbitrary non-root UID in group 0 on port 8080.
# Runtime-writable paths are group-0 owned and group-writable (chgrp 0 + chmod g=u),
# so any random UID assigned by OpenShift can write them.
FROM nginx:alpine

# Create the writable temp dirs nginx needs and drop the default server config.
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    rm -f /etc/nginx/conf.d/default.conf

# Copy nginx main configuration (with writable PID path under /tmp)
COPY nginx-main.conf /etc/nginx/nginx.conf

# Copy built React app to nginx html directory
COPY build /usr/share/nginx/html

# Copy nginx server configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy runtime-config entrypoint (generates /usr/share/nginx/html/config.js from env vars)
COPY docker-entrypoint.sh /docker-entrypoint.sh

# OCP arbitrary-UID compliance: make every runtime-writable path group-0 owned and
# group-writable (g=u mirrors group perms to owner perms), then mark the entrypoint executable.
RUN chgrp -R 0 /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && \
    chmod -R g=u /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && \
    chmod +x /docker-entrypoint.sh

# Numeric, non-zero USER so Kubernetes runAsNonRoot can validate it (OCP overrides the actual UID)
USER 1001

# Expose non-privileged port 8080 (OCP compatible)
EXPOSE 8080

# Start via runtime-config entrypoint (which then execs nginx)
CMD ["/docker-entrypoint.sh"]

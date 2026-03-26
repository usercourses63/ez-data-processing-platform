---
sidebar_position: 1
---

# EZ Platform v0.4.0 - Complete Deployment Troubleshooting Guide

**Document Version:** 4.0
**Date:** March 2026
**Deployment Target:** Minikube (Hyper-V/Docker), OpenShift Container Platform (OCP)
**Platform Version:** v0.4.0
**Status:** Production Ready (OCP Compatible)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [OCP Compatibility Issues and Resolutions](#ocp-compatibility-issues-and-resolutions)
3. [Initial Environment Setup](#initial-environment-setup)
4. [Deployment Process Overview](#deployment-process-overview)
5. [Critical Issues and Resolutions](#critical-issues-and-resolutions)
6. [Quick Reference](#quick-reference)
7. [Success Criteria](#success-criteria)

---

## Executive Summary

This document provides a comprehensive record of deploying EZ Platform v0.1.1-rc2 on Minikube with Docker Desktop, including all issues encountered and their resolutions. The deployment faced multiple challenges related to resource constraints, volume mounts, image availability, service configuration, and CORS policies.

**Final Result:** 21/21 pods running successfully with full functionality verified via Playwright testing.

### Key Challenges Resolved

1. Minikube resource allocation (CPU/memory constraints)
2. RabbitMQ .erlang.cookie permission issues
3. MongoDB replica set initialization
4. Kafka cluster ID conflicts
5. Docker image loading and tagging
6. Volume mount configuration for Windows↔Kubernetes file access
7. Service environment variable configuration
8. CORS policy configuration for frontend-backend communication
9. InvalidRecords service database name configuration
10. **[v0.1.1-rc2] OCP nginx permission issues (non-root operation)**
11. **[v0.1.1-rc2] Fluent-bit volume mount configuration for OCP**

---

## OCP Compatibility Issues and Resolutions

> **New in v0.1.1-rc2:** This section documents OpenShift Container Platform (OCP) specific issues and their resolutions.

### OCP Issue 1: Nginx Permission Denied on /run/nginx.pid

**Symptom:**
```
nginx: [emerg] open() "/run/nginx.pid" failed (13: Permission denied)
```

**Affected Pods:**
- Frontend (React)
- Docs-Docusaurus (Documentation portal)

**Root Cause:**
Default nginx configuration uses `/run/nginx.pid` which is not writable when running as non-root user (OCP requirement).

**Resolution:**

**Step 1 - Create custom nginx-main.conf:**

Create `nginx-main.conf` in the image directory with PID path in `/tmp`:

```nginx
# OCP-compatible main nginx configuration
# Runs as non-root user with writable PID and temp directories

# Do not use 'user' directive - we run as non-root already
worker_processes auto;

# PID file in writable location
pid /tmp/nginx.pid;

error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;
}

http {
    # Temp directories in writable locations
    client_body_temp_path /tmp/client_temp;
    proxy_temp_path /tmp/proxy_temp;
    fastcgi_temp_path /tmp/fastcgi_temp;
    uwsgi_temp_path /tmp/uwsgi_temp;
    scgi_temp_path /tmp/scgi_temp;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    keepalive_timeout 65;

    # Include server configurations
    include /etc/nginx/conf.d/*.conf;
}
```

**Step 2 - Update Dockerfile for non-root operation:**

```dockerfile
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

# Copy built files
COPY --from=builder --chown=nginx-user:nginx-group /app/build /usr/share/nginx/html

# Copy custom nginx server config for port 8080
COPY --chown=nginx-user:nginx-group nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (OCP compatible - non-privileged port)
EXPOSE 8080

# Run as non-root user (OCP requirement)
USER nginx-user

CMD ["nginx", "-g", "daemon off;"]
```

**Step 3 - Create nginx.conf server config:**

```nginx
server {
    listen 8080;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
```

**Key Files Modified:**
- `src/Frontend/nginx-main.conf` (created)
- `src/Frontend/Dockerfile` (updated)
- `release-package/docs-docusaurus/nginx-main.conf` (created)
- `release-package/docs-docusaurus/Dockerfile` (updated)

**Result:** ✅ Both frontend and docs pods now run as non-root user on port 8080

---

### OCP Issue 2: Default nginx Index Overwriting Custom Content

**Symptom:**
Docs-Docusaurus shows default "Welcome to nginx!" page instead of documentation.

**Root Cause:**
Default nginx index.html at `/usr/share/nginx/html/index.html` wasn't removed before copying Docusaurus build, causing the wrong page to be served.

**Resolution:**

Add cleanup step in Dockerfile before copying content:

```dockerfile
# Clear default nginx content BEFORE copying build
RUN rm -rf /usr/share/nginx/html/*

# Then copy custom content
COPY --from=builder --chown=nginx-user:nginx-group /app/build /usr/share/nginx/html
```

**Result:** ✅ Docusaurus documentation displays correctly

---

### OCP Issue 3: Fluent-bit Volume Mount Failure

**Symptom:**
```
Events:
  Warning  FailedMount  MountVolume.SetUp failed for volume "fluent-bit-state"
```

**Root Cause:**
Original configuration tried to mount to `/var/log/flb_kube.db` path, but `/var/log` is read-only from host.

**Resolution:**

Update `fluent-bit.yaml` to use `/tmp` for database:

**ConfigMap change:**
```yaml
[INPUT]
    Name              tail
    Tag               kube.*
    Path              /var/log/containers/*ez-platform*.log
    Parser            docker
    DB                /tmp/flb_kube.db   # Changed from /var/log/flb_kube.db
```

**Volume mount change:**
```yaml
volumeMounts:
  - name: fluent-bit-state
    mountPath: /tmp    # Changed from /var/log/flb_kube.db
volumes:
  - name: fluent-bit-state
    emptyDir: {}
```

**Result:** ✅ Fluent-bit starts successfully with writable database path

---

### OCP Security Context Requirements

**All pods in v0.1.1-rc2 now include:**

```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: container-name
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
```

**Port Requirements:**
- All services use non-privileged ports (>1024)
- Frontend: 8080 (changed from 80)
- Docusaurus docs: 8080 (changed from 80)

**Image Requirements:**
- All images pinned to specific versions (no `:latest`)
- imagePullPolicy: IfNotPresent (changed from Never for production)
- Non-root USER directive in all Dockerfiles

---

## Initial Environment Setup

### Docker Desktop Configuration

**Available Resources:**
- CPUs: 12 cores
- Memory: 46.19 GB (47,297 MB)
- Storage: Sufficient for 200GB Minikube disk

**Command to verify:**
```bash
docker info | grep -E "CPUs|Total Memory"
```

**Output:**
```
CPUs: 12
Total Memory: 46.19GiB
```

### Initial Minikube Attempt

**First attempt used bootstrap script with:**
```powershell
minikube start --cpus=8 --memory=40960 --disk-size=100g --driver=docker
```

**Issues with initial configuration:**
- Insufficient CPU allocation (8 cores) caused pod scheduling failures
- Insufficient memory (40GB) for all services
- Disk size too small (100GB) for comprehensive testing

---

## Deployment Process Overview

### Phase 1: Minikube Cluster Recreation

**Decision:** Recreate Minikube with maximum available resources

**Final Minikube Configuration:**
```bash
minikube delete  # Clean slate
minikube start --cpus=12 --memory=47000 --disk-size=200g --driver=docker
```

**Parameters Explained:**
- `--cpus=12`: Use all 12 available CPU cores
- `--memory=47000`: Allocate 47GB (46GB available, leaving 1GB margin)
- `--disk-size=200g`: Large disk for extensive testing and data storage
- `--driver=docker`: Use Docker Desktop driver

**Result:** Minikube successfully created with maximum resources

---

### Phase 2: Development Environment Optimization

**Decision:** Scale all services to 1 replica for development

**Rationale:**
- Development/testing environment doesn't need high availability
- Single replicas reduce resource consumption significantly
- Easier debugging with single instances
- Avoids resource contention and scheduling failures

---

## Critical Issues and Resolutions

### Issue 1: ImagePullBackOff - Docker Images Not Loaded

**Symptom:**
```
NAME                                   READY   STATUS             AGE
elasticsearch-6c69f5696b-6kknp         0/1     ImagePullBackOff   3m3s
ezplatform-grafana-954c477b5-rds4x     0/1     ImagePullBackOff   3m3s
```

**Root Cause:**
Minikube runs in an isolated Docker environment. The release-package Docker images (tar files) were not loaded into Minikube's internal registry.

**Resolution:**

```bash
cd "C:/Users/UserC/source/repos/EZ/release-package/images"

# Load all images
for image in *.tar*; do
    minikube image load "$image"
done
```

---

### Issue 2: RabbitMQ .erlang.cookie Permission Error

**Symptom:**
```
Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces
```

**Resolution:**

```bash
kubectl patch deployment rabbitmq -n ez-platform -p '{
  "spec": {
    "template": {
      "spec": {
        "securityContext": {
          "fsGroup": 999,
          "runAsUser": 999
        }
      }
    }
  }
}'
```

---

### Issue 3: MongoDB Replica Set Initialization

**Symptom:**
```
System.TimeoutException: A timeout occurred after 30000ms selecting a server
Type: "ReplicaSetGhost"
```

**Resolution:**

```bash
kubectl exec mongodb-0 -n ez-platform -- mongosh --eval '
  rs.initiate({
    _id: "rs0",
    members: [{_id: 0, host: "mongodb-0.mongodb:27017"}]
  })
'
```

---

### Issue 4: CORS Configuration

**Symptom:**
```
Access to fetch at 'http://localhost:5001/api/v1/datasource' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Resolution:**

```bash
kubectl set env deployment/datasource-management ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/metrics-configuration ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/validation ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl set env deployment/invalidrecords ASPNETCORE_ENVIRONMENT=Development -n ez-platform
```

---

## Quick Reference

### Common Commands

**Check pod status:**
```bash
kubectl get pods -n ez-platform
```

**View logs:**
```bash
kubectl logs -f deployment/SERVICE_NAME -n ez-platform
```

**Restart service:**
```bash
kubectl rollout restart deployment/SERVICE_NAME -n ez-platform
```

**Start port forwarding:**
```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

---

### Port Mapping

| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| Frontend | 8080 | 3000 | React UI |
| DataSource Management | 5001 | 5001 | CRUD API |
| Metrics Configuration | 5002 | 5002 | Metrics API |
| Validation | 5003 | 5003 | Validation API |
| Grafana | 3000 | 3001 | Monitoring UI |
| Jaeger | 16686 | 16686 | Tracing UI |
| MongoDB | 27017 | 27017 | Database |

---

### Monitoring Credentials

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| Grafana | http://localhost:3001 | admin | EZPlatform2025!Beta |
| RabbitMQ | http://localhost:15672 | guest | guest |

---

## Success Criteria

- ✅ 21/21 pods running
- ✅ All services healthy
- ✅ Full Hebrew/RTL support working
- ✅ Monitoring dashboards operational
- ✅ OCP security requirements met

---

---

## v0.4.0 Troubleshooting

### Archive Upload Issues

**Symptom:** Import from File fails with "Request Entity Too Large" (413)

**Solution:** Verify nginx `client_max_body_size` in the frontend deployment:
```nginx
client_max_body_size 100m;
```
This is pre-configured in the v0.4.0 frontend image. If using a custom nginx config, add this directive.

### NAS Mount Failures

**Symptom:** NAS device shows provisioned but file operations fail

**Common causes:**
1. NFSv4 required for cross-cluster mounts -- use `nfsvers=4` mount option
2. First write to newly-mounted NFSv4 volume can take ~57s (cache warmup)
3. Stale NAS volume refs survive `kubectl apply` -- delete+recreate deployments

**Verify provisioning:**
```bash
kubectl get pv -n ez-platform | grep nfs
kubectl get pvc -n ez-platform | grep nfs
```

### SignalR Connection Issues

**Symptom:** Real-time updates not working, entity changes not reflected

**Common causes:**
1. WebSocket not supported by ingress controller
2. CORS not configured for SignalR
3. Pod restarts break WebSocket connections (auto-reconnect should handle this)

**Verify SignalR:**
```bash
# Check SignalR hub is responding
curl http://localhost:5001/hubs/monitoring/negotiate?negotiateVersion=1
```

### Kafka Cluster ID Mismatch

**Symptom:** `InconsistentClusterIdException` after cluster restart

**Solution:** Delete BOTH Kafka and ZooKeeper StatefulSets + PVCs + released PVs:
```bash
kubectl delete statefulset kafka -n ez-platform
kubectl delete statefulset zookeeper -n ez-platform
kubectl delete pvc -l app=kafka -n ez-platform
kubectl delete pvc -l app=zookeeper -n ez-platform
# Then reapply manifests
kubectl apply -f k8s/infrastructure/
```

---

**Document End**
**Version:** 4.0
**Last Updated:** March 2026
**Status:** Production Ready (OCP Compatible)

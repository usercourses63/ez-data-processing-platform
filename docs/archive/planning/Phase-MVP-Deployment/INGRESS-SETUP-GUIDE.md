# EZ Platform - Ingress Setup Guide (Production-Ready)

**Version:** 1.0
**Date:** December 11, 2025
**Environment:** Kubernetes with NGINX Ingress

---

## Overview

This guide configures production-ready ingress access for all EZ Platform services, eliminating the need for unreliable port forwards.

### Benefits
✅ **Permanent Access** - No port forward disconnections
✅ **Production-Like** - Same setup as actual production
✅ **Single Entry Point** - All services via one domain
✅ **SSL/TLS Ready** - Easy to add certificates
✅ **Professional** - Industry standard approach

---

## Prerequisites

- Minikube cluster running
- All EZ Platform services deployed
- Admin/elevated access for hosts file modification

---

## Step 1: Enable Ingress Controller

```bash
# Enable NGINX ingress addon
minikube addons enable ingress

# Verify ingress controller is running
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

---

## Step 2: Apply Ingress Configuration

```bash
# Apply ingress rules
kubectl apply -f k8s/ingress/ez-platform-ingress.yaml

# Verify ingress created
kubectl get ingress -n ez-platform
```

**Created Ingresses:**
1. `ez-platform-ingress` - Main frontend and service APIs
2. `ez-platform-api-direct` - Direct API access

---

## Step 3: Configure Hosts File

### Option A: Manual (Requires Admin)

**Windows:** Edit `C:\Windows\System32\drivers\etc\hosts`
**Linux/Mac:** Edit `/etc/hosts`

Add the following line:
```
192.168.49.2 ezplatform.local api.ezplatform.local
```

**Note:** Replace `192.168.49.2` with your minikube IP (from `minikube ip`)

### Option B: Automatic (Run as Administrator)

```powershell
# PowerShell (Run as Administrator)
$minikubeIp = minikube ip
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "$minikubeIp ezplatform.local api.ezplatform.local"
```

---

## Step 4: Access Services

### Frontend Access
**URL:** http://ezplatform.local

**Pages:**
- Main: http://ezplatform.local/
- Datasources: http://ezplatform.local/datasources
- Invalid Records: http://ezplatform.local/invalid-records
- Metrics: http://ezplatform.local/metrics
- Dashboard: http://ezplatform.local/dashboard

### API Access (via api.ezplatform.local)
- Datasources API: http://api.ezplatform.local/v1/datasource
- Invalid Records API: http://api.ezplatform.local/v1/invalid-records
- Metrics API: http://api.ezplatform.local/v1/metrics

### Monitoring Access
- Grafana: http://ezplatform.local/grafana
- Prometheus: http://ezplatform.local/prometheus

---

## Service Routing Configuration

| Service | Host | Path | Backend Port |
|---------|------|------|--------------|
| Frontend | ezplatform.local | / | 80 |
| Datasource Management | ezplatform.local | /api/datasources | 5001 |
| Invalid Records | ezplatform.local | /api/invalid-records | 5006 |
| Metrics Configuration | ezplatform.local | /api/metrics | 5002 |
| Grafana | ezplatform.local | /grafana | 3000 |
| Prometheus | ezplatform.local | /prometheus | 9090 |

---

## Alternative Access (Without Hosts File)

### Use Minikube IP Directly

```bash
# Get minikube IP
MINIKUBE_IP=$(minikube ip)

# Access services
curl http://$MINIKUBE_IP -H "Host: ezplatform.local"
curl http://$MINIKUBE_IP/v1/datasource -H "Host: api.ezplatform.local"
```

**Note:** Frontend won't work properly without hosts file (JavaScript makes requests to ezplatform.local)

---

## Troubleshooting

### Ingress Not Working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress status
kubectl describe ingress ez-platform-ingress -n ez-platform

# Check ingress logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Services Not Accessible

```bash
# Verify services are running
kubectl get svc -n ez-platform

# Verify pods are ready
kubectl get pods -n ez-platform

# Test backend service directly
kubectl port-forward -n ez-platform svc/frontend 8080:80
curl http://localhost:8080
```

### DNS Not Resolving

```bash
# Verify hosts file entry
cat C:/Windows/System32/drivers/etc/hosts | grep ezplatform

# Ping the domain
ping ezplatform.local

# Should resolve to minikube IP (192.168.49.2)
```

---

## Frontend Configuration Update

**IMPORTANT:** Update frontend to use ingress URLs instead of localhost

**File:** `src/Frontend/.env.production`

```env
# Old (port forward based)
REACT_APP_DATASOURCE_API_URL=http://localhost:5001/api/v1
REACT_APP_INVALID_RECORDS_API_URL=http://localhost:5007/api/v1
REACT_APP_METRICS_API_URL=http://localhost:5002/api/v1

# New (ingress based)
REACT_APP_DATASOURCE_API_URL=http://api.ezplatform.local/v1
REACT_APP_INVALID_RECORDS_API_URL=http://api.ezplatform.local/v1
REACT_APP_METRICS_API_URL=http://api.ezplatform.local/v1
```

**After changing:** Rebuild and redeploy frontend

---

## Production Deployment Notes

### For On-Premise/Cloud Deployment

**Replace:**
- `ezplatform.local` → Your actual domain (e.g., `ezplatform.company.com`)
- HTTP → HTTPS with proper SSL certificates
- Update ingress annotations for SSL termination

**Add:**
```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - ezplatform.company.com
    - api.ezplatform.company.com
    secretName: ezplatform-tls
```

---

## Cleanup Port Forwards

**After ingress is working, kill all port forwards:**

```bash
# Find and kill port-forward processes
tasklist | findstr kubectl
taskkill /F /PID <process-id>

# Or kill all kubectl processes
taskkill /F /IM kubectl.exe
```

---

## Advantages Over Port Forwarding

| Feature | Port Forward | Ingress |
|---------|-------------|---------|
| Reliability | ❌ Disconnects | ✅ Permanent |
| Survives Restarts | ❌ No | ✅ Yes |
| Production-Like | ❌ No | ✅ Yes |
| SSL/TLS | ❌ Complex | ✅ Easy |
| Load Balancing | ❌ No | ✅ Yes |
| Path-Based Routing | ❌ No | ✅ Yes |
| Single Entry Point | ❌ No | ✅ Yes |

---

## Next Steps

1. ✅ Ingress controller enabled
2. ✅ Ingress rules applied
3. ⏳ Add hosts file entry (requires admin)
4. ⏳ Update frontend env configuration
5. ⏳ Rebuild and deploy frontend
6. ⏳ Test all service access via ingress
7. ⏳ Remove port forward dependencies

---

**Document Status:** ✅ Complete
**Last Updated:** December 11, 2025
**Production Ready:** Yes (after hosts file update)

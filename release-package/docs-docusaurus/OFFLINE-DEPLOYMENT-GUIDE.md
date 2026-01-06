# Offline Kubernetes Deployment Guide - Docusaurus Documentation

Complete guide for deploying EZ Platform documentation to an offline Kubernetes cluster.

**Target:** Air-gapped/offline network environment
**Method:** Docker image transfer via tar file
**Version:** v0.1.1-rc1

---

## Prerequisites

### Online System (Build Machine)
- Docker Desktop installed
- Internet connection
- Git repository access
- Build completed successfully

### Offline System (Target Kubernetes)
- Kubernetes cluster (minikube or production)
- kubectl configured
- Docker installed (for minikube)
- USB drive or network transfer capability

---

## Step 1: Build Docker Image (Online System)

```bash
cd release-package/docs-docusaurus

# Build production site
npm run build

# Build Docker image
docker build -t ez-platform-docs:v0.1.1-rc1 .

# Verify image created
docker images | grep ez-platform-docs
```

**Expected output:**
```
ez-platform-docs   v0.1.1-rc1   <IMAGE-ID>   2 minutes ago   50MB
```

---

## Step 2: Export Docker Image to Tar File (Online System)

```bash
# Create images directory
mkdir -p release-package/images

# Export Docker image
docker save ez-platform-docs:v0.1.1-rc1 -o release-package/images/ez-platform-docs-v0.1.1-rc1.tar

# Verify tar file created
ls -lh release-package/images/
```

**Expected file size:** ~50-70 MB

---

## Step 3: Transfer to Offline System

### Option A: USB Drive
```bash
# Copy to USB
cp release-package/images/ez-platform-docs-v0.1.1-rc1.tar /media/usb/

# On offline system
cp /media/usb/ez-platform-docs-v0.1.1-rc1.tar ~/
```

### Option B: Network Transfer (if available)
```bash
# SCP transfer
scp release-package/images/ez-platform-docs-v0.1.1-rc1.tar user@offline-host:~/

# Or rsync
rsync -avz release-package/images/ez-platform-docs-v0.1.1-rc1.tar user@offline-host:~/
```

### Option C: Include in Release Package
```bash
# Tar file already in release-package/images/
# Transfer entire release-package/ directory
```

---

## Step 4: Load Image on Offline System

### For Minikube

```bash
# Start minikube (if not running)
minikube start

# Load the tar file
docker load -i ez-platform-docs-v0.1.1-rc1.tar

# Transfer to minikube
minikube image load ez-platform-docs:v0.1.1-rc1

# Verify image in minikube
minikube ssh "docker images | grep ez-platform-docs"
```

**Expected output:**
```
ez-platform-docs   v0.1.1-rc1   <IMAGE-ID>   <SIZE>
```

### For Production Kubernetes

```bash
# Load on each node
docker load -i ez-platform-docs-v0.1.1-rc1.tar

# Or push to internal registry (if available)
docker tag ez-platform-docs:v0.1.1-rc1 registry.internal:5000/ez-platform-docs:v0.1.1-rc1
docker push registry.internal:5000/ez-platform-docs:v0.1.1-rc1
```

---

## Step 5: Deploy to Kubernetes

```bash
# Apply deployment manifest
kubectl apply -f release-package/docs-docusaurus/k8s-deployment.yaml

# Verify deployment
kubectl get pods -n ez-platform-docs
kubectl get svc -n ez-platform-docs

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=docs -n ez-platform-docs --timeout=120s
```

**Expected output:**
```
NAME                   READY   STATUS    RESTARTS   AGE
docs-xxxxxxxxx-xxxxx   1/1     Running   0          30s
docs-xxxxxxxxx-xxxxx   1/1     Running   0          30s
```

---

## Step 6: Access Documentation

### Via NodePort (Default)

```bash
# Get minikube IP
minikube ip

# Access documentation
# http://<MINIKUBE-IP>:30081
# Example: http://192.168.49.2:30081
```

### Via Ingress (if configured)

```bash
# Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
<NODE-IP>  docs.ezplatform.local

# Access via hostname
# http://docs.ezplatform.local
```

### Via Port Forward (Development)

```bash
kubectl port-forward svc/docs 8081:80 -n ez-platform-docs

# Access at http://localhost:8081
```

---

## Verification Checklist

After deployment, verify:

- [ ] Pods are running (2 replicas)
- [ ] Service is accessible
- [ ] Home page loads correctly
- [ ] Navigation works
- [ ] Search functions
- [ ] Dark mode toggles
- [ ] Hebrew pages display in RTL
- [ ] All 13 documents accessible
- [ ] Logo displays correctly
- [ ] No console errors

### Test Commands

```bash
# Check pod status
kubectl get pods -n ez-platform-docs

# Check service
kubectl get svc -n ez-platform-docs

# View logs
kubectl logs -l app=docs -n ez-platform-docs --tail=50

# Test endpoint
curl -I http://<NODE-IP>:30081

# Check resource usage
kubectl top pods -n ez-platform-docs
```

---

## Troubleshooting

### Issue: Pods not starting

```bash
# Check events
kubectl get events -n ez-platform-docs --sort-by='.lastTimestamp'

# Check pod details
kubectl describe pod <pod-name> -n ez-platform-docs

# Check image pull
kubectl get pods -n ez-platform-docs -o jsonpath='{.items[*].status.containerStatuses[*].imageID}'
```

### Issue: ImagePullBackOff

Ensure image is loaded correctly:

```bash
# For minikube
minikube ssh "docker images | grep ez-platform-docs"

# Verify imagePullPolicy
kubectl get deployment docs -n ez-platform-docs -o yaml | grep imagePullPolicy
```

Should be: `imagePullPolicy: Never` (for offline/local images)

### Issue: Page not loading

```bash
# Check nginx logs
kubectl logs -l app=docs -n ez-platform-docs

# Check service endpoints
kubectl get endpoints docs -n ez-platform-docs

# Test from inside pod
kubectl exec -it <pod-name> -n ez-platform-docs -- wget -O- http://localhost
```

---

## Scaling & Resource Management

### Scale Deployment

```bash
# Scale up
kubectl scale deployment docs --replicas=3 -n ez-platform-docs

# Scale down
kubectl scale deployment docs --replicas=1 -n ez-platform-docs
```

### Adjust Resources

Edit [k8s-deployment.yaml](k8s-deployment.yaml):

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

Apply changes:
```bash
kubectl apply -f k8s-deployment.yaml
kubectl rollout restart deployment/docs -n ez-platform-docs
```

---

## Offline Package Contents

The complete offline deployment package includes:

```
release-package/
├── images/
│   └── ez-platform-docs-v0.1.1-rc1.tar    # Docker image (50-70MB)
├── docs-docusaurus/
│   ├── k8s-deployment.yaml                # Kubernetes manifests
│   ├── OFFLINE-DEPLOYMENT-GUIDE.md        # This guide
│   └── ...
└── ...
```

---

## Updates & Rollback

### Update Documentation

1. Build new version on online system
2. Export with new version tag
3. Transfer to offline system
4. Load and deploy

```bash
# Update deployment
kubectl set image deployment/docs docs=ez-platform-docs:v0.1.2-rc1 -n ez-platform-docs

# Rollback if needed
kubectl rollout undo deployment/docs -n ez-platform-docs
```

### View Rollout History

```bash
kubectl rollout history deployment/docs -n ez-platform-docs
```

---

## Production Recommendations

### High Availability

- Set `replicas: 3` or more
- Use anti-affinity rules for pod distribution
- Configure horizontal pod autoscaling (HPA)

### Security

- Use read-only filesystem
- Run as non-root user
- Add security context
- Enable network policies

### Monitoring

Add monitoring labels to deployment:

```yaml
metadata:
  labels:
    app: docs
    component: documentation
    version: v0.1.1-rc1
```

Integrate with Prometheus/Grafana if available.

---

## Quick Reference

### Commands

```bash
# Deploy
kubectl apply -f k8s-deployment.yaml

# Status
kubectl get all -n ez-platform-docs

# Logs
kubectl logs -f deployment/docs -n ez-platform-docs

# Restart
kubectl rollout restart deployment/docs -n ez-platform-docs

# Delete
kubectl delete -f k8s-deployment.yaml
```

### URLs

- **NodePort:** http://[NODE-IP]:30081
- **Port Forward:** http://localhost:8081
- **Ingress:** http://docs.ezplatform.local (if configured)

---

## File Manifest

| File | Size (est.) | Purpose |
|------|-------------|---------|
| ez-platform-docs-v0.1.1-rc1.tar | ~50-70 MB | Docker image archive |
| k8s-deployment.yaml | ~2 KB | Kubernetes manifests |
| OFFLINE-DEPLOYMENT-GUIDE.md | ~5 KB | This deployment guide |

**Total Package Size:** ~50-75 MB

---

## Support

For issues during offline deployment:

1. Check pod logs: `kubectl logs -l app=docs -n ez-platform-docs`
2. Verify image: `minikube ssh "docker images"`
3. Check events: `kubectl get events -n ez-platform-docs`
4. Review this guide's troubleshooting section

---

**Guide Version:** 1.0
**Last Updated:** January 6, 2026
**Status:** ✅ Ready for offline deployment

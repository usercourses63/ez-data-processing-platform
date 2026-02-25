# Kubernetes Deployment & Access Guide

**Version:** 1.0
**Date:** December 3, 2025
**For:** Week 3 Service Deployment

---

## 🎯 Overview

This guide explains how to manage EZ Platform services in Kubernetes using Helm, access the frontend UI, and configure external folder access.

---

## 📦 Service Management with Helm

### Starting All Services

```bash
# Navigate to helm chart
cd C:\Users\UserC\source\repos\EZ

# Install complete platform (infrastructure + services)
helm install ez-platform ./helm/ez-platform -n ez-platform

# Wait for all pods
kubectl wait --for=condition=ready pod --all -n ez-platform --timeout=10m

# Verify deployment
kubectl get pods -n ez-platform
kubectl get svc -n ez-platform
```

**Expected:** 19 pods total
- 10 infrastructure pods
- 9 service pods

---

### Stopping All Services

```bash
# Uninstall everything
helm uninstall ez-platform -n ez-platform

# Verify stopped
kubectl get pods -n ez-platform
# Should show: No resources found
```

**Note:** This keeps the namespace and PVCs (data persists)

**Complete cleanup:**
```bash
helm uninstall ez-platform -n ez-platform
kubectl delete namespace ez-platform
```

---

### Restarting Individual Services

```bash
# Restart single service
kubectl rollout restart deployment/datasource-management -n ez-platform

# Or delete pod (K8s auto-recreates)
kubectl delete pod -l app=datasource-management -n ez-platform

# Or upgrade Helm with new values
helm upgrade ez-platform ./helm/ez-platform -n ez-platform
```

---

## 🌐 Accessing Frontend in Kubernetes

### Option A: Minikube Service (Recommended for Dev)

```bash
# Open frontend in browser automatically
minikube service frontend -n ez-platform

# Or get URL manually
minikube service frontend -n ez-platform --url
# Example output: http://192.168.49.2:32123
```

**This opens your browser to the frontend!**

---

### Option B: Port Forward (Alternative)

```bash
# Forward K8s frontend to localhost:3000
kubectl port-forward svc/frontend 3000:80 -n ez-platform

# Access at: http://localhost:3000
```

**Note:** Keep terminal open while using

---

### Option C: LoadBalancer (Cloud/Production)

In cloud environments (AWS, GCP, Azure):
```bash
kubectl get svc frontend -n ez-platform
# EXTERNAL-IP will show actual IP address
```

In Minikube, LoadBalancer shows `<pending>` - use Option A instead.

---

## 📁 External Folder Access from K8s

### Issue: K8s Pods Need to Access Host Folders

**Example:** FileDiscoveryService needs to read from `C:\Data\Input`

### Solution 1: HostPath Volumes (Development)

**Update deployment YAML:**
```yaml
# In filediscovery-deployment.yaml
spec:
  template:
    spec:
      volumes:
      - name: data-input
        hostPath:
          path: /host/C/Data/Input  # Minikube maps C:\ to /host/C
          type: DirectoryOrCreate
      containers:
      - name: filediscovery
        volumeMounts:
        - name: data-input
          mountPath: /data/input
```

**Minikube Path Mapping:**
- Windows: `C:\Data` → Minikube: `/host/C/Data`
- Direct access to host filesystem

---

### Solution 2: Mount Host Directory to Minikube

```bash
# Mount local folder to Minikube
minikube mount C:\Data\Input:/data/input

# Then use in pod:
volumes:
- name: data-input
  hostPath:
    path: /data/input
```

**Note:** Keep mount command running

---

### Solution 3: PersistentVolume with HostPath

```yaml
# pv-data-input.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: data-input-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  hostPath:
    path: /host/C/Data/Input
    type: DirectoryOrCreate
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-input-pvc
  namespace: ez-platform
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi
  volumeName: data-input-pv
```

**Recommendation:** Use Solution 1 (simplest for development)

---

## 🌍 External Network Access from K8s

### Issue: Services Need to Access External APIs/Resources

**Default:** K8s pods CAN access external networks

**Verification:**
```bash
# Test from pod
kubectl exec -it deployment/filediscovery -n ez-platform -- curl https://google.com
```

**For specific external services:**
- MongoDB: Already configured in services-config ConfigMap
- Kafka: Already configured
- External APIs: Just use URLs directly (no special config needed)

---

## 📊 Monitoring & Logs

### Access Grafana Dashboard

```bash
# Open Grafana
minikube service ezplatform-grafana -n ez-platform

# Login:
# Username: admin
# Password: admin
```

---

### Access Prometheus

```bash
# System metrics
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform
# Access: http://localhost:9090

# Business metrics (when deployed)
kubectl port-forward svc/prometheus-business 9091:9090 -n ez-platform
# Access: http://localhost:9091
```

---

### View Service Logs

```bash
# Tail logs for a service
kubectl logs -f deployment/filediscovery -n ez-platform

# View logs for specific pod
kubectl logs -f pod/filediscovery-xxxx-yyyy -n ez-platform

# All logs for a service
kubectl logs deployment/filediscovery -n ez-platform --all-containers=true
```

---

## 🔧 Troubleshooting

### Pod Not Starting
```bash
kubectl describe pod <pod-name> -n ez-platform
kubectl logs <pod-name> -n ez-platform
```

### Service Not Accessible
```bash
kubectl get svc -n ez-platform
kubectl get endpoints -n ez-platform
```

### Storage Issues
```bash
kubectl get pvc -n ez-platform
kubectl describe pvc <pvc-name> -n ez-platform
```

---

## 📋 Quick Reference

### Essential Commands

```bash
# Start everything
helm install ez-platform ./helm/ez-platform -n ez-platform

# Stop everything
helm uninstall ez-platform -n ez-platform

# Access frontend
minikube service frontend -n ez-platform

# View all pods
kubectl get pods -n ez-platform

# View all services
kubectl get svc -n ez-platform

# Pod logs
kubectl logs -f deployment/<service-name> -n ez-platform

# Restart service
kubectl rollout restart deployment/<service-name> -n ez-platform
```

---

## 🎯 Week 3 Workflow

**1. Deploy Infrastructure** (Already done!)
```bash
# Already running:
# - MongoDB, Kafka, Hazelcast, Prometheus, Grafana
```

**2. Deploy Services** (Week 3 Day 1-2)
```bash
# After Docker images built:
helm install ez-platform ./helm/ez-platform -n ez-platform
```

**3. Access Frontend**
```bash
minikube service frontend -n ez-platform
# Opens browser to EZ Platform UI
```

**4. Populate Data**
```bash
# Port-forward MongoDB
kubectl port-forward svc/mongodb 27017:27017 -n ez-platform

# Run DemoDataGenerator
cd tools/DemoDataGenerator
dotnet run -- generate-all --mongodb-connection="localhost:27017"
```

**5. Test E2E**
- Upload files to monitored folders
- Monitor in frontend UI
- Check logs: `kubectl logs -f deployment/filediscovery`

---

## 🚀 Ready for Week 3!

**Next Steps:**
1. Create Dockerfiles
2. Build images
3. Complete Helm chart
4. Deploy via Helm
5. Access frontend via Minikube service
6. Start E2E testing!

---

**Document Status:** ✅ Complete
**Last Updated:** December 3, 2025

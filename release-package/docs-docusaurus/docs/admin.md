---
sidebar_position: 2
---

# EZ Platform - Administrator Guide v0.2.0

**Last Updated:** March 2026
**Audience:** System Administrators, DevOps Engineers
**Version:** 0.2.0

---

## Table of Contents

1. [System Overview](#system-overview)
2. [NAS Device Management](#nas-device-management)
3. [Category Management](#category-management)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [SignalR Real-Time Monitoring](#signalr-real-time-monitoring)
6. [Device Health Monitoring](#device-health-monitoring)
7. [OTEL Observability](#otel-observability)
8. [Backup & Recovery](#backup--recovery)
9. [Scaling Guidelines](#scaling-guidelines)
10. [Performance Tuning](#performance-tuning)
11. [Security Hardening](#security-hardening)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

### Architecture

EZ Platform consists of:
- **9 Microservices** (.NET 10.0)
- **React Frontend** (Port 3000)
- **Infrastructure**: MongoDB, RabbitMQ, Kafka, Hazelcast, Elasticsearch
- **Monitoring**: Prometheus, Grafana, Jaeger

**Namespace:** All resources in `ez-platform` namespace

### Messaging Architecture

**Two message brokers with distinct purposes:**

**RabbitMQ (Internal):**
- Used by: All .NET services via MassTransit
- Purpose: Service-to-service event communication
- Events: FileDiscoveredEvent, ValidationCompletedEvent, ProcessingFailedEvent, etc.
- Pattern: Pub/Sub with exchanges and queues
- Connection: `rabbitmq.ez-platform.svc.cluster.local:5672`
- Management UI: http://localhost:15672 (guest/guest via port-forward)

**Apache Kafka (External):**
- Used by: Data source connectors and output handlers
- Purpose: External data ingestion and output destinations
- User-configurable: Users can specify Kafka as input source or output destination
- Topics: User-defined (e.g., "customer-data", "validated-output")
- Connection: `kafka.ez-platform.svc.cluster.local:9092` (internal), `localhost:9094` (external)

### Service Responsibilities

| Service | Purpose | Port |
|---------|---------|------|
| **datasource-management** | API for datasource CRUD, categories | 5001 |
| **filediscovery** | Poll sources for new files | 5005 |
| **fileprocessor** | Convert file formats | 5008 |
| **validation** | Validate against JSON schema | 5003 |
| **output** | Send to destinations | 5009 |
| **scheduling** | Quartz.NET job scheduling | 5004 |
| **invalidrecords** | Manage validation failures | 5007 |
| **metrics-configuration** | Business metrics API | 5002 |
| **frontend** | React UI | 3000 |

---

## NAS Device Management

### Overview

NAS (Network Attached Storage) devices provide shared network storage for file processing. In v0.2.0, administrators can configure NAS devices that are automatically provisioned as Kubernetes PersistentVolumes.

**Access:** Frontend > Admin Settings > NAS Devices tab

**Hebrew interface:** הגדרות מערכת > התקני NAS

### NAS Device Lifecycle

```
1. Create Device (MongoDB)
   ↓
2. Test Connection (NFS ping)
   ↓
3. Provision (Create PV/PVC in K8s)
   ↓
4. Use in Data Sources
```

### Creating a NAS Device

1. Navigate to **Admin Settings** > **NAS Devices**
2. Click **Add NAS Device** (הוסף התקן NAS)
3. Fill in the form:

| Field | Hebrew | Required | Description |
|-------|--------|----------|-------------|
| Name | שם | Yes | Unique display name |
| Host | כתובת שרת | Yes | NFS server IP or hostname |
| Port | יציאה | No | NFS port (default: 2049) |
| Export Path | נתיב יצוא | Yes | NFS export path (e.g., `/exports/data`) |
| Storage Capacity | קיבולת | No | PV size (default: 10Gi) |
| Role | תפקיד | Yes | Input, Output, Both, or Backup |
| Description | תיאור | No | Optional notes |

4. Click **Save** (שמור)

### Device Roles

| Role | Color | Can Read | Can Write | Use Case |
|------|-------|----------|-----------|----------|
| **Input** | Blue | Yes | No | Source files for processing |
| **Output** | Green | No | Yes | Processed file destination |
| **Backup** | Orange | No | Yes | Archive/backup storage |
| **Both** | Purple | Yes | Yes | General purpose |

### Provisioning

After creating a device, you must provision it to create Kubernetes resources:

1. Find the device in the list
2. Click **Provision** (הפעל)
3. System creates:
   - PersistentVolume: `{name}-pv`
   - PersistentVolumeClaim: `{name}-pvc`
4. Status changes to green when bound

**RBAC Required:** The datasource-management service needs cluster-level permissions:
```bash
kubectl apply -f k8s/rbac/nas-device-rbac.yaml
```

### Connection Testing

Before provisioning, test NFS connectivity:

1. Click **Test Connection** (בדוק חיבור)
2. System attempts to reach NFS server
3. Result shows:
   - ✅ Success: Server reachable
   - ❌ Failed: Error message with details

### Deprovisioning

To remove Kubernetes resources without deleting the device:

1. Click **Deprovision** (הסר משאבים)
2. Confirm the action
3. PV and PVC are deleted
4. Device remains in MongoDB for reconfiguration

### API Operations

```bash
# List all NAS devices
curl http://localhost:5001/api/v1/nasdevices

# Create device
curl -X POST http://localhost:5001/api/v1/nasdevices \
  -H "Content-Type: application/json" \
  -d '{"name":"Production-NAS","host":"192.168.1.100","exportPath":"/data","role":"Both"}'

# Provision device
curl -X POST http://localhost:5001/api/v1/nasdevices/{id}/provision

# Test connection
curl -X POST http://localhost:5001/api/v1/nasdevices/{id}/test

# Deprovision
curl -X POST http://localhost:5001/api/v1/nasdevices/{id}/deprovision
```

### Troubleshooting NAS Issues

**Device stuck in "Provisioning":**
```bash
# Check PV status
kubectl get pv | grep {device-name}

# Check PVC status
kubectl get pvc -n ez-platform | grep {device-name}

# Check events
kubectl describe pv {device-name}-pv
kubectl describe pvc {device-name}-pvc -n ez-platform
```

**Connection test fails:**
- Verify NFS server is running: `showmount -e {host}`
- Check firewall allows port 2049
- Verify export path exists and has correct permissions
- Ensure NFS export allows access from K8s nodes

**PVC not binding:**
- Check storage class compatibility
- Verify PV and PVC storage sizes match
- Check access modes match

### Hebrew User Guide

For end-user documentation in Hebrew, see: [מדריך למשתמש](/user-guide-he#ניהול-התקני-nas)

---

## Category Management

### Overview

Categories organize datasources into business domains. Categories are admin-managed and stored in MongoDB.

**Access:** Frontend → הגדרות מערכת (Admin Settings) → קטגוריות tab

### Operations

#### Create Category

1. Navigate to http://localhost:3000/admin/settings
2. Click "הוסף קטגוריה" (Add Category)
3. Fill form:
   - **Hebrew Name**: Required (e.g., "מכירות")
   - **English Name**: Required (e.g., "Sales")
   - **Description**: Optional
4. Click "שמור" (Save)

**Result:** Category appears in dropdown when creating datasources

#### Edit Category

**⚠️ Warning:** Renaming updates ALL existing datasources using this category

1. Click edit icon (✏️) next to category
2. Modify name(s) or description
3. See warning about propagation
4. Click "שמור" (Save)

**Backend Action:** Updates `DataSource.Category` for all matching datasources

#### Delete Category

**Smart Delete Logic:**
- **If unused** (0 datasources): Permanent deletion
- **If in use** (1+ datasources): Soft delete (marks inactive)

**Steps:**
1. Click delete icon (🗑️)
2. System checks usage count (may take 1-2 seconds)
3. Modal shows:
   - Usage count
   - Delete type (permanent vs soft)
   - Impact explanation
4. Confirm deletion

**Soft Delete:**
- Category marked `IsActive = false`
- Existing datasources keep the value
- New datasources cannot select it
- Can be reactivated with toggle button

#### Toggle Active/Inactive

Quick switch for temporarily hiding categories:

1. Click toggle icon (⏹️ or ✅)
2. Confirm action
3. **Active → Inactive**: Hides from datasource dropdown
4. **Inactive → Active**: Shows in dropdown again

**Use case:** Temporarily hide categories without deleting

### API Operations

**Get all categories:**
```bash
curl http://localhost:5001/api/v1/categories

# Include inactive
curl http://localhost:5001/api/v1/categories?includeInactive=true
```

**Check usage:**
```bash
curl http://localhost:5001/api/v1/categories/{id}/usage-count

# Response:
{
  "categoryId": "...",
  "categoryName": "מכירות",
  "usageCount": 15,
  "canHardDelete": false
}
```

### Database Structure

**Collection:** `DataSourceCategories`

```json
{
  "_id": "6952a4cacc058ad70c951136",
  "Name": "מכירות",
  "NameEn": "Sales",
  "Description": "נתוני מכירות ועסקאות",
  "SortOrder": 1,
  "IsActive": true,
  "CreatedAt": "2025-12-29T15:56:58.509Z",
  "UpdatedAt": "2025-12-29T15:56:58.509Z",
  "CreatedBy": "admin",
  "ModifiedBy": null
}
```

---

## Monitoring & Alerts

### Accessing Dashboards

**Grafana:** http://localhost:3001
- Username: `admin`
- Password: `EZPlatform2025!Beta`

**Jaeger:** http://localhost:16686 (no login)

**Prometheus:**
- System: http://localhost:9090
- Business: http://localhost:9091

### Pre-Configured Dashboards

**In Grafana:**
1. **Business Metrics Dashboard**
   - Records processed
   - Files processed
   - Invalid records count
   - Processing duration
   - End-to-end latency

2. **Infrastructure Metrics Dashboard**
   - Pod CPU/Memory usage
   - MongoDB performance
   - Kafka throughput
   - Hazelcast cache stats

### Key Metrics to Monitor

#### Business Metrics (Prometheus Business:9091)
```promql
# Records processed per hour
rate(business_records_processed_total[1h])

# Invalid record rate
rate(business_invalid_records_total[1h]) / rate(business_records_processed_total[1h])

# Processing latency P99
histogram_quantile(0.99, business_processing_duration_seconds_bucket)
```

#### System Metrics (Prometheus System:9090)
```promql
# Pod memory usage
container_memory_usage_bytes{namespace="ez-platform"}

# Pod CPU usage
rate(container_cpu_usage_seconds_total{namespace="ez-platform"}[5m])

# Pod restart count
kube_pod_container_status_restarts_total{namespace="ez-platform"}
```

### Setting Up Alerts

1. Navigate to http://localhost:3000/alerts
2. Click "Create Alert"
3. Configure:
   - **Metric**: Select business or system metric
   - **Condition**: Threshold, comparison
   - **Severity**: Critical, Warning, Info
4. Save

**Example Alerts:**
- Invalid record rate > 10%
- Processing latency > 5 seconds
- Pod memory usage > 80%
- Kafka lag > 1000 messages

---

## SignalR Real-Time Monitoring

### Overview

EZ Platform v0.2.0 introduces real-time monitoring via SignalR WebSocket connections. The `MonitoringBroadcaster` hosted service broadcasts system status to all connected frontend clients.

### SignalR Hub

- **Endpoint:** `/hubs/monitoring`
- **Protocol:** WebSocket with automatic fallback
- **Service:** `MonitoringBroadcaster` (singleton hosted service registered via `AddHostedService`)

### CORS Configuration

SignalR WebSocket requires specific CORS settings:

```csharp
// In Program.cs
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)  // Required for WebSocket
              .AllowCredentials()              // Required for SignalR
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
```

**Important:** `SetIsOriginAllowed` + `AllowCredentials` is required for SignalR WebSocket transport to function across origins.

### Dual-Speed Broadcast

The `MonitoringBroadcaster` uses two broadcast intervals to balance responsiveness and resource usage:

| Speed | Interval | Data Types | Rationale |
|-------|----------|------------|-----------|
| Fast  | 5 seconds | Services, Kafka queues, Pods, Metrics | Fast-changing operational data |
| Slow  | 30 seconds | Traces, Events, Alerts, Device Health | Slower-changing analytical data |

### Kafka AdminClient Pattern

Each health check call creates a **short-lived Kafka AdminClient** to avoid connection pooling issues:

```csharp
// Short-lived AdminClient per call (not pooled)
using var adminClient = new AdminClientBuilder(config).Build();
var metadata = adminClient.GetMetadata(TimeSpan.FromSeconds(5));
```

This pattern avoids stale connections and broker handshake failures that occur with long-lived AdminClient instances.

### Frontend Integration

- **Connection status dot** in `ClusterHeader`: Green (connected), Yellow (reconnecting), Red (disconnected)
- **PascalCase mapper functions** for backend-to-frontend data bridge (backend uses `PropertyNamingPolicy = null`)
- **React Query conditional polling fallback** when SignalR is disconnected (30-second mock data refresh)
- **Automatic reconnection** with backoff: `[0, 2000, 5000, 10000, 30000]` ms

### Troubleshooting SignalR

**Frontend shows "Disconnected":**
```bash
# Check if datasource-management pod is running
kubectl get pods -l app=datasource-management -n ez-platform

# Check SignalR endpoint
curl -v http://localhost:5001/hubs/monitoring/negotiate

# Check CORS headers
curl -H "Origin: http://localhost:7000" -v http://localhost:5001/hubs/monitoring/negotiate
```

**Frequent reconnections:**
- Check Kafka connectivity (short-lived AdminClient may timeout)
- Verify pod memory limits (SignalR connections consume memory)
- Check network stability between frontend and backend

---

## Device Health Monitoring

### Overview

EZ Platform v0.2.0 includes automated health monitoring for all configured NAS devices and admin servers. A Quartz.NET background job checks device connectivity every 30 seconds.

### Health Check Job

- **Scheduler:** Quartz.NET
- **Interval:** Every 30 seconds
- **Scope:** All active NAS devices and admin servers
- **Storage:** MongoDB with TTL for historical health check results

### Consecutive Failure Tracking

Device health status is determined by the number of consecutive check failures:

| Consecutive Failures | Status | Color | Description |
|---------------------|--------|-------|-------------|
| 0 | Healthy | Green | Device responding normally |
| 1-2 | Degraded | Yellow | Intermittent failures or high latency |
| 3+ | Down | Red | Device unreachable or consistently failing |

### Latency Thresholds

Even successful checks may result in Degraded status if latency exceeds thresholds:

| Device Type | Degraded Threshold | Rationale |
|-------------|-------------------|-----------|
| NAS | 2000 ms | NFS mount and file system operations |
| AdminServer | 5000 ms | Protocol connection (FTP, SFTP, HTTP, Kafka) |

### MongoDB TTL History

Health check results are stored in MongoDB with TTL for automatic cleanup:

- Collection: `DeviceHealthHistory`
- TTL: Configurable (default 7 days)
- Purpose: Uptime percentage calculation and trend analysis

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health-status` | All device health statuses (aggregated) |
| GET | `/api/v1/health-status/{id}` | Single device health status |

### Frontend

- **Device Health tab** in System Monitoring page (HeartOutlined icon, positioned between Overview and Pods tabs)
- **Status cards** with color-coded borders (green/yellow/red)
- **Summary bar** showing total/healthy/degraded/down counts
- **15-second React Query polling** as fallback when SignalR is disconnected

### Troubleshooting Device Health

**All devices showing "Down":**
```bash
# Check datasource-management pod health
kubectl logs deployment/datasource-management -n ez-platform --tail=50

# Verify Quartz.NET job is running
kubectl logs deployment/datasource-management -n ez-platform | grep -i "health.*check"
```

**NAS device flapping (Healthy/Degraded):**
- Check NFS server load and network latency
- Consider increasing the NAS degraded threshold from 2000ms if network conditions are slow

---

## OTEL Observability

### Overview

All 8 deployed microservices are verified with 3 OpenTelemetry signals: structured logs, distributed traces, and metrics. Verification result: **24/24 checks pass** (8 services x 3 signals).

### Three-Signal Architecture

| Signal | Pipeline | Destination | Index/Endpoint |
|--------|----------|-------------|----------------|
| **Logs** | Serilog -> OTEL Collector | Elasticsearch | `dataprocessing-logs` |
| **Traces** | OTEL SDK -> OTEL Collector | Jaeger | Port 16686 |
| **Metrics** | OTEL SDK -> OTEL Collector | Prometheus System (9090) + Prometheus Business (9091) | - |

### Kubernetes Configuration

All k8s deployments include the `OpenTelemetry__OtlpEndpoint` environment variable:

```yaml
env:
  - name: OpenTelemetry__OtlpEndpoint
    value: "http://otel-collector:4317"
```

This ensures all services report telemetry to the OTEL Collector via gRPC (port 4317).

### Service Images

The DataSourceManagement service was rebuilt as `v0.2.0-otel` with Serilog logging to ensure consistent OTEL log export across all services.

### Two-Tier Logging

EZ Platform uses a two-tier logging architecture:

| Tier | Source | Collector | Index |
|------|--------|-----------|-------|
| **Infrastructure** | MongoDB, Kafka, Elasticsearch, Hazelcast, Zookeeper | Fluent Bit DaemonSet | `ez-logs-YYYY.MM.DD` |
| **Application** | FileProcessor, Validation, Output, Scheduling, etc. | Serilog -> OTEL Collector | `dataprocessing-logs` |

### Verification

Run the OTEL verification script to confirm all services are reporting:

```bash
# Verify all 24 checks (8 services x 3 signals)
# Check Elasticsearch for logs
curl 'http://localhost:9200/dataprocessing-logs*/_count'

# Check Jaeger for traces
curl 'http://localhost:16686/api/services'

# Check Prometheus for metrics
curl 'http://localhost:9090/api/v1/targets'
```

### Accessing Telemetry

| Tool | URL | Data |
|------|-----|------|
| **Grafana** | http://localhost:3001 | Dashboards for all signals |
| **Jaeger** | http://localhost:16686 | Distributed traces |
| **Elasticsearch** | http://localhost:9200 | Structured logs |
| **Prometheus System** | http://localhost:9090 | Infrastructure metrics |
| **Prometheus Business** | http://localhost:9091 | Business KPIs |

---

## Backup & Recovery

### MongoDB Backup

#### Manual Backup
```bash
# Exec into MongoDB pod
kubectl exec -it mongodb-0 -n ez-platform -- bash

# Create dump
mongodump --db=ezplatform --out=/tmp/backup-$(date +%Y%m%d)

# Copy to local machine
kubectl cp ez-platform/mongodb-0:/tmp/backup-20251229 ./backups/backup-20251229
```

#### Automated Backup (CronJob)
```yaml
# Create k8s/jobs/mongodb-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: ez-platform
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mongo:7.0
            command:
            - /bin/sh
            - -c
            - |
              mongodump --host=mongodb:27017 --db=ezplatform --out=/backup/$(date +%Y%m%d)
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: mongodb-backup-pvc
          restartPolicy: OnFailure
```

### MongoDB Restore

```bash
# Copy backup to pod
kubectl cp ./backups/backup-20251229 ez-platform/mongodb-0:/tmp/restore

# Exec into MongoDB
kubectl exec -it mongodb-0 -n ez-platform -- bash

# Restore
mongorestore --db=ezplatform /tmp/restore/ezplatform
```

### Persistent Volume Backups

**Identify PVCs:**
```bash
kubectl get pvc -n ez-platform
```

**Backup PVC data:**
```bash
# For each PVC, create a backup pod
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: pvc-backup-helper
  namespace: ez-platform
spec:
  containers:
  - name: backup
    image: busybox
    command: ['sleep', '3600']
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: ezplatform-mongodb-data-pvc
EOF

# Copy data
kubectl cp ez-platform/pvc-backup-helper:/data ./backups/mongodb-pvc-data
```

---

## Scaling Guidelines

### Horizontal Scaling (Replicas)

**Stateless Services** (can scale freely):
- FileProcessor
- Validation
- Output
- InvalidRecords

```bash
# Scale FileProcessor to 5 replicas
kubectl scale deployment fileprocessor --replicas=5 -n ez-platform

# Verify
kubectl get pods -l app=fileprocessor -n ez-platform
```

**Stateful Services** (limited scaling):
- DataSourceManagement: 1-2 replicas
- Scheduling: 1 replica only (Quartz.NET limitation)
- MetricsConfiguration: 1-2 replicas

**Infrastructure:**
- MongoDB: 3 replicas (replica set)
- Kafka: 3 replicas (cluster)
- Hazelcast: 2-4 replicas (cluster)

### Vertical Scaling (Resources)

**Increase memory for FileProcessor:**
```bash
kubectl set resources deployment fileprocessor \
  --requests=cpu=100m,memory=256Mi \
  --limits=cpu=1000m,memory=1Gi \
  -n ez-platform
```

**Adjust for all services:**
```bash
for deploy in fileprocessor validation output invalidrecords; do
  kubectl set resources deployment $deploy \
    --requests=cpu=100m,memory=256Mi \
    --limits=cpu=1000m,memory=1Gi \
    -n ez-platform
done
```

### Auto-Scaling (HPA)

**Enable Horizontal Pod Autoscaler:**
```bash
# Scale FileProcessor based on CPU
kubectl autoscale deployment fileprocessor \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n ez-platform

# Verify HPA
kubectl get hpa -n ez-platform
```

### Kafka Partition Scaling

For higher throughput, increase Kafka partitions:

```bash
# Exec into Kafka pod
kubectl exec -it kafka-0 -n ez-platform -- bash

# Increase partitions for topic
kafka-topics.sh --bootstrap-server localhost:9092 \
  --topic dataprocessing.validation.completed \
  --alter --partitions 6
```

**Recommendation:** Match partitions to max consumer count (e.g., 6 partitions = 6 Validation pods)

---

## Performance Tuning

### Hazelcast Cache Tuning

**Adjust TTL:**
```yaml
# Edit k8s/configmaps/services-config.yaml
Hazelcast__CacheTTLHours: "2"  # Increase from 1 to 2 hours
```

**Monitor cache hit rate:**
```bash
# In Grafana or Prometheus
hazelcast_map_get_total
hazelcast_map_hit_total
```

**Target:** >95% hit rate

### MongoDB Performance

**Create indexes:**
```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongosh

use ezplatform

# Datasource queries
db.DataSources.createIndex({ "Name": 1 }, { unique: true })
db.DataSources.createIndex({ "Category": 1 })
db.DataSources.createIndex({ "IsActive": 1 })
db.DataSources.createIndex({ "CreatedAt": -1 })

# Categories
db.DataSourceCategories.createIndex({ "SortOrder": 1 })
db.DataSourceCategories.createIndex({ "IsActive": 1 })
```

**Monitor slow queries:**
```bash
# Enable profiling
db.setProfilingLevel(1, { slowms: 100 })

# View slow queries
db.system.profile.find().sort({ ts: -1 }).limit(5)
```

### Kafka Performance

**Producer configuration** (in k8s/configmaps):
```yaml
Kafka__BatchSize: "32768"  # Increase batch size
Kafka__LingerMs: "20"       # Increase linger time
Kafka__CompressionType: "lz4"  # Use lz4 for better throughput
```

**Consumer configuration:**
```yaml
Kafka__FetchMinBytes: "1024"
Kafka__FetchMaxWaitMs: "500"
```

---

## Security Hardening

### Production Security Checklist

#### ✅ Already Secured (BETA)
- Grafana password in K8s Secret
- Jaeger Elasticsearch persistence
- Security headers enabled in services
- CORS configured

#### ⚠️ TODO for Production

**1. Enable MongoDB Authentication**
```bash
# Create admin user
kubectl exec -it mongodb-0 -n ez-platform -- mongosh

use admin
db.createUser({
  user: "ezadmin",
  pwd: "secure-password-here",
  roles: [{ role: "readWrite", db: "ezplatform" }]
})

# Update ConfigMap with auth
mongodb-connection: "mongodb://ezadmin:password@mongodb:27017/ezplatform?authSource=admin"
```

**2. Enable Elasticsearch Security**
```yaml
# Edit k8s/infrastructure/elasticsearch-deployment.yaml
env:
- name: xpack.security.enabled
  value: "true"
- name: ELASTIC_PASSWORD
  valueFrom:
    secretKeyRef:
      name: elasticsearch-credentials
      key: password
```

**3. Add Network Policies**
```yaml
# Create k8s/network-policies/deny-all.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: ez-platform
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

**4. Pod Security Standards**
```yaml
# Add to namespace
apiVersion: v1
kind: Namespace
metadata:
  name: ez-platform
  labels:
    pod-security.kubernetes.io/enforce: restricted
```

**5. Secrets Encryption**

Use external secret management:
- **Vault**: HashiCorp Vault integration
- **Sealed Secrets**: Bitnami Sealed Secrets
- **External Secrets Operator**: For cloud KMS

### Change Grafana Password

```bash
# Generate new password
NEW_PASSWORD="YourSecurePassword123!"

# Base64 encode
echo -n "$NEW_PASSWORD" | base64

# Update secret
kubectl edit secret grafana-credentials -n ez-platform

# Change admin-password value to base64-encoded password

# Restart Grafana
kubectl rollout restart deployment/ezplatform-grafana -n ez-platform
```

---

## Backup & Recovery

See [Backup & Recovery](#backup--recovery) section for:
- MongoDB backup procedures
- PVC snapshot strategies
- Disaster recovery planning

### Backup Schedule Recommendation

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| **MongoDB** | Daily | 30 days |
| **PVCs** | Weekly | 4 weeks |
| **Configuration** | On change | Version control |

---

## Scaling Guidelines

### When to Scale

**Scale FileProcessor if:**
- File processing queue > 100
- Hazelcast cache misses increasing
- Processing latency > 5 seconds

**Scale Validation if:**
- Validation queue backlog growing
- Validation latency > 2 seconds
- CPU usage > 70%

**Scale Output if:**
- Output queue backlog > 50
- Destination write errors increasing
- Memory pressure

### Scaling Commands

```bash
# Quick scale
kubectl scale deployment fileprocessor --replicas=5 -n ez-platform

# Auto-scale
kubectl autoscale deployment fileprocessor \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n ez-platform
```

### Infrastructure Scaling

**MongoDB:**
- Already 3-node replica set (recommended)
- Don't scale beyond 7 nodes (diminishing returns)

**Kafka:**
- Increase partitions (see [Performance Tuning](#performance-tuning))
- Add brokers carefully (requires rebalancing)

**Hazelcast:**
- Scale to 3-4 nodes for larger datasets
- Monitor memory usage per node

---

## Monitoring Best Practices

### Health Check Monitoring

**Create monitoring script:**
```bash
#!/bin/bash
# health-check.sh

services=("datasource-management:5001" "validation:5003" "scheduling:5004")

for svc in "${services[@]}"; do
  name="${svc%:*}"
  port="${svc#*:}"

  if curl -sf http://localhost:$port/health > /dev/null; then
    echo "✅ $name is healthy"
  else
    echo "❌ $name is unhealthy"
  fi
done
```

### Log Aggregation

**View centralized logs in Elasticsearch:**
```bash
# Query logs via Elasticsearch
curl 'http://localhost:9200/dataprocessing-logs-*/_search?q=level:error&size=100'
```

**In Grafana:**
- Data Source: Elasticsearch-Logs
- Query logs by service, level, timestamp

### Distributed Tracing

**Jaeger UI:** http://localhost:16686

**Find traces:**
1. Service: Select service (e.g., `dataprocessing.fileprocessor`)
2. Operation: Select operation (e.g., `ProcessFile`)
3. Lookback: Last hour
4. Find Traces

**Trace Analysis:**
- End-to-end latency breakdown
- Service dependencies
- Error tracing across services

---

## Troubleshooting

### Service Won't Start

**Check pod status:**
```bash
kubectl get pods -n ez-platform

# Describe problem pod
kubectl describe pod <pod-name> -n ez-platform

# View logs
kubectl logs <pod-name> -n ez-platform --tail=100
```

**Common causes:**
- Image pull error → Check image name/tag
- CrashLoopBackOff → Check logs for startup errors
- Pending → Check PVC binding, resource quotas

### Database Connection Errors

**Test MongoDB connection:**
```bash
# From within cluster
kubectl exec -it mongodb-0 -n ez-platform -- mongosh

# From service pod
kubectl exec -it deployment/datasource-management -n ez-platform -- \
  curl -v mongodb://mongodb:27017
```

**Check ConfigMap:**
```bash
kubectl get configmap services-config -n ez-platform -o yaml | grep mongodb
```

### Kafka Message Not Flowing

**Check topics:**
```bash
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**Check consumer lag:**
```bash
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups
```

**View messages:**
```bash
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic dataprocessing.validation.completed \
  --from-beginning \
  --max-messages 10
```

### Hazelcast Cache Issues

**Check cluster status:**
```bash
kubectl logs deployment/hazelcast -n ez-platform | grep -i "members"
```

Expected: `Members {2}` or `Members {3}`

**Clear cache manually:**
```bash
kubectl exec -it deployment/hazelcast -n ez-platform -- \
  curl -X DELETE http://localhost:5701/hazelcast/rest/maps/file-content/entries
```

### High Memory Usage

**Identify memory hogs:**
```bash
kubectl top pods -n ez-platform --sort-by=memory
```

**Restart high-memory pods:**
```bash
kubectl rollout restart deployment/<service-name> -n ez-platform
```

**Adjust memory limits:**
```bash
kubectl set resources deployment/<service-name> \
  --limits=memory=1Gi \
  -n ez-platform
```

---

## Maintenance Tasks

### Daily
- [ ] Check pod status: `kubectl get pods -n ez-platform`
- [ ] Review Grafana dashboards for anomalies
- [ ] Check disk usage: `kubectl top nodes`

### Weekly
- [ ] Review Elasticsearch logs for errors
- [ ] Check Kafka consumer lag
- [ ] Review invalid records count
- [ ] Verify backup completion

### Monthly
- [ ] Review and optimize MongoDB indexes
- [ ] Clean up old Elasticsearch indices
- [ ] Review resource allocation vs usage
- [ ] Update documentation if needed

### As Needed
- [ ] Scale services based on load
- [ ] Tune Hazelcast cache settings
- [ ] Update category list
- [ ] Review and adjust alerts

---

## Configuration Management

### ConfigMap Updates

After changing ConfigMap:
```bash
# Edit ConfigMap
kubectl edit configmap services-config -n ez-platform

# Restart affected services
kubectl rollout restart deployment/fileprocessor -n ez-platform
kubectl rollout restart deployment/validation -n ez-platform
```

**Services auto-detect ConfigMap changes:** No (manual restart required)

### Secret Rotation

**Rotate Grafana password:**
1. Generate new password and base64 encode
2. Update secret: `kubectl edit secret grafana-credentials -n ez-platform`
3. Restart Grafana: `kubectl rollout restart deployment/ezplatform-grafana -n ez-platform`

---

## Advanced Topics

### Custom DataSource Categories

Categories are now fully admin-managed via UI. See [Category Management](#category-management).

### Adding Custom Metrics

1. Define metric in service code (Prometheus counter/histogram)
2. Metric auto-exported via OpenTelemetry
3. Create Grafana panel with PromQL query
4. Set up alerts if needed

### Integrating External Systems

**External Kafka:**
Update `kafka-server` in ConfigMap to point to external broker

**External MongoDB:**
Update `mongodb-connection` in ConfigMap

**External Elasticsearch:**
Update service configurations to point to external ES cluster

---

## Maintenance Tools & Utilities

### Reset Hazelcast Cache

**Clear all cached data:**
```bash
# Delete file-content map
kubectl exec deployment/hazelcast -n ez-platform -- \
  curl -X DELETE http://localhost:5701/hazelcast/rest/maps/file-content

# Delete valid-records map
kubectl exec deployment/hazelcast -n ez-platform -- \
  curl -X DELETE http://localhost:5701/hazelcast/rest/maps/valid-records

# Verify cleared
kubectl exec deployment/hazelcast -n ez-platform -- \
  curl http://localhost:5701/hazelcast/rest/maps/file-content/size
```

**Or restart Hazelcast pods (clears all):**
```bash
kubectl rollout restart deployment/hazelcast -n ez-platform
```

### Purge RabbitMQ Queues

**List queues:**
```bash
kubectl exec deployment/rabbitmq -n ez-platform -- \
  rabbitmqctl list_queues name messages
```

**Purge specific queue:**
```bash
kubectl exec deployment/rabbitmq -n ez-platform -- \
  rabbitmqctl purge_queue "queue-name"
```

**Delete all messages in all queues:**
```bash
# Get all queue names
kubectl exec deployment/rabbitmq -n ez-platform -- \
  rabbitmqctl list_queues name -q | while read queue; do
    kubectl exec deployment/rabbitmq -n ez-platform -- \
      rabbitmqctl purge_queue "$queue"
  done
```

**Access RabbitMQ Management UI:**
```bash
# Port forward (if not already running)
kubectl port-forward deployment/rabbitmq 15672:15672 -n ez-platform

# Open browser
http://localhost:15672
# Login: guest / guest
```

### Clear Kafka Topics

**List topics:**
```bash
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**Delete topic (removes all messages):**
```bash
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-topics.sh --bootstrap-server localhost:9092 \
  --delete --topic topic-name
```

**Recreate topic:**
```bash
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic topic-name \
  --partitions 3 \
  --replication-factor 1
```

### Reset MongoDB Collections

**⚠️ DANGER: This deletes data!**

```bash
# Backup first!
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongodump --db=ezplatform --out=/tmp/backup-$(date +%Y%m%d)

# Connect to MongoDB
kubectl exec -it mongodb-0 -n ez-platform -- mongosh

# In mongosh:
use ezplatform

# Drop specific collection
db.DataSources.drop()

# Or delete all documents (keeps collection)
db.DataSources.deleteMany({})

# Verify
db.DataSources.countDocuments()
```

### Reset System to Clean State

**Complete reset (for testing):**
```bash
# Stop all services
kubectl scale deployment --all --replicas=0 -n ez-platform

# Clear Hazelcast
kubectl exec deployment/hazelcast -n ez-platform -- \
  curl -X DELETE http://localhost:5701/hazelcast/rest/maps/file-content
kubectl exec deployment/hazelcast -n ez-platform -- \
  curl -X DELETE http://localhost:5701/hazelcast/rest/maps/valid-records

# Clear RabbitMQ
kubectl exec deployment/rabbitmq -n ez-platform -- \
  rabbitmqctl reset

# Clear MongoDB (optional - DANGER!)
kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "
  use ezplatform;
  db.DataSources.deleteMany({});
  db.InvalidRecords.deleteMany({});
"

# Restart services
kubectl scale deployment datasource-management --replicas=1 -n ez-platform
kubectl scale deployment filediscovery --replicas=1 -n ez-platform
kubectl scale deployment fileprocessor --replicas=1 -n ez-platform
kubectl scale deployment validation --replicas=1 -n ez-platform
kubectl scale deployment output --replicas=1 -n ez-platform
kubectl scale deployment invalidrecords --replicas=1 -n ez-platform
kubectl scale deployment scheduling --replicas=1 -n ez-platform
kubectl scale deployment metrics-configuration --replicas=1 -n ez-platform
kubectl scale deployment frontend --replicas=1 -n ez-platform
```

### Database Seeding

**Re-seed default categories:**
```bash
# Categories are auto-seeded on first startup
# To force re-seed, delete categories collection and restart:

kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "
  use ezplatform;
  db.DataSourceCategories.drop();
"

# Restart DataSourceManagement to trigger seeding
kubectl rollout restart deployment/datasource-management -n ez-platform

# Check logs for seeding confirmation
kubectl logs deployment/datasource-management -n ez-platform | grep -i "קטגוריות"
```

### Generate Test Data

**Using DemoDataGenerator:**
```bash
# Navigate to tool
cd tools/DemoDataGenerator

# Generate demo data (20 datasources, 20 metrics)
dotnet run

# Or incremental mode (adds to existing)
dotnet run -- --incremental
```

### Export/Import Categories

**Export categories:**
```bash
kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "
  use ezplatform;
  printjson(db.DataSourceCategories.find().toArray());
" > categories-export.json
```

**Import categories:**
```bash
# Copy JSON to pod
kubectl cp categories-export.json mongodb-0:/tmp/categories.json -n ez-platform

# Import
kubectl exec -it mongodb-0 -n ez-platform -- mongoimport \
  --db=ezplatform \
  --collection=DataSourceCategories \
  --file=/tmp/categories.json \
  --jsonArray
```

---

## Appendix

### Useful Commands Reference

**Pod Management:**
```bash
# List all pods
kubectl get pods -n ez-platform

# Describe pod
kubectl describe pod <pod-name> -n ez-platform

# View logs
kubectl logs -f <pod-name> -n ez-platform

# Exec into pod
kubectl exec -it <pod-name> -n ez-platform -- /bin/bash
```

**Service Management:**
```bash
# List services
kubectl get svc -n ez-platform

# Restart deployment
kubectl rollout restart deployment/<name> -n ez-platform

# Check rollout status
kubectl rollout status deployment/<name> -n ez-platform
```

**Resource Management:**
```bash
# Resource usage
kubectl top pods -n ez-platform
kubectl top nodes

# Describe resources
kubectl describe deployment <name> -n ez-platform
kubectl describe pvc <name> -n ez-platform
```

---

**Admin Guide Version:** 2.1
**Platform Version:** v0.2.0
**Last Updated:** March 2026

# EZ Platform - Administrator Guide v0.1.0-beta

**Last Updated:** December 29, 2025
**Audience:** System Administrators, DevOps Engineers
**Version:** 0.1.0-beta

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Category Management](#category-management)
3. [Monitoring & Alerts](#monitoring--alerts)
4. [Backup & Recovery](#backup--recovery)
5. [Scaling Guidelines](#scaling-guidelines)
6. [Performance Tuning](#performance-tuning)
7. [Security Hardening](#security-hardening)
8. [Troubleshooting](#troubleshooting)

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

**Admin Guide Version:** 1.0
**Platform Version:** v0.1.0-beta
**Last Updated:** December 29, 2025

# EZ Platform - RTO/RPO Disaster Recovery Runbook

**Version:** 1.0
**Last Updated:** March 18, 2026
**Scope:** Internal Data Processing Platform
**Status:** Production Ready

---

## 1. Recovery Objectives

### 1.1 RTO (Recovery Time Objective)

Maximum acceptable time to restore service after a failure.

| Scenario | RTO | Notes |
|----------|-----|-------|
| **Individual Service Pod Crash** | 5 minutes | Kubernetes auto-restart (up to 2 retries) |
| **Multiple Service Pods Down** | 10 minutes | Manual rollout restart |
| **MongoDB Primary Failure** | 30 seconds | Replica set auto-election + failover |
| **Kafka Broker Failure** | 5 minutes | Consumer rebalance + Zookeeper re-election |
| **Hazelcast Node Failure** | 2 minutes | Re-election + cache rehydration from source |
| **Partial Cluster Loss (1-2 services)** | 15 minutes | Redeploy affected services from manifests |
| **Complete Platform Failure** | 30 minutes | Full redeploy from `k8s/` manifests + data restore |

### 1.2 RPO (Recovery Point Objective)

Maximum acceptable data loss (time since last backup).

| Component | RPO | Backup Strategy | Notes |
|-----------|-----|-----------------|-------|
| **MongoDB** | 1 hour | Hourly snapshots via `mongodump` from secondary | Zero-downtime read from secondary replica |
| **Kafka Topics** | 0 minutes | Retention-based (Kafka broker retains 7 days) | Consumers replay from retained messages; no backup needed |
| **Hazelcast Cache** | 5 minutes | Ephemeral (no backup) | Cache is derived from MongoDB source data; rehydrate on restart |
| **Configuration (ConfigMaps)** | 1 day | Git + Kubernetes API snapshots | Stored in `k8s/configmaps/` (version controlled) |
| **Elasticsearch Logs** | 1 day | Fluent Bit → Elasticsearch (retention: 30 days) | For audit/debugging only; not business-critical |

---

## 2. MongoDB Backup & Restore Procedures

### 2.1 Prerequisites

- Cluster: `ez-platform` namespace
- Database: `ezplatform`
- MongoDB: 3-node replica set (`mongodb-0`, `mongodb-1`, `mongodb-2`)
- Dev environment: Single node must `rs.initiate()` after fresh deploy
- kubectl access with cluster admin privileges

### 2.2 Backup Strategy

**Why read from secondary?**
- Prevents latency spikes on primary
- Allows full scans without impacting production workload
- Replica set consistency guarantees deliver point-in-time snapshot

**Backup Frequency:** Hourly (automated via CronJob recommended for production)

### 2.3 Manual Backup Procedure

#### Step 1: Create backup directory inside MongoDB pod
```bash
kubectl exec -it mongodb-0 -n ez-platform -- mkdir -p /tmp/backups
```

#### Step 2: Execute mongodump from secondary replica
```bash
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/tmp/backup-${BACKUP_TIMESTAMP}"

kubectl exec -it mongodb-0 -n ez-platform -- \
  mongodump \
    --db ezplatform \
    --out "${BACKUP_DIR}" \
    --readPreference secondary \
    --quiet
```

**Expected output:** Directory structure `${BACKUP_DIR}/ezplatform/` containing BSON files

#### Step 3: Copy backup from pod to local machine
```bash
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
kubectl cp ez-platform/mongodb-0:/tmp/backup-${BACKUP_TIMESTAMP} \
  ./backups/backup-${BACKUP_TIMESTAMP}
```

#### Step 4: Verify backup integrity
```bash
# List collections in backup
ls -lh ./backups/backup-${BACKUP_TIMESTAMP}/ezplatform/

# Expected files (example):
# datasources.bson, datasources.metadata.json
# schedules.bson, schedules.metadata.json
# metrics.bson, metrics.metadata.json
# ... (one .bson + .metadata.json per collection)
```

#### Step 5: Compress and archive (optional but recommended)
```bash
cd ./backups
tar -czf backup-${BACKUP_TIMESTAMP}.tar.gz backup-${BACKUP_TIMESTAMP}
rm -rf backup-${BACKUP_TIMESTAMP}
ls -lh backup-${BACKUP_TIMESTAMP}.tar.gz
```

### 2.4 Automated Backup via Kubernetes CronJob

For production deployments, create a CronJob to automate hourly backups:

**File: `k8s/backups/mongodb-backup-cronjob.yaml`**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: ez-platform
spec:
  # Run at top of every hour
  schedule: "0 * * * *"

  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: mongodb-backup
          containers:
          - name: backup
            image: bitnami/mongodb:latest
            env:
            - name: BACKUP_DIR
              value: /tmp/backups
            command:
            - /bin/bash
            - -c
            - |
              TIMESTAMP=$(date +%Y%m%d-%H%M%S)
              mkdir -p ${BACKUP_DIR}/backup-${TIMESTAMP}
              mongodump \
                --host mongodb-0.mongodb-headless:27017 \
                --db ezplatform \
                --out ${BACKUP_DIR}/backup-${TIMESTAMP} \
                --readPreference secondary

              # Compress
              tar -czf ${BACKUP_DIR}/backup-${TIMESTAMP}.tar.gz \
                ${BACKUP_DIR}/backup-${TIMESTAMP}

              # Copy to persistent storage or cloud (optional)
              # aws s3 cp ${BACKUP_DIR}/backup-${TIMESTAMP}.tar.gz s3://backups/...

              # Cleanup old backups (>7 days)
              find ${BACKUP_DIR} -name "backup-*.tar.gz" -mtime +7 -delete

            volumeMounts:
            - name: backup-storage
              mountPath: /tmp/backups

          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: mongodb-backup-pvc

          restartPolicy: OnFailure

  # Keep last 3 successful jobs
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
```

### 2.5 Restore Procedure

#### Warning: Data Destructive
This procedure **drops the existing database** and restores from backup. Perform only during maintenance windows.

#### Step 1: Copy backup into MongoDB pod
```bash
BACKUP_TIMESTAMP="20260318-145023"  # Use actual backup timestamp

# If backup is compressed, decompress first
tar -xzf ./backups/backup-${BACKUP_TIMESTAMP}.tar.gz
kubectl cp ./backups/backup-${BACKUP_TIMESTAMP} \
  ez-platform/mongodb-0:/tmp/restore
```

#### Step 2: Connect to MongoDB and verify current data (optional)
```bash
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "db.getSiblingDB('ezplatform').stats()"
```

#### Step 3: Execute mongorestore (drops existing database)
```bash
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongorestore \
    --db ezplatform \
    --drop \
    /tmp/restore/ezplatform \
    --quiet
```

**Warning:** `--drop` flag deletes all existing collections before restore. If unsure, restore to a temporary database first:
```bash
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongorestore \
    --db ezplatform-temp \
    /tmp/restore/ezplatform
```

#### Step 4: Verify restore completion
```bash
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "
    db.getSiblingDB('ezplatform').getCollectionNames().forEach(c =>
      print(c + ': ' + db.getSiblingDB('ezplatform')[c].countDocuments() + ' docs')
    )
  "
```

Expected output:
```
datasources: 45 docs
schedules: 12 docs
metrics: 567 docs
...
```

#### Step 5: Verify data integrity (sample queries)
```bash
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "
    const db = db.getSiblingDB('ezplatform');
    print('DataSources:', db.datasources.countDocuments());
    print('Sample DataSource:', JSON.stringify(db.datasources.findOne(), null, 2));
    print('Schedules:', db.schedules.countDocuments());
    print('Metrics:', db.metrics.countDocuments());
  "
```

#### Step 6: Verify replica set replication (wait 10-30 seconds)
```bash
kubectl exec -it mongodb-1 -n ez-platform -- \
  mongosh --eval "
    db.getSiblingDB('ezplatform').datasources.countDocuments()
  "
```

Should match the count from `mongodb-0`. If not, replication is lagging.

#### Step 7: Restart services to clear any stale caches
```bash
kubectl rollout restart deployment/validation -n ez-platform
kubectl rollout restart deployment/fileprocessor -n ez-platform
kubectl rollout restart deployment/datasource-management -n ez-platform

# Monitor rollout
kubectl rollout status deployment/validation -n ez-platform
```

---

## 3. Incident Response Runbook

### 3.1 Service Degraded (Single Pod Crash)

**Symptom:** One pod not responding; other replicas healthy; no errors in other pods.

**Detection:**
```bash
# Check pod status
kubectl get pods -n ez-platform

# Expected: One pod in CrashLoopBackOff or Pending state
# Others in Running state
```

**Response (RTO: 5 minutes):**

```bash
# Identify crashed pod
SERVICE_NAME="fileprocessor"  # Replace with actual service
POD=$(kubectl get pods -l app=${SERVICE_NAME} -n ez-platform \
  -o jsonpath='{.items[?(@.status.phase=="Failed")].metadata.name}')

echo "Crashed pod: ${POD}"

# Check logs to diagnose
kubectl logs ${POD} -n ez-platform --tail=50

# Option 1: Let Kubernetes auto-restart (default: 2 retries over 5 minutes)
# Just wait and monitor:
kubectl get pods -l app=${SERVICE_NAME} -n ez-platform --watch

# Option 2: Force immediate restart
kubectl delete pod ${POD} -n ez-platform
# Kubernetes immediately spawns new pod
```

**Verification:**
```bash
kubectl wait --for=condition=Ready pod \
  -l app=${SERVICE_NAME} -n ez-platform --timeout=60s

# Verify service responds
curl http://localhost:5001/health  # (adjust port for service)
```

---

### 3.2 MongoDB Primary Failure

**Symptom:** MongoDB connection errors; replica set leader unavailable; `rs.status()` shows no primary.

**Detection:**
```bash
# Check MongoDB replica set status
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "rs.status()"

# Look for:
# - "stateStr": "PRIMARY" (one should exist)
# - "stateStr": "SECONDARY" (two should exist)
# - "health": 0 (failed members)
```

**Response (RTO: 30 seconds - automatic):**

MongoDB replica set **automatically elects a new primary** within 10-30 seconds. No manual intervention usually needed.

```bash
# Monitor the election
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "
    let attempts = 0;
    while(attempts < 10) {
      const status = rs.status();
      const primary = status.members.find(m => m.stateStr === 'PRIMARY');
      if(primary) {
        print('New primary elected: ' + primary.name);
        break;
      }
      print('Waiting for primary election (' + attempts + '/10)...');
      sleep(3000);
      attempts++;
    }
  "
```

**If primary does not recover after 2 minutes:**

```bash
# Check pod status
kubectl get pods -l app=mongodb -n ez-platform

# Restart failed MongoDB pod
kubectl delete pod mongodb-0 -n ez-platform
# (or whichever pod is down)

# Verify recovery
kubectl wait --for=condition=Ready pod \
  -l app=mongodb -n ez-platform --timeout=120s

# Verify replication is healthy
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "
    rs.status().members.forEach(m =>
      print(m.name + ': ' + m.stateStr + ' (health: ' + m.health + ')')
    )
  "
```

---

### 3.3 Kafka Unresponsive

**Symptom:** Kafka brokers not responding; consumers hang; producer errors; `InconsistentClusterIdException` in logs.

**Detection:**
```bash
# Check Kafka pod status
kubectl get pods -l app=kafka -n ez-platform

# Check Kafka logs for cluster ID errors
kubectl logs -l app=kafka -n ez-platform --tail=100 | grep -i "inconsistent\|cluster"

# Try to connect (from within cluster)
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

**Response (RTO: 5 minutes):**

#### For Single Broker Failure (broker restarted normally):
```bash
# Restart the broker pod
kubectl delete pod kafka-0 -n ez-platform  # (adjust pod number)

# Monitor recovery
kubectl logs -f kafka-0 -n ez-platform | grep -i "became leader\|controller\|ready"
```

#### For Cluster ID Mismatch (after unclean restart):

**Root Cause:** Stale `meta.properties` in Kafka PVC doesn't match new ZooKeeper cluster ID.

```bash
# Step 1: Scale down StatefulSets
kubectl scale statefulset kafka --replicas=0 -n ez-platform
kubectl scale statefulset zookeeper --replicas=0 -n ez-platform
sleep 30

# Step 2: Identify and delete PVCs
kubectl get pvc -n ez-platform | grep -E "kafka-storage|zookeeper"

# Example output:
# kafka-storage-kafka-0              Bound    pv-kafka-0    10Gi   RWO
# kafka-storage-kafka-1              Bound    pv-kafka-1    10Gi   RWO
# zookeeper-datadir-zookeeper-0      Bound    pv-zk-0       2Gi    RWO

# Delete PVCs
kubectl delete pvc -n ez-platform \
  kafka-storage-kafka-0 \
  kafka-storage-kafka-1 \
  kafka-storage-kafka-2 \
  zookeeper-datadir-zookeeper-0 \
  zookeeper-datadir-zookeeper-1 \
  zookeeper-datadir-zookeeper-2

# Step 3: Delete underlying PVs (if in "Released" state)
kubectl get pv | grep -E "pv-kafka|pv-zk|Released"

# Example: delete Released PVs
kubectl delete pv pv-kafka-0 pv-kafka-1 pv-kafka-2 pv-zk-0 pv-zk-1 pv-zk-2

# Step 4: Reapply manifests (creates new PVs/PVCs)
kubectl apply -f k8s/infrastructure/kafka-statefulset.yaml
kubectl apply -f k8s/infrastructure/zookeeper-statefulset.yaml

# Step 5: Monitor startup
kubectl get pods -l app=kafka -n ez-platform --watch
kubectl logs -f kafka-0 -n ez-platform

# Wait for all brokers to be ready (5-10 minutes)
```

**Verification:**
```bash
# Verify broker is healthy
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# Verify topics exist
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-topics.sh --list --bootstrap-server localhost:9092

# Verify consumers can connect
kubectl exec -it fileprocessor-0 -n ez-platform -- \
  kafka-consumer-groups.sh --list --bootstrap-server kafka:9092
```

---

### 3.4 Hazelcast Cache Failure

**Symptom:** Cache misses; slow queries; Hazelcast pod down; services falling back to MongoDB.

**Detection:**
```bash
# Check Hazelcast pod
kubectl get pods -l app=hazelcast -n ez-platform

# Check cluster status
kubectl exec -it hazelcast-0 -n ez-platform -- \
  curl http://localhost:5701/hazelcast/health -s | jq .

# Check logs
kubectl logs -f hazelcast-0 -n ez-platform
```

**Response (RTO: 2 minutes):**

```bash
# Restart Hazelcast
kubectl delete pod hazelcast-0 -n ez-platform

# Monitor recovery
kubectl logs -f hazelcast-0 -n ez-platform | grep -i "starting\|cluster\|joined"

# Verify cluster is ready
kubectl wait --for=condition=Ready pod -l app=hazelcast -n ez-platform --timeout=60s

# Verify cache connectivity from a service
kubectl exec -it fileprocessor-0 -n ez-platform -- \
  curl http://hazelcast:5701/hazelcast/health

# Cache will rehydrate automatically from MongoDB on first miss
# Expected: P99 latency spike for 5-10 seconds (initial fill), then normal
```

---

### 3.5 Complete Service Failure (All Pods Down)

**Symptom:** No pods running; cluster nodes down; cannot connect to Kubernetes API.

**Response (RTO: 30 minutes):**

#### Step 1: Verify cluster is accessible
```bash
kubectl cluster-info
kubectl get nodes
```

#### Step 2: Redeploy infrastructure (MongoDB, Kafka, Redis, Hazelcast)
```bash
# Apply namespace
kubectl apply -f k8s/namespace.yaml

# Apply infrastructure in order
kubectl apply -f k8s/infrastructure/mongodb-*.yaml
kubectl wait --for=condition=Ready pod -l app=mongodb -n ez-platform --timeout=300s

kubectl apply -f k8s/infrastructure/kafka-*.yaml
kubectl apply -f k8s/infrastructure/zookeeper-*.yaml
kubectl wait --for=condition=Ready pod -l app=kafka -n ez-platform --timeout=300s

kubectl apply -f k8s/infrastructure/hazelcast-*.yaml
kubectl wait --for=condition=Ready pod -l app=hazelcast -n ez-platform --timeout=120s

# Initialize MongoDB replica set (dev only)
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "rs.initiate()"
sleep 10
```

#### Step 3: Redeploy services
```bash
# Apply ConfigMaps
kubectl apply -f k8s/configmaps/

# Apply services
kubectl apply -f k8s/services/

# Apply deployments (in order of dependencies)
kubectl apply -f k8s/deployments/datasource-management.yaml
kubectl apply -f k8s/deployments/validation.yaml
kubectl apply -f k8s/deployments/fileprocessor.yaml
kubectl apply -f k8s/deployments/scheduling.yaml
kubectl apply -f k8s/deployments/output.yaml
kubectl apply -f k8s/deployments/invalidrecords.yaml
kubectl apply -f k8s/deployments/metrics-configuration.yaml
kubectl apply -f k8s/deployments/filediscovery.yaml

# Wait for all services
kubectl wait --for=condition=Ready pod -n ez-platform --timeout=300s
```

#### Step 4: Verify health
```bash
# Check all pods
kubectl get pods -n ez-platform

# Expected: All pods in Running state with Ready 1/1

# Health check each service
for port in 5001 5002 5003 5004 5007 5008 5009; do
  echo "=== Port $port ==="
  curl http://localhost:${port}/health 2>/dev/null | jq .
done
```

#### Step 5: Restore data from backup (if available)
```bash
# See section 2.5: Restore Procedure
```

#### Step 6: Verify end-to-end functionality
```bash
# Check frontend
curl http://localhost:7000 -I

# Test a simple API call
curl http://localhost:5001/api/v1/datasources | jq .

# Check logs for errors
kubectl logs -l app=validation -n ez-platform --tail=20
```

---

### 3.6 Data Corruption or Accidental Deletion

**Symptom:** Missing data; corrupted records; erroneous state in MongoDB.

**Response:**

```bash
# Step 1: STOP all writers (drain consumers)
kubectl scale deployment fileprocessor --replicas=0 -n ez-platform
kubectl scale deployment scheduling --replicas=0 -n ez-platform
sleep 30

# Step 2: Backup current corrupted data (for forensics)
CORRUPTED_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongodump --db ezplatform --out /tmp/backup-corrupted-${CORRUPTED_TIMESTAMP}

kubectl cp ez-platform/mongodb-0:/tmp/backup-corrupted-${CORRUPTED_TIMESTAMP} \
  ./backups/

# Step 3: Restore from clean backup
# Follow section 2.5: Restore Procedure

# Step 4: Restart services
kubectl scale deployment fileprocessor --replicas=3 -n ez-platform
kubectl scale deployment scheduling --replicas=1 -n ez-platform
kubectl rollout status deployment/fileprocessor -n ez-platform
```

---

## 4. DR Test Plan (Quarterly)

Run these tests **monthly in non-production** and **quarterly in production** (during maintenance window).

### 4.1 Test 1: MongoDB Replica Set Failover

**Objective:** Verify automatic primary failover completes within RTO (30 seconds).

**Procedure:**
```bash
# 1. Identify current primary
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "rs.status()" | grep -A5 PRIMARY

# 2. Kill primary pod
PRIMARY_POD="mongodb-0"  # Update if different
kubectl delete pod ${PRIMARY_POD} -n ez-platform

# 3. Start timer and monitor election
date "+START: %Y-%m-%d %H:%M:%S"
kubectl exec -it mongodb-1 -n ez-platform -- \
  mongosh --eval "
    let attempts = 0;
    const start = Date.now();
    while(attempts < 30) {
      const status = rs.status();
      const primary = status.members.find(m => m.stateStr === 'PRIMARY');
      const elapsed = (Date.now() - start) / 1000;
      if(primary) {
        print('PASS: New primary elected in ' + elapsed + 's: ' + primary.name);
        break;
      }
      sleep(1000);
      attempts++;
    }
  "
date "+END: %Y-%m-%d %H:%M:%S"

# 4. Verify new primary is different
kubectl exec -it mongodb-1 -n ez-platform -- \
  mongosh --eval "rs.status()" | grep -A5 PRIMARY

# 5. Restart original pod
kubectl wait --for=condition=Ready pod -l app=mongodb -n ez-platform --timeout=120s

# 6. Verify all replicas are healthy
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "rs.status().members.forEach(m => print(m.name + ': ' + m.stateStr))"
```

**Success Criteria:**
- [ ] Primary failover completes in < 30 seconds
- [ ] New primary is different pod than killed
- [ ] Original pod restarts and joins as secondary
- [ ] All 3 replicas healthy and synced

---

### 4.2 Test 2: Full MongoDB Backup & Restore

**Objective:** Verify data integrity after full backup/restore cycle.

**Procedure:**
```bash
# 1. Record document counts before backup
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "
    const db = db.getSiblingDB('ezplatform');
    const collections = db.getCollectionNames();
    collections.forEach(c => {
      print(c + ': ' + db[c].countDocuments());
    });
  " > /tmp/counts-before.txt

# 2. Create backup
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongodump --db ezplatform --out /tmp/backup-test-${BACKUP_TIMESTAMP} --readPreference secondary

kubectl cp ez-platform/mongodb-0:/tmp/backup-test-${BACKUP_TIMESTAMP} \
  ./backups/

# 3. Restore to temporary database
kubectl cp ./backups/backup-test-${BACKUP_TIMESTAMP} \
  ez-platform/mongodb-0:/tmp/restore-test

kubectl exec -it mongodb-0 -n ez-platform -- \
  mongorestore --db ezplatform-test /tmp/restore-test/ezplatform

# 4. Verify collections and counts in restored database
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "
    const db = db.getSiblingDB('ezplatform-test');
    const collections = db.getCollectionNames();
    collections.forEach(c => {
      print(c + ': ' + db[c].countDocuments());
    });
  " > /tmp/counts-restored.txt

# 5. Compare counts
diff /tmp/counts-before.txt /tmp/counts-restored.txt

# 6. Spot-check data integrity (sample records)
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "
    const before = db.getSiblingDB('ezplatform');
    const restored = db.getSiblingDB('ezplatform-test');

    const collections = before.getCollectionNames();
    collections.forEach(c => {
      const origCount = before[c].countDocuments();
      const restCount = restored[c].countDocuments();
      if(origCount === restCount) {
        print(c + ': PASS (' + origCount + ' docs)');
      } else {
        print(c + ': FAIL (orig: ' + origCount + ', restored: ' + restCount + ')');
      }
    });
  "

# 7. Cleanup test database
kubectl exec -it mongodb-0 -n ez-platform -- \
  mongosh --eval "db.getSiblingDB('ezplatform-test').dropDatabase()"
```

**Success Criteria:**
- [ ] Backup completes without errors
- [ ] Restore completes without errors
- [ ] Document counts match exactly
- [ ] No validation errors in logs
- [ ] Spot-check queries return expected data

---

### 4.3 Test 3: Zero-Downtime Service Rollout

**Objective:** Verify all services restart with zero errors and maintain availability.

**Procedure:**
```bash
# 1. Establish baseline (monitor API and frontend)
# Terminal 1: Monitor API
watch -n 1 'curl -s http://localhost:5001/health | jq .status'

# Terminal 2: Monitor errors
kubectl logs -f deployment/fileprocessor -n ez-platform | grep -i error

# Terminal 3: Run continuous API calls (from outside cluster)
while true; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/v1/datasources)
  if [ "$RESPONSE" != "200" ]; then
    echo "ERROR: HTTP $RESPONSE at $(date)"
  fi
  sleep 1
done

# 2. Restart all services (rolling update - 1 pod at a time)
for deployment in \
  datasource-management \
  validation \
  fileprocessor \
  scheduling \
  output \
  invalidrecords \
  metrics-configuration \
  filediscovery; do

  echo "Restarting ${deployment}..."
  kubectl rollout restart deployment/${deployment} -n ez-platform
  kubectl rollout status deployment/${deployment} -n ez-platform --timeout=5m
done

# 3. Monitor logs during restart (check for errors)
# Should see: pod terminating, new pod starting, readiness/liveness probes passing

# 4. Post-restart validation
for port in 5001 5002 5003 5004 5007 5008 5009; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/health)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "Port $port: OK"
  else
    echo "Port $port: FAIL ($HTTP_CODE)"
  fi
done

# 5. Check frontend
curl -s http://localhost:7000 -I | head -1
```

**Success Criteria:**
- [ ] No HTTP errors during rollout (continuous API calls return 200)
- [ ] All pods restart successfully
- [ ] No CrashLoopBackOff or ImagePullBackOff states
- [ ] All services respond to health checks
- [ ] No increase in error logs
- [ ] Rollout completes in < 15 minutes for all services

---

### 4.4 Test 4: Kafka Broker Failure & Recovery

**Objective:** Verify consumers survive broker failure and rebalance correctly.

**Procedure:**
```bash
# 1. Check current consumer groups
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-consumer-groups.sh --list --bootstrap-server localhost:9092

# 2. Check consumer offsets (before failure)
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-consumer-groups.sh \
    --group fileprocessor-consumer \
    --bootstrap-server localhost:9092 \
    --describe

# 3. Produce test messages
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-console-producer.sh --bootstrap-server localhost:9092 \
    --topic dataprocessing.validation.completed << EOF
{"correlationId":"test-123","timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","data":"test message"}
EOF

# 4. Kill a broker
kubectl delete pod kafka-1 -n ez-platform

# 5. Monitor consumer during broker failure (should continue consuming)
kubectl logs -f deployment/fileprocessor -n ez-platform | grep -E "partition|rebalance|offset"

# 6. Produce more messages (while broker is down)
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-console-producer.sh --bootstrap-server localhost:9092 \
    --topic dataprocessing.validation.completed << EOF
{"correlationId":"test-456","timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","data":"message during recovery"}
EOF

# 7. Restart broker
kubectl wait --for=condition=Ready pod kafka-1 -n ez-platform --timeout=120s

# 8. Verify broker rejoined cluster
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# 9. Monitor consumer offsets after recovery
kubectl exec -it kafka-0 -n ez-platform -- \
  kafka-consumer-groups.sh \
    --group fileprocessor-consumer \
    --bootstrap-server localhost:9092 \
    --describe

# 10. Verify messages were consumed (offsets advanced)
```

**Success Criteria:**
- [ ] Broker failure does not cause consumer to crash
- [ ] Messages are still consumed during recovery
- [ ] No increase in lag after broker recovery
- [ ] All replicas rejoin cluster
- [ ] No data loss or message duplication

---

### 4.5 Test Checklist & Report

After each test, complete:

```markdown
## DR Test Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** Production / Staging

### Test 1: MongoDB Failover
- [ ] Primary failure detected
- [ ] Election completed in < 30s
- [ ] New primary selected
- [ ] All replicas synced
- [ ] Services reconnected

**Result:** PASS / FAIL
**Notes:**

### Test 2: Backup & Restore
- [ ] Backup created successfully
- [ ] Restore completed
- [ ] Document counts match
- [ ] Data integrity verified
- [ ] No errors in logs

**Result:** PASS / FAIL
**Notes:**

### Test 3: Zero-Downtime Rollout
- [ ] All pods restarted
- [ ] No API errors during rollout
- [ ] All services healthy post-restart
- [ ] Rollout completed in < 15m

**Result:** PASS / FAIL
**Notes:**

### Test 4: Kafka Broker Failure
- [ ] Broker failure handled
- [ ] Consumers continued
- [ ] Rebalance successful
- [ ] No message loss

**Result:** PASS / FAIL
**Notes:**

### Overall Assessment
**Status:** PASS / FAIL
**Issues Found:** [List any issues]
**Action Items:** [Follow-up actions]
**Next Test Date:** [One quarter from today]
```

---

## 5. Emergency Contacts & Escalation

### Contact Matrix

| Role | Primary | Backup | Response Time |
|------|---------|--------|----------------|
| **Platform Owner** | [Name] | [Name] | Immediate |
| **Database Admin** | [Name] | [Name] | 15 minutes |
| **Infrastructure Lead** | [Name] | [Name] | 15 minutes |
| **On-Call Engineer** | [Rotation] | [Backup] | 5 minutes |

### Escalation Procedure

1. **Alert triggered** → Contact On-Call Engineer (5 min)
2. **Unresolved after 10 min** → Contact Infrastructure Lead (15 min)
3. **Unresolved after 25 min** → Contact Platform Owner (immediate)
4. **Critical data loss** → Executive escalation + legal notification (immediate)

---

## 6. Post-Incident Review

After any major incident (outage > 15 min), complete:

```markdown
## Post-Incident Review (PIR)

**Incident ID:** [Ticket number]
**Date:** YYYY-MM-DD
**Duration:** HH:MM
**Impact:** [Brief description]

### Timeline
- HH:MM - Alert triggered / issue discovered
- HH:MM - Root cause identified
- HH:MM - Mitigation started
- HH:MM - Service restored

### Root Cause
[Analysis of why incident occurred]

### Remediation
[What was done to fix]

### Prevention
[What will be done to prevent recurrence]

### Action Items
1. [Owner] - [Action] - Due: [Date]
2. [Owner] - [Action] - Due: [Date]

### Lessons Learned
[Key takeaways]
```

---

## 7. Quick Reference

### Critical Commands

```bash
# Check cluster health
kubectl get all -n ez-platform

# Check MongoDB replication
kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "rs.status()"

# Check Kafka brokers
kubectl exec -it kafka-0 -n ez-platform -- kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# Restart all services
kubectl rollout restart deployment -n ez-platform

# View recent errors
kubectl logs -l app=validation -n ez-platform --tail=50 | grep -i error

# Backup database
kubectl exec -it mongodb-0 -n ez-platform -- mongodump --db ezplatform --out /tmp/backup-$(date +%Y%m%d-%H%M%S)

# Restore database
kubectl exec -it mongodb-0 -n ez-platform -- mongorestore --db ezplatform --drop /tmp/restore/ezplatform
```

### Important Files

```
k8s/namespace.yaml                           # Namespace definition
k8s/infrastructure/                          # MongoDB, Kafka, Hazelcast configs
k8s/deployments/                             # All service deployments
k8s/configmaps/services-config.yaml         # Service configuration
scripts/start-port-forwards.ps1             # Port forwarding script (Windows)
```

---

## 8. Appendix: Infrastructure Details

### MongoDB

```
Deployment: StatefulSet (mongodb-0, mongodb-1, mongodb-2)
Database: ezplatform
Port: 27017 (internal), 31190 (NodePort, dev)
Connection: mongodb://mongodb-0.mongodb-headless:27017
Replica Set: rs0
```

### Kafka

```
Deployment: StatefulSet (kafka-0, kafka-1, kafka-2)
Topics: 4 (see CLAUDE.md)
Brokers: kafka:9092 (internal), localhost:9094 (port-forward)
Port: 9092 (internal), 9094 (external), 30094 (NodePort)
```

### Hazelcast

```
Deployment: StatefulSet or Deployment (hazelcast-0, hazelcast-1, ...)
Port: 5701 (internal), 30701 (NodePort)
Maps: file-content, valid-records
TTL: 5 minutes
Eviction: LRU, max 256MB per map
```

---

## 9. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-18 | Initial runbook creation |

---

**Document Owner:** Platform Operations Team
**Last Reviewed:** 2026-03-18
**Next Review Due:** 2026-06-18

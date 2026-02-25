# Hazelcast Cache Infrastructure

**Version:** 1.0
**Date:** December 17, 2025
**Session:** 19
**Status:** Production Ready

---

## Overview

Hazelcast serves as the distributed cache layer for the EZ Platform, enabling high-performance data sharing between services in the processing pipeline.

### Purpose

1. **Temporary Data Buffer**: Store file content and validated records temporarily during processing
2. **Service Decoupling**: Allow asynchronous communication between FileProcessor, ValidationService, and OutputService
3. **High Performance**: In-memory access for fast data retrieval

---

## Architecture

### Data Flow

```
FileProcessor → [file-content map] → ValidationService → [valid-records map] → OutputService
     ↓                                       ↓                                      ↓
  Write data                           Read & clean                          Read & clean
                                     Write validated                              ↓
                                                                           Delete after output
```

### Maps Configuration

| Map Name | Purpose | TTL | Idle Timeout | Max Size | Eviction |
|----------|---------|-----|--------------|----------|----------|
| `file-content` | Raw file data from FileProcessor | 5 min | 3 min | 256MB | LRU |
| `valid-records` | Validated records for OutputService | 5 min | 3 min | 256MB | LRU |

---

## Kubernetes Configuration

### File Location

```
k8s/infrastructure/hazelcast-statefulset.yaml
```

### Components

1. **ConfigMap** (`hazelcast-config`): Contains `hazelcast.yaml` with TTL and eviction settings
2. **Service** (`hazelcast`): ClusterIP service for internal access on port 5701
3. **StatefulSet** (`hazelcast`): Single-node deployment for dev/staging

### Resource Allocation (Dev/Staging)

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "512Mi"
  limits:
    cpu: "500m"
    memory: "768Mi"
```

### JVM Settings

```
-Xms256m -Xmx512m
```

---

## TTL Configuration

### Why TTL?

**Problem**: If services crash or fail to clean up data, the cache can grow unbounded.

**Solution**: TTL (Time-To-Live) provides automatic cleanup as a fallback safety mechanism.

### Settings

```yaml
hazelcast:
  map:
    file-content:
      time-to-live-seconds: 300       # 5 minutes - auto-expire
      max-idle-seconds: 180           # 3 minutes - expire if not accessed
      eviction:
        eviction-policy: LRU          # Least Recently Used
        max-size-policy: USED_HEAP_SIZE
        size: 256                     # 256MB max heap for this map
      backup-count: 0                 # No backups (single node dev)

    valid-records:
      time-to-live-seconds: 300
      max-idle-seconds: 180
      eviction:
        eviction-policy: LRU
        max-size-policy: USED_HEAP_SIZE
        size: 256
      backup-count: 0
```

### Cleanup Strategy

| Priority | Method | When |
|----------|--------|------|
| 1 (Primary) | Explicit Delete | Services delete data after processing |
| 2 (Fallback) | TTL Expiration | Auto-expire after 5 minutes if not cleaned |
| 3 (Emergency) | Idle Timeout | Auto-expire after 3 minutes of no access |
| 4 (Last Resort) | LRU Eviction | Remove oldest entries when heap limit reached |

---

## Service Integration

### FileProcessorService

**Action**: Write file content to `file-content` map
**Key**: `{correlationId}:{fileName}`
**Cleanup**: None (ValidationService handles)

```csharp
await _hazelcast.GetMap<string, string>("file-content")
    .PutAsync(key, content);
```

### ValidationService

**Action**:
1. Read from `file-content` map
2. Delete from `file-content` map after reading
3. Write valid records to `valid-records` map

```csharp
// Read and clean file-content
var content = await fileContentMap.GetAsync(key);
await fileContentMap.RemoveAsync(key);

// Write valid records
await validRecordsMap.PutAsync(key, validRecords);
```

### OutputService

**Action**:
1. Read from `valid-records` map
2. Delete from `valid-records` map after writing output

```csharp
// Read and clean valid-records
var records = await validRecordsMap.GetAsync(key);
await validRecordsMap.RemoveAsync(key);
```

---

## Monitoring

### Memory Usage

```bash
# Check Hazelcast pod memory
kubectl top pod hazelcast-0 -n ez-platform
```

**Healthy Range**: 200-400Mi for typical workloads

### Logs

```bash
# View Hazelcast logs
kubectl logs hazelcast-0 -n ez-platform | tail -50

# Check for eviction warnings
kubectl logs hazelcast-0 -n ez-platform | grep -E "(evict|TTL|expire)"
```

### REST API Health

```bash
# Port-forward to Hazelcast
kubectl port-forward svc/hazelcast 5701:5701 -n ez-platform

# Check cluster health
curl http://localhost:5701/hazelcast/health
```

---

## Troubleshooting

### Issue: Cache Growing Unbounded

**Symptoms**: Memory usage continuously increasing

**Diagnosis**:
```bash
kubectl top pod hazelcast-0 -n ez-platform
kubectl logs hazelcast-0 -n ez-platform | grep -E "(memory|heap)"
```

**Resolution**:
1. TTL should auto-clean after 5 minutes
2. Check if services are properly deleting data
3. Verify eviction policy is working

### Issue: Data Not Found

**Symptoms**: ValidationService or OutputService can't find expected data

**Diagnosis**:
```bash
# Check service logs for cache operations
kubectl logs -l app=validation -n ez-platform | grep -E "(Hazelcast|cache|map)"
kubectl logs -l app=output -n ez-platform | grep -E "(Hazelcast|cache|map)"
```

**Resolution**:
1. Verify map names match across services (`file-content`, `valid-records`)
2. Check TTL hasn't expired data prematurely
3. Verify correlation ID consistency

### Issue: Hazelcast Pod Not Ready

**Symptoms**: Pod shows 0/1 Ready

**Diagnosis**:
```bash
kubectl describe pod hazelcast-0 -n ez-platform
kubectl logs hazelcast-0 -n ez-platform
```

**Resolution**:
1. Verify REST API is enabled (`HZ_NETWORK_RESTAPI_ENABLED=true`)
2. Check memory allocation is sufficient
3. Verify ConfigMap is mounted correctly

---

## Production Considerations

### Scaling for Production

For production environments with high throughput:

```yaml
# Increase replicas for HA
replicas: 3

# Increase resources
resources:
  requests:
    cpu: "500m"
    memory: "2Gi"
  limits:
    cpu: "2000m"
    memory: "4Gi"

# Enable backups
backup-count: 1
```

### TTL Adjustments

Adjust TTL based on processing volume:

| Scenario | TTL | Idle | Rationale |
|----------|-----|------|-----------|
| Low volume (<100 files/day) | 10 min | 5 min | Longer buffer for slow processing |
| Medium volume (100-1000 files/day) | 5 min | 3 min | Current default |
| High volume (1000+ files/day) | 2 min | 1 min | Faster cleanup for memory efficiency |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 17, 2025 | Initial TTL configuration, Session 19 |

---

**Document Status:** Production Ready
**Last Updated:** December 17, 2025
**Related Files:**
- `k8s/infrastructure/hazelcast-statefulset.yaml`
- `src/Services/FileProcessorService/Services/HazelcastService.cs`
- `src/Services/ValidationService/Services/HazelcastCacheService.cs`
- `src/Services/OutputService/Services/HazelcastCacheService.cs`

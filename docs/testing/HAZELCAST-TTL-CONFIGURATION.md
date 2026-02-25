---
last-verified: 2026-02-02
status: current
---
# Hazelcast TTL Configuration

**Date:** December 29, 2025 (Session 35)
**Status:** CONFIGURED

---

## Overview

Hazelcast distributed cache uses TTL (Time-To-Live) to automatically expire entries. This prevents unbounded memory growth and allows for controlled reprocessing of files.

---

## TTL Configuration

### Current Settings (Testing)

| Setting | Config Key | Value | Duration |
|---------|-----------|-------|----------|
| Deduplication TTL | `FileDiscovery__DeduplicationTTLHours` | 0.25 | 15 minutes |
| Cache TTL | `Hazelcast__CacheTTLHours` | 1 | 1 hour |

### Recommended Production Settings

| Setting | Value | Reasoning |
|---------|-------|-----------|
| Deduplication TTL | 4-24 hours | Match polling frequency × 10 |
| Cache TTL | 1-2 hours | Content consumed quickly during processing |

---

## Configuration Files

### ConfigMap (k8s/configmaps/services-config.yaml)

```yaml
# Hazelcast TTL Configuration
FileDiscovery__DeduplicationTTLHours: "0.25"  # 15 minutes for testing
Hazelcast__CacheTTLHours: "1"                  # 1 hour for cache
```

### Deployment Environment Variables

**FileDiscovery:**
```yaml
- name: FileDiscovery__DeduplicationTTLHours
  valueFrom:
    configMapKeyRef:
      name: services-config
      key: FileDiscovery__DeduplicationTTLHours
```

**FileProcessor & Validation:**
```yaml
- name: Hazelcast__CacheTTLHours
  valueFrom:
    configMapKeyRef:
      name: services-config
      key: Hazelcast__CacheTTLHours
```

---

## Hazelcast Maps

| Map Name | Purpose | TTL Applied |
|----------|---------|-------------|
| `file-hashes-{datasourceId}` | File deduplication | Deduplication TTL |
| `file-content` | JSON content cache | Cache TTL |
| `valid-records` | Valid records cache | Cache TTL |
| `metric-definitions-cache` | Metrics config | 10 minutes |

---

## Code References

### Deduplication TTL Usage

**FileDiscoveryWorker.cs** (lines 141-142):
```csharp
var ttlHours = _configuration.GetValue("FileDiscovery:DeduplicationTTLHours", 24);
var ttl = TimeSpan.FromHours(ttlHours);
```

### Cache TTL Usage

**FileDiscoveredEventConsumer.cs** (lines 350-353):
```csharp
var ttlHours = _configuration.GetValue("Hazelcast:CacheTTLHours", 1);
await fileContentMap.SetAsync(cacheKey, jsonContent, TimeSpan.FromHours(ttlHours));
```

**ValidationRequestEventConsumer.cs** (lines 397-405):
```csharp
var ttlHours = _configuration.GetValue("Hazelcast:CacheTTLHours", 1);
await validRecordsMap.SetAsync(validRecordsKey, validRecordsJson, TimeSpan.FromHours(ttlHours));
```

---

## Testing TTL

### Verify Configuration

```powershell
# Check environment variables in pods
kubectl exec deployment/filediscovery -n ez-platform -- printenv FileDiscovery__DeduplicationTTLHours
kubectl exec deployment/fileprocessor -n ez-platform -- printenv Hazelcast__CacheTTLHours
kubectl exec deployment/validation -n ez-platform -- printenv Hazelcast__CacheTTLHours
```

### Verify Expiration

1. Process test files
2. Wait for TTL duration (15 minutes for testing)
3. Verify files can be reprocessed (not deduplicated)

### Manual Cache Reset

```powershell
cd tools/HazelcastReset
dotnet run -- --clear-all  # Clear all maps
dotnet run -- --list       # View map entries
```

---

## Changing TTL for Production

1. Update `k8s/configmaps/services-config.yaml`:
   ```yaml
   FileDiscovery__DeduplicationTTLHours: "4"  # 4 hours for production
   ```

2. Apply configmap:
   ```bash
   kubectl apply -f k8s/configmaps/services-config.yaml
   ```

3. Restart services:
   ```bash
   kubectl rollout restart deployment filediscovery fileprocessor validation -n ez-platform
   ```

---

## Related Documentation

- [HORIZONTAL-SCALING-TEST-REPORT.md](HORIZONTAL-SCALING-TEST-REPORT.md) - Distributed cache sharing
- [STRESS-TEST-1000-FILES-REPORT.md](STRESS-TEST-1000-FILES-REPORT.md) - Cache performance
- [k8s/configmaps/services-config.yaml](../../k8s/configmaps/services-config.yaml) - Configuration

---

*Report generated: December 29, 2025*

# EZ Platform Performance Baseline

**Date:** December 17, 2025
**Collection Period:** Week 5 Production Validation
**Environment:** Minikube (Development/Testing)

---

## 1. Memory Usage Baseline

| Service | Memory Usage | Status |
|---------|--------------|--------|
| DataProcessing.FileDiscovery | **255 MB** | Normal |
| DataProcessing.Validation | **274 MB** | Normal |
| DataProcessing.FileProcessor | **329 MB** | Normal |
| OutputService | ~250 MB (estimated) | Normal |

**Observations:**
- All services are within acceptable memory bounds
- FileProcessor has highest memory due to batch processing workloads
- No memory leak indicators observed (heap sizes stable)

---

## 2. Garbage Collection Metrics

| Service | Gen0 | Gen1 | Gen2 | Assessment |
|---------|------|------|------|------------|
| FileDiscovery | 887 | 128 | 36 | High Gen0 activity (expected for file scanning) |
| Validation | 13 | 1 | 3 | Healthy GC pattern |
| FileProcessor | 287 | 71 | 21 | Moderate activity (batch processing) |
| OutputService | 0 | 0 | 1 | Low activity (idle state) |

**Gen0/Gen1 Ratio Analysis:**
- FileDiscovery: 6.9:1 (within acceptable range)
- FileProcessor: 4.0:1 (healthy ratio)
- Validation: 13:1 (excellent short-lived object handling)

---

## 3. CPU Usage Baseline

Based on `process_cpu_time_seconds_total`:

| Service | User CPU (s) | System CPU (s) | Total |
|---------|--------------|----------------|-------|
| Validation | 27.4 | 12.0 | 39.4s |
| FileDiscovery | ~20s | ~10s | ~30s |
| FileProcessor | ~25s | ~8s | ~33s |

**CPU Efficiency:**
- Services show reasonable CPU utilization
- No CPU spinning or excessive consumption observed

---

## 4. Thread Pool Metrics

Expected baseline:
- Thread count: 20-40 threads per service
- Work items processed: Proportional to workload
- Queue length: Should be near 0 under normal load

---

## 5. HTTP Server Metrics

**Active Connections:** Low (development environment)

**Request Duration Buckets:** To be measured under load

**Key Metrics to Monitor:**
- `http_server_request_duration_seconds_bucket`
- `http_server_active_requests`
- `kestrel_active_connections`

---

## 6. Trace Statistics

| Metric | Value |
|--------|-------|
| Total Spans (Elasticsearch) | 919 |
| Services Reporting Traces | 5 |
| Trace Storage | 676.5 KB |
| Index | dataprocessing-traces |

---

## 7. Infrastructure Resources

### Kubernetes Cluster Resources

| Pod | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----|-------------|-----------|----------------|--------------|
| otel-collector | 250m | 1 | 512Mi | 1Gi |
| prometheus-system | 500m | 2 | 2Gi | 4Gi |
| prometheus-business | 500m | 2 | 2Gi | 4Gi |
| elasticsearch | 500m | 2 | 2Gi | 4Gi |
| jaeger | 250m | 1 | 512Mi | 1Gi |

---

## 8. Recommended Thresholds

Based on baseline measurements, set alerts for:

### Critical Alerts
| Metric | Threshold | Action |
|--------|-----------|--------|
| Memory Usage | > 500 MB | Investigate memory leak |
| Gen2 GC Rate | > 10/min | Check for memory pressure |
| HTTP 5xx Rate | > 1% | Immediate investigation |
| Response Time p99 | > 2s | Performance investigation |

### Warning Alerts
| Metric | Threshold | Action |
|--------|-----------|--------|
| Memory Usage | > 350 MB | Monitor trend |
| Gen1 GC Rate | > 20/min | Review allocation patterns |
| HTTP 4xx Rate | > 5% | Check client errors |
| Response Time p95 | > 500ms | Performance review |

---

## 9. Performance Testing Plan

### Load Test Scenarios

1. **Baseline Load Test**
   - 10 concurrent files
   - 1000 records per file
   - Duration: 10 minutes
   - Expected throughput: ~1000 records/min

2. **Stress Test**
   - 50 concurrent files
   - 10,000 records per file
   - Duration: 30 minutes
   - Find breaking points

3. **Endurance Test**
   - Steady 20 files/hour
   - 5,000 records per file
   - Duration: 24 hours
   - Memory stability validation

### Key Metrics to Capture During Load

1. **Throughput**
   - Records processed per minute
   - Files completed per minute
   - Kafka messages per second

2. **Latency**
   - End-to-end pipeline latency
   - Per-service processing time
   - Kafka consumer lag

3. **Resource Utilization**
   - CPU utilization per service
   - Memory growth rate
   - GC pause time

---

## 10. PromQL Queries for Monitoring

```promql
# Average memory usage by service
avg by (service_name) (process_memory_usage_bytes)

# GC collection rate (Gen0)
rate(dotnet_gc_collections_total{gc_heap_generation="gen0"}[5m])

# HTTP request rate
sum(rate(http_server_request_duration_seconds_count[5m])) by (service_name)

# HTTP latency p99
histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le, service_name))

# Thread pool queue length
sum by (service_name) (dotnet_thread_pool_queue_length_total)

# Active HTTP connections
sum by (service_name) (kestrel_active_connections)
```

---

## 11. Next Steps

1. **Configure Grafana Dashboards**
   - Import standard .NET metrics dashboard
   - Create custom pipeline monitoring dashboard
   - Set up alerting rules

2. **Run Load Tests**
   - Execute baseline load test
   - Document actual throughput numbers
   - Identify bottlenecks

3. **Establish SLOs**
   - Define Service Level Objectives
   - Create SLI (Service Level Indicator) dashboards
   - Set up error budget tracking

---

**Baseline Captured:** December 17, 2025
**Environment:** Minikube Development Cluster
**Status:** Initial baseline established, load testing pending

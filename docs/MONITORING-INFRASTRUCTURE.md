# EZ Data Processing Platform - Monitoring Infrastructure

## Overview

The EZ Data Processing Platform implements a comprehensive monitoring infrastructure based on the **OpenTelemetry Collector pattern** with **dual Prometheus backends**, **Grafana as the unified query layer**, and **Elasticsearch for logs**.

**Created:** September 30, 2025  
**Status:** Phase 1 Complete - Infrastructure Setup

---

## Architecture Pattern

### Critical Rule: All Telemetry Through OpenTelemetry Collector

```
┌──────────────┐     ┌─────────────────┐     ┌────────────────────┐
│   Services   │────▶│ OTel Collector  │────▶│ System Prometheus  │
│              │     │   (Port 4317)   │     │    (Port 9090)     │
└──────────────┘     └─────────────────┘     └────────────────────┘
                              │
                              ├──────────────▶┌────────────────────┐
                              │                │Business Prometheus │
                              │                │    (Port 9091)     │
                              │                └────────────────────┘
                              │
                              ├──────────────▶┌────────────────────┐
                              │                │   Elasticsearch    │
                              │                │    (Port 9200)     │
                              │                └────────────────────┘
                              │
                              └──────────────▶┌────────────────────┐
                                               │      Jaeger        │
                                               │   (Port 16686)     │
                                               └────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │     Grafana     │◀─── Frontend & AI
                              │  (Port 3001)    │
                              └─────────────────┘
```

### Key Principles

✅ **DO:**
- Use OpenTelemetry SDK in all services
- Send all telemetry to OTel Collector (localhost:4317)
- Prefix business metrics with `business_`
- Query data via Grafana HTTP API
- Use the BusinessMetrics helper class

❌ **DON'T:**
- Write directly to Prometheus
- Query Prometheus directly from services
- Query Elasticsearch directly
- Mix system and business metrics

---

## Components

### 1. OpenTelemetry Collector (Port 4317, 4318, 8888, 13133)

**Purpose:** Central telemetry hub that receives, processes, and routes all metrics, traces, and logs

**Configuration:** `deploy/otel-collector/config.yaml`

**Key Features:**
- Receives OTLP over gRPC (4317) and HTTP (4318)
- Routes metrics based on naming convention:
  - System metrics (`http_*`, `process_*`, `dotnet_*`) → System Prometheus
  - Business metrics (`business_*`) → Business Prometheus
- Exports logs to Elasticsearch
- Exports traces to Jaeger
- Built-in health checks and metrics

**Health Check:**
```bash
curl http://localhost:13133
```

### 2. System Prometheus (Port 9090)

**Purpose:** Stores infrastructure and system-level metrics

**Configuration:** `deploy/prometheus/prometheus-system.yml`

**Metrics Collected:**
- HTTP request/response metrics
- Process CPU and memory usage
- .NET runtime metrics
- ASP.NET Core metrics
- Service health checks

**Access:** http://localhost:9090

### 3. Business Prometheus (Port 9091)

**Purpose:** Stores business KPIs and domain-specific metrics

**Configuration:** `deploy/prometheus/prometheus-business.yml`

**Metrics Collected:**
- `business_records_processed_total`
- `business_validation_error_rate`
- `business_files_processed_total`
- `business_processing_duration_seconds`
- `business_jobs_completed_total`
- Custom user-configured metrics

**Access:** http://localhost:9091

### 4. Elasticsearch (Port 9200)

**Purpose:** Stores application logs and distributed traces

**Indices:**
- `dataprocessing-logs-*` - Application logs
- `dataprocessing-traces-*` - Distributed traces

**Access:** http://localhost:9200

### 5. Jaeger (Port 16686)

**Purpose:** Distributed tracing UI for visualizing request flows

**Access:** http://localhost:16686

### 6. Grafana (Port 3001)

**Purpose:** Unified query layer and visualization platform

**Configuration:** `deploy/grafana/provisioning/datasources/datasources.yaml`

**Datasources:**
- System-Prometheus (system metrics)
- Business-Prometheus (business KPIs) - **Default**
- Elasticsearch-Logs (application logs)

**Access:** http://localhost:3001  
**Login:** admin / admin

---

## Quick Start

### 1. Start Monitoring Stack

```powershell
# Start all monitoring components
.\scripts\start-monitoring-stack.ps1
```

### 2. Verify Services

Check that all services are healthy:

```bash
docker-compose -f docker-compose.development.yml ps
```

Expected output:
- ✅ otel-collector (healthy)
- ✅ prometheus-system (healthy)
- ✅ prometheus-business (healthy)
- ✅ elasticsearch (healthy)
- ✅ jaeger (running)
- ✅ grafana (healthy)

### 3. Configure Your Service

Add OpenTelemetry configuration to your service's `appsettings.json`:

```json
{
  "ServiceName": "your-service-name",
  "OpenTelemetry": {
    "OtlpEndpoint": "http://localhost:4317",
    "EnableMetrics": true,
    "EnableTraces": true,
    "EnableLogs": true,
    "SamplingRatio": 1.0
  }
}
```

Update your service's `Program.cs`:

```csharp
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Monitoring;

var builder = WebApplication.CreateBuilder(args);

// Add OpenTelemetry
builder.Services.AddDataProcessingOpenTelemetry(
    builder.Configuration,
    "your-service-name"
);

// Add Business Metrics helper
builder.Services.AddBusinessMetrics();

var app = builder.Build();
// ... rest of configuration
```

---

## Using Business Metrics

### 1. Inject BusinessMetrics

```csharp
public class YourService
{
    private readonly BusinessMetrics _businessMetrics;
    
    public YourService(BusinessMetrics businessMetrics)
    {
        _businessMetrics = businessMetrics;
    }
}
```

### 2. Record Metrics

```csharp
// Record processed records
_businessMetrics.RecordProcessedRecords(
    count: 1000,
    dataSource: "sales-data",
    status: "success"
);

// Record validation errors
_businessMetrics.RecordInvalidRecords(
    count: 5,
    dataSource: "sales-data",
    errorType: "invalid_email"
);

// Record processing duration
var startTime = DateTime.UtcNow;
// ... do work ...
var duration = (DateTime.UtcNow - startTime).TotalSeconds;
_businessMetrics.RecordProcessingDuration(
    durationSeconds: duration,
    dataSource: "sales-data",
    operationType: "validation"
);

// Record file processing
_businessMetrics.RecordFileProcessed(
    dataSource: "sales-data",
    fileType: "csv",
    success: true
);
```

### 3. Create Custom Metrics

```csharp
// Create a custom counter
var salesCounter = _businessMetrics.CreateBusinessCounter<long>(
    name: "daily_sales_amount",
    unit: "ILS",
    description: "Daily sales amount in ILS"
);

salesCounter.Add(1250, new TagList 
{
    { "product_category", "electronics" },
    { "region", "north" }
});

// Create a custom gauge
var inventoryGauge = _businessMetrics.CreateBusinessGauge<int>(
    name: "current_inventory_level",
    observeValue: () => GetCurrentInventoryLevel(),
    unit: "items",
    description: "Current inventory level"
);
```

---

## Querying Data via Grafana API

### From Frontend (TypeScript/React)

```typescript
// Example: Query business metric
const response = await fetch(
  'http://localhost:3001/api/datasources/proxy/uid/business-prometheus-uid/api/v1/query_range',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'sum(business_records_processed_total{data_source="sales-data"})',
      start: new Date(Date.now() - 24*60*60*1000).toISOString(),
      end: new Date().toISOString(),
      step: '1h'
    })
  }
);

const data = await response.json();
```

### From Backend (C#)

```csharp
public class GrafanaQueryService
{
    private readonly HttpClient _httpClient;
    private readonly string _grafanaUrl = "http://localhost:3001";
    private readonly string _apiKey;
    
    public async Task<GrafanaQueryResult> QueryBusinessMetric(
        string promQL,
        DateTime from,
        DateTime to)
    {
        var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_grafanaUrl}/api/datasources/proxy/uid/business-prometheus-uid/api/v1/query_range");
        
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        request.Content = JsonContent.Create(new
        {
            query = promQL,
            start = new DateTimeOffset(from).ToUnixTimeSeconds(),
            end = new DateTimeOffset(to).ToUnixTimeSeconds(),
            step = "1h"
        });
        
        var response = await _httpClient.SendAsync(request);
        return await response.Content.ReadFromJsonAsync<GrafanaQueryResult>();
    }
}
```

---

## Common PromQL Queries

### Business Metrics

```promql
# Total records processed by data source
sum(business_records_processed_total) by (data_source)

# Average validation error rate
avg(business_validation_error_rate) by (data_source)

# Processing duration 95th percentile
histogram_quantile(0.95, 
  sum(rate(business_processing_duration_seconds_bucket[5m])) by (le, data_source)
)

# Files processed per hour
rate(business_files_processed_total[1h])

# Active jobs by type
business_active_jobs by (job_type)
```

### System Metrics

```promql
# HTTP request rate
rate(http_server_request_duration_seconds_count[5m])

# Memory usage
process_working_set_bytes / 1024 / 1024

# CPU usage
rate(process_cpu_seconds_total[1m]) * 100

# Error rate
rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])
```

---

## Troubleshooting

### Services Not Sending Logs to Elasticsearch

1. **Check for `builder.Host.UseSerilog()` in Program.cs:**
   ```csharp
   // ❌ WRONG - This replaces the entire logging infrastructure and bypasses OTEL
   builder.Host.UseSerilog();

   // ✅ CORRECT - Use AddDataProcessingLogging which adds Serilog as a provider
   builder.Services.AddDataProcessingLogging(configuration, environment, serviceName);
   // Note: Do NOT use builder.Host.UseSerilog() as it replaces logging infrastructure and bypasses OTEL
   ```

   **Root Cause:** `UseSerilog()` replaces the entire logging infrastructure, preventing OTEL's `.WithLogging()` from hooking into ILoggerFactory.

2. **Check for static `Log.*` calls:**
   ```csharp
   // ❌ Static calls bypass ILogger/OTEL - only go to Serilog sinks
   Log.Information("Starting service...");

   // ✅ ILogger injection goes through all providers including OTEL
   _logger.LogInformation("Starting service...");
   ```

3. **Verify logs in Elasticsearch:**
   ```bash
   kubectl exec elasticsearch-pod -n ez-platform -- curl -s "localhost:9200/dataprocessing-logs/_search" \
     -H "Content-Type: application/json" \
     -d '{"query":{"match_phrase":{"service.name":"DataProcessing.YourService"}}}'
   ```

### Services Not Sending Metrics

1. **Check OTel Collector is running:**
   ```bash
   curl http://localhost:13133
   ```

2. **Verify service configuration:**
   ```json
   "OpenTelemetry": {
     "OtlpEndpoint": "http://localhost:4317"
   }
   ```

3. **Check OTel Collector logs:**
   ```bash
   docker logs ezplatform-otel-collector
   ```

### Metrics Not Appearing in Prometheus

1. **Check metric naming:**
   - Business metrics MUST start with `business_`
   - System metrics start with `http_`, `process_`, `dotnet_`, etc.

2. **Verify OTel Collector routing:**
   ```bash
   # Check OTel Collector metrics
   curl http://localhost:8888/metrics
   ```

3. **Check Prometheus targets:**
   - System: http://localhost:9090/targets
   - Business: http://localhost:9091/targets

### Grafana Not Showing Data

1. **Verify datasource configuration:**
   - Check `deploy/grafana/provisioning/datasources/datasources.yaml`

2. **Test datasource in Grafana:**
   - Settings → Data Sources → Test

3. **Check Prometheus connectivity:**
   ```bash
   docker exec ezplatform-grafana wget -O- http://prometheus-system:9090/-/healthy
   ```

---

## Performance Tuning

### OTel Collector

```yaml
processors:
  batch:
    timeout: 10s          # Adjust based on load
    send_batch_size: 1024 # Increase for high volume
  
  memory_limiter:
    limit_mib: 512        # Increase if running out of memory
```

### Prometheus

```yaml
global:
  scrape_interval: 15s    # System metrics (keep short)
  scrape_interval: 1m     # Business metrics (can be longer)
```

### Grafana Query Timeout

```ini
[dataproxy]
timeout = 60  # Seconds
```

---

## Security Considerations

### Production Deployment

1. **Enable authentication on Prometheus:**
   ```yaml
   basic_auth:
     username: <username>
     password: <password>
   ```

2. **Use TLS for OTel Collector:**
   ```yaml
   receivers:
     otlp:
       protocols:
         grpc:
           tls:
             cert_file: /path/to/cert.pem
             key_file: /path/to/key.pem
   ```

3. **Secure Grafana:**
   ```ini
   [security]
   admin_user = admin
   admin_password = <strong-password>
   secret_key = <random-secret>
   ```

4. **Enable Elasticsearch security:**
   ```yaml
   environment:
     - xpack.security.enabled=true
     - ELASTIC_PASSWORD=<strong-password>
   ```

---

## Next Steps

### Phase 2: Service Integration

1. Update all services to use OpenTelemetry configuration
2. Add BusinessMetrics to ValidationService
3. Add BusinessMetrics to FilesReceiverService
4. Add BusinessMetrics to SchedulingService

### Phase 3: Dashboards

1. Create system overview dashboard
2. Create business KPI dashboard
3. Create per-data-source dashboards
4. Set up alerting rules

### Phase 4: AI Assistant Integration

1. Implement Grafana query service
2. Add natural language to PromQL translation
3. Integrate with OpenAI for insights generation

---

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana HTTP API](https://grafana.com/docs/grafana/latest/http_api/)
- [EZ Platform Architecture](./archive/planning/FINAL-CORRECTED-ARCHITECTURE.md)

---

**Document Version:** 1.0  
**Last Updated:** September 30, 2025  
**Status:** ✅ Complete - Phase 1 Infrastructure Setup

# Final Corrected Architecture - OpenTelemetry Collector Pattern

## Executive Summary

The EZ Data Processing Platform uses **OpenTelemetry Collector** as the central telemetry hub, with **dual Prometheus backends**, **Grafana for all queries**, and **Elasticsearch for logs**.

---

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EZ Data Processing Platform                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Microservices Layer                           │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  • DataSourceManagementService                                       │  │
│  │  • ValidationService                                                 │  │
│  │  • SchedulingService                                                 │  │
│  │  • FilesReceiverService                                             │  │
│  │  • SchemaManagementService                                          │  │
│  │  • MetricsCollectorService                                          │  │
│  │  • MetricsConfigurationService                                      │  │
│  │  • ChatService                                                      │  │
│  │  • NotificationsService                                             │  │
│  └────────────────┬─────────────────────────────────────────────────────┘  │
│                   │                                                          │
│                   │ ALL push via OpenTelemetry SDK                          │
│                   │ (Metrics, Traces, Logs)                                 │
│                   ↓                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │           OpenTelemetry Collector (Central Hub)                     │   │
│  │                                                                     │   │
│  │  • Receives all telemetry from all services                        │   │
│  │  • Routes metrics to appropriate Prometheus instance               │   │
│  │  • Routes logs to Elasticsearch                                    │   │
│  │  • Routes traces to distributed tracing backend                    │   │
│  │  • Performs filtering, sampling, enrichment                        │   │
│  └──────┬──────────────────┬──────────────────────┬───────────────────┘   │
│         │                  │                      │                         │
│         │ System Metrics   │ Business Metrics     │ Logs                    │
│         ↓                  ↓                      ↓                         │
│  ┌─────────────┐    ┌─────────────┐       ┌──────────────┐                │
│  │  System     │    │  Business   │       │ Elasticsearch│                │
│  │  Prometheus │    │  Prometheus │       │              │                │
│  │  (Port 9090)│    │  (Port 9091)│       │ (Port 9200)  │                │
│  │             │    │             │       │              │                │
│  │ Infra       │    │ Business    │       │ • App logs   │                │
│  │ metrics     │    │ KPIs        │       │ • Audit logs │                │
│  └─────────────┘    └─────────────┘       │ • Error logs │                │
│         ↑                  ↑               └──────────────┘                │
│         │                  │                      ↑                         │
│         │                  │                      │                         │
│         └──────────────────┴──────────────────────┘                         │
│                            │                                                │
│                            │ Query via Grafana API only                    │
│                            ↓                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          Grafana                                    │   │
│  │                                                                     │   │
│  │  • Query Prometheus (system & business) via API                    │   │
│  │  • Query Elasticsearch for logs                                    │   │
│  │  • Unified dashboards                                              │   │
│  │  • Alerting engine                                                 │   │
│  │  • HTTP API for external access                                    │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                              │
│                             │ Grafana HTTP API                             │
│                             ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              Frontend & AI Assistant                                │   │
│  │                                                                     │   │
│  │  • React Dashboard queries Grafana API                             │   │
│  │  • AI Assistant queries Grafana API                                │   │
│  │  • NO direct Prometheus access                                     │   │
│  │  • NO direct Elasticsearch access                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## OpenTelemetry Collector Configuration

### Architecture Pattern: All Telemetry Through OTel Collector

**Rule:** ❌ NO service writes directly to Prometheus or Elasticsearch  
**Rule:** ✅ ALL services use OpenTelemetry SDK → OTel Collector → Backends

### OpenTelemetry Collector Config

**File:** `deploy/otel-collector/config.yaml`

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024
  
  # Route metrics based on naming convention
  filter/system_metrics:
    metrics:
      include:
        match_type: regexp
        metric_names:
          - '^http_.*'
          - '^process_.*'
          - '^dotnet_.*'
          - '^runtime_.*'
  
  filter/business_metrics:
    metrics:
      include:
        match_type: regexp
        metric_names:
          - '^business_.*'
  
  # Add common labels
  resource:
    attributes:
      - key: environment
        value: production
        action: insert
      - key: cluster
        value: dataprocessing
        action: insert

exporters:
  # System Prometheus
  prometheusremotewrite/system:
    endpoint: http://prometheus-system:9090/api/v1/write
    tls:
      insecure: true
  
  # Business Prometheus
  prometheusremotewrite/business:
    endpoint: http://prometheus-business:9091/api/v1/write
    tls:
      insecure: true
  
  # Elasticsearch for logs
  elasticsearch:
    endpoints:
      - http://elasticsearch:9200
    logs_index: dataprocessing-logs
    
  # Optional: Jaeger for distributed tracing
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

service:
  pipelines:
    # System metrics pipeline
    metrics/system:
      receivers: [otlp]
      processors: [filter/system_metrics, batch, resource]
      exporters: [prometheusremotewrite/system]
    
    # Business metrics pipeline
    metrics/business:
      receivers: [otlp]
      processors: [filter/business_metrics, batch, resource]
      exporters: [prometheusremotewrite/business]
    
    # Logs pipeline
    logs:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [elasticsearch]
    
    # Traces pipeline
    traces:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [jaeger]
```

---

## Microservice Implementation

### All Services Use OpenTelemetry SDK ONLY

**File:** `src/Services/Shared/Configuration/OpenTelemetryConfiguration.cs` (Already exists - enhance)

```csharp
public static class OpenTelemetryConfiguration
{
    public static void AddOpenTelemetryConfiguration(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var serviceName = configuration["ServiceName"] ?? "unknown-service";
        var otlpEndpoint = configuration["OpenTelemetry:OtlpEndpoint"] ?? "http://otel-collector:4317";
        
        services.AddOpenTelemetry()
            .WithMetrics(metrics => metrics
                // System metrics (auto-instrumented)
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                .AddProcessInstrumentation()
                
                // Custom business metrics meter
                .AddMeter("DataProcessing.Business.Metrics")
                
                // Export to OTel Collector
                .AddOtlpExporter(options =>
                {
                    options.Endpoint = new Uri(otlpEndpoint);
                    options.Protocol = OtlpExportProtocol.Grpc;
                })
            )
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddMongoDBInstrumentation()
                .AddSource(serviceName)
                
                .AddOtlpExporter(options =>
                {
                    options.Endpoint = new Uri(otlpEndpoint);
                })
            )
            .WithLogging(logging => logging
                .AddOtlpExporter(options =>
                {
                    options.Endpoint = new Uri(otlpEndpoint);
                })
            );
        
        // Register Meter for business metrics
        services.AddSingleton<Meter>(sp => 
            new Meter("DataProcessing.Business.Metrics", "1.0"));
    }
}
```

### ValidationService - Business Metrics via OpenTelemetry

**File:** `src/Services/ValidationService/Services/ValidationService.cs`

```csharp
public class ValidationService : IValidationService
{
    private readonly Meter _businessMeter;
    private readonly Counter<long> _recordsProcessedCounter;
    private readonly Histogram<double> _validationErrorRate;
    private readonly Histogram<double> _processingDuration;
    private readonly Counter<long> _invalidRecordsCounter;
    
    public ValidationService(Meter businessMeter)
    {
        _businessMeter = businessMeter;
        
        // Create business metrics instruments
        _recordsProcessedCounter = _businessMeter.CreateCounter<long>(
            "business_records_processed_total",
            description: "Total records processed by data source"
        );
        
        _validationErrorRate = _businessMeter.CreateHistogram<double>(
            "business_validation_error_rate",
            description: "Validation error rate per data source"
        );
        
        _processingDuration = _businessMeter.CreateHistogram<double>(
            "business_file_processing_duration_seconds",
            description: "File processing duration in seconds"
        );
        
        _invalidRecordsCounter = _businessMeter.CreateCounter<long>(
            "business_invalid_records_count",
            description: "Count of invalid records by error type"
        );
    }
    
    public async Task<ValidationResult> ValidateRecords(...)
    {
        var startTime = DateTime.UtcNow;
        
        // Validation logic...
        var result = await PerformValidation(...);
        
        var duration = (DateTime.UtcNow - startTime).TotalSeconds;
        
        // Push business metrics via OpenTelemetry (automatic to OTel Collector)
        _recordsProcessedCounter.Add(
            result.TotalRecords,
            new KeyValuePair<string, object>("data_source", dataSourceName),
            new KeyValuePair<string, object>("status", "completed")
        );
        
        _validationErrorRate.Record(
            result.ErrorRate,
            new KeyValuePair<string, object>("data_source", dataSourceName),
            new KeyValuePair<string, object>("file_name", fileName)
        );
        
        _processingDuration.Record(
            duration,
            new KeyValuePair<string, object>("data_source", dataSourceName),
            new KeyValuePair<string, object>("file_type", fileType)
        );
        
        _invalidRecordsCounter.Add(
            result.InvalidCount,
            new KeyValuePair<string, object>("data_source", dataSourceName),
            new KeyValuePair<string, object>("error_type", "validation_failed")
        );
        
        return result;
    }
}
```

### MetricsCollectorService - User-Configured Metrics via OpenTelemetry

**File:** `src/Services/MetricsCollectorService/Services/MetricExecutionService.cs`

```csharp
public class MetricExecutionService
{
    private readonly Meter _businessMeter;
    private readonly IMetricConfigurationRepository _configRepo;
    private readonly Dictionary<string, ObservableGauge<double>> _registeredMetrics;
    
    public MetricExecutionService(Meter businessMeter, IMetricConfigurationRepository configRepo)
    {
        _businessMeter = businessMeter;
        _configRepo = configRepo;
        _registeredMetrics = new Dictionary<string, ObservableGauge<double>>();
    }
    
    public async Task RegisterUserConfiguredMetrics()
    {
        var configs = await _configRepo.GetActiveAsync();
        
        foreach (var config in configs)
        {
            // Register as ObservableGauge that calculates value when scraped
            var gauge = _businessMeter.CreateObservableGauge<double>(
                $"business_{config.MetricName}",
                async () =>
                {
                    var value = await ExecuteMetricFormula(config);
                    return new Measurement<double>(
                        value,
                        config.Labels.Select(l => 
                            new KeyValuePair<string, object>(l.Key, l.Value))
                    );
                },
                description: config.Description
            );
            
            _registeredMetrics[config.Id] = gauge;
        }
    }
    
    private async Task<double> ExecuteMetricFormula(MetricConfiguration config)
    {
        // Execute MongoDB aggregation based on config.Formula
        // Return calculated value
    }
}
```

---

## Grafana as Query Layer

### No Direct Prometheus Access

**Rule:** ❌ Frontend and AI Assistant DO NOT query Prometheus directly  
**Rule:** ✅ ALL queries go through Grafana HTTP API

### Grafana Configuration

**File:** `deploy/grafana/datasources.yaml`

```yaml
apiVersion: 1

datasources:
  # System Prometheus datasource
  - name: System-Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus-system:9090
    isDefault: false
    editable: false
    jsonData:
      timeInterval: 15s
      
  # Business Prometheus datasource
  - name: Business-Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus-business:9091
    isDefault: true
    editable: false
    jsonData:
      timeInterval: 1m
      
  # Elasticsearch datasource
  - name: Elasticsearch-Logs
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    database: dataprocessing-logs-*
    jsonData:
      timeField: "@timestamp"
      esVersion: "8.0.0"
      logMessageField: message
      logLevelField: level
```

### Grafana HTTP API Client

**File:** `src/Frontend/src/services/GrafanaApiClient.ts`

```typescript
export class GrafanaApiClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.REACT_APP_GRAFANA_URL || 'http://localhost:3000';
    this.apiKey = process.env.REACT_APP_GRAFANA_API_KEY || '';
  }
  
  /**
   * Query Business Prometheus via Grafana API
   */
  async queryBusinessMetric(
    query: string,
    from: Date,
    to: Date
  ): Promise<MetricQueryResult> {
    const response = await fetch(
      `${this.baseUrl}/api/datasources/proxy/uid/Business-Prometheus/api/v1/query_range`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          start: from.toISOString(),
          end: to.toISOString(),
          step: '1h'
        })
      }
    );
    
    return await response.json();
  }
  
  /**
   * Query logs from Elasticsearch via Grafana API
   */
  async queryLogs(
    searchQuery: string,
    from: Date,
    to: Date
  ): Promise<LogQueryResult> {
    const response = await fetch(
      `${this.baseUrl}/api/datasources/proxy/uid/Elasticsearch-Logs/_search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: {
            bool: {
              must: [
                { query_string: { query: searchQuery } },
                { range: { '@timestamp': { gte: from, lte: to } } }
              ]
            }
          },
          size: 1000,
          sort: [{ '@timestamp': 'desc' }]
        })
      }
    );
    
    return await response.json();
  }
}
```

---

## AI Assistant Integration with Grafana

**File:** `src/Services/DataSourceChatService/Services/GrafanaQueryService.cs`

```csharp
public interface IGrafanaQueryService
{
    Task<GrafanaQueryResult> QueryBusinessMetric(string promQL, DateTime from, DateTime to);
    Task<GrafanaQueryResult> QuerySystemMetric(string promQL, DateTime from, DateTime to);
    Task<LogsQueryResult> QueryLogs(string query, DateTime from, DateTime to);
}

public class GrafanaQueryService : IGrafanaQueryService
{
    private readonly HttpClient _httpClient;
    private readonly string _grafanaUrl;
    private readonly string _apiKey;
    
    public async Task<GrafanaQueryResult> QueryBusinessMetric(
        string promQL,
        DateTime from,
        DateTime to)
    {
        // Query Business Prometheus via Grafana API
        var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_grafanaUrl}/api/datasources/proxy/uid/Business-Prometheus/api/v1/query_range");
        
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

**OpenAI Integration:**

```csharp
public class OpenAIService : IOpenAIService
{
    private readonly IGrafanaQueryService _grafanaQuery;
    
    public async Task<string> GetBusinessInsights(string userQuestion)
    {
        // Translate natural language to PromQL
        var promQLQuery = await TranslateToPromQL(userQuestion);
        // Example: "What were yesterday's sales?" 
        // → "sum(business_daily_sales_total{period='yesterday'})"
        
        // Query via Grafana API (NOT direct Prometheus)
        var result = await _grafanaQuery.QueryBusinessMetric(
            promQLQuery,
            DateTime.UtcNow.AddDays(-1),
            DateTime.UtcNow
        );
        
        // If need logs context, query via Grafana
        var logs = await _grafanaQuery.QueryLogs(
            "level:error AND data_source:sales",
            DateTime.UtcNow.AddDays(-1),
            DateTime.UtcNow
        );
        
        // Generate AI response with both metrics and logs context
        return await GenerateResponse(userQuestion, result, logs);
    }
}
```

---

## Docker Compose - Complete Stack

**File:** `docker-compose.development.yml` (Update)

```yaml
version: '3.8'

services:
  # OpenTelemetry Collector - Central Hub
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    container_name: otel-collector
    command: ["--config=/etc/otel-collector/config.yaml"]
    volumes:
      - ./deploy/otel-collector/config.yaml:/etc/otel-collector/config.yaml
    ports:
      - "4317:4317"  # OTLP gRPC receiver
      - "4318:4318"  # OTLP HTTP receiver
      - "8888:8888"  # OTel Collector metrics
    networks:
      - dataprocessing-network

  # System Prometheus
  prometheus-system:
    image: prom/prometheus:latest
    container_name: prometheus-system
    command:
      - '--config.file=/etc/prometheus/prometheus-system.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-remote-write-receiver'  # Accept from OTel Collector
    volumes:
      - ./deploy/prometheus/prometheus-system.yml:/etc/prometheus/prometheus-system.yml
      - prometheus-system-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - dataprocessing-network

  # Business Prometheus
  prometheus-business:
    image: prom/prometheus:latest
    container_name: prometheus-business
    command:
      - '--config.file=/etc/prometheus/prometheus-business.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-remote-write-receiver'  # Accept from OTel Collector
    volumes:
      - ./deploy/prometheus/prometheus-business.yml:/etc/prometheus/prometheus-business.yml
      - prometheus-business-data:/prometheus
    ports:
      - "9091:9090"
    networks:
      - dataprocessing-network

  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - dataprocessing-network

  # Grafana - Query Layer
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SERVER_ROOT_URL=http://localhost:3000
      - GF_FEATURE_TOGGLES_ENABLE=publicDashboards
    volumes:
      - grafana-data:/var/lib/grafana
      - ./deploy/grafana/datasources.yaml:/etc/grafana/provisioning/datasources/datasources.yaml
      - ./deploy/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    depends_on:
      - prometheus-system
      - prometheus-business
      - elasticsearch
    networks:
      - dataprocessing-network

  # All microservices send telemetry to otel-collector:4317
  datasource-management:
    build: ./src/Services/DataSourceManagementService
    environment:
      - ServiceName=datasource-management
      - OpenTelemetry__OtlpEndpoint=http://otel-collector:4317
    depends_on:
      - otel-collector
    networks:
      - dataprocessing-network

  validation-service:
    build: ./src/Services/ValidationService
    environment:
      - ServiceName=validation-service
      - OpenTelemetry__OtlpEndpoint=http://otel-collector:4317
    depends_on:
      - otel-collector
    networks:
      - dataprocessing-network

  # ... other services follow same pattern

volumes:
  prometheus-system-data:
  prometheus-business-data:
  elasticsearch-data:
  grafana-data:

networks:
  dataprocessing-network:
    driver: bridge
```

---

## Corrected Data Flow

### Business Metric Configuration to Querying

```
1. USER CONFIGURES METRIC IN UI
   Metric: "daily_sales_total"
   Formula: "SUM(amount) WHERE status='completed'"
   ↓

2. SAVED TO MONGODB
   MetricConfiguration collection
   ↓

3. METRICS COLLECTOR SERVICE
   Reads configurations from MongoDB
   Executes formulas on processed data
   ↓

4. PUSH VIA OPENTELEMETRY SDK
   meter.CreateObservableGauge("business_daily_sales_total", ...)
   ↓

5. OPENTELEMETRY COLLECTOR RECEIVES
   Routes "business_*" metrics → Business Prometheus exporter
   ↓

6. BUSINESS PROMETHEUS STORES
   Time-series database (Port 9091)
   ↓

7. GRAFANA QUERIES PROMETHEUS
   Grafana → Prometheus API → Data
   ↓

8. FRONTEND/AI QUERIES GRAFANA API
   HTTP GET /api/datasources/proxy/.../query_range
   ↓

9. RESULTS DISPLAYED
   Dashboard charts, AI insights
```

### Validation Auto-Metrics Flow

```
FILE VALIDATION
    ↓
ValidationService validates records
    ↓
Records business metrics via OpenTelemetry SDK:
  • _recordsProcessedCounter.Add(count)
  • _validationErrorRate.Record(rate)
  • _processingDuration.Record(seconds)
  • _invalidRecordsCounter.Add(count)
    ↓
OpenTelemetry SDK → OTel Collector (Port 4317)
    ↓
OTel Collector filters "business_*" prefix
    ↓
Routes to Business Prometheus
    ↓
Grafana queries Prometheus
    ↓
AI Assistant/Dashboard gets data via Grafana API
```

---

## Benefits of OpenTelemetry Collector Pattern

### 1. Centralized Telemetry
- Single configuration point
- Consistent routing rules
- Easy to add new backends
- Vendor-neutral

### 2. Flexibility
- Change backends without touching services
- Add sampling, filtering, transformation
- Route different metrics to different backends
- Easy A/B testing of backends

### 3. Performance
- Batching and buffering
- Compression
- Retry logic
- Back-pressure handling

### 4. Security
- Services don't need Prometheus/Elasticsearch credentials
- Single point for access control
- TLS termination at collector

---

## Summary of Corrections

### ❌ Previous (Incorrect):
- Services push directly to Prometheus Pushgateway
- Frontend queries Prometheus directly
- Manual metric routing

### ✅ Corrected (Final):
- **All services** → OpenTelemetry SDK → **OTel Collector**
- OTel Collector → Routes to System/Business Prometheus + Elasticsearch
- **All queries** → **Grafana HTTP API** (no direct Prometheus/Elasticsearch access)
- Automatic metric routing based on naming convention

### Technology Stack:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Metric Writing** | OpenTelemetry SDK | All services emit metrics |
| **Telemetry Hub** | OpenTelemetry Collector | Route and process telemetry |
| **System Metrics Storage** | Prometheus (Port 9090) | Infrastructure metrics |
| **Business Metrics Storage** | Prometheus (Port 9091) | Business KPIs |
| **Logs Storage** | Elasticsearch (Port 9200) | Application logs |
| **Query & Visualization** | Grafana (Port 3000) | Unified query layer |
| **Frontend Access** | Grafana HTTP API | Dashboard data |
| **AI Access** | Grafana HTTP API | Business insights |

---

## appsettings Configuration

**File:** `src/Services/*/appsettings.json`

```json
{
  "ServiceName": "validation-service",
  "OpenTelemetry": {
    "OtlpEndpoint": "http://otel-collector:4317",
    "EnableMetrics": true,
    "EnableTraces": true,
    "EnableLogs": true
  },
  "Grafana": {
    "ApiUrl": "http://grafana:3000",
    "ApiKey": "${GRAFANA_API_KEY}",
    "SystemDatasourceUid": "system-prometheus-uid",
    "BusinessDatasourceUid": "business-prometheus-uid",
    "ElasticsearchDatasourceUid": "elasticsearch-logs-uid"
  }
}
```

---

**Document Created:** September 30, 2025  
**Status:** Final corrected architecture with OpenTelemetry Collector pattern  
**Validation:** ✅ All metrics via OTel Collector, all queries via Grafana API

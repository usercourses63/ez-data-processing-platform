# Metrics Architecture - Corrected Design

## Executive Summary

The EZ Data Processing Platform uses **TWO separate Prometheus databases** for different purposes, both integrated with the overall system architecture.

---

## Dual Prometheus Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EZ Data Processing Platform                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐        ┌──────────────────────────┐  │
│  │  System Prometheus   │        │  Business Prometheus     │  │
│  │  (Infrastructure)    │        │  (Data Insights)         │  │
│  ├──────────────────────┤        ├──────────────────────────┤  │
│  │                      │        │                          │  │
│  │ • CPU Usage          │        │ • Daily Sales Total      │  │
│  │ • Memory Usage       │        │ • Validation Error Rate  │  │
│  │ • HTTP Requests      │        │ • Records Processed      │  │
│  │ • API Latency        │        │ • File Processing Time   │  │
│  │ • DB Connections     │        │ • Invalid Record Count   │  │
│  │ • Service Health     │        │ • Data Source Status     │  │
│  │                      │        │ • Schema Version Usage   │  │
│  └──────────────────────┘        └──────────────────────────┘  │
│           ↑                                    ↑                 │
│           │ Auto-push                          │ Configured push │
│           │                                    │                 │
│  ┌────────┴───────┐                  ┌────────┴──────────┐      │
│  │ All Services   │                  │ Validation        │      │
│  │ (.NET metrics) │                  │ Service           │      │
│  └────────────────┘                  │ + Metrics Service │      │
│                                      └───────────────────┘      │
│                                               ↑                  │
│                                               │ Config from UI   │
│                                      ┌────────┴─────────┐        │
│                                      │ Metrics Config   │        │
│                                      │ UI (Frontend)    │        │
│                                      └──────────────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AI Assistant                                            │  │
│  │  Queries BOTH Prometheus instances for insights:         │  │
│  │  • System health from System Prometheus                  │  │
│  │  • Business insights from Business Prometheus            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## System Monitoring Prometheus (Existing)

### Purpose
Monitor infrastructure and application health

### Data Source
- Automatic instrumentation from .NET services
- OpenTelemetry SDK
- System metrics exporters

### Metrics Examples
```prometheus
# HTTP Requests
http_requests_total{service="datasource-management",method="POST",status="200"} 1543

# CPU Usage
process_cpu_usage{service="validation-service"} 0.45

# Memory
dotnet_total_memory_bytes{service="files-receiver"} 124567890

# API Latency
http_request_duration_seconds{endpoint="/api/v1/datasource",quantile="0.95"} 0.245
```

### Configuration
- `deploy/prometheus/prometheus-system.yml` (rename existing prometheus.yml)
- Auto-discovered from service `/metrics` endpoints

### Consumers
- DevOps team
- System administrators
- Grafana dashboards for infrastructure monitoring

---

## Business Metrics Prometheus (New - This Plan)

### Purpose
Track business KPIs and data processing insights

### Data Source
- **ValidationService** writes metrics after processing records
- **MetricsCollectorService** (new) calculates configured metrics
- User-configured formulas executed on MongoDB data

### Metrics Examples
```prometheus
# Business Metrics from Processed Data
daily_sales_total{data_source="sales_transactions",currency="ILS"} 127543.50

# Validation Metrics
validation_error_rate{data_source="customer_data",error_type="format"} 0.045

# Processing Metrics
records_processed_total{data_source="inventory",status="success"} 15234

# File Processing Metrics
file_processing_duration_seconds{data_source="sales",file_type="csv"} 12.34

# Data Quality Metrics
invalid_records_count{data_source="orders",reason="missing_field"} 23

# Schema Usage Metrics
schema_usage_count{schema_name="transaction_v2.1",version="2.1"} 5

# Data Source Health
datasource_last_success_timestamp{datasource_id="ds-123"} 1727696400
```

### Configuration
- User-configured through `Metrics Configuration` UI
- Stored in MongoDB as `DataProcessingMetricConfiguration` entities
- `deploy/prometheus/prometheus-business.yml` (new)

### Data Flow

```
1. User configures metric in UI
   ↓
2. Saves to MongoDB (MetricConfiguration collection)
   ↓
3. ValidationService processes records
   ↓
4. After validation, reads active metric configurations
   ↓
5. Calculates metric values from processed data
   ↓
6. Pushes metrics to Business Prometheus via Pushgateway
   ↓
7. AI Assistant queries Business Prometheus for insights
```

### Consumers
- Business users (via Dashboard)
- Data analysts (via custom charts)
- AI Assistant (for intelligent insights)
- Alerting system (for business rule violations)

---

## Implementation Components

### Backend Services

#### 1. MetricsCollectorService (New)

**File:** `src/Services/MetricsCollectorService/`

**Responsibilities:**
- Read metric configurations from MongoDB
- Execute formulas on processed data
- Calculate aggregations
- Push results to Business Prometheus Pushgateway
- Handle time windows and scheduling

**Key Classes:**

```csharp
public class MetricsCollectorService
{
    private readonly IMetricConfigurationRepository _configRepo;
    private readonly IPrometheusBusinessClient _prometheusClient;
    private readonly IMongoDatabase _database;
    
    public async Task CollectAndPushMetrics()
    {
        // Get active metric configurations
        var configs = await _configRepo.GetActiveAsync();
        
        foreach (var config in configs)
        {
            // Execute formula on MongoDB data
            var value = await ExecuteMetricFormula(config);
            
            // Push to Business Prometheus
            await _prometheusClient.PushMetric(
                name: config.MetricName,
                value: value,
                labels: config.Labels,
                timestamp: DateTime.UtcNow
            );
        }
    }
}
```

#### 2. ValidationService Enhancement

**File:** `src/Services/ValidationService/Services/ValidationService.cs` (Enhance)

**Add After Validation:**

```csharp
public async Task<ValidationResult> ValidateRecords(...)
{
    // Existing validation logic...
    
    // NEW: Push business metrics after validation
    await PushBusinessMetrics(validationResult);
    
    return validationResult;
}

private async Task PushBusinessMetrics(ValidationResult result)
{
    // Push validation error rate
    await _prometheusBusinessClient.PushGauge(
        "validation_error_rate",
        result.ErrorRate,
        new Dictionary<string, string>
        {
            { "data_source", result.DataSourceName },
            { "file_name", result.FileName }
        }
    );
    
    // Push records processed
    await _prometheusBusinessClient.PushCounter(
        "records_processed_total",
        result.TotalRecords,
        new Dictionary<string, string>
        {
            { "data_source", result.DataSourceName },
            { "status", "completed" }
        }
    );
    
    // Push invalid record count
    await _prometheusBusinessClient.PushGauge(
        "invalid_records_count",
        result.InvalidCount,
        new Dictionary<string, string>
        {
            { "data_source", result.DataSourceName },
            { "error_type", "validation_failed" }
        }
    );
}
```

#### 3. Prometheus Business Client

**File:** `src/Services/Shared/Monitoring/PrometheusBusinessClient.cs` (New)

```csharp
public interface IPrometheusBusinessClient
{
    Task PushGauge(string name, double value, Dictionary<string, string> labels);
    Task PushCounter(string name, double value, Dictionary<string, string> labels);
    Task PushHistogram(string name, double value, Dictionary<string, string> labels);
    Task PushSummary(string name, double value, Dictionary<string, string> labels);
}

public class PrometheusBusinessClient : IPrometheusBusinessClient
{
    private readonly HttpClient _httpClient;
    private readonly string _pushgatewayUrl;
    
    public PrometheusBusinessClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _pushgatewayUrl = configuration["Prometheus:Business:PushgatewayUrl"];
    }
    
    public async Task PushGauge(string name, double value, Dictionary<string, string> labels)
    {
        var metric = new PrometheusMetric
        {
            Name = name,
            Type = "gauge",
            Value = value,
            Labels = labels,
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
        
        await PushToPrometheus(metric);
    }
    
    private async Task PushToPrometheus(PrometheusMetric metric)
    {
        var content = FormatPrometheusMetric(metric);
        await _httpClient.PostAsync(
            $"{_pushgatewayUrl}/metrics/job/business-metrics/instance/{Environment.MachineName}",
            new StringContent(content, Encoding.UTF8, "text/plain")
        );
    }
}
```

### Frontend Components

#### Metrics Configuration UI

**What It Configures:**
1. **Metric Name** - e.g., "daily_sales_total"
2. **Formula** - e.g., "SUM(amount) WHERE status='completed'"
3. **Data Source** - Which MongoDB collection/data source
4. **Time Window** - Calculation frequency (hourly, daily, etc.)
5. **Labels** - Prometheus labels for segmentation
6. **Push Schedule** - How often to calculate and push

**Example Configuration:**

```json
{
  "metricName": "daily_sales_total",
  "prometheusMetricName": "business_daily_sales_total",
  "metricType": "gauge",
  "formula": "SUM(amount) WHERE status = 'completed'",
  "dataSourceId": "sales-transactions-ds",
  "timeWindow": "1d",
  "labels": {
    "currency": "ILS",
    "data_source": "sales_transactions"
  },
  "pushSchedule": "0 * * * *",  // Every hour
  "isActive": true
}
```

---

## Docker Compose Configuration

### Update docker-compose.development.yml

```yaml
services:
  # Existing System Prometheus
  prometheus-system:
    image: prom/prometheus:latest
    container_name: prometheus-system
    command:
      - '--config.file=/etc/prometheus/prometheus-system.yml'
    volumes:
      - ./deploy/prometheus/prometheus-system.yml:/etc/prometheus/prometheus-system.yml
      - prometheus-system-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - dataprocessing-network

  # NEW: Business Prometheus
  prometheus-business:
    image: prom/prometheus:latest
    container_name: prometheus-business
    command:
      - '--config.file=/etc/prometheus/prometheus-business.yml'
    volumes:
      - ./deploy/prometheus/prometheus-business.yml:/etc/prometheus/prometheus-business.yml
      - prometheus-business-data:/prometheus
    ports:
      - "9091:9090"  # Different port
    networks:
      - dataprocessing-network

  # NEW: Prometheus Pushgateway for Business Metrics
  prometheus-pushgateway:
    image: prom/pushgateway:latest
    container_name: prometheus-pushgateway
    ports:
      - "9092:9091"
    networks:
      - dataprocessing-network

  # Optional: Separate Grafana for Business Metrics
  grafana-business:
    image: grafana/grafana:latest
    container_name: grafana-business
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SERVER_ROOT_URL=http://localhost:3001
    volumes:
      - grafana-business-data:/var/lib/grafana
      - ./deploy/grafana/business-dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"
    networks:
      - dataprocessing-network

volumes:
  prometheus-system-data:
  prometheus-business-data:
  grafana-business-data:
```

---

## Configuration Files

### deploy/prometheus/prometheus-system.yml
(Existing - rename from prometheus.yml)

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'dataprocessing-services'
    static_configs:
      - targets:
        - 'datasource-management:8080'
        - 'scheduling-service:8080'
        - 'files-receiver:8080'
        - 'validation-service:8080'
        - 'schema-management:8080'
        - 'metrics-collector:8080'
```

### deploy/prometheus/prometheus-business.yml
(New)

```yaml
global:
  scrape_interval: 1m  # Less frequent, business data changes slower

scrape_configs:
  # Scrape from Pushgateway
  - job_name: 'business-metrics'
    honor_labels: true
    static_configs:
      - targets:
        - 'prometheus-pushgateway:9091'

# Optional: Recording rules for business calculations
rule_files:
  - '/etc/prometheus/business-rules.yml'
```

### deploy/prometheus/business-rules.yml
(New - Prometheus recording rules for derived metrics)

```yaml
groups:
  - name: business_metrics
    interval: 5m
    rules:
      # Calculate hourly sales from raw counter
      - record: business:sales:hourly
        expr: rate(business_daily_sales_total[1h])
      
      # Calculate error rate percentage
      - record: business:error_rate:percent
        expr: (business_invalid_records_count / business_records_processed_total) * 100
      
      # Calculate average processing time
      - record: business:processing_time:avg
        expr: avg_over_time(business_file_processing_duration_seconds[1h])
```

---

## Data Flow Architecture

### 1. Metric Configuration Flow

```
User (Frontend)
    │
    │ Configure Business Metric
    │ • Name: "daily_sales_total"
    │ • Formula: "SUM(amount) WHERE status='completed'"
    │ • Time Window: Daily
    │ • Labels: currency="ILS", source="sales"
    ↓
MetricsConfigurationService API
    │
    │ Validate & Save
    ↓
MongoDB (MetricConfiguration collection)
    │
    │ Stored configuration
    ↓
MetricsCollectorService
    │ (Reads configurations every X minutes)
    │
    │ Execute formula on data
    ↓
MongoDB (Processed Data)
    │
    │ Calculate metric value
    ↓
Business Prometheus Pushgateway
    │
    │ Push metric
    ↓
Business Prometheus Database
    │
    │ Store time-series data
    ↓
AI Assistant / Dashboard / Grafana
    │ Query for insights
```

### 2. Validation Service Metrics Flow

```
File Upload
    ↓
Validation Service
    │
    │ Validate Records
    ├─→ Validation Results
    │
    │ Calculate Business Metrics:
    │ • validation_error_rate
    │ • records_processed_total
    │ • invalid_records_count
    │ • file_processing_duration
    │ • data_quality_score
    ↓
Push to Business Prometheus Pushgateway
    ↓
Business Prometheus Database
```

---

## Metric Categories in Business Prometheus

### 1. File Processing Metrics

```prometheus
# Files processed by data source
business_files_processed_total{data_source="sales",status="success"} 156

# File processing duration
business_file_processing_duration_seconds{data_source="sales",file_type="csv"} 12.34

# File size processed
business_file_size_bytes{data_source="sales"} 1048576
```

### 2. Record Validation Metrics

```prometheus
# Total records validated
business_records_validated_total{data_source="sales",schema="v2.1"} 15234

# Invalid records by error type
business_invalid_records_count{data_source="sales",error_type="format_error"} 45
business_invalid_records_count{data_source="sales",error_type="missing_field"} 23
business_invalid_records_count{data_source="sales",error_type="range_violation"} 12

# Validation error rate
business_validation_error_rate{data_source="sales"} 0.052  # 5.2%

# Data quality score (0-100)
business_data_quality_score{data_source="sales"} 94.8
```

### 3. Business Data Metrics (User-Configured)

```prometheus
# Daily sales total
business_daily_sales_total{currency="ILS",region="north"} 127543.50

# Customer conversion rate
business_conversion_rate{funnel_stage="checkout"} 0.685  # 68.5%

# Average order value
business_average_order_value{currency="ILS",category="electronics"} 1543.25

# Unique customers
business_unique_customers_count{period="daily"} 1234
```

### 4. Schema and Metadata Metrics

```prometheus
# Active schemas count
business_active_schemas_count{category="financial"} 12

# Schema version usage
business_schema_version_usage{schema="transaction",version="v2.1"} 5
business_schema_version_usage{schema="transaction",version="v1.0"} 2

# Data source status
business_datasource_status{datasource="sales",status="active"} 1
business_datasource_status{datasource="old-system",status="inactive"} 1
```

---

## AI Assistant Integration

### Querying Business Prometheus

The AI Assistant will use PromQL to query Business Prometheus:

```csharp
// AI Assistant Service
public class AIAssistantService
{
    private readonly PrometheusQueryClient _systemPrometheus;    // Port 9090
    private readonly PrometheusQueryClient _businessPrometheus;  // Port 9091
    
    public async Task<string> GetBusinessInsight(string question)
    {
        // Example: "What were today's sales?"
        var query = "sum(business_daily_sales_total{period='today'})";
        var result = await _businessPrometheus.QueryAsync(query);
        
        // Example: "What's the current error rate for sales data?"
        var errorQuery = "business_validation_error_rate{data_source='sales'}";
        var errorRate = await _businessPrometheus.QueryInstantAsync(errorQuery);
        
        // Feed to OpenAI with context
        return await GenerateAIResponse(question, result, errorRate);
    }
}
```

### Example AI Queries

```csharp
// Get sales trend
"sum by (data_source) (rate(business_daily_sales_total[7d]))"

// Find data sources with high error rates
"business_validation_error_rate > 0.05"

// Compare this week to last week
"(sum(business_daily_sales_total[7d]) - sum(business_daily_sales_total[7d] offset 7d)) / sum(business_daily_sales_total[7d] offset 7d) * 100"

// Get processing performance
"avg(business_file_processing_duration_seconds) by (data_source)"
```

---

## Updated Architecture Components

### New Components Required

1. **MetricsCollectorService** (.NET Service)
   - Reads metric configurations from MongoDB
   - Executes formulas on processed data
   - Pushes to Business Prometheus Pushgateway
   - Scheduled execution (Quartz.NET or Hangfire)

2. **PrometheusBusinessClient** (Shared Library)
   - HTTP client for Pushgateway
   - Metric formatting
   - Label management
   - Error handling

3. **Business Prometheus Instance**
   - Separate Docker container
   - Different port (9091)
   - Business-focused configuration
   - Longer retention for business data

4. **Prometheus Pushgateway**
   - Accept metrics push from services
   - Buffer and expose for Prometheus scraping
   - Handle batching

### Enhanced Components

1. **ValidationService**
   - Add business metrics push after validation
   - Calculate data quality scores
   - Track validation patterns

2. **MetricsConfigurationService**
   - Manage metric configurations
   - Validate formulas
   - Preview results
   - Generate Prometheus metric names

3. **AI Assistant**
   - Query both Prometheus instances
   - System health from System Prometheus
   - Business insights from Business Prometheus

---

## Prometheus Metric Naming Convention

### Business Metrics Prefix
All business metrics MUST start with `business_` prefix:

```
business_daily_sales_total
business_validation_error_rate
business_records_processed_total
business_invalid_records_count
```

### System Metrics (No Prefix)
System monitoring metrics use standard Prometheus names:

```
http_requests_total
process_cpu_usage
dotnet_total_memory_bytes
```

This ensures clear separation and prevents naming conflicts.

---

## Dashboard Integration

### System Monitoring Dashboard
- Uses **System Prometheus** (port 9090)
- Grafana dashboards
- Infrastructure metrics
- Service health

### Business Dashboard (Frontend)
- Queries **Business Prometheus** (port 9091)
- React components with Recharts
- Business KPIs
- Custom user metrics

### Unified View (Optional)
- Grafana dashboard combining both
- Link system performance to business impact
- Example: "High CPU correlates with peak sales processing"

---

## Benefits of Dual Prometheus Architecture

### Separation of Concerns
- System metrics don't pollute business metrics
- Different retention policies
- Different access controls
- Clear ownership

### Scalability
- Business Prometheus can scale independently
- Different storage requirements
- Business data may need longer retention

### Flexibility
- User-configured metrics don't affect system monitoring
- Can add/remove business metrics without touching infrastructure
- AI Assistant has clean access to business data

### Performance
- Business metric calculations don't impact system monitoring
- Separate query load
- Optimized for different access patterns

---

## Implementation Steps

### Step 1: Infrastructure Setup
1. Add Business Prometheus container to docker-compose
2. Add Prometheus Pushgateway container
3. Create prometheus-business.yml configuration
4. Test connectivity

### Step 2: Backend Implementation
1. Create PrometheusBusinessClient in Shared library
2. Create MetricsCollectorService
3. Enhance ValidationService with metrics push
4. Add business metrics to other services as needed

### Step 3: Frontend Implementation
1. Build Metrics Configuration UI
2. Add Prometheus query client for Business Prometheus
3. Integrate with Dashboard
4. Connect AI Assistant to Business Prometheus

### Step 4: Testing
1. Configure test business metrics
2. Validate metric push to Business Prometheus
3. Query metrics via API
4. Verify AI Assistant integration

---

## Summary

The corrected architecture uses:

✅ **Two Prometheus Instances:**
1. System Prometheus (existing) - Infrastructure monitoring
2. Business Prometheus (new) - Business KPIs and data insights

✅ **Data Flow:**
- ValidationService → calculates metrics → pushes to Business Prometheus
- MetricsCollectorService → runs user formulas → pushes to Business Prometheus
- AI Assistant → queries Business Prometheus → provides insights

✅ **User Configuration:**
- Frontend UI configures business metrics
- Stored in MongoDB
- Executed by services
- Results pushed to Business Prometheus

This architecture provides clean separation while enabling powerful business insights through the same proven Prometheus technology used for system monitoring.

---

**Document Updated:** September 30, 2025  
**Status:** Corrected based on dual-Prometheus architecture

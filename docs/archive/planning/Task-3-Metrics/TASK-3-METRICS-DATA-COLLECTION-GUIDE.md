# Task-3: Metrics Data Collection Backend Implementation Guide

**Task ID:** task-3  
**MCP Request:** req-1  
**Status:** In Progress  
**Estimate:** 2 weeks (10 working days)  
**Priority:** P1 Important  
**Created:** October 30, 2025

---

## 📋 TASK OVERVIEW

### Current State Analysis

**What's Working:**
- ✅ MetricsConfigurationService stores metric configurations in MongoDB
- ✅ CRUD endpoints for managing metric configs (7 endpoints)
- ✅ OpenTelemetry instrumentation configured
- ✅ Frontend wizard creates and stores metric definitions
- ✅ Prometheus System (9090) and Business (9091) running
- ✅ OpenTelemetry Collector routes metrics correctly

**What's Missing:**
- ❌ No Prometheus HTTP client to query actual metric data
- ❌ No time-series data endpoints
- ❌ No current value endpoints
- ❌ No PromQL query execution
- ❌ No background metrics collection service
- ❌ No alert evaluation engine
- ❌ Charts in frontend show "No Data"

### Gap Analysis

The service currently manages metric **configurations** but doesn't collect or query metric **data**. This is like having a recipe book without any actual food - the definitions are there, but no actual metrics are being gathered or displayed.

---

## 🎯 IMPLEMENTATION REQUIREMENTS

### 1. Prometheus HTTP Client Integration

**Purpose:** Query Prometheus for actual metric data

**Required NuGet Packages:**
```xml
<!-- Add to MetricsConfigurationService.csproj -->
<PackageReference Include="Prometheus.Client.HttpClient" Version="7.0.1" />
```

**Implementation:**
- Create `Services/Prometheus/IPrometheusQueryService.cs`
- Create `Services/Prometheus/PrometheusQueryService.cs`
- Support both Prometheus instances (System and Business)
- Execute PromQL queries
- Parse and transform responses

### 2. Time-Series Data APIs

**New Controller Methods:**

```csharp
// MetricDataController.cs
[HttpGet("{metricId}/data")]
Task<IActionResult> GetTimeSeriesData(string metricId, [FromQuery] TimeRangeRequest request);

[HttpGet("{metricId}/current")]
Task<IActionResult> GetCurrentValue(string metricId);

[HttpPost("query")]
Task<IActionResult> ExecutePromQLQuery([FromBody] PromQLQueryRequest request);

[HttpGet("{metricId}/range")]
Task<IActionResult> GetMetricDataRange(string metricId, [FromQuery] DateRangeRequest request);
```

### 3. Background Metrics Collection

**Purpose:** Periodically collect metrics and evaluate alerts

**Implementation:**
- Create `Services/Collection/MetricsCollectionBackgroundService.cs`
- Inherit from `BackgroundService`
- Configurable collection interval (default: 60 seconds)
- Query Prometheus for all active metrics
- Store collected values for historical tracking (optional)
- Trigger alert evaluation

### 4. Alert Evaluation Engine

**Purpose:** Evaluate alert rules against collected metrics

**Implementation:**
- Create `Services/Alerts/IAlertEvaluationService.cs`
- Create `Services/Alerts/AlertEvaluationService.cs`
- Evaluate threshold-based alerts
- Evaluate percentage change alerts
- Trigger notifications when alerts fire (integration with Task-5)

---

## 📅 10-DAY IMPLEMENTATION PLAN

### Day 1: Setup & Dependencies

**Objectives:**
- Add Prometheus HTTP client package
- Configure Prometheus endpoints
- Create project structure

**Tasks:**
1. Add package reference to .csproj
2. Update appsettings.json with Prometheus URLs
3. Create Services/Prometheus folder
4. Create Services/Collection folder  
5. Create Services/Alerts folder
6. Create Models/Requests folder for new DTOs
7. Create Models/Responses folder for new DTOs

**Files Created:**
- `Services/Prometheus/IPrometheusQueryService.cs`
- `Services/Prometheus/PrometheusQueryService.cs`
- `Models/Requests/TimeRangeRequest.cs`
- `Models/Requests/PromQLQueryRequest.cs`
- `Models/Responses/MetricDataPoint.cs`
- `Models/Responses/TimeSeriesDataResponse.cs`

**Success Criteria:**
- ✅ Prometheus.Client.HttpClient installed
- ✅ Service can connect to Prometheus System and Business
- ✅ Basic PromQL query executes successfully

---

### Day 2-3: Prometheus Query Service

**Objectives:**
- Implement PrometheusQueryService with full PromQL support
- Handle both Prometheus instances (System/Business)
- Parse Prometheus JSON responses

**Implementation Details:**

**IPrometheusQueryService.cs:**
```csharp
public interface IPrometheusQueryService
{
    // Instant query - get current value
    Task<PrometheusQueryResult> QueryInstantAsync(string query, PrometheusInstance instance);
    
    // Range query - get time-series data
    Task<PrometheusQueryResult> QueryRangeAsync(string query, DateTime start, DateTime end, string step, PrometheusInstance instance);
    
    // Series metadata
    Task<IEnumerable<string>> GetMetricNamesAsync(PrometheusInstance instance);
    
    // Label values
    Task<IEnumerable<string>> GetLabelValuesAsync(string label, PrometheusInstance instance);
}

public enum PrometheusInstance
{
    System,   // Port 9090
    Business  // Port 9091
}
```

**PrometheusQueryService.cs:**
```csharp
public class PrometheusQueryService : IPrometheusQueryService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PrometheusQueryService> _logger;

    public PrometheusQueryService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<PrometheusQueryService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("Prometheus");
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<PrometheusQueryResult> QueryInstantAsync(string query, PrometheusInstance instance)
    {
        var baseUrl = GetPrometheusUrl(instance);
        var url = $"{baseUrl}/api/v1/query?query={Uri.EscapeDataString(query)}";
        
        try
        {
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            
            var json = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<PrometheusResponse>(json);
            
            return ParseResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error querying Prometheus: {Query}", query);
            throw;
        }
    }

    public async Task<PrometheusQueryResult> QueryRangeAsync(
        string query, DateTime start, DateTime end, string step, PrometheusInstance instance)
    {
        var baseUrl = GetPrometheusUrl(instance);
        var startTs = new DateTimeOffset(start).ToUnixTimeSeconds();
        var endTs = new DateTimeOffset(end).ToUnixTimeSeconds();
        
        var url = $"{baseUrl}/api/v1/query_range?" +
                  $"query={Uri.EscapeDataString(query)}&" +
                  $"start={startTs}&end={endTs}&step={step}";
        
        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<PrometheusResponse>(json);
        
        return ParseResult(result);
    }

    private string GetPrometheusUrl(PrometheusInstance instance)
    {
        return instance switch
        {
            PrometheusInstance.System => _configuration["Prometheus:SystemUrl"] ?? "http://localhost:9090",
            PrometheusInstance.Business => _configuration["Prometheus:BusinessUrl"] ?? "http://localhost:9091",
            _ => throw new ArgumentException($"Unknown Prometheus instance: {instance}")
        };
    }
}
```

**Success Criteria:**
- ✅ Can execute instant queries against both Prometheus instances
- ✅ Can execute range queries for time-series data
- ✅ Proper error handling and logging
- ✅ JSON response parsing works correctly

---

### Day 4-5: Metric Data Controller

**Objectives:**
- Create new controller for metric data operations
- Implement time-series endpoints
- Implement current value endpoints
- Integrate with PrometheusQueryService

**Implementation:**

**MetricDataController.cs:**
```csharp
[ApiController]
[Route("api/v1/metrics")]
public class MetricDataController : ControllerBase
{
    private readonly IPrometheusQueryService _prometheusService;
    private readonly IMetricRepository _metricRepository;
    private readonly ILogger<MetricDataController> _logger;

    [HttpGet("{metricId}/data")]
    public async Task<IActionResult> GetTimeSeriesData(
        string metricId,
        [FromQuery] DateTime? start,
        [FromQuery] DateTime? end,
        [FromQuery] string step = "1m")
    {
        try
        {
            // Get metric config
            var metric = await _metricRepository.GetByIdAsync(metricId);
            if (metric == null) return NotFound();

            // Default time range if not specified
            var endTime = end ?? DateTime.UtcNow;
            var startTime = start ?? endTime.AddHours(-24);

            // Determine which Prometheus instance
            var instance = metric.Scope == "global" 
                ? PrometheusInstance.System 
                : PrometheusInstance.Business;

            // Build PromQL query from metric formula
            var query = BuildPromQLQuery(metric);

            // Query Prometheus
            var result = await _prometheusService.QueryRangeAsync(
                query, startTime, endTime, step, instance);

            return Ok(new
            {
                IsSuccess = true,
                Data = new
                {
                    MetricId = metricId,
                    MetricName = metric.Name,
                    StartTime = startTime,
                    EndTime = endTime,
                    Step = step,
                    TimeSeries = result.Data
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting time-series data for metric {MetricId}", metricId);
            return StatusCode(500, new { IsSuccess = false, Error = ex.Message });
        }
    }

    [HttpGet("{metricId}/current")]
    public async Task<IActionResult> GetCurrentValue(string metricId)
    {
        try
        {
            var metric = await _metricRepository.GetByIdAsync(metricId);
            if (metric == null) return NotFound();

            var instance = metric.Scope == "global" 
                ? PrometheusInstance.System 
                : PrometheusInstance.Business;

            var query = BuildPromQLQuery(metric);
            var result = await _prometheusService.QueryInstantAsync(query, instance);

            return Ok(new
            {
                IsSuccess = true,
                Data = new
                {
                    MetricId = metricId,
                    MetricName = metric.Name,
                    Timestamp = DateTime.UtcNow,
                    Value = result.Value,
                    Labels = result.Labels
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current value for metric {MetricId}", metricId);
            return StatusCode(500, new { IsSuccess = false, Error = ex.Message });
        }
    }

    [HttpPost("query")]
    public async Task<IActionResult> ExecutePromQLQuery([FromBody] PromQLQueryRequest request)
    {
        try
        {
            var instance = request.Instance == "business" 
                ? PrometheusInstance.Business 
                : PrometheusInstance.System;

            PrometheusQueryResult result;
            
            if (request.QueryType == "instant")
            {
                result = await _prometheusService.QueryInstantAsync(request.Query, instance);
            }
            else
            {
                result = await _prometheusService.QueryRangeAsync(
                    request.Query,
                    request.Start ?? DateTime.UtcNow.AddHours(-1),
                    request.End ?? DateTime.UtcNow,
                    request.Step ?? "1m",
                    instance);
            }

            return Ok(new { IsSuccess = true, Data = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing PromQL query: {Query}", request.Query);
            return StatusCode(500, new { IsSuccess = false, Error = ex.Message });
        }
    }

    private string BuildPromQLQuery(MetricConfiguration metric)
    {
        // Convert metric configuration to PromQL query
        if (!string.IsNullOrEmpty(metric.Formula))
        {
            return metric.Formula; // Already PromQL
        }

        // Build from field path and aggregation
        var query = metric.Name;
        if (metric.Labels != null && metric.Labels.Any())
        {
            var labels = string.Join(",", metric.Labels.Select(l => $"{l.Key}=\"{l.Value}\""));
            query = $"{metric.Name}{{{labels}}}";
        }

        return query;
    }
}
```

**Request/Response Models:**

**Models/Requests/TimeRangeRequest.cs:**
```csharp
public class TimeRangeRequest
{
    public DateTime? Start { get; set; }
    public DateTime? End { get; set; }
    public string Step { get; set; } = "1m"; // 1m, 5m, 1h, etc.
}
```

**Models/Requests/PromQLQueryRequest.cs:**
```csharp
public class PromQLQueryRequest
{
    public required string Query { get; set; }
    public string QueryType { get; set; } = "instant"; // instant or range
    public string Instance { get; set; } = "business"; // business or system
    public DateTime? Start { get; set; }
    public DateTime? End { get; set; }
    public string Step { get; set; } = "1m";
}
```

**Models/Responses/MetricDataPoint.cs:**
```csharp
public class MetricDataPoint
{
    public DateTime Timestamp { get; set; }
    public double Value { get; set; }
    public Dictionary<string, string>? Labels { get; set; }
}
```

**Models/Responses/TimeSeriesDataResponse.cs:**
```csharp
public class TimeSeriesDataResponse
{
    public string MetricId { get; set; } = string.Empty;
    public string MetricName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Step { get; set; } = string.Empty;
    public List<MetricDataPoint> TimeSeries { get; set; } = new();
}
```

**Models/Prometheus/PrometheusResponse.cs:**
```csharp
public class PrometheusResponse
{
    public string Status { get; set; } = string.Empty;
    public PrometheusData? Data { get; set; }
}

public class PrometheusData
{
    public string ResultType { get; set; } = string.Empty;
    public List<PrometheusResult> Result { get; set; } = new();
}

public class PrometheusResult
{
    public Dictionary<string, string> Metric { get; set; } = new();
    public List<object>? Value { get; set; } // [timestamp, value]
    public List<List<object>>? Values { get; set; } // [[timestamp, value], ...]
}

public class PrometheusQueryResult
{
    public double Value { get; set; }
    public DateTime Timestamp { get; set; }
    public Dictionary<string, string> Labels { get; set; } = new();
    public List<MetricDataPoint> Data { get; set; } = new();
}
```

**Success Criteria:**
- ✅ Can query time-series data for any metric
- ✅ Can get current value for any metric
- ✅ Can execute arbitrary PromQL queries
- ✅ Proper error handling for missing metrics
- ✅ Response format matches frontend expectations

---

### Day 6-7: Background Metrics Collection

**Objectives:**
- Implement background service for periodic collection
- Collect data for all active metrics
- Support configurable intervals

**Implementation:**

**Services/Collection/MetricsCollectionBackgroundService.cs:**
```csharp
public class MetricsCollectionBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MetricsCollectionBackgroundService> _logger;
    private readonly IConfiguration _configuration;

    public MetricsCollectionBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<MetricsCollectionBackgroundService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalSeconds = _configuration.GetValue<int>("MetricsCollection:IntervalSeconds", 60);
        _logger.LogInformation("Metrics collection started. Interval: {Interval}s", intervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CollectMetricsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in metrics collection cycle");
            }

            await Task.Delay(TimeSpan.FromSeconds(intervalSeconds), stoppingToken);
        }
    }

    private async Task CollectMetricsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var metricRepository = scope.ServiceProvider.GetRequiredService<IMetricRepository>();
        var prometheusService = scope.ServiceProvider.GetRequiredService<IPrometheusQueryService>();
        var alertService = scope.ServiceProvider.GetRequiredService<IAlertEvaluationService>();

        // Get all active metrics
        var metrics = await metricRepository.GetAllAsync();
        var activeMetrics = metrics.Where(m => m.Status == "active").ToList();

        _logger.LogInformation("Collecting data for {Count} active metrics", activeMetrics.Count);

        foreach (var metric in activeMetrics)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                // Determine Prometheus instance
                var instance = metric.Scope == "global" 
                    ? PrometheusInstance.System 
                    : PrometheusInstance.Business;

                // Build query
                var query = BuildPromQLQuery(metric);

                // Get current value
                var result = await prometheusService.QueryInstantAsync(query, instance);

                // Evaluate alerts if metric has alert rules
                if (metric.AlertRules != null && metric.AlertRules.Any())
                {
                    await alertService.EvaluateAlertsAsync(metric, result.Value);
                }

                _logger.LogDebug("Collected metric {Name}: {Value}", metric.Name, result.Value);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error collecting metric {Name}", metric.Name);
            }
        }
    }

    private string BuildPromQLQuery(MetricConfiguration metric)
    {
        if (!string.IsNullOrEmpty(metric.Formula))
        {
            return metric.Formula;
        }

        var query = metric.Name;
        if (metric.Labels != null && metric.Labels.Any())
        {
            var labels = string.Join(",", metric.Labels.Select(l => $"{l.Key}=\"{l.Value}\""));
            query = $"{metric.Name}{{{labels}}}";
        }

        return query;
    }
}
```

**Configuration (appsettings.json):**
```json
{
  "Prometheus": {
    "SystemUrl": "http://localhost:9090",
    "BusinessUrl": "http://localhost:9091"
  },
  "MetricsCollection": {
    "IntervalSeconds": 60,
    "Enabled": true
  }
}
```

**Success Criteria:**
- ✅ Background service starts on application startup
- ✅ Collects data every 60 seconds
- ✅ Handles errors gracefully
- ✅ Logs collection activity
- ✅ Can be disabled via configuration

---

### Day 8-9: Alert Evaluation Engine

**Objectives:**
- Evaluate alert rules against collected metrics
- Support threshold-based alerts
- Support percentage change alerts
- Trigger notifications (stub for now, full implementation in Task-5)

**Implementation:**

**Services/Alerts/IAlertEvaluationService.cs:**
```csharp
public interface IAlertEvaluationService
{
    Task EvaluateAlertsAsync(MetricConfiguration metric, double currentValue);
    Task<List<AlertEvaluationResult>> EvaluateAllAsync();
}
```

**Services/Alerts/AlertEvaluationService.cs:**
```csharp
public class AlertEvaluationService : IAlertEvaluationService
{
    private readonly ILogger<AlertEvaluationService> _logger;
    private readonly IConfiguration _configuration;
    // Future: INotificationService for Task-5

    public async Task EvaluateAlertsAsync(MetricConfiguration metric, double currentValue)
    {
        if (metric.AlertRules == null || !metric.AlertRules.Any())
            return;

        foreach (var alert in metric.AlertRules.Where(a => a.Enabled))
        {
            try
            {
                var triggered = EvaluateAlertCondition(alert, currentValue);
                
                if (triggered)
                {
                    _logger.LogWarning(
                        "Alert triggered: {AlertName} for metric {MetricName}. Value: {Value}, Threshold: {Threshold}",
                        alert.Name, metric.Name, currentValue, alert.Threshold);

                    // TODO: Send notification (Task-5)
                    // await _notificationService.SendAlertAsync(metric, alert, currentValue);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error evaluating alert {AlertName}", alert.Name);
            }
        }
    }

    private bool EvaluateAlertCondition(AlertRule alert, double currentValue)
    {
        return alert.Operator switch
        {
            ">" => currentValue > alert.Threshold,
            ">=" => currentValue >= alert.Threshold,
            "<" => currentValue < alert.Threshold,
            "<=" => currentValue <= alert.Threshold,
            "==" => Math.Abs(currentValue - alert.Threshold) < 0.001,
            "!=" => Math.Abs(currentValue - alert.Threshold) >= 0.001,
            _ => false
        };
    }

    public async Task<List<AlertEvaluationResult>> EvaluateAllAsync()
    {
        // Evaluate all metrics and return summary
        var results = new List<AlertEvaluationResult>();
        // Implementation...
        return await Task.FromResult(results);
    }
}

public class AlertEvaluationResult
{
    public string MetricId { get; set; } = string.Empty;
    public string MetricName { get; set; } = string.Empty;
    public string AlertName { get; set; } = string.Empty;
    public bool Triggered { get; set; }
    public double CurrentValue { get; set; }
    public double Threshold { get; set; }
    public DateTime EvaluatedAt { get; set; }
}
```

**Success Criteria:**
- ✅ Alert rules evaluated correctly
- ✅ All operators supported (>, >=, <, <=, ==, !=)
- ✅ Alerts logged when triggered
- ✅ Ready for notification integration (Task-5)

---

### Day 10: Testing & Integration

**Objectives:**
- Test all new endpoints
- Verify Prometheus integration
- Test with real metrics
- Update frontend API client

**Testing Tasks:**

1. **Unit Tests:**
   - PrometheusQueryService query building
   - Alert evaluation logic
   - PromQL query generation

2. **Integration Tests:**
   - Query actual Prometheus data
   - Verify time-series responses
   - Test alert evaluation with real metrics

3. **Frontend Integration:**
   - Update `src/Frontend/src/services/metrics-api-client.ts`
   - Add new methods for data endpoints
   - Test chart rendering with real data

**Test Script (test-metrics-data-collection.ps1):**
```powershell
# Test current value
$metricId = "metric-id-from-db"
Invoke-RestMethod -Uri "http://localhost:5003/api/v1/metrics/$metricId/current" -Method Get

# Test time-series
$start = (Get-Date).AddHours(-24).ToString("o")
$end = (Get-Date).ToString("o")
Invoke-RestMethod -Uri "http://localhost:5003/api/v1/metrics/$metricId/data?start=$start&end=$end&step=5m" -Method Get

# Test PromQL query
$body = @{
    query = "http_requests_total"
    queryType = "instant"
    instance = "system"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5003/api/v1/metrics/query" -Method Post -Body $body -ContentType "application/json"
```

**Success Criteria:**
- ✅ All endpoints return 200 OK
- ✅ Time-series data parsed correctly
- ✅ Charts in frontend display real data
- ✅ Alert evaluation works
- ✅ No errors in logs

---

## 📦 DELIVERABLES

### Code Files

**Services:**
- `Services/Prometheus/IPrometheusQueryService.cs`
- `Services/Prometheus/PrometheusQueryService.cs`
- `Services/Collection/MetricsCollectionBackgroundService.cs`
- `Services/Alerts/IAlertEvaluationService.cs`
- `Services/Alerts/AlertEvaluationService.cs`

**Controllers:**
- `Controllers/MetricDataController.cs`

**Models - Requests:**
- `Models/Requests/TimeRangeRequest.cs`
- `Models/Requests/PromQLQueryRequest.cs`

**Models - Responses:**
- `Models/Responses/MetricDataPoint.cs`
- `Models/Responses/TimeSeriesDataResponse.cs`
- `Models/Prometheus/PrometheusResponse.cs`
- `Models/Prometheus/PrometheusQueryResult.cs`

**Configuration:**
- Updated `appsettings.json` with Prometheus URLs
- Updated `Program.cs` with service registrations

**Tests:**
- `test-metrics-data-collection.ps1`

### Documentation

- `docs/planning/TASK-3-IMPLEMENTATION-STATUS.md` (progress tracking)
- `docs/planning/TASK-3-COMPLETE.md` (final report)

---

## 🔧 CONFIGURATION CHANGES

### appsettings.json Updates

```json
{
  "MongoDB": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "DataProcessing"
  },
  "Prometheus": {
    "SystemUrl": "http://localhost:9090",
    "BusinessUrl": "http://localhost:9091",
    "TimeoutSeconds": 30
  },
  "MetricsCollection": {
    "Enabled": true,
    "IntervalSeconds": 60,
    "RetryAttempts": 3,
    "RetryDelaySeconds": 5
  },
  "AlertEvaluation": {
    "Enabled": true,
    "CooldownSeconds": 300
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "MetricsConfigurationService": "Debug",
      "MetricsCollectionBackgroundService": "Debug"
    }
  }
}
```

### Program.cs Updates

```csharp
// Register HTTP client for Prometheus
builder.Services.AddHttpClient("Prometheus", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Register services
builder.Services.AddScoped<IPrometheusQueryService, PrometheusQueryService>();
builder.Services.AddScoped<IAlertEvaluationService, AlertEvaluationService>();

// Register background service
builder.Services.AddHostedService<MetricsCollectionBackgroundService>();
```

---

## 🎯 SUCCESS CRITERIA

### Technical Criteria

- ✅ Prometheus HTTP client successfully queries both instances
- ✅ All new endpoints return expected data formats
- ✅ Time-series data displays in frontend charts
- ✅ Current values update in real-time
- ✅ Background collection runs without errors
- ✅ Alert evaluation logic works correctly
- ✅ OpenTelemetry metrics published to collector

### Business Criteria

- ✅ Users can see actual metric data in charts
- ✅ Historical trends visible
- ✅ Current values accurate
- ✅ Alerts trigger when thresholds exceeded
- ✅ No "No Data" messages in charts

### Integration Criteria

- ✅ Works with both Prometheus instances
- ✅ Works with OpenTelemetry Collector
- ✅ Frontend API client updated
- ✅ Charts render data correctly
- ✅ No breaking changes to existing config endpoints

---

## 🚧 DEPENDENCIES & BLOCKERS

### Prerequisites (COMPLETE ✅)

- ✅ Docker infrastructure running
- ✅ Prometheus System running (port 9090)
- ✅ Prometheus Business running (port 9091)
- ✅ OpenTelemetry Collector configured
- ✅ MetricsConfigurationService existing structure
- ✅ Frontend metrics wizard complete

### External Dependencies

- Prometheus HTTP API v1 (stable)
- .NET HttpClient
- Prometheus.Client.HttpClient (NuGet)

### Potential Blockers

1. **Prometheus Query Performance**
   - **Risk:** Large time ranges may be slow
   - **Mitigation:** Implement pagination, limit default ranges

2. **Data Format Mismatch**
   - **Risk:** Prometheus format doesn't match frontend expectations
   - **Mitigation:** Transform data in controller before returning

3. **Alert Storm**

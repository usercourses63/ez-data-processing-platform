using System.Globalization;
using System.Text.Json;
using DataProcessing.DataSourceManagement.Models;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Queries Prometheus HTTP API for instant and range metrics,
/// and Jaeger HTTP API for recent traces.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public class PrometheusQueryService : IPrometheusQueryService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PrometheusQueryService> _logger;

    private string BusinessPrometheusUrl =>
        _configuration["Prometheus:BusinessEndpoint"] ?? "http://prometheus-business:9090";
    private string SystemPrometheusUrl =>
        _configuration["Prometheus:SystemEndpoint"] ?? "http://prometheus-system:9090";
    private string JaegerUrl =>
        _configuration["Jaeger:Endpoint"] ?? "http://jaeger:16686";

    public PrometheusQueryService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<PrometheusQueryService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<DashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken ct)
    {
        var metrics = new DashboardMetricsDto();

        try
        {
            // Fetch KPIs via instant queries in parallel
            var throughputTask = QueryInstantAsync(BusinessPrometheusUrl,
                "sum(rate(business_records_processed_total[5m]))", ct);
            var successRateTask = QueryInstantAsync(BusinessPrometheusUrl,
                "100 * (1 - (sum(rate(business_invalid_records_total[5m])) / sum(rate(business_records_processed_total[5m]))))", ct);
            var latencyTask = QueryInstantAsync(BusinessPrometheusUrl,
                "histogram_quantile(0.95, sum(rate(business_processing_duration_seconds_bucket[5m])) by (le))", ct);
            var activeJobsTask = QueryInstantAsync(BusinessPrometheusUrl,
                "business_active_jobs", ct);
            var queueDepthTask = QueryInstantAsync(BusinessPrometheusUrl,
                "sum(business_files_pending)", ct);
            var errorRateTask = QueryInstantAsync(BusinessPrometheusUrl,
                "sum(rate(business_invalid_records_total[5m])) / sum(rate(business_records_processed_total[5m])) * 100", ct);

            await Task.WhenAll(throughputTask, successRateTask, latencyTask, activeJobsTask, queueDepthTask, errorRateTask);

            metrics.TotalThroughput = SanitizeDouble(throughputTask.Result);
            metrics.SuccessRate = SanitizeDouble(successRateTask.Result, fallback: 100);
            metrics.AvgLatency = SanitizeDouble(latencyTask.Result * 1000); // seconds to ms
            metrics.ActiveJobs = SafeCastToInt(activeJobsTask.Result);
            metrics.QueueDepth = SafeCastToInt(queueDepthTask.Result);
            metrics.ErrorRate = SanitizeDouble(errorRateTask.Result);

            // Fetch time-series history via range queries (last 30 min, step 1m ~ 30 data points)
            var now = DateTimeOffset.UtcNow;
            var start = now.AddMinutes(-30);

            var throughputHistoryTask = QueryRangeAsync(BusinessPrometheusUrl,
                "sum(rate(business_records_processed_total[5m]))", start, now, "60", ct);
            var latencyHistoryTask = QueryRangeAsync(BusinessPrometheusUrl,
                "histogram_quantile(0.95, sum(rate(business_processing_duration_seconds_bucket[5m])) by (le))", start, now, "60", ct);
            var errorHistoryTask = QueryRangeAsync(BusinessPrometheusUrl,
                "sum(rate(business_invalid_records_total[5m]))", start, now, "60", ct);

            await Task.WhenAll(throughputHistoryTask, latencyHistoryTask, errorHistoryTask);

            metrics.ThroughputHistory = throughputHistoryTask.Result;
            // Convert latency from seconds to ms
            metrics.LatencyHistory = latencyHistoryTask.Result
                .Select(p => new MetricDataPointDto { Timestamp = p.Timestamp, Value = p.Value * 1000 })
                .ToList();
            metrics.ErrorHistory = errorHistoryTask.Result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to get dashboard metrics from Prometheus");
        }

        return metrics;
    }

    public async Task<List<AlertDto>> GetActiveAlertsAsync(CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);

            var response = await client.GetAsync($"{BusinessPrometheusUrl}/api/v1/alerts", ct);
            if (!response.IsSuccessStatusCode)
                return new List<AlertDto>();

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);

            var alerts = new List<AlertDto>();
            var data = doc.RootElement.GetProperty("data");

            if (data.TryGetProperty("alerts", out var alertsArray))
            {
                foreach (var alert in alertsArray.EnumerateArray())
                {
                    var state = alert.TryGetProperty("state", out var s) ? s.GetString() : "inactive";
                    if (state != "firing" && state != "pending")
                        continue;

                    var labels = alert.GetProperty("labels");
                    var annotations = alert.TryGetProperty("annotations", out var ann) ? ann : default;

                    alerts.Add(new AlertDto
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = labels.TryGetProperty("severity", out var sev) ? sev.GetString() ?? "warning" : "warning",
                        Title = labels.TryGetProperty("alertname", out var name) ? name.GetString() ?? "" : "",
                        Message = annotations.ValueKind == JsonValueKind.Object && annotations.TryGetProperty("summary", out var summary)
                            ? summary.GetString() ?? "" : "",
                        Service = labels.TryGetProperty("service", out var svc) ? svc.GetString() ?? "" : "",
                        Timestamp = alert.TryGetProperty("activeAt", out var at) && DateTime.TryParse(at.GetString(), out var dt)
                            ? dt : DateTime.UtcNow
                    });
                }
            }

            return alerts;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to get active alerts from Prometheus");
            return new List<AlertDto>();
        }
    }

    public async Task<List<TraceDto>> GetRecentTracesAsync(CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);

            // Query multiple services to find multi-span pipeline traces
            var services = new[] {
                "DataProcessing.DataSourceManagement",
                "DataProcessing.Scheduling",
                "DataProcessing.FileDiscovery",
                "DataProcessing.FileProcessor",
                "DataProcessing.Validation",
                "DataProcessing.Output"
            };

            var allTraces = new List<TraceDto>();

            foreach (var service in services)
            {
                var url = $"{JaegerUrl}/api/traces?service={service}&limit=3&lookback=1h";
                var response = await client.GetAsync(url, ct);
                if (!response.IsSuccessStatusCode)
                    continue;

                var json = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(json);

                if (!doc.RootElement.TryGetProperty("data", out var data))
                    continue;

                foreach (var trace in data.EnumerateArray())
                {
                    var traceId = trace.TryGetProperty("traceID", out var tid) ? tid.GetString() ?? "" : "";

                    // Skip duplicates (same trace from multiple services)
                    if (allTraces.Any(t => t.TraceId == traceId))
                        continue;

                    var spans = new List<TraceSpanDto>();
                    double traceStartUs = double.MaxValue;
                    double traceEndUs = 0;
                    DateTime timestamp = DateTime.UtcNow;

                    if (trace.TryGetProperty("spans", out var spansArray))
                    {
                        // First pass: find trace start time
                        foreach (var span in spansArray.EnumerateArray())
                        {
                            var startUs = span.TryGetProperty("startTime", out var st) ? st.GetDouble() : 0;
                            var durationUs = span.TryGetProperty("duration", out var dur) ? dur.GetDouble() : 0;
                            if (startUs < traceStartUs) traceStartUs = startUs;
                            if (startUs + durationUs > traceEndUs) traceEndUs = startUs + durationUs;
                        }

                        // Second pass: build spans with relative start times
                        foreach (var span in spansArray.EnumerateArray())
                        {
                            var startUs = span.TryGetProperty("startTime", out var st) ? st.GetDouble() : 0;
                            var durationUs = span.TryGetProperty("duration", out var dur) ? dur.GetDouble() : 0;

                            var processId = span.TryGetProperty("processID", out var pid) ? pid.GetString() ?? "" : "";
                            var serviceName = "";
                            if (trace.TryGetProperty("processes", out var processes) &&
                                processes.TryGetProperty(processId, out var process) &&
                                process.TryGetProperty("serviceName", out var sn))
                            {
                                serviceName = sn.GetString() ?? "";
                            }

                            spans.Add(new TraceSpanDto
                            {
                                Service = serviceName,
                                ServiceName = serviceName,
                                Start = (startUs - traceStartUs) / 1000.0, // relative ms from trace start
                                Duration = durationUs / 1000.0 // microseconds to ms
                            });
                        }

                        if (traceStartUs < double.MaxValue)
                        {
                            timestamp = DateTimeOffset.FromUnixTimeMilliseconds((long)(traceStartUs / 1000)).UtcDateTime;
                        }
                    }

                    var totalDuration = (traceEndUs - traceStartUs) / 1000.0; // ms

                    allTraces.Add(new TraceDto
                    {
                        TraceId = traceId,
                        TotalDuration = Math.Max(totalDuration, 0.001), // avoid zero division
                        Spans = spans.OrderBy(s => s.Start).ToList(),
                        Timestamp = timestamp
                    });
                }
            }

            // Return traces sorted by most spans first (richer pipeline traces)
            return allTraces.OrderByDescending(t => t.Spans.Count).Take(5).ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to get recent traces from Jaeger");
            return new List<TraceDto>();
        }
    }

    /// <summary>
    /// Sanitize a double value for JSON serialization.
    /// System.Text.Json throws on NaN/Infinity which causes SignalR to send truncated JSON.
    /// </summary>
    private static double SanitizeDouble(double value, double fallback = 0)
        => double.IsFinite(value) ? value : fallback;

    /// <summary>
    /// Safely cast a double to int, handling NaN/Infinity which produce undefined behavior with (int) cast.
    /// </summary>
    private static int SafeCastToInt(double value)
        => double.IsFinite(value) ? (int)value : 0;

    /// <summary>
    /// Execute a Prometheus instant query and return the scalar result.
    /// Returns 0 on failure or empty result.
    /// </summary>
    private async Task<double> QueryInstantAsync(string baseUrl, string query, CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);

            var url = $"{baseUrl}/api/v1/query?query={Uri.EscapeDataString(query)}";
            var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
                return 0;

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);

            var result = doc.RootElement.GetProperty("data").GetProperty("result");
            if (result.GetArrayLength() == 0)
                return 0;

            var value = result[0].GetProperty("value")[1].GetString();
            if (double.TryParse(value, CultureInfo.InvariantCulture, out var d) && double.IsFinite(d))
                return d;
            return 0;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Prometheus instant query failed: {Query}", query);
            return 0;
        }
    }

    /// <summary>
    /// Execute a Prometheus range query and return the time-series data points.
    /// Returns empty list on failure.
    /// </summary>
    private async Task<List<MetricDataPointDto>> QueryRangeAsync(
        string baseUrl, string query, DateTimeOffset start, DateTimeOffset end, string step, CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);

            var url = $"{baseUrl}/api/v1/query_range?query={Uri.EscapeDataString(query)}" +
                      $"&start={start.ToUnixTimeSeconds()}&end={end.ToUnixTimeSeconds()}&step={step}";
            var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
                return new List<MetricDataPointDto>();

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);

            var result = doc.RootElement.GetProperty("data").GetProperty("result");
            if (result.GetArrayLength() == 0)
                return new List<MetricDataPointDto>();

            var values = result[0].GetProperty("values");
            var points = new List<MetricDataPointDto>();

            foreach (var val in values.EnumerateArray())
            {
                var timestamp = val[0].GetDouble();
                var valueStr = val[1].GetString();
                if (double.TryParse(valueStr, CultureInfo.InvariantCulture, out var value) && !double.IsNaN(value))
                {
                    points.Add(new MetricDataPointDto
                    {
                        Timestamp = DateTimeOffset.FromUnixTimeSeconds((long)timestamp).UtcDateTime,
                        Value = value
                    });
                }
            }

            return points;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Prometheus range query failed: {Query}", query);
            return new List<MetricDataPointDto>();
        }
    }
}

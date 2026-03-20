---
status: awaiting_human_verify
trigger: "SignalR WebSocket connections disconnect immediately with SyntaxError: Expected ',' or '}' after property value in JSON at position 4117"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — PrometheusQueryService.QueryInstantAsync returns double.NaN when Prometheus returns "NaN" string (no data). DashboardMetricsDto fields TotalThroughput and AvgLatency have no NaN guard. System.Text.Json (default strict mode) throws when serializing NaN, causing SignalR to send truncated JSON (partial buffer flush before exception). Client receives incomplete JSON and parses it as "SyntaxError: Expected ',' or '}' after property value in JSON at position 4117".
test: Apply fix — sanitize all double values in PrometheusQueryService before assigning to DTO.
expecting: Fix eliminates NaN from broadcast data, JSON serializes correctly, WebSocket stays connected.
next_action: Apply fix to PrometheusQueryService.cs and verify.

## Symptoms

expected: SignalR WebSocket stays connected. Browser receives EntityChanged events for real-time CRUD sync. MonitoringBroadcaster sends valid JSON for all monitoring events.
actual: WebSocket connects briefly, receives some data, then disconnects with JSON parse error at position 4117. Reconnect attempts flood the server with 429 Too Many Requests. EntityChanged events never reach the browser.
errors: "SyntaxError: Expected ',' or '}' after property value in JSON at position 4117 (line 1 column 4118)" — repeated on every reconnect attempt. Also "429 Too Many Requests" on negotiate endpoint from reconnect storm.
reproduction: Open any page in browser at http://127.0.0.1:7000. Open dev console (F12). See repeated "Connection disconnected with error 'SyntaxError'" messages.
started: When deployed datasource-management:v0.3.0-fix1 with MonitoringBroadcaster running against real K8s cluster.

## Eliminated

## Evidence

- timestamp: 2026-03-20T00:01:00Z
  checked: PrometheusQueryService.QueryInstantAsync (line 250)
  found: double.TryParse("NaN", CultureInfo.InvariantCulture, out d) succeeds and returns double.NaN. This method returns NaN when Prometheus has no data for rate queries.
  implication: Any instant query with no data returns NaN to the caller.

- timestamp: 2026-03-20T00:02:00Z
  checked: PrometheusQueryService.GetDashboardMetricsAsync (lines 57-62)
  found: TotalThroughput (line 57) and AvgLatency (line 59) have NO NaN guard. SuccessRate (line 58) and ErrorRate (line 62) DO have NaN guards. ActiveJobs and QueueDepth cast NaN to int — undefined behavior in C#.
  implication: DashboardMetricsDto contains NaN doubles when Prometheus has no metrics data.

- timestamp: 2026-03-20T00:03:00Z
  checked: Program.cs SignalR configuration (line 142)
  found: services.AddSignalR() with no custom JsonSerializerOptions. SignalR uses default System.Text.Json which is JsonNumberHandling.Strict — throws on NaN/Infinity serialization.
  implication: When MonitoringBroadcaster sends MetricsUpdate with NaN values, SignalR's JSON serializer throws mid-write.

- timestamp: 2026-03-20T00:04:00Z
  checked: SignalR incomplete JSON behavior (dotnet/aspnetcore#13651)
  found: Known issue — SignalR can flush partial JSON to WebSocket buffer before serialization exception. Client receives truncated JSON.
  implication: The "Expected ',' or '}' at position 4117" error is caused by truncated JSON from a serialization exception on NaN value.

- timestamp: 2026-03-20T00:05:00Z
  checked: QueryRangeAsync (line 291)
  found: Range queries filter out NaN: `!double.IsNaN(value)`. But the LatencyHistory transform (line 80) multiplies value by 1000 — if a non-NaN value somehow became NaN through multiplication, it would pass through. However, this is unlikely since multiplying a finite number by 1000 stays finite.
  implication: Range queries are safe, but instant queries are the problem source.

## Resolution

root_cause: PrometheusQueryService.QueryInstantAsync returns double.NaN when Prometheus has no data (rate queries with no samples return "NaN" string, which double.TryParse parses as double.NaN). DashboardMetricsDto.TotalThroughput and AvgLatency are assigned NaN without sanitization. SignalR uses default System.Text.Json (strict mode) which throws on NaN serialization, causing partial/truncated JSON to be flushed to the WebSocket. The browser receives malformed JSON and throws "SyntaxError: Expected ',' or '}' after property value in JSON at position 4117".
fix: Three-layer defense against NaN/Infinity in Prometheus metrics: (1) QueryInstantAsync now rejects NaN/Infinity with `double.IsFinite()` check, returning 0 instead. (2) Added SanitizeDouble() helper wrapping all DashboardMetricsDto double assignments. (3) Added SafeCastToInt() helper for int casts that were previously undefined behavior on NaN.
verification: Build succeeds with 0 errors, 0 warnings. Requires deploy and browser test.
files_changed: [src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs]

# Phase 16: SignalR Real-Time Updates - Research

**Researched:** 2026-03-16
**Domain:** ASP.NET Core SignalR + @microsoft/signalr frontend client + K8s/Prometheus data collection
**Confidence:** HIGH

## Summary

Phase 16 replaces ALL mock data generators on the System Monitoring page with real-time SignalR push events. The DataSourceManagementService hosts a single `MonitoringHub` with a `BackgroundService` broadcaster that queries K8s API, Prometheus HTTP API, and cached health check results on two tick intervals (5s for device health, 30s for infrastructure/metrics). The frontend connects via `@microsoft/signalr` (v7.0.11, already in package.json) with automatic reconnection and falls back to React Query polling when disconnected.

The file-simulator-suite provides a proven, working reference implementation of this exact pattern (ServerStatusHub + ServerStatusBroadcaster + useSignalR hook). The EZ implementation follows the same architecture with the addition of multiple event types and two-speed broadcasting. The existing `nas-device-manager` service account already has RBAC for deployments but needs pods, services, and endpoints permissions added for K8s monitoring queries.

**Primary recommendation:** Follow the file-simulator ServerStatusBroadcaster pattern exactly. Single `BackgroundService` with two timer loops, single hub with multiple `SendAsync` event names, `useSignalR` hook adapted from file-simulator with multi-event support.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All monitoring data flows through SignalR (not just device health)
- Replace ALL mock data generators with real data from K8s API + Prometheus + health checks
- Single hub (`MonitoringHub`) with 7 event types: DeviceHealthUpdate, ServiceStatusUpdate, PodStatusUpdate, QueueStatusUpdate, MetricsUpdate, AlertUpdate, TraceUpdate
- Status badge in ClusterHeader: green/yellow/red for connected/reconnecting/disconnected
- Auto-fallback to React Query polling (15s) when SignalR disconnects
- Use file-simulator's `isMountedRef` pattern for unmount safety
- Timer-based broadcasting from background service (5s health, 30s infrastructure)
- DataSourceManagement hosts the hub (no new microservice)
- Single `IHostedService` manages both broadcast loops
- KubernetesClient NuGet for K8s queries (already available)
- Prometheus PromQL via direct HttpClient (no extra packages)

### Claude's Discretion
- Exact SignalR hub route path (e.g., `/hubs/monitoring`)
- Reconnection retry delay pattern
- Whether to send initial state snapshot on client connect
- PromQL query design for dashboard metrics
- K8s service account RBAC configuration for pod/service listing
- CORS configuration for SignalR WebSocket connections
- Frontend hook design (single generic `useMonitoringHub` vs per-domain hooks)
- Exact Kafka admin client approach for queue stats

### Deferred Ideas (OUT OF SCOPE)
- Redis backplane for multi-pod SignalR scaling (HA-01, v0.3)
- Kafka topic message streaming via SignalR
- Alert notifications via SignalR push
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MON-07 | SignalR real-time updates on System Monitoring page (reference file-simulator-suite patterns) | Full stack researched: hub pattern from file-simulator, broadcaster pattern, useSignalR hook, CORS for WebSocket, K8s API queries, Prometheus PromQL, RBAC expansion |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Microsoft.AspNetCore.SignalR (built-in) | .NET 10.0 | Real-time hub + WebSocket transport | Built into ASP.NET Core, no extra NuGet needed |
| @microsoft/signalr | ^7.0.11 | Frontend SignalR client | Already in package.json, compatible with .NET 10 server |
| KubernetesClient | 14.0.2 | K8s API queries (pods, services, endpoints) | Already in Directory.Packages.props and used for NAS PV/PVC |
| HttpClient (built-in) | .NET 10.0 | Prometheus PromQL HTTP API queries | No extra packages needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Confluent.Kafka | 2.12.0 | Kafka admin client for consumer group/topic stats | Already in Directory.Packages.props, use AdminClient API |
| @tanstack/react-query | (existing) | Polling fallback when SignalR disconnects | Already used throughout frontend |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single MonitoringHub | Multiple hubs per domain | Single hub simpler, multiple connections waste resources |
| BackgroundService timer | Quartz.NET job | BackgroundService is lighter, Quartz already used for health checks, no need for scheduler overhead |
| Direct Prometheus HTTP | prometheus-net client | prometheus-net is for exposing metrics, not querying; direct HTTP is correct for reads |

**Installation:**
```bash
# Backend: No new NuGet packages needed (SignalR built-in, K8s client + Confluent.Kafka already present)
# Frontend: No new npm packages needed (@microsoft/signalr already in package.json)
```

## Architecture Patterns

### Recommended Project Structure
```
src/Services/DataSourceManagementService/
├── Hubs/
│   └── MonitoringHub.cs              # SignalR hub with connection lifecycle logging
├── Services/
│   ├── MonitoringBroadcaster.cs      # BackgroundService with dual timer loops
│   ├── IKubernetesMonitoringService.cs
│   ├── KubernetesMonitoringService.cs # K8s API queries (pods, services)
│   ├── IPrometheusQueryService.cs
│   ├── PrometheusQueryService.cs      # PromQL HTTP API client
│   ├── IKafkaMonitoringService.cs
│   └── KafkaMonitoringService.cs      # Kafka admin client for queue stats
├── Models/
│   └── MonitoringModels.cs            # DTOs for all 7 event types

src/Frontend/src/
├── hooks/
│   └── useMonitoringHub.ts            # Multi-event SignalR hook (adapted from file-simulator)
├── pages/monitoring/
│   ├── SystemMonitoring.tsx           # Updated to use SignalR data
│   └── components/
│       └── ClusterHeader.tsx          # Updated with connection status badge
```

### Pattern 1: MonitoringHub (from file-simulator ServerStatusHub)
**What:** Minimal hub class with connection lifecycle logging and optional client-initiated request
**When to use:** Always — hub is the SignalR entry point
**Example:**
```csharp
// Source: file-simulator ServerStatusHub.cs pattern
public class MonitoringHub : Hub
{
    private readonly ILogger<MonitoringHub> _logger;

    public MonitoringHub(ILogger<MonitoringHub> logger) => _logger = logger;

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Monitoring client connected: {ConnectionId}", Context.ConnectionId);
        // Send initial state snapshot to newly connected client
        await Clients.Caller.SendAsync("InitialState", /* cached state */);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
            _logger.LogWarning(exception, "Monitoring client disconnected with error: {ConnectionId}", Context.ConnectionId);
        else
            _logger.LogInformation("Monitoring client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
```

### Pattern 2: Dual-Speed BackgroundService Broadcaster
**What:** Single `BackgroundService` with two loops running at different intervals
**When to use:** When different data domains have different freshness requirements
**Example:**
```csharp
// Source: file-simulator ServerStatusBroadcaster.cs pattern, adapted for dual timers
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken); // initial delay

    var healthTask = RunHealthBroadcastLoop(stoppingToken);      // 5s interval
    var infraTask = RunInfrastructureBroadcastLoop(stoppingToken); // 30s interval

    await Task.WhenAll(healthTask, infraTask);
}

private async Task RunHealthBroadcastLoop(CancellationToken ct)
{
    while (!ct.IsCancellationRequested)
    {
        try
        {
            var healthData = _deviceHealthService.GetHealthStatusAsync(ct);
            await _hubContext.Clients.All.SendAsync("DeviceHealthUpdate", healthData, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Error broadcasting health status");
        }
        await Task.Delay(TimeSpan.FromSeconds(5), ct);
    }
}
```

### Pattern 3: Multi-Event useMonitoringHub Hook
**What:** Single hook managing one SignalR connection with multiple event subscriptions
**When to use:** When a single hub emits multiple event types
**Example:**
```typescript
// Source: file-simulator useSignalR.ts adapted for multiple events
export function useMonitoringHub(hubUrl: string) {
  const [deviceHealth, setDeviceHealth] = useState(null);
  const [podStatus, setPodStatus] = useState(null);
  // ... more state per event type
  const [isConnected, setIsConnected] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('DeviceHealthUpdate', (data) => {
      if (!isMountedRef.current) return;
      setDeviceHealth(data);
    });
    connection.on('PodStatusUpdate', (data) => {
      if (!isMountedRef.current) return;
      setPodStatus(data);
    });
    // ... register all event handlers

    connection.start().then(() => isMountedRef.current && setIsConnected(true));
    return () => { isMountedRef.current = false; connection.stop(); };
  }, [hubUrl]);

  return { deviceHealth, podStatus, /* ... */ isConnected };
}
```

### Pattern 4: Polling Fallback
**What:** Enable React Query polling when SignalR disconnects, disable when it reconnects
**When to use:** For DeviceHealthTab which already has `useDeviceHealthStatus` React Query hook
**Example:**
```typescript
const { isConnected } = useMonitoringHub(hubUrl);
// Only poll when SignalR is disconnected
const { data: fallbackData } = useQuery({
  queryKey: ['device-health-status'],
  queryFn: getDeviceHealthStatus,
  refetchInterval: isConnected ? false : 15000,
  enabled: !isConnected,
});
```

### Anti-Patterns to Avoid
- **Creating multiple hub connections from frontend:** Use ONE connection with multiple `.on()` handlers, not separate connections per event type
- **Querying K8s API on every broadcast tick without caching:** K8s API responses change slowly — cache results and only re-query on timer tick
- **Using `AllowAnyOrigin()` with SignalR:** SignalR with WebSockets requires `AllowCredentials()` which is incompatible with `AllowAnyOrigin()`. Must use `SetIsOriginAllowed()` pattern from file-simulator
- **Registering broadcaster as Scoped:** `BackgroundService` must be registered as singleton via `AddHostedService<>()`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection management | Custom WebSocket code | `@microsoft/signalr` HubConnectionBuilder | Handles reconnection, fallback transports, serialization |
| K8s pod/service listing | kubectl exec or REST calls | `KubernetesClient` C# SDK (`IKubernetes.ListNamespacedPodAsync`) | Type-safe, handles auth, already configured |
| Prometheus metric queries | Scraping /metrics endpoints | Prometheus HTTP API (`/api/v1/query`) | PromQL aggregates data server-side |
| Kafka consumer group lag | Custom offset tracking | `Confluent.Kafka.AdminClient` (`ListConsumerGroupOffsetsAsync`) | Handles all Kafka protocol complexity |
| Connection reconnection logic | Manual retry loops | `withAutomaticReconnect()` built into SignalR client | Exponential backoff, lifecycle events, state tracking |

**Key insight:** Every data source this phase needs to query (K8s, Prometheus, Kafka, health checks) already has a client library present in the project. No new dependencies needed.

## Common Pitfalls

### Pitfall 1: CORS with SignalR WebSockets
**What goes wrong:** SignalR connection fails with CORS error when using `AllowAnyOrigin()` + `AllowCredentials()`
**Why it happens:** The W3C spec prohibits `Access-Control-Allow-Origin: *` with `credentials: include`. SignalR's WebSocket transport uses credentials mode.
**How to avoid:** Use `SetIsOriginAllowed()` pattern from file-simulator:
```csharp
policy.SetIsOriginAllowed(origin =>
    new Uri(origin).Host is "localhost" or "127.0.0.1")
  .AllowAnyMethod()
  .AllowAnyHeader()
  .AllowCredentials();
```
**Warning signs:** Browser console shows "CORS policy" errors on SignalR negotiate endpoint.

### Pitfall 2: Scoped Service in BackgroundService
**What goes wrong:** `DeviceHealthService` is registered as Scoped but `MonitoringBroadcaster` (BackgroundService/Singleton) tries to inject it
**Why it happens:** Singletons cannot resolve scoped services from root DI container
**How to avoid:** Use `IServiceProvider.CreateScope()` pattern, as already done in `DeviceHealthService.StartAsync()`:
```csharp
using var scope = _serviceProvider.CreateScope();
var healthService = scope.ServiceProvider.GetRequiredService<IDeviceHealthService>();
```
**Warning signs:** `InvalidOperationException: Cannot resolve scoped service from root provider`

### Pitfall 3: Vite Proxy Not Forwarding WebSocket
**What goes wrong:** SignalR connects via HTTP long-polling instead of WebSocket during development
**Why it happens:** Vite proxy only forwards `/api` prefix; SignalR hub at `/hubs/monitoring` is not proxied, and WebSocket upgrade requires explicit `ws: true` in proxy config
**How to avoid:** Add SignalR hub proxy entry in vite.config.ts:
```typescript
proxy: {
  '/api': { target: 'http://localhost:5001', changeOrigin: true },
  '/hubs': { target: 'http://localhost:5001', changeOrigin: true, ws: true }
}
```
**Warning signs:** SignalR connected but data arrives slowly, `transport: LongPolling` in SignalR debug logs.

### Pitfall 4: PascalCase JSON Serialization Mismatch
**What goes wrong:** Frontend receives SignalR events with PascalCase properties but expects camelCase (or vice versa)
**Why it happens:** DataSourceManagement uses `PropertyNamingPolicy = null` (PascalCase). SignalR uses the same JSON serializer options as the host.
**How to avoid:** Use PascalCase in TypeScript interfaces (matching existing `device-health.types.ts` pattern). All frontend types for monitoring already use PascalCase.
**Warning signs:** Properties are `undefined` when accessing SignalR event data.

### Pitfall 5: K8s RBAC Missing Permissions
**What goes wrong:** K8s API queries return 403 Forbidden for pod/service listing
**Why it happens:** Existing `nas-device-manager` service account only has PV/PVC/Deployment permissions, not pods/services/endpoints
**How to avoid:** Extend the existing RBAC Role to include pods, services, and endpoints read access
**Warning signs:** `KubernetesClientException: Forbidden` in logs

### Pitfall 6: BackgroundService Blocking Startup
**What goes wrong:** App startup hangs or is delayed
**Why it happens:** `ExecuteAsync` runs synchronously before yielding
**How to avoid:** Always start with `await Task.Delay()` or `await Task.Yield()` to release the startup thread
**Warning signs:** Health check endpoint not reachable for extended time after pod start

## Code Examples

### K8s Pod Listing via KubernetesClient
```csharp
// Source: KubernetesClient SDK (v14.0.2, already in project)
public async Task<List<PodStatusDto>> GetPodStatusesAsync(CancellationToken ct)
{
    var pods = await _kubernetesClient.CoreV1.ListNamespacedPodAsync(
        namespaceParameter: "ez-platform",
        cancellationToken: ct);

    return pods.Items.Select(pod => new PodStatusDto
    {
        Name = pod.Metadata.Name,
        Service = pod.Metadata.Labels?.GetValueOrDefault("app") ?? "unknown",
        Status = pod.Status.Phase,
        Restarts = pod.Status.ContainerStatuses?.Sum(c => c.RestartCount) ?? 0,
        CpuUsage = /* from metrics API or pod resource requests */,
        MemoryUsage = /* from metrics API */,
        Age = (DateTime.UtcNow - pod.Metadata.CreationTimestamp)?.ToString(@"d\d\ h\h") ?? "unknown",
        Node = pod.Spec.NodeName
    }).ToList();
}
```

### Prometheus PromQL Query
```csharp
// Source: Prometheus HTTP API documentation
public async Task<DashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken ct)
{
    var prometheusUrl = _configuration["Prometheus:Endpoint"] ?? "http://prometheus-business:9090";

    // Total throughput (records/sec over last 5 min)
    var throughput = await QueryPrometheusAsync(
        $"{prometheusUrl}/api/v1/query",
        "rate(business_records_processed_total[5m])", ct);

    // Average processing latency
    var latency = await QueryPrometheusAsync(
        $"{prometheusUrl}/api/v1/query",
        "histogram_quantile(0.95, rate(business_processing_duration_seconds_bucket[5m]))", ct);

    return new DashboardMetricsDto { /* map results */ };
}

private async Task<JsonElement> QueryPrometheusAsync(string baseUrl, string query, CancellationToken ct)
{
    var url = $"{baseUrl}?query={Uri.EscapeDataString(query)}";
    var response = await _httpClient.GetFromJsonAsync<JsonElement>(url, ct);
    return response;
}
```

### CORS Configuration for SignalR
```csharp
// Source: file-simulator Program.cs CORS pattern
services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
                new Uri(origin).Host is "localhost" or "127.0.0.1")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Required for SignalR WebSocket
    });
});
```

### SignalR Registration in Program.cs
```csharp
// Source: file-simulator Program.cs lines 37-53, 158-162
// In service registration:
builder.Services.AddSignalR();
builder.Services.AddHostedService<MonitoringBroadcaster>();

// In middleware pipeline (after UseRouting, before MapControllers):
app.MapHub<MonitoringHub>("/hubs/monitoring");
```

### RBAC Extension for Monitoring
```yaml
# Add to existing nas-resource-manager Role rules:
  - apiGroups: [""]
    resources: ["pods", "services", "endpoints"]
    verbs: ["get", "list"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods"]
    verbs: ["get", "list"]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock data generators + setInterval | SignalR push + polling fallback | This phase | Real monitoring data, no refresh needed |
| React Query polling only | SignalR primary + React Query fallback | This phase | Sub-second updates vs 15s polling |
| `AllowAnyOrigin()` CORS | `SetIsOriginAllowed()` with `AllowCredentials()` | Required for SignalR | Existing CORS policy must change |

**Deprecated/outdated:**
- `monitoring-mock-data.ts`: Will be deleted (replaced by real data)
- `kubernetes-mock-data.ts`: Will be deleted (replaced by real data)
- 30s `setInterval` in SystemMonitoring.tsx: Replaced by SignalR events

## Discretion Recommendations

Based on research, here are recommendations for Claude's discretion areas:

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| Hub route path | `/hubs/monitoring` | Consistent with file-simulator pattern (`/hubs/status`, `/hubs/metrics`), clean namespace |
| Reconnection delays | `[0, 2000, 5000, 10000, 30000]` | Exact same as file-simulator, proven in production |
| Initial state snapshot | YES, send on connect | File-simulator's FileEventsHub does this; prevents blank page until first broadcast tick |
| Frontend hook design | Single `useMonitoringHub` hook returning all event data | One connection, simpler than per-domain hooks, matches file-simulator pattern |
| Kafka queue stats | `Confluent.Kafka.AdminClient` with `ListConsumerGroupOffsetsAsync` | Already in project (v2.12.0), official API for consumer lag |
| CORS | Modify existing `AllowAll` policy to use `SetIsOriginAllowed` + `AllowCredentials` | Required for SignalR WebSocket; file-simulator pattern proven |
| PromQL queries | Use business Prometheus (port 9091) for pipeline metrics, system Prometheus (port 9090) for infrastructure | Matches dual Prometheus architecture documented in CLAUDE.md |
| K8s RBAC | Extend existing `nas-resource-manager` Role | Service account already exists, just add pod/service/endpoint permissions |

## Open Questions

1. **Metrics API availability in Minikube**
   - What we know: `metrics.k8s.io` API requires metrics-server addon in Minikube
   - What's unclear: Whether metrics-server is enabled on the dev cluster
   - Recommendation: Check with `minikube addons list`; if disabled, use pod resource requests as fallback for CPU/memory display

2. **Kafka AdminClient connection in-cluster**
   - What we know: Kafka internal listener is on port 9092 (pod-to-pod), external on 9094
   - What's unclear: Whether AdminClient from DataSourceManagement pod can reach Kafka on 9092
   - Recommendation: Use `kafka:9092` (internal) since both pods are in same cluster; fall back to ConfigMap `kafka-server` value

3. **Jaeger API for trace summaries**
   - What we know: Jaeger UI is at port 16686
   - What's unclear: Exact Jaeger query API format for recent trace summaries
   - Recommendation: Use Jaeger HTTP API `/api/traces?service=<name>&limit=10` — well-documented REST API

## Sources

### Primary (HIGH confidence)
- File-simulator source code: `ServerStatusHub.cs`, `ServerStatusBroadcaster.cs`, `useSignalR.ts`, `Program.cs` — Working reference implementation
- EZ Platform source code: `Program.cs`, `DeviceHealthService.cs`, `SystemMonitoring.tsx`, `vite.config.ts` — Current implementation to extend
- `Directory.Packages.props` — Package versions confirmed
- `nas-device-rbac.yaml` — Existing RBAC to extend

### Secondary (MEDIUM confidence)
- ASP.NET Core SignalR documentation — CORS + credentials requirement
- Prometheus HTTP API documentation — PromQL query endpoint format

### Tertiary (LOW confidence)
- Minikube metrics-server addon availability — needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages already in project, no new dependencies
- Architecture: HIGH - File-simulator provides battle-tested reference implementation
- Pitfalls: HIGH - CORS issue documented in file-simulator code; DI scoping already handled in DeviceHealthService
- K8s/Prometheus integration: MEDIUM - Queries straightforward but runtime environment (metrics-server, Kafka connectivity) needs verification

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack, no moving targets)

---
phase: 16-signalr-realtime-updates
verified: 2026-03-16T17:00:00Z
status: gaps_found
score: 12/14 must-haves verified
re_verification: false
gaps:
  - truth: "TraceUpdate event delivers distributed trace data to the frontend"
    status: partial
    reason: "Type mismatch between backend (sends List<TraceDto>) and frontend hook (expects single object). TraceUpdate handler calls mapDistributedTrace(raw) where raw is an array, not a single trace. InitialState handler uses raw.Trace (singular) but MonitoringInitialState field is Traces (plural list)."
    artifacts:
      - path: "src/Frontend/src/hooks/useMonitoringHub.ts"
        issue: "TraceUpdate handler: `setTrace(raw ? mapDistributedTrace(raw) : null)` — raw is List<TraceDto>, not a single TraceDto. InitialState: checks `raw.Trace` but backend sends `raw.Traces`."
      - path: "src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs"
        issue: "Sends `TraceUpdate` with List<TraceDto> (line 152), and MonitoringInitialState.Traces is also List<TraceDto>."
    missing:
      - "Fix useMonitoringHub.ts TraceUpdate handler: receive array, take first item (or null if empty): `setTrace(Array.isArray(raw) && raw.length > 0 ? mapDistributedTrace(raw[0]) : null)`"
      - "Fix useMonitoringHub.ts InitialState handler: change `raw.Trace` to `raw.Traces` and take first element: `if (raw.Traces?.length) setTrace(mapDistributedTrace(raw.Traces[0]))`"
human_verification:
  - test: "Open System Monitoring page and verify connection dot shows green after a few seconds"
    expected: "Green pulsing dot visible in ClusterHeader next to Last Update, indicating live SignalR connection"
    why_human: "Requires live backend + Kubernetes cluster running with port-forward active"
  - test: "Watch System Monitoring page for 30 seconds without refreshing"
    expected: "Device health section refreshes every ~5s, service/pod/metrics sections refresh every ~30s, all without page reload"
    why_human: "Real-time behavior requires running cluster and SignalR connection"
  - test: "Disconnect network/stop port-forward, observe frontend"
    expected: "Dot turns yellow/red, warning toast appears, DeviceHealthTab falls back to 15s polling"
    why_human: "Requires manual network disruption in live environment"
---

# Phase 16: SignalR Real-Time Updates — Verification Report

**Phase Goal:** Enable real-time updates on System Monitoring page via SignalR
**Requirement:** MON-07 — SignalR real-time updates on System Monitoring page (reference file-simulator-suite patterns)
**Verified:** 2026-03-16T17:00:00Z
**Status:** gaps_found — 1 gap (trace type mismatch)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | SignalR hub accepts WebSocket connections at /hubs/monitoring | VERIFIED | MonitoringHub.cs has `class MonitoringHub : Hub`; Program.cs has `app.MapHub<MonitoringHub>("/hubs/monitoring")` at line 398 |
| 2  | Broadcaster pushes DeviceHealthUpdate every 5 seconds with real health data | VERIFIED | MonitoringBroadcaster.cs: `RunHealthBroadcastLoop` with `_healthInterval = TimeSpan.FromSeconds(5)` calls `IDeviceHealthService.GetHealthStatusAsync` then broadcasts `DeviceHealthUpdate` |
| 3  | Broadcaster pushes ServiceStatusUpdate, PodStatusUpdate, QueueStatusUpdate, MetricsUpdate, AlertUpdate, TraceUpdate every 30 seconds with real K8s/Prometheus data | VERIFIED | MonitoringBroadcaster.cs: `RunInfrastructureBroadcastLoop` at `_infraInterval = 30s`, broadcasts all 6 events in parallel via real K8s/Prometheus/Kafka service calls |
| 4  | PipelineEventConsumer listens to MassTransit pipeline messages and pushes PipelineEventUpdate to SignalR in real-time | VERIFIED | PipelineEventConsumer.cs implements IConsumer for all 4 message types; calls `_broadcaster.AddPipelineEvent()` which immediately broadcasts `PipelineEventUpdate` |
| 5  | MetricsUpdate includes ThroughputHistory, LatencyHistory, ErrorHistory with 30 data points from Prometheus range queries | VERIFIED | PrometheusQueryService.cs: `QueryRangeAsync` using `/api/v1/query_range` with 30-min window, step=60s; DashboardMetricsDto has all 3 history lists |
| 6  | Initial state snapshot sent to newly connected clients | VERIFIED | MonitoringHub.cs `OnConnectedAsync`: calls `_broadcaster.GetLatestState()` and sends `InitialState` to caller; frontend hook handles `InitialState` event |
| 7  | CORS configured to allow credentials for SignalR WebSocket transport | VERIFIED | Program.cs: `SetIsOriginAllowed` with known IPs + `.AllowCredentials()` replacing old `AllowAnyOrigin` |
| 8  | Frontend connects to SignalR hub and receives real-time monitoring data | VERIFIED | useMonitoringHub.ts: `HubConnectionBuilder().withUrl(hubUrl).withAutomaticReconnect([0,2000,5000,10000,30000])`, handlers for all 8 event types |
| 9  | Connection status badge shows green/yellow/red in ClusterHeader | VERIFIED | ClusterHeader.tsx: `connection-dot` span with dynamic CSS class (`connection-dot-connected/reconnecting/disconnected`), Tooltip with i18n text |
| 10 | Mock data generators are replaced with SignalR push data | VERIFIED | SystemMonitoring.tsx: no `monitoring-mock-data` or `kubernetes-mock-data` imports; uses `useMonitoringHub` hook |
| 11 | DeviceHealthTab falls back to React Query polling when SignalR disconnects | VERIFIED | DeviceHealthTab.tsx: `refetchInterval: isSignalRConnected ? false : 15000`, `enabled: !isSignalRConnected` |
| 12 | Toast notifications appear on connection loss and restoration | VERIFIED | useMonitoringHub.ts: `onreconnecting` shows `message.warning(t('monitoring.connection.lost'))`, `onreconnected` shows `message.success(t('monitoring.connection.restored'))` |
| 13 | Hebrew translations exist for all connection state strings | VERIFIED | he.json lines 705-714: all 9 connection keys present with Hebrew text |
| 14 | TraceUpdate event delivers distributed trace data to the frontend | FAILED | Backend sends `List<TraceDto>` (array), frontend hook calls `mapDistributedTrace(raw)` expecting single object. InitialState checks `raw.Trace` but field is `raw.Traces`. Trace tab will never display SignalR data. |

**Score:** 13/14 truths verified (1 partial gap on trace delivery)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs` | SignalR hub with connection lifecycle and initial state | VERIFIED | `class MonitoringHub : Hub`, `OnConnectedAsync`, `OnDisconnectedAsync`, sends `InitialState` snapshot |
| `src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs` | BackgroundService with dual-speed broadcast loops | VERIFIED | `class MonitoringBroadcaster : BackgroundService`, `RunHealthBroadcastLoop`, `RunInfrastructureBroadcastLoop`, `AddPipelineEvent`, `IHubContext<MonitoringHub>`, `CreateScope` |
| `src/Services/DataSourceManagementService/Models/MonitoringModels.cs` | DTOs for all 7 SignalR event types | VERIFIED | `ServiceStatusDto`, `PodStatusDto`, `DashboardMetricsDto`, `QueueStatusDto`, `AlertDto`, `TraceDto`, `MonitoringInitialState`, `PipelineEventDto`, `MetricDataPointDto`, `ThroughputHistory`, `LatencyHistory`, `ErrorHistory` all present |
| `src/Services/DataSourceManagementService/Services/KubernetesMonitoringService.cs` | K8s API queries for pods, services | VERIFIED | `ListNamespacedPodAsync`, `ListNamespacedEndpointsAsync`, `class KubernetesMonitoringService` |
| `src/Services/DataSourceManagementService/Consumers/PipelineEventConsumer.cs` | MassTransit consumer for pipeline events -> SignalR broadcast | VERIFIED | `class PipelineEventConsumer`, `IConsumer<FileDiscoveredEvent>`, `IConsumer<ValidationCompletedEvent>`, `IConsumer<FileProcessingFailedEvent>`, `IConsumer<FileProcessingCompletedEvent>` |
| `src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs` | Prometheus PromQL HTTP API client with instant + range queries | VERIFIED | `api/v1/query_range`, `api/v1/query`, `class PrometheusQueryService`, Jaeger trace fetching |
| `src/Frontend/src/hooks/useMonitoringHub.ts` | Multi-event SignalR hook with connection state management | VERIFIED | `export function useMonitoringHub`, `HubConnectionBuilder`, `withAutomaticReconnect`, `isMountedRef`, all 8 event handlers including `InitialState` |
| `src/Frontend/src/pages/monitoring/SystemMonitoring.tsx` | Monitoring page wired to SignalR data | VERIFIED | Imports `useMonitoringHub`, no mock data imports, passes `connectionState` to ClusterHeader |
| `src/Frontend/src/pages/monitoring/components/ClusterHeader.tsx` | Connection status dot badge | VERIFIED | `connectionState` prop, `connection-dot` class, `Tooltip` from antd |
| `src/Frontend/src/pages/monitoring/SystemMonitoring.css` | Connection dot styles with pulse animation | VERIFIED | `connectionPulse` keyframe, `connection-dot-connected`, `connection-dot-reconnecting`, `connection-dot-disconnected` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| MonitoringBroadcaster.cs | MonitoringHub | `IHubContext<MonitoringHub>` | WIRED | Constructor injects `IHubContext<MonitoringHub> hubContext`, used in all broadcast calls |
| MonitoringBroadcaster.cs | DeviceHealthService | `IServiceProvider.CreateScope` | WIRED | `RunHealthBroadcastLoop` calls `_serviceProvider.CreateScope()` then resolves `IDeviceHealthService` |
| Program.cs | MonitoringHub | `MapHub<MonitoringHub>` | WIRED | Line 398: `app.MapHub<MonitoringHub>("/hubs/monitoring")` |
| useMonitoringHub.ts | /hubs/monitoring | `HubConnectionBuilder.withUrl` | WIRED | `new signalR.HubConnectionBuilder().withUrl(hubUrl)` where hubUrl includes `/hubs/monitoring` |
| SystemMonitoring.tsx | useMonitoringHub.ts | hook import | WIRED | `import { useMonitoringHub } from '../../hooks/useMonitoringHub'` |
| DeviceHealthTab.tsx | useDeviceHealthStatus | `refetchInterval` conditional | WIRED | `refetchInterval: isSignalRConnected ? false : 15000`, `enabled: !isSignalRConnected` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MON-07 | 16-01, 16-02 | SignalR real-time updates on System Monitoring page (reference file-simulator-suite patterns) | SATISFIED (with gap) | SignalR backend operational, frontend hook connected, 6 of 7 event types fully functional. Trace delivery has type mismatch (minor degradation, not a blocker for the main goal). |

No orphaned requirements found — MON-07 is the only requirement mapped to Phase 16 in REQUIREMENTS.md.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/Frontend/src/hooks/useMonitoringHub.ts` | 242-244 | `TraceUpdate` handler calls `mapDistributedTrace(raw)` where `raw` will be an array (backend sends `List<TraceDto>`). Array passed to mapper will silently produce `traceId: undefined`. | Warning | Distributed Tracing tab never shows SignalR data; remains blank after connection |
| `src/Frontend/src/hooks/useMonitoringHub.ts` | 262 | `InitialState` handler checks `raw.Trace` (singular) but `MonitoringInitialState.Traces` is the actual field (plural). Condition always false. | Warning | Trace data from initial snapshot also never restored |

No blocker anti-patterns found. The trace mismatch is a functional gap in one feature (Distributed Tracing tab) but does not prevent the phase goal from being largely achieved.

---

## Human Verification Required

### 1. Live Connection Badge

**Test:** Start port-forwards and open System Monitoring page at http://localhost:7000
**Expected:** After 2-3 seconds, a green pulsing dot appears in ClusterHeader next to the Last Update timestamp
**Why human:** Requires live Kubernetes cluster and SignalR WebSocket upgrade through Vite proxy

### 2. Real-Time Data Refresh

**Test:** Watch the monitoring page for 60 seconds with DevTools Network tab open
**Expected:** WebSocket messages arrive every ~5s (DeviceHealthUpdate) and every ~30s (ServiceStatusUpdate, PodStatusUpdate, MetricsUpdate, etc.) without page refresh
**Why human:** Requires running cluster, cannot verify timing programmatically

### 3. Connection Failure Graceful Degradation

**Test:** Stop port-forwarding (`taskkill /F /IM kubectl.exe`) while System Monitoring page is open
**Expected:** Dot turns yellow/amber, warning toast "Real-time connection lost. Switching to periodic refresh." appears, DeviceHealthTab continues updating every 15s
**Why human:** Requires manual network disruption in live environment

---

## Gaps Summary

One gap found: **Trace type mismatch** between backend and frontend.

The backend `MonitoringBroadcaster` sends `TraceUpdate` with `List<TraceDto>` (an array). The frontend hook's `TraceUpdate` handler treats the received data as a single `DistributedTrace` object, passing the array directly to `mapDistributedTrace()`. This results in `traceId: undefined` and the Distributed Tracing tab displaying nothing from SignalR.

The same issue affects the `InitialState` handler, which checks `raw.Trace` (singular) while the actual field name is `raw.Traces` (plural list).

**Root cause:** Plan 16-01 defined `GetRecentTracesAsync` returning `List<TraceDto>` but Plan 16-02's hook spec used a single `trace: DistributedTrace | null` state. The field name also diverged (`Traces` vs `Trace`).

**Fix required** (two-line change in `useMonitoringHub.ts`):
- `TraceUpdate`: `setTrace(Array.isArray(raw) && raw.length > 0 ? mapDistributedTrace(raw[0]) : null)`
- `InitialState`: change `raw.Trace` to `raw.Traces` and take `[0]`

All other 13/14 must-haves are fully verified. The SignalR hub, broadcaster, all 6 non-trace event types, frontend hook, connection badge, polling fallback, toasts, translations, and Vite proxy are all substantively implemented and correctly wired. The backend compiles clean (0 errors). All 4 documented commits exist in git history.

---

_Verified: 2026-03-16T17:00:00Z_
_Verifier: Claude (gsd-verifier)_

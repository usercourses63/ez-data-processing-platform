# Phase 16: SignalR Real-Time Updates - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable real-time updates on the System Monitoring page via SignalR. Replace all mock data generators AND React Query polling with SignalR push events for every monitoring tab (device health, services, pods, queues, alerts, traces, metrics). A single MonitoringHub in DataSourceManagement broadcasts all monitoring data. Frontend connects via `@microsoft/signalr` (already installed) with automatic reconnection and polling fallback.

</domain>

<decisions>
## Implementation Decisions

### Hub scope
- **All monitoring data** flows through SignalR — not just device health
- Replace ALL mock data generators (monitoring-mock-data, kubernetes-mock-data) with real data from K8s API + Prometheus + existing health checks
- Single hub (`MonitoringHub`) with multiple event names:
  - `DeviceHealthUpdate` — NAS device + AdminServer health status (from Phase 15 health checks)
  - `ServiceStatusUpdate` — microservice health/status from K8s pod readiness
  - `PodStatusUpdate` — pod status, restart counts, resource usage from K8s API
  - `QueueStatusUpdate` — Kafka topic/consumer group stats
  - `MetricsUpdate` — pipeline throughput, latency from Prometheus PromQL
  - `AlertUpdate` — active alerts from Prometheus/Grafana alert rules
  - `TraceUpdate` — recent distributed traces summary

### Connection UX
- Status badge in ClusterHeader near last-update timestamp: green dot = connected, yellow = reconnecting, red = disconnected
- No reconnect attempt counter shown — just the badge color change
- Auto-fallback to React Query polling (15s) when SignalR disconnects; stop polling when SignalR reconnects
- Use file-simulator's `isMountedRef` pattern to prevent stale state updates on unmount

### Update strategy
- Timer-based broadcasting from a background service (like file-simulator's `ServerStatusBroadcaster`)
- **Device health: every 5 seconds** — broadcasts cached health check results (Quartz.NET checks run every 30s, broadcaster sends cached state)
- **K8s infrastructure data: every 30 seconds** — pods, services, queues queried at lower frequency since K8s resources change slowly
- **Prometheus metrics: every 30 seconds** — PromQL range queries for charts/throughput
- Frontend receives both fast (5s) and slow (30s) events and updates UI accordingly

### Hub placement
- **DataSourceManagement** hosts the SignalR hub — already owns health checks, device data, and health-status API
- No new microservice needed
- KubernetesClient NuGet package for K8s API queries (already used for NAS PV/PVC provisioning)
- Prometheus PromQL HTTP API (`http://prometheus:9090/api/v1/query`) for metrics — direct HttpClient calls, no extra packages
- Single `IHostedService` background worker manages both broadcast loops (5s health + 30s infrastructure)

### Claude's Discretion
- Exact SignalR hub route path (e.g., `/hubs/monitoring`)
- Reconnection retry delay pattern (file-simulator uses [0, 2000, 5000, 10000, 30000])
- Whether to send initial state snapshot on client connect (file-simulator's FileEventsHub pattern)
- PromQL query design for dashboard metrics
- K8s service account RBAC configuration for pod/service listing
- CORS configuration for SignalR WebSocket connections
- Frontend hook design (single generic `useMonitoringHub` vs per-domain hooks)
- Exact Kafka admin client approach for queue stats

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### File-Simulator Reference Implementation
- `C:\Users\UserC\source\repos\file-simulator-suite\src\FileSimulator.ControlApi\Hubs\ServerStatusHub.cs` — Hub pattern with connection lifecycle logging
- `C:\Users\UserC\source\repos\file-simulator-suite\src\FileSimulator.ControlApi\Services\ServerStatusBroadcaster.cs` — Background service broadcasting pattern (5s loop, state-change optimization)
- `C:\Users\UserC\source\repos\file-simulator-suite\src\FileSimulator.ControlApi\Program.cs` — SignalR registration and hub mapping (lines 37-53, 158-162)
- `C:\Users\UserC\source\repos\file-simulator-suite\src\dashboard\src\hooks\useSignalR.ts` — Generic SignalR hook with reconnection, mounted ref pattern
- `C:\Users\UserC\source\repos\file-simulator-suite\src\dashboard\src\hooks\useMetricsStream.ts` — Circular buffer pattern for rolling metrics
- `C:\Users\UserC\source\repos\file-simulator-suite\src\dashboard\src\App.tsx` — Multi-hub connection integration example

### EZ Platform Existing Code
- `src/Services/DataSourceManagementService/` — Hub host service (health checks, Quartz.NET, K8s client already configured)
- `src/Frontend/src/pages/monitoring/SystemMonitoring.tsx` — Current monitoring page (mock data, 6 tabs)
- `src/Frontend/src/services/health-status-api-client.ts` — React Query polling pattern to replace/augment with SignalR
- `src/Frontend/src/services/monitoring-mock-data.ts` — Mock generators to replace with real SignalR data
- `src/Frontend/src/services/kubernetes-mock-data.ts` — Mock generators to replace with real K8s data
- `src/Frontend/src/pages/monitoring/components/DeviceHealthTab.tsx` — Existing real health data component

### Requirements
- `.planning/REQUIREMENTS.md` — MON-07: SignalR real-time updates on System Monitoring page

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@microsoft/signalr` v7.0.11: Already in frontend package.json, unused — ready to import
- `KubernetesClient` NuGet: Already used in DataSourceManagement for NAS PV/PVC provisioning — extend for pod/service queries
- `Quartz.NET` health check jobs: Phase 15 health check scheduler — broadcaster reads cached results from these jobs
- `DeviceHealthTab` component: Already displays real health data with status cards — pattern to replicate for other tabs
- `useDeviceHealthStatus` React Query hook: Pattern for polling fallback when SignalR disconnects
- `ClusterHeader` component: Already shows lastUpdate timestamp — add connection status badge here

### Established Patterns
- Backend: `IHostedService` background workers (used in Shared project for various background tasks)
- Backend: `DataProcessingMetrics.ActivitySource` for OpenTelemetry tracing — use in broadcaster
- Frontend: React Query for data fetching with `refetchInterval` — keep as fallback mechanism
- Frontend: Ant Design status badges/tags — use for connection state indicator
- Frontend: i18next translations — add Hebrew translations for connection states

### Integration Points
- `Program.cs` in DataSourceManagement: Add `builder.Services.AddSignalR()` and `app.MapHub<MonitoringHub>()`
- `SystemMonitoring.tsx`: Replace mock data `useState` + `setInterval` with SignalR hook data
- K8s ConfigMap: Add Prometheus endpoint URL as environment variable (already in services-config.yaml as `prometheus-endpoint`)
- K8s RBAC: Service account needs `get`/`list` permissions on pods, services, endpoints in ez-platform namespace
- Frontend Vite config: May need proxy configuration for SignalR WebSocket during development

</code_context>

<specifics>
## Specific Ideas

- Reference file-simulator's proven SignalR patterns — same team built both projects, keep consistency
- file-simulator uses `withAutomaticReconnect([0, 2000, 5000, 10000, 30000])` — same retry strategy recommended
- file-simulator's `isMountedRef` pattern prevents React state update warnings on unmount — adopt this
- file-simulator broadcasts mount health only on state change — consider similar optimization for device health (broadcast full state every 5s but only log/alert on change)

</specifics>

<deferred>
## Deferred Ideas

- **Redis backplane for multi-pod SignalR scaling** — Tracked as HA-01 in v0.3 requirements. Single-pod sufficient for v0.2.
- **Kafka topic message streaming via SignalR** — file-simulator has KafkaHub with topic subscription. Out of scope for monitoring page.
- **Alert notifications via SignalR** — Could push Prometheus alerts to UI in real-time. Consider for future enhancement.

</deferred>

---

*Phase: 16-signalr-realtime-updates*
*Context gathered: 2026-03-16*

---
phase: 16-signalr-realtime-updates
plan: 01
subsystem: api
tags: [signalr, websocket, kubernetes, prometheus, kafka, monitoring, real-time]

# Dependency graph
requires:
  - phase: 15-device-health-monitoring
    provides: IDeviceHealthService for health data broadcasting
provides:
  - SignalR MonitoringHub at /hubs/monitoring
  - MonitoringBroadcaster BackgroundService with dual-speed broadcast loops
  - K8s, Prometheus, Kafka monitoring data services
  - PipelineEventConsumer for real-time MassTransit event broadcasting
  - 11 monitoring DTOs (PascalCase) for 7 SignalR event types
affects: [16-signalr-realtime-updates, frontend-monitoring-page]

# Tech tracking
tech-stack:
  added: [Microsoft.AspNetCore.SignalR]
  patterns: [dual-speed BackgroundService broadcast, singleton-hosted-service pattern, IHubContext injection]

key-files:
  created:
    - src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs
    - src/Services/DataSourceManagementService/Models/MonitoringModels.cs
    - src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs
    - src/Services/DataSourceManagementService/Services/IKubernetesMonitoringService.cs
    - src/Services/DataSourceManagementService/Services/KubernetesMonitoringService.cs
    - src/Services/DataSourceManagementService/Services/IPrometheusQueryService.cs
    - src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs
    - src/Services/DataSourceManagementService/Services/IKafkaMonitoringService.cs
    - src/Services/DataSourceManagementService/Services/KafkaMonitoringService.cs
    - src/Services/DataSourceManagementService/Consumers/PipelineEventConsumer.cs
  modified:
    - src/Services/DataSourceManagementService/Program.cs
    - k8s/rbac/nas-device-rbac.yaml

key-decisions:
  - "Singleton + AddHostedService pattern for MonitoringBroadcaster (same instance injected into hub)"
  - "CORS updated from AllowAnyOrigin to SetIsOriginAllowed + AllowCredentials for SignalR WebSocket"
  - "Dual-speed broadcast: 5s for device health, 30s for infrastructure metrics"
  - "Short-lived Kafka AdminClient per call to avoid connection lifecycle issues"

patterns-established:
  - "Singleton BackgroundService broadcaster + IHubContext for SignalR push"
  - "MassTransit consumer -> SignalR broadcast via shared broadcaster instance"
  - "Prometheus HTTP API instant + range query pattern with graceful degradation"

requirements-completed: [MON-07]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 16 Plan 01: SignalR Backend Summary

**SignalR hub at /hubs/monitoring with dual-speed broadcaster pushing 7 event types from K8s API, Prometheus PromQL, Kafka admin, and device health services**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T16:09:07Z
- **Completed:** 2026-03-16T16:15:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- MonitoringHub SignalR endpoint at /hubs/monitoring with initial state snapshot on connect
- MonitoringBroadcaster BackgroundService with 5s health + 30s infrastructure broadcast loops
- KubernetesMonitoringService querying K8s API for pods, services, endpoints, cluster info
- PrometheusQueryService with instant + range PromQL queries and Jaeger trace fetching
- KafkaMonitoringService using AdminClient for topic metadata
- PipelineEventConsumer broadcasting MassTransit events (FileDiscovered, ValidationCompleted, ProcessingFailed, ProcessingCompleted) to SignalR in real-time
- CORS updated for WebSocket credential support
- K8s RBAC extended with pods/services/endpoints read permissions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MonitoringHub, MonitoringModels, and all monitoring data services** - `b954e48` (feat)
2. **Task 2: Create MonitoringBroadcaster, wire DI + CORS + RBAC** - `be8b567` (feat)

## Files Created/Modified
- `src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs` - SignalR hub with connection lifecycle and initial state
- `src/Services/DataSourceManagementService/Models/MonitoringModels.cs` - 11 DTOs for all monitoring event types
- `src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs` - BackgroundService with dual-speed broadcast
- `src/Services/DataSourceManagementService/Services/IKubernetesMonitoringService.cs` - K8s monitoring interface
- `src/Services/DataSourceManagementService/Services/KubernetesMonitoringService.cs` - K8s API queries for pods/services/cluster
- `src/Services/DataSourceManagementService/Services/IPrometheusQueryService.cs` - Prometheus query interface
- `src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs` - PromQL instant + range queries, Jaeger traces
- `src/Services/DataSourceManagementService/Services/IKafkaMonitoringService.cs` - Kafka monitoring interface
- `src/Services/DataSourceManagementService/Services/KafkaMonitoringService.cs` - Kafka AdminClient topic metadata
- `src/Services/DataSourceManagementService/Consumers/PipelineEventConsumer.cs` - MassTransit consumer -> SignalR broadcast
- `src/Services/DataSourceManagementService/Program.cs` - SignalR, monitoring services DI, CORS, hub mapping
- `k8s/rbac/nas-device-rbac.yaml` - Extended with pod/service/endpoint read permissions

## Decisions Made
- Singleton + AddHostedService pattern for MonitoringBroadcaster ensures hub and broadcaster share the same instance
- CORS changed from AllowAnyOrigin to SetIsOriginAllowed with known IPs + AllowCredentials (SignalR requirement)
- Dual-speed broadcast (5s health, 30s infra) balances responsiveness with API load
- Short-lived Kafka AdminClient per call avoids connection lifecycle issues in singleton context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed IDictionary GetValueOrDefault compilation error**
- **Found during:** Task 1 (KubernetesMonitoringService)
- **Issue:** `IDictionary<string, string>` from K8s client doesn't support `GetValueOrDefault` extension
- **Fix:** Changed to explicit `TryGetValue` pattern
- **Files modified:** KubernetesMonitoringService.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** b954e48 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor compilation fix, no scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SignalR backend fully wired and compiling
- Ready for Plan 02: Frontend SignalR client integration
- All 7 event types + InitialState snapshot operational
- K8s RBAC ready for pod/service monitoring

---
*Phase: 16-signalr-realtime-updates*
*Completed: 2026-03-16*

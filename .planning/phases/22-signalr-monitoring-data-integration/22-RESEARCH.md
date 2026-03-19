# Phase 22: SignalR Monitoring Data Integration - Research

**Researched:** 2026-03-19
**Domain:** SignalR real-time monitoring, K8s RBAC, optimistic locking, multi-user CRUD broadcast
**Confidence:** HIGH

## Summary

Phase 22 addresses three distinct concerns: (1) making the five existing backend monitoring services return real data instead of silently failing, (2) removing mock data from the frontend once real data flows, and (3) adding multi-user CRUD broadcast with optimistic locking via SignalR. The infrastructure is already well-built from Phase 16 -- MonitoringHub, MonitoringBroadcaster, useMonitoringHub hook, and PipelineEventConsumer are all wired up and functional. The primary blocker is RBAC: the datasource-management deployment has no `serviceAccountName` in the Helm template, so the Kubernetes API calls return empty results due to permission denial. Secondary issues are missing env var mappings for Prometheus/Jaeger/Kafka config keys.

The optimistic locking infrastructure is partially in place: `DataProcessingBaseEntity` already has a `Version` field (type `long`, starts at 1) with a `MarkAsModified()` method that increments it. However, the update request DTOs (`UpdateDataSourceRequest`, `UpdateNasDeviceRequest`) do NOT include a Version field, and the controllers do not inject `IHubContext<MonitoringHub>` for CRUD broadcast. Both need to be added.

**Primary recommendation:** Fix RBAC and config mapping first (unblocks all 5 monitoring services at once), then add CRUD broadcast + optimistic locking to controllers, then remove mocks and add skeleton loading.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- RBAC fix is highest priority -- add ServiceAccount, ClusterRole, Role, Bindings to Helm chart; set serviceAccountName on datasource-management deployment
- Debug order: RBAC first, then K8s, Prometheus, Kafka, Jaeger, PipelineEventConsumer in sequence
- Kafka bootstrap: `kafka:9092` (INTERNAL listener) is correct for in-cluster AdminClient
- Mock removal is a hard cutover -- delete both mock files entirely, no fallback retention
- Show Ant Design loading skeleton until first SignalR broadcast, then real data replaces skeleton
- If SignalR disconnects after initial load: show last-known data (cached in React state)
- Multi-user real-time synchronization via SignalR CRUD broadcast (all connected clients receive notifications on create/update/delete)
- Optimistic locking using existing `Version` field -- HTTP 409 Conflict on version mismatch, no pessimistic locking, no last-write-wins

### Claude's Discretion
- Exact Helm template file structure for RBAC resources (single vs. multiple files)
- Skeleton component choice (Ant Design Skeleton.Input vs custom per-tab)
- Log level for MonitoringBroadcaster cycle output
- SignalR event names for CRUD notifications
- Whether to extend MonitoringHub or create a separate NotificationHub for CRUD events

### Deferred Ideas (OUT OF SCOPE)
- None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MON-08 | K8s monitoring service returns real pod/service status (fix RBAC binding, verify service account) | RBAC yaml exists at k8s/rbac/nas-device-rbac.yaml with correct permissions; Helm deployment template missing serviceAccountName; KubernetesMonitoringService code is correct, just needs RBAC |
| MON-09 | Prometheus PromQL queries return real metrics (verify metric names, range queries, connectivity) | PrometheusQueryService reads Prometheus:BusinessEndpoint, Prometheus:SystemEndpoint, Jaeger:Endpoint from IConfiguration; defaults are correct for in-cluster DNS; Helm template missing env var injection for these keys |
| MON-10 | Kafka AdminClient returns real queue depths and consumer lag (verify internal bootstrap connectivity) | KafkaMonitoringService reads Kafka:Brokers from IConfiguration; default kafka:9092 is correct; Helm template injects MassTransit__Kafka__Server and ConnectionStrings__Kafka but NOT Kafka__Brokers |
| MON-11 | Jaeger trace queries return real distributed traces (verify API endpoint and response parsing) | PrometheusQueryService.GetRecentTracesAsync queries Jaeger HTTP API at /api/traces; service name is jaeger on port 16686; code parsing looks correct |
| MON-12 | PipelineEventConsumer receives real MassTransit events and pushes to SignalR | Consumer is registered in Program.cs via MassTransit with RabbitMQ transport; code is complete; needs verification that RabbitMQ is delivering events |
| MON-13 | System Monitoring page displays real data from SignalR instead of mock fallback (all mock generators removable) | SystemMonitoring.tsx uses fallback pattern: signalR data preferred, mock as fallback; two mock files to delete; skeleton loading to add |
</phase_requirements>

## Standard Stack

### Core (Already In Use)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Microsoft.AspNetCore.SignalR | .NET 10 built-in | Real-time hub | Already registered in Program.cs |
| KubernetesClient (k8s) | via CPM | K8s API access | Already registered via AddKubernetesClient |
| Confluent.Kafka | via CPM | Kafka AdminClient | Already used in KafkaMonitoringService |
| MassTransit | via CPM | Message consumers | Already configured with RabbitMQ transport |
| @microsoft/signalr | via npm | Frontend hub client | Already used in useMonitoringHub.ts |
| Ant Design 5.x | via npm | UI components including Skeleton | Already in use |

No new libraries needed. All dependencies are already present.

## Architecture Patterns

### Existing Infrastructure (Phase 16 -- Working)

```
MonitoringBroadcaster (BackgroundService, Singleton)
  |-- 5s loop: DeviceHealthUpdate via IDeviceHealthService
  |-- 30s loop: 6 event types in parallel
  |     |-- ServiceStatusUpdate (IKubernetesMonitoringService)
  |     |-- PodStatusUpdate (IKubernetesMonitoringService)
  |     |-- QueueStatusUpdate (IKafkaMonitoringService)
  |     |-- MetricsUpdate (IPrometheusQueryService)
  |     |-- AlertUpdate (IPrometheusQueryService)
  |     |-- TraceUpdate (IPrometheusQueryService)
  |-- Caches latest state for InitialState on new connections

PipelineEventConsumer (MassTransit, Scoped)
  |-- Listens: FileDiscoveredEvent, ValidationCompletedEvent,
  |            FileProcessingFailedEvent, FileProcessingCompletedEvent
  |-- Pushes events to MonitoringBroadcaster.AddPipelineEvent()
  |-- Broadcasts immediately via PipelineEventUpdate

MonitoringHub (SignalR Hub)
  |-- OnConnectedAsync: sends InitialState snapshot
  |-- No server-callable methods currently

useMonitoringHub (Frontend React Hook)
  |-- Connects to /hubs/monitoring
  |-- Subscribes to 8 event types + InitialState
  |-- PascalCase -> camelCase mappers for all types
  |-- Automatic reconnection [0, 2s, 5s, 10s, 30s]
```

### Pattern: CRUD Broadcast via SignalR

```
Controller (CRUD operation)
  |-- Inject IHubContext<MonitoringHub>
  |-- After successful save: broadcast to all clients
  |-- Event: EntityChanged { entityType, entityId, action, version }
  |-- Clients receive event -> invalidate React Query cache
```

### Pattern: Optimistic Locking

```
Client reads entity (includes Version field in response)
  |
Client sends update (includes Version in request body)
  |
Controller/Service:
  1. Load entity from DB
  2. Compare entity.Version == request.Version
  3. If mismatch: return 409 Conflict { error, currentVersion, message }
  4. If match: entity.MarkAsModified() (increments Version), save
  5. Broadcast EntityChanged via SignalR
```

### Recommended Helm RBAC Structure

```
helm/ez-platform/templates/
  rbac.yaml                    # Single file: ServiceAccount + ClusterRole +
                               # ClusterRoleBinding + Role + RoleBinding
```

Single file is recommended because all 5 resources are tightly coupled and always deployed together. Port content directly from k8s/rbac/nas-device-rbac.yaml.

### Key Config Gap: Env Var Mapping

The datasource-management Helm deployment template is MISSING these env vars:

| Config Key (IConfiguration) | Env Var Name | Value Source | Default in Code |
|---|---|---|---|
| `Kafka:Brokers` | `Kafka__Brokers` | ConfigMap: kafka-server | `kafka:9092` (correct) |
| `Prometheus:BusinessEndpoint` | `Prometheus__BusinessEndpoint` | ConfigMap: prometheus-business-endpoint | `http://prometheus-business:9090` (correct) |
| `Prometheus:SystemEndpoint` | `Prometheus__SystemEndpoint` | ConfigMap: prometheus-endpoint | `http://prometheus-system:9090` (correct) |
| `Jaeger:Endpoint` | `Jaeger__Endpoint` | None in ConfigMap | `http://jaeger:16686` (correct) |

**The fallback defaults in the code are all correct for in-cluster DNS resolution.** The services will work without explicit env vars IF the in-cluster DNS names match. Based on the Helm templates:
- `kafka` service exists (kafka-service is the headless service, but `kafka-0.kafka-service` is the pod DNS)
- `prometheus-business` service exists on port 9090
- `prometheus-system` service exists on port 9090
- `jaeger` service exists on port 16686

**Risk:** The Kafka service name might be `kafka-service` not `kafka`. Need to verify. The code defaults to `kafka:9092` but the Helm StatefulSet headless service is named `kafka-service`. However, there may be a separate `kafka` ClusterIP service.

**Recommendation:** Add explicit env vars to Helm template for reliability. Use ConfigMap values where available; add new ConfigMap keys for Prometheus/Jaeger if missing.

### Anti-Patterns to Avoid
- **Removing mocks before all 5 services are verified working:** Do mock removal LAST, after confirming real data flows in all tabs
- **Adding Version to URL query params:** Version should be in the request body, not URL
- **Broadcasting before save completes:** Always broadcast AFTER the DB write succeeds, not before
- **Locking on read:** The decision explicitly says no pessimistic locking

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SignalR hub infrastructure | Custom WebSocket server | Existing MonitoringHub + IHubContext | Already built in Phase 16, battle-tested |
| K8s API client | Raw HTTP calls | KubernetesClient (k8s NuGet) | Already registered, handles auth/TLS |
| Prometheus query parsing | Custom HTTP + JSON parsing | Existing PrometheusQueryService | Already handles instant + range queries |
| Cache invalidation | Custom pub/sub system | React Query invalidation via SignalR events | queryClient.invalidateQueries() |
| Optimistic concurrency | Custom version tracking | Existing DataProcessingBaseEntity.Version + MarkAsModified() | Already increments version on save |

## Common Pitfalls

### Pitfall 1: RBAC ServiceAccount Not Bound to Deployment
**What goes wrong:** KubernetesMonitoringService returns empty lists silently (catches exception, returns `new List<>()`)
**Why it happens:** The datasource-management deployment has no `serviceAccountName` in its pod spec, so it uses the `default` ServiceAccount which has no K8s API permissions
**How to avoid:** Add `serviceAccountName: nas-device-manager` to the Helm deployment template AND create the RBAC resources in a Helm template
**Warning signs:** Pod/service lists empty, "Failed to get pod statuses" in datasource-management logs

### Pitfall 2: Kafka Bootstrap Server DNS Name Mismatch
**What goes wrong:** KafkaMonitoringService returns "unknown" for all topics
**Why it happens:** Code defaults to `kafka:9092` but the actual K8s service might be named `kafka-service`
**How to avoid:** Verify the actual Kafka service name in the cluster; add explicit `Kafka__Brokers` env var to Helm template using ConfigMap `kafka-server` value
**Warning signs:** "Failed to get Kafka queue statuses" in logs, socket timeout errors

### Pitfall 3: Prometheus Business Port Mismatch
**What goes wrong:** PrometheusQueryService code falls back to `http://prometheus-business:9090` -- the Helm ConfigMap uses port 9091 in the prometheus-business-endpoint value
**Root cause:** The ConfigMap defines `prometheus-business-endpoint` as pointing to port 9091, but the actual Prometheus business deployment listens on port 9090. The code's hardcoded fallback of 9090 is correct; the ConfigMap value might be wrong.
**How to avoid:** Verify the actual port (9090) and ensure consistency between ConfigMap and service definition
**Warning signs:** Empty metrics, "Prometheus instant query failed" warnings in logs

### Pitfall 4: Version Field Not in Update DTOs
**What goes wrong:** Optimistic locking cannot work because the client never sends the Version
**Why it happens:** `UpdateDataSourceRequest` and `UpdateNasDeviceRequest` don't have a Version property
**How to avoid:** Add `public long Version { get; set; }` to both request DTOs; add to frontend API payloads
**Warning signs:** 409 never returned, last-write-wins silently

### Pitfall 5: Mock Data Reference After Deletion
**What goes wrong:** Build breaks after deleting mock files
**Why it happens:** SystemMonitoring.tsx imports from both mock files; must remove all import statements and mock state variables
**How to avoid:** After deleting mock files, remove all imports and replace fallback pattern with skeleton loading
**Warning signs:** TypeScript compilation errors on missing modules

### Pitfall 6: SignalR Hub URL in Different Environments
**What goes wrong:** Frontend cannot connect to SignalR hub
**Why it happens:** SystemMonitoring.tsx constructs hubUrl from `window.location`, which works for same-origin but breaks if frontend is proxied to a different host
**How to avoid:** Current implementation already uses `${window.location.protocol}//${window.location.host}/hubs/monitoring` -- this is correct for the Kubernetes setup where frontend nginx proxies /hubs/ to the backend

## Code Examples

### Existing: MonitoringHub Initial State Delivery
```csharp
// Source: src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs
public override async Task OnConnectedAsync()
{
    var state = _broadcaster.GetLatestState();
    if (state != null)
        await Clients.Caller.SendAsync("InitialState", state);
    await base.OnConnectedAsync();
}
```

### Existing: DataProcessingBaseEntity Version Management
```csharp
// Source: src/Services/Shared/Entities/DataProcessingBaseEntity.cs
public long Version { get; set; } = 1;

public virtual void MarkAsModified(string modifiedBy = "System")
{
    UpdatedAt = DateTime.UtcNow;
    UpdatedBy = modifiedBy;
    Version++;
}
```

### Pattern: CRUD Broadcast After Save (To Implement)
```csharp
// Pattern for controllers to follow
private readonly IHubContext<MonitoringHub> _hubContext;

// After successful create/update/delete:
await _hubContext.Clients.All.SendAsync("EntityChanged", new
{
    EntityType = "DataSource",  // or "NasDevice"
    EntityId = entity.ID,
    Action = "updated",         // "created", "updated", "deleted"
    Version = entity.Version
});
```

### Pattern: Optimistic Lock Check (To Implement)
```csharp
// In service layer before save:
var existing = await DB.Find<DataProcessingDataSource>().OneAsync(id);
if (existing == null)
    return NotFound();

if (existing.Version != request.Version)
    return Conflict(new {
        error = "conflict",
        message = "הרשומה שונתה על ידי משתמש אחר. אנא רענן ונסה שוב.",
        currentVersion = existing.Version
    });

existing.MarkAsModified();  // Increments Version
// ... apply changes and save
```

### Pattern: Frontend React Query Invalidation (To Implement)
```typescript
// In useMonitoringHub.ts or a new useCrudNotifications hook:
connection.on('EntityChanged', (data: { EntityType: string; EntityId: string; Action: string }) => {
    // Invalidate React Query cache for the changed entity type
    queryClient.invalidateQueries({ queryKey: [data.EntityType.toLowerCase()] });
});
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 22) | Impact |
|------------------------|------------------------|--------|
| Mock data fallback in SystemMonitoring.tsx | Skeleton loading -> real SignalR data | Removes ~200 lines of mock generation code |
| No RBAC in Helm chart | RBAC resources as Helm template | Enables K8s API access for monitoring |
| No Version in update DTOs | Version field + 409 Conflict response | Prevents silent data overwrites |
| No CRUD broadcast | EntityChanged SignalR event | All clients see real-time updates |
| Silent empty returns on service errors | Verified real data with skeleton fallback | Transparent monitoring |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (frontend E2E) |
| Config file | `src/Frontend/playwright.config.ts` |
| Quick run command | `npx playwright test --grep @monitoring` |
| Full suite command | `npx playwright test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MON-08 | K8s pod/service status returns real data | manual + kubectl logs | `kubectl logs deployment/datasource-management -n ez-platform \| grep -i "infrastructure broadcast"` | N/A - log verification |
| MON-09 | Prometheus metrics return real data | manual + kubectl logs | `kubectl logs deployment/datasource-management -n ez-platform \| grep -i "prometheus"` | N/A - log verification |
| MON-10 | Kafka queue depths return real data | manual + kubectl logs | `kubectl logs deployment/datasource-management -n ez-platform \| grep -i "kafka"` | N/A - log verification |
| MON-11 | Jaeger traces return real data | manual + kubectl logs | `kubectl logs deployment/datasource-management -n ez-platform \| grep -i "jaeger\|trace"` | N/A - log verification |
| MON-12 | Pipeline events flow through SignalR | manual | Process a file and check UI event stream | N/A |
| MON-13 | Mock data removed, skeleton loading works | unit/build | `cd src/Frontend && npx tsc --noEmit` | N/A - compilation check |

### Sampling Rate
- **Per task commit:** `kubectl logs deployment/datasource-management -n ez-platform --tail=50` to verify broadcasts
- **Per wave merge:** Helm deploy + verify all monitoring tabs show real data
- **Phase gate:** All 5 services returning real data, mock files deleted, build passes

### Wave 0 Gaps
- None -- existing test infrastructure covers verification via logs and manual UI checks. No new test framework needed for this phase.

## Open Questions

1. **Kafka Service DNS Name**
   - What we know: StatefulSet headless service is `kafka-service`; there appears to be no separate `kafka` ClusterIP service in the Helm templates
   - What's unclear: Whether `kafka` (without `-service`) resolves in-cluster; the ConfigMap `kafka-server` value would tell us
   - Recommendation: Verify actual ConfigMap value via `kubectl get configmap services-config -n ez-platform -o yaml`; add explicit env var mapping

2. **Prometheus Business Port (9090 vs 9091)**
   - What we know: Code defaults to port 9090; Prometheus business service definition uses port 9090; but ConfigMap references port 9091 for prometheus-business-endpoint
   - What's unclear: Whether the 9091 in ConfigMap is intentional (different from service port)
   - Recommendation: Verify at deploy time; the code fallback of 9090 is correct based on the service definition

3. **MassTransit RabbitMQ Event Delivery**
   - What we know: PipelineEventConsumer is registered with MassTransit using RabbitMQ transport
   - What's unclear: Whether events are actually being published to RabbitMQ by the pipeline services (they use Kafka for inter-service messaging)
   - Recommendation: Check if any pipeline service publishes to RabbitMQ or if all use Kafka; PipelineEventConsumer may need to be wired to Kafka instead

4. **Separate Hub vs Extended MonitoringHub for CRUD**
   - Recommendation: Extend the existing MonitoringHub rather than creating a separate hub. The CRUD notifications use the same connection lifecycle, and a separate hub would require an additional WebSocket connection per client.

## Sources

### Primary (HIGH confidence)
- `src/Services/DataSourceManagementService/Services/KubernetesMonitoringService.cs` -- Full implementation reviewed
- `src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs` -- Full implementation reviewed, config key names verified
- `src/Services/DataSourceManagementService/Services/KafkaMonitoringService.cs` -- Full implementation reviewed, config key name verified
- `src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs` -- Full implementation reviewed
- `src/Services/DataSourceManagementService/Consumers/PipelineEventConsumer.cs` -- Full implementation reviewed
- `src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs` -- Full implementation reviewed
- `src/Services/DataSourceManagementService/Program.cs` -- DI registration verified
- `src/Services/Shared/Entities/DataProcessingBaseEntity.cs` -- Version field verified (long, starts at 1)
- `src/Frontend/src/hooks/useMonitoringHub.ts` -- All 8 event subscriptions verified
- `src/Frontend/src/pages/monitoring/SystemMonitoring.tsx` -- Mock fallback pattern verified
- `helm/ez-platform/templates/deployments/datasource-management-deployment.yaml` -- Missing serviceAccountName and monitoring env vars confirmed
- `helm/ez-platform/templates/configmaps/services-config.yaml` -- ConfigMap keys reviewed
- `k8s/rbac/nas-device-rbac.yaml` -- RBAC resources reviewed, includes pod/service/endpoints list permissions

### Secondary (MEDIUM confidence)
- `helm/ez-platform/templates/deployments/jaeger.yaml` -- Service name `jaeger` on port 16686 confirmed
- `helm/ez-platform/templates/deployments/prometheus-business-deployment.yaml` -- Service port 9090 confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all code read directly, no external libraries needed
- Architecture: HIGH -- existing infrastructure fully reviewed, patterns documented from source
- Pitfalls: HIGH -- identified from direct code analysis (missing env vars, missing DTOs, RBAC gap)
- Config mapping: MEDIUM -- in-cluster DNS defaults need runtime verification

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external dependency changes expected)

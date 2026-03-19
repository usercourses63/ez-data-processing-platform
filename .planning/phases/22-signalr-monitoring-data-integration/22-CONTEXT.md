# Phase 22: SignalR Monitoring Data Integration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Debug and integrate all five SignalR backend data services (KubernetesMonitoringService, PrometheusQueryService, KafkaMonitoringService, Jaeger trace queries, PipelineEventConsumer) against the live cluster so System Monitoring page displays real data instead of mock fallback. Remove mock data files entirely once all tabs show real data.

The SignalR hub infrastructure (MonitoringHub, MonitoringBroadcaster, frontend useMonitoringHub hook) was built in Phase 16 and is already wired up. This phase is purely about making each backend service return real data and verifying it shows in the UI.

</domain>

<decisions>
## Implementation Decisions

### RBAC fix — highest priority
- **Add RBAC to Helm chart** — Create Helm templates for: ServiceAccount (`nas-device-manager`), ClusterRole (`nas-pv-manager` with pod/service/endpoints list permissions), and Bindings
- Set `serviceAccountName: nas-device-manager` on the datasource-management Deployment template
- The k8s/rbac/nas-device-rbac.yaml already has the correct permissions (pod/service/endpoints list + PV/PVC management) — port it into Helm
- Without this, KubernetesMonitoringService silently returns empty lists (RBAC denial is the root cause)

### Debug & verification order
- Systematic approach: fix RBAC first (enables K8s), then verify each service in order:
  1. K8s monitoring (pod/service status) — unblocked by RBAC fix
  2. Prometheus (metrics + alerts) — most likely already working, just needs URL config verification
  3. Kafka (queue depths) — kafka:9092 INTERNAL listener, correct for in-cluster AdminClient
  4. Jaeger (traces) — jaeger:16686 HTTP API
  5. PipelineEventConsumer (event stream) — verify MassTransit subscription is registered
- Verification method: check MonitoringBroadcaster logs (kubectl logs / Grafana) + confirm each tab in System Monitoring page shows real data in browser

### Kafka bootstrap
- `kafka:9092` (INTERNAL listener) is correct for AdminClient running inside the cluster
- Verify ConfigMap mapping: `kafka-server: kafka:9092` maps to `Kafka:Brokers` env var — confirm the key name matches what KafkaMonitoringService reads (`_configuration["Kafka:Brokers"]`)

### Mock removal — hard cutover
- **Delete** `monitoring-mock-data.ts` and `kubernetes-mock-data.ts` entirely once all 5 services return real data
- No "keep as fallback" — MON-13 requires removal, and keeping dead code misleads future developers
- When mocks are removed: show **Ant Design loading skeleton** on each tab until first SignalR broadcast (~5s after page load), then real data replaces skeleton
- If SignalR disconnects after initial load: show last-known data (already cached in React state) — no mock fallback needed

### Claude's Discretion
- Exact Helm template file structure for RBAC resources
- Whether to split RBAC into separate template files or one combined rbac.yaml
- Skeleton component choice (Ant Design Skeleton.Input vs Skeleton.Button vs custom per-tab)
- Log level for MonitoringBroadcaster cycle output (currently Info — may want to reduce to Debug to avoid log spam)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 16 Context (SignalR hub decisions — all locked)
- `.planning/phases/16-signalr-realtime-updates/16-CONTEXT.md` — Hub architecture, event names, update intervals (5s health / 30s infra), connection UX, hub placement decisions

### Existing Backend Services (to debug/fix)
- `src/Services/DataSourceManagementService/Services/KubernetesMonitoringService.cs` — K8s pod/service queries (fails silently without RBAC)
- `src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs` — Prometheus PromQL + Jaeger trace queries
- `src/Services/DataSourceManagementService/Services/KafkaMonitoringService.cs` — Kafka AdminClient queue depth queries
- `src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs` — Background broadcaster (5s/30s loops)
- `src/Services/DataSourceManagementService/Consumers/PipelineEventConsumer.cs` — MassTransit consumer for pipeline events

### Existing RBAC (to port into Helm)
- `k8s/rbac/nas-device-rbac.yaml` — ServiceAccount + ClusterRole + Bindings — has pod/service/endpoints list permissions already

### Helm Chart (to add RBAC to)
- `helm/ez-platform/templates/deployments/datasource-management-deployment.yaml` — Add serviceAccountName here
- `helm/ez-platform/templates/` — Add new rbac.yaml template here

### Frontend (mock removal target)
- `src/Frontend/src/pages/monitoring/SystemMonitoring.tsx` — Mock fallback wiring to remove; skeleton loading to add
- `src/Frontend/src/services/monitoring-mock-data.ts` — Delete this file
- `src/Frontend/src/services/kubernetes-mock-data.ts` — Delete this file

### Requirements
- `.planning/REQUIREMENTS.md` — MON-08 through MON-13

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MonitoringBroadcaster.cs`: Already logs broadcast cycles — check these logs first when debugging
- `useMonitoringHub` hook: Already wired in SystemMonitoring.tsx — provides `signalRServices`, `signalRPods`, etc. state that replaces mock state
- Ant Design `Skeleton` component: Available in frontend — use for loading state on each tab

### Established Patterns
- Silent empty-list fallback on catch: All 5 backend services catch exceptions and return `new List<>()` — errors show in logs but don't crash the broadcaster
- Config key pattern: Services read from `IConfiguration` via string keys — verify keys match ConfigMap entries in `helm/ez-platform/templates/configmaps/`
- Helm deployment templates: Follow existing pattern in `datasource-management-deployment.yaml` for adding serviceAccountName

### Integration Points
- ConfigMap `services-config` → env vars → IConfiguration in service code — verify `Kafka:Brokers`, `Prometheus:BusinessEndpoint`, `Prometheus:SystemEndpoint`, `Jaeger:Endpoint` keys all map correctly
- RBAC ServiceAccount must exist in namespace before deployment references it — create as Helm pre-install hook or ensure template ordering is correct

</code_context>

<specifics>
## Specific Ideas

- The systematic debug order maps directly to the two-plan structure already in ROADMAP.md: Plan 22-01 = fix all backend services (RBAC + config verification for all 5), Plan 22-02 = verify real data in UI + remove mocks
- Since the broadcaster logs what it sends, a quick `kubectl logs deployment/datasource-management -n ez-platform | grep -i "broadcast\|monitoring\|error"` after deploying the RBAC fix will immediately show whether K8s queries are working

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-signalr-monitoring-data-integration*
*Context gathered: 2026-03-19*

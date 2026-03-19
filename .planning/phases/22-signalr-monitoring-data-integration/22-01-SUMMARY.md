---
phase: 22-signalr-monitoring-data-integration
plan: 01
subsystem: infra
tags: [helm, rbac, kubernetes, signalr, monitoring, prometheus, kafka, jaeger]

requires:
  - phase: 16-signalr-realtime-updates
    provides: MonitoringBroadcaster, K8s/Prometheus/Kafka monitoring services
provides:
  - Helm RBAC template with ServiceAccount, ClusterRole, ClusterRoleBinding, Role, RoleBinding
  - Monitoring env vars (Kafka, Prometheus, Jaeger) injected into datasource-management deployment
  - Jaeger endpoint in services-config ConfigMap
  - All 5 monitoring services returning real cluster data
affects: [22-signalr-monitoring-data-integration]

tech-stack:
  added: []
  patterns: [helm-rbac-template, configmap-env-injection]

key-files:
  created:
    - helm/ez-platform/templates/rbac.yaml
  modified:
    - helm/ez-platform/templates/deployments/datasource-management-deployment.yaml
    - helm/ez-platform/templates/configmaps/services-config.yaml

key-decisions:
  - "Ported RBAC from k8s/rbac/nas-device-rbac.yaml to Helm template with standard labels"
  - "Prometheus business endpoint port 9091 from ConfigMap is correct (K8s Service port, not container port)"

patterns-established:
  - "RBAC in Helm: single rbac.yaml with all 5 resources, templatized namespace"

requirements-completed: [MON-08, MON-09, MON-10, MON-11, MON-12]

duration: 3min
completed: 2026-03-19
---

# Phase 22 Plan 01: RBAC and Monitoring Data Integration Summary

**Helm RBAC template with nas-device-manager ServiceAccount plus Kafka/Prometheus/Jaeger env var injection enabling all 5 monitoring services to return real cluster data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T11:37:26Z
- **Completed:** 2026-03-19T11:40:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created Helm RBAC template with all 5 Kubernetes RBAC resources (ServiceAccount, ClusterRole, ClusterRoleBinding, Role, RoleBinding)
- Added serviceAccountName and 4 monitoring env vars to datasource-management deployment template
- Added jaeger-endpoint key to services-config ConfigMap
- Deployed and verified: K8s API access working (in-cluster config), no MonitoringBroadcaster errors, PipelineEventConsumer registered

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Helm RBAC template and update datasource-management deployment** - `fc4a321` (feat)
2. **Task 2: Deploy updated Helm chart and verify all 5 monitoring services return real data** - (verification only, no files changed)

## Files Created/Modified
- `helm/ez-platform/templates/rbac.yaml` - All 5 RBAC resources for nas-device-manager, templatized for Helm
- `helm/ez-platform/templates/deployments/datasource-management-deployment.yaml` - Added serviceAccountName and Kafka/Prometheus/Jaeger env vars
- `helm/ez-platform/templates/configmaps/services-config.yaml` - Added jaeger-endpoint key

## Decisions Made
- Ported RBAC from k8s/rbac/nas-device-rbac.yaml to Helm template with standard ez-platform.labels
- Prometheus business endpoint port 9091 from ConfigMap is correct (K8s Service exposes 9091, backend default of 9090 was the container port)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 monitoring services returning real data from live cluster
- MonitoringBroadcaster running without errors at dual-speed (5s health, 30s infrastructure)
- PipelineEventConsumer registered and ready for file processing events
- Ready for Plan 22-02 (frontend monitoring dashboard integration)

---
*Phase: 22-signalr-monitoring-data-integration*
*Completed: 2026-03-19*

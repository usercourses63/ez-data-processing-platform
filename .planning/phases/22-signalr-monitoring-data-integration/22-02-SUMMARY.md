---
phase: 22-signalr-monitoring-data-integration
plan: 02
subsystem: ui
tags: [react, signalr, antd, skeleton, monitoring]

requires:
  - phase: 22-signalr-monitoring-data-integration
    provides: "SignalR hub delivering real monitoring data (Plan 01)"
provides:
  - "SystemMonitoring.tsx uses only real SignalR data with skeleton loading"
  - "Mock data files deleted (monitoring-mock-data.ts, kubernetes-mock-data.ts)"
  - "Pipeline topology constants extracted to pipeline-constants.ts"
affects: []

tech-stack:
  added: []
  patterns: [skeleton-loading-until-signalr, no-mock-fallback]

key-files:
  created:
    - src/Frontend/src/services/pipeline-constants.ts
  modified:
    - src/Frontend/src/pages/monitoring/SystemMonitoring.tsx
    - src/Frontend/src/pages/monitoring/components/PipelineFlow.tsx
    - src/Frontend/src/pages/monitoring/components/PerformanceCharts.tsx
    - src/Frontend/src/pages/monitoring/components/RecentAlerts.tsx

key-decisions:
  - "Extract pipeline topology constants (PIPELINE_CONNECTIONS, getServicePositions, simulateDataFlow) to pipeline-constants.ts instead of deleting with mock data"
  - "Inline formatTimeAgo and latency/success generators into their consuming components rather than creating shared utility file"

patterns-established:
  - "Skeleton loading: show Ant Design Skeleton until hasReceivedData flag is true (services.length > 0 || metrics !== null || pods.length > 0)"
  - "No mock fallback: SignalR data used directly, last-known data remains visible on disconnect"

requirements-completed: [MON-13]

duration: 2min
completed: 2026-03-19
---

# Phase 22 Plan 02: Remove Mock Data and Add Skeleton Loading Summary

**SystemMonitoring page uses only real SignalR data with Ant Design Skeleton loading states; 540 lines of mock generators deleted**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T11:42:29Z
- **Completed:** 2026-03-19T11:45:13Z
- **Tasks:** 2
- **Files modified:** 7 (5 modified, 2 deleted)

## Accomplishments
- Removed all mock data imports, state variables, and loadDashboardData function from SystemMonitoring.tsx
- Added Ant Design Skeleton loading for all tabs (overview, pods, traces, queues, alerts) plus ClusterHeader and MetricsOverviewCards
- Deleted monitoring-mock-data.ts (358 lines) and kubernetes-mock-data.ts (184 lines)
- Extracted reusable pipeline topology constants to pipeline-constants.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove mock data and add skeleton loading to SystemMonitoring** - `2be4db7` (feat)
2. **Task 2: Delete mock data files and verify clean build** - `79a57b1` (chore)

## Files Created/Modified
- `src/Frontend/src/pages/monitoring/SystemMonitoring.tsx` - Rewritten to use SignalR data only with Skeleton loading
- `src/Frontend/src/services/pipeline-constants.ts` - New file with pipeline topology constants extracted from mock data
- `src/Frontend/src/pages/monitoring/components/PipelineFlow.tsx` - Import updated from mock to pipeline-constants
- `src/Frontend/src/pages/monitoring/components/PerformanceCharts.tsx` - Latency/success generators moved inline
- `src/Frontend/src/pages/monitoring/components/RecentAlerts.tsx` - formatTimeAgo moved inline
- `src/Frontend/src/services/monitoring-mock-data.ts` - DELETED
- `src/Frontend/src/services/kubernetes-mock-data.ts` - DELETED

## Decisions Made
- Extracted pipeline topology constants to a dedicated file (pipeline-constants.ts) because PipelineFlow.tsx still needs them for canvas rendering -- these are structural constants, not mock data
- Inlined formatTimeAgo into RecentAlerts and latency/success generators into PerformanceCharts rather than creating a shared utils file (keeps code locality, these are only used in one place each)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed additional mock data imports in PipelineFlow, PerformanceCharts, RecentAlerts**
- **Found during:** Task 1 (SystemMonitoring rewrite)
- **Issue:** Plan only addressed SystemMonitoring.tsx imports, but 3 other components also imported from mock data files (PipelineFlow: PIPELINE_CONNECTIONS/getServicePositions/simulateDataFlow, PerformanceCharts: generateLatencyDistribution/generateSuccessFailureMetrics, RecentAlerts: formatTimeAgo)
- **Fix:** Extracted pipeline constants to new file; inlined utility functions into consuming components
- **Files modified:** PipelineFlow.tsx, PerformanceCharts.tsx, RecentAlerts.tsx, pipeline-constants.ts (new)
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 2be4db7 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed lastUpdate type mismatch**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** ClusterHeader expects `lastUpdate: Date` but useMonitoringHub returns `Date | null`
- **Fix:** Used `lastUpdate ?? new Date()` fallback (ClusterHeader only renders when clusterInfo is truthy, meaning SignalR has sent data)
- **Files modified:** SystemMonitoring.tsx
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 2be4db7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for build correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SystemMonitoring page fully wired to SignalR data
- Ready for Plan 22-03 (if any remaining monitoring integration tasks)
- Frontend compiles cleanly with zero mock data references

---
*Phase: 22-signalr-monitoring-data-integration*
*Completed: 2026-03-19*

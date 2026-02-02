---
phase: 02-nas-nfs-architecture
plan: 01
subsystem: infra
tags: [kubernetes, nfs, rbac, mongodb, entity]

# Dependency graph
requires:
  - phase: 01-file-simulator
    provides: File-simulator integration pattern, ConfigMap structure
provides:
  - NasDevice entity for NAS device configuration storage
  - RBAC manifests for K8s PV/PVC API access
  - NasDeviceRole enum for role classification
affects: [02-02, 02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NasDevice entity extending DataProcessingBaseEntity"
    - "Computed K8s resource names (PvName, PvcName, MountPath)"
    - "ClusterRole for cluster-scoped PV operations"
    - "Role for namespace-scoped PVC/Deployment operations"

key-files:
  created:
    - src/Services/Shared/Entities/NasDevice.cs
    - k8s/rbac/nas-device-rbac.yaml
  modified: []

key-decisions:
  - "Use computed properties for K8s resource names (PvName, PvcName, MountPath)"
  - "NasDeviceRole enum includes Backup role for archive storage"
  - "Default NFS mount options: nfsvers=3, tcp, hard, intr (stability focus)"
  - "Separate ClusterRole (PV) and Role (PVC/Deployment) for least-privilege"

patterns-established:
  - "NAS device entity pattern with provisioning status tracking"
  - "RBAC split: ClusterRole for cluster-scoped, Role for namespace-scoped"

# Metrics
duration: 5min
completed: 2026-02-02
---

# Phase 02 Plan 01: NasDevice Entity and K8s RBAC Summary

**NasDevice MongoDB entity with NFS connection config, computed K8s resource names, and RBAC manifests for dynamic PV/PVC provisioning**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-02T13:00:00Z
- **Completed:** 2026-02-02T13:05:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- NasDevice entity extending DataProcessingBaseEntity with full NAS configuration
- NasDeviceRole enum (Input, Output, Backup, Both) for role classification
- Computed K8s resource names (PvName, PvcName, MountPath) from device name
- RBAC manifests enabling K8s API access for dynamic NFS provisioning
- Provisioning status tracking (IsPvCreated, IsPvcBound, LastProvisionedAt)
- Connection testing support (SetConnectionTestResult helper method)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NasDevice entity** - `eb9b222` (feat)
2. **Task 2: Create RBAC manifests for NAS device K8s operations** - `5ce40ff` (feat)

## Files Created/Modified

- `src/Services/Shared/Entities/NasDevice.cs` - NAS device configuration entity with connection, storage, and provisioning fields
- `k8s/rbac/nas-device-rbac.yaml` - RBAC for K8s PV/PVC management (ServiceAccount, ClusterRole, ClusterRoleBinding, Role, RoleBinding)

## Decisions Made

1. **Computed K8s resource names:** PvName, PvcName, and MountPath are computed properties derived from the device Name field. This ensures consistent naming and avoids manual entry errors.

2. **NasDeviceRole includes Backup:** Added Backup role beyond Input/Output for archive storage scenarios, matching AdminServer's ServerDirection pattern flexibility.

3. **Default mount options for stability:** Used `nfsvers=3, tcp, hard, intr` as defaults based on 02-RESEARCH.md recommendations to avoid NFSv4 lease/stale handle issues.

4. **RBAC split architecture:** ClusterRole for PV operations (cluster-scoped), Role for PVC/Deployment operations (namespace-scoped) follows OCP least-privilege principle.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02-02 (KubernetesClient integration):**
- NasDevice entity available for service layer
- RBAC manifests ready to deploy before NasResourceService testing
- Entity fields match K8s API requirements (PV spec, PVC spec)

**Prerequisites for next plans:**
- Plan 02-02 will add KubernetesClient package and NasResourceService
- RBAC must be applied to cluster before testing provisioning operations

---
*Phase: 02-nas-nfs-architecture*
*Completed: 2026-02-02*

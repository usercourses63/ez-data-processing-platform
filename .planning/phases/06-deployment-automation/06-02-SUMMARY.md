---
phase: 06-deployment-automation
plan: 02
subsystem: infra
tags: [helm, kubernetes, openshift, deployment, images, air-gapped, mongodb, hooks]

# Dependency graph
requires:
  - phase: 06-deployment-automation/01
    provides: Helm charts v0.2.0 with smoke tests
provides:
  - Versioned image export script for offline deployment
  - Database initialization Helm hook for MongoDB indexes
  - Complete OCP deployment documentation with air-gapped procedure
affects: [06-03, 06-04, deployment, release, operations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Helm pre-install/pre-upgrade hook for database initialization
    - Versioned tarball export for air-gapped deployment
    - Values overlay pattern for registry override

key-files:
  created:
    - scripts/export-images.ps1
    - helm/ez-platform/templates/hooks/db-init-job.yaml
    - release-package/helm/ez-platform-ocp/templates/hooks/db-init-job.yaml
    - docs/deployment/ocp-deployment-guide.md
  modified: []

key-decisions:
  - "Image export includes 10 services + 12 infrastructure images"
  - "DB init hook weight -5 runs before other hooks"
  - "Air-gapped deployment uses values-airgap.yaml for registry override"

patterns-established:
  - "Helm hook: pre-install,pre-upgrade with hook-delete-policy: before-hook-creation,hook-succeeded"
  - "Tarball naming: {service}-{version}.tar for services, {image-path}.tar for infrastructure"
  - "Air-gapped workflow: export -> transfer -> load -> tag -> push -> install"

# Metrics
duration: 3min
completed: 2026-02-03
---

# Phase 6 Plan 2: OCP Deployment Automation Summary

**Created OCP deployment automation with image tarball export, database initialization hook, and comprehensive deployment documentation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-03T06:06:31Z
- **Completed:** 2026-02-03T06:09:40Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments
- Created `scripts/export-images.ps1` with versioned tarball export for all 10 services + 12 infrastructure images
- Added `db-init-job.yaml` Helm hook with pre-install,pre-upgrade annotations to both vanilla and OCP charts
- Created comprehensive `ocp-deployment-guide.md` (469 lines) with standard, upgrade, and air-gapped deployment procedures
- All helm lint checks pass for both charts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create versioned image export script** - `314443f` (feat)
2. **Task 2: Create database initialization Helm hook** - `56623e5` (feat)
3. **Task 3: Create OCP deployment documentation** - `cdd1407` (docs)

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/export-images.ps1` | 165 | Versioned tarball export for offline deployment |
| `helm/ez-platform/templates/hooks/db-init-job.yaml` | 86 | MongoDB index initialization hook |
| `release-package/helm/ez-platform-ocp/templates/hooks/db-init-job.yaml` | 86 | Same hook for OCP chart |
| `docs/deployment/ocp-deployment-guide.md` | 469 | Complete OCP deployment documentation |

## Key Features

### export-images.ps1
- Accepts `-Version` parameter (required) for versioned exports
- Exports 10 service images: datasource-management, fileprocessor, filediscovery, validation, scheduling, output, metrics-configuration, invalidrecords, frontend, docs
- Exports 12 infrastructure images with pinned versions
- `-SkipInfrastructure` flag for services-only export
- Failed images tracking with exit code 1 on failure
- Usage instructions printed after successful export

### db-init-job.yaml
- `helm.sh/hook: pre-install,pre-upgrade` annotation
- `helm.sh/hook-weight: -5` runs before other hooks
- Creates indexes for: datasources, nasdevices, invalidrecords, schemas, processinghistory
- 5-minute timeout (activeDeadlineSeconds: 300)
- OCP-compatible security context

### ocp-deployment-guide.md
- Standard deployment with `helm install`
- Upgrade deployment with `--atomic` rollback
- Complete 6-step air-gapped deployment procedure
- Post-deployment validation with smoke tests
- Configuration reference and required changes
- Troubleshooting section for common issues
- Security considerations and network policies

## Decisions Made
- Image export includes curl:8.5.0 for smoke test pod
- Infrastructure images pinned to specific versions (no :latest tags)
- Air-gapped deployment uses separate values-airgap.yaml overlay
- DB init uses mongosh with --eval for inline JavaScript execution

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - all automation is self-contained.

## Next Phase Readiness
- Image export ready for v0.2.0 release packaging
- DB init hook ensures indexes exist before services start
- Documentation ready for OCP deployment team handoff
- Ready for Plan 06-03: Rollback & Health Verification

---
*Phase: 06-deployment-automation*
*Completed: 2026-02-03*

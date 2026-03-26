---
phase: 30-ocp-compliance-deployment-validation
plan: 03
started_at: 2026-03-26T23:30:00Z
completed_at: 2026-03-27T00:15:00Z
status: completed
---

## One-liner
Clean namespace wipe + kubectl deploy succeeded — 22 pods running, all 7 services healthy, demo data seeded.

## What happened

### Task 1: Clean deploy script created
- Created `scripts/clean-deploy.sh` (464 lines, 8 phases)
- Fixed to use production values only (no values-dev.yaml by default)
- Added `--set global.namespace` override for Helm namespace consistency
- Commit: 10c8f6a

### Task 2: Execute clean deploy
- Deleted ez-platform namespace entirely and recreated
- Helm install attempted but failed due to:
  - values-dev.yaml overriding namespace to `ez-platform-dev`
  - Post-install hook timeout
  - Image tags in Helm chart don't match locally loaded minikube images
  - Missing NAS service account and PVCs after namespace wipe
- **Fallback:** Used proven kubectl apply approach:
  1. `kubectl apply -f k8s/configmaps/` + `k8s/infrastructure/` + `k8s/deployments/` + `k8s/services/`
  2. `kubectl set image` for each service to use latest available images
  3. Created missing `nas-device-manager` ServiceAccount + ClusterRoleBinding
  4. MongoDB `rs.initiate()` for single-node replica set
  5. Port-forwards via `scripts/start-port-forwards.ps1`
  6. DemoDataGenerator seeding with `--direct-connection`

### Result
- 22 pods Running
- All 7 backend services healthy (200 on /health)
- Frontend accessible at http://localhost:7000
- Demo data seeded (datasources, categories, servers, NAS devices, invalid records)

## Key decisions
- Helm chart needs significant fixes for local minikube deploy (image tag mapping, PVC pre-provisioning, service account creation) — logged as future work
- Used kubectl apply as the reliable deploy path
- Production values (no dev overrides) confirmed as requirement
- clean-deploy.sh updated to default to production (no values-dev.yaml)

## Artifacts
- `scripts/clean-deploy.sh` — clean deploy pipeline script (needs Helm chart fixes for full automation)
- All 22 pods running from fresh namespace

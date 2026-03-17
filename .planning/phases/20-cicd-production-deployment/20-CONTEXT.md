# Phase 20: CI/CD & Production Deployment - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Production-ready CI/CD pipeline with Helm deployment, version injection from git tags, OCP resource configuration, local production deployment mode using release-package images, and release-package validation via health checks + smoke test. No new features — infrastructure and deployment automation only.

</domain>

<decisions>
## Implementation Decisions

### CI/CD pipeline scope
- Full pipeline: build → test → Docker build → Helm deploy
- Docker images: build validation only, no registry push (air-gapped OCP deployment target)
- Helm deploy step: Claude's discretion on whether to use a self-hosted runner or manual-trigger workflow_dispatch — pick the most practical approach for a single-developer project
- Existing CI workflow at `.github/workflows/ci.yml` has build+test+docker jobs (118 lines) — extend it, don't replace

### Local production mode
- Use `values-local.yaml` Helm values file with replicas:1 for all services, reduced resource requests to fit dev PC
- Deploy with: `helm install -f values-local.yaml`
- Use release-package pre-built image tars (not build from source) — validates actual release artifacts

### Version injection flow
- Version number comes from git tag (e.g. `v0.2.0`)
- CI reads the tag and injects into builds via `build-all-images.ps1 -Version` param
- Frontend: version.ts already reads `__APP_VERSION__`, `__BUILD_DATE__`, `__GIT_COMMIT__` at build time — ensure CI sets these
- Backend: version info exposed via /health endpoint only — no UI display needed
- Frontend footer is the user-facing version display

### Release-package validation
- Validation = health checks + smoke test: all pods healthy, health endpoints return 200, frontend loads, one data source CRUD operation works
- No full E2E test suite required for release-package validation
- Update existing install.ps1/install.sh scripts for v0.2.0: new images (docs-docusaurus), new services, Helm-based deployment option

### OCP resource configuration
- PROD-05: proper resource requests/limits for every pod in release-package Helm charts
- OCP security context already defined in `helm/ez-platform/values.yaml` — extend with per-service resource limits

### Claude's Discretion
- Helm deploy job implementation (self-hosted runner vs workflow_dispatch)
- Exact resource requests/limits per service (based on observed usage)
- Whether to add a Helm lint/template validation step to CI
- Install script update scope (keep kubectl path or add Helm path)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CI/CD
- `.github/workflows/ci.yml` — Existing CI pipeline (build+test+docker jobs)
- `scripts/build-all-images.ps1` — Parallel Docker build script with version injection params

### Helm charts
- `helm/ez-platform/values.yaml` — Base Helm values with OCP security context
- `helm/ez-platform/values-dev.yaml` — Dev environment values
- `helm/ez-platform/values-prod.yaml` — Production values
- `helm/ez-platform/Chart.yaml` — Chart metadata

### Version injection
- `src/Frontend/src/config/version.ts` — Frontend version config (reads build-time vars)
- `src/Frontend/vite.config.ts` — Vite define section for version injection

### Release package
- `release-package/README.md` — Release package structure and contents
- `release-package/install.ps1` — Windows install script
- `release-package/install.sh` — Linux install script
- `release-package/IMAGE-MANIFEST.txt` — Docker image list

### Requirements
- `.planning/REQUIREMENTS.md` — PROD-01 through PROD-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ci.yml`: 3-job pipeline (build, test, docker) — extend with Helm deploy job
- `build-all-images.ps1`: Parallel image builds with -Version and -CommitSha params — already supports CI injection
- `version.ts`: Frontend version display with build-time variable injection
- `values.yaml`: OCP security context, network policies, global settings already defined
- `install.ps1`/`install.sh`: Release-package install scripts — update for v0.2.0

### Established Patterns
- Docker images use specific version tags (e.g. `datasource-management:v0.3.0-fileops11`)
- Helm chart has per-service configuration in values.yaml
- All services expose `/health` endpoint
- OCP compatibility: non-root users, non-privileged ports, readOnlyRootFilesystem

### Integration Points
- `build-all-images.ps1` → CI docker job (needs to be called with correct params)
- `values-local.yaml` → `helm install` command in install scripts
- Git tags → CI version extraction → build-all-images.ps1 -Version param
- Release-package images/ → minikube image load → Helm deploy

</code_context>

<specifics>
## Specific Ideas

- Local production mode must use release-package pre-built image tars to validate actual release artifacts
- Health endpoint version display is the only backend version requirement
- Air-gapped deployment target means no registry push in CI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-cicd-production-deployment*
*Context gathered: 2026-03-17*

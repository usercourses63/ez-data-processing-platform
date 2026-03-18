# Phase 21: Release Package & CI Deployment Pipeline — Context

**Gathered:** 2026-03-18
**Status:** Ready for planning
**Source:** User conversation — direct requirements capture

<domain>
## Phase Boundary

CI automatically produces a versioned, timestamped, offline-ready deployment folder on every successful build. The same CI run builds all images from source, loads them into the Minikube cluster (self-hosted runner has direct cluster access), deploys via Helm, seeds with DemoDataGenerator, and validates with a new `@Sanity` test suite. The deployment folder can be physically transferred to an air-gapped / offline network and installed there.

**What this phase is NOT:**
- Not a new application feature
- Not OCP/OpenShift deployment (that is already documented; this is about the CI automation)
- Not full E2E tests (NAS/SFTP/cross-cluster) — only a fast sanity suite

</domain>

<decisions>
## Implementation Decisions

### Deployment Package Naming Convention
- Pattern: `deployment-{VERSION}-{YYYYMMDD}-{HHMMSS}/`
- Example: `deployment-v0.2.0-20260318-143022/`
- VERSION comes from git tag if on a tag (`v*`), otherwise `v{SEMANTIC_VERSION}-dev-{run_number}`
- The folder is assembled in CI workspace, then zipped and uploaded as GitHub Actions artifact

### Package Contents (locked)
```
deployment-{VERSION}-{TIMESTAMP}/
├── images/
│   ├── services/           ← 10 application image .tar files (built from source)
│   └── infrastructure/     ← 11 infrastructure image .tar files (pulled from registry)
├── helm/
│   └── ez-platform/        ← full Helm chart copy
├── values-local.yaml       ← the deployment config for offline install
├── install.ps1             ← PowerShell installer
├── install.sh              ← Bash installer
├── IMAGE-MANIFEST.txt      ← all 21 images with versions
└── DEPLOYMENT-GUIDE.md     ← install instructions
```

### Image Build Approach (locked)
- All 10 application images built from source via `docker build` in CI
- Tag: `ez-platform/{service}:{VERSION}` (e.g., `ez-platform/datasource-management:v0.2.0`)
- Exported as `.tar` with `docker save`
- Infrastructure images pulled with `docker pull` and exported with `docker save`
- Build script: `scripts/build-all-images.sh` (Linux/bash for CI), produces tars into `dist/images/`

### Cluster Deployment in CI (locked)
- Self-hosted runner has direct access to Minikube cluster
- CI gates on `vars.EZ_K8S_RUNNER == 'true'` (existing pattern)
- Image load: `minikube image load dist/images/services/*.tar` (replaces existing)
- Deploy: `helm upgrade --install ez-platform ./helm/ez-platform -f helm/ez-platform/values-local.yaml --wait --timeout 15m`
- Namespace: `ez-platform` (existing)

### DemoDataGenerator Seeding (locked)
- Run after Helm deploy, before sanity tests
- Command: `dotnet run --project tools/DemoDataGenerator -- --direct-connection --api-url http://localhost:5001`
- Must use `--direct-connection` (NodePort access from runner)
- Do NOT use `--use-simulator` (file-simulator not required for sanity; local-folder datasources only)
- Port forwards set up by CI before seeding (existing `scripts/start-port-forwards.ps1` pattern)

### Sanity Test Suite Design (locked)
- New file: `src/Frontend/tests/e2e/sanity.spec.ts`
- Tag: `@Sanity` (Playwright grep pattern)
- Playwright project: new `sanity` project in `playwright.config.ts` (API-level, no UI rendering needed)
- Must complete in < 5 minutes total
- No NAS, no SFTP, no cross-cluster dependencies
- Tests run AFTER DemoDataGenerator seeds the cluster

#### Sanity Tests (locked scope)
| ID | Test | Assertion |
|----|------|-----------|
| SANITY-01 | All health endpoints respond | GET /health → 200 or 204 for all 9 services |
| SANITY-02 | Seeded data visible in API | GET /api/v1/datasource → array length > 0 |
| SANITY-03 | Create + delete datasource | POST /api/v1/datasource → 201, DELETE → 204 |
| SANITY-04 | Categories seeded | GET /api/v1/categories → array length > 0 |
| SANITY-05 | Metrics endpoint responsive | GET /api/v1/metrics → 200 |
| SANITY-06 | Scheduling endpoint responsive | GET /api/v1/schedule → 200 |
| SANITY-07 | Frontend loads | GET http://localhost:7000 → 200, page title contains "EZ" |

### CI Job Structure (locked)
```
test (existing)
  └── docker-build (new job, needs: test)
        - builds 10 app images, exports as tar
        └── package-release (new job, needs: docker-build)
              - pulls infra images, exports as tar
              - assembles deployment folder
              - uploads artifact
              └── sanity-deploy (new job, needs: package-release, if: EZ_K8S_RUNNER == 'true')
                    - minikube image load (all tars)
                    - helm upgrade --install (values-local.yaml)
                    - wait for pods ready
                    - start port-forwards
                    - dotnet run DemoDataGenerator
                    - npm run test:e2e:sanity
```

### GitHub Release (locked)
- Triggered only on `v*` tags (existing `ci.yml` pattern)
- Creates GitHub release with: tag, CHANGELOG excerpt, deployment artifact attached
- CHANGELOG already exists at `release-package/CHANGELOG.md`

### Scripts (locked)
- `scripts/build-all-images.sh` — new, builds + exports all 10 app images
- `scripts/pull-infra-images.sh` — new, pulls + exports all 11 infra images
- `scripts/assemble-package.sh` — new, assembles dated deployment folder from dist/
- All scripts: `set -euo pipefail`, executable, shebang `#!/bin/bash`

### Claude's Discretion
- Exact Playwright `sanity` project config (API-only vs chromium — choose fastest)
- Whether to use `axios` or Playwright's `request` fixture for API tests
- Exact timeout values for pod readiness waits in CI
- Whether `package-release` pulls infra images fresh or uses the pinned ones from `IMAGE-MANIFEST.txt`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing CI pipeline
- `.github/workflows/ci.yml` — current jobs (build, test, performance, docker, helm-validate); new jobs extend this

### Existing deployment tooling
- `helm/ez-platform/values-local.yaml` — single-replica deploy config (created in Phase 20-02)
- `release-package/IMAGE-MANIFEST.txt` — all 21 images with pinned versions
- `release-package/install.ps1` — existing installer pattern (reference for offline install)
- `scripts/validate-release.ps1` — existing 4-phase validation (reference; sanity-deploy is different)

### Existing test infrastructure
- `src/Frontend/playwright.config.ts` — Playwright projects (add `sanity` project here)
- `src/Frontend/tests/e2e/` — existing test files (sanity.spec.ts goes here)
- `tests/performance/smoke.js` — k6 smoke (different from sanity; both exist in parallel)

### DemoDataGenerator
- `tools/DemoDataGenerator/Program.cs` — entry point, CLI args pattern

### Existing deployment folder (reference implementation)
- `deployment-v0.1.1-rc3-20260112-125216/` — this is the EXACT format to replicate automatically

### Kubernetes / Minikube
- `CLAUDE.md` — port-forward table (18 services), namespace `ez-platform`

</canonical_refs>

<specifics>
## Specific Ideas

- The existing `deployment-v0.1.1-rc3-20260112-125216/` folder IS the reference — CI must produce the same structure automatically
- The `docker` job in current `ci.yml` has image push disabled; the new `docker-build` job replaces/extends it to also export tars
- `minikube image load` can be parallelized: load all tars concurrently with `&` + `wait`
- The `@Sanity` tag is grep-able: `npx playwright test --grep @Sanity`
- Port forwarding on the runner: use the existing `scripts/start-port-forwards.ps1` pattern (kubectl port-forward in background)
- Artifact retention: deployment packages kept 90 days (longer than test artifacts)
- The `sanity-deploy` job should run on the `self-hosted` runner label, other jobs on `ubuntu-latest`

</specifics>

<deferred>
## Deferred

- Full OCP/OpenShift deployment testing in CI (air-gapped OCP is documented but not CI-automated)
- Container registry push (no registry configured; images are tar-based for offline transfer)
- Multi-platform image builds (amd64 only for now)
- Helm chart publishing to a chart repository

</deferred>

---

*Phase: 21-release-package-ci-deployment-pipeline*
*Context gathered: 2026-03-18*

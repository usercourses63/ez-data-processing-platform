# Phase 20: CI/CD & Production Deployment - Research

**Researched:** 2026-03-17
**Domain:** CI/CD pipeline, Helm deployment, version injection, OCP resource configuration
**Confidence:** HIGH

## Summary

Phase 20 extends an existing 3-job CI pipeline (`ci.yml`: build, test, docker) with a Helm deployment job, wires version injection from git tags through the build pipeline to the frontend footer, creates a `values-local.yaml` for single-replica local deployment using release-package image tars, defines proper resource requests/limits for all pods, and validates the release-package by deploying it locally with health checks and a smoke test.

The existing infrastructure is well-developed. The CI pipeline already builds and tests .NET code and builds Docker images. The Helm chart already has full templated deployments for all 10 services and all infrastructure with OCP security context. The frontend footer already displays `VERSION_INFO.version` from `version.ts` which reads Vite `define` variables. The gap is primarily in wiring these pieces together: CI needs to extract git tag versions, pass them to `build-all-images.ps1`, add a Helm lint/template step, create the local values file, tune resource limits to fit a dev PC, and update the release-package install scripts for v0.2.0.

**Primary recommendation:** Extend the existing `ci.yml` with a `helm-validate` job (lint + template) and a `workflow_dispatch` deploy job. Create `values-local.yaml` with all replicas=1 and reduced resources. Fix the Frontend Dockerfile version injection to work with Vite's `define` mechanism (the current `sed` approach targets `__VERSION__` placeholders that do not exist in `version.ts`). Update release-package scripts and manifest for v0.2.0.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full pipeline: build -> test -> Docker build -> Helm deploy
- Docker images: build validation only, no registry push (air-gapped OCP deployment target)
- Existing CI workflow at `.github/workflows/ci.yml` has build+test+docker jobs (118 lines) -- extend it, don't replace
- Use `values-local.yaml` Helm values file with replicas:1 for all services, reduced resource requests to fit dev PC
- Deploy with: `helm install -f values-local.yaml`
- Use release-package pre-built image tars (not build from source) -- validates actual release artifacts
- Version number comes from git tag (e.g. `v0.2.0`)
- CI reads the tag and injects into builds via `build-all-images.ps1 -Version` param
- Frontend: version.ts already reads `__APP_VERSION__`, `__BUILD_DATE__`, `__GIT_COMMIT__` at build time -- ensure CI sets these
- Backend: version info exposed via /health endpoint only -- no UI display needed
- Frontend footer is the user-facing version display
- Validation = health checks + smoke test: all pods healthy, health endpoints return 200, frontend loads, one data source CRUD operation works
- No full E2E test suite required for release-package validation
- Update existing install.ps1/install.sh scripts for v0.2.0: new images (docs-docusaurus), new services, Helm-based deployment option
- PROD-05: proper resource requests/limits for every pod in release-package Helm charts
- OCP security context already defined in `helm/ez-platform/values.yaml` -- extend with per-service resource limits

### Claude's Discretion
- Helm deploy job implementation (self-hosted runner vs workflow_dispatch)
- Exact resource requests/limits per service (based on observed usage)
- Whether to add a Helm lint/template validation step to CI
- Install script update scope (keep kubectl path or add Helm path)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROD-01 | CI/CD pipeline builds, tests, and deploys all services via Helm | Extend ci.yml with helm-validate job + workflow_dispatch deploy; existing build/test/docker jobs cover build+test |
| PROD-02 | All services healthy in production-like deployment | Health endpoint pattern already on all services (/health); Helm readiness/liveness probes configured |
| PROD-03 | Frontend footer displays correct version number injected by CI/CD build pipeline | Fix Dockerfile version injection to use Vite define vars; AppFooter.tsx already displays VERSION_INFO.version |
| PROD-04 | Local production deployment mode -- single-pod replicas | Create values-local.yaml with replicas:1 and reduced resources for all services + infrastructure |
| PROD-05 | OCP resource configuration -- proper requests/limits for all pods | values.yaml already has resource blocks; tune to realistic values; verify all pods covered |
| PROD-06 | Release-package local validation | Update install scripts for v0.2.0; validation script: load images, helm install, health checks, smoke test |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | N/A | CI/CD pipeline | Already in use; extends existing ci.yml |
| Helm | 3.8+ | K8s deployment | Already used in install scripts and chart exists |
| Docker Buildx | v3 | Multi-platform builds | Already configured in ci.yml |
| PowerShell 7+ | 7.0+ | Build scripts | build-all-images.ps1 requires ForEach-Object -Parallel |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `helm lint` | Chart validation | CI pipeline, pre-deploy |
| `helm template` | Render templates without deploying | CI pipeline validation |
| `kubectl wait` | Health verification | Post-deploy validation |
| `minikube image load` | Load tar images to local cluster | Local production mode |

## Architecture Patterns

### Existing CI Pipeline Structure (ci.yml)
```
build (ubuntu-latest)
  -> test (ubuntu-latest, needs: build)
    -> docker (ubuntu-latest, needs: test, only on main)
```

### Extended Pipeline Structure
```
build -> test -> docker -> helm-validate (lint + template)
                                |
                        workflow_dispatch
                                |
                          deploy (manual trigger)
```

### Version Injection Flow
```
Git tag (v0.2.0)
  -> CI extracts version
    -> build-all-images.ps1 -Version "v0.2.0" -CommitSha "abc1234"
      -> Docker build-arg VERSION, COMMIT_SHA
        -> Vite define: __APP_VERSION__, __BUILD_DATE__, __GIT_COMMIT__
          -> version.ts -> AppFooter.tsx displays it
```

### Pattern 1: Git Tag Version Extraction in CI
**What:** Extract version from git tag for tag-triggered builds, fall back to SEMANTIC_VERSION + run number for branch builds.
**When to use:** Docker job version calculation step.
**Example:**
```yaml
- name: Calculate version
  id: version
  run: |
    if [[ "${{ github.ref }}" == refs/tags/v* ]]; then
      VERSION="${GITHUB_REF#refs/tags/}"
    else
      VERSION="v${{ env.SEMANTIC_VERSION }}.${{ github.run_number }}"
    fi
    echo "VERSION=$VERSION" >> $GITHUB_OUTPUT
    echo "COMMIT_SHA=${{ github.sha }}" >> $GITHUB_OUTPUT
```

### Pattern 2: Frontend Dockerfile Version Injection via Vite
**What:** The current Dockerfile uses `sed` to replace `__VERSION__` in `version.ts`, but `version.ts` does not contain `__VERSION__` -- it uses Vite's `define` mechanism with `__APP_VERSION__`.
**Critical finding:** The Dockerfile's `sed` command is a no-op. Version injection must work through Vite's build-time `define` in `vite.config.ts`.
**Fix:** Pass VERSION and COMMIT_SHA as environment variables in the Docker build, and modify `vite.config.ts` to read them:
```typescript
// vite.config.ts - already reads package.json version
// For CI: override with env vars if set
const appVersion = process.env.VERSION || `v${pkg.version}`;
const commitSha = process.env.COMMIT_SHA || gitCommit;
```
Or update `package.json` version during build. The current `vite.config.ts` reads `pkg.version` from `package.json` (currently `0.2.0`), so for CI the VERSION build-arg should be used to set an env var that `vite.config.ts` picks up.

### Pattern 3: values-local.yaml for Dev PC
**What:** Single-replica deployment with reduced resources.
**When to use:** Local testing of release-package images.
**Key decisions:**
- All application services: replicas=1, requests: cpu=50m memory=128Mi, limits: cpu=500m memory=512Mi
- Infrastructure: replicas=1, reduced storage (MongoDB 5Gi, Kafka 2Gi, Hazelcast 1Gi)
- Frontend image repo must match minikube-loaded image names (no registry prefix)
- `imagePullPolicy: Never` for minikube (images loaded via `minikube image load`)

### Anti-Patterns to Avoid
- **Replacing ci.yml entirely:** User explicitly said extend, not replace. Add jobs, don't restructure existing ones.
- **Building from source for local validation:** Must use pre-built release-package tars to validate actual artifacts.
- **Pushing images to a registry in CI:** Air-gapped target means no registry push. Build validation only.
- **Using `:latest` tags for infrastructure images:** OCP requires pinned versions. The IMAGE-MANIFEST.txt still has `:latest` for some infra images -- these need pinning.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Helm chart validation | Custom YAML linter | `helm lint` + `helm template` | Catches template errors, missing values, YAML issues |
| Health check polling | Custom curl loop | `kubectl wait --for=condition=ready` | Built-in timeout and retry, standard K8s mechanism |
| Image loading | Manual docker load loop | Existing `scripts/load-images.sh` pattern | Already handles all images with error checking |
| Version extraction | Custom shell parsing | GitHub Actions `github.ref` context | Reliable, tested, handles edge cases |

## Common Pitfalls

### Pitfall 1: Frontend Dockerfile sed Version Injection is a No-Op
**What goes wrong:** The current `Frontend.Dockerfile` runs `sed -i "s/__VERSION__/${VERSION}/g" src/version.ts` but `version.ts` does not contain `__VERSION__` -- it uses `__APP_VERSION__` via Vite's `define`. The sed command silently does nothing.
**Why it happens:** The Dockerfile was written for a placeholder-based approach, but the actual code uses Vite build-time variable injection.
**How to avoid:** Modify `vite.config.ts` to prefer `process.env.VERSION` over `pkg.version`, or update the Dockerfile to set environment variables that Vite reads during `npm run build`.
**Warning signs:** Version displays as `v0.2.0` (from package.json) regardless of CI VERSION arg.

### Pitfall 2: Minikube Image Name Mismatch
**What goes wrong:** Helm values reference images as `ez-platform/filediscovery:v0.2.0` but release-package tars may be saved with different names (e.g., `filediscovery:v0.1.1-rc3`).
**Why it happens:** Image tags in release-package are from v0.1.1-rc3, but Helm chart expects v0.2.0.
**How to avoid:** Rebuild images as v0.2.0 for release-package, or retag after loading. The `values-local.yaml` must match the actual loaded image names.
**Warning signs:** `ErrImagePull` or `ImagePullBackOff` in pod status.

### Pitfall 3: Infrastructure `:latest` Tags Violate OCP
**What goes wrong:** IMAGE-MANIFEST.txt lists `prom/prometheus:latest`, `grafana/grafana:latest`, etc. OCP requires pinned versions.
**Why it happens:** Original manifest from v0.1.1-rc1 wasn't updated for OCP compliance.
**How to avoid:** Pin all infrastructure images to specific versions in both IMAGE-MANIFEST.txt and values.yaml.
**Warning signs:** OCP admission controller rejects pods with `:latest` tags.

### Pitfall 4: Resource Requests Too High for Dev PC
**What goes wrong:** values.yaml production defaults sum to ~20 CPU cores and ~60GB RAM across all pods. A dev PC cannot run this.
**Why it happens:** Production values designed for real clusters.
**How to avoid:** values-local.yaml must dramatically reduce: ~50m CPU request per service, 128-256Mi memory request, with reasonable limits.
**Warning signs:** Pods stuck in Pending with insufficient resource events.

### Pitfall 5: Helm --wait Timeout on Slow Dev PC
**What goes wrong:** `helm install --wait` times out because infrastructure pods (MongoDB, Kafka, Elasticsearch) take 2-5 minutes to start on a dev PC.
**Why it happens:** Default timeout may be too short for resource-constrained environment.
**How to avoid:** Use `--timeout 15m` (already in install.ps1). Ensure readiness probes have generous `initialDelaySeconds`.
**Warning signs:** Helm install fails with timeout error even though pods are starting.

### Pitfall 6: MongoDB Replica Set Initialization
**What goes wrong:** MongoDB starts but isn't part of a replica set, breaking the connection string.
**Why it happens:** Single-node MongoDB needs `rs.initiate()` after first start. The Helm chart may not include an init job for this.
**How to avoid:** Include a post-install Helm hook that runs `rs.initiate()` on the MongoDB pod, or use `directConnection=true` in the connection string.
**Warning signs:** Services crash with "not primary" or "no replica set member" errors.

## Code Examples

### CI Pipeline Extension: Helm Validate Job
```yaml
# Add to ci.yml after docker job
helm-validate:
  needs: docker
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install Helm
      uses: azure/setup-helm@v4

    - name: Lint Helm chart
      run: helm lint helm/ez-platform/

    - name: Template validation
      run: |
        helm template ez-platform helm/ez-platform/ \
          --values helm/ez-platform/values.yaml \
          --values helm/ez-platform/values-local.yaml \
          > /dev/null
```

### CI Pipeline Extension: Tag-Triggered Builds
```yaml
on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]
```

### values-local.yaml Structure
```yaml
# Local production deployment - single replicas, reduced resources
# Usage: helm install ez-platform ./helm/ez-platform -f values-local.yaml

global:
  namespace: ez-platform
  imagePullPolicy: Never  # Images loaded via minikube image load

services:
  filediscovery:
    replicas: 1
    resources:
      requests: { cpu: 50m, memory: 128Mi }
      limits: { cpu: 500m, memory: 512Mi }
  fileprocessor:
    replicas: 1
    resources:
      requests: { cpu: 50m, memory: 128Mi }
      limits: { cpu: 500m, memory: 512Mi }
  # ... same pattern for all 10 services

mongodb:
  replicas: 1
  storage: 5Gi
  resources:
    requests: { cpu: 100m, memory: 256Mi }
    limits: { cpu: 500m, memory: 1Gi }

kafka:
  replicas: 1
  storage: 2Gi
  zookeeper:
    replicas: 1
  resources:
    requests: { cpu: 100m, memory: 256Mi }
    limits: { cpu: 500m, memory: 1Gi }

hazelcast:
  replicas: 1
  storage: 1Gi
  resources:
    requests: { cpu: 50m, memory: 128Mi }
    limits: { cpu: 500m, memory: 512Mi }
```

### Release-Package Validation Script Pattern
```powershell
# 1. Load images
foreach ($tar in Get-ChildItem images/ -Filter *.tar) {
    minikube image load $tar.FullName
}

# 2. Deploy via Helm
helm install ez-platform ./helm/ez-platform -f values-local.yaml --wait --timeout 15m

# 3. Health checks
$services = @("datasource-management:5001", "validation:5003", "fileprocessor:5008")
foreach ($svc in $services) {
    $name, $port = $svc -split ':'
    kubectl port-forward svc/$name ${port}:${port} -n ez-platform &
    Start-Sleep 2
    $response = Invoke-WebRequest "http://localhost:${port}/health" -UseBasicParsing
    if ($response.StatusCode -ne 200) { throw "Health check failed: $name" }
}

# 4. Smoke test: frontend loads
# 5. Smoke test: data source CRUD via API
```

### Vite Version Override for CI
```typescript
// In vite.config.ts define section - override with env vars for CI builds
define: {
    __APP_VERSION__: JSON.stringify(process.env.VERSION || `v${pkg.version}`),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GIT_COMMIT__: JSON.stringify(process.env.COMMIT_SHA?.substring(0, 7) || gitCommit),
    __GIT_BRANCH__: JSON.stringify(gitBranch),
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sed-based version injection in Dockerfile | Vite `define` build-time vars | Already in code | Dockerfile sed is dead code; must use env vars for Vite |
| kubectl apply -f for deployment | Helm install with values files | Helm chart exists | Install scripts already use Helm |
| Single values.yaml for all envs | values.yaml + values-{env}.yaml overlays | Already in chart | values-local.yaml follows existing pattern |

**Existing assets that are already correct and should not be modified:**
- `AppFooter.tsx` -- already displays version correctly from VERSION_INFO
- `version.ts` -- already reads Vite `define` variables with fallbacks
- `_helpers.tpl` -- image helper already supports tag override via values
- `install.ps1`/`install.sh` -- already Helm-based with --values support
- `build-all-images.ps1` -- already supports -Version and -CommitSha params with env var override

**Assets that need updates:**
- `ci.yml` -- add helm-validate job, add tag trigger, fix version extraction for tags
- `Frontend.Dockerfile` -- fix version injection (remove dead sed, use env vars for Vite)
- `values.yaml` -- review resource limits for OCP compliance
- `IMAGE-MANIFEST.txt` -- pin infrastructure image versions, add docs-docusaurus
- `release-package/README.md` -- update for v0.2.0
- `install.ps1`/`install.sh` -- update version references, verify Helm path works with values-local.yaml

## Open Questions

1. **MongoDB Init in Helm**
   - What we know: Single-node MongoDB needs `rs.initiate()`. The Helm chart `hooks/` directory exists but contents not verified.
   - What's unclear: Whether a post-install hook already handles replica set initialization.
   - Recommendation: Check `helm/ez-platform/templates/hooks/` during implementation. If no MongoDB init hook exists, add one.

2. **Frontend Image Repository Name**
   - What we know: values.yaml uses `frontend` (no `ez-platform/` prefix) for frontend but `ez-platform/filediscovery` for backend services.
   - What's unclear: Whether this inconsistency causes issues with `minikube image load`.
   - Recommendation: Ensure values-local.yaml image repos match exactly what `minikube image load` registers. Test with `minikube image ls`.

3. **Docs Image Name**
   - What we know: values.yaml uses `ezplatform/docs` but build script creates `ez-platform/docusaurus`. Release-package has `ezplatform-docs-v0.1.1-rc1-updated.tar.gz`.
   - What's unclear: The exact image name inside the tar and whether it matches Helm values.
   - Recommendation: Standardize on one name. Update values.yaml OR build script to match.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (health checks + smoke test) |
| Config file | None -- shell scripts |
| Quick run command | `kubectl get pods -n ez-platform` (all Running) |
| Full suite command | Validation script: load images + helm install + health checks + CRUD smoke test |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROD-01 | CI pipeline builds, tests, deploys via Helm | manual | `helm lint helm/ez-platform/` | N/A (CI config) |
| PROD-02 | All services healthy | smoke | `kubectl wait --for=condition=ready pod --all -n ez-platform --timeout=300s` | Wave 0 |
| PROD-03 | Frontend footer shows version | manual | Load frontend, inspect footer | N/A |
| PROD-04 | Local mode single replicas | smoke | `kubectl get pods -n ez-platform` (verify counts) | Wave 0 |
| PROD-05 | OCP resource config | unit | `helm template ... \| grep resources` | Wave 0 |
| PROD-06 | Release-package validates | smoke | Full validation script | Wave 0 |

### Sampling Rate
- **Per task commit:** `helm lint helm/ez-platform/`
- **Per wave merge:** Full validation script run
- **Phase gate:** All pods healthy + smoke test passes

### Wave 0 Gaps
- [ ] `helm/ez-platform/values-local.yaml` -- local production mode values
- [ ] Validation script (PowerShell) -- health checks + smoke test
- [ ] Helm lint passes with values-local.yaml overlay

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `ci.yml`, `build-all-images.ps1`, `values.yaml`, `Chart.yaml`, `values-dev.yaml`, `values-prod.yaml`, `_helpers.tpl`
- Direct codebase inspection: `version.ts`, `vite.config.ts`, `AppFooter.tsx`, `Frontend.Dockerfile`
- Direct codebase inspection: `install.ps1`, `install.sh`, `IMAGE-MANIFEST.txt`, release-package structure
- Direct codebase inspection: All Helm deployment templates in `helm/ez-platform/templates/deployments/`

### Secondary (MEDIUM confidence)
- GitHub Actions documentation for `workflow_dispatch` trigger and tag-based triggers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already in use in codebase
- Architecture: HIGH - extending existing patterns with clear code evidence
- Pitfalls: HIGH - discovered through direct code inspection (e.g., sed no-op in Dockerfile)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable infrastructure, no rapid changes expected)

---
phase: 20-cicd-production-deployment
verified: 2026-03-18T13:00:00Z
status: gaps_found
score: 4/6 success criteria verified
gaps:
  - truth: "CI/CD pipeline builds, tests, and deploys all services via Helm"
    status: partial
    reason: >
      CI pipeline builds and tests correctly, and validates Helm charts (helm lint + template),
      but image push is explicitly disabled with a placeholder comment
      ('Image push disabled until container registry configured'). Without a registry push,
      the 'deploys via Helm' part of PROD-01 cannot be satisfied — Helm cannot deploy
      images that were never pushed. The pipeline stops at build-only.
    artifacts:
      - path: ".github/workflows/ci.yml"
        issue: >
          Line 156-170: docker job has '# Placeholder for push - will be enabled when
          registry is configured' comment. No helm install/upgrade step exists anywhere
          in the pipeline. The helm-validate job only lints/templates; it does not deploy.
    missing:
      - "Container registry configuration (secret + registry URL) and docker push step in CI"
      - "Helm deployment step in CI (helm upgrade --install) targeting a configured cluster,
         OR explicit acknowledgment that PROD-01 scope is build+validate only (not deploy)"

  - truth: "Frontend footer displays correct version from CI/CD build"
    status: partial
    reason: >
      The code wiring is complete and correct — vite.config.ts reads process.env.VERSION,
      Dockerfile sets ENV VERSION=${VERSION}, CI extracts version from git tag and passes
      it to docker build. The entire injection chain is implemented. However, whether
      the footer actually *shows* the tag version has not been verified by running a
      real CI build on a v* tag. This requires a human to push a tag and observe the
      deployed frontend footer, or inspect a built Docker image's built JS.
    artifacts:
      - path: "src/Frontend/vite.config.ts"
        issue: "Code correct but runtime behavior unverified (needs actual CI tag build)"
      - path: "docker/Frontend.Dockerfile"
        issue: "ENV wiring correct but end-to-end has not been exercised"
    missing:
      - "Human verification: push a v* tag, observe CI build, check frontend footer shows that version"

human_verification:
  - test: "Push a v0.2.0-test tag and observe CI pipeline"
    expected: >
      CI builds with VERSION=v0.2.0-test, Docker image is built with that version,
      and the frontend footer shows 'v0.2.0-test' when the container is run.
    why_human: >
      Cannot verify version display without executing a real CI run with a git tag.
      Static grep confirms the wiring is correct, but only a real build proves the
      define substitution works end-to-end through Vite's build pipeline.
---

# Phase 20: CI/CD & Production Deployment Verification Report

**Phase Goal:** Production-ready CI/CD pipeline and local deployment mode
**Verified:** 2026-03-18T13:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #  | Truth                                                              | Status       | Evidence                                                          |
|----|--------------------------------------------------------------------|--------------|-------------------------------------------------------------------|
| 1  | CI/CD pipeline builds, tests, and deploys all services via Helm   | PARTIAL      | Builds + validates helm: YES. Image push and deploy step: MISSING |
| 2  | All services healthy in production-like deployment                 | VERIFIED     | validate-release.ps1 health-checks all 6 backend services + frontend |
| 3  | Frontend footer displays correct version from CI/CD build          | PARTIAL      | Code wiring verified; actual runtime display needs human check    |
| 4  | Local production mode deploys with single-pod replicas             | VERIFIED     | values-local.yaml has replicas: 1 for all 15 components           |
| 5  | OCP resource requests/limits defined for all pods                  | VERIFIED     | values.yaml and values-local.yaml both define resources for every service |
| 6  | Release-package deploys locally and passes end-to-end validation   | VERIFIED     | validate-release.ps1 performs 4-phase: load, deploy, health, smoke test |

**Score:** 4/6 fully verified (2 partial — 1 gap, 1 needs human)

---

## Required Artifacts

| Artifact                               | Provides                                              | Status     | Details                                                   |
|----------------------------------------|-------------------------------------------------------|------------|-----------------------------------------------------------|
| `.github/workflows/ci.yml`             | Extended pipeline: tag trigger, version extraction, helm-validate job | VERIFIED | tags: ['v*'], helm-validate job, GITHUB_REF#refs/tags/ extraction |
| `src/Frontend/vite.config.ts`          | Reads VERSION env var for CI builds                   | VERIFIED   | Line 23: `process.env.VERSION \|\| \`v${pkg.version}\`` |
| `docker/Frontend.Dockerfile`           | ENV VERSION set for Vite build                        | VERIFIED   | Line 25-26: ENV VERSION=${VERSION}, ENV COMMIT_SHA=${COMMIT_SHA}, no dead sed |
| `helm/ez-platform/values-local.yaml`   | Single-replica local deployment values                | VERIFIED   | imagePullPolicy: Never, 15x replicas: 1, dev resources    |
| `helm/ez-platform/values.yaml`         | Production OCP resource limits (hazelcast right-sized) | VERIFIED  | Hazelcast memory: 1Gi request (was 8Gi), resources on all services |
| `release-package/IMAGE-MANIFEST.txt`   | Pinned infrastructure images, v0.2.0 app tags         | VERIFIED   | No :latest, no v0.1.1, all app images at v0.2.0           |
| `scripts/validate-release.ps1`         | 4-phase validation: load, helm, health, smoke         | VERIFIED   | All 4 phases present, exits 0/1 correctly                 |
| `release-package/install.ps1`          | Updated Windows install script for v0.2.0             | VERIFIED   | v0.2.0 banner, --local flag, port 8080, no v0.1.1 refs   |
| `release-package/install.sh`           | Updated Linux install script for v0.2.0               | VERIFIED   | v0.2.0 banner, --local flag, port 8080, no v0.1.1 refs   |
| `release-package/README.md`            | v0.2.0 package with Docusaurus references             | VERIFIED   | v0.2.0 throughout, Docusaurus (not MkDocs), values-local.yaml noted |

---

## Key Link Verification

| From                              | To                                   | Via                                       | Status     | Details                                       |
|-----------------------------------|--------------------------------------|-------------------------------------------|------------|-----------------------------------------------|
| `.github/workflows/ci.yml`        | `scripts/build-all-images.ps1`       | VERSION output passed as env var          | VERIFIED   | Line 151-154: env VERSION/COMMIT_SHA from step output |
| `docker/Frontend.Dockerfile`      | `src/Frontend/vite.config.ts`        | ENV VERSION → process.env.VERSION          | VERIFIED   | Lines 25-26 set ENV; vite.config.ts line 23 reads it |
| `scripts/validate-release.ps1`    | `helm/ez-platform/values-local.yaml` | helm install --values values-local.yaml   | VERIFIED   | Line 50: --values helm/ez-platform/values-local.yaml |
| `scripts/validate-release.ps1`    | `release-package/IMAGE-MANIFEST.txt` | ImageDir = "release-package/images"       | PARTIAL    | Loads *.tar* from images/ dir; does not parse manifest file directly. Functional but indirect. |
| `.github/workflows/ci.yml`        | container registry / production cluster | docker push + helm deploy               | NOT_WIRED  | Push is a placeholder ("disabled until registry configured"). No helm deploy step exists. |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                              | Status      | Evidence                                        |
|-------------|-------------|----------------------------------------------------------|-------------|------------------------------------------------ |
| PROD-01     | 20-01       | CI/CD pipeline builds, tests, and deploys via Helm       | PARTIAL     | Builds + helm-validates; deploy step absent (push disabled, no helm deploy) |
| PROD-02     | 20-03       | All services healthy in production-like deployment       | SATISFIED   | validate-release.ps1 health-checks 6 services + frontend + API CRUD |
| PROD-03     | 20-01       | Frontend footer displays version from CI/CD build        | PARTIAL     | Wiring complete; runtime display needs human test |
| PROD-04     | 20-02       | Local production mode with single replicas               | SATISFIED   | values-local.yaml: imagePullPolicy Never + 15x replicas: 1 |
| PROD-05     | 20-02       | OCP resource config for all pods                         | SATISFIED   | values.yaml + values-local.yaml define requests/limits for every service |
| PROD-06     | 20-03       | Release-package local validation                         | SATISFIED   | validate-release.ps1: 4-phase, loads images, helm install, health, smoke |

**REQUIREMENTS.md status at time of verification:**
- PROD-01: still marked `[ ]` Pending — consistent with partial implementation
- PROD-02: marked `[x]` Complete — consistent with VERIFIED
- PROD-03: still marked `[ ]` Pending — consistent with partial implementation
- PROD-04: marked `[x]` Complete — consistent with VERIFIED
- PROD-05: marked `[x]` Complete — consistent with VERIFIED
- PROD-06: marked `[x]` Complete — consistent with VERIFIED

No orphaned requirements — all 6 PROD IDs claimed in plan frontmatter and present in REQUIREMENTS.md traceability table for Phase 20.

---

## Anti-Patterns Found

| File                           | Line | Pattern                                           | Severity | Impact                                    |
|--------------------------------|------|---------------------------------------------------|----------|-------------------------------------------|
| `.github/workflows/ci.yml`     | 156  | `# Placeholder for push - will be enabled...`    | BLOCKER  | Image push never happens; PROD-01 deploy requirement unmet |
| `.github/workflows/ci.yml`     | 170  | `"Note: Image push disabled until container registry configured."` | BLOCKER | Confirms push is intentionally skipped |
| `docker/Frontend.Dockerfile`   | 38   | `FROM nginx:alpine` (unpinned alpine tag)          | WARNING  | nginx:alpine resolves to different versions over time; OCP compliance recommends pinned versions |
| `docker/Frontend.Dockerfile`   | 38   | Port 80 in EXPOSE + healthcheck uses port 80       | WARNING  | OCP requires non-privileged ports (>1024); OCP compliance note from Phase 19 |

---

## Human Verification Required

### 1. Frontend version display via CI tag build

**Test:** Push a git tag matching `v*` (e.g. `v0.2.0-verify`) to the main repo. Wait for the CI pipeline to complete the `docker` job. Run the resulting frontend image and check the footer.

**Expected:** The footer shows the exact tag version string (e.g. `v0.2.0-verify`) rather than the package.json version (`v0.2.0`).

**Why human:** Static analysis confirms the Vite `define` substitution chain is correctly wired (`process.env.VERSION` → `ENV VERSION` → `--build-arg VERSION`). Whether the Vite build pipeline actually substitutes the value correctly in the compiled bundle can only be confirmed by running a CI build against a real git tag and inspecting the output. The build happens in GitHub Actions, not locally.

---

## Gaps Summary

Two gaps block full goal achievement for Phase 20:

**Gap 1 — PROD-01 deploy step missing (Blocker):**
The CI pipeline correctly builds all Docker images and validates the Helm chart. However, the image push step is explicitly disabled with a placeholder comment. Without images in a registry, no Helm deployment to any cluster is possible from CI. The "deploys all services via Helm" part of PROD-01 and SC-1 is unimplemented. This was likely a deliberate decision (registry not yet configured) but means PROD-01 remains partially open.

The gap can be resolved in one of two ways:
1. Configure a container registry (GitHub Container Registry, Docker Hub, or internal) and add `docker push` + `helm upgrade --install` steps to the CI pipeline.
2. Formally narrow PROD-01 scope to "builds and validates" and defer the deploy step to Phase 21 (release package).

**Gap 2 — PROD-03 runtime verification needed (Human):**
The entire version injection chain from git tag to Vite define to frontend bundle is correctly implemented in code. This needs a single human test: push a tag, observe the build, confirm the footer version. No code changes are needed — just confirmation.

The PROD-04, PROD-05, PROD-06, PROD-02 requirements are fully satisfied with substantive, well-wired implementations.

---

_Verified: 2026-03-18T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
